# ─── ANALYTICS: AVERAGE METRICS ENDPOINT ─────────────────────────────────────
# ─── ANALYTICS: DOCUMENT USAGE (last 7 days) ──────────────────────────────────

# ─── ANALYTICS: QUERY TREND (last 7 days) ─────────────────────────────────────
from fastapi.responses import JSONResponse
from datetime import timedelta


from fastapi import Depends, FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from fastapi.responses import FileResponse
import os, uuid, json, time

from services.ingest_service import ingest_document
from services.rag_service import ask_question, init_qdrant, is_ingested
from db import get_connection, ensure_tables, log_activity
from config import UPLOAD_DIR, ALLOWED_EXTENSIONS
from auth.dependencies import get_current_user, require_role
from auth.auth_routes import router as auth_router

app = FastAPI()
app.include_router(auth_router, prefix="/api/auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    print(f"Upload directory ready: {UPLOAD_DIR}")
    ensure_tables()
    init_qdrant()

@app.get("/api/ping")
def ping():
    return {"status": "ok"}

# @app.get("/api/debug/chunks")
# def debug_chunks(filename: str, user=Depends(get_current_user)):
#     """Debug: shows what chunks are stored in Qdrant for a document."""
#     from services.rag_service import get_qdrant
#     from qdrant_client.models import Filter, FieldCondition, MatchValue
#     user_id = user["user_id"]
#     client = get_qdrant()
#     try:
#         results, _ = client.scroll(
#             collection_name="documents",
#             scroll_filter=Filter(must=[
#                 FieldCondition(key="source",  match=MatchValue(value=filename)),
#                 FieldCondition(key="user_id", match=MatchValue(value=user_id)),
#             ]),
#             limit=100,
#             with_vectors=False,
#             with_payload=True,
#         )
#         chunks = [{"id": str(r.id), "text_preview": (r.payload or {}).get("text", "")[:120]} for r in results]
#         return {"filename": filename, "user_id": user_id, "chunk_count": len(chunks), "chunks": chunks}
#     finally:
#         client.close()


# ─── UPLOAD — any authenticated user can upload their own files ───────────────
@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")

    user_id    = user["user_id"]
    session_id = str(uuid.uuid4())

    safe_name = os.path.basename(file.filename)
    disk_name = f"{user_id}_{safe_name}"
    file_path = os.path.join(UPLOAD_DIR, disk_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO document_registry (filename, file_path, session_id, user_id, status)
               VALUES (%s, %s, %s, %s, 'uploaded')
               ON DUPLICATE KEY UPDATE
                 file_path=VALUES(file_path),
                 session_id=VALUES(session_id),
                 uploaded_at=CURRENT_TIMESTAMP, status='uploaded'""",
            (safe_name, file_path, session_id, user_id),
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()

    log_activity(user_id, "upload", document_name=safe_name,
                 detail=f"size={len(content)} bytes")

    return {"status": "success", "filename": safe_name,
            "file_path": file_path, "session_id": session_id}


# ─── ANALYTICS: AVERAGE METRICS ───────────────────────────────────────────────
@app.get("/api/analytics/avg-metrics")
def analytics_avg_metrics():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT AVG(response_time_ms) FROM user_activity_log WHERE action_type='chat' AND response_time_ms IS NOT NULL")
        avg_response_time_ms = cur.fetchone()[0]
        if avg_response_time_ms is None:
            avg_response_time = 0.0
        else:
            avg_response_time = round(float(avg_response_time_ms) / 1000.0, 2)

        cur.execute("""
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'user_activity_log'
              AND COLUMN_NAME = 'confidence_score'
        """)
        has_confidence = cur.fetchone()[0] > 0
        if has_confidence:
            cur.execute("SELECT AVG(confidence_score) FROM chat_messages")
            avg_confidence = cur.fetchone()[0]
            if avg_confidence is None:
                avg_confidence = 0.0
            else:
                avg_confidence = round(avg_confidence, 2)
        else:
            avg_confidence = 0.0

        cur.close()
    finally:
        conn.close()

    return JSONResponse({
        "avgResponseTime": avg_response_time,
        "avgConfidence": avg_confidence
    })


# ─── LIST DOCUMENTS ───────────────────────────────────────────────────────────
@app.get("/api/documents/list")
def list_documents(user=Depends(get_current_user)):
    user_id = user["user_id"]

    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT dr.id, dr.filename, dr.file_path, dr.session_id,
                   dr.user_id, dr.uploaded_at, dr.status,
                   u.username AS uploader_name
            FROM document_registry dr
            LEFT JOIN users u ON u.id = dr.user_id
            WHERE dr.user_id = %s
            ORDER BY dr.uploaded_at DESC
        """, (user_id,))
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    files = []
    for rec in rows:
        fname = rec["filename"]
        upload_date = (rec["uploaded_at"].strftime("%Y-%m-%d")
                       if hasattr(rec["uploaded_at"], "strftime")
                       else str(rec["uploaded_at"])[:10])
        files.append({
            "id":           rec["id"],
            "name":         fname,
            "file_path":    rec["file_path"],
            "session_id":   rec["session_id"],
            "uploadedBy":   rec.get("uploader_name") or "Unknown",
            "uploadDate":   upload_date,
            "lastChatDate": None,
            "status":       rec["status"],
            "ownerId":      rec["user_id"],
        })

    return {"documents": files}


# ─── ANALYTICS: QUERY TREND ───────────────────────────────────────────────────
@app.get("/api/analytics/query-trend")
def analytics_query_trend():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM chat_sessions
            WHERE created_at >= CURDATE() - INTERVAL 6 DAY
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        """)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    counts = {row[0].strftime('%Y-%m-%d') if hasattr(row[0], 'strftime') else str(row[0]): row[1] for row in rows}
    today = datetime.now().date()
    result = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime('%Y-%m-%d')
        result.append({
            "date": day_str,
            "count": counts.get(day_str, 0)
        })

    return JSONResponse(result)


# ─── INGEST ───────────────────────────────────────────────────────────────────
@app.post("/api/documents/ingest/{filename}")
def ingest_selected_document(filename: str, user=Depends(get_current_user)):
    user_id   = user["user_id"]
    user_role = user.get("role", "user")

    conn = get_connection()
    row = None
    try:
        cur = conn.cursor(dictionary=True)
        if user_role == "admin":
            cur.execute(
                "SELECT file_path, user_id FROM document_registry WHERE filename=%s ORDER BY uploaded_at DESC LIMIT 1",
                (filename,)
            )
        else:
            cur.execute(
                "SELECT file_path, user_id FROM document_registry WHERE filename=%s AND user_id=%s LIMIT 1",
                (filename, user_id)
            )
        row = cur.fetchone()
        cur.close()
    finally:
        conn.close()

    owner_id  = row["user_id"] if row else user_id
    file_path = row["file_path"] if row else None

    if not file_path or not os.path.exists(file_path):
        for candidate in [
            os.path.join(UPLOAD_DIR, f"{owner_id}_{filename}"),
            os.path.join(UPLOAD_DIR, f"{user_id}_{filename}"),
            os.path.join(UPLOAD_DIR, filename),
        ]:
            if os.path.exists(candidate):
                file_path = candidate
                break
    if not file_path:
        raise HTTPException(status_code=404, detail="File not found")

    t0 = time.time()
    try:
        ingest_document(file_path, filename, owner_id)
    except ValueError as e:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE document_registry SET status='Failed' WHERE filename=%s AND user_id=%s",
                (filename, owner_id)
            )
            conn.commit()
            cur.close()
        finally:
            conn.close()
        raise HTTPException(status_code=422, detail=str(e))
    elapsed_ms = int((time.time() - t0) * 1000)

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE document_registry SET status='Completed' WHERE filename=%s AND user_id=%s",
            (filename, owner_id)
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()

    log_activity(user_id, "ingest", document_name=filename,
                 response_time_ms=elapsed_ms)

    return {"message": "Document ingested successfully", "filename": filename}


# ─── CHAT SESSION — CREATE ────────────────────────────────────────────────────
class CreateSessionRequest(BaseModel):
    document_name: str

@app.post("/api/chat/session")
def create_chat_session(req: CreateSessionRequest, user=Depends(get_current_user)):
    session_id = str(uuid.uuid4())
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO chat_sessions (session_id, document_name, user_id, title) VALUES (%s,%s,%s,'New Chat')",
            (session_id, req.document_name, user["user_id"]),
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return {"session_id": session_id, "document_name": req.document_name, "title": "New Chat"}


# ─── CHAT SESSIONS — LIST ─────────────────────────────────────────────────────
@app.get("/api/chat/sessions")
def get_chat_sessions(user=Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT cs.session_id, cs.document_name, cs.title,
                   cs.created_at, cs.updated_at,
                   (SELECT content FROM chat_messages
                    WHERE session_id=cs.session_id AND role='user'
                    ORDER BY id DESC LIMIT 1) AS last_message
            FROM chat_sessions cs
            WHERE cs.user_id=%s
            ORDER BY cs.updated_at DESC
        """, (user["user_id"],))
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    return [{
        "id":           r["session_id"],
        "session_id":   r["session_id"],
        "documentName": r["document_name"],
        "title":        r["title"],
        "lastMessage":  r["last_message"] or "",
        "createdAt":    r["created_at"].isoformat() if r["created_at"] else None,
        "updatedAt":    r["updated_at"].isoformat() if r["updated_at"] else None,
    } for r in rows]


# ─── CHAT SESSION — GET MESSAGES ──────────────────────────────────────────────
@app.get("/api/chat/sessions/{session_id}/messages")
def get_session_messages(session_id: str, user=Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT session_id FROM chat_sessions WHERE session_id=%s AND user_id=%s",
            (session_id, user["user_id"])
        )
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="Access denied")
        cur.execute(
            "SELECT id, role, content, sources, is_favourite, created_at "
            "FROM chat_messages WHERE session_id=%s ORDER BY id ASC",
            (session_id,),
        )
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    messages = []
    for r in rows:
        sources = []
        if r["sources"]:
            try: sources = json.loads(r["sources"])
            except: pass
        messages.append({
            "id":          str(r["id"]),
            "role":        r["role"],
            "content":     r["content"],
            "sources":     sources,
            "isFavourite": bool(r["is_favourite"]),
            "createdAt":   r["created_at"].isoformat() if r["created_at"] else None,
        })
    return {"messages": messages}


# ─── ANALYTICS SUMMARY ────────────────────────────────────────────────────────
@app.get("/api/analytics/summary")
def analytics_summary():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM document_registry")
        total_docs = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM chat_sessions")
        total_queries = cur.fetchone()[0]

        cur.execute("SELECT AVG(response_time_ms) FROM user_activity_log WHERE action_type='chat' AND response_time_ms IS NOT NULL")
        avg_response_time_ms = cur.fetchone()[0]
        if avg_response_time_ms is None:
            avg_response_time = 0.0
        else:
            avg_response_time = round(float(avg_response_time_ms) / 1000.0, 2)

        cur.execute("SELECT AVG(confidence_score) FROM user_activity_log WHERE action_type='chat' AND confidence_score IS NOT NULL")
        avg_confidence = cur.fetchone()[0]
        if avg_confidence is None:
            avg_confidence = 0.0
        else:
            avg_confidence = round(avg_confidence, 2)

        cur.close()
    finally:
        conn.close()

    return JSONResponse({
        "totalDocs": total_docs,
        "totalQueries": total_queries,
        "avgResponseTime": avg_response_time,
        "avgConfidence": avg_confidence
    })


# ─── CHAT — ASK ───────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    question:        str
    document:        str
    session_id:      Optional[str] = None
    confidenceScore: Optional[float] = None

@app.post("/api/chat/ask")
def chat(req: ChatRequest, user=Depends(get_current_user)):
    user_id = user["user_id"]

    file_path_ai = None
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT file_path FROM document_registry WHERE filename=%s AND user_id=%s LIMIT 1",
            (req.document, user_id)
        )
        row = cur.fetchone()
        cur.close()
    finally:
        conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="The selected document was deleted or is no longer available. Please select another document."
        )

    file_path_ai = row["file_path"]
    if not file_path_ai or not os.path.exists(file_path_ai):
        raise HTTPException(
            status_code=404,
            detail="The selected document file is missing. Please upload or select another document."
        )

    session_id = req.session_id
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)

        if session_id:
            cur.execute(
                "SELECT session_id FROM chat_sessions WHERE session_id=%s AND user_id=%s",
                (session_id, user_id)
            )
            if not cur.fetchone():
                session_id = None

        if not session_id:
            session_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO chat_sessions (session_id, document_name, user_id, title) VALUES (%s,%s,%s,%s)",
                (session_id, req.document, user_id, req.question[:80]),
            )
        else:
            cur.execute(
                "UPDATE chat_sessions SET title=IF(title='New Chat',%s,title), updated_at=NOW() WHERE session_id=%s",
                (req.question[:80], session_id),
            )

        conn.commit()
        cur.close()
    finally:
        conn.close()

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO chat_messages (session_id, role, content) VALUES (%s,'user',%s)",
            (session_id, req.question)
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()

    if not is_ingested(req.document, user_id):
        try:
            ingest_document(file_path_ai, req.document, user_id)
        except Exception as e:
            print(f"[Auto-ingest] Failed: {e}")

    t0 = time.time()
    result = ask_question(req.question, req.document, user_id)
    response_time_ms = int((time.time() - t0) * 1000)

    answer = result["answer"]
    sources = result["sources"]

    if "score" in result and isinstance(result["score"], (int, float)):
        confidence_score = float(result["score"])
    else:
        if len(sources) >= 3:
            confidence_score = 0.9
        elif len(sources) == 2:
            confidence_score = 0.7
        elif len(sources) == 1:
            confidence_score = 0.5
        else:
            confidence_score = 0.2

    confidence_score = max(0.0, min(1.0, confidence_score))

    message_db_id = None
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO chat_messages (session_id, role, content, sources, confidence_score) VALUES (%s,'assistant',%s,%s,%s)",
            (session_id, answer, json.dumps(sources), confidence_score),
        )
        message_db_id = cur.lastrowid
        cur.execute(
            "UPDATE chat_sessions SET updated_at=NOW() WHERE session_id=%s",
            (session_id,)
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()

    log_activity(
        user_id,
        "chat",
        document_name=req.document,
        session_id=session_id,
        detail=req.question[:200],
        response_time_ms=response_time_ms,
        confidence_score=req.confidenceScore
    )

    return {
        "answer": answer,
        "sources": sources,
        "session_id": session_id,
        "message_id": message_db_id,
        "confidence": confidence_score,
        "response_time_ms": response_time_ms,
    }


# ─── FAVOURITE — TOGGLE ───────────────────────────────────────────────────────
class FavouriteRequest(BaseModel):
    message_id:   int
    is_favourite: bool

@app.patch("/api/chat/favourite")
def toggle_favourite(req: FavouriteRequest, user=Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE chat_messages cm
            JOIN chat_sessions cs ON cs.session_id = cm.session_id
            SET cm.is_favourite = %s
            WHERE cm.id = %s AND cs.user_id = %s
        """, (1 if req.is_favourite else 0, req.message_id, user["user_id"]))
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return {"message_id": req.message_id, "is_favourite": req.is_favourite}


# ─── FAVOURITES — GET ALL ─────────────────────────────────────────────────────
@app.get("/api/chat/favourites")
def get_all_favourites(user=Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT cm.id, cm.session_id, cm.content, cm.sources,
                   cm.created_at, cs.document_name, cs.title
            FROM chat_messages cm
            JOIN chat_sessions cs ON cs.session_id=cm.session_id
            WHERE cm.is_favourite=1 AND cm.role='assistant' AND cs.user_id=%s
            ORDER BY cm.created_at DESC
        """, (user["user_id"],))
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    favs = []
    for r in rows:
        sources = []
        if r["sources"]:
            try: sources = json.loads(r["sources"])
            except: pass
        favs.append({
            "id":           r["id"],
            "session_id":   r["session_id"],
            "content":      r["content"],
            "sources":      sources,
            "documentName": r["document_name"],
            "sessionTitle": r["title"],
            "createdAt":    r["created_at"].isoformat() if r["created_at"] else None,
        })
    return {"favourites": favs}


# ─── DELETE SESSION ───────────────────────────────────────────────────────────
@app.delete("/api/chat/sessions/{session_id}")
def delete_session(session_id: str, user=Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM chat_sessions WHERE session_id=%s AND user_id=%s",
            (session_id, user["user_id"])
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()
    return {"deleted": session_id}


# ─── QUESTIONS ────────────────────────────────────────────────────────────────
@app.get("/api/questions")
def get_questions(user=Depends(get_current_user)):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT question FROM qa_logs WHERE user_id=%s ORDER BY id DESC LIMIT 100",
            (user["user_id"],)
        )
        rows = cur.fetchall()
        cur.close()
        return {"questions": [r[0] for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ─── ANALYTICS: DOCUMENT USAGE ────────────────────────────────────────────────
@app.get("/api/analytics/document-usage")
def analytics_document_usage():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DATE(created_at) as date, document_name, COUNT(*) as count
            FROM user_activity_log
            WHERE action_type = 'chat' AND created_at >= CURDATE() - INTERVAL 6 DAY
            GROUP BY DATE(created_at), document_name
            ORDER BY date ASC, document_name ASC
        """)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    usage_by_date = {}
    for row in rows:
        date_str = row[0].strftime('%Y-%m-%d') if hasattr(row[0], 'strftime') else str(row[0])
        doc_name = row[1]
        count = row[2]
        if date_str not in usage_by_date:
            usage_by_date[date_str] = []
        usage_by_date[date_str].append({"name": doc_name, "count": count})

    today = datetime.now().date()
    result = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime('%Y-%m-%d')
        result.append({
            "date": day_str,
            "documents": usage_by_date.get(day_str, [])
        })

    return JSONResponse(result)


# ─── ADMIN LOGS ───────────────────────────────────────────────────────────────
@app.get("/api/admin/logs")
def get_admin_logs(user=Depends(require_role("admin"))):
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT al.id AS log_id, al.user_id, u.username, u.role AS user_role,
                   al.action_type, al.document_name, al.session_id,
                   al.detail AS question_asked, al.response_time_ms,
                   al.created_at AS action_time
            FROM user_activity_log al
            LEFT JOIN users u ON u.id = al.user_id
            ORDER BY al.created_at DESC
            LIMIT 2000
        """)
        activity_rows = cur.fetchall()

        cur.execute("""
            SELECT cm.id AS msg_id, cm.session_id, cm.role, cm.content,
                   cm.sources, cm.is_favourite, cm.created_at,
                   cs.user_id, cs.document_name, cs.title AS session_title,
                   u.username
            FROM chat_messages cm
            JOIN chat_sessions cs ON cs.session_id = cm.session_id
            LEFT JOIN users u ON u.id = cs.user_id
            ORDER BY cm.created_at DESC
            LIMIT 2000
        """)
        chat_rows = cur.fetchall()

        cur.execute("""
            SELECT dr.id, dr.filename, dr.user_id, dr.uploaded_at, dr.status,
                   u.username, u.role AS user_role
            FROM document_registry dr
            LEFT JOIN users u ON u.id = dr.user_id
            ORDER BY dr.uploaded_at DESC
        """)
        doc_rows = cur.fetchall()

        cur.execute("""
            SELECT u.id, u.username, u.role, u.created_at,
                   (SELECT COUNT(*) FROM document_registry WHERE user_id=u.id) AS total_docs,
                   (SELECT COUNT(*) FROM chat_sessions WHERE user_id=u.id)     AS total_sessions,
                   (SELECT COUNT(*) FROM user_activity_log
                    WHERE user_id=u.id AND action_type='chat')                  AS total_chats,
                   (SELECT AVG(response_time_ms) FROM user_activity_log
                    WHERE user_id=u.id AND action_type='chat')                  AS avg_response_ms
            FROM users u
            ORDER BY u.created_at DESC
        """)
        user_rows = cur.fetchall()

        cur.close()
    finally:
        conn.close()

    sessions = {}
    for r in chat_rows:
        sid = r["session_id"]
        if sid not in sessions:
            sessions[sid] = {
                "sessionId":    sid,
                "sessionTitle": r["session_title"],
                "documentName": r["document_name"],
                "userId":       r["user_id"],
                "username":     r["username"],
                "messages":     [],
            }
        sources = []
        if r["sources"]:
            try: sources = json.loads(r["sources"])
            except: pass
        sessions[sid]["messages"].append({
            "msgId":       r["msg_id"],
            "role":        r["role"],
            "content":     r["content"],
            "sources":     sources,
            "isFavourite": bool(r["is_favourite"]),
            "createdAt":   r["created_at"].isoformat() if r["created_at"] else None,
        })

    return {
        "activityLogs": [{
            "logId":          r["log_id"],
            "userId":         r["user_id"],
            "username":       r["username"],
            "userRole":       r["user_role"],
            "actionType":     r["action_type"],
            "documentName":   r["document_name"],
            "sessionId":      r["session_id"],
            "questionAsked":  r["question_asked"],
            "responseTimeMs": r["response_time_ms"],
            "actionTime":     r["action_time"].isoformat() if r["action_time"] else None,
        } for r in activity_rows],
        "chatSessions": list(sessions.values()),
        "documents": [{
            "docId":      r["id"],
            "filename":   r["filename"],
            "userId":     r["user_id"],
            "username":   r["username"],
            "userRole":   r["user_role"],
            "status":     r["status"],
            "uploadedAt": r["uploaded_at"].isoformat() if r["uploaded_at"] else None,
        } for r in doc_rows],
        "users": [{
            "userId":        r["id"],
            "username":      r["username"],
            "role":          r["role"],
            "joinedAt":      r["created_at"].isoformat() if r["created_at"] else None,
            "totalDocs":     r["total_docs"],
            "totalSessions": r["total_sessions"],
            "totalChats":    r["total_chats"],
            "avgResponseMs": round(float(r["avg_response_ms"]), 1) if r["avg_response_ms"] else None,
        } for r in user_rows],
    }


# ─── DELETE DOCUMENT ──────────────────────────────────────────────────────────
@app.delete("/api/documents/{document_id}")
def delete_document(document_id: int, user=Depends(get_current_user)):
    user_id   = user["user_id"]
    user_role = user.get("role", "user")

    conn = get_connection()
    file_path = None
    owner_id  = None
    filename_to_log = None

    try:
        cur = conn.cursor(dictionary=True)

        if user_role == "admin":
            cur.execute(
                "SELECT file_path, filename, user_id FROM document_registry WHERE id=%s LIMIT 1",
                (document_id,)
            )
        else:
            cur.execute(
                "SELECT file_path, filename, user_id FROM document_registry WHERE id=%s AND user_id=%s LIMIT 1",
                (document_id, user_id)
            )

        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

        file_path       = row["file_path"]
        owner_id        = row["user_id"]
        filename_to_log = row["filename"]

        cur.execute("DELETE FROM document_registry WHERE id=%s", (document_id,))
        conn.commit()
        cur.close()
    finally:
        conn.close()

    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    from services.rag_service import get_qdrant
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    try:
        ext = filename_to_log.lower().rsplit(".", 1)[-1] if "." in filename_to_log else ""
        if ext == "zip":
            delete_filter = [
                FieldCondition(key="zip_source", match=MatchValue(value=filename_to_log)),
                FieldCondition(key="user_id", match=MatchValue(value=owner_id)),
            ]
        else:
            delete_filter = [
                FieldCondition(key="source",  match=MatchValue(value=filename_to_log)),
                FieldCondition(key="user_id", match=MatchValue(value=owner_id)),
            ]

        qdrant = get_qdrant()
        qdrant.delete(
            collection_name="documents",
            points_selector=Filter(must=delete_filter)
        )
        qdrant.close()
        print(f"[delete] Qdrant vectors removed for {filename_to_log} user={owner_id}")
    except Exception as e:
        print(f"[delete] Qdrant cleanup failed: {e}")

    log_activity(user_id, "delete", document_name=filename_to_log)

    return {"message": "Document deleted successfully", "document_id": document_id}


# ─── VIEW DOCUMENT ────────────────────────────────────────────────────────────
@app.get("/api/documents/view/{filename}")
def view_document(filename: str, user=Depends(get_current_user)):
    user_id   = user["user_id"]
    user_role = user.get("role", "user")

    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        if user_role == "admin":
            cur.execute(
                "SELECT * FROM document_registry WHERE filename=%s LIMIT 1",
                (filename,)
            )
        else:
            cur.execute(
                "SELECT * FROM document_registry WHERE filename=%s AND user_id=%s LIMIT 1",
                (filename, user_id)
            )
        row = cur.fetchone()
        cur.close()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = row["file_path"]

    return {
        "filename":   row["filename"],
        "status":     row["status"],
        "uploaded_at": row["uploaded_at"],
        "file_size":  os.path.getsize(file_path) if os.path.exists(file_path) else 0,
        "session_id": row["session_id"],
    }


# ─── DOWNLOAD DOCUMENT ────────────────────────────────────────────────────────
# ✅ FIX: Added LIMIT 1 to query + fetchall() to consume pending results
#         before cur.close() — prevents MySQL "Unread result found" crash
@app.get("/api/documents/download/{filename}")
def download_document(filename: str, user=Depends(get_current_user)):
    user_id   = user["user_id"]
    user_role = user.get("role", "user")

    file_path = None
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)

        if user_role == "admin":
            cur.execute(
                "SELECT file_path FROM document_registry WHERE filename=%s LIMIT 1",
                (filename,)
            )
        else:
            cur.execute(
                "SELECT file_path FROM document_registry WHERE filename=%s AND user_id=%s LIMIT 1",
                (filename, user_id)
            )

        row = cur.fetchone()

        # ✅ KEY FIX: consume any leftover rows before closing cursor
        # This prevents MySQL connector "Unread result found" InternalError
        try:
            cur.fetchall()
        except Exception:
            pass

        cur.close()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = row["file_path"]

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File missing on server")

    log_activity(user_id, "download", document_name=filename)

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )

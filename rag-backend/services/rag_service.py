from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, Filter, FieldCondition, MatchValue
import ollama
import re
from db import get_connection
from config import QDRANT_URL, OLLAMA_MODEL, OLLAMA_HOST
from model_singleton import get_model

# ================= INIT =================
model = get_model()
ollama_client = ollama.Client(host=OLLAMA_HOST)

CHUNK_VERSION = "v2"

def get_qdrant():
    return QdrantClient(url=QDRANT_URL)

# ================= INIT COLLECTION =================
def init_qdrant():
    client = get_qdrant()
    cols = client.get_collections().collections
    if not any(c.name == "documents" for c in cols):
        client.create_collection(
            collection_name="documents",
            vectors_config=VectorParams(size=384, distance=Distance.COSINE)
        )
        print("Qdrant collection created")
    client.close()

# ================= DELETE DOC =================
def delete_document(doc_name: str, user_id: int):
    client = get_qdrant()
    try:
        ext = doc_name.lower().rsplit(".", 1)[-1] if "." in doc_name else ""
        if ext == "zip":
            delete_filter = [
                FieldCondition(key="zip_source", match=MatchValue(value=doc_name)),
                FieldCondition(key="user_id", match=MatchValue(value=user_id)),
            ]
        else:
            delete_filter = [
                FieldCondition(key="source", match=MatchValue(value=doc_name)),
                FieldCondition(key="user_id", match=MatchValue(value=user_id)),
            ]

        client.delete(
            collection_name="documents",
            points_selector=Filter(must=delete_filter)
        )
    finally:
        client.close()


def _base_filter(doc_name: str, user_id: int, is_zip: bool):
    base_filter = [FieldCondition(key="user_id", match=MatchValue(value=user_id))]
    if is_zip:
        base_filter.append(FieldCondition(key="zip_source", match=MatchValue(value=doc_name)))
    else:
        base_filter.append(FieldCondition(key="source", match=MatchValue(value=doc_name)))
    return base_filter

# ================= INGEST CHECK =================
def is_ingested(doc_name: str, user_id: int) -> bool:
    client = get_qdrant()
    try:
        ext = doc_name.lower().rsplit(".", 1)[-1] if "." in doc_name else ""

        if ext == "zip":
            results, _ = client.scroll(
                collection_name="documents",
                scroll_filter=Filter(must=[
                    FieldCondition(key="zip_source", match=MatchValue(value=doc_name)),
                    FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                ]),
                limit=20,
                with_payload=True,
            )
        else:
            results, _ = client.scroll(
                collection_name="documents",
                scroll_filter=Filter(must=[
                    FieldCondition(key="source", match=MatchValue(value=doc_name)),
                    FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                ]),
                limit=20,
                with_payload=True,
            )

        v2_count = sum(1 for r in results if (r.payload or {}).get("chunk_version") == CHUNK_VERSION)
        print(f"[is_ingested] {doc_name} v2={v2_count}/{len(results)}")
        return v2_count >= 5

    except Exception as e:
        print(f"[is_ingested] error: {e}")
        return False
    finally:
        client.close()

# ================= KEYWORD SEARCH =================
def _keyword_chunks(client, doc_name, user_id, keywords, is_zip, limit=5):
    matched_all = []
    matched_any = []
    offset = None

    # Also add partial variants — "co-chairperson" should match "chairperson"
    expanded_keywords = list(keywords)
    for kw in keywords:
        if '-' in kw:
            expanded_keywords.extend(kw.split('-'))
    expanded_keywords = list(set(expanded_keywords))

    while True:
        base_filter = _base_filter(doc_name, user_id, is_zip)

        results, next_offset = client.scroll(
            collection_name="documents",
            scroll_filter=Filter(must=base_filter),
            limit=100,
            offset=offset,
            with_payload=True,
        )

        for r in results:
            raw = (r.payload or {}).get("text", "")
            # Clean control chars before matching
            text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', raw).lower()

            # Count exact keyword occurrences (frequency = relevance)
            exact_matches = sum(1 for kw in keywords if kw in text)
            # Frequency score: how many times each keyword appears
            freq_score = sum(text.count(kw) for kw in keywords)

            if exact_matches == len(keywords):
                matched_all.append((freq_score, r))
            elif exact_matches > 0:
                matched_any.append((freq_score, r))

        if next_offset is None:
            break

        offset = next_offset

    matched_all.sort(key=lambda x: x[0], reverse=True)
    matched_any.sort(key=lambda x: x[0], reverse=True)

    combined = [r for _, r in matched_all] + [r for _, r in matched_any]
    return combined[:limit]


# ================= CHAPTER/SECTION CONTEXT FETCH =================
def _fetch_chapter_context(client, doc_name, user_id, is_zip, chapter_num, num_chunks=8):
    """
    Find the chunk containing 'chapter <N>' heading that is actual content
    (not TOC/prelims), then return that chunk plus the next num_chunks chunks.
    Picks the candidate with the most words (real content vs short TOC entries).
    """
    patterns = [
        f"chapter {chapter_num}",
        f"chapter{chapter_num}",
        f"ch {chapter_num}",
        f"ch.{chapter_num}",
    ]

    all_chunks = []
    offset = None

    base_filter = _base_filter(doc_name, user_id, is_zip)

    while True:
        results, next_offset = client.scroll(
            collection_name="documents",
            scroll_filter=Filter(must=base_filter),
            limit=100,
            offset=offset,
            with_payload=True,
        )
        all_chunks.extend(results)
        if next_offset is None:
            break
        offset = next_offset

    if not all_chunks:
        return []

    # Sort by chunk_index if available, otherwise keep scroll order
    has_index = any((r.payload or {}).get("chunk_index") is not None for r in all_chunks)
    if has_index:
        all_chunks.sort(key=lambda r: (r.payload or {}).get("chunk_index", 0))

    # Find ALL positions where the chapter pattern appears
    candidate_positions = []
    for i, r in enumerate(all_chunks):
        text = (r.payload or {}).get("text", "")
        clean_text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
        page_num = (r.payload or {}).get("page_num")
        if any(p in clean_text.lower() for p in patterns):
            word_count = len(clean_text.split())
            candidate_positions.append((i, clean_text, page_num, word_count))

    print(f"[chapter_fetch] {len(candidate_positions)} candidates for chapter {chapter_num}")
    for pos, text, pg, wc in candidate_positions:
        print(f"  pos={pos} page={pg} words={wc} preview={text[:80]!r}")

    if not candidate_positions:
        return []

    # If page_num is available, use it — pick candidate with highest page number
    # among those that aren't the very first occurrence (TOC is always first)
    has_page = any(pg is not None for _, _, pg, _ in candidate_positions)

    if has_page:
        # Pick candidate with highest page_num (actual content page > TOC page)
        best = max(candidate_positions, key=lambda x: x[2] if x[2] is not None else 0)
    else:
        # No page_num — pick the LAST candidate (TOC appears before content in document order)
        best = candidate_positions[-1]

    heading_pos = best[0]
    print(f"[chapter_fetch] selected pos={heading_pos} page={best[2]} words={best[3]}")

    return all_chunks[heading_pos: heading_pos + num_chunks + 1]


# ================= SEARCH =================
def search(query: str, doc_name: str, user_id: int):
    client = get_qdrant()

    ext = doc_name.lower().rsplit(".", 1)[-1] if "." in doc_name else ""
    is_zip = (ext == "zip")

    # --- Detect chapter/section structural query ---
    chapter_match = re.search(r'\bchapter\s*(\d+|[ivxlcdm]+)\b', query.lower())

    if chapter_match:
        chapter_num = chapter_match.group(1)
        chapter_results = _fetch_chapter_context(client, doc_name, user_id, is_zip, chapter_num)
        print(f"[search] chapter_match='{chapter_num}' found={len(chapter_results)} chunks")
        if chapter_results:
            context = ""
            sources = []
            for r in chapter_results:
                payload = r.payload or {}
                text = payload.get("text", "")
                if text:
                    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
                    context += text + "\n\n"
                    sources.append({
                        "docName": payload.get("source", doc_name),
                        "confidenceScore": 0.9
                    })
            print(f"[search] chapter context preview: {context[:300]!r}")
            client.close()
            return context.strip(), sources, ""
        else:
            print(f"[search] chapter heading NOT FOUND in any chunk — falling through to keyword/vector")

    # --- Keyword extraction ---
    stop = {"what","is","are","the","a","an","of","in","on","at","to","for","with","about","tell","me","give","explain","does","do","how","which","who","where","when","why"}
    # Preserve hyphenated terms (co-chairperson, vice-president etc.) as single keywords
    raw_words = re.findall(r'[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*', query.lower())
    keywords = [w for w in raw_words if w not in stop and len(w) > 1]

    # --- Step 1: Keyword search ---
    keyword_results = []
    if keywords:
        keyword_results = _keyword_chunks(client, doc_name, user_id, keywords, is_zip, limit=5)
    print(f"[search] keywords={keywords} keyword_hits={len(keyword_results)}")

    # --- Step 2: Vector search ---
    queries = [query, f"explain {query}", f"describe {query}", f"summary of {query}", f"contents of {query}"]
    seen_ids = set(r.id for r in keyword_results)
    vector_results = []

    base_filter = _base_filter(doc_name, user_id, is_zip)

    for q in queries:
        query_vector = model.encode(q).tolist()
        results = client.query_points(
            collection_name="documents",
            query=query_vector,
            limit=5,
            query_filter=Filter(must=base_filter)
        ).points

        for r in results:
            if r.id not in seen_ids:
                seen_ids.add(r.id)
                vector_results.append(r)

    vector_results.sort(key=lambda r: r.score, reverse=True)
    print(f"[search] vector_hits={len(vector_results)} top_score={vector_results[0].score if vector_results else 'none'}")

    # Keyword matches first (most relevant), then top vector results — cap at 8 total
    combined = keyword_results + vector_results[:max(0, 8 - len(keyword_results))]
    print(f"[search] combined={len(combined)} chunks total")

    context = ""
    sources = []
    top_keyword_chunk = ""  # The single best keyword-matched chunk

    for i, r in enumerate(combined):
        payload = r.payload or {}
        text = payload.get("text", "")
        if text:
            text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
            if i == 0 and keyword_results:
                top_keyword_chunk = text  # Save best match separately
            context += text + "\n\n"
            sources.append({
                "docName": payload.get("source", doc_name),
                "confidenceScore": float(getattr(r, "score", 0.5))
            })

    client.close()
    return context.strip(), sources, top_keyword_chunk

# ================= DB LOG =================
def save_to_db(question, answer, user_id):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO qa_logs (question, answer, user_id) VALUES (%s, %s, %s)",
            (question, answer, user_id)
        )
        conn.commit()
        cur.close()
    finally:
        conn.close()

# ================= INTENT FILTER =================
def is_general_message(question):
    q = question.lower().strip()
    greetings = ["hello","hi","hey","thanks"]
    return q in greetings or len(q.split()) < 3

# ================= MAIN =================
def ask_question(question: str, doc_name: str, user_id: int):

    if is_general_message(question):
        return {
            "answer": "Please ask a question related to the document.",
            "sources": []
        }

    context, sources, top_keyword_chunk = search(question, doc_name, user_id)

    print(f"[ask_question] context_len={len(context)} sources={len(sources)}")
    print(f"[ask_question] context_preview={context[:400]!r}")

    if not context:
        return {
            "answer": f'The document "{doc_name}" does not contain information related to your question.',
            "sources": []
        }

    # Use focused context (top keyword chunk) when available — smaller = better LLM accuracy
    focused_context = top_keyword_chunk if top_keyword_chunk else context

    prompt = f"""You are a strict document-grounded Q&A assistant.

You must answer using ONLY facts that are explicitly stated in the context.
Do not use outside knowledge, common knowledge, assumptions, guesses, or inferred details.
Do not add examples, explanations, definitions, causes, effects, dates, names, or steps unless they are directly present in the context.
If the context is related to the topic but does not explicitly contain the requested answer, reply exactly:
The document does not contain information related to your question.

Context:
---
{focused_context}
---

Question: {question}

- If the exact answer is explicitly present in the context, extract it directly and keep the answer concise.
- If multiple explicit matches are present, list only those matches.
- If the answer would require knowledge outside the context or interpretation beyond the text, refuse with the exact sentence above.
- Do not mention that you are using context.

Answer:"""

    try:
        response = ollama_client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a strict document reader. Answer only from explicit text in the provided context. Never use outside knowledge or infer missing facts. If the answer is not explicitly stated, say exactly: The document does not contain information related to your question."
                },
                {"role": "user", "content": prompt}
            ],
            options={"temperature": 0, "seed": 42}
        )
        answer = response.message.content.strip()
        print(f"[ask_question] llm_answer={answer[:200]!r}")

        # If focused context didn't work, retry with full context
        if "does not contain" in answer.lower() and top_keyword_chunk and context != top_keyword_chunk:
            print(f"[ask_question] retrying with full context...")
            prompt2 = prompt.replace(focused_context, context)
            response2 = ollama_client.chat(
                model=OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": "You are a strict document reader. Answer only from explicit text in the provided context. Never use outside knowledge or infer missing facts. If the answer is not explicitly stated, say exactly: The document does not contain information related to your question."},
                    {"role": "user", "content": prompt2}
                ],
                options={"temperature": 0, "seed": 0}
            )
            answer2 = response2.message.content.strip()
            print(f"[ask_question] retry_answer={answer2[:200]!r}")
            if "does not contain" not in answer2.lower():
                answer = answer2

    except Exception as e:
        answer = f"Ollama error: {e}"

    if "does not contain information" in answer.lower():
        sources = []

    save_to_db(question, answer, user_id)

    return {
        "answer": answer,
        "sources": sources
    }

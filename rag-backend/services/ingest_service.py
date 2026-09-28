from pypdf import PdfReader
from docx import Document
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue
import openpyxl
import uuid, os, zipfile, shutil, tempfile, re
from config import QDRANT_URL
from model_singleton import get_model

model = get_model()

CHUNK_VERSION = "v2"
SUPPORTED_EXTENSIONS = {"pdf", "docx", "txt", "xlsx"}
REJECTED_ZIP_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tif", "tiff", "ico", "heic", "heif"}

# ================= QDRANT =================
def get_qdrant():
    return QdrantClient(url=QDRANT_URL)

def init_collection():
    client = get_qdrant()
    cols = client.get_collections().collections
    if not any(c.name == "documents" for c in cols):
        client.create_collection(
            collection_name="documents",
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )
        print("Qdrant collection created")
    client.close()

# ================= READERS =================
def read_pdf(file_path):
    reader = PdfReader(file_path)
    pages = []
    for i, page in enumerate(reader.pages):
        t = page.extract_text()
        if t:
            # Strip control characters and normalize whitespace
            t = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', t)
            t = re.sub(r'[ \t]+', ' ', t).strip()
            if t:
                pages.append((i + 1, t))
    return pages

def read_docx(file_path):
    doc = Document(file_path)
    lines = []
    for p in doc.paragraphs:
        if not p.text.strip():
            continue
        if p.style and "Heading" in p.style.name:
            lines.append(f"\n### {p.text.strip()}")
        else:
            lines.append(p.text.strip())
    return "\n".join(lines)

def read_txt(file_path):
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

def read_xlsx(file_path):
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    text = []
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        text.append(f"\n[Sheet: {sheet}]")
        for row in ws.iter_rows(values_only=True):
            vals = [str(c).strip() if c else "" for c in row]
            if any(vals):
                text.append(" | ".join(vals))
    wb.close()
    return "\n".join(text)

# ================= CHUNKING =================
def chunk_text(text, chunk_size=400, overlap=80):
    """Chunk plain text, returns list of (chunk_text, page_num=None)."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks, current = [], []
    cur_len = 0
    for sentence in sentences:
        words = sentence.split()
        if not words:
            continue
        if cur_len + len(words) > chunk_size and current:
            chunks.append((" ".join(current), None))
            overlap_words = current[-overlap:] if len(current) > overlap else current
            current = overlap_words + words
            cur_len = len(current)
        else:
            current.extend(words)
            cur_len += len(words)
    if current:
        chunks.append((" ".join(current), None))
    return chunks


def chunk_pages(pages, chunk_size=400, overlap=80):
    """
    Chunk a list of (page_num, text) tuples.
    Each chunk stays within a page where possible; page_num is stored in metadata.
    Returns list of (chunk_text, page_num).
    """
    chunks = []
    for page_num, text in pages:
        # Clean any remaining control chars
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
        sentences = re.split(r'(?<=[.!?])\s+', text)
        current = []
        cur_len = 0
        for sentence in sentences:
            words = sentence.split()
            if not words:
                continue
            if cur_len + len(words) > chunk_size and current:
                chunks.append((" ".join(current), page_num))
                overlap_words = current[-overlap:] if len(current) > overlap else current
                current = overlap_words + words
                cur_len = len(current)
            else:
                current.extend(words)
                cur_len += len(words)
        if current:
            chunks.append((" ".join(current), page_num))
    return chunks

# ================= INGEST =================
def ingest_document(file_path, filename, user_id, zip_source=None):
    init_collection()

    ext = filename.lower().rsplit(".", 1)[-1]

    # ===== ZIP SUPPORT =====
    if ext == "zip":
        _ingest_zip(file_path, filename, user_id)
        return

    client = get_qdrant()
    print(f"Ingesting {filename} for user {user_id}...")

    try:
        if ext == "pdf":
            pages = read_pdf(file_path)  # list of (page_num, text)
            chunk_tuples = chunk_pages(pages)
        else:
            if ext == "docx":
                text = read_docx(file_path)
            elif ext == "txt":
                text = read_txt(file_path)
            elif ext == "xlsx":
                text = read_xlsx(file_path)
            else:
                raise ValueError(f"Unsupported file type: {filename}")
            chunk_tuples = chunk_text(text)

        if not chunk_tuples:
            print(f"No text extracted from {filename}")
            return

        # ✅ DELETE OLD DATA (fix stale response bug)
        try:
            delete_filter = [
                FieldCondition(key="source", match=MatchValue(value=filename)),
                FieldCondition(key="user_id", match=MatchValue(value=user_id)),
            ]
            if zip_source:
                delete_filter.append(FieldCondition(key="zip_source", match=MatchValue(value=zip_source)))

            client.delete(
                collection_name="documents",
                points_selector=Filter(must=delete_filter)
            )
            print(f"[ingest] cleared old vectors")
        except Exception as e:
            print(f"[ingest] delete failed: {e}")

        chunks = [c for c, _ in chunk_tuples]
        page_nums = [p for _, p in chunk_tuples]
        embeddings = model.encode(chunks, batch_size=32, show_progress_bar=False)

        points = []
        for i, (chunk, emb, page_num) in enumerate(zip(chunks, embeddings, page_nums)):
            payload = {
                "text": chunk,
                "source": filename,
                "user_id": user_id,
                "chunk_index": i,
                "page_num": page_num,
                "chunk_version": CHUNK_VERSION,
            }
            if zip_source:
                payload["zip_source"] = zip_source

            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=emb.tolist(),
                    payload=payload
                )
            )

        client.upsert(collection_name="documents", points=points)

        print(f" {filename} ingested ({len(points)} chunks)")

    finally:
        client.close()

# ================= ZIP HANDLER =================
def _ingest_zip(zip_path, zip_filename, user_id):
    print(f"Extracting ZIP: {zip_filename}")
    tmp_dir = tempfile.mkdtemp()
    client = get_qdrant()

    try:
        try:
            client.delete(
                collection_name="documents",
                points_selector=Filter(must=[
                    FieldCondition(key="zip_source", match=MatchValue(value=zip_filename)),
                    FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                ])
            )
            print(f"[zip_ingest] cleared old vectors for {zip_filename}")
        except Exception as e:
            print(f"[zip_ingest] delete failed: {e}")

        with zipfile.ZipFile(zip_path, "r") as zf:
            rejected_files = [
                info.filename for info in zf.infolist()
                if not info.is_dir()
                and "." in info.filename
                and info.filename.lower().rsplit(".", 1)[-1] in REJECTED_ZIP_EXTENSIONS
            ]
            if rejected_files:
                sample = ", ".join(rejected_files[:3])
                more = "" if len(rejected_files) <= 3 else f" and {len(rejected_files) - 3} more"
                raise ValueError(f"ZIP files containing images are not supported. Remove image file(s): {sample}{more}")

            zf.extractall(tmp_dir)

        for root, _, files in os.walk(tmp_dir):
            for fname in files:
                fpath = os.path.join(root, fname)
                inner_name = os.path.relpath(fpath, tmp_dir).replace(os.sep, "/")
                ext = fname.lower().rsplit(".", 1)[-1] if "." in fname else ""

                if ext in SUPPORTED_EXTENSIONS or ext == "zip":
                    try:
                        ingest_document(fpath, inner_name, user_id, zip_source=zip_filename)
                    except Exception as e:
                        print(f"Skipping {inner_name}: {e}")
                else:
                    print(f"Unsupported: {inner_name}")

    finally:
        client.close()
        shutil.rmtree(tmp_dir, ignore_errors=True)

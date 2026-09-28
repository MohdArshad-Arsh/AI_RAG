from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from docx import Document

import uuid
import os
import zipfile

# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Qdrant client
client = QdrantClient(path="qdrant_data")

# Create collection if not exists
if not client.collection_exists("documents"):
    client.create_collection(
        collection_name="documents",
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )


# -----------------------------
# File Readers
# -----------------------------

def read_pdf(file_path):
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text
    return text


def read_docx(file_path):
    doc = Document(file_path)
    text = "\n".join([para.text for para in doc.paragraphs])
    return text


def read_txt(file_path):
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


# -----------------------------
# Text Chunking
# -----------------------------

def chunk_text(text, chunk_size=300):
    words = text.split()
    chunks = []

    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i+chunk_size])
        chunks.append(chunk)

    return chunks


# -----------------------------
# Process Text -> Embedding -> Qdrant
# -----------------------------

def store_chunks(chunks, source):

    for chunk in chunks:
        embedding = model.encode(chunk).tolist()

        client.upsert(
            collection_name="documents",
            points=[
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={
                        "text": chunk,
                        "source": source
                    }
                )
            ]
        )


# -----------------------------
# Process File
# -----------------------------

def process_file(file_path):

    filename = os.path.basename(file_path)
    ext = filename.lower().split(".")[-1]

    print(f"Ingesting {filename}...")

    text = ""

    if ext == "pdf":
        text = read_pdf(file_path)

    elif ext == "docx":
        text = read_docx(file_path)

    elif ext == "txt":
        text = read_txt(file_path)

    else:
        print(f"⚠️ Unsupported file type: {filename}")
        return

    if not text.strip():
        print(f"⚠️ No text found in {filename}")
        return

    chunks = chunk_text(text)
    store_chunks(chunks, filename)


# -----------------------------
# Process ZIP
# -----------------------------

def process_zip(zip_path, extract_folder="temp_zip"):

    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_folder)

    for root, dirs, files in os.walk(extract_folder):
        for file in files:
            process_file(os.path.join(root, file))


# -----------------------------
# Ingest Folder
# -----------------------------

def ingest_folder(folder_path):

    for filename in os.listdir(folder_path):

        file_path = os.path.join(folder_path, filename)

        if filename.endswith(".zip"):
            process_zip(file_path)

        else:
            process_file(file_path)

    print("✅ All documents ingested successfully!")


# -----------------------------
# Run
# -----------------------------

if __name__ == "__main__":
    ingest_folder("documents")
import streamlit as st
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from pypdf import PdfReader
import requests
import uuid
from config import OLLAMA_HOST, OLLAMA_MODEL


st.set_page_config(page_title="AI Assistant", layout="wide")
st.title("🤖 AI PDF Assistant")

# Load model only once
@st.cache_resource
def load_model():
    return SentenceTransformer("all-MiniLM-L6-v2")

model = load_model()

# Use in-memory Qdrant (NO LOCK ISSUE)
@st.cache_resource
def get_client():
    return QdrantClient(":memory:")

client = get_client()

COLLECTION_NAME = "uploaded_pdf"


# ---------- PDF PROCESSING ----------
def process_pdf(uploaded_file):

    # Delete old collection if exists
    if COLLECTION_NAME in [c.name for c in client.get_collections().collections]:
        client.delete_collection(COLLECTION_NAME)

    # Create new collection
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )

    reader = PdfReader(uploaded_file)
    text = ""

    for page in reader.pages:
        text += page.extract_text() + "\n"

    # Chunk text
    chunks = [text[i:i+500] for i in range(0, len(text), 500)]

    points = []

    for chunk in chunks:
        embedding = model.encode(chunk).tolist()

        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload={"text": chunk}
            )
        )

    client.upsert(collection_name=COLLECTION_NAME, points=points)


# ---------- SEARCH ----------
def search_documents(question):
    question_embedding = model.encode(question).tolist()

    results = client.query_points(
        collection_name="documents",
        query=question_embedding,
        limit=5
    ).points

    context = ""
    for r in results:
        context += r.payload["text"] + "\n"

    return context


# ---------- GENERATE ----------
def generate_answer(prompt):
    response = requests.post(
        f"{OLLAMA_HOST}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        }
    )

    return response.json()["response"]


# ---------- UI ----------
uploaded_file = st.file_uploader("Upload a PDF", type="pdf")

if uploaded_file:
    st.success("PDF uploaded successfully!")

    if st.button("Process PDF"):
        process_pdf(uploaded_file)
        st.success("PDF processed and stored!")

question = st.text_input("Ask a question from this PDF")

if st.button("Ask"):

    if question:
        context = search_documents(question)

        prompt = f"""
Answer using ONLY the context below.

Context:
{context}

Question:
{question}

Answer:
"""

        answer = generate_answer(prompt)

        st.subheader("Answer")
        st.write(answer)
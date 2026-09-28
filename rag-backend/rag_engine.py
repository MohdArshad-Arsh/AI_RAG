from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
import requests
from config import OLLAMA_HOST, OLLAMA_MODEL

# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Connect to Qdrant Server (Docker mode)
client = QdrantClient(path="qdrant_data")


def search_documents(question, limit=3):
    """
    Convert question to embedding and search in Qdrant
    """

    question_embedding = model.encode(question).tolist()

    # Use correct API (new Qdrant versions)
    results = client.query_points(
        collection_name="documents",
        query=question_embedding,
        limit=limit
    ).points

    context = ""

    for result in results:
        if "text" in result.payload:
            context += result.payload["text"] + "\n"

    return context.strip()


def generate_answer(prompt):
    """
    Send prompt to Ollama
    """

    response = requests.post(
        f"{OLLAMA_HOST}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        },
        timeout=120
    )

    if response.status_code == 200:
        return response.json().get("response", "No response generated.")
    else:
        return f"Error from Ollama: {response.text}"


def ask_question(question):
    """
    Full RAG pipeline:
    1. Retrieve context
    2. Build prompt
    3. Generate answer
    """

    context = search_documents(question)

    if not context:
        return "No relevant documents found in database."

    prompt = f"""
You are a helpful AI document assistant.

Answer ONLY from the given context.
If the answer is not in the context, say:
"I could not find the answer in the provided documents."

Context:
{context}

Question:
{question}

Answer clearly and professionally.
"""

    answer = generate_answer(prompt)
    return answer


if __name__ == "__main__":
    print("RAG System Ready 🚀\n")

    while True:
        user_question = input("Ask Question (or type 'exit'): ")

        if user_question.lower() == "exit":
            break

        answer = ask_question(user_question)

        print("\nAnswer:\n")
        print(answer)
        print("\n" + "=" * 60 + "\n")
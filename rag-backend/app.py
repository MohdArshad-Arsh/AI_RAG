from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
import requests
import mysql.connector
from config import OLLAMA_URL, OLLAMA_MODEL, MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE

# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

db = mysql.connector.connect(
    host=MYSQL_HOST,
    user=MYSQL_USER,
    password=MYSQL_PASSWORD,
    database=MYSQL_DATABASE,
)

cursor = db.cursor()

def search(query):

    # Create Qdrant client
    client = QdrantClient(path="qdrant_data")

    # Create embedding
    query_vector = model.encode(query).tolist()

    # Search in vector DB
    results = client.query_points(
        collection_name="documents",
        query=query_vector,
        limit=3
    ).points

    # Build context
    context = ""
    for result in results:
        context += result.payload["text"] + "\n"

    # Close client
    client.close()

    return context

def save_to_db(question, answer):

    sql = "INSERT INTO qa_logs (question, answer) VALUES (%s, %s)"
    val = (question, answer)

    cursor.execute(sql, val)
    db.commit()

def ask_question(question):


    context = search(question)

    prompt = f"""
Answer using ONLY the context below.

Context:
{context}

Question:
{question}

Answer:
"""

    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        },
        timeout=120
    )
    answer = response.json().get("response", "No response generated.")

    save_to_db(question, answer)

    print("\nAnswer:\n")
    print(response['message']['content'])
    print("\n" + "-" * 50)


if __name__ == "__main__":

    while True:
        question = input("Ask: ")

        if question.lower() in ["exit", "quit"]:
            break

        ask_question(question)
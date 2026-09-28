from sentence_transformers import SentenceTransformer
 
print("Loading embedding model (once)...")
_model = SentenceTransformer("all-MiniLM-L6-v2")
print("Embedding model loaded.")
 
 
def get_model() -> SentenceTransformer:
    return _model
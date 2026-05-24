from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from typing import List

app = FastAPI()

modelo = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

class TextoInput(BaseModel):
    texto: str

class VectorOutput(BaseModel):
    vector: List[float]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/embed", response_model=VectorOutput)
def generar_embedding(input: TextoInput):
    vector = modelo.encode(input.texto).tolist()
    return {"vector": vector}

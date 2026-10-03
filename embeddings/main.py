from fastapi import FastAPI
from pydantic import BaseModel
from fastembed import TextEmbedding
from typing import List

app = FastAPI()

modelo = TextEmbedding('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')

class TextoInput(BaseModel):
    texto: str

class VectorOutput(BaseModel):
    vector: List[float]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/embed", response_model=VectorOutput)
def generar_embedding(input: TextoInput):
    vectors = list(modelo.embed([input.texto]))
    return {"vector": vectors[0].tolist()}

ARG SOURCE_DATE_EPOCH=0

FROM python:3.11.17-slim-trixie@sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce

ARG SOURCE_DATE_EPOCH
ARG EMBEDDING_MODEL_REVISION=faf4aa4225822f3bc6376869cb1164e8e3feedd0

WORKDIR /app

ENV FASTEMBED_CACHE_PATH=/app/model-cache \
    HF_HUB_OFFLINE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONHASHSEED=0

COPY requirements.lock .
RUN pip install --no-cache-dir --no-compile --require-hashes -r requirements.lock

RUN HF_HUB_OFFLINE=0 python -c "import shutil; from pathlib import Path; from fastembed import TextEmbedding; from huggingface_hub import snapshot_download; repo='qdrant/paraphrase-multilingual-MiniLM-L12-v2-onnx-Q'; revision='${EMBEDDING_MODEL_REVISION}'; cache=Path('/app/model-cache'); snapshot_download(repo_id=repo, revision=revision, cache_dir=cache); ref=cache/'models--qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q'/'refs'/'main'; ref.parent.mkdir(parents=True, exist_ok=True); ref.write_text(revision); list(TextEmbedding('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', local_files_only=True).embed(['warmup'])); shutil.rmtree('/root/.cache', ignore_errors=True); Path('/tmp/.ses').unlink(missing_ok=True)"

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

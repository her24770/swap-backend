FROM python:3.11-alpine

RUN apk add --no-cache curl

WORKDIR /app
COPY server.py .

EXPOSE 8000

CMD ["python", "server.py"]

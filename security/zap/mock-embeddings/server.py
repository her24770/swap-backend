import json
from http.server import BaseHTTPRequestHandler, HTTPServer

VECTOR_384 = [0.0] * 384

class MockEmbeddingsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/embed":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"vector": VECTOR_384}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Silenciar logs para mantener limpia la salida
        pass

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8000), MockEmbeddingsHandler)
    server.serve_forever()

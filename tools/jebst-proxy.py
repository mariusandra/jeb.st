#!/usr/bin/env python3
"""A tiny relay that puts CORS headers in front of any /v1/systemone server so the jeb.st page can drive it.

Needed for every local car: model servers do not answer cross-origin preflights, and an https page such as jeb.st may only
reach 127.0.0.1 when the preflight also carries Access-Control-Allow-Private-Network (Chrome may ask you once to allow it).

    python3 tools/jebst-proxy.py --target http://127.0.0.1:8001 --port 8765
    python3 tools/jebst-proxy.py --target https://api.typesafe.ai --api-key "$TYPESAFE_API_KEY" --port 8766

Then add a car in the garage with URL http://127.0.0.1:8765. Standard library only. With --api-key the key is attached
here and never has to be typed into the browser. --allow-origin restricts which pages may use the relay (default: any).
"""
import argparse, http.client, json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", required=True, help="the model server, e.g. http://127.0.0.1:8001")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--api-key", default=None, help="Bearer key to attach to every forwarded request")
    ap.add_argument("--allow-origin", default="*")
    a = ap.parse_args()
    t = urlparse(a.target)
    secure = t.scheme == "https"
    origin = a.allow_origin

    class Relay(BaseHTTPRequestHandler):
        def cors(self):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "content-type, authorization")
            self.send_header("Access-Control-Allow-Private-Network", "true")   # an https page (jeb.st) reaching 127.0.0.1: Chrome's Private Network Access check
            self.send_header("Access-Control-Max-Age", "86400")

        def do_OPTIONS(self):
            self.send_response(204); self.cors(); self.end_headers()

        def forward(self, method):
            length = int(self.headers.get("content-length") or 0)
            body = self.rfile.read(length) if length else None
            headers = {"content-type": self.headers.get("content-type", "application/json"), "accept": "application/json"}
            if a.api_key:
                headers["authorization"] = f"Bearer {a.api_key}"
            elif self.headers.get("authorization"):
                headers["authorization"] = self.headers["authorization"]
            conn = (http.client.HTTPSConnection if secure else http.client.HTTPConnection)(t.hostname, t.port or (443 if secure else 80), timeout=600)
            try:
                conn.request(method, self.path, body=body, headers=headers)
                resp = conn.getresponse(); data = resp.read()
                self.send_response(resp.status); self.cors()
                self.send_header("content-type", resp.getheader("content-type", "application/json")); self.send_header("content-length", str(len(data)))
                self.end_headers(); self.wfile.write(data)
            except OSError as e:
                payload = json.dumps({"detail": f"relay could not reach {a.target}: {e}"}).encode()
                self.send_response(502); self.cors(); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(payload))); self.end_headers(); self.wfile.write(payload)
            finally:
                conn.close()

        def do_GET(self): self.forward("GET")
        def do_POST(self): self.forward("POST")
        def log_message(self, fmt, *args): sys.stderr.write("[relay] " + fmt % args + "\n")

    print(f"[relay] http://{a.host}:{a.port} -> {a.target}{' (with API key)' if a.api_key else ''}; allow-origin {origin}", flush=True)
    ThreadingHTTPServer((a.host, a.port), Relay).serve_forever()


if __name__ == "__main__":
    main()

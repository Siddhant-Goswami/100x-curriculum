#!/usr/bin/env python3
"""Local server that mimics Vercel's cleanUrls for this repo.

  python3 _plan/serve.py            # http://localhost:8080
  python3 _plan/serve.py 9000

/            -> c8-module2-map.html
/x           -> x.html, or x/index.html
/x/          -> x/index.html
Lives in _plan, which Vercel does not serve.
"""
import os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def translate_path(self, path):
        p = path.split('?', 1)[0].split('#', 1)[0]
        if p == '/':
            return os.path.join(ROOT, 'c8-module2-map.html')
        full = os.path.join(ROOT, p.lstrip('/'))
        if os.path.isdir(full):
            return os.path.join(full, 'index.html')
        if not os.path.exists(full) and os.path.exists(full + '.html'):
            return full + '.html'
        return full
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path))

if __name__ == '__main__':
    print(f"serving {ROOT} at http://localhost:{PORT}")
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()

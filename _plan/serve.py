#!/usr/bin/env python3
"""Local server that mimics Vercel's cleanUrls for this repo.

  python3 _plan/serve.py            # http://localhost:8080
  python3 _plan/serve.py 9000

/            -> c8-module2-map.html
/x           -> x.html, or x/index.html
/x/          -> x/index.html
POST /api/x  -> runs api/x.mjs's handle() in node, so serverless routes work locally too
Lives in _plan, which Vercel does not serve.
"""
import os, sys, subprocess, json
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
    def do_POST(self):
        name = self.path.split('?', 1)[0].strip('/').split('/')
        mod = os.path.join(ROOT, 'api', (name[1] if len(name) > 1 else '') + '.mjs')
        if name[0] != 'api' or not os.path.exists(mod):
            self.send_error(404); return
        body = self.rfile.read(int(self.headers.get('Content-Length') or 0)).decode('utf-8')
        js = ("import(process.argv[1]).then(async m=>{const r=await m.handle(new Request('http://localhost'+process.argv[2],"
              "{method:'POST',headers:{'content-type':'application/json'},body:process.argv[3]}));"
              "process.stdout.write(JSON.stringify({s:r.status,b:await r.text()}))})")
        out = subprocess.run(['node', '-e', js, mod, self.path, body], capture_output=True, text=True, cwd=ROOT)
        try:
            r = json.loads(out.stdout.strip().splitlines()[-1])
        except Exception:
            self.send_error(500, out.stderr[-200:]); return
        data = r['b'].encode('utf-8')
        self.send_response(r['s']); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data)))
        self.end_headers(); self.wfile.write(data)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path))

if __name__ == '__main__':
    print(f"serving {ROOT} at http://localhost:{PORT}")
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()

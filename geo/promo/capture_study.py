"""Review-app capture-v2 session. Local loopback control; never stores credentials.

Run with task job run, then POST bounded Python commands to /exec on port 18329.
Browser operations run on the Playwright owner thread. Use actual UI for study writes.
"""
from __future__ import annotations
import io
import json
import time
import traceback
import contextlib
import shutil
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright
from capture import Take, DRAW, rect_of, CSS_W, CSS_H, SCALE, FPS, PX_W, PX_H

WORK = Path.home() / 'data/geoaidesk/work/gaid-promo-video-v2'
OUT = WORK / 'capture-v2'

class StudyTake(Take):
    """Reuse v1 pointer/click interpolation, without v1's disconnected-state mask."""
    def frame(self):
        if not (0 <= self.pt['x'] <= CSS_W and 0 <= self.pt['y'] <= CSS_H):
            raise ValueError('Pointer target is outside the viewport; stage the screen before recording.')
        a = (self.k - self.last_click) / 14 if self.k - self.last_click < 14 else None
        self.page.evaluate(DRAW, [self.pt, a])
        self.page.screenshot(path=str(self.dir / f'frame-{self.k:05d}.png'), animations='disabled')
        self.k += 1

    def hold(self, n):
        """Keep a captured static state; render changing click-ripple frames individually."""
        dynamic = min(n, max(0, 14 - (self.k - self.last_click)))
        for _ in range(dynamic):
            self.frame()
        if n > dynamic:
            self.frame()
            source = self.dir / f'frame-{self.k-1:05d}.png'
            for _ in range(n - dynamic - 1):
                shutil.copyfile(source, self.dir / f'frame-{self.k:05d}.png')
                self.k += 1

    def finish(self, beats):
        rec = self.record(self.page.url)
        for beat in beats:
            r = beat['rect']
            r['width'] = min(r['width'], CSS_W - r['x'])
            r['height'] = min(r['height'], CSS_H - r['y'])
        rec['beats'] = beats
        rec['cuts'] = [{'frame': round(c['t'] * FPS), 'removedSeconds': c['omitted_wall_s'], 'why': c['after']} for c in self.cuts]
        dest = OUT / 'capture.json'
        doc = json.loads(dest.read_text()) if dest.exists() else {
            'schema':'gaid-promo-capture-v2','fps':FPS,'width':PX_W,'height':PX_H,
            'css':{'width':CSS_W,'height':CSS_H,'scale':SCALE},
            'app':{'url':'http://127.0.0.1:3000','commit':'ad9399d1'},'shots':[],'stills':[]}
        doc['shots'] = [s for s in doc['shots'] if s['id'] != self.sid] + [rec]
        dest.write_text(json.dumps(doc, ensure_ascii=False, indent=2)+'\n')
        return rec


def evidence(name):
    roots = [Path.home()/'.geoaidesk/projects', Path.home()/'.geoaidesk/pi-agent/research/library', Path.home()/'.geoaidesk/pi-agent/skill-hub/shared']
    rows=[]
    for root in roots:
        patterns = ['*/project.json'] if root.name == 'projects' else ['**/*.json', '**/*.jsonl']
        for pattern in patterns:
            for p in sorted(root.glob(pattern)):
                if any(x in p.parts for x in ('secrets','secure')) or p.name in ('auth.json','config.env','mcp-auth.json','connection.json'):
                    continue
                s=p.stat()
                rows.append({'path':str(p),'size':s.st_size,'mtime_ns':s.st_mtime_ns})
    (WORK/f'evidence-{name}.json').write_text(json.dumps(rows,indent=2)+'\n')
    return len(rows)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'stills').mkdir(exist_ok=True)
    if not (WORK / 'evidence-before.json').exists():
        evidence('before')
    errors=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx=browser.new_context(viewport={'width':CSS_W,'height':CSS_H},device_scale_factor=SCALE,locale='ko-KR',timezone_id='Asia/Seoul',color_scheme='light')
        ctx.add_init_script("localStorage.setItem('gaid:locale','ko');localStorage.setItem('theme','light');localStorage.setItem('gaid:style','instrument');")
        page=ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded')
        env=globals() | {'page':page,'ctx':ctx,'browser':browser,'errors':errors,'time':time}
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                code=self.rfile.read(int(self.headers['Content-Length'])).decode()
                buf=io.StringIO()
                try:
                    with contextlib.redirect_stdout(buf): exec(code,env)
                    data={'ok':True,'output':buf.getvalue()}
                except Exception:
                    data={'ok':False,'output':buf.getvalue(),'error':traceback.format_exc()}
                self.send_response(200);self.end_headers();self.wfile.write(json.dumps(data,ensure_ascii=False).encode())
            def log_message(self,*args): pass
        print('capture-v2 session ready on 127.0.0.1:18329',flush=True)
        HTTPServer(('127.0.0.1',18329),Handler).serve_forever()

if __name__=='__main__': main()

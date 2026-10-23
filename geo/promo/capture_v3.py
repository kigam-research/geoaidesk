"""Persistent v3 capture controller. Execute bounded snippets on Playwright's owner thread.

Run once with task job run. No credential values are printed, copied or persisted.
The normal launcher link is consumed only if the review app shows its token gate.
"""
from __future__ import annotations

import contextlib
import hashlib
import io
import json
import re
import time
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright
import capture_study as base
from capture import CSS_W, CSS_H, SCALE, FPS, PX_W, PX_H, rect_of, DRAW

WORK = Path.home() / 'data/geoaidesk/work/gaid-promo-video-v3'
OUT = WORK / 'capture-v3'
base.WORK, base.OUT = WORK, OUT
StudyTake = base.StudyTake


def evidence(name):
    roots = [Path.home()/'.geoaidesk/projects',
             Path.home()/'.geoaidesk/pi-agent/research/library',
             Path.home()/'.geoaidesk/pi-agent/skill-hub/shared']
    rows = []
    for root in roots:
        patterns = ['*/project.json'] if root.name == 'projects' else ['**/*.json', '**/*.jsonl']
        for pattern in patterns:
            for path in sorted(root.glob(pattern)):
                if any(p in path.parts for p in ('secrets', 'secure')) or path.name in (
                    'auth.json', 'config.env', 'mcp-auth.json', 'connection.json'):
                    continue
                stat = path.stat()
                rows.append({'path':str(path), 'size':stat.st_size, 'mtime_ns':stat.st_mtime_ns,
                             'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    (WORK/f'evidence-{name}.json').write_text(json.dumps(rows, indent=2)+'\n')
    return len(rows)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/'stills').mkdir(exist_ok=True)
    if not (WORK/'evidence-before.json').exists():
        evidence('before')
    manifest = OUT/'capture.json'
    if not manifest.exists():
        manifest.write_text(json.dumps({'schema':'gaid-promo-capture-v2','fps':FPS,
            'width':PX_W,'height':PX_H,'css':{'width':CSS_W,'height':CSS_H,'scale':SCALE},
            'app':{'url':'http://127.0.0.1:3000','commit':'7650e012'},
            'shots':[],'stills':[]}, indent=2)+'\n')
    errors, console_errors = [], []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/google-chrome',
            args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx = browser.new_context(viewport={'width':CSS_W,'height':CSS_H},
            device_scale_factor=SCALE,locale='ko-KR',timezone_id='Asia/Seoul',color_scheme='light')
        ctx.add_init_script("localStorage.setItem('gaid:locale','ko');localStorage.setItem('theme','light');localStorage.setItem('gaid:style','instrument');")
        page = ctx.new_page()
        page.set_default_timeout(7000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:console_errors.append(m.text) if m.type=='error' else None)
        page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded')
        page.wait_for_timeout(700)
        if page.get_by_text('접근 토큰 필요',exact=True).count():
            startup = (Path.home()/'data/geoaidesk/work/review-app/launcher.log').read_text()
            link = re.findall(r'https?://[^\s]+[#?]kady-token=[^\s]+',startup)[-1]
            page.get_by_role('textbox').fill(link)
            page.get_by_role('button',name='계속',exact=True).click()
            del startup, link
            page.wait_for_timeout(500)
        env = globals() | {'page':page,'ctx':ctx,'browser':browser,'errors':errors,
                          'console_errors':console_errors,'time':time}
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                code = self.rfile.read(int(self.headers['Content-Length'])).decode()
                buf = io.StringIO()
                try:
                    with contextlib.redirect_stdout(buf):
                        exec(code,env)
                    data = {'ok':True,'output':buf.getvalue()}
                except Exception:
                    data = {'ok':False,'output':buf.getvalue(),'error':traceback.format_exc()}
                (WORK/'browser-errors.json').write_text(json.dumps({'pageErrors':errors,
                    'consoleErrors':console_errors},ensure_ascii=False,indent=2)+'\n')
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(data,ensure_ascii=False).encode())
            def log_message(self,*args):
                pass
        print('capture-v3 ready: 127.0.0.1:18339',flush=True)
        HTTPServer(('127.0.0.1',18339),Handler).serve_forever()


if __name__ == '__main__':
    main()

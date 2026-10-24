"""Read-only Yilgarn capture controller. Run with task job run; loopback :18359.

All PUT/DELETE and non-allowlisted POST requests are fulfilled locally. No text masks.
The launcher token is consumed only at the app gate, never logged or persisted here.
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
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from capture import CSS_W, CSS_H, SCALE, FPS, PX_W, PX_H, rect_of, DRAW
from capture_study import StudyTake

WORK = Path.home() / 'data/geoaidesk/work/gaid-promo-video-v5'
OUT = WORK / 'capture-v5'
READ_POST = re.compile(r'^/geo/(?:inspect|result|vector-page|raster-window|raster-style|raster-point|series-window)$')
SKIP = {'auth.json','config.env','mcp-auth.json','connection.json'}


def evidence(name):
    roots = [Path.home()/'.geoaidesk/projects/yilgarn-cd7814',
             Path.home()/'.geoaidesk/pi-agent/research/library',
             Path.home()/'.geoaidesk/pi-agent/skill-hub']
    rows = []
    for root in roots:
        for path in sorted(root.rglob('*')):
            if not path.is_file() or path.is_symlink():
                continue
            if any(p in ('.venv','secrets','secure') for p in path.parts) or path.name in SKIP or path.name.startswith('.env') or path.suffix in ('.pem','.key'):
                continue
            stat = path.stat()
            rows.append({'path':str(path),'size':stat.st_size,'mtime_ns':stat.st_mtime_ns,
                         'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    (WORK/f'evidence-{name}.json').write_text(json.dumps(rows,indent=2)+'\n')
    return len(rows)


class WholeTake(StudyTake):
    def beat(self, loc, region, selector, label, frames=48):
        """Measure one full, unclipped DOM element and hold it for a full beat."""
        rect = loc.evaluate('''el => {
          const r=el.getBoundingClientRect();
          if(r.x<0||r.y<0||r.right>innerWidth+.01||r.bottom>innerHeight+.01) throw Error('outside viewport');
          for(let p=el.parentElement;p;p=p.parentElement){
            const s=getComputedStyle(p),b=p.getBoundingClientRect();
            if(/auto|scroll|hidden|clip/.test(s.overflowX) && (r.x<b.x-.5||r.right>b.right+.5)) throw Error('x clipped');
            if(/auto|scroll|hidden|clip/.test(s.overflowY) && (r.y<b.y-.5||r.bottom>b.bottom+.5)) throw Error('y clipped');
          }
          return {x:r.x,y:r.y,width:r.width,height:r.height};
        }''')
        if not hasattr(self,'beats'): self.beats=[]
        self.beats.append({'t0':self.t,'t1':round((self.k+frames)/FPS,3),'rect':rect,
                           'label':label,'region':region,'selector':selector})
        self.hold(frames)
        return rect

    def finish(self):
        rec = self.record(self.page.url)
        rec['beats'] = self.beats
        rec['cuts'] = [{'frame':round(c['t']*FPS),'removedSeconds':c['omitted_wall_s'],'why':c['after']} for c in self.cuts]
        doc=json.loads((OUT/'capture.json').read_text())
        doc['shots']=sorted([s for s in doc['shots'] if s['id']!=self.sid]+[rec],key=lambda s:s['id'])
        (OUT/'capture.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
        return {'id':self.sid,'frames':self.k,'beats':len(self.beats)}

    def cut(self, why, operation):
        t=time.monotonic();operation();self.page.wait_for_timeout(700)
        self.cuts.append({'t':self.t,'after':why,'omitted_wall_s':round(time.monotonic()-t,2)})


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'stills').mkdir(exist_ok=True)
    if not (WORK/'evidence-before.json').exists(): evidence('before')
    manifest=OUT/'capture.json'
    if not manifest.exists():
        manifest.write_text(json.dumps({'schema':'gaid-promo-capture-v2','fps':FPS,'width':PX_W,'height':PX_H,
            'css':{'width':CSS_W,'height':CSS_H,'scale':SCALE},
            'app':{'url':'http://127.0.0.1:3000','commit':'7650e012'},'shots':[],'stills':[]},indent=2)+'\n')
    previous=json.loads(manifest.read_text())
    errors=previous.get('browser_errors',[])
    console_errors=previous.get('console_errors',[])
    blocked=previous.get('requests',{}).get('blocked',[])
    allowed=previous.get('requests',{}).get('allowed',[])
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx=browser.new_context(viewport={'width':CSS_W,'height':CSS_H},device_scale_factor=SCALE,locale='ko-KR',timezone_id='Asia/Seoul',color_scheme='light')
        ctx.add_init_script("localStorage.setItem('gaid:locale','ko');localStorage.setItem('theme','light');localStorage.setItem('gaid:style','instrument');")
        def guard(route):
            req=route.request; path=urlsplit(req.url).path
            if req.method in ('PUT','DELETE','PATCH') or (req.method=='POST' and not READ_POST.fullmatch(path)):
                blocked.append({'method':req.method,'path':path})
                return route.fulfill(status=200,content_type='application/json',body='{}')
            if req.method=='POST': allowed.append({'method':req.method,'path':path})
            route.continue_()
        ctx.route('**/*',guard)
        page=ctx.new_page();page.set_default_timeout(7000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:console_errors.append(m.text) if m.type=='error' else None)
        page.goto('http://127.0.0.1:3000',wait_until='domcontentloaded');page.wait_for_timeout(700)
        if page.get_by_text('접근 토큰 필요',exact=True).count():
            startup=(Path.home()/'data/geoaidesk/work/review-app/launcher.log').read_text()
            link=re.findall(r'https?://[^\s]+[#?]kady-token=[^\s]+',startup)[-1]
            page.get_by_role('textbox').fill(link);page.get_by_role('button',name='계속',exact=True).click()
            del startup,link
        env=globals()|locals()
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                code=self.rfile.read(int(self.headers['Content-Length'])).decode();buf=io.StringIO()
                try:
                    with contextlib.redirect_stdout(buf): exec(code,env)
                    data={'ok':True,'output':buf.getvalue()}
                except Exception: data={'ok':False,'output':buf.getvalue(),'error':traceback.format_exc()}
                (WORK/'browser-errors.json').write_text(json.dumps({'pageErrors':errors,'consoleErrors':console_errors},ensure_ascii=False,indent=2)+'\n')
                (WORK/'requests.json').write_text(json.dumps({'blocked':blocked,'allowed':allowed},indent=2)+'\n')
                self.send_response(200);self.end_headers();self.wfile.write(json.dumps(data,ensure_ascii=False).encode())
            def log_message(self,*args): pass
        print('capture-v5 ready: 127.0.0.1:18359',flush=True)
        server=HTTPServer(('127.0.0.1',18359),Handler)
        env['server']=server
        while not env.get('done',False): server.handle_request()
        browser.close();print('inventory after:',evidence('after'),flush=True)

if __name__=='__main__': main()

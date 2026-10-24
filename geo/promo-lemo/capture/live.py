"""Real-time GAID capture controller, adapted from capture_v3.py.

Run with task job run. POST bounded async Python to localhost:18349.
PNG export is separate so encoding cannot stall the live browser capture.
No request interception, animation disabling, text replacement or held frames.
"""
import asyncio
import contextlib
import io
import json
import time
import traceback
from datetime import datetime, UTC
from pathlib import Path

from playwright.async_api import async_playwright
from pointer import DRAW

WORK = Path.home() / 'data/geoaidesk/work/gaid-promo-video-v4-lemo--agent-capture'
OUT = WORK / 'capture-v6'


class Recorder:
    def __init__(self, page):
        self.page = page
        self.recording = False
        self.rows = []
        self.actions = []
        self.evidence = []
        self.pointer = None
        self.worker = None

    async def start(self, name, fps=12):
        if self.recording:
            raise RuntimeError('Already recording')
        self.name, self.fps = name, fps
        self.dest = OUT / 'raw' / name
        self.dest.mkdir(parents=True, exist_ok=False)
        self.rows, self.actions, self.evidence = [], [], []
        self.start_wall = datetime.now(UTC).isoformat()
        self.t0 = time.monotonic()
        self.recording = True
        self.worker = asyncio.create_task(self.loop())

    async def loop(self):
        try:
            while self.recording:
                before = time.monotonic()
                raw = await self.page.screenshot(type='jpeg', quality=94, timeout=10000)
                after = time.monotonic()
                k = len(self.rows)
                (self.dest / f'frame-{k:05d}.jpg').write_bytes(raw)
                self.rows.append({'frame': k, 't': round((before+after)/2-self.t0, 6),
                                  'latency': round(after-before, 6), 'pointer': self.pointer})
                if not self.evidence or after-self.t0-self.evidence[-1]['t'] >= 1:
                    self.evidence.append({'t': round(after-self.t0, 3),
                        'text': await self.page.locator('body').inner_text()})
                await asyncio.sleep(max(0, self.t0 + len(self.rows)/self.fps - time.monotonic()))
        finally:
            self.dump()

    def dump(self):
        (self.dest / 'timing.json').write_text(json.dumps({'name': self.name,
            'requestedFps': self.fps, 'startedAt': self.start_wall,
            'elapsedSeconds': time.monotonic()-self.t0, 'frames': self.rows,
            'actions': self.actions, 'evidence': self.evidence}, ensure_ascii=False, indent=2)+'\n')

    async def stop(self):
        self.recording = False
        if self.worker:
            await self.worker
        self.dump()
        return {'frames': len(self.rows), 'seconds': self.rows[-1]['t'] if self.rows else 0,
                'measuredFps': (len(self.rows)-1)/(self.rows[-1]['t']-self.rows[0]['t']) if len(self.rows)>1 else 0}

    async def move(self, loc, seconds=.5):
        rect = await loc.bounding_box()
        if not rect:
            raise RuntimeError('Target is not visible')
        end = {'x':rect['x']+rect['width']/2, 'y':rect['y']+rect['height']/2}
        start = self.pointer or {'x':800, 'y':580}
        for k in range(1, 13):
            u=k/12; u=u*u*(3-2*u)
            self.pointer = {a:start[a]+(end[a]-start[a])*u for a in ('x','y')}
            await self.page.mouse.move(**self.pointer)
            await self.page.evaluate(DRAW, [self.pointer, None])
            await asyncio.sleep(seconds/12)
        return rect

    async def click(self, label, rect):
        self.actions.append({'t': time.monotonic()-self.t0, 'kind':'click', 'target':label, 'rect':rect})
        await self.page.mouse.click(**self.pointer)
        for k in range(10):
            await self.page.evaluate(DRAW, [self.pointer, k/10])
            await asyncio.sleep(.025)
        await self.page.evaluate(DRAW, [self.pointer, None])


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, executable_path='/usr/bin/google-chrome',
            args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx = await browser.new_context(viewport={'width':1280,'height':720}, device_scale_factor=2.25,
            locale='ko-KR', timezone_id='Asia/Seoul', color_scheme='light')
        await ctx.add_init_script("localStorage.setItem('gaid:locale','ko');localStorage.setItem('theme','light');localStorage.setItem('gaid:style','instrument');")
        page = await ctx.new_page()
        page.set_default_timeout(8000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto('http://127.0.0.1:3000', wait_until='domcontentloaded')
        recorder = Recorder(page)
        done = asyncio.Event()
        env = globals() | {'page':page,'ctx':ctx,'browser':browser,'r':recorder,'errors':errors,'done':done}

        async def handle(reader, writer):
            try:
                header = await reader.readuntil(b'\r\n\r\n')
                size = int(next(x.split(b':',1)[1] for x in header.split(b'\r\n') if x.lower().startswith(b'content-length:')))
                code = (await reader.readexactly(size)).decode()
                buf = io.StringIO()
                try:
                    exec('async def command():\n'+''.join('    '+x+'\n' for x in code.splitlines()), env)
                    with contextlib.redirect_stdout(buf):
                        await env['command']()
                    response = {'ok':True,'output':buf.getvalue()}
                except Exception:
                    response = {'ok':False,'output':buf.getvalue(),'error':traceback.format_exc()}
                payload = json.dumps(response, ensure_ascii=False).encode()
                writer.write(b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: '+str(len(payload)).encode()+b'\r\nConnection: close\r\n\r\n'+payload)
                await writer.drain()
            finally:
                writer.close()

        server = await asyncio.start_server(handle, '127.0.0.1', 18349)
        print('live controller ready on 18349', flush=True)
        await done.wait()
        if recorder.recording:
            await recorder.stop()
        server.close()
        await server.wait_closed()
        (OUT/'browser-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2)+'\n')
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())

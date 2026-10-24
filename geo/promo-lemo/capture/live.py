"""Real-time GAID capture controller, adapted from capture_v3.py.

Run with task job run. POST bounded async Python to localhost:18349.
PNG export is separate so encoding cannot stall the live browser capture.
Capture with StreamRecorder; Pointer draws only the real mouse path.
No request interception, animation disabling, text replacement or held frames.
"""
import asyncio
import base64
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


class Pointer:
    """Real UI motion and the unchanged capture.py pointer overlay."""
    def __init__(self, page):
        self.page, self.pointer, self.actions = page, None, []
        self.t0 = time.monotonic()
        self.cdp = None
        self.view_scale = 2.25

    async def move(self, loc, seconds=.5):
        if self.cdp is None:
            self.cdp = await self.page.context.new_cdp_session(self.page)
        rect = await loc.bounding_box()
        if not rect:
            raise RuntimeError('Target is not visible')
        end = {'x':rect['x']+rect['width']/2, 'y':rect['y']+rect['height']/2}
        start = self.pointer or {'x':800, 'y':580}
        for k in range(1, 13):
            u=k/12; u=u*u*(3-2*u)
            self.pointer = {a:start[a]+(end[a]-start[a])*u for a in ('x','y')}
            await self.cdp.send('Input.dispatchMouseEvent', {'type':'mouseMoved',
                'x':self.pointer['x']*self.view_scale,'y':self.pointer['y']*self.view_scale})
            await self.page.evaluate(DRAW, [self.pointer, None])
            await asyncio.sleep(seconds/12)
        return rect

    async def click(self, label, rect):
        self.actions.append({'t': time.monotonic()-self.t0, 'kind':'click', 'target':label, 'rect':rect})
        for kind in ('mousePressed','mouseReleased'):
            await self.cdp.send('Input.dispatchMouseEvent', {'type':kind,
                'x':self.pointer['x']*self.view_scale,'y':self.pointer['y']*self.view_scale,
                'button':'left','clickCount':1})
        for k in range(10):
            await self.page.evaluate(DRAW, [self.pointer, k/10])
            await asyncio.sleep(.025)
        await self.page.evaluate(DRAW, [self.pointer, None])


class StreamRecorder:
    """Chrome compositor frames with native browser presentation timestamps.

    Static intervals emit no new frames. The exporter samples these genuine
    frames on a regular timeline, explicitly retaining static holds.
    """
    def __init__(self, page):
        self.page, self.rows, self.pending = page, [], set()
        self.pointer_provider = lambda: None
        self.evidence, self.actions = [], []
        self.recording = False

    async def start(self, name):
        self.dest = OUT/'raw'/name
        self.dest.mkdir(parents=True, exist_ok=False)
        self.started = datetime.now(UTC).isoformat()
        self.t0, self.wall0 = time.monotonic(), time.time()
        self.cdp = await self.page.context.new_cdp_session(self.page)
        # Screencast follows the native view size, not deviceScaleFactor alone.
        # Keep layout at 1280 CSS px while explicitly sizing/scaling its backing view.
        await self.cdp.send('Emulation.setDeviceMetricsOverride', {
            'width':1280,'height':720,'deviceScaleFactor':2.25,'mobile':False,
            'scale':2.25,'screenWidth':2880,'screenHeight':1620})
        await self.cdp.send('Emulation.setVisibleSize', {'width':2880,'height':1620})
        self.cdp.on('Page.screencastFrame', self.frame)
        await self.cdp.send('Page.startScreencast', {'format':'jpeg','quality':94,
            'maxWidth':2880,'maxHeight':1620,'everyNthFrame':1})
        self.recording = True
        self.observer = asyncio.create_task(self.observe())

    async def observe(self):
        while self.recording:
            self.evidence.append({'t':time.monotonic()-self.t0,
                'text':await self.page.locator('body').inner_text(),
                'regions':await self.page.locator('div').evaluate_all('''es=>es.filter(e=>
                    e.scrollHeight>e.clientHeight+100&&e.clientHeight>150&&
                    /auto|scroll/.test(getComputedStyle(e).overflowY))
                    .map(e=>e.getBoundingClientRect().toJSON())'''),
                'viewport':await self.page.evaluate('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,style:document.documentElement.dataset.style})')})
            self.dump()
            await asyncio.sleep(1)

    def frame(self, event):
        k=len(self.rows)
        raw=base64.b64decode(event['data'])
        (self.dest/f'frame-{k:05d}.jpg').write_bytes(raw)
        meta=event['metadata']
        self.rows.append({'frame':k,'t':meta['timestamp']-self.wall0,
            'timestamp':meta['timestamp'],'receivedT':time.monotonic()-self.t0,
            'pointer':self.pointer_provider()})
        task=asyncio.create_task(self.cdp.send('Page.screencastFrameAck', {'sessionId':event['sessionId']}))
        self.pending.add(task)
        task.add_done_callback(self.pending.discard)

    def dump(self):
        (self.dest/'timing.json').write_text(json.dumps({'startedAt':self.started,
            'elapsedSeconds':time.monotonic()-self.t0,'frames':self.rows,
            'evidence':self.evidence,'actions':self.actions,
            'source':'Chrome Page.screencastFrame native timestamp; static intervals have no new presentation'},indent=2)+'\n')

    async def stop(self):
        self.recording = False
        await self.observer
        await self.cdp.send('Page.stopScreencast')
        await asyncio.gather(*self.pending)
        self.dump()


class SurfaceRecorder(StreamRecorder):
    """Fixed-cadence full-surface sampling when Chrome emits sparse damage frames.

    Four concurrent readbacks hide transfer latency. Every frame is a genuine
    screenshot, including unchanged states. Receipt times and request latency
    are retained; no viewport override, animation or interpolation is applied.
    """
    async def start(self, name):
        self.dest=OUT/'raw'/name
        self.dest.mkdir(parents=True,exist_ok=False)
        self.started=datetime.now(UTC).isoformat()
        self.t0,self.wall0=time.monotonic(),time.time()
        self.cdp=await self.page.context.new_cdp_session(self.page)
        self.recording=True
        self.observer=asyncio.create_task(self.observe())
        self.worker=asyncio.create_task(self.loop())

    async def loop(self):
        active=set()
        async def capture():
            before=time.monotonic()
            result=await self.cdp.send('Page.captureScreenshot', {
                'format':'jpeg','quality':75,'optimizeForSpeed':True})
            after=time.monotonic()
            k=len(self.rows)
            (self.dest/f'frame-{k:05d}.jpg').write_bytes(base64.b64decode(result['data']))
            self.rows.append({'frame':k,'t':after-self.t0,'latency':after-before,
                'timestamp':self.wall0+after-self.t0,'pointer':self.pointer_provider()})
        while self.recording:
            active={x for x in active if not x.done()}
            if len(active)<4:
                active.add(asyncio.create_task(capture()))
            await asyncio.sleep(1/30)
        await asyncio.gather(*active)

    def dump(self):
        (self.dest/'timing.json').write_text(json.dumps({'startedAt':self.started,
            'elapsedSeconds':time.monotonic()-self.t0,'frames':self.rows,
            'evidence':self.evidence,'actions':self.actions,
            'source':'Chrome full-surface JPEG quality 75, native size, screenshot receipt timestamps'},indent=2)+'\n')

    async def stop(self):
        self.recording=False
        await self.worker
        await self.observer
        self.dump()


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
        recorder = Pointer(page)
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
        server.close()
        await server.wait_closed()
        (OUT/'browser-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2)+'\n')
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())

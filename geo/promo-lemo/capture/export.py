"""Export real compositor frames to PNG at documented real-time sampling rates.

Input is an external edit.json: shots contain source, start, end, fps and beats.
No interpolation, time compression or unlogged cuts. A static source is held
until Chrome presents its next frame. Frame source times are retained.
"""
import argparse
import bisect
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',type=Path,required=True)
    args=ap.parse_args()
    root=args.root.expanduser()
    edit=json.loads((root/'edit.json').read_text())
    manifest={'schema':'gaid-promo-capture-v2','fps':10,'width':2880,'height':1620,
        'css':{'width':1280,'height':720,'scale':2.25},'app':edit['app'],'shots':[],'stills':[]}
    checks=[]
    for shot in edit['shots']:
        raw=root/'raw'/shot['source']
        timing=json.loads((raw/'timing.json').read_text())
        source=timing['frames']; times=[f['t'] for f in source]
        assert all(a<=b for a,b in zip(times,times[1:])),shot['id']
        start,end,fps=shot['start'],shot['end'],shot['fps']
        assert end<=timing['elapsedSeconds']+.1
        dest=root/'shots'/shot['id']; dest.mkdir(parents=True,exist_ok=True)
        selected=[]
        for k in range(round((end-start)*fps)):
            target=start+k/fps
            idx=max(0,bisect.bisect_right(times,target)-1)
            selected.append(source[idx])
        def write(pair):
            k,frame=pair
            p=raw/f"frame-{frame['frame']:05d}.jpg"
            out=dest/f'frame-{k:05d}.png'
            with Image.open(p) as im:
                assert im.size==(2880,1620),(p,im.size)
                im.save(out,compress_level=3)
            return hashlib.sha256(out.read_bytes()).hexdigest()
        with ThreadPoolExecutor(max_workers=2) as pool:
            hashes=list(pool.map(write,enumerate(selected)))
        native=[f for f in source if start<=f['t']<=end]
        native_fps=(len(native)-1)/(native[-1]['t']-native[0]['t']) if len(native)>1 else 0
        record={'id':shot['id'],'frames':len(selected),'fps':fps,
            'pattern':f"shots/{shot['id']}/frame-%05d.png",'url':edit['app']['url'],
            'source':{'raw':shot['source'],'start':start,'end':end,'nativeFps':native_fps},
            'pointer':[f.get('pointer') for f in selected],
            'sourceFrame':[f['frame'] for f in selected],
            'sourceTimestamp':[f['t'] for f in selected],
            'actions':shot.get('actions',[]),'cuts':shot.get('cuts',[]),'beats':shot.get('beats',[])}
        for beat in record['beats']:
            rect=beat['rect']
            assert 0<=beat['t0']<beat['t1']<=len(selected)/fps+.01
            assert 0<=rect['x'] and 0<=rect['y']
            assert rect['x']+rect['width']<=1280.1 and rect['y']+rect['height']<=720.1
            if beat.get('pointerAction'):
                pts=record['pointer'][round(beat['t0']*fps):round(beat['t1']*fps)]
                contained=sum(bool(p) and rect['x']<=p['x']<=rect['x']+rect['width'] and rect['y']<=p['y']<=rect['y']+rect['height'] for p in pts)
                assert contained/max(1,len(pts))>.5,(shot['id'],beat)
        manifest['shots'].append(record)
        checks.append({'id':shot['id'],'frames':len(selected),'fps':fps,'nativeFps':native_fps,
            'sha256List':hashes,'distinctSourceFrames':len(set(record['sourceFrame']))})
        indices=sorted(set([0,len(selected)//4,len(selected)//2,3*len(selected)//4,len(selected)-1]))
        sheet=Image.new('RGB',(480*len(indices),294),'white'); draw=ImageDraw.Draw(sheet)
        for j,k in enumerate(indices):
            with Image.open(dest/f'frame-{k:05d}.png') as im:
                im.thumbnail((480,270));sheet.paste(im,(480*j,24))
            draw.text((480*j+4,5),f"{shot['id']} {k} / {k/fps:.2f}s",fill='black')
        sheet.save(root/f"contact-{shot['id']}.jpg",quality=90)
    (root/'capture.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (root/'frame-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
    print(json.dumps([{k:v for k,v in c.items() if k!='sha256List'} for c in checks],indent=2))


if __name__=='__main__':
    main()

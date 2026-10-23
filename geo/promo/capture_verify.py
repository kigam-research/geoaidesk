"""Verify capture-v2 frame geometry, timelines, and callouts; write evidence outside Git."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from PIL import Image


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--take',type=Path,default=Path.home()/'data/geoaidesk/work/gaid-promo-video-v2/capture-v2')
    args=parser.parse_args()
    root=args.take.expanduser()
    data=json.loads((root/'capture.json').read_text())
    assert data['schema']=='gaid-promo-capture-v2'
    checks={}
    for shot in data['shots']:
        frames=sorted((root/'shots'/shot['id']).glob('frame-*.png'))
        assert len(frames)==shot['frames'],shot['id']
        for i,frame in enumerate(frames):
            assert frame.name==f'frame-{i:05d}.png'
            with Image.open(frame) as im:
                assert im.size==(data['width'],data['height']),str(frame)
        beats=shot['beats']
        assert 2<=len(beats)<=4,shot['id']
        end=0
        for beat in beats:
            assert beat['t0']>=end and beat['t1']-beat['t0']>=1.5
            assert beat['t1']<=shot['frames']/data['fps']+.001
            assert len(beat['label'])<=18
            r=beat['rect']
            assert r['x']>=0 and r['y']>=0 and r['width']>0 and r['height']>0
            assert r['x']+r['width']<=1280 and r['y']+r['height']<=720
            end=beat['t1']
        checks[shot['id']]={'frames':len(frames),'size':[data['width'],data['height']],'beats':len(beats)}
    data['verification']={'shots':checks,'browser_errors':data.get('browser_errors',[])}
    (root/'capture.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(checks))

if __name__=='__main__': main()

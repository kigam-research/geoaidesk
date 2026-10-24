"""Verify v5's external takes and inventory; no app requests or writes to research data."""
from __future__ import annotations
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from PIL import Image


def verify(root):
    doc=json.loads((root/'capture.json').read_text())
    assert doc['schema']=='gaid-promo-capture-v2'
    assert doc['css']=={'width':1280,'height':720,'scale':2.25}
    assert doc['fps']==30 and (doc['width'],doc['height'])==(2880,1620)
    assert [s['id'] for s in doc['shots']]==[f'Y{i}' for i in range(1,8)]
    checks={}
    for shot in doc['shots']:
        files=sorted((root/'shots'/shot['id']).glob('frame-*.png'))
        assert len(files)==shot['frames']
        for i,path in enumerate(files):
            assert path.name==f'frame-{i:05d}.png'
            with Image.open(path) as im: assert im.size==(2880,1620)
        end=0
        assert 1<=len(shot['beats'])<=3
        for beat in shot['beats']:
            assert beat['region'] and beat['selector']
            assert beat['t0']>=end and beat['t1']-beat['t0']>=1.5-1e-6
            assert beat['t1']<=shot['frames']/30+.001
            assert len(beat['label'])<=18
            r=beat['rect']
            assert r['x']>=0 and r['y']>=0 and r['width']>0 and r['height']>0
            assert r['x']+r['width']<=1280+.001 and r['y']+r['height']<=720+.001
            end=beat['t1']
        for cut in shot['cuts']:
            assert 0<=cut['frame']<=shot['frames'] and cut['removedSeconds']>=0 and cut['why']
        assert not [a for a in shot['actions'] if a['kind']=='scroll']
        checks[shot['id']]={'frames':len(files),'seconds':round(len(files)/30,3),'beats':len(shot['beats']),'cuts':len(shot['cuts'])}
    for still in doc['stills']:
        assert hashlib.sha256((root/'stills'/still['name']).read_bytes()).hexdigest()==still['sha256']
    assert not doc['browser_errors']
    req=doc['requests']
    report={'shots':checks,'frames':sum(s['frames'] for s in doc['shots']),
            'beats':sum(len(s['beats']) for s in doc['shots']),
            'blocked':dict(Counter(f"{r['method']} {r['path']}" for r in req['blocked'])),
            'allowed':dict(Counter(f"{r['method']} {r['path']}" for r in req['allowed'])),
            'pageErrors':doc['browser_errors'],'consoleErrors':doc['console_errors']}
    before={r['path']:r for r in json.loads((root.parent/'evidence-before.json').read_text())}
    after={r['path']:r for r in json.loads((root.parent/'evidence-after.json').read_text())}
    report['inventory']={'before':len(before),'after':len(after),
        'added':sorted(after.keys()-before.keys()),'removed':sorted(before.keys()-after.keys()),
        'changed':[p for p in sorted(before.keys()&after.keys()) if before[p]!=after[p]]}
    (root/'verification-v5.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return report

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--take',type=Path,default=Path.home()/'data/geoaidesk/work/gaid-promo-video-v5/capture-v5')
    print(json.dumps(verify(ap.parse_args().take.expanduser()),ensure_ascii=False,indent=2))

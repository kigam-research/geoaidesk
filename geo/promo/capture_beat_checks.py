"""Draw every feature beat on its midpoint frame at the capture's native scale.

The rectangles are CSS-pixel bounds of the displayed UI element, including clipping where the UI clips an image.
Output PNGs and contact sheets remain outside Git for the film editor's review.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--take',type=Path,default=Path.home()/'data/geoaidesk/work/gaid-promo-video-v2/capture-v2')
    args=ap.parse_args();root=args.take.expanduser()
    doc=json.loads((root/'capture.json').read_text());out=root/'beat-checks';out.mkdir(exist_ok=True)
    font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',30)
    rows=[]
    for shot in doc['shots']:
        for i,beat in enumerate(shot['beats']):
            k=min(shot['frames']-1,round((beat['t0']+beat['t1'])/2*doc['fps']))
            source=root/shot['pattern'].replace('%05d',f'{k:05d}')
            im=Image.open(source).convert('RGB');draw=ImageDraw.Draw(im)
            r=beat['rect'];scale=doc['css']['scale']
            box=[r['x']*scale,r['y']*scale,(r['x']+r['width'])*scale,(r['y']+r['height'])*scale]
            draw.rectangle(box,outline='#ef1748',width=6)
            label=f"{shot['id']} beat {i+1} | frame {k} | CSS {r['x']:.1f}, {r['y']:.1f}, {r['width']:.1f}, {r['height']:.1f}"
            draw.rectangle((12,12,12+draw.textlength(label,font=font)+16,58),fill='white')
            draw.text((20,15),label,font=font,fill='#b00020')
            dest=out/f"{shot['id']}-beat-{i+1:02d}-frame-{k:05d}.png";im.save(dest)
            rows.append({'shot':shot['id'],'beat':i+1,'frame':k,'file':str(dest.relative_to(root)),'rect':r,'element':beat.get('element')})
    (out/'index.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    for start in range(0,len(rows),6):
        group=rows[start:start+6];sheet=Image.new('RGB',(1440,3*405),'white')
        for j,row in enumerate(group):
            im=Image.open(root/row['file']);im.thumbnail((720,405));sheet.paste(im,((j%2)*720,(j//2)*405))
        sheet.save(out/f'check-sheet-{start//6+1:02d}.jpg',quality=94)
    print(f'{len(rows)} midpoint checks: {out}')

if __name__=='__main__':main()

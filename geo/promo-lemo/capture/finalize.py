"""Prepare the final sampling manifest from capture receipts; no browser or model calls."""
import json
from pathlib import Path

ROOT=Path.home()/'data/geoaidesk/work/gaid-promo-video-v4-lemo--agent-capture/capture-v6'


def read(name):
    return json.loads((ROOT/name).read_text())


def region(timing, time):
    observation=min(timing['evidence'],key=lambda e:abs(e['t']-time))
    rect=next(r for r in observation['regions'] if r['x']>=600 and r['height']>=200)
    return {k:rect[k] for k in ('x','y','width','height')},observation['t']


def main():
    edit=read('edit.json')
    edit['shots']=[s for s in edit['shots'] if s['id']=='AG1']
    ag1=read('raw/AG1-final/timing.json')
    edit['shots'][0]['cuts']=[{'frame':165,'removedSeconds':ag1['elapsedSeconds']-5.5,
        'why':'Trim static tail to 5.5 s; no internal cut'}]
    fixed=read('raw/AG2-fixed/timing.json')
    start,end=5,70
    in_window=[f for f in fixed['frames'] if start<=f['t']<=end]
    actual=(len(in_window)-1)/(in_window[-1]['t']-in_window[0]['t'])
    assert actual>=10,actual
    beats=[]
    for a,b,label in [(0,25,'도구 실행과 응답'),(25,65,'새 결과 점검')]:
        # Labels are the capture editor's Korean callouts, not changes to the app.
        rect,measured=region(fixed,start+a)
        beats.append({'t0':a,'t1':b,'label':label,'rect':rect,
            'measuredAt':measured-start,'pointerAction':False})
    edit['shots'].append({'id':'AG2','source':'AG2-fixed','start':start,'end':end,'fps':10,
        'beats':beats,'cuts':[{'frame':0,'removedSeconds':start,'why':'Trim fixed-cadence take lead-in; no internal cut'},
            {'frame':650,'removedSeconds':fixed['elapsedSeconds']-end,'why':'Trim fixed-cadence take tail; whole run retained separately'}]})
    whole=read('raw/AG2-final/timing.json')
    duration=int(whole['elapsedSeconds']*2)/2
    rect,measured=region(whole,20)
    edit['shots'].append({'id':'AG2-whole','source':'AG2-final','start':0,'end':duration,'fps':2,
        'actions':whole['actions'],'beats':[{'t0':max(0,measured-1),'t1':measured+1,
            'label':'전체 실행 기록','rect':rect,'measuredAt':measured,'pointerAction':False}],
        'cuts':[]})
    result=read('ag3-selection.json')
    result['cuts']=[{'frame':0,'removedSeconds':result['start'],
        'why':'Extract result-opening action from continuous whole run'},
        {'frame':180,'removedSeconds':whole['elapsedSeconds']-result['end'],
        'why':'Extract result-opening action; following work remains in whole run'}]
    edit['shots'].append(result)
    (ROOT/'edit.json').write_text(json.dumps(edit,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'shots':[s['id'] for s in edit['shots']],'AG2nativeFps':actual,'wholeSeconds':duration}))


if __name__=='__main__':
    main()

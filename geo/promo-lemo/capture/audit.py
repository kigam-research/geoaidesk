"""Verify the delivered live-capture contract and write external evidence."""
import hashlib
import json
import shutil
from datetime import datetime, UTC, timedelta
from pathlib import Path

ROOT=Path.home()/'data/geoaidesk/work/gaid-promo-video-v4-lemo--agent-capture/capture-v6'
SANDBOX=Path.home()/'.geoaidesk/projects/proj-af4c46/sandbox'


def read(path):
    return json.loads((ROOT/path).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    capture=read('capture.json'); checks=read('frame-checks.json')
    shots={s['id']:s for s in capture['shots']}
    assert set(shots)=={'AG1','AG2','AG2-whole','AG3'}
    for key in ('AG1','AG3'):
        shot=shots[key]
        assert 4<=shot['frames']/shot['fps']<=6
    assert shots['AG2']['frames']/shots['AG2']['fps']>=40
    assert shots['AG2']['fps']>=10 and shots['AG2']['source']['nativeFps']>=10
    assert shots['AG2-whole']['fps']==2
    assert shots['AG2-whole']['cuts']==[]
    for shot in shots.values():
        assert len(shot['pointer'])==shot['frames']==len(shot['sourceTimestamp'])
        assert all(a<=b for a,b in zip(shot['sourceTimestamp'],shot['sourceTimestamp'][1:]))
        files=list((ROOT/'shots'/shot['id']).glob('frame-*.png'))
        assert len(files)==shot['frames']
        assert all(c['frame'] in (0,shot['frames']) for c in shot['cuts'])
    whole=read('raw/AG2-final/timing.json')
    for observation in whole['evidence']:
        assert observation['viewport']['width']==1280
        assert observation['viewport']['height']==720
        assert observation['viewport']['dpr']==2.25
    old=read('protected-before-retake.json')
    changed=[f['path'] for f in old if sha(SANDBOX/f['path'])!=f['sha256']]
    assert not changed,changed
    examples=[]
    for role,name in [('aeromag','aeromag_lines.csv'),('base-station','base_station.csv'),
        ('dem','dem.tif'),('boreholes','boreholes.csv'),('cores','core_samples.csv'),
        ('ore-reference','orebody_reference.csv')]:
        path=next((SANDBOX/'user_data/examples/pocheon-pgi-magnetic-trial').glob(f'{role}-*/{name}'))
        examples.append({'path':str(path.relative_to(SANDBOX)),'bytes':path.stat().st_size,'sha256':sha(path)})
    (ROOT/'stills').mkdir(exist_ok=True)
    outputs=[]
    for name in ['magnetic_maps.png','orebody_3d.png','susceptibility_sections.png','magnetic_anomaly.tif']:
        path=SANDBOX/'pgi_live_retake/outputs'/name
        assert path.exists()
        outputs.append({'path':str(path),'sha256':sha(path),'bytes':path.stat().st_size})
        if name.endswith('.png'):
            shutil.copyfile(path,ROOT/'stills'/name)
    browser=read('browser-verification.json')
    assert browser['pageErrors']==[]
    assert browser['preferences']=={'locale':'ko','theme':'light','style':'instrument'}
    first=read('first-run-end.json'); second=read('retake-end.json'); start=read('retake-start.json')
    first_source=read('raw/AG2-run/timing.json')
    first_sent=(datetime.fromisoformat(first_source['startedAt'])+
        timedelta(seconds=first_source['actions'][0]['t'])).isoformat()
    second_sent=(datetime.fromisoformat(whole['startedAt'])+
        timedelta(seconds=whole['actions'][0]['t'])).isoformat()
    first_wall=(datetime.fromisoformat(first['endedAt'])-datetime.fromisoformat(first_sent)).total_seconds()
    second_wall=(datetime.fromisoformat(second['endedAt'])-datetime.fromisoformat(second_sent)).total_seconds()
    result={'verifiedAt':datetime.now(UTC).isoformat(),'app':capture['app'],
        'browser':browser,'workflow':{'id':start['workflow'],'version':start['version'],
            'title':'포천 자철석 광체 추정','examples':examples},
        'modelShown':start['model'],'reasoningShown':'높음','modelOrSettingsChanged':False,
        'runTimestampBasis':'Real UI send action; end is first observed ready state (polling <=2 s)',
        'runs':[{'run':1,'selected':False,'startedAt':first_sent,
            'endedAt':first['endedAt'],'wallSeconds':first_wall,
            'whyNotSelected':'Initial native backing-view geometry was wrong; later corrected frames remain archived'},
            {'run':2,'selected':True,'startedAt':second_sent,'endedAt':second['endedAt'],
             'wallSeconds':second_wall,'sourceSeconds':whole['elapsedSeconds'],
             'reasonForSecondRun':start['reason'],'pipelineSecondsReported':122.692,
             'nominalTenMinuteOverrunSeconds':max(0,second_wall-600)}],
        'rawFixedCadence':read('fixed-status.json'),'shots':[{k:v for k,v in s.items()
            if k not in ('pointer','sourceFrame','sourceTimestamp')} for s in shots.values()],
        'frameCounts':{s['id']:s['frames'] for s in shots.values()},
        'cuts':{s['id']:s['cuts'] for s in shots.values()},'outputs':outputs,
        'protectedFilesUnchanged':len(old),'frameHashList':'frame-checks.json',
        'captureManifestSha256':sha(ROOT/'capture.json'),
        'limits':['Source encodings: compositor JPEG quality 94; active-work screenshots JPEG quality 75; final files PNG.',
            'Full-run 2 fps sampling holds the latest genuine compositor presentation when the page has no new damage.',
            'Screenshot source timestamps are receipt times and include saved readback latency; no temporal interpolation.',
            '25 whole-run compositor frames arrived out of presentation-time order during concurrent screenshots; export sorts by native presentation time and preserves original arrival frame IDs.',
            'Coarse synthetic example; five models unconverged; internal checks are not independent scientific verification.',
            'The retake took about 10 min 22 s including final packaging repair, without numerical enlargement or rerun.']}
    (ROOT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'ok':True,'frames':result['frameCounts'],'protectedUnchanged':len(old)},indent=2))


if __name__=='__main__':
    main()

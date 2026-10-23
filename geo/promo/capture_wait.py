"""Wait for an existing own-study authoring attempt or chat; never starts work.

The capture controller retains Chrome and its authenticated app session. This read-only
watcher exits on a terminal attempt so task-job relay can resume the writer without wakeups.
"""
from __future__ import annotations

import argparse
import json
import re
import time
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--authoring')
    target.add_argument('--session')
    parser.add_argument('--attempt')
    parser.add_argument('--project')
    parser.add_argument('--timeout', type=int, default=1800)
    args = parser.parse_args()
    if args.authoring:
        assert re.fullmatch(r'ap-[a-z0-9-]+', args.authoring)
        assert args.attempt and re.fullmatch(r'att-[a-z0-9-]+', args.attempt)
        code = (
            f"p=api('/geo/authoring/projects/{args.authoring}')\n"
            f"a=next(a for a in p['attempts'] if a['id']=={args.attempt!r})\n"
            "print(json.dumps({'attempt':a,'questions':len(p['questions']),'drafts':len(p['drafts'])},ensure_ascii=False))\n"
            "(WORK/'authoring-current.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\\n')\n"
        )
        key = args.attempt
    else:
        assert re.fullmatch(r'[a-f0-9-]{36}', args.session)
        assert args.project and re.fullmatch(r'[a-z0-9-]+', args.project)
        code = (
            f"s=api('/sessions/{args.session}/run/state?frames=0',{args.project!r})\n"
            "print(json.dumps({'status':s['status'],'runId':s.get('run',{}).get('runId'),"
            "'lastSeq':s.get('run',{}).get('lastSeq')},ensure_ascii=False))\n"
            "if s['status']=='complete':\n"
            f"    h=api('/sessions/{args.session}/history',{args.project!r})\n"
            "    (WORK/'analysis-history.json').write_text(json.dumps(h,ensure_ascii=False,indent=2)+'\\n')\n"
            f"    c=api('/sessions/{args.session}/costs',{args.project!r})\n"
            "    (WORK/'analysis-costs.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\\n')\n"
        )
        key = args.session
    dest = Path.home()/'data/geoaidesk/work/gaid-promo-video-v3'/f'wait-{key}.json'
    started = time.monotonic()
    previous = None
    while time.monotonic()-started < args.timeout:
        request = urllib.request.Request('http://127.0.0.1:18339/exec',data=code.encode(),method='POST')
        with urllib.request.urlopen(request,timeout=60) as response:
            result = json.load(response)
        if not result['ok']:
            raise RuntimeError(result.get('error'))
        state = json.loads(result['output'])
        dest.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
        outcome = state['attempt']['outcome'] if args.authoring else state['status']
        if outcome != previous:
            print(json.dumps(state,ensure_ascii=False),flush=True)
            previous = outcome
        if outcome != 'running':
            return
        time.sleep(10)
    raise TimeoutError(f'Existing attempt still running; inspect {dest}, do not repeat it.')


if __name__ == '__main__':
    main()

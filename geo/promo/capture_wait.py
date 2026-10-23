"""Wait for an existing own-study authoring attempt; never starts or repeats work.

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
    parser.add_argument('--authoring', required=True)
    parser.add_argument('--attempt', required=True)
    parser.add_argument('--timeout', type=int, default=1800)
    args = parser.parse_args()
    assert re.fullmatch(r'ap-[a-z0-9-]+', args.authoring)
    assert re.fullmatch(r'att-[a-z0-9-]+', args.attempt)
    code = (
        f"p=api('/geo/authoring/projects/{args.authoring}')\n"
        f"a=next(a for a in p['attempts'] if a['id']=={args.attempt!r})\n"
        "print(json.dumps({'attempt':a,'questions':len(p['questions']),'drafts':len(p['drafts'])},ensure_ascii=False))\n"
        "(WORK/'authoring-current.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\\n')\n"
    )
    dest = Path.home()/'data/geoaidesk/work/gaid-promo-video-v3'/f'wait-{args.attempt}.json'
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
        outcome = state['attempt']['outcome']
        if outcome != previous:
            print(json.dumps(state,ensure_ascii=False),flush=True)
            previous = outcome
        if outcome != 'running':
            return
        time.sleep(10)
    raise TimeoutError(f'Existing attempt still running; inspect {dest}, do not repeat it.')


if __name__ == '__main__':
    main()

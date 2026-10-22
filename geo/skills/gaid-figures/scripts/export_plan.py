#!/usr/bin/env python3
"""Plan final-size exports from GAID's verified journal snapshots. No compliance claim."""
import argparse
import json
import math
from pathlib import Path


def plan(journals, journal, width, artwork):
    data = json.loads(Path(journals).read_text(encoding='utf-8'))
    if data.get('schema') != 'gaid-journal-figures/v1': raise ValueError('Unsupported schema')
    profile = next(p for p in data['profiles'] if p['id'] == journal)
    mm = next(w['mm'] for w in profile['widths'] if w['id'] == width)
    dpi = profile['dpi'][artwork]
    return dict(journalId=journal, width=width, widthMm=mm, widthInches=mm / 25.4 if mm else None,
                minFontPt=profile['minFontPt'], dpi=dpi,
                minPixels=math.ceil(mm / 25.4 * dpi) if mm and dpi else None,
                formats=profile['formats'], sources=profile['sources'],
                notice='Dated planning snapshot, not journal compliance; unknown values remain null.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--journals', default=str(Path(__file__).resolve().parents[1] / 'assets/journals.json'))
    parser.add_argument('--journal', required=True)
    parser.add_argument('--width', required=True)
    parser.add_argument('--artwork', choices=('photo', 'combination', 'lineArt'), required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(plan(args.journals, args.journal, args.width, args.artwork), ensure_ascii=False, indent=2))
    except (ValueError, KeyError, StopIteration) as error:
        parser.error(f'Invalid profile/width/artwork: {error}')

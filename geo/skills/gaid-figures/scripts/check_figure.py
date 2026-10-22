#!/usr/bin/env python3
"""Deterministic, conservative FigureCheck writer. A check never certifies journal compliance.

No network or model call. Missing/unmeasurable facts stay not-measured. CVD previews
use the full-severity Machado et al. (2009) matrices on linear sRGB, not gamma RGB.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

# Resolve only this shipped sibling when invoked by the backend with Python -I.
sys.path.insert(0, str(Path(__file__).resolve().parent))

KINDS = ('data-figure', 'code-diagram', 'ai-picture', 'ai-graphical-abstract', 'image-edit', 'unknown')
RASTER = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.gif'}
VECTOR = {'.svg', '.pdf', '.eps'}
MAX_BYTES = 64 * 1024 * 1024
MAX_PIXELS = 40_000_000
# Machado, Oliveira & Fernandes, IEEE TVCG 15(6), 2009, severity 1.0.
# https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
CVD_MATRICES = {
    'deuteranopia': [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.011820, .042940, .968881]],
    'protanopia': [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]],
    'tritanopia': [[1.255528, -.076749, -.178779], [-.078411, .930809, .147602], [.004733, .691367, .303900]],
}


class BadValue(ValueError):
    pass


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise BadValue(message)


def positive(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise BadValue('Expected a positive finite number')
    return number


def relative(file):
    return Path(os.path.relpath(file, Path.cwd())).as_posix()


def item(id, status, measured=None, required=None):
    return dict(id=id, status=status, **({'measured': measured} if measured is not None else {}),
                **({'required': required} if required is not None else {}))


def length(value, default='px'):
    match = re.fullmatch(r'\s*([\d.eE+-]+)\s*(px|pt|pc|mm|cm|in)?\s*', value or '')
    if not match:
        return None
    try:
        n = positive(match[1])
    except (ValueError, OverflowError):
        return None
    return n * {'px': 72 / 96, 'pt': 1, 'pc': 12, 'mm': 72 / 25.4, 'cm': 72 / 2.54, 'in': 72}[match[2] or default]


def matrix(value, np):
    """SVG transform list, using homogeneous column vectors. Unknown transforms are not guessed."""
    out = np.eye(3)
    tail = re.sub(r'[a-zA-Z]+\s*\([^)]*\)', '', value or '').strip(' ,\t\r\n')
    if tail:
        return None
    for name, args in re.findall(r'([a-zA-Z]+)\s*\(([^)]*)\)', value or ''):
        try:
            a = [float(x) for x in re.split(r'[\s,]+', args.strip()) if x]
            if not all(math.isfinite(x) for x in a): return None
        except ValueError: return None
        t = np.eye(3)
        if name == 'matrix' and len(a) == 6:
            t = np.array([[a[0], a[2], a[4]], [a[1], a[3], a[5]], [0, 0, 1]])
        elif name == 'scale' and len(a) in (1, 2): t[0, 0], t[1, 1] = a[0], a[-1]
        elif name == 'translate' and len(a) in (1, 2): t[:2, 2] = [a[0], a[1] if len(a) == 2 else 0]
        elif name == 'rotate' and len(a) in (1, 3):
            c, s = math.cos(math.radians(a[0])), math.sin(math.radians(a[0]))
            t[:2, :2] = [[c, -s], [s, c]]
            if len(a) == 3: t[:2, 2] = np.array(a[1:]) - t[:2, :2] @ np.array(a[1:])
        else: return None
        out = out @ t
    return out


def svg_facts(file, target_mm, np):
    payload = file.read_bytes()
    if re.search(br'<!ENTITY\b|<!DOCTYPE[^>]*\[', payload, re.I | re.S):
        raise BadValue('SVG DTD/entities are unsupported')
    root = ET.fromstring(payload)
    if root.tag.rsplit('}', 1)[-1] != 'svg': raise BadValue('Not an SVG')
    elements = list(root.iter())
    if len(elements) > 100_000: raise BadValue('SVG exceeds 100,000 elements')
    width_pt = length(root.get('width'))
    if target_mm and not width_pt:
        return None, True, None
    viewbox = [float(x) for x in re.split(r'[\s,]+', root.get('viewBox', '').strip()) if x]
    if viewbox and (len(viewbox) != 4 or not all(math.isfinite(x) for x in viewbox) or min(viewbox[2:]) <= 0):
        raise BadValue('Invalid SVG viewBox')
    # SVG presentation attributes and inline style only. Stylesheets/use/textPath/nested
    # viewports require a browser layout engine: do not infer their computed text size.
    unsupported_css = any(e.tag.rsplit('}', 1)[-1] in ('style', 'use', 'textPath') for e in elements)
    sizes, unknown = [], [False]
    used_text = False
    native_scale = width_pt / viewbox[2] if width_pt and viewbox else .75
    final_scale = target_mm * 72 / 25.4 / width_pt if target_mm and width_pt else 1
    if target_mm and not width_pt: unknown[0] = True

    def walk(e, font_pt, transform, nested=False):
        nonlocal used_text
        tag = e.tag.rsplit('}', 1)[-1]
        style = dict(re.findall(r'([\w-]+)\s*:\s*([^;]+)', e.get('style', '')))
        font = style.get('font-size', e.get('font-size'))
        if not font and 'font' in style:
            found = re.search(r'(?<![\w.])([\d.]+(?:px|pt|pc|mm|cm|in))(?:\s|/)', style['font'])
            font = found[1] if found else None
            if not found: font_pt = None
        if font:
            # Absolute CSS units become user units via CSS px; unitless = user units.
            raw = length(font)
            font_pt = raw / .75 * native_scale if raw else None
        local = matrix(e.get('transform'), np)
        transform = transform @ local if transform is not None and local is not None else None
        if nested and tag == 'svg': transform = None
        if tag in ('text', 'tspan') and ((e.text or '').strip() or (e.tail or '').strip()):
            used_text = True
            if font_pt and transform is not None and not unsupported_css:
                sizes.append(font_pt * float(np.linalg.norm(transform[:2, 1])) * final_scale)
            else: unknown[0] = True
        for child in e: walk(child, font_pt, transform, True)
    walk(root, 16 * native_scale, np.eye(3))  # browser default 16 CSS px, where no override exists
    # Live SVG text is normally a font reference, not embedded. Outlines do not prove text editability.
    # Embedded SVG font declarations need CSS/fallback resolution; do not call them absent.
    font_declarations = any(e.tag.rsplit('}', 1)[-1] == 'font' for e in elements) or b'@font-face' in payload
    embedded = False if used_text and not font_declarations else None
    return min(sizes) if sizes else None, unknown[0], embedded


def pdf_facts(file, target_mm):
    try:
        from pypdf import PdfReader
    except ImportError:
        return None, True, None
    from image_metadata import _pdf_font_report
    reader = PdfReader(file)
    if reader.is_encrypted: raise BadValue('Encrypted PDF is unsupported')
    if len(reader.pages) > 20: raise BadValue('PDF exceeds 20 pages')
    sizes, embeds = [], []
    partial = False
    for page in reader.pages:
        user_unit = positive(page.get('/UserUnit', 1))
        width = float(page.mediabox.width) * user_unit
        if width <= 0: raise BadValue('Invalid PDF page width')
        scale = target_mm * 72 / 25.4 / width if target_mm else 1
        fonts = _pdf_font_report(page)
        if fonts['resource_count']: embeds.append(fonts['all_embedded'])
        # Font resources inside Form XObjects are not covered by that helper.
        resources = page.get('/Resources')
        resources = resources.get_object() if resources else {}
        xobjects = resources.get('/XObject')
        if xobjects and any(x.get_object().get('/Subtype') == '/Form' for x in xobjects.get_object().values()):
            partial = True
        def visitor(text, cm, tm, font, font_size):
            if not text.strip(): return
            effective = math.hypot(cm[0] * tm[2] + cm[2] * tm[3], cm[1] * tm[2] + cm[3] * tm[3])
            size = font_size * effective * user_unit * scale
            if math.isfinite(size) and size > 0: sizes.append(size)
        page.extract_text(visitor_text=visitor)
    embedded = False if False in embeds else True if embeds and all(x is True for x in embeds) and not partial else None
    return min(sizes) if sizes else None, partial, embedded


def eps_embedded(file):
    payload = file.read_bytes()
    # DSC can declare font resources without embedding them. Check declared use against
    # actual BeginResource/BeginFont blocks; absent declarations remain unmeasured.
    names = re.findall(br'^%%(?:DocumentNeededResources|DocumentSuppliedResources):\s*font\s+([^\r\n]+)', payload, re.M)
    names += re.findall(br'^%%DocumentFonts:\s*([^\r\n]+)', payload, re.M)
    # Multi-line DSC font lists are not reconstructed here: never certify an incomplete list.
    if re.search(br'^%%\+', payload, re.M): return None
    used = {word for line in names for word in line.split() if word != b'(atend)'}
    supplied = set(re.findall(br'^%%BeginResource:\s*font\s+(\S+)', payload, re.M) + re.findall(br'^%%BeginFont:\s*(\S+)', payload, re.M))
    return bool(used <= supplied) if used else None


def rainbow_ramp(rgb, np):
    """A hue-ramp lead, not a classification of a palette or of scientific truth."""
    from matplotlib.colors import rgb_to_hsv
    hsv = rgb_to_hsv(rgb)
    sequences = [hsv[i, :, :] for i in np.linspace(0, hsv.shape[0] - 1, min(40, hsv.shape[0]), dtype=int)]
    sequences += [hsv[:, i, :] for i in np.linspace(0, hsv.shape[1] - 1, min(40, hsv.shape[1]), dtype=int)]
    for line in sequences:
        selected = line[(line[:, 1] > .45) & (line[:, 2] > .45)]
        if len(selected) < 64: continue
        hues = selected[:, 0]
        if np.ptp(hues) < .5: continue
        delta = np.diff(hues)
        moving = delta[np.abs(delta) > .0001]
        if len(moving) < 30: continue
        if np.mean(np.abs(delta) < .035) < .9: continue
        if max(np.mean(moving > 0), np.mean(moving < 0)) >= .88:
            return True
    return False


def previews(rgb, out, sha, np, Image):
    # Bound preview size without claiming any increase in information.
    image = Image.fromarray(np.uint8(np.clip(rgb * 255, 0, 255)))
    image.thumbnail((1400, 1400))
    a = np.asarray(image, dtype=float) / 255
    linear = np.where(a <= .04045, a / 12.92, ((a + .055) / 1.055) ** 2.4)
    result = []
    for name, values in CVD_MATRICES.items():
        transformed = np.clip(linear @ np.array(values).T, 0, 1)
        srgb = np.where(transformed <= .0031308, transformed * 12.92, 1.055 * transformed ** (1 / 2.4) - .055)
        destination = out.with_name(f'{sha}-cvd-{name}.png')
        Image.fromarray(np.uint8(np.rint(srgb * 255))).save(destination)
        result.append(relative(destination))
    return result


def atomic_write(out, value):
    fd, name = tempfile.mkstemp(prefix=f'.{out.name}.', dir=out.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write('\n')
        os.replace(name, out)
    finally:
        if os.path.exists(name): os.unlink(name)


def check(args):
    import numpy as np
    from PIL import Image
    file = Path(args.figure)
    if not file.is_file(): raise FileNotFoundError(file)
    if not Path(args.journals).is_file(): raise FileNotFoundError(args.journals)
    if file.stat().st_size > MAX_BYTES: raise BadValue('Figure exceeds 64 MiB')
    ext = file.suffix.lower()
    if ext not in RASTER | VECTOR: raise BadValue('Unsupported figure extension')
    data = json.loads(Path(args.journals).read_text(encoding='utf-8'))
    if data.get('schema') != 'gaid-journal-figures/v1': raise BadValue('Unsupported journals schema')
    profile = next((p for p in data['profiles'] if p['id'] == args.journal), None)
    if args.journal and not profile: raise BadValue('Unknown journal id')
    if args.width and not profile: raise BadValue('--width requires --journal')
    width = next((w for w in profile['widths'] if w['id'] == args.width), None) if profile and args.width else None
    if args.width and not width: raise BadValue('Unknown journal width id')
    width_mm = positive(width['mm']) if width and width['mm'] is not None else None
    sha = hashlib.sha256(file.read_bytes()).hexdigest()
    out = Path(args.out) if args.out else Path('.kady/geo/figure-checks') / f'{sha}.json'
    if file.resolve() == out.resolve(): raise BadValue('Output must not overwrite the figure')
    items, cvd = [], []
    min_font, partial, embedded = None, False, None
    pixels, rgb, native_mm = None, None, None
    if ext in RASTER:
        Image.MAX_IMAGE_PIXELS = MAX_PIXELS
        with Image.open(file) as image:
            if image.width * image.height > MAX_PIXELS: raise BadValue('Figure exceeds 40 million pixels')
            pixels = image.size
            # Alpha composited on white, matching the manuscript page, not discarded as black.
            rgba = image.convert('RGBA')
            bg = Image.new('RGBA', rgba.size, 'white'); bg.alpha_composite(rgba)
            bg.thumbnail((1400, 1400))
            rgb = np.asarray(bg.convert('RGB'), dtype=float) / 255
            metadata = image.info.get('gaid.figure')
            if metadata:
                meta = json.loads(metadata)
                # A PNG text chunk emitted from the plotting script. It is a self-report,
                # not an OCR measurement; only trust when it describes these exact pixels.
                if meta.get('pixelSize') == list(pixels):
                    native_mm = positive(meta['widthMm'])
                    min_font = positive(meta['minFontPt']) * (width_mm / native_mm if width_mm else 1)
                    partial = False
    elif ext == '.svg': min_font, partial, embedded = svg_facts(file, width_mm, np)
    elif ext == '.pdf': min_font, partial, embedded = pdf_facts(file, width_mm)
    elif ext == '.eps': embedded = eps_embedded(file)
    items.append(item('pixel-size', 'ok' if pixels else 'not-measured', f'{pixels[0]} × {pixels[1]} px' if pixels else None))
    requirements = profile['dpi'] if profile else {}
    known = [positive(v) for v in requirements.values() if v is not None]
    if pixels and width_mm:
        dpi = pixels[0] * 25.4 / width_mm
        if args.artwork:
            required = requirements.get(args.artwork)
            status = 'ok' if required and dpi + .5 >= required else 'fail' if required else 'not-measured'
            req = f'{required:g} dpi ({args.artwork})' if required else None
        elif known:
            status = 'fail' if dpi + .5 < min(known) else 'ok' if len(known) == 3 and dpi + .5 >= max(known) else 'warn'
            req = '; '.join(f'{k}: {v:g} dpi' for k, v in requirements.items() if v is not None) + ' (artwork type unclassified)'
        else: status, req = 'not-measured', None
        items.append(item('dpi', status, f'{dpi:.1f} dpi at {width_mm:g} mm', req))
    else:
        items.append(item('dpi', 'not-measured', 'Vector container; embedded raster resolution not measured' if ext in VECTOR else None))
    required_font = profile['minFontPt'] if profile else None
    font_status = 'not-measured' if min_font is None else 'fail' if required_font and min_font + .01 < required_font else 'warn' if partial or not required_font else 'ok'
    font_note = f'{min_font:.2f} pt' if min_font is not None else None
    if font_note and ext in RASTER: font_note += ' (plot metadata; not OCR)'
    if font_note and partial: font_note += ' (partial measurement)'
    items.append(item('min-font', font_status, font_note, f'{required_font:g} pt' if required_font else None))
    items.append(item('fonts-embedded', 'ok' if embedded is True else 'warn' if embedded is False else 'not-measured',
                      'Embedded font programs' if embedded is True else 'Live fonts not embedded' if embedded is False else None))
    fmt = {'.jpg': 'jpeg', '.tif': 'tiff'}.get(ext, ext[1:])
    allowed = profile['formats']['raster' if ext in RASTER else 'vector'] if profile else []
    allowed = [{'jpg': 'jpeg', 'tif': 'tiff'}.get(v.lower().lstrip('.'), v.lower().lstrip('.')) for v in allowed]
    # Profiles include preferred/non-exhaustive formats (e.g. JGSK recommends JPG).
    # Absence is not a verified prohibition: warn rather than inventing one.
    items.append(item('format', 'ok' if fmt in allowed else 'warn' if allowed else 'not-measured', fmt.upper(), ', '.join(allowed) or None))
    ramp = rgb is not None and rainbow_ramp(rgb, np)
    items.append(item('colour-map', 'warn' if ramp else 'not-measured',
                      'Rainbow/jet-like hue ramp (heuristic)' if ramp else 'No hue-ramp lead in sampled pixels; palette not identified' if rgb is not None else None))
    out.parent.mkdir(parents=True, exist_ok=True)
    if rgb is not None: cvd = previews(rgb, out, sha, np, Image)
    items.append(item('cvd', 'warn' if cvd else 'not-measured', 'Three simulated previews; inspect manually' if cvd else 'Vector rendering unavailable; check the raster companion'))
    items += [item('axis-units', 'not-measured'), item('panel-labels', 'not-measured')]
    kind = args.kind
    if args.use == 'graphical-abstract' and kind in ('ai-picture', 'ai-graphical-abstract', 'image-edit'):
        kind = 'ai-graphical-abstract'
    policy = profile['aiPolicy'].get(kind, 'unknown') if profile else 'unknown'
    items.append(item('ai-policy', {'allowed': 'ok', 'disclose': 'warn', 'permission': 'warn', 'forbidden': 'fail', 'unknown': 'not-measured'}[policy],
                      policy, 'Disclosure locations (depend on use): ' + ', '.join(profile['aiDisclosure']) if profile and policy == 'disclose' else None))
    result = dict(schema='gaid-figure-check/v1', sha256=sha, path=relative(file), checkedAt=datetime.now(timezone.utc).isoformat(),
                  target=dict(journalId=profile['id'], width=args.width or '', widthMm=width_mm) if profile else None,
                  rulesCheckedAt=profile['rulesCheckedAt'] if profile else None, kind=kind, items=items, cvdPreviews=cvd)
    atomic_write(out, result)
    return result


def main(argv=None):
    try:
        parser = Parser(description=__doc__)
        parser.add_argument('figure')
        parser.add_argument('--journals', required=True)
        parser.add_argument('--journal')
        parser.add_argument('--width')
        parser.add_argument('--kind', choices=KINDS, default='unknown')
        parser.add_argument('--use', choices=('figure', 'graphical-abstract'), default='figure')
        parser.add_argument('--artwork', choices=('photo', 'combination', 'lineArt'), help='Optional explicit resolution class; never inferred from the figure kind')
        parser.add_argument('--out', help='Defaults to .kady/geo/figure-checks/<sha256>.json')
        args = parser.parse_args(argv)
        result = check(args)
        destination = Path(args.out) if args.out else Path('.kady/geo/figure-checks') / f"{result['sha256']}.json"
        print(json.dumps(dict(out=relative(destination), sha256=result['sha256'])))
        return 0  # fail findings are valid results, not execution errors
    except ImportError as error:
        print(f'Missing dependency: {error}', file=sys.stderr); return 3
    except FileNotFoundError as error:
        print(f'Not found: {error}', file=sys.stderr); return 4
    except (ValueError, KeyError, TypeError, ET.ParseError) as error:
        print(f'Bad value: {error}', file=sys.stderr); return 5
    except Exception as error:
        print(f'Figure check failed: {error}', file=sys.stderr); return 1


if __name__ == '__main__':
    raise SystemExit(main())

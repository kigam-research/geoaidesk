"""Bounded local map IO. One JSON request on stdin, one JSON response on stdout.

Display samples are never analytical input. Dependencies come from helpers/pyproject.toml.
GDAL drivers can do internal IO, but arrays/geometry/output allocated here are bounded.
"""
import base64
import hashlib
import io
import json
import math
import os
from pathlib import Path
import sqlite3
import sys
import time
import warnings

warnings.filterwarnings('ignore', category=UserWarning)
try:
    import numpy as np
    import pyogrio
    from pyogrio import raw
    from pyproj import CRS, Transformer
    from pyproj.exceptions import ProjError
    import rasterio
    from rasterio.enums import ColorInterp, Resampling
    import rasterio.shutil
    from rasterio.warp import calculate_default_transform
    from rasterio.transform import from_bounds
    from rasterio.vrt import WarpedVRT
    from rasterio.windows import Window
    import shapely
    from shapely.errors import GEOSException
    from shapely.geometry import mapping, MultiPolygon
    from shapely.geometry.polygon import orient
    from shapely.ops import transform as transform_geometry
    from PIL import Image
    import tifffile
except ImportError as exc:
    print(f'Map helper dependency missing: {exc.name}', file=sys.stderr)
    sys.exit(3)

MAX_FEATURES = 100000
MAX_VERTICES = 30000
FULL_FEATURES = 20000
FULL_VERTICES = 400000
MAX_WKB = 2 * 1024 * 1024
TILE_LIMIT = 512
STYLE_SAMPLE = 1024
OVERVIEW_THRESHOLD = 2048
START = time.monotonic()
BUDGET = 17


def check_time():
    if time.monotonic() - START > BUDGET:
        raise ValueError('Map operation exceeded its time budget')


def issue(code, message, severity='warning', **kwargs):
    return dict(code=code, message=message, severity=severity, **kwargs)


CRS_INFO = {}


def crs_info(value):
    """Cached: an EPSG lookup for a WKT-only .prj (to_authority) takes ~0.3 s."""
    if not value:
        return {'status': 'unknown'}
    key = value.to_wkt() if isinstance(value, CRS) else str(value)
    if key not in CRS_INFO:
        if len(CRS_INFO) > 256:
            CRS_INFO.clear()
        CRS_INFO[key] = describe_crs(value)
    return dict(CRS_INFO[key])


def describe_crs(value):
    crs = CRS.from_user_input(value)
    result = {'status': 'declared', 'name': crs.name, 'wkt': crs.to_wkt(),
              'axisUnits': ', '.join(dict.fromkeys(a.unit_name for a in crs.axis_info))}
    authority = crs.to_authority()
    if authority:
        result['authority'] = ':'.join(authority)
    result['projected'] = bool(crs.is_projected)
    try:
        result['proj4'] = crs.to_proj4()
    except ProjError:
        pass
    return result


def finite_bounds(value):
    if value is None or len(value) != 4 or not all(math.isfinite(float(v)) for v in value):
        return None
    return [float(v) for v in value]


def bbox_request(req):
    if 'bbox' not in req:
        return None
    bounds = finite_bounds(req['bbox'])
    if not bounds or bounds[0] >= bounds[2] or bounds[1] >= bounds[3]:
        raise ValueError('bbox must contain four finite ordered coordinates')
    return bounds


def integer(req, key, default, low, high, clamp=True):
    value = req.get(key, default)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or int(value) != value or value < low:
        raise ValueError(f'{key} must be an integer >= {low}')
    if value > high and not clamp:
        raise ValueError(f'{key} must be <= {high}')
    return min(int(value), high)


def scalar(value, issues=None):
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, bool):
        # MapLegendItem.value and area classes accept string/number/null,
        # not booleans. Keep the same representation in attributes and legends.
        return 'true' if value else 'false'
    if value is None or isinstance(value, int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    value = str(value)
    if len(value) > 512:
        if issues is not None and not any(i['code'] == 'attribute-truncated' for i in issues):
            issues.append(issue('attribute-truncated', 'Attribute text is limited to 512 characters.'))
        return value[:512]
    return value


def color(value):
    digest = hashlib.sha256(json.dumps(value, sort_keys=True).encode()).digest()
    return '#' + ''.join(f'{64 + b % 160:02x}' for b in digest[:3])


def categorical_legend(values, issues):
    unique = {}
    for value in values:
        key = json.dumps(value, sort_keys=True)
        unique[key] = value
        if len(unique) > 128:
            raise ValueError('Categorical preview exceeds 128 classes; select a smaller window')
    return [dict(label=str(v) if v is not None else 'NULL', value=v, color=color(v))
            for _, v in sorted(unique.items())]


def display_info(req, source):
    display = req.get('displayCrs') or ('EPSG:3857' if source else 'native')
    if display == 'native':
        return display, None
    if not source:
        raise ValueError('Missing source CRS: only native display is available')
    target = CRS.from_user_input(display)
    return display, target


def companions(path):
    issues, missing = [], []
    if path.suffix.lower() != '.shp':
        return issues, missing
    names = {p.name.lower(): p for p in path.parent.iterdir()}
    for ext in ('.shx', '.dbf', '.prj'):
        name = path.stem + ext
        if name.lower() not in names:
            missing.append(name)
            issues.append(issue('missing-' + ext[1:], f'Missing Shapefile companion {name}',
                                'warning' if ext == '.prj' else 'error'))
    if (path.stem + '.cpg').lower() not in names:
        issues.append(issue('encoding-undeclared', 'No .cpg encoding declaration; GDAL uses DBF metadata/defaults.', 'info'))
    return issues, missing


VECTOR_METADATA = {}


def vector_metadata(path):
    """Cached per source identity (primary + companions) in a long-lived worker."""
    names = sorted(p for p in path.parent.iterdir() if p.stem.lower() == path.stem.lower())
    key = (str(path), tuple((p.name, p.stat().st_mtime_ns, p.stat().st_size) for p in names if p.is_file()))
    if key not in VECTOR_METADATA:
        if len(VECTOR_METADATA) > 64:
            VECTOR_METADATA.clear()
        VECTOR_METADATA[key] = read_vector_metadata(path)
    infos, issues, missing = VECTOR_METADATA[key]
    return infos, [dict(i) for i in issues], list(missing)


def read_vector_metadata(path):
    issues, missing = companions(path)
    if path.suffix.lower() == '.geojson':
        issues.append(issue('geojson-coordinate-interpretation',
                            'GeoJSON uses the CRS reported by GDAL; RFC 7946 coordinates are longitude, latitude in WGS 84. Legacy CRS declarations are retained.', 'info'))
    if any(i['severity'] == 'error' for i in issues):
        return [], issues, missing
    inventory = pyogrio.list_layers(path)
    if len(inventory) > 128:
        raise ValueError('Dataset exceeds 128 layers')
    infos = []
    for name, geometry_type in inventory:
        check_time()
        if geometry_type is None:
            issues.append(issue('unsupported-table', f'Nonspatial table {name} is not a vector map layer.', 'info'))
            continue
        info = pyogrio.read_info(path, layer=name, force_feature_count=False, force_total_bounds=False)
        if len(info['fields']) > 256:
            raise ValueError('Layer exceeds 256 fields')
        infos.append(info)
    if any(info['driver'] in ('GeoJSON', 'GeoJSONSeq') for info in infos) and not any(i['code'] == 'geojson-coordinate-interpretation' for i in issues):
        issues.append(issue('geojson-coordinate-interpretation',
                            'GDAL recognizes GeoJSON: RFC 7946 coordinates are longitude, latitude in WGS 84; legacy source CRS declarations are retained.', 'info'))
    if path.suffix.lower() == '.gpkg':
        # Read only the container inventory, never scan user tables or raster tiles.
        with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as db:
            for name, kind in db.execute('SELECT table_name,data_type FROM gpkg_contents LIMIT 129'):
                if kind not in ('features', 'attributes'):
                    issues.append(issue('unsupported-gpkg-content', f'GeoPackage content {name} ({kind}) is not supported.', 'info'))
    return infos, issues, missing


def choose_layer(req, infos, issues):
    if any(i['severity'] == 'error' for i in issues):
        raise ValueError('Required Shapefile companions are missing')
    if not infos:
        raise ValueError('No supported spatial vector layers')
    name = req.get('layer')
    if name is None and len(infos) != 1:
        raise ValueError('Select a layer from this multi-layer dataset')
    info = next((i for i in infos if name is None or i['layer_name'] == name), None)
    if info is None:
        raise ValueError('Selected vector layer does not exist')
    return info


def inspect_vector(path):
    infos, issues, missing = vector_metadata(path)
    layers = []
    for info in infos:
        source = info['crs']
        if not source:
            issues.append(issue('crs-unknown', f'CRS is unknown for {info["layer_name"]}.', requiredInput='Source CRS'))
        layer = dict(name=info['layer_name'], geometryType=info['geometry_type'], crs=crs_info(source),
                     fields=[dict(name=n, type=str(t)) for n, t in zip(info['fields'], info['dtypes'])],
                     extent=dict(coordinateSpace='crs' if source else 'native'))
        bounds = finite_bounds(info.get('total_bounds'))
        if bounds:
            layer['extent']['bbox'] = bounds
        if info['features'] >= 0:
            layer['featureCount'] = int(info['features'])
        layers.append(layer)
    result = dict(layers=layers, issues=issues, missingCompanions=missing,
                  preview=dict(sampled=False, truncated=False, method='metadata-only; no full-layer scan'))
    if len(layers) == 1:
        result.update(crs=layers[0]['crs'], extent=layers[0]['extent'])
    return result


def read_batch(path, info, offset, limit, bbox=None, columns=None):
    check_time()
    return raw.read(path, layer=info['layer_name'], skip_features=offset, max_features=limit,
                    bbox=bbox, columns=columns, return_fids=True, force_2d=True)


def geometry(wkb, vertex_limit):
    if wkb is None:
        return None
    if len(wkb) > MAX_WKB:
        raise ValueError('Feature geometry exceeds the bounded WKB limit')
    geom = shapely.from_wkb(wkb)
    if shapely.get_num_coordinates(geom) > vertex_limit:
        raise ValueError('Feature geometry exceeds the vertex limit; prepare a simplified display layer')
    if not np.isfinite(shapely.get_coordinates(geom)).all():
        raise ValueError('Geometry contains nonfinite coordinates')
    return geom


def vector_page(path, req):
    infos, issues, _ = vector_metadata(path)
    info = choose_layer(req, infos, issues)
    source = CRS.from_user_input(info['crs']) if info['crs'] else None
    display, target = display_info(req, source)
    bounds = bbox_request(req)
    filter_bounds = bounds
    to_display = None
    if target and source != target:
        to_display = transformer(source, target)
        if bounds:
            filter_bounds = transformer(target, source).transform_bounds(*bounds, densify_pts=21)
            if not finite_bounds(filter_bounds):
                raise ValueError('Viewport cannot be transformed to the source CRS')
            if filter_bounds[0] > filter_bounds[2]:
                raise ValueError('Antimeridian viewport must be split into separate requests')
    full = bool(req.get('full'))
    if full and bounds is not None:
        raise ValueError('A full-layer display request has no bbox')
    limit = integer(req, 'limit', 200, 1, FULL_FEATURES if full else 500)
    offset = 0 if full else integer(req, 'offset', 0, 0, 100000, clamp=False)
    vertex_budget = FULL_VERTICES if full else MAX_VERTICES
    fields = list(info['fields'])[:64]
    variable = req.get('variable')
    if variable is not None and variable not in info['fields']:
        raise ValueError('Selected variable is not a layer field')
    if variable and variable not in fields:
        fields[-1] = variable
    if len(info['fields']) > len(fields):
        issues.append(issue('fields-truncated', 'Only 64 selected attribute fields are displayed.'))
    # The layer CRS comes from cached metadata; skip GDAL's per-open .prj EPSG matching (~0.15 s) for this read.
    pyogrio.set_gdal_config_options({'USE_OSR_FIND_MATCHES': 'NO'})
    try:
        meta, fids, wkbs, arrays = read_batch(path, info, offset, limit + 1, filter_bounds, fields)
    finally:
        pyogrio.set_gdal_config_options({'USE_OSR_FIND_MATCHES': None})
    more = len(fids) > limit
    features, vertices, class_values, extents = [], 0, [], []
    for index, fid in enumerate(fids[:limit]):
        check_time()
        geom = geometry(wkbs[index], 200000 if full else 10000)
        if geom is not None:
            vertices += shapely.get_num_coordinates(geom)
            if vertices > vertex_budget:
                if full:
                    # Too heavy for client-side display: the viewer switches to viewport pages.
                    more = True
                    break
                raise ValueError('Page exceeds 30000 vertices; request fewer features')
            if to_display:
                geom = transform_geometry(to_display.transform, geom)
            if not np.isfinite(shapely.get_coordinates(geom)).all():
                raise ValueError('Geometry cannot be transformed to the display CRS')
            if not geom.is_empty:
                extents.append(geom.bounds)
        properties = {str(name): scalar(values[index], issues) for name, values in zip(meta['fields'], arrays)}
        features.append(dict(type='Feature', id=int(fid), geometry=mapping(geom) if geom is not None else None, properties=properties))
        if variable:
            class_values.append(properties[variable])
    if bounds is None:
        if extents:
            bounds = [min(b[0] for b in extents), min(b[1] for b in extents), max(b[2] for b in extents), max(b[3] for b in extents)]
        else:
            bounds = [0, 0, 0, 0]
    total = int(info['features'])
    method = 'whole layer for display; no geometry simplification' if full else 'viewport-filtered paginated features; no geometry simplification'
    preview = dict(sampled=bool('bbox' in req or more or offset or total < 0 or total > len(features)),
                   truncated=more, method=method, displayedFeatures=len(features))
    if total >= 0:
        preview['totalFeatures'] = total
    if not source:
        issues.append(issue('crs-unknown', 'Native coordinates only; geographic overlay and area are unavailable.'))
    if more and offset + len(features) > 100000:
        issues.append(issue('offset-limit', 'Pagination reached the 100000 offset limit; narrow the viewport.'))
    return dict(kind='vector', path=str(path), layer=info['layer_name'], sourceCrs=crs_info(source), displayCrs=display,
                bbox=bounds, issues=issues, preview=preview, legend=categorical_legend(class_values, issues), nodata=None,
                features=dict(type='FeatureCollection', features=features), fields=fields,
                nextOffset=offset + len(features) if more and offset + len(features) <= 100000 else None, full=full and not more)


def raster_metadata(src):
    # Identity is a valid affine: distinguish explicit GeoTIFF tags from an
    # ordinary image's default identity transform. Header-only, never asarray().
    with tifffile.TiffFile(src.name) as tif:
        affine_tags = any(tag in tif.pages[0].tags for tag in (33550, 33922, 34264))
    georeferenced = bool(src.crs or affine_tags or src.gcps[0])
    issues = []
    if not src.crs:
        issues.append(issue('crs-unknown', 'Source CRS is unknown; use native/pixel coordinates.', requiredInput='Source CRS'))
    if src.gcps[0] and src.transform == rasterio.Affine.identity():
        issues.append(issue('gcp-only', 'Ground control points are not applied; native pixel inspection only.'))
    if src.count > 256:
        raise ValueError('Raster exceeds 256 bands')
    return dict(asset=dict(format='geotiff' if georeferenced else 'tiff'), crs=crs_info(src.crs),
                extent=dict(bbox=list(src.bounds), coordinateSpace='crs' if src.crs else ('native' if georeferenced and not src.gcps[0] else 'pixel')),
                bands=[dict(index=i, dtype=src.dtypes[i-1], nodata=scalar(src.nodatavals[i-1]), description=src.descriptions[i-1] or '', unit=src.units[i-1] or '') for i in src.indexes],
                dimensions=[dict(name='width', size=src.width), dict(name='height', size=src.height)], issues=issues,
                preview=dict(sampled=False, truncated=False, method='metadata-only; no statistics scan'))


def raster_window(path, req):
    width, height = integer(req, 'width', 256, 1, 256), integer(req, 'height', 256, 1, 256)
    with rasterio.Env(GDAL_CACHEMAX=32 * 1024 * 1024), rasterio.open(path) as src:
        metadata = raster_metadata(src)
        source = CRS.from_user_input(src.crs) if src.crs else None
        display, target = display_info(req, source)
        band = integer(req, 'band', 1, 1, 256, clamp=False)
        if band > src.count:
            raise ValueError('Selected band does not exist')
        bounds = bbox_request(req)
        if target:
            full = transformer(source, target).transform_bounds(*src.bounds, densify_pts=21)
            if not finite_bounds(full) or full[0] >= full[2] or full[1] >= full[3]:
                raise ValueError('Raster extent cannot be transformed to display CRS')
            bounds = intersect(bounds or full, full)
            # WarpedVRT reads source blocks lazily; never src.read() into a full-size array.
            with WarpedVRT(src, crs=target, transform=from_bounds(*bounds, width, height), width=width, height=height,
                           resampling=Resampling.nearest, warp_mem_limit=16, add_alpha=ColorInterp.alpha not in src.colorinterp) as vrt:
                data = vrt.read(band, masked=True)
                alpha_band = vrt.colorinterp.index(ColorInterp.alpha) + 1
                mask = vrt.read(alpha_band) == 0
                mask |= np.ma.getmaskarray(data)
        else:
            if src.transform.b or src.transform.d:
                raise ValueError('Rotated native rasters require a declared CRS for display')
            full = [min(src.bounds.left, src.bounds.right), min(src.bounds.bottom, src.bounds.top), max(src.bounds.left, src.bounds.right), max(src.bounds.bottom, src.bounds.top)]
            bounds = intersect(bounds or full, full)
            # from_bounds supports north-up rasters; plain TIFF identity is south-up.
            inverse = ~src.transform
            p0, p1 = inverse * (bounds[0], bounds[1]), inverse * (bounds[2], bounds[3])
            window = Window(min(p0[0], p1[0]), min(p0[1], p1[1]), abs(p1[0]-p0[0]), abs(p1[1]-p0[1]))
            data = src.read(band, window=window, out_shape=(height, width), masked=True, resampling=Resampling.nearest)
            # Display grid is always left-to-right, top-to-bottom in native coordinates.
            if src.transform.e > 0:
                data = data[::-1, :]
            if src.transform.a < 0:
                data = data[:, ::-1]
            mask = np.ma.getmaskarray(data)
        if np.iscomplexobj(data):
            raise ValueError('Complex raster bands are not supported')
        values = np.asarray(data, dtype='float64')
        mask |= ~np.isfinite(values)
        valid = values[~mask]
        issues = metadata['issues']
        legend = []
        if req.get('categorical'):
            legend = categorical_legend([scalar(v) for v in np.unique(valid)], issues)
            rgba = colorize(values, mask, legend=legend)
        elif valid.size:
            low, high = float(valid.min()), float(valid.max())
            rgba = colorize(values, mask, low=low, high=high)
            legend = [dict(label=f'Sample min: {low:g}', value=low, color=RAMP_LOW), dict(label=f'Sample max: {high:g}', value=high, color=RAMP_HIGH)]
        else:
            rgba = colorize(values, mask)
        legend.append(NODATA_LEGEND)
        png = png_bytes(rgba)
        rows = [[None if mask[y, x] else float(values[y, x]) for x in range(width)] for y in range(height)]
        return dict(kind='raster', path=str(path), band=band, sourceCrs=crs_info(source), displayCrs=display,
                    bbox=bounds, issues=issues, preview=dict(sampled=True, truncated=False, method='bounded window/overview; nearest-neighbor display samples',
                    width=width, height=height, resolution=f'{(bounds[2]-bounds[0])/width:g} × {(bounds[3]-bounds[1])/height:g} display units/pixel'),
                    legend=legend, nodata=scalar(src.nodatavals[band-1]), values=rows,
                    image='data:image/png;base64,' + base64.b64encode(png).decode())


RAMP_LOW, RAMP_HIGH = '#1e46b4', '#e6dc28'
NODATA_LEGEND = dict(label='Nodata / mask (transparent)', value=None, color='#80808000')


def colorize(values, mask, legend=None, low=None, high=None):
    """RGBA display colours. Continuous: fixed low/high ramp. Categorical: per-class hash colours."""
    rgba = np.zeros(values.shape + (4,), dtype='uint8')
    rgba[:, :, :] = (128, 128, 128, 0)
    if legend is not None:
        for entry in legend:
            if entry['value'] is None:
                continue
            rgb = tuple(bytes.fromhex(entry['color'][1:]))
            rgba[(values == entry['value']) & ~mask] = (*rgb, 255)
    elif low is not None and high is not None:
        scaled = np.clip((np.where(mask, low, values) - low) / ((high - low) or 1), 0, 1)
        rgba[:, :, 0] = (30 + 200 * scaled).astype('uint8')
        rgba[:, :, 1] = (70 + 150 * scaled).astype('uint8')
        rgba[:, :, 2] = (180 - 140 * scaled).astype('uint8')
        rgba[:, :, 3] = np.where(mask, 0, 255)
    return rgba


def png_bytes(rgba):
    png = io.BytesIO()
    Image.fromarray(rgba).save(png, format='PNG', compress_level=1)
    return png.getvalue()


# Long-lived workers keep datasets open between tiles. Keyed by identity so an
# edited file is reopened, never served from a stale handle.
DATASETS = {}
NATIVE_RES = {}


def open_raster(path, overview_level=None):
    stat = path.stat()
    key = (str(path), stat.st_mtime_ns, stat.st_size, overview_level)
    src = DATASETS.pop(key, None)
    if src is None or src.closed:
        src = rasterio.open(path, overview_level=overview_level) if overview_level is not None else rasterio.open(path)
    DATASETS[key] = src
    while len(DATASETS) > 24:
        DATASETS.pop(next(iter(DATASETS))).close()
    return src


def overview_cache(path):
    """Display-only overview VRT for a large raster without overviews; the source is never modified."""
    root = os.environ.get('GAID_MAP_CACHE_DIR')
    if not root:
        return None
    stat = path.resolve().stat()
    key = hashlib.sha256(f'{path.resolve()}|{stat.st_mtime_ns}|{stat.st_size}|ovr-v1'.encode()).hexdigest()[:32]
    return Path(root) / f'{key}.vrt'


def needs_overviews(src):
    return max(src.width, src.height) > OVERVIEW_THRESHOLD and not src.overviews(1)


def display_path(path, prepare=False):
    """Path tiles read from: the source, or its cached overview VRT once prepared."""
    src = open_raster(path)
    if not needs_overviews(src):
        return path, False
    vrt = overview_cache(path)
    if vrt is None:
        return path, False
    if vrt.exists():
        return vrt, True
    if not prepare:
        return path, False
    vrt.parent.mkdir(parents=True, exist_ok=True)
    tmp = vrt.with_name(f'{vrt.stem}.{os.getpid()}.tmp.vrt')
    factors, size = [], max(src.width, src.height)
    while size / (2 ** len(factors)) > 256:
        factors.append(2 ** (len(factors) + 1))
    with rasterio.Env(COMPRESS_OVERVIEW='DEFLATE', GDAL_NUM_THREADS='2'):
        rasterio.shutil.copy(src, tmp, driver='VRT')
        with rasterio.open(tmp, 'r+') as dst:
            dst.build_overviews(factors, Resampling.nearest)
    # The overview file name follows the VRT name; publish the VRT last.
    os.replace(f'{tmp}.ovr', f'{vrt}.ovr')
    os.replace(tmp, vrt)
    return vrt, True


FULL_BOUNDS = {}
TRANSFORMERS = {}


def transformer(source, target):
    """pyproj builds a transformer in ~75 ms; workers reuse them across tiles."""
    key = (source.to_wkt(), target.to_wkt())
    if key not in TRANSFORMERS:
        if len(TRANSFORMERS) > 64:
            TRANSFORMERS.clear()
        TRANSFORMERS[key] = Transformer.from_crs(source, target, always_xy=True)
    return TRANSFORMERS[key]


def full_display_bounds(src, target):
    key = (src.name, tuple(src.bounds), str(target))
    if key not in FULL_BOUNDS:
        if len(FULL_BOUNDS) > 256:
            FULL_BOUNDS.clear()
        FULL_BOUNDS[key] = compute_display_bounds(src, target)
    return list(FULL_BOUNDS[key])


def compute_display_bounds(src, target):
    if target is None:
        if src.transform.b or src.transform.d:
            raise ValueError('Rotated native rasters require a declared CRS for display')
        return [min(src.bounds.left, src.bounds.right), min(src.bounds.bottom, src.bounds.top), max(src.bounds.left, src.bounds.right), max(src.bounds.bottom, src.bounds.top)]
    full = transformer(CRS.from_user_input(src.crs), target).transform_bounds(*src.bounds, densify_pts=21)
    if not finite_bounds(full) or full[0] >= full[2] or full[1] >= full[3]:
        raise ValueError('Raster extent cannot be transformed to display CRS')
    return list(full)


def native_resolution(path, src, target):
    """Source pixel size in display units (cached per worker)."""
    if target is None:
        return float(max(abs(src.transform.a), abs(src.transform.e)))
    key = (str(path), str(target))
    if key not in NATIVE_RES:
        transform, _, _ = calculate_default_transform(src.crs, target, src.width, src.height, *src.bounds)
        NATIVE_RES[key] = float(abs(transform.a))
    return NATIVE_RES[key]


def raster_band(req, src):
    band = integer(req, 'band', 1, 1, 256, clamp=False)
    if band > src.count:
        raise ValueError('Selected band does not exist')
    return band


def raster_style(path, req):
    """Whole-raster display stretch/classes from an overview-sized sample, shared by every tile."""
    src = open_raster(path)
    metadata = raster_metadata(src)
    source = CRS.from_user_input(src.crs) if src.crs else None
    display, target = display_info(req, source)
    band = raster_band(req, src)
    full = full_display_bounds(src, target)
    view, prepared = display_path(path, prepare=bool(req.get('prepare')))
    sample = open_raster(view)
    scale = max(sample.width, sample.height) / STYLE_SAMPLE
    shape = (max(1, math.ceil(sample.height / scale)), max(1, math.ceil(sample.width / scale))) if scale > 1 else (sample.height, sample.width)
    data = sample.read(band, out_shape=shape, masked=True, resampling=Resampling.nearest)
    if np.iscomplexobj(data):
        raise ValueError('Complex raster bands are not supported')
    values = np.asarray(data, dtype='float64')
    mask = np.ma.getmaskarray(data) | ~np.isfinite(values)
    valid = values[~mask]
    issues = metadata['issues']
    result = dict(kind='raster-style', path=str(path), band=band, sourceCrs=crs_info(source), displayCrs=display, bbox=full,
                  resolution=native_resolution(path, src, target),
                  issues=issues, nodata=scalar(src.nodatavals[band-1]), categorical=bool(req.get('categorical')),
                  overviews=bool(src.overviews(band)) or prepared, needsOverviews=needs_overviews(src) and not prepared,
                  preview=dict(sampled=True, truncated=False, width=src.width, height=src.height,
                               method=f'display tiles; nearest-neighbor samples; colour range from a {shape[1]}×{shape[0]} overview sample'))
    if req.get('categorical'):
        result['legend'] = categorical_legend([scalar(v) for v in np.unique(valid)], issues) + [NODATA_LEGEND]
    elif valid.size:
        low, high = (float(v) for v in np.percentile(valid, [2, 98]))
        if not low < high:
            low, high = float(valid.min()), float(valid.max())
        result.update(low=low, high=high, min=float(valid.min()), max=float(valid.max()))
        result['legend'] = [dict(label=f'≤ {low:g} (2nd percentile)', value=low, color=RAMP_LOW),
                            dict(label=f'≥ {high:g} (98th percentile)', value=high, color=RAMP_HIGH), NODATA_LEGEND]
    else:
        result['legend'] = [NODATA_LEGEND]
    return result


def tile_bounds(req):
    bounds = bbox_request(req)
    if bounds is None:
        raise ValueError('A tile bbox is required')
    return bounds


def raster_tile(path, req):
    """One display tile (PNG) for an exact bbox in display CRS; areas outside the raster are transparent."""
    size = integer(req, 'size', 256, 16, TILE_LIMIT)
    src = open_raster(path)
    source = CRS.from_user_input(src.crs) if src.crs else None
    display, target = display_info(req, source)
    band = raster_band(req, src)
    bounds = tile_bounds(req)
    full = full_display_bounds(src, target)
    values = np.zeros((size, size), dtype='float64')
    mask = np.ones((size, size), dtype=bool)
    hit = [max(bounds[0], full[0]), max(bounds[1], full[1]), min(bounds[2], full[2]), min(bounds[3], full[3])]
    if hit[0] < hit[2] and hit[1] < hit[3]:
        view, _ = display_path(path)
        if target is not None:
            # Choose the coarsest overview that is still at least as fine as the tile.
            factor = (bounds[2] - bounds[0]) / size / native_resolution(path, src, target)
            base = open_raster(view)
            level = None
            for index, decimation in enumerate(base.overviews(band)):
                if decimation <= factor:
                    level = index
            reader = open_raster(view, level) if level is not None else base
            with WarpedVRT(reader, crs=target, transform=from_bounds(*bounds, size, size), width=size, height=size,
                           resampling=Resampling.nearest, warp_mem_limit=32, add_alpha=ColorInterp.alpha not in reader.colorinterp) as vrt:
                data = vrt.read(band, masked=True)
                alpha = vrt.read(vrt.colorinterp.index(ColorInterp.alpha) + 1) == 0
            if np.iscomplexobj(data):
                raise ValueError('Complex raster bands are not supported')
            values = np.asarray(data, dtype='float64')
            mask = alpha | np.ma.getmaskarray(data)
        else:
            res_x, res_y = (bounds[2] - bounds[0]) / size, (bounds[3] - bounds[1]) / size
            col0, col1 = round((hit[0] - bounds[0]) / res_x), round((hit[2] - bounds[0]) / res_x)
            row0, row1 = round((bounds[3] - hit[3]) / res_y), round((bounds[3] - hit[1]) / res_y)
            if col1 > col0 and row1 > row0:
                reader = open_raster(view)
                inverse = ~src.transform
                p0, p1 = inverse * (hit[0], hit[1]), inverse * (hit[2], hit[3])
                window = Window(min(p0[0], p1[0]), min(p0[1], p1[1]), abs(p1[0]-p0[0]), abs(p1[1]-p0[1]))
                data = reader.read(band, window=window, out_shape=(row1 - row0, col1 - col0), masked=True, resampling=Resampling.nearest)
                if np.iscomplexobj(data):
                    raise ValueError('Complex raster bands are not supported')
                if src.transform.e > 0:
                    data = data[::-1, :]
                if src.transform.a < 0:
                    data = data[:, ::-1]
                values[row0:row1, col0:col1] = np.asarray(data, dtype='float64')
                mask[row0:row1, col0:col1] = np.ma.getmaskarray(data)
    mask |= ~np.isfinite(values)
    if req.get('categorical'):
        classes = np.unique(values[~mask])
        if classes.size > 1024:
            raise ValueError('Categorical tile exceeds 1024 classes; turn off categorical display')
        rgba = colorize(values, mask, legend=[dict(value=scalar(v), color=color(scalar(v))) for v in classes])
    else:
        low, high = req.get('low'), req.get('high')
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in (low, high)):
            raise ValueError('Continuous tiles require finite low/high from the raster style')
        rgba = colorize(values, mask, low=float(low), high=float(high))
    return dict(kind='raster-tile', empty=bool(mask.all()), png=base64.b64encode(png_bytes(rgba)).decode())


def raster_point(path, req):
    """The source pixel value under a display coordinate, read from the original file at full resolution."""
    src = open_raster(path)
    source = CRS.from_user_input(src.crs) if src.crs else None
    _, target = display_info(req, source)
    band = raster_band(req, src)
    point = req.get('coordinate')
    if not isinstance(point, list) or len(point) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point):
        raise ValueError('coordinate must be two finite numbers')
    x, y = point
    if target is not None:
        x, y = transformer(target, source).transform(x, y)
    col, row = (~src.transform) * (x, y)
    col, row = math.floor(col), math.floor(row)
    if not (0 <= col < src.width and 0 <= row < src.height):
        return dict(kind='raster-point', band=band, inside=False)
    data = src.read(band, window=Window(col, row, 1, 1), masked=True)
    value = None if np.ma.getmaskarray(data)[0, 0] else scalar(data[0, 0])
    if isinstance(value, float) and not math.isfinite(value):
        value = None
    return dict(kind='raster-point', band=band, inside=True, row=row, col=col, value=value, sourceCoordinate=[x, y])


def intersect(bounds, full):
    result = [max(bounds[0], full[0]), max(bounds[1], full[1]), min(bounds[2], full[2]), min(bounds[3], full[3])]
    if result[0] >= result[2] or result[1] >= result[3]:
        raise ValueError('Viewport does not intersect raster extent')
    return result


def area_table(path, req):
    infos, issues, _ = vector_metadata(path)
    info = choose_layer(req, infos, issues)
    if not info['crs']:
        raise ValueError('Area requires a declared source CRS')
    if req.get('classField') not in info['fields']:
        raise ValueError('classField must name a layer attribute')
    if info['features'] > MAX_FEATURES:
        raise ValueError('Full-layer area exceeds 100000 features; no subset was calculated')
    source, method = CRS.from_user_input(info['crs']), req.get('method')
    limitations = ['Overlapping features are counted separately; percentages use the summed feature-area denominator.',
                   'Empty geometries are counted but excluded from area rows; geometries are not repaired.']
    factor = 1
    if method == 'projected':
        if not req.get('areaCrs'):
            raise ValueError('Projected area requires an explicit areaCrs')
        target = CRS.from_user_input(req['areaCrs'])
        if not target.is_projected or len(target.axis_info) < 2 or not all(a.unit_conversion_factor and math.isfinite(a.unit_conversion_factor) for a in target.axis_info[:2]):
            raise ValueError('areaCrs must be a projected CRS with linear units')
        factor = target.axis_info[0].unit_conversion_factor * target.axis_info[1].unit_conversion_factor
        limitations.append('Planar area uses the chosen projection; projection distortion is not corrected.')
    elif method == 'geodesic':
        target = source.geodetic_crs
        if target is None:
            raise ValueError('Source datum has no usable geodetic CRS')
        geod = source.get_geod()
        limitations.append(f'Ellipsoidal area on source datum: {source.ellipsoid.name}; polygons spanning >180° longitude are rejected.')
    else:
        raise ValueError('Area method must be projected or geodesic')
    to_area = transformer(source, target)
    rows, count, empty, vertices = {}, 0, 0, 0
    while True:
        meta, fids, wkbs, arrays = read_batch(path, info, count, 500, columns=[req['classField']])
        if not len(fids):
            break
        for index in range(len(fids)):
            check_time()
            count += 1
            if count > MAX_FEATURES:
                raise ValueError('Full-layer area exceeds 100000 features; no subset was calculated')
            geom = geometry(wkbs[index], 200000)
            if geom is None or geom.is_empty:
                empty += 1
                continue
            if geom.geom_type not in ('Polygon', 'MultiPolygon'):
                raise ValueError('Area requires only polygon geometries')
            if not geom.is_valid:
                raise ValueError('Area refuses invalid polygon geometry; no repair was performed')
            vertices += shapely.get_num_coordinates(geom)
            if vertices > 2000000:
                raise ValueError('Full-layer area exceeds 2000000 vertices; no subset was calculated')
            geom = transform_geometry(to_area.transform, geom)
            if not np.isfinite(shapely.get_coordinates(geom)).all() or not geom.is_valid:
                raise ValueError('Area transformation produced invalid geometry')
            if method == 'projected':
                area = geom.area * factor
            else:
                parts = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
                area = 0
                for part in parts:
                    x0, y0, x1, y1 = part.bounds
                    if x1 - x0 > 180 or y0 < -90 or y1 > 90:
                        raise ValueError('Geodesic polygon extent is ambiguous or out of range')
                    area += abs(geod.geometry_area_perimeter(orient(part, sign=1))[0])
            if not math.isfinite(area):
                raise ValueError('Calculated area is not finite')
            raw_value = arrays[0][index]
            value = scalar(raw_value)
            if raw_value is not None and isinstance(raw_value, (str, np.str_)) and len(str(raw_value)) > 512:
                raise ValueError('Area class label exceeds 512 characters; labels are not truncated')
            key = json.dumps(value, sort_keys=True)
            if key not in rows:
                if len(rows) >= 1000:
                    raise ValueError('Full-layer area exceeds 1000 classes; no subset was calculated')
                rows[key] = dict(class_=value, featureCount=0, area=0)
            rows[key]['featureCount'] += 1
            rows[key]['area'] += area
        if len(fids) < 500:
            break
    total = math.fsum(r['area'] for r in rows.values())
    output = [dict(**{'class': r['class_']}, featureCount=r['featureCount'], area=r['area'], percent=r['area']/total*100 if total else 0) for _, r in sorted(rows.items())]
    result = dict(path=str(path), layer=info['layer_name'], classField=req['classField'], method=method, unit='m²',
                  rows=output, totalArea=total, featureCount=count, emptyCount=empty, scope='full-layer', limitations=limitations)
    if method == 'projected':
        result['areaCrs'] = req['areaCrs']
    return result


def handle(req):
    if not isinstance(req, dict) or not isinstance(req.get('path'), str):
        raise ValueError('Request must provide an absolute local path')
    path = Path(req['path'])
    if not path.is_absolute():
        raise ValueError('path must be absolute')
    if not path.is_file():
        raise FileNotFoundError('Source file not found')
    if path.suffix.lower() in ('.dbf', '.shx'):
        primary = next((p for p in path.parent.iterdir() if p.stem.lower() == path.stem.lower() and p.suffix.lower() == '.shp'), None)
        if primary is None:
            raise ValueError('Selected Shapefile companion has no .shp primary')
        path = primary
    operation = req.get('operation')
    if operation == 'inspect':
        if path.suffix.lower() in ('.tif', '.tiff'):
            with rasterio.open(path) as src:
                result = raster_metadata(src)
        else:
            result = inspect_vector(path)
    elif operation == 'vector':
        result = vector_page(path, req)
    elif operation == 'raster':
        result = raster_window(path, req)
    elif operation == 'area':
        result = area_table(path, req)
    elif operation in ('raster-style', 'raster-tile', 'raster-point'):
        if path.suffix.lower() not in ('.tif', '.tiff'):
            raise ValueError('Display tiles are available for GeoTIFF rasters')
        result = {'raster-style': raster_style, 'raster-tile': raster_tile, 'raster-point': raster_point}[operation](path, req)
    else:
        raise ValueError('Unknown map operation')
    check_time()
    output = json.dumps(result, allow_nan=False, separators=(',', ':'))
    cap = 24 if req.get('full') else 7
    if len(output.encode()) > cap * 1024 * 1024:
        raise ValueError(f'Map response exceeds {cap} MiB; request a smaller page/window')
    return output


def main():
    # Bytes, decoded as UTF-8: sys.stdin uses the locale code page on Windows
    # (cp949 on Korean Windows), which garbles non-ASCII paths sent as UTF-8 JSON.
    raw = sys.stdin.buffer.read(65537)
    if len(raw) > 65536:
        raise ValueError('Request exceeds 64 KiB')
    print(handle(json.loads(raw.decode('utf-8'))))


EXPECTED_ERRORS = (ValueError, KeyError, TypeError, ProjError, GEOSException, sqlite3.DatabaseError,
                   rasterio.errors.RasterioError, pyogrio.errors.DataSourceError, pyogrio.errors.DataLayerError)


def failure(exc):
    """(exit code, message) with the one-shot exit-code contract: 4 not found, 5 bad request/source, 1 other."""
    if isinstance(exc, FileNotFoundError):
        return 4, str(exc)[:400]
    if isinstance(exc, EXPECTED_ERRORS):
        return 5, 'Invalid map request/source: ' + str(exc)[:400]
    return 1, 'Map helper failed: ' + str(exc)[:400]


def serve():
    """Long-lived worker: one JSON request per stdin line, one JSON reply per stdout line, in order."""
    global START, BUDGET
    out = sys.stdout.buffer
    with rasterio.Env(GDAL_CACHEMAX=128 * 1024 * 1024):
        out.write(b'{"ready":true}\n')
        out.flush()
        for line in sys.stdin.buffer:
            if len(line) > 65536:
                reply = dict(id=None, code=5, error='Request exceeds 64 KiB')
            else:
                req = json.loads(line.decode('utf-8'))
                START, BUDGET = time.monotonic(), float(req.pop('budget', 17))
                try:
                    reply = '{"id":%s,"result":%s}' % (json.dumps(req.get('id')), handle(req))
                except Exception as exc:
                    code, message = failure(exc)
                    reply = dict(id=req.get('id'), code=code, error=message)
            out.write((reply if isinstance(reply, str) else json.dumps(reply)).encode() + b'\n')
            out.flush()


if __name__ == '__main__':
    if sys.argv[1:] == ['--serve']:
        serve()
        sys.exit(0)
    try:
        main()
    except Exception as exc:
        code, message = failure(exc)
        print(message, file=sys.stderr)
        sys.exit(code)

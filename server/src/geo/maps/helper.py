"""Bounded local map IO. One JSON request on stdin, one JSON response on stdout.

Display samples are never analytical input. Dependencies come from helpers/pyproject.toml.
GDAL drivers can do internal IO, but arrays/geometry/output allocated here are bounded.
"""
import base64
import hashlib
import io
import json
import math
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
MAX_WKB = 2 * 1024 * 1024
START = time.monotonic()


def check_time():
    if time.monotonic() - START > 17:
        raise ValueError('Map operation exceeded its time budget')


def issue(code, message, severity='warning', **kwargs):
    return dict(code=code, message=message, severity=severity, **kwargs)


def crs_info(value):
    if not value:
        return {'status': 'unknown'}
    crs = CRS.from_user_input(value)
    result = {'status': 'declared', 'name': crs.name, 'wkt': crs.to_wkt(),
              'axisUnits': ', '.join(dict.fromkeys(a.unit_name for a in crs.axis_info))}
    authority = crs.to_authority()
    if authority:
        result['authority'] = ':'.join(authority)
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


def vector_metadata(path):
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
    transformer = None
    if target and source != target:
        transformer = Transformer.from_crs(source, target, always_xy=True)
        if bounds:
            filter_bounds = Transformer.from_crs(target, source, always_xy=True).transform_bounds(*bounds, densify_pts=21)
            if not finite_bounds(filter_bounds):
                raise ValueError('Viewport cannot be transformed to the source CRS')
            if filter_bounds[0] > filter_bounds[2]:
                raise ValueError('Antimeridian viewport must be split into separate requests')
    limit = integer(req, 'limit', 200, 1, 500)
    offset = integer(req, 'offset', 0, 0, 100000, clamp=False)
    fields = list(info['fields'])[:64]
    variable = req.get('variable')
    if variable is not None and variable not in info['fields']:
        raise ValueError('Selected variable is not a layer field')
    if variable and variable not in fields:
        fields[-1] = variable
    if len(info['fields']) > len(fields):
        issues.append(issue('fields-truncated', 'Only 64 selected attribute fields are displayed.'))
    meta, fids, wkbs, arrays = read_batch(path, info, offset, limit + 1, filter_bounds, fields)
    more = len(fids) > limit
    features, vertices, class_values, extents = [], 0, [], []
    for index, fid in enumerate(fids[:limit]):
        check_time()
        geom = geometry(wkbs[index], 10000)
        if geom is not None:
            vertices += shapely.get_num_coordinates(geom)
            if vertices > MAX_VERTICES:
                raise ValueError('Page exceeds 30000 vertices; request fewer features')
            if transformer:
                geom = transform_geometry(transformer.transform, geom)
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
    preview = dict(sampled=bool('bbox' in req or more or offset or total < 0 or total > len(features)),
                   truncated=more, method='viewport-filtered paginated features; no geometry simplification', displayedFeatures=len(features))
    if total >= 0:
        preview['totalFeatures'] = total
    if not source:
        issues.append(issue('crs-unknown', 'Native coordinates only; geographic overlay and area are unavailable.'))
    if more and offset + len(features) > 100000:
        issues.append(issue('offset-limit', 'Pagination reached the 100000 offset limit; narrow the viewport.'))
    return dict(kind='vector', path=str(path), layer=info['layer_name'], sourceCrs=crs_info(source), displayCrs=display,
                bbox=bounds, issues=issues, preview=preview, legend=categorical_legend(class_values, issues), nodata=None,
                features=dict(type='FeatureCollection', features=features), fields=fields,
                nextOffset=offset + len(features) if more and offset + len(features) <= 100000 else None)


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
            full = Transformer.from_crs(source, target, always_xy=True).transform_bounds(*src.bounds, densify_pts=21)
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
        rgba = np.zeros((height, width, 4), dtype='uint8')
        rgba[:, :, :] = (128, 128, 128, 0)
        if req.get('categorical'):
            classes = [scalar(v) for v in np.unique(valid)]
            legend = categorical_legend(classes, issues)
            for entry in legend:
                rgb = tuple(bytes.fromhex(entry['color'][1:]))
                rgba[(values == entry['value']) & ~mask] = (*rgb, 255)
        elif valid.size:
            low, high = float(valid.min()), float(valid.max())
            scaled = np.clip((values - low) / (high - low or 1), 0, 1)
            scaled[mask] = 0
            rgba[:, :, 0] = (30 + 200 * scaled).astype('uint8')
            rgba[:, :, 1] = (70 + 150 * scaled).astype('uint8')
            rgba[:, :, 2] = (180 - 140 * scaled).astype('uint8')
            rgba[:, :, 3] = np.where(mask, 0, 255)
            legend = [dict(label=f'Sample min: {low:g}', value=low, color='#1e46b4'), dict(label=f'Sample max: {high:g}', value=high, color='#e6dc28')]
        legend.append(dict(label='Nodata / mask (transparent)', value=None, color='#80808000'))
        png = io.BytesIO()
        Image.fromarray(rgba).save(png, format='PNG')
        rows = [[None if mask[y, x] else float(values[y, x]) for x in range(width)] for y in range(height)]
        return dict(kind='raster', path=str(path), band=band, sourceCrs=crs_info(source), displayCrs=display,
                    bbox=bounds, issues=issues, preview=dict(sampled=True, truncated=False, method='bounded window/overview; nearest-neighbor display samples',
                    width=width, height=height, resolution=f'{(bounds[2]-bounds[0])/width:g} × {(bounds[3]-bounds[1])/height:g} display units/pixel'),
                    legend=legend, nodata=scalar(src.nodatavals[band-1]), values=rows,
                    image='data:image/png;base64,' + base64.b64encode(png.getvalue()).decode())


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
    transformer = Transformer.from_crs(source, target, always_xy=True)
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
            geom = transform_geometry(transformer.transform, geom)
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


def main():
    # Bytes, decoded as UTF-8: sys.stdin uses the locale code page on Windows
    # (cp949 on Korean Windows), which garbles non-ASCII paths sent as UTF-8 JSON.
    raw = sys.stdin.buffer.read(65537)
    if len(raw) > 65536:
        raise ValueError('Request exceeds 64 KiB')
    req = json.loads(raw.decode('utf-8'))
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
    else:
        raise ValueError('Unknown map operation')
    check_time()
    output = json.dumps(result, allow_nan=False, separators=(',', ':'))
    if len(output.encode()) > 7 * 1024 * 1024:
        raise ValueError('Map response exceeds 7 MiB; request a smaller page/window')
    print(output)


if __name__ == '__main__':
    try:
        main()
    except FileNotFoundError as exc:
        print(str(exc)[:400], file=sys.stderr)
        sys.exit(4)
    except (ValueError, KeyError, TypeError, ProjError, GEOSException, sqlite3.DatabaseError,
            rasterio.errors.RasterioError, pyogrio.errors.DataSourceError, pyogrio.errors.DataLayerError) as exc:
        print('Invalid map request/source: ' + str(exc)[:400], file=sys.stderr)
        sys.exit(5)
    except Exception as exc:
        print('Map helper failed: ' + str(exc)[:400], file=sys.stderr)
        sys.exit(1)

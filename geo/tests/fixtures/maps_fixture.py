"""Synthetic MIT-licensed map fixtures; generated binaries stay outside the repository."""
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import warnings

import geopandas as gpd
import numpy as np
import rasterio
import tifffile
from rasterio.transform import from_origin
from shapely.geometry import Point, Polygon, box

warnings.filterwarnings('ignore', category=UserWarning)
root = Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)


def vector(name, geoms, crs, classes=None, **options):
    frame = gpd.GeoDataFrame({'class': classes or ['A'] * len(geoms), 'number': range(len(geoms))}, geometry=geoms, crs=crs)
    frame.to_file(root / name, engine='pyogrio', **options)


vector('rectangle.gpkg', [box(0, 0, 100, 100), box(100, 0, 200, 100)], 'EPSG:32631', ['A', 'B'], layer='rectangles')
vector('multi.gpkg', [Point(0, 0), Point(1, 1)], 'EPSG:4326', layer='points')
vector('multi.gpkg', [box(0, 0, 1, 1)], 'EPSG:4326', layer='polygons', append=True)
with sqlite3.connect(root / 'multi.gpkg') as db:
    db.execute('CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)')
    db.execute("INSERT INTO gpkg_contents(table_name,data_type,identifier,srs_id) VALUES ('notes','attributes','notes',0)")
    db.execute("INSERT INTO gpkg_contents(table_name,data_type,identifier,srs_id) VALUES ('unsupported_tiles','tiles','unsupported_tiles',4326)")
vector('points.geojson', [Point(0, 0), Point(1, 1)], 'EPSG:4326')
shutil.copyfile(root / 'points.geojson', root / 'points.json')
vector('geodesic.geojson', [box(0, 0, 1, 1)], 'EPSG:4326')
vector('missing.shp', [box(0, 0, 100, 100)], 'EPSG:32631')
(root / 'missing.prj').unlink()
vector('broken.shp', [Point(0, 0)], 'EPSG:4326')
(root / 'broken.shx').unlink()
(root / 'broken.dbf').unlink()
vector('invalid.gpkg', [Polygon([(0, 0), (100, 100), (100, 0), (0, 100), (0, 0)])], 'EPSG:32631')
vector('feet.gpkg', [box(0, 0, 100, 100)], 'EPSG:2227')
vector('holes.geojson', [Polygon([(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)], [[(.25, .25), (.75, .25), (.75, .75), (.25, .75), (.25, .25)]])], 'EPSG:4326')
vector('long-label.gpkg', [box(0, 0, 10, 10)], 'EPSG:32631', ['x' * 600])
vector('empty.gpkg', [box(0, 0, 10, 10), None], 'EPSG:32631')
vector('huge-geometry.gpkg', [Point(0, 0).buffer(100, quad_segs=3000)], 'EPSG:32631')
vector('paged.gpkg', [Point(i, 0) for i in range(505)], 'EPSG:32631')
vector('unknown.gpkg', [box(0, 0, 10, 10)], None)
vector('booleans.gpkg', [box(0, 0, 10, 10), box(10, 0, 20, 10)], 'EPSG:32631', [True, False])
# Driver metadata is deliberately inconsistent: this is a limit sentinel, not input to area.
shutil.copyfile(root / 'rectangle.gpkg', root / 'oversized.gpkg')
with sqlite3.connect(root / 'oversized.gpkg') as db:
    db.execute('UPDATE gpkg_ogr_contents SET feature_count=100001')

values = np.array([[1, 2, 1, 255], [2, 1, 2, 1], [1, 2, 1, 2], [2, 1, 2, 1]], dtype='uint8')
tifffile.imwrite(root / 'plain.tif', values)
tifffile.imwrite(root / 'identity-geotags.tif', values, extratags=[
    (34264, 'd', 16, (1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), False),
])
for name, crs, transform, nodata in [
    ('classes.tif', 'EPSG:32631', from_origin(0, 40, 10, 10), 255),
    ('native.tif', None, from_origin(100, 200, 10, 10), 255),
    ('geographic.tif', 'EPSG:4326', from_origin(0, 1, .25, .25), 255),
]:
    with rasterio.open(root / name, 'w', driver='GTiff', width=4, height=4, count=1, dtype='uint8', crs=crs, transform=transform, nodata=nodata) as dst:
        dst.write(values, 1)
# Explicit dataset mask: zero remains a valid low class, not nodata.
with rasterio.open(root / 'rgba.tif', 'w', driver='GTiff', width=4, height=4, count=4, dtype='uint8', crs='EPSG:32631', transform=from_origin(0, 40, 10, 10), photometric='RGB', ALPHA='YES') as dst:
    pixels = np.full((4, 4, 4), 100, dtype='uint8')
    pixels[3] = 255
    pixels[3, 0, 0] = 0
    dst.write(pixels)
    dst.colorinterp = (rasterio.enums.ColorInterp.red, rasterio.enums.ColorInterp.green, rasterio.enums.ColorInterp.blue, rasterio.enums.ColorInterp.alpha)
with rasterio.open(root / 'mask.tif', 'w', driver='GTiff', width=4, height=4, count=1, dtype='uint8', crs='EPSG:32631', transform=from_origin(0, 40, 10, 10)) as dst:
    dst.write(np.zeros((4, 4), dtype='uint8'), 1)
    mask = np.full((4, 4), 255, dtype='uint8')
    mask[0, 0] = 0
    dst.write_mask(mask)
# Blocked, non-COG source considerably larger than returned grid.
with rasterio.open(root / 'large.tif', 'w', driver='GTiff', width=4096, height=4096, count=1, dtype='uint8', crs='EPSG:32631', transform=from_origin(0, 4096, 1, 1), tiled=True, blockxsize=256, blockysize=256) as dst:
    for row in range(16):
        for col in range(16):
            dst.write(np.full((256, 256), row + col, dtype='uint8'), 1, window=rasterio.windows.Window(col * 256, row * 256, 256, 256))
print(json.dumps({'directory': str(root)}))

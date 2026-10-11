"""Small deterministic release fixtures; generated only in the run directory."""
from pathlib import Path
import sys
import geopandas as gpd
import numpy as np
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box

root = Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)
gpd.GeoDataFrame({'class': ['A', 'B']}, geometry=[box(0, 0, 100, 100), box(100, 0, 200, 100)], crs='EPSG:32631').to_file(root / 'rectangles.gpkg', layer='rectangles')
with rasterio.open(root / 'classes.tif', 'w', driver='GTiff', width=4, height=2, count=1, dtype='uint8', crs='EPSG:32631', transform=from_origin(0, 20, 10, 10), nodata=255) as dst:
    dst.write(np.array([[1, 2, 1, 255], [2, 1, 2, 1]], dtype='uint8'), 1)

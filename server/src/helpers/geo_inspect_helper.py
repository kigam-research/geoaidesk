"""Metadata only. Exit 0 ok / 3 deps missing / 4 not found / 5 bad value / 1 other.

No raster read()/vector read_dataframe(), geometry scan or feature counting.
GeoPackage queries only system metadata with row limits and a SQLite progress deadline.
"""
import argparse
import importlib
import json
import math
from pathlib import Path
import sqlite3
import sys
import time


def crs_info(value):
    if not value:
        return {"status": "unknown"}
    from pyproj import CRS
    obj = CRS.from_user_input(value)
    authority = obj.to_authority()
    result = {"status": "declared", "name": obj.name, "wkt": obj.to_wkt()[:16384]}
    if authority:
        result["authority"] = ":".join(authority)
    if obj.axis_info:
        result["axisUnits"] = obj.axis_info[0].unit_name
    return result


def summarize(file, kind, crs_file=None):
    required = ["pyproj", "pyogrio"] if kind == "geopackage" else ["pyproj"] if kind == "shapefile" else ["pyproj", "rasterio"]
    try:
        for module in required:
            importlib.import_module(module)
    except ImportError as error:
        print(f"Missing geo helper dependency: {error.name}", file=sys.stderr)
        return 3
    result = {"issues": []}
    if kind == "geopackage":
        # Never open for writing or follow SQLite journal/WAL files.
        with sqlite3.connect(file.as_uri() + "?mode=ro&immutable=1", uri=True) as db:
            deadline = time.monotonic() + 2
            db.set_progress_handler(lambda: int(time.monotonic() > deadline), 1000)
            rows = db.execute("SELECT table_name,data_type,srs_id,min_x,min_y,max_x,max_y FROM gpkg_contents LIMIT 51").fetchall()
            layers = []
            for name, dtype, srs, *bbox in rows[:50]:
                layer = {"name": str(name)[:512]}
                if dtype != "features":
                    result["issues"].append({"code": "gpkg-nonvector-layer", "severity": "info", "message": f"Layer {str(name)[:128]} is {dtype}; vector preview is not available."})
                crs = db.execute("SELECT definition FROM gpkg_spatial_ref_sys WHERE srs_id=? LIMIT 1", (srs,)).fetchone()
                layer["crs"] = crs_info(crs[0] if crs and crs[0] != "undefined" else None)
                if all(isinstance(v, (float, int)) and math.isfinite(v) for v in bbox):
                    layer["extent"] = {"bbox": bbox, "coordinateSpace": "crs" if layer["crs"]["status"] == "declared" else "native"}
                # PRAGMA's table-valued form accepts a parameter, not an SQL identifier interpolation.
                layer["fields"] = [{"name": str(n)[:256], "type": str(t)[:128]} for n, t in db.execute("SELECT name,type FROM pragma_table_info(?) LIMIT 128", (name,))]
                if dtype == "features":
                    geom = db.execute("SELECT geometry_type_name FROM gpkg_geometry_columns WHERE table_name=? LIMIT 1", (name,)).fetchone()
                    if geom:
                        layer["geometryType"] = geom[0]
                layers.append(layer)
            result["layers"] = layers
            if len(rows) > 50:
                result["issues"].append({"code": "gpkg-layers-limited", "severity": "warning", "message": "Layer list limited to 50 entries."})
    elif kind == "shapefile":
        # The server supplies the already-validated, case-insensitive PRJ companion.
        # Do not let GDAL reopen unvalidated sidecars behind the sandbox resolver.
        if not crs_file:
            raise ValueError("A validated CRS companion is required")
        with Path(crs_file).open("rb") as source:
            result["crs"] = crs_info(source.read(16384).decode("utf-8"))
    else:
        import rasterio
        with rasterio.Env(GDAL_PAM_ENABLED="NO", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_GEOREF_SOURCES="INTERNAL"):
            with rasterio.open(file) as dataset:
                result["crs"] = crs_info(dataset.crs)
    encoded = json.dumps(result, allow_nan=False)
    if len(encoded.encode()) > 128 * 1024:
        raise ValueError("Metadata exceeds output limit")
    print(encoded)
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["summarize"])
    parser.add_argument("path")
    parser.add_argument("--format", choices=["geopackage", "shapefile", "tiff", "geotiff"], required=True)
    parser.add_argument("--crs-file")
    args = parser.parse_args()
    file = Path(args.path).resolve()
    if not file.is_file():
        print("File not found", file=sys.stderr)
        return 4
    try:
        return summarize(file, args.format, args.crs_file)
    except (ValueError, sqlite3.DatabaseError) as error:
        print(str(error), file=sys.stderr)
        return 5
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

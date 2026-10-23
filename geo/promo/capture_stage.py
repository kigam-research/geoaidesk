"""Stage a legible vector overlay from prior zone results; no modelling or reclassification.

Run with the study project's already prepared environment using uv --directory <sandbox> run python <this-file>.
Writes only new priority-map outputs in that project. EPSG:3857 follows the parent's staging direction.
"""
from pathlib import Path
import json
import geopandas as gpd
import pandas as pd
from shapely.geometry import box


def main():
    root=Path.cwd()
    frames=[pd.read_csv(p) for p in sorted((root/'user_data/prior_results').glob('zone_assignments_fold_*.csv'))]
    data=pd.concat(frames,ignore_index=True)
    assert len(frames)==5 and not data['index'].duplicated().any()
    chosen=data[data.zone.isin([0,1,2])].copy()
    labels={0:'최우선 구역',1:'우선순위 구역',2:'후속 검토 구역'}
    chosen['구역']=chosen.zone.map(labels)
    geometry=[box(x-2500,y-2500,x+2500,y+2500) for x,y in zip(chosen.X,chosen.Y)]
    out=root/'outputs/yilgarn_priority_zones.gpkg'
    assert not out.exists(),out
    gdf=gpd.GeoDataFrame(chosen,geometry=geometry,crs='EPSG:3857')
    gdf.to_file(out,layer='priority_zones',driver='GPKG')
    doc={'schemaVersion':'geo-result/v1','kind':'map-layer','title':'Yilgarn 탐사 우선순위 구역',
         'layers':[{'path':'outputs/'+out.name,'layer':'priority_zones','variable':'구역','sourceCrs':'EPSG:3857','displayCrs':'EPSG:3857','unit':'기존 구역 분류','legend':[], 'nodata':None,'extent':[float(v) for v in gdf.total_bounds]}],
         'analysis':{'method':'Display-only selection of prior paper zone classes 0, 1 and 2; no retraining or reclassification','tablePath':'outputs/yilgarn_priority_zones.csv','scriptPath':'outputs/render_prior_zones.py'},
         'limitations':['EPSG:3857 assigned by staging direction; no independent CRS verification.','Classes 3 and 4 are omitted from this priority-only display, not removed from the source.']}
    (root/'outputs/yilgarn_priority_zones.geomap.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'features':len(gdf),'classes':chosen['구역'].value_counts().to_dict(),'path':str(out)},ensure_ascii=False))

if __name__=='__main__': main()

"""Independent OCP readback of the exports from check-base-controls.mjs."""
import json,zipfile,xml.etree.ElementTree as ET
from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID
reader=STEPControl_Reader();assert reader.ReadFile('/tmp/base-controls-open-both.step')==IFSelect_RetDone
assert reader.TransferRoots()>0
shape=reader.OneShape();assert BRepCheck_Analyzer(shape).IsValid()
it=TopExp_Explorer(shape,TopAbs_SOLID);count=0
while it.More():
 assert BRepCheck_Analyzer(it.Current()).IsValid();count+=1;it.Next()
assert count==5,count
with zipfile.ZipFile('/tmp/base-controls-open-both.3mf') as z:
 assert z.testzip() is None
 for name in z.namelist():
  if name.endswith(('.xml','.model','.rels')):ET.fromstring(z.read(name))
result={'pass':True,'reader':'OCP','validSTEP':True,'solids':count,'threeMFZipAndXML':True}
open('/tmp/base-controls-export-readback.json','w').write(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

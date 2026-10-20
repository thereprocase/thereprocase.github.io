"""Read weighted.step and weighted.3mf with OCP and the standard ZIP/XML readers.

Usage: Python with OCP installed, check-base-step.py <export-directory>.
The directory also contains solid-exports.json with stepNormalization volumes.
"""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID
from OCP.GProp import GProp_GProps
from OCP.BRepGProp import BRepGProp

root = Path(sys.argv[1])
data = json.loads((root / "solid-exports.json").read_text())
reader = STEPControl_Reader()
assert reader.ReadFile(str(root / "weighted.step")) == IFSelect_RetDone
reader.TransferRoots()
shape = reader.OneShape()
assert BRepCheck_Analyzer(shape).IsValid()
solids = TopExp_Explorer(shape, TopAbs_SOLID)
count = 0
while solids.More():
    assert BRepCheck_Analyzer(solids.Current()).IsValid()
    count += 1
    solids.Next()
assert count == data["helpers"] + 1
properties = GProp_GProps()
BRepGProp.VolumeProperties_s(shape, properties)
expected = sum(part["cadVolume"] for part in data["stepNormalization"])
assert abs(properties.Mass() - expected) / expected < 1e-5
with zipfile.ZipFile(root / "weighted.3mf") as archive:
    assert archive.testzip() is None
    for name in archive.namelist():
        if name.endswith((".xml", ".model", ".rels")):
            ET.fromstring(archive.read(name))
data["independentReadback"] = {
    "reader": "Open CASCADE via OCP",
    "validSTEP": True,
    "solids": count,
    "volume": properties.Mass(),
    "expectedVolume": expected,
    "threeMFZipAndXML": True,
}
(root / "solid-exports.json").write_text(json.dumps(data, indent=2) + "\n")
print(data["independentReadback"])

"""Run with FreeCAD's Python after check-reinforcement.mjs.

Set GRIDFINITY_CHECK_DIR to the generated fixture directory.
"""
import json
import os
from pathlib import Path
import FreeCAD
import Import
import Part

root = Path(os.environ["GRIDFINITY_CHECK_DIR"])
records = json.loads((root / "reinforcement.json").read_text())["tests"]
checks = []
for row in records:
    name = row["system"] + "-" + row["kind"]
    shape = Part.read(str(root / (name + ".step")))
    expected = sum(part["cadVolume"] for part in row["stepNormalization"])
    assert shape.isValid(), name
    assert len(shape.Solids) == 1 + len(row["helpers"]), name
    assert all(s.isValid() and s.isClosed() and s.Volume > 0 for s in shape.Solids), name
    assert abs(shape.Volume - expected) < expected * 1e-5, name
    checks.append({"model": name, "valid": True, "closedSolids": len(shape.Solids),
                   "volume": shape.Volume, "expectedVolume": expected})
    print(name, "PASS", flush=True)
doc = FreeCAD.newDocument("StepNames")
Import.insert(str(root / "hsw-coupon.step"), doc.Name)
labels = [o.Label for o in doc.Objects if hasattr(o, "Shape") and not o.Shape.isNull()]
assert any("Reinforcement_100pct_3p5mm" in name for name in labels), labels
(root / "cad-readback.json").write_text(json.dumps({
    "reader": "FreeCAD " + ".".join(FreeCAD.Version()[:3]),
    "models": checks, "separateProductNames": labels}, indent=2) + "\n")

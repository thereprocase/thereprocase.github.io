"""Independently inspect STEP inputs/exports with cadquery-ocp (no repairs).

Usage: python check-internet-step.py file.step [other.step ...]
"""
import json
import pathlib
import sys
from OCP.STEPControl import STEPControl_Reader
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_SOLID

results = []
for name in sys.argv[1:]:
    path = pathlib.Path(name)
    reader = STEPControl_Reader()
    reader.ReadFile(str(path))
    reader.TransferRoots()
    shape = reader.OneShape()
    explorer = TopExp_Explorer(shape, TopAbs_SOLID)
    solids = []
    while explorer.More():
        solids.append(BRepCheck_Analyzer(explorer.Current(), True).IsValid())
        explorer.Next()
    results.append({
        'file': path.name,
        'valid': BRepCheck_Analyzer(shape, True).IsValid(),
        'exactValid': BRepCheck_Analyzer(shape, True, False, True).IsValid(),
        'solidsValid': solids,
    })
print(json.dumps(results, indent=2))

"""Run with Python + OCP after make-fixtures.mjs; writes test inputs only."""
from pathlib import Path
import sys
from OCP.STEPControl import STEPControl_Reader
from OCP.IGESControl import IGESControl_Writer
from OCP.BRepTools import BRepTools
root = Path(sys.argv[1] if len(sys.argv) > 1 else 'public/converter-test-fixtures')
reader = STEPControl_Reader()
reader.ReadFile(str(root / 'part.step'))
reader.TransferRoots()
shape = reader.OneShape()
BRepTools.Write_s(shape, str(root / 'part.brep'))
writer = IGESControl_Writer()
writer.AddShape(shape)
writer.Write(str(root / 'part.iges'))

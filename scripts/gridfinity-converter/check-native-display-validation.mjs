import assert from 'node:assert/strict';
import { nativeFoot, validateNativeGeometryWithoutDisplay } from '../../public/gridfinity-converter/native-cad.js';
import * as cad from '../../public/gridfinity-converter/vendor/replicad/replicad.js';
await nativeFoot();
const oc = cad.getOC();
const box = cad.makeBox([0,0,0],[10,10,10]);
box.mesh({tolerance:.1,angularTolerance:.35});
const before = box.serialize();
assert.doesNotMatch(before,/Triangulations 0\b/);
const analyzer = oc.BRepCheck_Analyzer;
let checkedWithoutMesh = false;
oc.BRepCheck_Analyzer = function(shape, geometry, parallel, exact) {
  const wrapper = cad.cast(shape.clone());
  try { assert.match(wrapper.serialize(),/Triangulations 0\b/); }
  finally { wrapper.delete(); }
  assert.equal(geometry,true); assert.equal(exact,true);
  checkedWithoutMesh = true;
  return new analyzer(shape,geometry,parallel,exact);
};
try {
  assert.equal(validateNativeGeometryWithoutDisplay(oc,box),true);
  assert.equal(checkedWithoutMesh,true);
  assert.equal(box.serialize(),before,'checking must retain original native geometry and triangles');
  const shell = new oc.TopoDS_Shell(), builder = new oc.TopoDS_Builder();
  builder.MakeShell(shell);
  const faces = box.faces;
  for (const face of faces.slice(0,-1)) builder.Add(shell,face.wrapped);
  const maker = new oc.BRepBuilderAPI_MakeSolid(); maker.Add(shell);
  const invalid = cad.cast(maker.Solid());
  try { assert.equal(validateNativeGeometryWithoutDisplay(oc,invalid),false,'open solid remains invalid'); }
  finally { invalid.delete();maker.delete();faces.forEach(face=>face.delete());builder.delete();shell.delete(); }
} finally { oc.BRepCheck_Analyzer = analyzer;box.delete(); }
console.log(JSON.stringify({passed:true,cases:3}));

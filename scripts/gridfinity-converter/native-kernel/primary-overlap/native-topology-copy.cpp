#include <BRepBuilderAPI_Copy.hxx>
#include <BRep_Tool.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Shape.hxx>
#include <TopLoc_Location.hxx>
#include <Poly_Triangulation.hxx>
#include <Poly_Polygon3D.hxx>
#include <Standard_Failure.hxx>

// Independent topology with shared, immutable exact curves/surfaces. Never
// clean or mutate the borrowed source. Unsupported polygon-only shapes return
// null so the caller can retain its existing deep-copy path.
TopoDS_Shape nativeTopologyCopyWithoutMesh(const TopoDS_Shape& source) {
  TopExp_Explorer facePresence(source, TopAbs_FACE);
  if (!facePresence.More()) return TopoDS_Shape();
  for (TopExp_Explorer it(source, TopAbs_FACE); it.More(); it.Next())
    if (!BRep_Tool::IsGeometric(TopoDS::Face(it.Current()))) return TopoDS_Shape();
  for (TopExp_Explorer it(source, TopAbs_EDGE); it.More(); it.Next())
    if (!BRep_Tool::IsGeometric(TopoDS::Edge(it.Current()))) return TopoDS_Shape();
  // Copy maps pcurves while walking faces. A free edge can carry a pcurve
  // with no face context, so reject it rather than risk losing geometry.
  TopExp_Explorer freeEdges(source, TopAbs_EDGE, TopAbs_FACE);
  if (freeEdges.More()) return TopoDS_Shape();
  BRepBuilderAPI_Copy copier(source, false, false);
  if (!copier.IsDone()) throw Standard_Failure("Native topology copy did not complete");
  TopoDS_Shape result = copier.Shape();
  for (TopExp_Explorer it(result, TopAbs_FACE); it.More(); it.Next()) {
    TopLoc_Location location;
    if (!BRep_Tool::Triangulation(TopoDS::Face(it.Current()), location).IsNull())
      return TopoDS_Shape();
  }
  for (TopExp_Explorer it(result, TopAbs_EDGE); it.More(); it.Next()) {
    TopLoc_Location location;
    if (!BRep_Tool::Polygon3D(TopoDS::Edge(it.Current()), location).IsNull())
      return TopoDS_Shape();
  }
  return result;
}
#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
EMSCRIPTEN_BINDINGS(native_topology_copy) {
  emscripten::function("nativeTopologyCopyWithoutMesh", &nativeTopologyCopyWithoutMesh);
}
#endif

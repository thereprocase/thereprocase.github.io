// Exact-operation decomposition of pinned OCCT BRepBndLib::AddOptimal.
// No triangulation, no shape tolerances, no sampled or approximate bounds.
#include <BRepBndLib.hxx>
#include <Bnd_Box.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS_Shape.hxx>
#include <OSD_Parallel.hxx>
#include <Standard_RangeError.hxx>
#include <emscripten/bind.h>
#include <limits>
#include <vector>

void nativeAnalyticAddOptimal(const TopoDS_Shape&, Bnd_Box&, bool, bool);

namespace {
void mergeLikeAddOptimal(const Bnd_Box& local, Bnd_Box& target) {
  if (local.IsVoid()) return;
  double xmin, ymin, zmin, xmax, ymax, zmax;
  local.Get(xmin, ymin, zmin, xmax, ymax, zmax);
  // Deliberately retain the original Get/Update reduction. Bnd_Box::Add can
  // change gap/open-bound handling when the caller supplied a nonempty box.
  target.Update(xmin, ymin, zmin, xmax, ymax, zmax);
}
}

void nativeAddOptimalParallel(const TopoDS_Shape& shape,
                              Bnd_Box& target,
                              bool forceSingleThread) {
  // Copy face values with their composed occurrence locations/orientations;
  // do not deduplicate by TShape or borrow explorer.Current references.
  std::vector<TopoDS_Shape> faces;
  for (TopExp_Explorer ex(shape, TopAbs_FACE); ex.More(); ex.Next())
    faces.push_back(ex.Current());
  if (faces.size() > static_cast<std::size_t>(std::numeric_limits<int>::max()))
    throw Standard_RangeError("Too many faces for parallel optimal bounds");
  std::vector<Bnd_Box> bounds(faces.size());
  if (!faces.empty()) {
    OSD_Parallel::For(0, static_cast<int>(faces.size()), [&](int index) {
      // Each call owns its adaptors and temporary bounding boxes. Shape
      // geometry is read-only; do not run a mesher/healer on it concurrently.
      nativeAnalyticAddOptimal(faces[index], bounds[index], false, false);
    }, forceSingleThread);
  }
  // Same face occurrence order and reduction as the serial implementation.
  for (const Bnd_Box& local : bounds) mergeLikeAddOptimal(local, target);

  // Necessary for compounds and other general shapes; ordinary closed solids
  // normally have no edges outside faces or vertices outside edges.
  for (TopExp_Explorer ex(shape, TopAbs_EDGE, TopAbs_FACE); ex.More(); ex.Next()) {
    Bnd_Box local;
    BRepBndLib::AddOptimal(ex.Current(), local, false, false);
    mergeLikeAddOptimal(local, target);
  }
  for (TopExp_Explorer ex(shape, TopAbs_VERTEX, TopAbs_EDGE); ex.More(); ex.Next()) {
    Bnd_Box local;
    BRepBndLib::AddOptimal(ex.Current(), local, false, false);
    mergeLikeAddOptimal(local, target);
  }
}

EMSCRIPTEN_BINDINGS(native_parallel_optimal_bounds) {
  emscripten::function("nativeAddOptimalParallel", &nativeAddOptimalParallel);
}

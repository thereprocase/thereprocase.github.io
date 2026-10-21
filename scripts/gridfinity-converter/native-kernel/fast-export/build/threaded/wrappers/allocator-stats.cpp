// UNLINKED DLMALLOC-ONLY DRAFT: pinned kernel uses mimalloc; do not enable.
// Diagnostic only: allocator bookkeeping, not CAD object reachability.
// mallinfo walks dlmalloc chunks under its lock; call at coarse milestones.
#include <malloc.h>
#include <emscripten/bind.h>
#include <emscripten/heap.h>
#include <cstdint>
struct NativeAllocatorStats {
  double inUseBytes;
  double freeBytes;
  double arenaBytes;
  double freeChunks;
  double wasmCapacityBytes;
};
NativeAllocatorStats nativeAllocatorStats() {
  const struct mallinfo stats = mallinfo();
  return {static_cast<double>(stats.uordblks),
          static_cast<double>(stats.fordblks),
          static_cast<double>(stats.arena),
          static_cast<double>(stats.ordblks),
          static_cast<double>(emscripten_get_heap_size())};
}
EMSCRIPTEN_BINDINGS(native_allocator_diagnostics) {
  emscripten::value_object<NativeAllocatorStats>("NativeAllocatorStats")
    .field("inUseBytes", &NativeAllocatorStats::inUseBytes)
    .field("freeBytes", &NativeAllocatorStats::freeBytes)
    .field("arenaBytes", &NativeAllocatorStats::arenaBytes)
    .field("freeChunks", &NativeAllocatorStats::freeChunks)
    .field("wasmCapacityBytes", &NativeAllocatorStats::wasmCapacityBytes);
  emscripten::function("nativeAllocatorStats", &nativeAllocatorStats);
}

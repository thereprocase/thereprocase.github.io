// Diagnostic-only, unlinked until explicitly added to an isolated build.
// Heap accounting covers the CALLING THREAD'S DEFAULT HEAP only. It does not
// imply all pthread arenas were collected. WASM capacity cannot shrink.
#include "mimalloc.h"
#include <emscripten/bind.h>
#include <emscripten/heap.h>
#include <emscripten/emmalloc.h>
#include <string>
#include <cstdint>

struct NativeMimallocHeapStats {
  double liveBlockBytes = 0;
  double liveBlocks = 0;
  double reservedBytes = 0;
  double committedBytes = 0;
  double areas = 0;
  double wasmCapacityBytes = 0;
  double heapIdentity = 0;
  bool complete = false;
};
static bool visitNativeMiArea(const mi_heap_t*, const mi_heap_area_t* area,
                             void* block, size_t, void* argument) {
  if (block != nullptr) return true;
  auto& value = *static_cast<NativeMimallocHeapStats*>(argument);
  value.liveBlockBytes += static_cast<double>(area->used) * area->block_size;
  value.liveBlocks += area->used;
  value.reservedBytes += area->reserved;
  value.committedBytes += area->committed;
  value.areas++;
  return true;
}
NativeMimallocHeapStats nativeMimallocCurrentThreadStats(bool collect) {
  if (collect) mi_collect(true);
  NativeMimallocHeapStats value;
  auto* heap = mi_heap_get_default();
  value.complete = mi_heap_visit_blocks(heap, false, visitNativeMiArea, &value);
  value.wasmCapacityBytes = emscripten_get_heap_size();
  value.heapIdentity = static_cast<double>(reinterpret_cast<uintptr_t>(heap));
  return value;
}
static void nativeMiOutput(const char* text, void* arg) {
  static_cast<std::string*>(arg)->append(text);
}
std::string nativeMimallocStatsText() {
  mi_stats_merge();
  std::string text;
  mi_stats_print_out(nativeMiOutput, &text);
  return text;
}
struct NativeMimallocProcessStats {
  double elapsedMS, userMS, systemMS, currentRSSBytes, peakRSSBytes,
         currentCommitBytes, peakCommitBytes, pageFaults;
};
NativeMimallocProcessStats getNativeMimallocProcessStats() {
  size_t elapsed=0,user=0,system=0,rss=0,peakRSS=0,commit=0,peakCommit=0,faults=0;
  mi_process_info(&elapsed,&user,&system,&rss,&peakRSS,&commit,&peakCommit,&faults);
  return {double(elapsed),double(user),double(system),double(rss),double(peakRSS),
          double(commit),double(peakCommit),double(faults)};
}
// This is global backing-store accounting for emmalloc UNDER mimalloc, not
// application-live objects: memory retained inside mimalloc remains "in use" here.
struct NativeMimallocBackingStats { double arenaBytes, freeBytes, unclaimedBytes; };
NativeMimallocBackingStats nativeMimallocBackingStats() {
  return {double(emmalloc_dynamic_heap_size()), double(emmalloc_free_dynamic_memory()),
          double(emmalloc_unclaimed_heap_memory())};
}
EMSCRIPTEN_BINDINGS(native_mimalloc_diagnostics) {
  emscripten::value_object<NativeMimallocBackingStats>("NativeMimallocBackingStats")
    .field("arenaBytes", &NativeMimallocBackingStats::arenaBytes)
    .field("freeBytes", &NativeMimallocBackingStats::freeBytes)
    .field("unclaimedBytes", &NativeMimallocBackingStats::unclaimedBytes);
  emscripten::function("nativeMimallocBackingStats", &nativeMimallocBackingStats);
  emscripten::value_object<NativeMimallocHeapStats>("NativeMimallocHeapStats")
    .field("liveBlockBytes", &NativeMimallocHeapStats::liveBlockBytes)
    .field("liveBlocks", &NativeMimallocHeapStats::liveBlocks)
    .field("reservedBytes", &NativeMimallocHeapStats::reservedBytes)
    .field("committedBytes", &NativeMimallocHeapStats::committedBytes)
    .field("areas", &NativeMimallocHeapStats::areas)
    .field("wasmCapacityBytes", &NativeMimallocHeapStats::wasmCapacityBytes)
    .field("heapIdentity", &NativeMimallocHeapStats::heapIdentity)
    .field("complete", &NativeMimallocHeapStats::complete);
  emscripten::value_object<NativeMimallocProcessStats>("NativeMimallocProcessStats")
    .field("elapsedMS", &NativeMimallocProcessStats::elapsedMS)
    .field("userMS", &NativeMimallocProcessStats::userMS)
    .field("systemMS", &NativeMimallocProcessStats::systemMS)
    .field("currentRSSBytes", &NativeMimallocProcessStats::currentRSSBytes)
    .field("peakRSSBytes", &NativeMimallocProcessStats::peakRSSBytes)
    .field("currentCommitBytes", &NativeMimallocProcessStats::currentCommitBytes)
    .field("peakCommitBytes", &NativeMimallocProcessStats::peakCommitBytes)
    .field("pageFaults", &NativeMimallocProcessStats::pageFaults);
  emscripten::function("nativeMimallocCurrentThreadStats", &nativeMimallocCurrentThreadStats);
  emscripten::function("nativeMimallocStatsText", &nativeMimallocStatsText);
  emscripten::function("nativeMimallocProcessStats", &getNativeMimallocProcessStats);
}

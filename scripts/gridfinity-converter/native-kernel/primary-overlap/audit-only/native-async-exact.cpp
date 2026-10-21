#include <TopoDS_Shape.hxx>
#include <BRepCheck_Analyzer.hxx>
#include <OSD_ThreadPool.hxx>
#include <Standard_Failure.hxx>
#include <atomic>
#include <pthread.h>
#include <cerrno>
#include <exception>
#include <chrono>
#include <stdexcept>
#include <string>

namespace {std::atomic<bool> activeExactJob{false};
#ifdef NATIVE_ASYNC_AUDIT
std::atomic<bool> trapNext{false};
#endif
}
// Caller supplies the existing independent, mesh-free DEEP candidate snapshot.
// It must never be modified until completion. Topology-only copies are not accepted
// by the JS integration for this concurrent path.
class NativeAsyncExactJob {
 TopoDS_Shape snapshot;
 occ::handle<OSD_ThreadPool> pool;
 int oldBudget=0;
 pthread_t worker{};
 bool started=false, joined=false;
 std::atomic<bool> completed{false};
 bool validResult=false, retired=false;
 double elapsed=0;
 std::string failure;
 void restore(){if(!retired){pool->SetNbDefaultThreadsToLaunch(oldBudget);activeExactJob.store(false);retired=true;}}
 public:
 explicit NativeAsyncExactJob(const TopoDS_Shape& shape):snapshot(shape),pool(OSD_ThreadPool::DefaultPool()) {
  bool expected=false;
  if(!activeExactJob.compare_exchange_strong(expected,true))throw std::runtime_error("An exact validation job is already active");
  oldBudget=pool->NbDefaultThreadsToLaunch();
  try {
   if(pool->NbThreads()!=4||oldBudget!=4)throw std::runtime_error("Async exact validation requires the four-thread kernel budget");
   // Two participants per concurrent OCCT job, four active threads in total.
   // The dedicated coordinator uses the spare fourth prewarmed pthread worker.
   pool->SetNbDefaultThreadsToLaunch(2);
   const int status=pthread_create(&worker,nullptr,[](void* pointer)->void* {
    auto self=static_cast<NativeAsyncExactJob*>(pointer);
    auto begun=std::chrono::steady_clock::now();
    try{BRepCheck_Analyzer check(self->snapshot,true,true,true);self->validResult=check.IsValid();}
    catch(const Standard_Failure& e){self->failure=e.GetMessageString()?e.GetMessageString():"Native exact validation failed";}
    catch(const std::exception&e){self->failure=e.what();}
    catch(...){self->failure="Unexpected native exact validation exception";}
#ifdef NATIVE_ASYNC_AUDIT
    if(trapNext.exchange(false))__builtin_trap();
#endif
    self->elapsed=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-begun).count();
    self->completed.store(true,std::memory_order_release);
    return nullptr;
   },this);
   if(status)throw std::runtime_error("Unable to start native exact validation pthread");
   started=true;
  } catch(...){restore();throw;}
 }
 bool done()const{return completed.load(std::memory_order_acquire);}
 bool passed()const{if(!joined||!done())throw std::runtime_error("Exact validation has not retired");return validResult&&failure.empty();}
 std::string error()const{if(!joined||!done())throw std::runtime_error("Exact validation has not retired");return failure;}
 double elapsedMS()const{if(!joined||!done())throw std::runtime_error("Exact validation has not retired");return elapsed;}
 bool tryJoinFinished(){
  if(joined)return true;
  const int status=pthread_tryjoin_np(worker,nullptr);
  if(status==EBUSY)return false;
  if(status)throw std::runtime_error("Native exact pthread could not be retired");
  joined=true;restore();
  if(!done())throw std::runtime_error("Native exact pthread exited without a result");
  return true;
 }
 ~NativeAsyncExactJob(){
  // Never block in finalization, including a thread/TLS teardown trap. Explicit
  // tryJoinFinished must retire the pthread first. JS holds a strong reference
  // while pending and quarantines poisoned jobs until entire-kernel teardown.
  if(started&&!joined)std::terminate();
  restore();
 }
};
#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
EMSCRIPTEN_BINDINGS(native_async_exact){
#ifdef NATIVE_ASYNC_AUDIT
 emscripten::function("nativeAsyncAuditTrapNext",+[]{trapNext.store(true);});
#endif
 emscripten::class_<NativeAsyncExactJob>("NativeAsyncExactJob")
 .constructor<const TopoDS_Shape&>()
 .function("done",&NativeAsyncExactJob::done)
 .function("passed",&NativeAsyncExactJob::passed)
 .function("error",&NativeAsyncExactJob::error)
 .function("elapsedMS",&NativeAsyncExactJob::elapsedMS)
 .function("tryJoinFinished",&NativeAsyncExactJob::tryJoinFinished);
}
#endif

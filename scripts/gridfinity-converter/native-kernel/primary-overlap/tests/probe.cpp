#include "/home/repro/occt-topology-copy-audit/native-topology-copy.cpp"
#include <BRepCheck_Analyzer.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepAlgoAPI_Common.hxx>
#include <BRepBuilderAPI_Transform.hxx>
#include <BRepTools.hxx>
#include <BRep_Builder.hxx>
#include <BRepPrimAPI_MakeBox.hxx>
#include <BRepPrimAPI_MakeCylinder.hxx>
#include <TopTools_IndexedMapOfShape.hxx>
#include <TopTools_ListOfShape.hxx>
#include <TopExp.hxx>
#include <BRepGProp.hxx>
#include <GProp_GProps.hxx>
#include <OSD_Parallel.hxx>
#include <OSD_ThreadPool.hxx>
#include <thread>
#include <atomic>
#include <chrono>
#include <iostream>
#include <sstream>
#include <iomanip>
#include <exception>
using Clock=std::chrono::steady_clock;
double ms(Clock::time_point t){return std::chrono::duration<double,std::milli>(Clock::now()-t).count();}
std::string text(const TopoDS_Shape&s){std::ostringstream o;BRepTools::Write(s,o);return o.str();}
TopoDS_Shape box(gp_Pnt a,gp_Pnt b){return BRepPrimAPI_MakeBox(a,b).Shape();}
template<class Op>TopoDS_Shape boolean(const TopoDS_Shape&a,const TopoDS_Shape&b){Op op;TopTools_ListOfShape args,tools;args.Append(a);tools.Append(b);op.SetArguments(args);op.SetTools(tools);op.SetNonDestructive(true);op.SetRunParallel(true);op.SetFuzzyValue(1e-5);op.Build();if(!op.IsDone())throw std::runtime_error("Boolean failed");return op.Shape();}
TopoDS_Shape cut(const TopoDS_Shape&a,const TopoDS_Shape&b){return boolean<BRepAlgoAPI_Cut>(a,b);}
TopoDS_Shape common(const TopoDS_Shape&a,const TopoDS_Shape&b){return boolean<BRepAlgoAPI_Common>(a,b);}
TopoDS_Shape changed(const TopoDS_Shape&a,const TopoDS_Shape&b){TopTools_IndexedMapOfShape aa,bb;TopExp::MapShapes(a,TopAbs_FACE,aa);TopExp::MapShapes(b,TopAbs_FACE,bb);TopoDS_Compound c;BRep_Builder builder;builder.MakeCompound(c);for(int i=1;i<=aa.Extent();i++){int j=bb.FindIndex(aa(i));if(!j||!aa(i).IsEqual(bb(j)))builder.Add(c,aa(i));}return c;}
int faces(const TopoDS_Shape&s){TopTools_IndexedMapOfShape m;TopExp::MapShapes(s,TopAbs_FACE,m);return m.Extent();}
double volume(const TopoDS_Shape&s){GProp_GProps p;BRepGProp::VolumeProperties(s,p,false,false,false);return p.Mass();}
struct ExactJob{TopoDS_Shape snapshot;std::thread thread;std::atomic<bool>done{false};bool valid=false;double elapsed=0;std::exception_ptr error;
 explicit ExactJob(const TopoDS_Shape&s):snapshot(s){}
 void start(){thread=std::thread([this]{auto t=Clock::now();try{BRepCheck_Analyzer check(snapshot,true,true,true);valid=check.IsValid();}catch(...){error=std::current_exception();}elapsed=ms(t);done.store(true,std::memory_order_release);});}
 void join(){if(thread.joinable())thread.join();}
 ~ExactJob(){join();}
};
struct PoolBudget{occ::handle<OSD_ThreadPool>pool;int old;PoolBudget(int n):pool(OSD_ThreadPool::DefaultPool()),old(pool->NbDefaultThreadsToLaunch()){pool->SetNbDefaultThreadsToLaunch(n);}~PoolBudget(){pool->SetNbDefaultThreadsToLaunch(old);}};
struct Proof{int missing,added;double outside;};
Proof mainWork(const TopoDS_Shape&source,const TopoDS_Shape&result,const TopoDS_Shape&region,const TopoDS_Shape&localSource,const TopoDS_Shape&allowed){
 auto removed=changed(source,result),added=changed(result,source);auto a=cut(removed,region),b=cut(added,region);int missing=faces(cut(a,b)),extra=faces(cut(b,a));auto localResult=common(result,region);auto plus=cut(localResult,localSource),minus=cut(localSource,localResult);double outside=std::abs(volume(cut(plus,allowed)))+std::abs(volume(cut(minus,allowed)));return{missing,extra,outside};
}
int main(int argc,char**argv){OSD_Parallel::SetUseOcctThreads(true);auto pool=OSD_ThreadPool::DefaultPool(4);pool->Init(4);pool->SetNbDefaultThreadsToLaunch(4);
 const bool cup=argc>1;TopoDS_Shape source;if(cup){BRep_Builder b;BRepTools::Read(source,argv[1],b);}else source=box({0,0,0},{84,84,20});
 TopoDS_Compound tools;BRep_Builder builder;builder.MakeCompound(tools);for(double x:{20.75,62.75})for(double y:{20.75,62.75})for(double dx:{-13.,13.})for(double dy:{-13.,13.})builder.Add(tools,BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(x+dx,y+dy,-.02),gp_Dir(0,0,1)),3.25,2.42).Shape());
 auto result=cut(source,tools),region=box({-1.25,-1.25,-.1},{84.75,84.75,4.87}),localSource=common(source,region);const auto initial=text(source),resultInitial=text(result);
 for(int round=0;round<1;round++)for(int i=0;i<2;i++){
 bool overlap=(round+i)%2;auto t=Clock::now();BRepBuilderAPI_Transform copy(result,gp_Trsf(),true,false);auto candidate=copy.Shape();auto serialized=text(candidate);const double commonSnapshotMS=ms(t);auto started=Clock::now();double exactMS=0,mainMS=0,copyMS=0;bool valid=false;Proof proof{};
 if(overlap){PoolBudget budget(2);ExactJob job(candidate);job.start();auto m=Clock::now();proof=mainWork(source,result,region,localSource,tools);mainMS=ms(m);job.join();if(job.error)std::rethrow_exception(job.error);valid=job.valid;exactMS=job.elapsed;}
 else{auto c=Clock::now();auto snapshot=nativeTopologyCopyWithoutMesh(result);copyMS=ms(c);if(snapshot.IsNull())throw std::runtime_error("unsupported topology copy");auto e=Clock::now();BRepCheck_Analyzer check(snapshot,true,true,true);valid=check.IsValid();exactMS=ms(e);auto m=Clock::now();proof=mainWork(source,result,region,localSource,tools);mainMS=ms(m);}
 double total=ms(started);if(!valid||proof.missing||proof.added||proof.outside>1e-3)throw std::runtime_error("validation failed");if(pool->NbDefaultThreadsToLaunch()!=4)throw std::runtime_error("pool not restored");if(text(candidate)!=serialized)throw std::runtime_error("snapshot changed");if(text(source)!=initial||text(result)!=resultInitial)throw std::runtime_error("input geometry changed");
 std::cout<<std::setprecision(17)<<"{\"round\":"<<round<<",\"overlap\":"<<overlap<<",\"commonSnapshotMS\":"<<commonSnapshotMS<<",\"primaryCopyMS\":"<<copyMS<<",\"exactMS\":"<<exactMS<<",\"mainMS\":"<<mainMS<<",\"totalMS\":"<<total<<",\"outsideChange\":"<<proof.outside<<",\"strictValid\":true,\"sourceAndResultUnchanged\":true,\"snapshotBytesUnchanged\":true,\"poolRestored\":true}"<<std::endl;
 }
 // Background exception must be captured, joined and surfaced; it cannot be success.
 {PoolBudget budget(2);ExactJob failed{TopoDS_Shape()};failed.start();failed.join();if(!failed.done.load()||!failed.error)throw std::runtime_error("background failure not retained");}
 if(pool->NbDefaultThreadsToLaunch()!=4)throw std::runtime_error("background error budget not restored");
 // Cleanup during main failure must join before restoring the global budget.
 {PoolBudget budget(2);ExactJob job(source);job.start();try{throw std::runtime_error("simulated cancel/main failure");}catch(...){job.join();if(!job.done.load(std::memory_order_acquire))throw;}}
 if(pool->NbDefaultThreadsToLaunch()!=4)throw std::runtime_error("error budget not restored");
 std::cout<<"{\"backgroundFailureJoined\":true,\"mainFailureJoined\":true,\"poolRestored\":true}"<<std::endl;
}

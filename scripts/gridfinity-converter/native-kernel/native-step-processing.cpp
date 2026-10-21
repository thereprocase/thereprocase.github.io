#include <STEPControl_Reader.hxx>
#include <ShapeProcess.hxx>
#include <emscripten/bind.h>
void nativeSetStepReadProcessingDisabled(STEPControl_Reader& reader) {
  reader.SetShapeProcessFlags(ShapeProcess::OperationsFlags{});
}
EMSCRIPTEN_BINDINGS(native_step_processing) {
  emscripten::function("nativeSetStepReadProcessingDisabled", &nativeSetStepReadProcessingDisabled);
}
#include <DESTEP_Parameters.hxx>
#include <XSAlgo_ShapeProcessor.hxx>
#include <BRepCheck_Analyzer.hxx>
#include <BRepCheck_Result.hxx>
#include <TopExp.hxx>
#include <TopTools_IndexedMapOfShape.hxx>
#include <Standard_DomainError.hxx>
#include <sstream>
#include <set>
#include <map>
#include <string>
void nativeSetStepReadFixMode(STEPControl_Reader& reader,const std::string& name,int mode) {
 static const std::set<std::string> allowed={"FixSameParameterMode","FixEdgeSameParameterMode","FixEdgeCurvesMode","FixReorderMode","FixFaceMode","FixWireMode","FixOrientationMode","FixShellOrientationMode","FixFaceOrientationMode","FixSolidMode","FixShellMode","FixFreeFaceMode","FixFreeShellMode","FixFreeWireMode","FixVertexPositionMode","FixVertexToleranceMode"};
 if(!allowed.count(name)||mode < -1||mode > 1)throw Standard_DomainError("Unknown STEP repair mode or invalid value");
 if(reader.GetShapeFixParameters().IsEmpty())reader.SetShapeFixParameters(DESTEP_Parameters::GetDefaultShapeFixParameters());
 auto parameters=reader.GetShapeFixParameters();
 const TCollection_AsciiString key((std::string("FixShape.")+name).c_str());
 if(!parameters.IsBound(key))throw Standard_DomainError("STEP repair mode is not in default parameter map");
 parameters.UnBind(key);parameters.Bind(key,TCollection_AsciiString(mode));reader.SetShapeFixParameters(parameters);
}
std::string nativeExactStatusSummary(const TopoDS_Shape& shape) {
 BRepCheck_Analyzer check(shape,true,true,true);std::ostringstream out;
 out<<"valid="<<check.IsValid()<<"\n";
 for(int kind=TopAbs_SOLID;kind<=TopAbs_VERTEX;++kind){
  TopTools_IndexedMapOfShape map;TopExp::MapShapes(shape,static_cast<TopAbs_ShapeEnum>(kind),map);
  int bad=0;std::map<int,int> totals;
  for(int i=1;i<=map.Extent();++i){auto result=check.Result(map(i));if(result.IsNull())continue;std::set<int> statuses;
   for(const auto status:result->Status())if(status!=BRepCheck_NoError)statuses.insert(static_cast<int>(status));
   result->InitContextIterator();while(result->MoreShapeInContext()){
    for(const auto status:result->StatusOnShape())if(status!=BRepCheck_NoError)statuses.insert(static_cast<int>(status));
    result->NextShapeInContext();
   }
   if(!statuses.empty()){++bad;if(bad<=20){out<<"bad kind="<<kind<<" index="<<i<<" statuses=";for(int code:statuses)out<<code<<",";out<<"\n";}for(int code:statuses)totals[code]++;}
  }
  out<<"summary kind="<<kind<<" total="<<map.Extent()<<" bad="<<bad<<" statuses=";for(auto entry:totals)out<<entry.first<<":"<<entry.second<<",";out<<"\n";
 }
 return out.str();
}
EMSCRIPTEN_BINDINGS(native_step_selective_processing) {
 emscripten::function("nativeSetStepReadFixMode", &nativeSetStepReadFixMode);
 emscripten::function("nativeExactStatusSummary", &nativeExactStatusSummary);
}

#include <emscripten/bind.h>
#include <STEPControl_Writer.hxx>
#include <StepData_StepModel.hxx>
#include <StepData_Protocol.hxx>
#include <StepData_StepWriter.hxx>
#include <APIHeaderSection_MakeHeader.hxx>
#include <IFSelect_ReturnStatus.hxx>
#include <fstream>
#include <string>
IFSelect_ReturnStatus nativeWriteStep17(STEPControl_Writer& writer,const std::string& path) {
 auto model=writer.Model();
 if(model.IsNull()) return IFSelect_RetFail;
 auto protocol=occ::down_cast<StepData_Protocol>(model->Protocol());
 if(protocol.IsNull()) return IFSelect_RetFail;
 APIHeaderSection_MakeHeader header;header.Apply(model);
 StepData_StepWriter output(model);
 output.FloatWriter().SetFormat("%.16E",true);
 output.FloatWriter().SetZeroSuppress(false);
 output.SendModel(protocol);
 std::ofstream stream(path,std::ios::out|std::ios::binary|std::ios::trunc);
 if(!stream.is_open()) return IFSelect_RetFail;
 const bool written=output.Print(stream);stream.flush();
 return written&&stream.good()?IFSelect_RetDone:IFSelect_RetFail;
}
EMSCRIPTEN_BINDINGS(native_step_writer17){emscripten::function("nativeWriteStep17",&nativeWriteStep17);}

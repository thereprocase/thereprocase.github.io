#define main old_probe_main
#include "native-probe.cpp"
#undef main
#include <BRepPrimAPI_MakeSphere.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <gp_Pln.hxx>
#include <Geom2d_Line.hxx>
#include <Geom_Plane.hxx>
#include <Poly_PolygonOnTriangulation.hxx>
#include <TopoDS_Compound.hxx>
void fixture(TopoDS_Shape s,const char*name){
 auto before=write(s);TopoDS_Shape c=nativeTopologyCopyWithoutMesh(s);
 if(c.IsNull()){std::cout<<name<<": conservative fallback\n";return;}
 TopTools_IndexedMapOfShape sm,cm;TopExp::MapShapes(s,sm);TopExp::MapShapes(c,cm);
 for(int i=1;i<=cm.Extent();i++)for(int j=1;j<=sm.Extent();j++)if(cm(i).IsPartner(sm(j))){std::cerr<<"fixture "<<name<<" shared type "<<int(cm(i).ShapeType())<<" source "<<j<<" copy "<<i<<std::endl;throw std::runtime_error("shared TShape");}
 BRepCheck_Analyzer a(s,true,false,true),b(c,true,false,true);if(a.IsValid()!=b.IsValid())throw std::runtime_error("validity differs");
 c.Nullify();if(write(s)!=before)throw std::runtime_error("source mutated");std::cout<<name<<": same strict validity, independent topology, source unchanged\n";
}
int main(){
 auto box=BRepPrimAPI_MakeBox(2,3,4).Shape();gp_Trsf t;t.SetTranslation(gp_Vec(3,5,7));fixture(box.Located(TopLoc_Location(t)),"located box");
 fixture(BRepPrimAPI_MakeSphere(3).Shape(),"sphere degenerate edges");
 TopoDS_Edge empty;BRep_Builder builder;builder.MakeEdge(empty);if(!nativeTopologyCopyWithoutMesh(empty).IsNull())throw std::runtime_error("empty edge accepted");std::cout<<"empty edge: fallback\n";
 TopoDS_Face poly;builder.MakeFace(poly);if(!nativeTopologyCopyWithoutMesh(poly).IsNull())throw std::runtime_error("empty face accepted");std::cout<<"empty face: fallback\n";
 occ::handle<Poly_Triangulation> tri=new Poly_Triangulation(3,1,false);tri->SetNode(1,gp_Pnt(0,0,0));tri->SetNode(2,gp_Pnt(1,0,0));tri->SetNode(3,gp_Pnt(0,1,0));tri->SetTriangle(1,Poly_Triangle(1,2,3));
 TopoDS_Face polyface;builder.MakeFace(polyface,tri);
 occ::handle<Poly_PolygonOnTriangulation> polygon=new Poly_PolygonOnTriangulation(2,false);polygon->SetNode(1,1);polygon->SetNode(2,2);
 TopoDS_Edge polyedge;builder.MakeEdge(polyedge);builder.UpdateEdge(polyedge,polygon,tri);
 for(const TopoDS_Shape& extra:{TopoDS_Shape(polyface),TopoDS_Shape(polyedge)}){TopoDS_Compound mixed;builder.MakeCompound(mixed);builder.Add(mixed,box);builder.Add(mixed,extra);auto before=write(mixed);std::ofstream(std::string("/home/repro/occt-topology-copy-audit/mixed-polygon-")+std::to_string(int(extra.ShapeType()))+".brep")<<before;if(!nativeTopologyCopyWithoutMesh(mixed).IsNull())throw std::runtime_error("mixed polygon accepted");if(write(mixed)!=before)throw std::runtime_error("mixed polygon mutated");std::cout<<"mixed polygon type "<<int(extra.ShapeType())<<": fallback, source unchanged"<<std::endl;}
 TopoDS_Edge pcurveEdge;builder.MakeEdge(pcurveEdge);occ::handle<Geom2d_Curve> curve=new Geom2d_Line(gp_Pnt2d(0,0),gp_Dir2d(1,0));occ::handle<Geom_Surface> surf=new Geom_Plane(gp_Pln(gp_Pnt(0,0,0),gp_Dir(0,0,1)));builder.UpdateEdge(pcurveEdge,curve,surf,TopLoc_Location(),1e-7);builder.Range(pcurveEdge,0.,1.);
 TopoDS_Compound pcurveMixed;builder.MakeCompound(pcurveMixed);builder.Add(pcurveMixed,box);builder.Add(pcurveMixed,pcurveEdge);auto pcurveBefore=write(pcurveMixed);std::ofstream("/home/repro/occt-topology-copy-audit/mixed-free-pcurve.brep")<<pcurveBefore;if(!nativeTopologyCopyWithoutMesh(pcurveMixed).IsNull())throw std::runtime_error("free pcurve edge accepted");if(write(pcurveMixed)!=pcurveBefore)throw std::runtime_error("free pcurve source modified");std::cout<<"mixed free geometric pcurve edge: fallback, source unchanged"<<std::endl;
 TopoDS_Solid invalid;builder.MakeSolid(invalid);fixture(invalid,"empty invalid solid");
 TopoDS_Shell shell;builder.MakeShell(shell);TopExp_Explorer face(box,TopAbs_FACE);builder.Add(shell,face.Current());builder.Add(invalid,shell);fixture(invalid,"open invalid solid");
}

#include <gp_Torus.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <Precision.hxx>
#include <cmath>
#include <vector>
#include <limits>
#include <algorithm>
struct TorusCandidate{double angle,error;};
// Pinned Emscripten musl sin/cos document nearly-rounded results; reserve
// 64 binary64 eps absolute for each bounded-angle evaluation, plus arithmetic.
// atan2 merely proposes a phase: cross/dot residuals certify it independently.
static bool torusCandidates(double lo,double hi,double a,double b,double aError,double bError,std::vector<TorusCandidate>& out){
 const double eps=std::numeric_limits<double>::epsilon(),pi=std::acos(-1.);out={{lo,0},{hi,0}};
 double magnitude=std::max(fabs(a),fabs(b)),inputError=aError+bError;
 if(magnitude==0&&inputError==0)return true;
 if(magnitude<1e-14||inputError>magnitude*.01)return false;
 double phase=std::atan2(b,a);if(!std::isfinite(phase)||fabs(phase)>pi)return false;
 double sn=std::sin(phase),cs=std::cos(phase),evalError=80*eps*(fabs(a)+fabs(b))+inputError;
 double cross=std::abs(-a*sn+b*cs)+evalError,dot=a*cs+b*sn-evalError;
 if(dot<=magnitude*.5)return false;
 double phaseError=2*cross/(magnitude-inputError);
 if(!std::isfinite(phaseError)||phaseError>1e-5)return false;
 int first=static_cast<int>(std::floor((lo-phase)/pi))-2,last=static_cast<int>(std::ceil((hi-phase)/pi))+2;
 if(last-first>10)return false;
 for(int k=first;k<=last;k++){
  double t=phase+k*pi,error=phaseError+8*eps*(1+fabs(t)+fabs(k*pi));
  if(t>=lo-error&&t<=hi+error)out.push_back({std::clamp(t,lo,hi),error});
 }
 return true;
}
static bool analyticTorusRectangle(const BRepAdaptor_Surface& surface,double u0,double u1,double v0,double v1,double tol,Bnd_Box& box){
 if(surface.GetType()!=GeomAbs_Torus||tol!=0)return false;
 const auto torus=surface.Torus();const double R=torus.MajorRadius(),r=torus.MinorRadius(),pi=std::acos(-1.),period=2*pi;
 if(!std::isfinite(R)||!std::isfinite(r)||!(R>r&&r>0)||R>1e6)return false;
 for(double v:{u0,u1,v0,v1})if(!std::isfinite(v)||std::abs(v)>128*pi)return false;
 if(u1<u0||v1<v0)return false;
 auto normalize=[&](double& lo,double& hi){if(hi-lo>=period){lo=0;hi=period;}};
 normalize(u0,u1);normalize(v0,v1);
 const auto pos=torus.Position();const auto C=pos.Location();const auto X=pos.XDirection(),Y=pos.YDirection(),Z=pos.Direction();double low[3],high[3];
 const double eps=std::numeric_limits<double>::epsilon(),gamma=256*eps/(1-256*eps);
 for(int k=1;k<=3;k++){
  double c=C.Coord(k),x=X.Coord(k),y=Y.Coord(k),z=Z.Coord(k);
  if(!std::isfinite(c)||fabs(c)>1e6||!std::isfinite(x)||!std::isfinite(y)||!std::isfinite(z))return false;
  std::vector<TorusCandidate> uc;double flatUError=0;
  if(std::max(fabs(x),fabs(y))<1e-12){uc={{u0,0},{u1,0}};flatUError=2*(R+r)*(fabs(x)+fabs(y));}
  else if(!torusCandidates(u0,u1,x,y,0,0,uc)){uc={{u0,0},{u1,0}};flatUError=2*(R+r)*(fabs(x)+fabs(y));}
  double mn=INFINITY,mx=-INFINITY,maxRootError=0,qError=80*eps*(fabs(x)+fabs(y));
  for(auto u:uc){double q=x*std::cos(u.angle)+y*std::sin(u.angle);std::vector<TorusCandidate> vc;
   double flatVError=0;
   if(std::max(fabs(q),fabs(z))<1e-12){vc={{v0,0},{v1,0}};flatVError=2*r*(fabs(q)+fabs(z)+qError);}
   else if(!torusCandidates(v0,v1,q,z,qError,0,vc)){vc={{v0,0},{v1,0}};flatVError=2*r*(fabs(q)+fabs(z)+qError);}
   for(auto v:vc){double value=c+(R+r*std::cos(v.angle))*q+r*z*std::sin(v.angle);mn=std::min(mn,value);mx=std::max(mx,value);
    double rootError=(R+r)*(fabs(x)+fabs(y))*u.error+r*(fabs(q)+fabs(z)+qError)*v.error+(R+r)*qError+flatVError+flatUError;
    maxRootError=std::max(maxRootError,rootError);
   }
  }
  // Same Confusion enlargement as pinned BoxOptimal, then bounded root,
  // transcendental, arithmetic and ElSLib near-zero coefficient snapping error.
  double extent=(R+r)*(fabs(x)+fabs(y))+r*fabs(z);
  double angleScale=1+std::max({fabs(u0),fabs(u1),fabs(v0),fabs(v1)});
  double pad=Precision::Confusion()+maxRootError+gamma*(1+fabs(c)+extent)*angleScale;
  if(!std::isfinite(pad)||pad>5e-7)return false;
  low[k-1]=std::nextafter(mn-pad,-INFINITY);high[k-1]=std::nextafter(mx+pad,INFINITY);
 }
 box.Update(low[0],low[1],low[2],high[0],high[1],high[2]);return true;
}

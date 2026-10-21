#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <limits>
#include <cmath>
#include <cassert>
#include <cstdint>
#include <iostream>
using std::strlen;
int Convert(const double      val,
                                   const char* const text,
                                   const bool        zsup,
                                   const double      R1,
                                   const double      R2,
                                   const char* const mainform,
                                   const char* const rangeform)
{
  //    Float value, purged of trailing "0000" and "E+00"
  const int anMasSize = 5; // change 6 to 5: index 5 is not used below
  char      lxp[anMasSize], *pText;
  int       i0 = 0, j0 = 0;

  for (int i = 0; i < anMasSize; ++i)
  {
    lxp[i] = '\0';
  }

  pText = (char*)text;
  //
  if ((val >= R1 && val < R2) || (val <= -R1 && val > -R2))
  {
    std::sprintf(pText, rangeform, val);
  }
  else
  {
    std::sprintf(pText, mainform, val);
  }

  if (zsup)
  {
    for (int i = 0; i < 16; i++)
    {
      i0 = i;
      if (text[i] == 'e' || text[i] == 'E')
      {
        lxp[0] = 'E';
        lxp[1] = text[i + 1];
        lxp[2] = text[i + 2];
        lxp[3] = text[i + 3];
        lxp[4] = text[i + 4];

        if (lxp[1] == '+' && lxp[2] == '0' && lxp[3] == '0' && lxp[4] == '\0')
        {
          lxp[0] = '\0';
        }

        pText[i] = '\0';
      }
      if (text[i] == '\0')
      {
        break;
      }
    }
    // #52 rln 23.12.98 converting 1e-07 throws exception
    for (int j = i0 - 1; j >= 0; j--)
    {
      j0 = j;

      if (text[j] != '0')
      {
        break;
      }

      pText[j] = '\0';
    }

    pText[j0 + 1] = lxp[0];
    pText[j0 + 2] = lxp[1];
    pText[j0 + 3] = lxp[2];
    pText[j0 + 4] = lxp[3];
    pText[j0 + 5] = lxp[4];
    pText[j0 + 6] = '\0';
  }
  return (int)strlen(text);
}

int main(){
 const double values[]={-std::numeric_limits<double>::max(),-std::numeric_limits<double>::min(),-std::numeric_limits<double>::denorm_min(),0.,-0.,42.,-42.,1.e-99,1.e99,1.e100,-1.e100,0.00595871734215187,83.74999999999999};
 for(double value:values){
  struct Protected{uint64_t before;char text[64];uint64_t after;} b{0x123456789abcdef0ULL,{},0xfedcba9876543210ULL};
  int n=Convert(value,b.text,false,0.,0.,"%.16E","%.16E");
  assert(n>0&&n<64);assert(b.before==0x123456789abcdef0ULL&&b.after==0xfedcba9876543210ULL);
  char*end;double parsed=std::strtod(b.text,&end);assert(*end=='\0');
  assert(std::memcmp(&value,&parsed,sizeof(value))==0);
  std::cout<<b.text<<"\n";
 }
 std::cout<<"PASS 13 finite-double bit-exact roundtrips and buffer canaries\n";
}

import math,json
import design as d
C=d.SPRING_MEAN_D/d.WIRE
wahl=(4*C-1)/(4*C-4)+.615/C
rate=d.G*d.WIRE**4/(8*d.SPRING_MEAN_D**3*d.ACTIVE)
F_nom=(12.95+36*.45359237)*9.80665/4
F_design=35*9.80665/4*1.3
F_peak=F_design*1.2
solid=(d.ACTIVE+d.INACTIVE)*d.WIRE
rows=[]
for label,F in [('nominal',F_nom),('uneven design',F_design),('20% peak margin',F_peak)]:
 tau=wahl*8*F*d.SPRING_MEAN_D/(math.pi*d.WIRE**3)
 rows.append({'case':label,'force_N':F,'compression_mm':F/rate,'max_shear_MPa':tau,'von_mises_MPa':tau*math.sqrt(3),'conservative_static_rupture_FoS':d.UTS_MIN/(tau*math.sqrt(3)),'remaining_to_solid_mm':d.SPRING_FREE-F/rate-solid})
x={'spring_wire_mm':d.WIRE,'mean_diameter_mm':d.SPRING_MEAN_D,'outer_diameter_mm':d.SPRING_MEAN_D+d.WIRE,'free_length_mm':d.SPRING_FREE,'active_coils':d.ACTIVE,'total_coils_assumed':d.ACTIVE+d.INACTIVE,'solid_height_mm':solid,'spring_index':C,'wahl_factor':wahl,'rate_N_per_mm':rate,'min_assumed_UTS_MPa':d.UTS_MIN,'gravity_deflection_frequency_Hz':math.sqrt(9.80665/(F_nom/rate/1000))/(2*math.pi),'stop_compression_mm':d.STOP_FORCE/rate,'stop_force_N':d.STOP_FORCE,'stop_FoS':d.UTS_MIN/(math.sqrt(3)*wahl*8*d.STOP_FORCE*d.SPRING_MEAN_D/(math.pi*d.WIRE**3)),'cases':rows}
x['stop_tolerance_case']={'spring_rate_factor':1.10,'stop_travel_increase_mm':1.0,'force_N':1.1*rate*(d.STOP_FORCE/rate+1.0)}
x['stop_tolerance_case']['FoS']=d.UTS_MIN/(math.sqrt(3)*wahl*8*x['stop_tolerance_case']['force_N']*d.SPRING_MEAN_D/(math.pi*d.WIRE**3))
open('output/spring-sizing.json','w').write(json.dumps(x,indent=2));print(json.dumps(x,indent=2))

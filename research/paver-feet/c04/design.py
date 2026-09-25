"""C04 TPU corrugated annular compression spring. Millimetres, one-piece print."""
import numpy as np
from scipy.interpolate import CubicSpline
BASE_OUT=70.0
BASE_IN=54.0
BASE_THICK=6.0
TOP_OUT=37.0
TOP_IN=23.0
TOP_Z=80.0
TOP_THICK=6.0
WALL=4.5
PROFILE_Z=np.array([4.,12.,24.,34.,44.,54.,64.,74.,81.])
PROFILE_R=np.array([59.,47.,58.,43.,55.,42.,50.,34.,31.])
def wall_polygon(n=220):
 z=np.linspace(PROFILE_Z[0],PROFILE_Z[-1],n)
 r=CubicSpline(PROFILE_Z,PROFILE_R,bc_type='natural')(z)
 outer=np.column_stack((r+WALL/2,z));inner=np.column_stack((r-WALL/2,z))[::-1]
 return np.vstack((outer,inner))

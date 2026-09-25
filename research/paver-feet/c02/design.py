"""C02 — wider, root-relieved TPU paver foot. Dimensions in mm."""
import numpy as np

REVISION='C02'
BASE_WIDTH=98.0
SEAT_Z=18.0
STOP_Z=2.0
PAVER_Z=45.0  # height added below slab, 1.496 in
PLATFORM_TOP=PAVER_Z-SEAT_Z
PAD_HALF=24.0
PAD_CHAMFER=6.0
RIM_IN=40.0
RIM_OUT=42.5
RIB_WIDTH=12.0
RIB_HEIGHT=10.0
SWEEP_DEG=20.0
LIP_HEIGHT=0.0  # operator requested a flat pad, no locating lips
PAVER_CORNER=-BASE_WIDTH/2  # entire foot fits beneath paver
PAVER_SIDE_REFERENCE=398.78  # Lowe's reference product: 15.7 in actual
PAVER_THICKNESS_REFERENCE=45.0  # operator estimate, not a fit requirement
PAVER_MASS=36*.45359237
PRINTER_MASS=12.95
NOMINAL_MASS=PAVER_MASS+PRINTER_MASS
MAX_MASS=35.0
MIN_MODULUS=5.0  # assumed design low end, not a material guarantee
REF_MODULUS=9.8
CORNER_FACTOR=1.3
SAG_DRIFT=1.5
RETAINED_GAP=3.0
COMPRESSION_ALLOWANCE=.8  # unmodeled pad/base compression and fit reserve
ECCENTRICITY=2.0  # illustrative local load offset toward paver interior

def pad_outline():
    a=PAD_HALF;c=PAD_CHAMFER
    return [(-a+c,-a),(a-c,-a),(a,-a+c),(a,a-c),(a-c,a),(-a+c,a),(-a,a-c),(-a,-a+c)]

def centerline(index,segments=64,sweep=None):
    t=np.linspace(0,1,segments+1)
    r=PAD_HALF+(RIM_IN-PAD_HALF)*t
    s=SWEEP_DEG if sweep is None else sweep
    angle=np.deg2rad(index*90+s*(3*t*t-2*t*t*t))
    return np.column_stack((r*np.cos(angle),r*np.sin(angle)))

def rib_outline(index):
    p=centerline(index)
    p=np.vstack((p[0]-1.5*(p[1]-p[0])/np.linalg.norm(p[1]-p[0]),p,
                 p[-1]+1.2*(p[-1]-p[-2])/np.linalg.norm(p[-1]-p[-2])))
    t=np.gradient(p,axis=0);t/=np.linalg.norm(t,axis=1)[:,None]
    n=np.column_stack((-t[:,1],t[:,0]))
    # Smooth 2 mm flare at both roots; beam analysis treats 12 mm constant width.
    u=np.linspace(0,1,len(p)); edge=np.maximum(0,1-u/.16)**2+np.maximum(0,1-(1-u)/.16)**2
    width=RIB_WIDTH+4*edge
    return np.vstack((p+width[:,None]/2*n,(p-width[:,None]/2*n)[::-1]))

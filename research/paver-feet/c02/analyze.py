"""C02 linear sizing, eccentric-clearance screen and coupled isolation model.

All stiffnesses are assumed effective values. The paver mass has a cited product
reference; ball stiffness, material loss and dynamic ratios are hypothetical.
"""
import json
from pathlib import Path
import numpy as np
from scipy.linalg import eigh
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mechanics import frame_end,skew,rib_stiffness
import design as d

OUT=Path('analysis');OUT.mkdir(exist_ok=True)

def hub_matrix(width,height,sweep,n=48):
    K=np.zeros((6,6))
    end=frame_end(d.centerline(0,n,sweep),width,height,d.REF_MODULUS)
    for i in range(4):
        a=i*np.pi/2;c,s=np.cos(a),np.sin(a)
        R=np.array([[c,-s,0],[s,c,0],[0,0,1]]);Q=np.kron(np.eye(2),R)
        point=d.centerline(i,n,sweep)[0]
        B=np.eye(6);B[:3,3:]=-skew([*point,-(d.PLATFORM_TOP-height/2)])
        K+=B.T@Q@end@Q.T@B
    return (K+K.T)/2

def movement(K,force,E,eccentricity=0):
    # Positive Z here means upward. Apply downward load at (+e,+e).
    F=np.array([0,0,-force,-force*eccentricity,force*eccentricity,0])
    q=np.linalg.solve(K*E/d.REF_MODULUS,F)
    sag=-q[2]
    rot=np.linalg.norm(q[3:5])
    # Maximum downward movement over central square stop and circular rim.
    at_stop=sag+9*(abs(q[3])+abs(q[4]))
    at_rim=sag+d.RIM_OUT*rot
    side_move=np.linalg.norm(q[:2])
    return dict(center_sag_mm=float(sag),stop_sag_mm=float(at_stop),
                rim_sag_mm=float(at_rim),tilt_deg=float(np.rad2deg(rot)),
                lateral_center_mm=float(side_move))

def clearance(K,height,mass,E,factor=1,ecc=0,drift=1):
    F=mass*9.80665/4*factor
    move=movement(K,F,E,ecc)
    stop=d.SEAT_Z-d.STOP_Z-drift*move['stop_sag_mm']-d.COMPRESSION_ALLOWANCE
    rim=d.PLATFORM_TOP-height-drift*move['rim_sag_mm']-d.COMPRESSION_ALLOWANCE
    # Circular socket to chamfered pad corners: lower part remains within radius 30.
    radial_gap=d.RIM_IN-np.hypot(d.PAD_HALF,d.PAD_HALF-d.PAD_CHAMFER)
    # Rigid-platform rotation causes displacement over its full depth.
    side=radial_gap-drift*(move['lateral_center_mm']+d.PLATFORM_TOP*np.deg2rad(move['tilt_deg']))
    return dict(mass_kg=mass,E_MPa=E,corner_factor=factor,eccentricity_mm=ecc,sag_multiplier=drift,
        force_N=F,**move,stop_clearance_mm=float(stop),paver_to_rim_clearance_mm=float(rim),
        conservative_radial_clearance_mm=float(side),passes=bool(stop>=d.RETAINED_GAP and rim>=d.RETAINED_GAP and side>=.8))

def optimize():
    rows=[];feasible=[]
    for sweep in [12.,15.,18.,21.,24.,27.,30.]:
        for width in [4.,4.8,5.6,6.4,7.2,8.]:
            for height in [8.,8.8,9.6,10.4,11.2,12.]:
                k=4*rib_stiffness(d.centerline(0,24,sweep),width,height,d.REF_MODULUS)['k']
                approximate_sag=d.MAX_MASS*9.80665/4*d.CORNER_FACTOR/(k*d.MIN_MODULUS/d.REF_MODULUS)*d.SAG_DRIFT
                if approximate_sag>min(d.SEAT_Z-d.STOP_Z,d.PLATFORM_TOP-height)-d.RETAINED_GAP-d.COMPRESSION_ALLOWANCE:
                    rows.append(dict(sweep=sweep,width=width,height=height,k_screen=k,passes=False));continue
                K=hub_matrix(width,height,sweep,32)
                case=clearance(K,height,d.MAX_MASS,d.MIN_MODULUS,d.CORNER_FACTOR,d.ECCENTRICITY,d.SAG_DRIFT)
                row=dict(sweep=sweep,width=width,height=height,k_screen=k,k_center=float(K[2,2]),**case)
                rows.append(row)
                if case['passes']:feasible.append(row)
    feasible.sort(key=lambda r:r['k_center'])
    assert feasible,'No candidate met clearance constraints'
    (OUT/'sweep.json').write_text(json.dumps(dict(candidates=rows,ranked=feasible),indent=2))
    print('Selected softest feasible in discrete grid:',json.dumps(feasible[0]))
    return feasible[0]

def chain(f,k_lower,E=9.8,ball_k=20,loss=.3,dynamic_ratio=1,paver_mass=d.PAVER_MASS,with_lower=True,with_upper_tpu=True):
    """Force applied at printer -> ball -> P02 (optional) -> paver -> new feet.
    Fixed shelf. Shared assumed material loss for this illustration.
    """
    scale=E/d.REF_MODULUS*dynamic_ratio
    masses=[d.PRINTER_MASS];springs=[4*ball_k*1000]
    if with_upper_tpu:
        masses.append(.08)  # hypothetical moving parts of four P02 cradles
        springs.append(4*14.24774935257176*scale*1000)
    if with_lower:
        masses.append(paver_mass+.2) # hypothetical moving pads included with slab
        springs.append(4*k_lower*scale*1000)
    n=len(masses);K=np.zeros((n,n))
    for i,k in enumerate(springs):
        K[i,i]+=k
        if i+1<n:K[i+1,i+1]+=k;K[i,i+1]-=k;K[i+1,i]-=k
    M=np.diag(masses);w=2*np.pi*np.asarray(f)
    A=K[None,:,:]*(1+1j*loss)-w[:,None,None]**2*M[None,:,:]
    F=np.zeros((len(w),n),dtype=complex);F[:,0]=1
    x=np.linalg.solve(A,F[...,None])[...,0]
    T=np.abs(springs[-1]*(1+1j*loss)*x[:,-1])
    modes=np.sqrt(eigh(K,M,eigvals_only=True))/(2*np.pi)
    return T,modes

def main():
    K=hub_matrix(d.RIB_WIDTH,d.RIB_HEIGHT,d.SWEEP_DEG,80)
    Kfine=hub_matrix(d.RIB_WIDTH,d.RIB_HEIGHT,d.SWEEP_DEG,160)
    independent=4*rib_stiffness(d.centerline(0,80),d.RIB_WIDTH,d.RIB_HEIGHT,d.REF_MODULUS)['k']
    assert abs(K[2,2]/independent-1)<1e-8
    assert np.all(np.linalg.eigvalsh(K)>0)
    convergence=abs(Kfine[2,2]/K[2,2]-1);assert convergence<.005
    cases=[clearance(K,d.RIB_HEIGHT,m,E,fac,ecc,drift)
           for m in [d.NOMINAL_MASS,35.,45.] for E in [5.,7.4,9.8,15.,26.]
           for fac,ecc in [(1.,0.),(1.3,2.)] for drift in [1.,1.5]]
    design_case=clearance(K,d.RIB_HEIGHT,35,5,1.3,2,1.5)
    assert design_case['passes'],design_case
    freq=np.geomspace(.5,200,600)
    nominal,modes=chain(freq,K[2,2]);old,_=chain(freq,K[2,2],with_lower=False)
    assert abs(chain(np.array([0.]),K[2,2])[0][0]-1)<1e-10
    minT=np.full(len(freq),np.inf);maxT=np.zeros(len(freq));scores=[];count=0
    for E in [5.,7.4,9.8,15.,26.]:
        for ball in [5.,20.,100.]:
            for loss in [.1,.3,.6]:
                for dyn in [1.,2.]:
                    t,md=chain(freq,K[2,2],E,ball,loss,dyn)
                    minT=np.minimum(minT,t);maxT=np.maximum(maxT,t);count+=1
                    scores.append(dict(E_MPa=E,ball_k=ball,loss_factor=loss,dynamic_ratio=dyn,modes_Hz=md.tolist()))
    report=dict(revision=d.REVISION,k_center_N_mm=float(K[2,2]),K_N_mm_rad=K.tolist(),convergence=float(convergence),
        unit_center_response=movement(K,1,d.REF_MODULUS,0),unit_offset_response=movement(K,1,d.REF_MODULUS,2),
        reference_modulus_MPa=d.REF_MODULUS,compression_allowance_mm=d.COMPRESSION_ALLOWANCE,
        nominal_mass_kg=d.NOMINAL_MASS,paver_mass_kg=d.PAVER_MASS,design_case=design_case,cases=cases,
        nominal_modes_Hz=modes.tolist(),frequency_cases=count,frequency_scenarios=scores,
        transfer_samples=[dict(f_Hz=f,existing_force_ratio=float(chain(np.array([f]),K[2,2],with_lower=False)[0][0]),
                               new_force_ratio=float(chain(np.array([f]),K[2,2])[0][0])) for f in [5.,10.,20.,30.,50.,100.]],
        assumptions=dict(paver_reference='Lowe’s 16-inch square model 104801256, 36 lb; actual purchase unconfirmed',
            printer='P1S without AMS, 12.95 kg reference',
            material='5 MPa assumed low-end effective stiffness; actual TPU unspecified',
            worst_load='35 kg combined, 30% extra on one corner, load offset +2 mm in X and Y',
            drift='1.5× displacement stress test, not a creep law',
            compression_reserve_mm=d.COMPRESSION_ALLOWANCE,
            dynamics='Vertical 3-mass model with existing squash balls and P02 feet above paver; fixed shelf',
            limits='Linear beam screening only; thick short ribs, anisotropy, large strain, contacts and table modes unmodeled'))
    (OUT/'results.json').write_text(json.dumps(report,indent=2))
    plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.dpi':160})
    fig,ax=plt.subplots(figsize=(10,5.5))
    ax.fill_between(freq,20*np.log10(minT),20*np.log10(maxT),color='#008e9c',alpha=.15,label=f'{count} assumed-property cases, new stack')
    ax.semilogx(freq,20*np.log10(old),color='#666',ls='--',label='Existing ball + P02, rigid shelf')
    ax.semilogx(freq,20*np.log10(nominal),color='#008e9c',label='Add paver + corner feet, reference case')
    ax.axhline(0,color='#666',lw=1);ax.set(xlabel='Frequency (Hz)',ylabel='Force delivered to shelf / applied force (dB)',
        title='Two isolation stages: more attenuation above their coupled resonances',ylim=(-100,35));ax.grid(alpha=.2);ax.legend(fontsize=9)
    fig.text(.1,.015,'Illustrative force model, not sound reduction. Reference: E=9.8 MPa, ball k=20 N/mm, loss factor=0.30.',fontsize=9)
    fig.tight_layout(rect=[0,.04,1,1]);fig.savefig(OUT/'stack-transmission.png');plt.close(fig)
    print(json.dumps({k:v for k,v in report.items() if k not in ['cases','K_N_mm_rad','frequency_scenarios']},indent=2))

if __name__=='__main__':
    import sys
    if '--optimize' in sys.argv:optimize()
    else:main()

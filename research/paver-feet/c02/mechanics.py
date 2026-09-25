"""Linear beam helpers, independently checked in the P1S foot review. N, mm, MPa."""
import numpy as np

def skew(v):
    x,y,z=v
    return np.array([[0,-z,y],[z,0,-x],[-y,x,0]])


def frame_end(points,b,h,E=9.8,nu=.49):
    """6x6 inner-end stiffness, outer end fixed, interior DOFs condensed."""
    n=len(points); K=np.zeros((6*n,6*n)); G=E/(2*(1+nu)); A=b*h
    a,c=max(b,h),min(b,h)
    J=a*c**3*(1/3-.21*c/a*(1-c**4/(12*a**4)))
    for i,(p,q) in enumerate(zip(points[:-1],points[1:])):
        L=np.linalg.norm(q-p); x,y=(q-p)/L
        R=np.array([[x,y,0],[-y,x,0],[0,0,1]])
        T=np.kron(np.eye(4),R); k=np.zeros((12,12))
        for ids,coefficient in [([0,6],E*A/L),([3,9],G*J/L)]:
            k[np.ix_(ids,ids)]=coefficient*np.array([[1,-1],[-1,1]])
        for ids,I,sign in [([1,5,7,11],h*b**3/12,1),([2,4,8,10],b*h**3/12,-1)]:
            phi=12*E*I/((5/6)*G*A*L**2); s=sign
            B=E*I/(L**3*(1+phi))*np.array([
                [12,s*6*L,-12,s*6*L],
                [s*6*L,(4+phi)*L*L,-s*6*L,(2-phi)*L*L],
                [-12,-s*6*L,12,-s*6*L],
                [s*6*L,(2-phi)*L*L,-s*6*L,(4+phi)*L*L]])
            k[np.ix_(ids,ids)]=B
        ix=np.arange(6*i,6*i+12);K[np.ix_(ix,ix)]+=T.T@k@T
    free=np.arange(6,6*n-6)
    return K[:6,:6]-K[:6,free]@np.linalg.solve(K[np.ix_(free,free)],K[free,:6])


def rib_stiffness(points, width, height, E, nu=.49):
    n = len(points)
    K = np.zeros((3*n, 3*n))
    G = E/(2*(1+nu))
    A, I = width*height, width*height**3/12
    a,b = max(width,height), min(width,height)
    J = a*b**3*(1/3-.21*b/a*(1-b**4/(12*a**4)))
    elements=[]
    for i,(p,q) in enumerate(zip(points[:-1],points[1:])):
        L = np.linalg.norm(q-p)
        tx,ty = (q-p)/L
        # local coordinates [w, rotation about tangent, rotation about normal]
        R=np.array([[1,0,0],[0,tx,ty],[0,-ty,tx]])
        T=np.zeros((6,6)); T[:3,:3]=R; T[3:,3:]=R
        phi=12*E*I/((5/6)*G*A*L**2)
        B=E*I/(L**3*(1+phi))*np.array([
            [12,-6*L,-12,-6*L],
            [-6*L,(4+phi)*L**2,6*L,(2-phi)*L**2],
            [-12,6*L,12,6*L],
            [-6*L,(2-phi)*L**2,6*L,(4+phi)*L**2]])
        k=np.zeros((6,6)); ids=[0,2,3,5]; k[np.ix_(ids,ids)]=B
        k[np.ix_([1,4],[1,4])]=G*J/L*np.array([[1,-1],[-1,1]])
        ix=np.arange(3*i,3*i+6)
        K[np.ix_(ix,ix)]+=T.T@k@T
        elements.append((ix,T,k))
    u=np.zeros(3*n); u[0]=1
    free=np.arange(3,3*n-3)
    u[free]=np.linalg.solve(K[np.ix_(free,free)],-K[free,0])
    reaction=K@u
    # Nominal bending strain, excludes fillet concentrations and torsional strain.
    max_strain=0
    max_twist=0
    for ix,T,k in elements:
        force=k@T@u[ix]
        max_strain=max(max_strain, max(abs(force[2]),abs(force[5]))*height/(2*E*I))
        max_twist=max(max_twist,abs(force[1]))
    return dict(k=float(reaction[0]),length=float(np.linalg.norm(np.diff(points,axis=0),axis=1).sum()),
                bending_strain_per_mm=float(max_strain), torque_per_mm=float(max_twist),
                equilibrium_error=float(abs(reaction[0]+reaction[-3])))

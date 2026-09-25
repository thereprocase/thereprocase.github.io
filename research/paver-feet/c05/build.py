"""Generate reference closed-wall STL, STEP, and actual vase-mode spiral centerline."""
from pathlib import Path
import numpy as np
import trimesh
import cadquery as cq
from design import *

out = Path('output'); out.mkdir(exist_ok=True)
nt, nz = 480, 251
theta = 2 * np.pi * np.arange(nt) / nt
z = np.linspace(0, HEIGHT, nz)
v = []
for zz in z:
    rr = radius(theta, zz)
    for offset in (WALL / 2, -WALL / 2):
        rad = rr + offset
        v.extend(np.column_stack((rad * np.cos(theta), rad * np.sin(theta), np.full(nt, zz))))
v = np.asarray(v)
f = []
for j in range(nz - 1):
    for k in range(2):
        for i in range(nt):
            i1 = (i + 1) % nt
            a = (j * 2 + k) * nt + i
            b = (j * 2 + k) * nt + i1
            c = ((j + 1) * 2 + k) * nt + i
            d = ((j + 1) * 2 + k) * nt + i1
            f.extend(((a, b, d), (a, d, c)) if k == 0 else ((a, d, b), (a, c, d)))
for j in (0, nz - 1):
    for i in range(nt):
        i1 = (i + 1) % nt
        a, b = (j * 2) * nt + i, (j * 2) * nt + i1
        c, d = (j * 2 + 1) * nt + i, (j * 2 + 1) * nt + i1
        f.extend(((a, c, d), (a, d, b)) if j == 0 else ((a, d, c), (a, b, d)))
m = trimesh.Trimesh(vertices=v, faces=np.asarray(f), process=True)
assert m.is_watertight and len(m.split()) == 1
if m.volume < 0: m.invert()
m.export(out / 'C05-petal-vase-1mm.stl')
# STEP loft uses periodic polygonal wires; it is a reference solid for editing.
wires = []
for zz in np.linspace(0, HEIGHT, 41):
    t = 2 * np.pi * np.arange(121) / 120
    rr = radius(t, zz)
    outer = cq.Wire.makePolygon([cq.Vector(float(r * np.cos(a)),float(r * np.sin(a)),float(zz)) for a,r in zip(t,rr+WALL/2)], close=True)
    inner = cq.Wire.makePolygon([cq.Vector(float(r * np.cos(a)),float(r * np.sin(a)),float(zz)) for a,r in zip(t,rr-WALL/2)], close=True)
    wires.append((outer,inner))
try:
    shell_out = cq.Solid.makeLoft([w[0] for w in wires], ruled=False)
    shell_in = cq.Solid.makeLoft([w[1] for w in wires], ruled=False)
    solid = shell_out.cut(shell_in)
    assert solid.isValid()
    cq.exporters.export(solid, str(out/'C05-petal-vase-1mm.step'))
except Exception as ex:
    print('STEP export unavailable:',ex)

# One continuous path: every revolution rises one 0.16 mm layer.
turns = HEIGHT / LAYER
n = int(np.ceil(turns * 360)) + 1
angle = np.linspace(0, 2 * np.pi * turns, n)
height = HEIGHT * np.arange(n) / (n - 1)
r = radius(angle, height)
path = np.column_stack((r * np.cos(angle), r * np.sin(angle), height))
np.savetxt(out/'C05-vase-spiral-centerline.csv', path, delimiter=',', header='x_mm,y_mm,z_mm', comments='')
probe_z = np.linspace(0, HEIGHT - LAYER, 501)
probe_theta = np.linspace(0, 2*np.pi, 721)
max_slope = np.max(np.abs(radius(probe_theta[None,:], (probe_z+LAYER)[:,None]) - radius(probe_theta[None,:], probe_z[:,None])) / LAYER)
print('watertight',m.is_watertight,'volume_mm3',round(m.volume,1),'mass_g_at_1.21',round(m.volume*.00121,1),'bounds',m.bounds.tolist())
print('path points',len(path),'turns',turns,'max radial overhang slope',round(max_slope,3),'shift per layer',round(max_slope*LAYER,3))

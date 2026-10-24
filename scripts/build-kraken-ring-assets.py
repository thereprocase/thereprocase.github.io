"""Write the browser inputs for /kraken-rings/ from humebeam's original Kraken files.

Usage (CAD venv with manifold3d 2.5 and NumPy):
    python scripts/build-kraken-ring-assets.py KRAKEN_REMIX_CHECKOUT NUT_STL

For each stock ring 45..95 mm the asset holds only what generate_family.build_pair
reads from the source mesh: the source solid inside the 22.5 mm preserved-core
cylinder plus the source's 0.4 mm lip slab. The browser kernel repeats the same
booleans on it, so its output matches the Python generator. The 51 originals
tessellate the shared core differently (about 1.3-4 mm3 apart), so one shared
core cannot reproduce every published size.

The nut asset is humebeam's nut.stl with exact duplicate vertices merged, as
build_nut.read_stl does; coordinates keep their original float32 values.
"""
import hashlib
import json
import re
import struct
import sys
import zipfile
from pathlib import Path

import manifold3d as mf
import numpy as np

SITE = Path(__file__).resolve().parents[1] / 'public' / 'kraken-rings' / 'assets'
VERT = re.compile(rb'<vertex x="([-\d.e]+)" y="([-\d.e]+)" z="([-\d.e]+)"')
TRI = re.compile(rb'<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"')
OBJ = re.compile(rb'<object id="(\d+)"[^>]*>(.*?)</object>', re.S)


def load_3mf(path):
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if name.endswith('.model'):
                for oid, body in OBJ.findall(archive.read(name)):
                    if oid == b'1':
                        return (np.array(VERT.findall(body), dtype=float),
                                np.array(TRI.findall(body), dtype=np.int64))
    raise KeyError(path)


def manifold_of(v, t):
    mesh = mf.Mesh64(np.asarray(v, float), np.asarray(t, np.uint64))
    mesh.merge()
    return mf.Manifold(mesh)


def pack(v, t):
    """KRM1: magic, vertex count, triangle count, index bytes, float32 xyz, indices."""
    v = np.asarray(v, '<f4')
    t = np.asarray(t)
    width = 2 if len(v) < 65536 else 4
    head = b'KRM1' + struct.pack('<III', len(v), len(t), width)
    body = v.tobytes() + t.astype('<u2' if width == 2 else '<u4').tobytes()
    return head + body


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main(checkout, nut_stl):
    reference = Path(checkout) / 'rings' / 'source' / 'reference'
    SITE.mkdir(parents=True, exist_ok=True)
    record = dict(
        description='Inputs for the Kraken spool ring generator and nut remixer. Derived from humebeam\'s '
                    'original Kraken files (CC BY-NC 4.0): https://www.printables.com/model/1788417-kraken-revolutionary-bambu-lab-ams',
        format='KRM1 little-endian: "KRM1", uint32 vertices, uint32 triangles, uint32 index bytes, float32 xyz, indices',
        cores={}, nut={})
    for size in range(45, 96):
        source = reference / f'kraken-spool-ring-{size}-mm-100.3mf'
        v, t = load_3mf(source)
        # Same centring as generate_family.main: bounding-box centre in X/Y, base at Z0.
        shift = np.r_[(v.min(0) + v.max(0))[:2] / 2, v[:, 2].min()]
        stock = manifold_of(v - shift, t)
        assert stock.status() == mf.Error.NoError and len(stock.decompose()) == 1
        height = stock.bounding_box()[5]
        radius = size / 2
        keep = mf.Manifold.cylinder(height + 2, 22.5, 22.5, 256).translate((0, 0, -1))
        lip = mf.Manifold.cube((2 * (radius + 5), 2 * (radius + 5), 0.4)).translate((-radius - 5, -radius - 5, 0))
        region = stock ^ (keep + lip)
        mesh = region.to_mesh64()
        data = pack(np.asarray(mesh.vert_properties)[:, :3], np.asarray(mesh.tri_verts))
        name = f'core-{size}.bin'
        (SITE / name).write_bytes(data)
        record['cores'][str(size)] = dict(file=name, sha256=sha(data), bytes=len(data), height_mm=height,
                                          volume_mm3=region.volume(), source=source.name,
                                          source_sha256=sha(source.read_bytes()))
        print(size, len(data), flush=True)
    raw = Path(nut_stl).read_bytes()
    count = int.from_bytes(raw[80:84], 'little')
    facets = np.frombuffer(raw, dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]), count=count, offset=84)
    v, t = np.unique(facets['v'].reshape(-1, 3), axis=0, return_inverse=True)
    nut = manifold_of(v.astype(float), t.reshape(-1, 3))
    assert nut.status() == mf.Error.NoError
    data = pack(v, t.reshape(-1, 3))
    (SITE / 'nut.bin').write_bytes(data)
    record['nut'] = dict(file='nut.bin', sha256=sha(data), bytes=len(data), volume_mm3=nut.volume(),
                         bounds_mm=list(nut.bounding_box()), source='nut.stl (humebeam, Kraken)', source_sha256=sha(raw))
    (SITE / 'provenance.json').write_text(json.dumps(record, indent=1) + '\n')


if __name__ == '__main__':
    main(*sys.argv[1:3])

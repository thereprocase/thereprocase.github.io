"""Independent STL checks; requires trimesh, numpy and scipy."""
import json
import pathlib
import sys
import trimesh

root = pathlib.Path(sys.argv[1])
results = []
files = sorted(root.glob('*.stl.*.stl')) + sorted(root.glob('*.step.*.stl')) + sorted(root.glob('*.3mf.*.stl'))
for path in files:
    # Merge coincident STL vertices, without repairing holes or winding.
    mesh = trimesh.load_mesh(path, process=True)
    shells = mesh.split(only_watertight=False)
    record = {
        'file': path.name,
        'watertight': bool(mesh.is_watertight),
        'consistentWinding': bool(mesh.is_winding_consistent),
        'positiveVolume': bool(mesh.volume > 0),
        'positiveShells': int(sum(shell.volume > 1e-6 for shell in shells)),
        'negativeShells': int(sum(shell.volume < -1e-6 for shell in shells)),
        'volume': float(mesh.volume),
        'triangles': len(mesh.faces),
    }
    record['pass'] = (record['watertight'] and record['consistentWinding']
                      and record['positiveVolume'] and record['positiveShells'] == 1)
    results.append(record)
(root / 'independent.json').write_text(json.dumps(results, indent=2) + '\n')
print(len(results), 'STL exports checked;', sum(r['pass'] for r in results), 'passed')
for record in results:
    if not record['pass']:
        print(record)
if not results or not all(record['pass'] for record in results):
    raise SystemExit('Independent export checks failed')

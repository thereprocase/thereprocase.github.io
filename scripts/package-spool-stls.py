"""Create a reproducible fallback bundle from the verified E13 STL copies."""
from pathlib import Path
from hashlib import sha256
import json
import zipfile

root = Path(__file__).resolve().parents[1] / 'public' / 'spool-wall-rack'
files = ['body-only.stl', 'helper-1.stl', 'helper-2.stl', 'README.txt']
bundle = root / 'downloads' / 'e13-stl-bundle.zip'
with zipfile.ZipFile(bundle, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        entry = zipfile.ZipInfo(name, (2026, 9, 10, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, (root / 'downloads' / name).read_bytes())
with zipfile.ZipFile(bundle) as archive:
    assert archive.namelist() == files
    assert archive.testzip() is None
    for name in files:
        assert archive.read(name) == (root / 'downloads' / name).read_bytes()
record_path = root / 'assets' / 'provenance.json'
record = json.loads(record_path.read_text(encoding='utf-8'))
content = bundle.read_bytes()
record['bundles'] = [{
    'published': '/spool-wall-rack/downloads/e13-stl-bundle.zip',
    'files': files, 'bytes': len(content), 'sha256': sha256(content).hexdigest()
}]
record_path.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(f'Packaged and verified {len(files)} files in the STL fallback bundle.')

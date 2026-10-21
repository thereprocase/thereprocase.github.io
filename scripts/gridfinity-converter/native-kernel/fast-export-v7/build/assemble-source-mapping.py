from pathlib import Path
import subprocess,json,difflib,hashlib,shutil,re
root=Path('/home/repro/fast-export-v7-source-bundle');site=Path('/home/repro/fast-export-v7-site/gridfinity-converter');repo='/home/repro/gridfinity-fast-release';commit='9379c78024488dad947cce729ebfc363700b572a'
names=sorted([p.name for p in site.iterdir() if p.is_file() and p.suffix in ['.js','.css','.html']]+['vendor/replicad/replicad.js'])
baseprefix='public/gridfinity-converter/'
tokens=['native-step-20261021-2','fast-export-20261021-025000']
def norm(s):
 for token in tokens:s=s.replace(token,'<BUILD_TOKEN>')
 return s.replace('<script src="/diagnostics-fast-export-v7.js?v=<BUILD_TOKEN>"></script>','')
exact=[];logical=[];mapping=[]
for name in names:
 target=(site/name).read_text();result=subprocess.run(['git','-C',repo,'show',commit+':'+baseprefix+name],capture_output=True)
 old=result.stdout.decode() if result.returncode==0 else ''
 dest=root/'source'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(target)
 changed=norm(old)!=norm(target)
 mapping.append({'path':name,'baselineSHA256':hashlib.sha256(old.encode()).hexdigest() if old else None,'candidateSHA256':hashlib.sha256(target.encode()).hexdigest(),'logicalChanged':changed})
 exact.extend(difflib.unified_diff(old.splitlines(True),target.splitlines(True),fromfile='a/'+baseprefix+name if old else '/dev/null',tofile='b/'+baseprefix+name))
 if changed:logical.extend(difflib.unified_diff(norm(old).splitlines(True),norm(target).splitlines(True),fromfile='a/'+baseprefix+name if old else '/dev/null',tofile='b/'+baseprefix+name))
(root/'patches/public-v3-to-v7-exact.diff').write_text(''.join(exact));(root/'patches/public-v3-to-v7-logical-review.diff').write_text(''.join(logical))
vendor=[x for x in exact] # Separate reviewable vendor ownership diff.
name='vendor/replicad/replicad.js';old=subprocess.check_output(['git','-C',repo,'show',commit+':'+baseprefix+name]).decode();new=(site/name).read_text()
(root/'patches/vendor-replicad-ownership.diff').write_text(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+baseprefix+name,tofile='b/'+baseprefix+name)))
artifacts={}
for p in site.joinpath('vendor').rglob('*'):
 if p.is_file() and (p.suffix=='.wasm' or p.name.endswith('_pool4.js') or p.name.startswith('topology_copy_guarded_multi')):
  artifacts[str(p.relative_to(site))]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'included':False}
(root/'source-mapping.json').write_text(json.dumps({'baselineCommit':commit,'baselinePath':baseprefix,'candidateSite':str(site),'normalizations':{'literalBuildTokens':tokens,'removedPrivateScript':'<script src="/diagnostics-fast-export-v7.js?v=<BUILD_TOKEN>"></script>'},'files':mapping,'binaryAndGeneratedArtifactHashes':artifacts},indent=2))

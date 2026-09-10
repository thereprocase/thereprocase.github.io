// Copy the exact published engineering assets; do not regenerate scientific figures.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Usage: node scripts/sync-spool-rack.mjs <spool-wall-rack checkout>');
const revision = '5e95cbf5544b205bdf2b73611d24ce3f826e837d';
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
if (actual !== revision) throw new Error('Expected the published E13 source revision. Review the page and asset list before updating.');
const design = 'designs/closed-wall-e13/';
const analysis = 'analysis/e13/';
const files = [
  ...['progress-exterior.png', 'depth-comparison.png', 'finish-inner-front.png', 'engineering-drawing.png', 'modifier-stack.png', 'toolpath-sections.png'].map(name => [design + name, 'assets/' + name]),
  ...['fem-3d.png', 'fem-sections.png', 'hotspot-comparison.png'].map(name => [analysis + name, 'assets/' + name]),
  ...['bracket-with-modifier-helpers.step', 'body-only.stl', 'helper-1.stl', 'helper-2.stl'].map(name => [design + name, 'downloads/' + name]),
];
const target = path.join(root, 'public', 'spool-wall-rack');
const records = [];
for (const [sourcePath, destination] of files) {
  const content = await readFile(path.join(sourceRoot, sourcePath));
  const committed = execFileSync('git', ['show', `${revision}:${sourcePath}`], { cwd: sourceRoot, maxBuffer: 25_000_000 });
  if (!content.equals(committed)) throw new Error(`Local source differs from published E13: ${sourcePath}`);
  const output = path.join(target, destination);
  await mkdir(path.dirname(output), { recursive: true });
  await copyFile(path.join(sourceRoot, sourcePath), output);
  const record = { source: sourcePath, published: '/spool-wall-rack/' + destination, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
  if (destination.endsWith('.png')) Object.assign(record, { width: content.readUInt32BE(16), height: content.readUInt32BE(20) });
  records.push(record);
}
await writeFile(path.join(target, 'assets', 'provenance.json'), JSON.stringify({ source_repository: 'https://github.com/thereprocase/spool-wall-rack', revision, design_revision: 'E13', files: records }, null, 2) + '\n');
console.log(`Verified and copied ${records.length} original E13 assets.`);

import { cp, mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = path.join(root, 'dist', 'client');
const published = path.join(root, 'docs');
await mkdir(published, { recursive: true });
await cp(built, published, { recursive: true });
// Keep the framework's flat output and add canonical directory URLs for Pages.
const projectFiles = await readdir(path.join(built, 'projects'));
let pages = 0;
for (const file of projectFiles) {
  if (!file.endsWith('.html')) continue;
  const directory = path.join(published, 'projects', file.slice(0, -5));
  await mkdir(directory, { recursive: true });
  await copyFile(path.join(built, 'projects', file), path.join(directory, 'index.html'));
  pages += 1;
}
if (pages !== 19) throw new Error(`Expected 19 public project pages; received ${pages}. Update this check when curating the registry.`);
await writeFile(path.join(published, '.nojekyll'), '');
console.log(`Exported the index and ${pages} project landing pages to docs/.`);

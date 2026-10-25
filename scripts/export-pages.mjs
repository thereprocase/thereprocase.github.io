import { cp, mkdir, readdir, copyFile, writeFile, readFile, access } from 'node:fs/promises';
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
if (pages !== 21) throw new Error(`Expected 21 public project pages; received ${pages}. Update this check when curating the registry.`);
await mkdir(path.join(published, 'spool-wall-rack'), { recursive: true });
await copyFile(path.join(built, 'spool-wall-rack.html'), path.join(published, 'spool-wall-rack', 'index.html'));
await writeFile(path.join(published, '.nojekyll'), '');
// The sitemap lists every page the home page links to on this host, so it follows the catalogue
// instead of a hand-kept list. Pages served from other repositories' Pages sites are included too:
// they share this origin and the home page is how visitors reach them.
const home = await readFile(path.join(published, 'index.html'), 'utf8');
const site = 'https://thereprocase.github.io';
const paths = new Set(['/']);
for (const [, href] of home.matchAll(/href="(\/[^"#?]*\/)(?:[#?][^"]*)?"/g)) paths.add(href);
for (const file of projectFiles) if (file.endsWith('.html')) paths.add(`/projects/${file.slice(0, -5)}/`);
const exists = async file => access(file).then(() => true, () => false);
const urls = [];
for (const href of [...paths].sort()) {
  // Skip redirect stubs: they point visitors elsewhere and carry their own canonical link.
  const local = path.join(published, href, 'index.html');
  if (await exists(local) && (await readFile(local, 'utf8')).includes('http-equiv="refresh"')) continue;
  urls.push(`  <url><loc>${site}${href}</loc></url>`);
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
await writeFile(path.join(published, 'sitemap.xml'), sitemap);
await writeFile(path.join(root, 'public', 'sitemap.xml'), sitemap);
console.log(`Exported the index and ${pages} project landing pages to docs/, with ${urls.length} sitemap URLs.`);

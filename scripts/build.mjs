import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const now = new Date();
const source = JSON.parse(await readFile(join(root, 'content/content.json'), 'utf8'));
const isVisible = item => item.visibility === 'public' || (item.visibility === 'scheduled' && item.releaseAt && new Date(item.releaseAt) <= now);

await rm(join(root, 'dist'), { recursive: true, force: true });
await mkdir(join(root, 'dist'), { recursive: true });
await cp(join(root, 'public'), join(root, 'dist'), { recursive: true, force: true });
await mkdir(join(root, 'dist/data'), { recursive: true });
await mkdir(join(root, 'dist/materials'), { recursive: true });

async function publishFiles(items) {
  const published = [];
  for (const item of (items || []).filter(isVisible)) {
    const output = { ...item, available: false };
    if (item.file) {
      const inputPath = join(root, 'source-materials', item.file);
      try {
        await stat(inputPath);
        const outputPath = join(root, 'dist/materials', item.file);
        await mkdir(dirname(outputPath), { recursive: true });
        await cp(inputPath, outputPath);
        output.file = `materials/${item.file}`;
        output.available = true;
      } catch {
        console.warn(`Warning: ${item.file} was listed but not found; showing “Coming soon”.`);
        output.file = '';
      }
    }
    published.push(output);
  }
  return published;
}

const labs = await publishFiles(source.labs);
const resources = await publishFiles(source.resources);

const deployed = {
  ...source,
  announcements: source.announcements.filter(isVisible),
  resources,
  labs,
  buildTime: now.toISOString()
};
await writeFile(join(root, 'dist/data/content.json'), `${JSON.stringify(deployed, null, 2)}\n`);

let modules = { labs: [] };
try {
  modules = JSON.parse(await readFile(join(root, 'content/modules.json'), 'utf8'));
} catch {
  console.warn('Warning: content/modules.json not found; Extra materials section will be empty.');
}
await writeFile(join(root, 'dist/data/modules.json'), `${JSON.stringify(modules, null, 2)}\n`);

try {
  await stat(join(root, 'source-materials/diagrams'));
  await cp(join(root, 'source-materials/diagrams'), join(root, 'dist/materials/diagrams'), { recursive: true });
} catch {}

await writeFile(join(root, 'dist/.nojekyll'), '');
const moduleCount = modules.labs.reduce((total, lab) => total + (lab.modules || []).length, 0);
console.log(`Built site with ${deployed.announcements.length} announcement(s), ${resources.length} resource(s), ${labs.length} visible lab(s), and ${moduleCount} extra-material module(s).`);

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

const labs = [];
for (const lab of source.labs.filter(isVisible)) {
  const output = { ...lab, available: false };
  if (lab.file) {
    const inputPath = join(root, 'source-materials', lab.file);
    try {
      await stat(inputPath);
      const outputPath = join(root, 'dist/materials', lab.file);
      await mkdir(dirname(outputPath), { recursive: true });
      await cp(inputPath, outputPath);
      output.file = `materials/${lab.file}`;
      output.available = true;
    } catch {
      console.warn(`Warning: ${lab.file} was listed but not found; showing “Coming soon”.`);
      output.file = '';
    }
  }
  labs.push(output);
}

const deployed = {
  ...source,
  announcements: source.announcements.filter(isVisible),
  labs,
  buildTime: now.toISOString()
};
await writeFile(join(root, 'dist/data/content.json'), `${JSON.stringify(deployed, null, 2)}\n`);
await writeFile(join(root, 'dist/.nojekyll'), '');
console.log(`Built site with ${deployed.announcements.length} announcement(s) and ${labs.length} visible lab(s).`);

// Copies only what the browser needs into _site/ (no tests, tools or source art).
import { cp, mkdir, rm, writeFile, stat } from 'node:fs/promises';

const OUT = '_site';
const ENTRIES = ['index.html', 'styles.css', 'src', 'assets/img', 'assets/fonts', 'assets/sfx'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const e of ENTRIES) {
  try {
    await stat(e);
  } catch {
    continue; // optional folders (assets/sfx)
  }
  await cp(e, `${OUT}/${e}`, { recursive: true });
}
await writeFile(`${OUT}/.nojekyll`, '');
console.log(`site ready in ${OUT}/`);

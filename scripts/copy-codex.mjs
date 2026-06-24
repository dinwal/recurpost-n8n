// Copies n8n codex files (*.node.json) into dist.
//
// @n8n/node-cli's `n8n-node build` (as of 0.36.x) only copies png/svg and
// __schema__ JSON into dist — it does NOT copy the codex `*.node.json` files.
// n8n auto-discovers codex by filename next to the compiled .node.js, and the
// n8n Creator Portal verification reads fields from it (e.g. the `node` prefix),
// so the codex must be present in the published package. This postbuild step
// restores that file. Remove it if a future CLI version copies codex itself.

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const codexFiles = ['nodes/RecurPost/RecurPost.node.json'];

for (const src of codexFiles) {
  if (!existsSync(src)) {
    console.error(`copy-codex: source not found: ${src}`);
    process.exit(1);
  }
  const dest = `dist/${src}`;
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  console.log(`copy-codex: ${src} -> ${dest}`);
}

// Builds nodes/RecurPost/catalog.json from the RecurPost API docs.
//
// Usage: node scripts/sync-catalog.mjs [path-to-recurpost-apis]
// The docs path defaults to ../recurpost-apis (next to this repo). The script reads
// data/endpoints/*.json there (one file per module) and writes one compact catalog
// that the node builds its resources, operations and fields from. Re-run it after a
// docs change to bring new endpoints and params into the node.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MAX_EXAMPLE_LENGTH = 160;

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  hellip: '...',
  rarr: '->',
  larr: '<-',
  mdash: '-',
  ndash: '-',
  times: 'x',
};

// HTML (as used in the docs: <p>, <code>, <strong>, lists) to one line of plain text.
// Em and en dashes become plain hyphens.
export function toPlainText(html) {
  if (html === undefined || html === null) {
    return '';
  }
  let text = String(html);
  text = text.replace(/<li[^>]*>/gi, ' - ');
  text = text.replace(/<\/(p|li|ul|ol|div|h[1-6])>/gi, ' ');
  text = text.replace(/<br\s*\/?>/gi, ' ');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&([a-z]+|#\d+);/gi, (match, name) => {
    const key = name.toLowerCase();
    if (ENTITIES[key] !== undefined) {
      return ENTITIES[key];
    }
    if (key.startsWith('#')) {
      return String.fromCharCode(Number(key.slice(1)));
    }
    return match;
  });
  text = text.replace(/[\u2013\u2014\u2212]/g, '-');
  text = text.replace(/\u2192/g, '->');
  text = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  text = text.replace(/\u2026/g, '...');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// The list endpoint an id param points at, read from its description
// (for example "Encrypted library id from /api/library_list").
function findReference(param, description) {
  if (!/(^|_)ids?$/.test(param.name)) {
    return undefined;
  }
  const match = description.match(/\/api\/([a-z_]+_list)\b/);
  return match ? match[1] : undefined;
}

// Element type of an array param, from its example.
function arrayItemType(example) {
  const first = Array.isArray(example) ? example[0] : example;
  if (first !== null && typeof first === 'object') {
    return 'object';
  }
  if (typeof first === 'number') {
    return 'number';
  }
  return 'string';
}

function exampleText(example) {
  if (example === undefined || example === null || example === '') {
    return undefined;
  }
  if (typeof example === 'object') {
    return toPlainText(JSON.stringify(example));
  }
  return toPlainText(String(example));
}

function buildParam(param, subFields) {
  const description = toPlainText(param.description);
  const out = { name: param.name, type: param.type };
  if (param.required === true) {
    out.required = true;
  }
  out.description = description;
  if (subFields.length > 0) {
    out.description = `${description} Keys: ${subFields.join(', ')}.`.trim();
  }
  if (Array.isArray(param.values) && param.values.length > 0) {
    out.enum = param.values;
  }
  if (param.default !== undefined && param.default !== null && param.default !== '') {
    out.default = param.default;
  }
  // Examples only serve as field placeholders, so long ones are left out.
  const example = exampleText(param.example);
  if (example !== undefined && example.length <= MAX_EXAMPLE_LENGTH) {
    out.example = example;
  }
  if (param.type === 'array' && arrayItemType(param.example) !== 'string') {
    out.items = arrayItemType(param.example);
  }
  const reference = findReference(param, description);
  if (reference !== undefined) {
    out.ref = reference;
  }
  return out;
}

function buildEndpoint(moduleId, endpoint) {
  const params = endpoint.params || [];
  // Params such as "customize.networks.fb.post_type" document keys of an object
  // param; they are listed in the parent's description instead of becoming fields.
  const nested = params.filter((p) => !/^[a-z0-9_]+$/i.test(p.name));
  const topLevel = params.filter((p) => /^[a-z0-9_]+$/i.test(p.name));
  return {
    id: endpoint.id,
    module: moduleId,
    title: toPlainText(endpoint.title),
    summary: toPlainText(endpoint.summary),
    auth: endpoint.auth,
    legacy: endpoint.legacy === true,
    params: topLevel.map((p) => {
      const subFields = nested
        .filter((n) => n.name.startsWith(`${p.name}.`) || n.name.startsWith(`${p.name}[`))
        .map((n) => n.name.slice(p.name.length + 1));
      return buildParam(p, subFields);
    }),
  };
}

function firstSentence(text) {
  const match = text.match(/^(.+?\.)(\s|$)/);
  return match ? match[1] : text;
}

// Turns the parsed module files into the catalog object.
export function buildCatalog(moduleDocs) {
  const modules = [...moduleDocs]
    .sort((a, b) => a.module.localeCompare(b.module))
    .map((doc) => ({
      module: doc.module,
      title: toPlainText(doc.title),
      description: firstSentence(toPlainText(doc.description)),
      endpoints: (doc.endpoints || []).map((e) => buildEndpoint(doc.module, e)),
    }));
  return { version: 1, modules };
}

export function readModuleDocs(docsRoot) {
  const dir = join(docsRoot, 'data', 'endpoints');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const docsRoot = resolve(process.argv[2] || join(repoRoot, '..', 'recurpost-apis'));
  const catalog = buildCatalog(readModuleDocs(docsRoot));
  const target = join(repoRoot, 'nodes', 'RecurPost', 'catalog.json');
  const json = `${JSON.stringify(catalog)}\n`;
  writeFileSync(target, json);
  const endpointCount = catalog.modules.reduce((sum, m) => sum + m.endpoints.length, 0);
  console.log(
    `sync-catalog: ${catalog.modules.length} modules, ${endpointCount} endpoints, ${json.length} bytes -> ${target}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}

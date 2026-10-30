// Generates nodes/RecurPost/generated/*.ts from the RecurPost API docs
// (recurpost-apis/data/endpoints/*.json): one n8n operation per endpoint, or one per
// `action` value on endpoints that bundle several, with the n8n properties for its params.
//
//   node scripts/gen-endpoints.mjs [path/to/recurpost-apis/data/endpoints] [--check]
//
// --check regenerates to memory and fails when the committed output differs.
// scripts/endpoints.config.json holds everything the docs cannot say: resource grouping,
// dropdown loaders, naming fixes and per-action param visibility.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'scripts/endpoints.config.json'), 'utf8'));
const args = process.argv.slice(2);
const check = args.includes('--check');
const docsDir = resolve(root, args.find((a) => !a.startsWith('--')) ?? config.docsDir);
const outDir = join(root, 'nodes/RecurPost/generated');

const EXPRESSION_HINT =
  'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.';
const EXPRESSION_HINT_MANY =
  'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.';
const ACRONYMS = { id: 'ID', ids: 'IDs', url: 'URL', urls: 'URLs', ai: 'AI', pdf: 'PDF', rss: 'RSS', dm: 'DM', gbp: 'GBP', fb: 'Facebook', ln: 'LinkedIn', tw: 'Twitter / X', yt: 'YouTube', tk: 'TikTok', pi: 'Pinterest', th: 'Threads', bs: 'Bluesky', gmb: 'Google Business', ig: 'Instagram', utc: 'UTC', api: 'API', x: 'X', ms: 'Ms' };
const LOADER_NOUNS = { getWorkspaces: 'Workspace', getSocialAccounts: 'Social Account', getLibraries: 'Library', getAccountGroups: 'Account Group', getLabels: 'Label', getSchedules: 'Schedule', getFeeds: 'RSS Feed', getRoles: 'Role' };
const VERBS = { list: 'Get Many', get: 'Get', details: 'Get', create: 'Create', add: 'Add', update: 'Update', delete: 'Delete', remove: 'Remove', set: 'Set', rename: 'Rename', duplicate: 'Duplicate', copy: 'Copy', move: 'Move', save: 'Save', send: 'Send', generate: 'Generate', pause: 'Pause', resume: 'Resume', approve: 'Approve', reject: 'Reject', assign: 'Assign', unassign: 'Unassign', like: 'Like', unlike: 'Unlike', attach: 'Attach', detach: 'Detach', restore: 'Restore', expire: 'Expire', publish: 'Publish', reset: 'Reset', invite: 'Invite', resend: 'Resend', refresh: 'Refresh', sync: 'Sync', search: 'Search', count: 'Count', replace: 'Replace', append: 'Append', shuffle: 'Shuffle', mark: 'Mark', link: 'Link', clone: 'Clone', advance: 'Advance', convert: 'Convert', reassign: 'Reassign', retry: 'Retry', reschedule: 'Reschedule', unpublish: 'Unpublish', comment: 'Comment', decide: 'Decide', fetch: 'Fetch', quote: 'Quote', review: 'Mark Reviewed', unreview: 'Mark Unreviewed', businesses: 'Get Businesses', questions: 'Get Questions', formats: 'Get Formats', clients: 'Get Clients', data: 'Get Data', settings: 'Update Settings', ideas: 'Update Ideas Settings' };

// ---------- small string helpers ----------

const camel = (s) => s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, (c) => c.toLowerCase());
const pascal = (s) => camel(s).replace(/^[a-z]/, (c) => c.toUpperCase());
const words = (s) => s.split(/[_\s]+/).filter(Boolean);
const titleWord = (w) => ACRONYMS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1);
const LEADING = { in: 'Instagram', gbp: 'Google Business', gmb: 'Google Business' };
const title = (s) => words(s).map((w, i) => (i === 0 && LEADING[w.toLowerCase()]) || titleWord(w)).join(' ');
const stripHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const sentence = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function tidyDescription(text) {
  let out = stripHtml(text)
    .replace(/\bids\b/g, 'IDs')
    .replace(/\bid\b/g, 'ID')
    .replace(/\burls\b/g, 'URLs')
    .replace(/\burl\b/g, 'URL')
    .replace(/\bjson\b/g, 'JSON');
  out = out.charAt(0).toUpperCase() + out.slice(1);
  const multiSentence = out.slice(0, -1).includes('. ');
  // n8n wants no final period on a single sentence and one on a multi-sentence description
  if (!multiSentence && out.endsWith('.')) {
    out = out.slice(0, -1);
  } else if (multiSentence && !out.endsWith('.')) {
    out += '.';
  }
  return out;
}

function withHint(description, hint) {
  return `${description.replace(/\.$/, '')}. ${hint}`;
}

// ---------- per-action applicability from the param description ----------

function actionList(text, actions) {
  const found = text
    .replace(/action\s*=\s*/g, '')
    .split(/,|\band\b|\bor\b|\//)
    .map((a) => a.trim().toLowerCase())
    .filter((a) => actions.includes(a));
  return found.length ? [...new Set(found)] : null;
}

function applicability(desc, actions) {
  const text = stripHtml(desc);
  const result = { onlyFor: null, requiredFor: null };
  let m;
  if ((m = text.match(/(?:Required|Must be true(?: \(or 1\))?) (?:for|when action is|when action=|when action|on|with)\s*([^.;:]+)/i))) {
    result.requiredFor = actionList(m[1], actions);
  }
  if ((m = text.match(/Required for every action (?:but|except) ([^.;:]+)/i))) {
    const exclude = actionList(m[1], actions) ?? [];
    result.requiredFor = actions.filter((a) => !exclude.includes(a));
  }
  if ((m = text.match(/^(?:With|For|On) ([^.:]+?):/i))) {
    result.onlyFor = actionList(m[1], actions);
  } else if ((m = text.match(/\b([a-z_]+(?:, [a-z_]+)*(?:,? (?:and|or) [a-z_]+)?) only\b/i))) {
    result.onlyFor = actionList(m[1], actions);
  } else if ((m = text.match(/(?:Read|Used|Sent) (?:only )?(?:when|with) action(?: is)? ([a-z_]+)/i))) {
    result.onlyFor = actionList(m[1], actions);
  }
  if (result.requiredFor && !result.onlyFor) {
    // A param required for some actions and unmentioned elsewhere still shows everywhere
    result.onlyFor = null;
  }
  return result;
}

// ---------- param -> n8n property ----------

function loaderFor(param, override) {
  if (override?.loader !== undefined) {
    return override.loader || null;
  }
  if (config.loaders[param.name]) {
    return config.loaders[param.name];
  }
  if (param.name === 'id' || param.name.endsWith('_id') || param.name.endsWith('_ids')) {
    const desc = stripHtml(param.description).toLowerCase();
    const hint = config.idHints.find(([needle]) => desc.includes(needle));
    if (hint) {
      return hint[1];
    }
  }
  return null;
}

function kindFor(param, loader) {
  const isMany = param.type === 'array' || param.name.endsWith('_ids');
  if (loader) {
    return isMany ? 'multiOptions' : 'options';
  }
  if (param.values && param.values.length) {
    return 'options';
  }
  switch (param.type) {
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';
    case 'object':
      return 'json';
    case 'array': {
      const ex = param.example;
      const objects = Array.isArray(ex) && ex.some((v) => v && typeof v === 'object');
      return objects ? 'json' : 'list';
    }
    default:
      return 'string';
  }
}

function displayNameFor(param, loader, override) {
  if (override?.displayName) {
    return override.displayName;
  }
  let name = title(param.name);
  if (param.name === 'id' && param.type === 'array' && !loader) {
    return 'IDs';
  }
  if (loader && (param.name === 'id' || param.name === 'ids')) {
    name = LOADER_NOUNS[loader] + (param.name === 'ids' ? ' Names or IDs' : ' Name or ID');
  } else if (loader) {
    name = name.replace(/ IDs$/, ' Names or IDs').replace(/ ID$/, ' Name or ID');
    if (!/Names? or IDs?$/.test(name)) {
      name += param.name.endsWith('s') ? ' Names or IDs' : ' Name or ID';
    }
  }
  return name;
}

function propertyFor(param, spec, kind, loader, override, inCollection) {
  const prop = {
    displayName: displayNameFor(param, loader, override),
    name: spec.name,
    type: 'string',
    default: '',
  };
  let description = tidyDescription(param.description);

  switch (kind) {
    case 'number':
      prop.type = 'number';
      prop.default = param.default !== undefined && param.default !== '' && !Number.isNaN(Number(param.default)) ? Number(param.default) : 0;
      break;
    case 'boolean':
      prop.type = 'boolean';
      prop.default = String(param.default).toLowerCase() === 'true';
      if (!/^whether /i.test(description)) {
        description = 'Whether ' + lower(description);
      }
      break;
    case 'date':
    case 'datetime':
      prop.type = 'dateTime';
      break;
    case 'options': {
      prop.type = 'options';
      if (loader) {
        prop.typeOptions = { loadOptionsMethod: loader };
        description = withHint(description, EXPRESSION_HINT);
      } else {
        const values = param.values.filter((v) => v !== '');
        prop.options = values
          .map((v) => ({ name: title(String(v)), value: v }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        const preferred = param.default !== undefined && values.includes(param.default) ? param.default : values[0];
        prop.default = preferred;
      }
      break;
    }
    case 'multiOptions':
      prop.type = 'multiOptions';
      prop.typeOptions = { loadOptionsMethod: loader };
      prop.default = [];
      description = withHint(description, EXPRESSION_HINT_MANY);
      break;
    case 'list':
      description = withHint(description, 'Separate several values with commas.');
      if (/email/.test(param.name)) {
        prop.placeholder = 'name@email.com';
      }
      break;
    case 'json':
      prop.type = 'json';
      prop.default = Array.isArray(param.example) ? '[]' : '{}';
      break;
    default:
      if (param.name === 'color' && /hex/i.test(description)) {
        prop.type = 'color';
      }
      if (/message|text|description|comment|prompt|terms|body/.test(param.name)) {
        prop.typeOptions = { rows: 3 };
      }
      if (param.type === 'email' || /email/.test(param.name)) {
        prop.placeholder = 'name@email.com';
      }
      if (/password|secret|token|^pin$/.test(param.name)) {
        prop.typeOptions = { ...(prop.typeOptions ?? {}), password: true };
      }
      if (param.default !== undefined && typeof param.default === 'string' && kind === 'string') {
        prop.default = param.default;
      }
  }
  if (param.required && !inCollection) {
    prop.required = true;
  }
  prop.description = description;
  return prop;
}

// ---------- operations ----------

function restOfId(endpointId, resourceKey) {
  const prefixes = [...config.resources[resourceKey].prefixes].sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (endpointId === prefix.replace(/_$/, '')) {
      return '';
    }
    if (endpointId.startsWith(prefix)) {
      return endpointId.slice(prefix.length);
    }
  }
  return endpointId;
}

function defaultOperationName(endpoint, resourceKey, action) {
  const rest = restOfId(endpoint.id, resourceKey);
  const resourceName = config.resources[resourceKey].name;
  if (action) {
    const verb = VERBS[action] ?? title(action);
    const noun = words(rest).filter((w) => w !== action && !['status', 'decide', 'manage', 'item', 'items'].includes(w)).join(' ');
    return noun ? `${verb} ${title(noun)}` : verb;
  }
  const parts = words(rest);
  if (!parts.length) {
    return `Get ${resourceName}`;
  }
  const last = parts[parts.length - 1];
  const first = parts[0];
  if (VERBS[last] && parts.length > 1) {
    return `${VERBS[last]} ${title(parts.slice(0, -1).join(' '))}`;
  }
  if (VERBS[last]) {
    return VERBS[last];
  }
  if (VERBS[first] && parts.length > 1) {
    return `${VERBS[first]} ${title(parts.slice(1).join(' '))}`;
  }
  return `Get ${title(rest)}`;
}

function plural(noun) {
  return noun.endsWith('y') ? noun.slice(0, -1) + 'ies' : noun + 's';
}

function defaultActionText(name, resourceName) {
  const noun = resourceName.toLowerCase();
  if (name === 'Get Many') {
    return `Get many ${plural(noun)}`;
  }
  if (!name.includes(' ')) {
    const article = /^[aeiou]/i.test(noun) ? 'an' : 'a';
    return `${name} ${article} ${noun}`;
  }
  return sentence(name.toLowerCase());
}

function defaultUnwrap(endpoint) {
  const example = endpoint.example_response ?? {};
  const listKeys = Object.keys(example).filter((k) => !['status', 'message'].includes(k) && Array.isArray(example[k]));
  const otherKeys = Object.keys(example).filter((k) => !['status', 'message'].includes(k));
  return listKeys.length === 1 && otherKeys.length === listKeys.length ? listKeys[0] : undefined;
}

function buildOperation(endpoint, resourceKey, action, actions) {
  const key = action ? `${endpoint.id}:${action}` : endpoint.id;
  const override = config.operations[key] ?? {};
  const resourceName = config.resources[resourceKey].name;
  const name = override.name ?? defaultOperationName(endpoint, resourceKey, action);
  const value = override.value ?? camel(action ? `${restOfId(endpoint.id, resourceKey) || endpoint.id} ${action}` : restOfId(endpoint.id, resourceKey) || `get ${endpoint.id}`);
  const description = override.description ?? tidyDescription(endpoint.summary);
  const actionText = override.action ?? defaultActionText(name, resourceName);
  const composer = config.composerEndpoints.includes(endpoint.id);
  const confirmParam = endpoint.params.find((p) => p.name === 'confirm');
  let confirm = false;
  if (confirmParam) {
    const hint = applicability(confirmParam.description, actions);
    confirm = !action || !hint.requiredFor || hint.requiredFor.includes(action);
  }
  const workspace = endpoint.params.some((p) => p.name === 'workspace_id');

  const spec = {
    resource: resourceKey,
    operation: value,
    endpoint: endpoint.id,
    action,
    confirm: confirm || undefined,
    unwrap: override.unwrap !== undefined ? override.unwrap || undefined : defaultUnwrap(endpoint),
    composer: composer || undefined,
    workspace,
    params: [],
  };
  const option = { name, value, description, action: actionText };
  const properties = [];
  const additional = [];
  const used = new Set(['resource', 'operation', 'workspaceId', 'additionalFields']);

  for (const param of endpoint.params) {
    if (['action', 'confirm', 'workspace_id'].includes(param.name)) {
      continue;
    }
    if (composer && config.composerKeys.includes(param.name)) {
      continue;
    }
    const paramOverride = override.params?.[param.name] ?? {};
    if (paramOverride.hidden) {
      continue;
    }
    const hint = action ? applicability(param.description, actions) : { onlyFor: null, requiredFor: null };
    const onlyFor = paramOverride.onlyFor ?? hint.onlyFor;
    const requiredFor = paramOverride.requiredFor ?? hint.requiredFor;
    if (action && onlyFor && !onlyFor.includes(action)) {
      continue;
    }
    let required = param.required;
    if (action && requiredFor) {
      required = requiredFor.includes(action);
    }
    if (paramOverride.required !== undefined) {
      required = paramOverride.required;
    }
    const loader = loaderFor(param, paramOverride);
    const kind = kindFor(param, loader);
    let propName = camel(param.name);
    if (used.has(propName)) {
      propName += 'Value';
    }
    used.add(propName);
    const paramSpec = { name: propName, key: param.name, kind, required: Boolean(required) };
    spec.params.push(paramSpec);
    const prop = propertyFor({ ...param, required }, paramSpec, kind, loader, paramOverride, !required);
    if (required) {
      prop.displayOptions = { show: { resource: [resourceKey], operation: [value] } };
      properties.push(prop);
    } else {
      additional.push(prop);
    }
  }

  if (additional.length) {
    additional.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    properties.push({
      displayName: 'Additional Fields',
      name: 'additionalFields',
      type: 'collection',
      placeholder: 'Add Field',
      default: {},
      displayOptions: { show: { resource: [resourceKey], operation: [value] } },
      options: additional,
    });
  }

  return { spec, option, properties };
}

// ---------- main ----------

const modules = readdirSync(docsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(docsDir, f), 'utf8')));

const byResource = new Map();
for (const mod of modules) {
  for (const endpoint of mod.endpoints) {
    if (config.skip.includes(endpoint.id)) {
      continue;
    }
    const resourceKey = config.endpointResource[endpoint.id] ?? config.moduleResource[mod.module];
    if (!resourceKey) {
      throw new Error(`No resource for module ${mod.module}`);
    }
    const actionParam = endpoint.params.find((p) => p.name === 'action' && p.values?.length);
    const actions = actionParam ? actionParam.values : [];
    const built = actions.length
      ? actions.map((a) => buildOperation(endpoint, resourceKey, a, actions))
      : [buildOperation(endpoint, resourceKey, undefined, [])];
    if (!byResource.has(resourceKey)) {
      byResource.set(resourceKey, []);
    }
    byResource.get(resourceKey).push(...built);
  }
}

const composerOps = [...byResource.values()].flat().filter((o) => o.spec.composer);
const composerResources = new Set([...composerOps.map((o) => o.spec.resource), 'post', 'library']);
const composerValues = new Set([...composerOps.map((o) => o.option.value), 'schedule', 'addContent']);
for (const [resourceKey, ops] of byResource) {
  if (!composerResources.has(resourceKey)) {
    continue;
  }
  for (const op of ops) {
    if (composerValues.has(op.option.value) && !op.spec.composer) {
      throw new Error(`${resourceKey}.${op.option.value} would show the post composer; give it another value`);
    }
  }
}

function literal(value, indent = '') {
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    if (!value.length) {
      return '[]';
    }
    return '[\n' + value.map((v) => inner + literal(v, inner)).join(',\n') + '\n' + indent + ']';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined);
    if (!keys.length) {
      return '{}';
    }
    return '{\n' + keys.map((k) => `${inner}${/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : literal(k)}: ${literal(value[k], inner)}`).join(',\n') + '\n' + indent + '}';
  }
  if (typeof value === 'string') {
    return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  }
  return String(value);
}

const files = new Map();
const header = '// Generated by scripts/gen-endpoints.mjs from the RecurPost API docs. Do not edit by hand.\n';
const resourceKeys = [...byResource.keys()].sort();

for (const resourceKey of resourceKeys) {
  const ops = byResource.get(resourceKey);
  ops.sort((a, b) => a.option.name.localeCompare(b.option.name, undefined, { sensitivity: 'base' }));
  const values = ops.map((o) => o.option.value);
  const dupes = values.filter((v, i) => values.indexOf(v) !== i);
  if (dupes.length) {
    throw new Error(`Duplicate operation values in ${resourceKey}: ${dupes.join(', ')}`);
  }
  const withWorkspace = ops.filter((o) => o.spec.workspace).map((o) => o.option.value);
  const properties = [];
  if (withWorkspace.length) {
    properties.push({
      displayName: 'Workspace Name or ID',
      name: 'workspaceId',
      type: 'options',
      typeOptions: { loadOptionsMethod: 'getWorkspaces' },
      default: '',
      displayOptions: { show: { resource: [resourceKey], operation: withWorkspace } },
      description: `The workspace to operate in. Leave as Default Workspace to keep using your default workspace. ${EXPRESSION_HINT}`,
    });
  }
  for (const op of ops) {
    properties.push(...op.properties);
  }
  const body =
    header +
    `import type { INodeProperties } from 'n8n-workflow';\nimport type { OperationSpec } from '../types';\n\n` +
    `export const ${resourceKey}Operations: OperationSpec[] = ${literal(ops.map((o) => o.spec))};\n\n` +
    `export const ${resourceKey}OperationOptions = ${literal(ops.map((o) => o.option))};\n\n` +
    `export const ${resourceKey}Properties: INodeProperties[] = ${literal(properties)};\n`;
  files.set(`${resourceKey}.ts`, body);
}

const index =
  header +
  resourceKeys.map((r) => `import { ${r}Operations, ${r}OperationOptions, ${r}Properties } from './${r}';`).join('\n') +
  `\nimport type { INodeProperties } from 'n8n-workflow';\nimport type { OperationSpec } from '../types';\n\n` +
  `export const generatedComposerShow = ${literal({ resource: [...new Set(composerOps.map((o) => o.spec.resource))], operation: [...new Set(composerOps.map((o) => o.option.value))] })};\n\n` +
  `export const generatedResources = ${literal(resourceKeys.map((r) => ({ name: config.resources[r].name, value: r })))};\n\n` +
  `export const generatedOperations: OperationSpec[] = [\n${resourceKeys.map((r) => `  ...${r}Operations,`).join('\n')}\n];\n\n` +
  `export const generatedOperationOptions: Record<string, Array<{ name: string; value: string; description: string; action: string }>> = {\n${resourceKeys.map((r) => `  ${r}: ${r}OperationOptions,`).join('\n')}\n};\n\n` +
  `export const generatedProperties: INodeProperties[] = [\n${resourceKeys.map((r) => `  ...${r}Properties,`).join('\n')}\n];\n`;
files.set('index.ts', index);

if (check) {
  let dirty = false;
  for (const [name, content] of files) {
    const path = join(outDir, name);
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content) {
      console.error(`out of date: nodes/RecurPost/generated/${name}`);
      dirty = true;
    }
  }
  process.exit(dirty ? 1 : 0);
}

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true });
}
mkdirSync(outDir, { recursive: true });
for (const [name, content] of files) {
  writeFileSync(join(outDir, name), content);
}
const total = [...byResource.values()].reduce((n, ops) => n + ops.length, 0);
console.log(`generated ${total} operations across ${resourceKeys.length} resources`);
for (const r of resourceKeys) {
  for (const op of byResource.get(r)) {
    console.log(`${r.padEnd(16)} ${op.option.value.padEnd(32)} ${op.option.name.padEnd(36)} ${op.spec.endpoint}${op.spec.action ? ':' + op.spec.action : ''}  req=${op.spec.params.filter((p) => p.required).map((p) => p.key).join(',')}`);
  }
}

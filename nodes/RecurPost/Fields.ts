import type {
  IDataObject,
  IDisplayOptions,
  IExecuteFunctions,
  INode,
  INodeProperties,
  INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { CatalogEndpoint, CatalogParam, CatalogValue } from './catalog';
import { formatDateTime, toList } from './GenericFunctions';

// Turns catalog params into n8n fields and the values of those fields back into
// API request values.

export const WORKSPACE_PARAM = 'workspace_id';
export const WORKSPACE_FIELD = 'workspaceId';
export const ADDITIONAL_FIELDS = 'additionalFields';

const EXPRESSION_HINT =
  'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.';
const EXPRESSION_HINT_MULTI =
  'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.';

// List endpoints the node offers as dropdowns: where the items are in the answer,
// which field is the id and which the label. Every one of them needs no more than an
// optional workspace_id, so the dropdown follows the workspace chosen in the node.
export interface ListSource {
  endpoint: string;
  method: string;
  label: string;
  listKey: string;
  idKey: string;
  nameKeys: string[];
}

export const LIST_SOURCES: ListSource[] = [
  {
    endpoint: 'social_account_list',
    method: 'getSocialAccounts',
    label: 'Social Account',
    listKey: 'social_accounts',
    idKey: 'smpa_id',
    nameKeys: ['smpa_name'],
  },
  {
    endpoint: 'library_list',
    method: 'getLibraries',
    label: 'Library',
    listKey: 'library_list',
    idKey: 'cd_id',
    nameKeys: ['cd_name'],
  },
  {
    endpoint: 'label_list',
    method: 'getPostLabels',
    label: 'Label',
    listKey: 'labels',
    idKey: 'id',
    nameKeys: ['name'],
  },
  {
    endpoint: 'feed_list',
    method: 'getFeeds',
    label: 'Feed',
    listKey: 'feeds',
    idKey: 'id',
    nameKeys: ['title', 'url'],
  },
  {
    endpoint: 'ai_templates_list',
    method: 'getAiTemplates',
    label: 'Template',
    listKey: 'templates',
    idKey: 'id',
    nameKeys: ['name'],
  },
  {
    endpoint: 'custom_reports_list',
    method: 'getCustomReports',
    label: 'Report',
    listKey: 'reports',
    idKey: 'id',
    nameKeys: ['name'],
  },
  {
    endpoint: 'custom_fields_list',
    method: 'getCustomFields',
    label: 'Custom Field',
    listKey: 'custom_fields',
    idKey: 'id',
    nameKeys: ['name'],
  },
  {
    endpoint: 'shortener_accounts_list',
    method: 'getShorteners',
    label: 'Shortener',
    listKey: 'shorteners',
    idKey: 'id',
    nameKeys: ['name', 'provider'],
  },
];

const LIST_SOURCE_BY_ENDPOINT = new Map(LIST_SOURCES.map((source) => [source.endpoint, source]));

export function listSourceFor(param: CatalogParam): ListSource | undefined {
  return param.ref !== undefined ? LIST_SOURCE_BY_ENDPOINT.get(param.ref) : undefined;
}

// Dropdown options from a list endpoint answer.
export function listOptions(source: ListSource, response: IDataObject): INodePropertyOptions[] {
  const list = response[source.listKey];
  if (!Array.isArray(list)) {
    return [];
  }
  const options: INodePropertyOptions[] = [];
  for (const entry of list as IDataObject[]) {
    const id = entry?.[source.idKey];
    if (id === undefined || id === null || id === '') {
      continue;
    }
    const label = source.nameKeys.map((key) => entry[key]).find((v) => typeof v === 'string' && v !== '');
    options.push({ name: (label as string) ?? String(id), value: String(id) });
  }
  return options;
}

const WORD_LABELS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  cta: 'CTA',
  dm: 'DM',
  dms: 'DMs',
  gbp: 'Google Business',
  gmb: 'Google Business',
  id: 'ID',
  ids: 'IDs',
  ig: 'Instagram',
  ms: 'Ms',
  rss: 'RSS',
  sms: 'SMS',
  url: 'URL',
  urls: 'URLs',
  utm: 'UTM',
};

// Network prefixes of the per-network params (fb_message, in_post_type, ...).
const NETWORK_PREFIXES: Record<string, string> = {
  bs: 'Bluesky',
  fb: 'Facebook',
  gbp: 'Google Business',
  gmb: 'Google Business',
  in: 'Instagram',
  ln: 'LinkedIn',
  pi: 'Pinterest',
  th: 'Threads',
  tk: 'TikTok',
  tw: 'X',
  yt: 'YouTube',
};

export function humanize(name: string): string {
  const words = name.split('_').filter((w) => w !== '');
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0 && words.length > 1 && NETWORK_PREFIXES[lower] !== undefined) {
        return NETWORK_PREFIXES[lower];
      }
      if (WORD_LABELS[lower] !== undefined) {
        return WORD_LABELS[lower];
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

// The n8n field name of a param: the API name, except workspace_id, which is the
// shared workspace selector the dropdowns read.
export function fieldName(param: CatalogParam): string {
  return param.name === WORKSPACE_PARAM ? WORKSPACE_FIELD : param.name;
}

function isList(param: CatalogParam): boolean {
  return param.type === 'array';
}

function dropdownDisplayName(param: CatalogParam, source: ListSource): string {
  const multiple = isList(param);
  let base: string;
  if (param.name === 'id' || param.name === 'ids') {
    base = source.label;
  } else {
    base = humanize(param.name.replace(/_ids?$/, ''));
  }
  return multiple ? `${base} Names or IDs` : `${base} Name or ID`;
}

function enumLabel(value: CatalogValue, values: CatalogValue[]): string {
  const isYesNo = values.length === 2 && values.includes(0) && values.includes(1);
  if (isYesNo) {
    return value === 1 ? 'Yes' : 'No';
  }
  const text = String(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function coerceDefault(param: CatalogParam): CatalogValue | undefined {
  const value = param.default;
  if (value === undefined) {
    return undefined;
  }
  if (param.enum !== undefined) {
    return param.enum.find((option) => String(option) === String(value));
  }
  if (param.type === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['true', '1', 'yes'].includes(String(value).toLowerCase());
  }
  if (param.type === 'integer') {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

const LONG_TEXT = /(^|_)(message|text|comment|comments|description|prompt|content|terms|caption|reply|bio|note|notes|instruction)$/;

function describe(param: CatalogParam, extra?: string): string {
  const parts = [param.description.trim()];
  if (extra) {
    parts.push(extra);
  }
  return parts.filter((p) => p !== '').join(' ');
}

// The n8n field for a catalog param. `show` limits it to its resource and operation;
// fields inside the Additional Fields collection pass no `show`.
export function paramToProperty(param: CatalogParam, show?: IDisplayOptions['show']): INodeProperties {
  const property: INodeProperties = {
    displayName: humanize(param.name),
    name: fieldName(param),
    type: 'string',
    default: '',
  };
  if (show !== undefined) {
    property.displayOptions = { show };
    if (param.required === true) {
      property.required = true;
    }
  }

  const source = listSourceFor(param);
  if (source !== undefined) {
    property.displayName = dropdownDisplayName(param, source);
    property.typeOptions = { loadOptionsMethod: source.method };
    if (isList(param)) {
      property.type = 'multiOptions';
      property.default = [];
      property.description = describe(param, EXPRESSION_HINT_MULTI);
    } else {
      property.type = 'options';
      property.default = '';
      property.description = describe(param, EXPRESSION_HINT);
    }
    return property;
  }

  if (param.enum !== undefined && param.enum.length > 0) {
    const values = param.enum;
    const options = values
      .map((value) => ({ name: enumLabel(value, values), value }))
      .sort((a, b) => a.name.localeCompare(b.name));
    property.type = 'options';
    property.options = options;
    property.default = coerceDefault(param) ?? options[0].value;
    property.description = describe(param);
    return property;
  }

  switch (param.type) {
    case 'boolean':
      property.type = 'boolean';
      property.default = coerceDefault(param) ?? false;
      property.description = describe(param);
      break;
    case 'integer':
      property.type = 'number';
      property.default = coerceDefault(param) ?? 0;
      property.description = describe(param);
      break;
    case 'date':
    case 'datetime':
      property.type = 'dateTime';
      property.description = describe(param);
      break;
    case 'object':
      property.type = 'json';
      property.default = '{}';
      property.description = describe(param, 'A JSON object.');
      break;
    case 'array':
      if (param.items === 'object') {
        property.type = 'json';
        property.default = '[]';
        property.description = describe(param, 'A JSON array.');
      } else {
        property.description = describe(param, 'A comma-separated list or a JSON array.');
      }
      break;
    default:
      property.description = describe(param);
      if (param.type === 'email') {
        property.placeholder = 'name@email.com';
      }
      if (LONG_TEXT.test(param.name)) {
        property.typeOptions = { rows: 4 };
      }
  }

  if (param.example !== undefined && ['string', 'url', 'array', 'date', 'datetime'].includes(param.type)) {
    if (property.type === 'string' && property.placeholder === undefined) {
      property.placeholder = param.example;
    }
  }
  return property;
}

function parseJsonValue(param: CatalogParam, value: unknown, node: INode, itemIndex: number): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const text = value.trim();
  if (text === '') {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new NodeOperationError(node, `"${humanize(param.name)}" must be valid JSON`, { itemIndex });
  }
}

// The API value of a field, or undefined to leave the param out of the request.
export function convertParamValue(
  param: CatalogParam,
  value: unknown,
  node: INode,
  itemIndex: number,
): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }
  const source = listSourceFor(param);

  if (param.type === 'array') {
    if (param.items === 'object' && source === undefined) {
      const parsed = parseJsonValue(param, value, node, itemIndex);
      if (parsed === undefined) {
        return undefined;
      }
      return Array.isArray(parsed) ? parsed : [parsed];
    }
    const list = toList(value);
    if (param.items === 'number') {
      return list.map((entry) => (typeof entry === 'string' && entry !== '' && !Number.isNaN(Number(entry)) ? Number(entry) : entry));
    }
    return list;
  }

  if (param.enum !== undefined && param.enum.length > 0) {
    return value === '' ? undefined : value;
  }

  switch (param.type) {
    case 'boolean':
      return typeof value === 'boolean' ? value : ['true', '1', 'yes'].includes(String(value).toLowerCase());
    case 'integer': {
      if (value === '') {
        return undefined;
      }
      const number = Number(value);
      return Number.isNaN(number) ? value : number;
    }
    case 'date':
      return value === '' ? undefined : formatDateTime(value, false);
    case 'datetime':
      return value === '' ? undefined : formatDateTime(value, true);
    case 'object':
      return parseJsonValue(param, value, node, itemIndex);
    default:
      if (source !== undefined && value === '') {
        return undefined;
      }
      return value;
  }
}

// workspace_id from the shared workspace selector; empty means the caller's own
// default workspace, so the param is left out.
export function workspaceBody(ctx: IExecuteFunctions, itemIndex: number): IDataObject {
  const workspaceId = ctx.getNodeParameter(WORKSPACE_FIELD, itemIndex, '') as string;
  return workspaceId ? { workspace_id: workspaceId } : {};
}

// The params a field value goes into for an endpoint: the required ones as top-level
// fields and the optional ones inside Additional Fields. `covered` names params a
// hand-built operation fills itself.
export function splitParams(endpoint: CatalogEndpoint, covered: string[] = []) {
  const skip = new Set([WORKSPACE_PARAM, ...covered]);
  const params = endpoint.params.filter((p) => !skip.has(p.name));
  return {
    required: params.filter((p) => p.required === true),
    optional: params.filter((p) => p.required !== true),
  };
}

export function hasWorkspaceParam(endpoint: CatalogEndpoint): boolean {
  return endpoint.params.some((p) => p.name === WORKSPACE_PARAM);
}

// Request body of a generated operation (or the extra params of a hand-built one).
export function buildParamsBody(
  ctx: IExecuteFunctions,
  endpoint: CatalogEndpoint,
  itemIndex: number,
  covered: string[] = [],
): IDataObject {
  const body: IDataObject = {};
  const node = ctx.getNode();
  const { required, optional } = splitParams(endpoint, covered);

  for (const param of required) {
    const value = convertParamValue(param, ctx.getNodeParameter(fieldName(param), itemIndex, undefined), node, itemIndex);
    if (value !== undefined) {
      body[param.name] = value as IDataObject[keyof IDataObject];
    }
  }

  if (optional.length > 0) {
    const additional = ctx.getNodeParameter(ADDITIONAL_FIELDS, itemIndex, {}) as IDataObject;
    for (const param of optional) {
      if (!Object.prototype.hasOwnProperty.call(additional, param.name)) {
        continue;
      }
      const value = convertParamValue(param, additional[param.name], node, itemIndex);
      if (value !== undefined) {
        body[param.name] = value as IDataObject[keyof IDataObject];
      }
    }
  }
  return body;
}

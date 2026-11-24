import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import type { CatalogEndpoint } from './catalog';
import { catalog, getEndpoint } from './catalog';
import {
  ADDITIONAL_FIELDS,
  WORKSPACE_FIELD,
  hasWorkspaceParam,
  paramToProperty,
  splitParams,
} from './Fields';
import { legacyProperties } from './LegacyDescription';
import type { LegacyOperation } from './LegacyOperations';
import { LEGACY_OPERATIONS } from './LegacyOperations';

// Builds the node's Resource / Operation options and every operation's fields from
// the catalog: one resource per API module, one operation per endpoint. The
// operations the node had before v2 keep their hand-built fields (LegacyDescription.ts).

// Resource values of the modules the node already had, so saved workflows keep opening.
const RESOURCE_BY_MODULE: Record<string, string> = {
  accounts: 'socialAccount',
  ai: 'aiContent',
  libraries: 'library',
  posts: 'post',
  workspaces: 'workspace',
};

// Default operation of the resources the node already had (n8n leaves a parameter
// that equals its default out of a saved workflow, so these must not change).
const DEFAULT_OPERATION: Record<string, string> = {
  aiContent: 'generateText',
  library: 'addContent',
  post: 'schedule',
  socialAccount: 'getAll',
  workspace: 'getAll',
};

export const DEFAULT_RESOURCE = 'post';

function camelCase(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

export function resourceValue(moduleId: string): string {
  return RESOURCE_BY_MODULE[moduleId] ?? camelCase(moduleId);
}

export function operationValue(endpointId: string): string {
  return camelCase(endpointId);
}

const PROPER_WORDS = new Set([
  'Bluesky',
  'Business',
  'Canva',
  'Facebook',
  'Google',
  'Instagram',
  'LinkedIn',
  'Pinterest',
  'RecurPost',
  'Threads',
  'TikTok',
  'X',
  'YouTube',
]);

// "Library Content List" -> "Library content list", keeping acronyms and network names.
export function sentenceCase(title: string): string {
  return title
    .split(' ')
    .map((word, index) => {
      if (index === 0 || PROPER_WORDS.has(word) || /[A-Z].*[A-Z]/.test(word)) {
        return word;
      }
      return word.toLowerCase();
    })
    .join(' ');
}

export interface OperationDefinition {
  resource: string;
  operation: string;
  endpoint: CatalogEndpoint;
  name: string;
  description: string;
  action: string;
  legacy?: LegacyOperation;
}

export interface ResourceDefinition {
  value: string;
  name: string;
  description: string;
  operations: OperationDefinition[];
}

function buildResources(): ResourceDefinition[] {
  const legacyByEndpoint = new Map<string, LegacyOperation[]>();
  for (const legacy of LEGACY_OPERATIONS) {
    const list = legacyByEndpoint.get(legacy.endpoint) ?? [];
    list.push(legacy);
    legacyByEndpoint.set(legacy.endpoint, list);
  }

  const resources = new Map<string, ResourceDefinition>();
  for (const mod of catalog.modules) {
    const value = resourceValue(mod.module);
    const resource: ResourceDefinition = {
      value,
      name: mod.title,
      description: mod.description,
      operations: [],
    };
    resources.set(value, resource);

    for (const endpoint of mod.endpoints) {
      // A hand-built operation in this resource replaces the generated one.
      const sameResource = (legacyByEndpoint.get(endpoint.id) ?? []).some((l) => l.resource === value);
      if (sameResource) {
        continue;
      }
      resource.operations.push({
        resource: value,
        operation: operationValue(endpoint.id),
        endpoint,
        name: endpoint.title,
        description: endpoint.summary,
        action: sentenceCase(endpoint.title),
      });
    }
  }

  for (const legacy of LEGACY_OPERATIONS) {
    const resource = resources.get(legacy.resource);
    if (resource === undefined) {
      throw new Error(`Hand-built operation ${legacy.resource}/${legacy.operation} has no resource`);
    }
    resource.operations.push({
      resource: legacy.resource,
      operation: legacy.operation,
      endpoint: getEndpoint(legacy.endpoint),
      name: legacy.name,
      description: legacy.description,
      action: legacy.action,
      legacy,
    });
  }

  const list = [...resources.values()];
  for (const resource of list) {
    resource.operations.sort((a, b) => a.name.localeCompare(b.name));
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export const RESOURCES = buildResources();

export const OPERATIONS = new Map<string, OperationDefinition>();
for (const resource of RESOURCES) {
  for (const operation of resource.operations) {
    OPERATIONS.set(`${resource.value}:${operation.operation}`, operation);
  }
}

export function findOperation(resource: string, operation: string): OperationDefinition | undefined {
  return OPERATIONS.get(`${resource}:${operation}`);
}

function resourceProperty(): INodeProperties {
  const options: INodePropertyOptions[] = RESOURCES.map((resource) => ({
    name: resource.name,
    value: resource.value,
    description: resource.description,
  }));
  return {
    displayName: 'Resource',
    name: 'resource',
    type: 'options',
    noDataExpression: true,
    options,
    default: DEFAULT_RESOURCE,
  };
}

function operationProperty(resource: ResourceDefinition): INodeProperties {
  const defaultOperation = DEFAULT_OPERATION[resource.value] ?? resource.operations[0].operation;
  return {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: [resource.value] } },
    options: resource.operations.map((operation) => ({
      name: operation.name,
      value: operation.operation,
      description: operation.description,
      action: operation.action,
    })),
    default: defaultOperation,
  };
}

// The workspace selector of one resource, shown for its operations that take an
// optional workspace_id. Empty means the caller's own default workspace.
function workspaceProperty(resource: ResourceDefinition): INodeProperties | undefined {
  const operations = resource.operations
    .filter((operation) => hasWorkspaceParam(operation.endpoint))
    .map((operation) => operation.operation);
  if (operations.length === 0) {
    return undefined;
  }
  return {
    displayName: 'Workspace Name or ID',
    name: WORKSPACE_FIELD,
    type: 'options',
    typeOptions: { loadOptionsMethod: 'getWorkspaces' },
    default: '',
    displayOptions: { show: { resource: [resource.value], operation: operations } },
    description:
      'The workspace to work in. Leave as Default Workspace to use your own default workspace. The account, library and other dropdowns list the items of this workspace. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  };
}

function operationFields(operation: OperationDefinition): INodeProperties[] {
  const show = { resource: [operation.resource], operation: [operation.operation] };
  const covered = operation.legacy?.covered ?? [];
  const { required, optional } = splitParams(operation.endpoint, covered);
  const fields: INodeProperties[] = [];

  // Hand-built operations keep their own fields; only params they do not fill are added.
  if (operation.legacy === undefined) {
    for (const param of required) {
      fields.push(paramToProperty(param, show));
    }
  }

  if (optional.length > 0) {
    fields.push({
      displayName: 'Additional Fields',
      name: ADDITIONAL_FIELDS,
      type: 'collection',
      placeholder: 'Add Field',
      default: {},
      displayOptions: { show },
      options: optional
        .map((param) => paramToProperty(param))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    });
  }
  return fields;
}

export function buildNodeProperties(): INodeProperties[] {
  const properties: INodeProperties[] = [resourceProperty()];
  for (const resource of RESOURCES) {
    properties.push(operationProperty(resource));
  }
  for (const resource of RESOURCES) {
    const workspace = workspaceProperty(resource);
    if (workspace !== undefined) {
      properties.push(workspace);
    }
  }
  properties.push(...legacyProperties);
  for (const resource of RESOURCES) {
    for (const operation of resource.operations) {
      properties.push(...operationFields(operation));
    }
  }
  return properties;
}

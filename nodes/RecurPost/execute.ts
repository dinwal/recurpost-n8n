import { IDataObject, IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { buildCustomizationBody, formatDateTime } from './composer';
import { generatedOperations } from './generated';
import { recurPostRequest } from './request';
import { OperationSpec, ParamSpec } from './types';

export function findOperation(resource: string, operation: string): OperationSpec | undefined {
  return generatedOperations.find((op) => op.resource === resource && op.operation === operation);
}

function convertValue(ctx: IExecuteFunctions, param: ParamSpec, value: unknown, itemIndex: number): unknown {
  switch (param.kind) {
    case 'date':
      return formatDateTime(String(value), false);
    case 'datetime':
      return formatDateTime(String(value), true);
    case 'number':
      return Number(value);
    case 'list':
      if (Array.isArray(value)) {
        return value;
      }
      return String(value)
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '');
    case 'json':
      if (typeof value !== 'string') {
        return value;
      }
      try {
        return JSON.parse(value);
      } catch {
        throw new NodeOperationError(ctx.getNode(), `"${param.name}" must be valid JSON`, { itemIndex });
      }
    default:
      return value;
  }
}

// Builds the request from the operation's generated definition and sends it. Required params are
// top-level node parameters; optional ones live in the Additional Fields collection and are only
// sent when the user added them.
export async function runGeneratedOperation(
  ctx: IExecuteFunctions,
  spec: OperationSpec,
  itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
  const body: IDataObject = {};
  if (spec.action) {
    body.action = spec.action;
  }
  if (spec.confirm) {
    body.confirm = true;
  }
  if (spec.workspace) {
    const workspaceId = ctx.getNodeParameter('workspaceId', itemIndex, '') as string;
    if (workspaceId) {
      body.workspace_id = workspaceId;
    }
  }

  const additional = ctx.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
  for (const param of spec.params) {
    let value: unknown = additional[param.name];
    if (param.required) {
      value = ctx.getNodeParameter(param.name, itemIndex);
    }
    if (value === undefined || value === null || value === '') {
      continue;
    }
    body[param.key] = convertValue(ctx, param, value, itemIndex) as IDataObject[keyof IDataObject];
  }

  if (spec.composer) {
    Object.assign(body, buildCustomizationBody(ctx, itemIndex));
  }

  const data = await recurPostRequest(ctx, spec.endpoint, body, itemIndex);
  if (spec.unwrap && Array.isArray(data[spec.unwrap])) {
    return data[spec.unwrap] as IDataObject[];
  }
  return data;
}

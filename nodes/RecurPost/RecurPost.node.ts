import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { LIST_SOURCES, WORKSPACE_FIELD, buildParamsBody, listOptions, workspaceBody } from './Fields';
import type { ListSource } from './Fields';
import { apiRequest, errorToJson, toNodeApiError } from './GenericFunctions';
import { buildNodeProperties, findOperation } from './RecurPostDescription';

type LoadOptionsMethod = (this: ILoadOptionsFunctions) => Promise<INodePropertyOptions[]>;

// workspace_id for a dropdown request: the workspace chosen in the node, if any.
function selectedWorkspace(ctx: ILoadOptionsFunctions): IDataObject {
  let workspaceId: unknown;
  try {
    workspaceId = ctx.getCurrentNodeParameter(WORKSPACE_FIELD);
  } catch {
    workspaceId = undefined;
  }
  return typeof workspaceId === 'string' && workspaceId !== '' ? { workspace_id: workspaceId } : {};
}

function listLoader(source: ListSource): LoadOptionsMethod {
  return async function (this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
    const response = await apiRequest.call(this, source.endpoint, selectedWorkspace(this));
    return listOptions(source, response);
  };
}

async function getWorkspaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const response = await apiRequest.call(this, 'workspace_list', {});
  // Empty value = the caller's own default workspace.
  const options: INodePropertyOptions[] = [{ name: 'Default Workspace', value: '' }];
  const list = Array.isArray(response.workspace_list) ? (response.workspace_list as IDataObject[]) : [];
  for (const workspace of list) {
    let name = String(workspace.ws_name ?? workspace.ws_id);
    if (workspace.ownership === 'shared') {
      name += ' (Shared)';
    }
    if (Number(workspace.owner_paused) === 1) {
      name += ' (Paused by Owner)';
    }
    options.push({ name, value: String(workspace.ws_id) });
  }
  return options;
}

const loadOptions: Record<string, LoadOptionsMethod> = { getWorkspaces };
for (const source of LIST_SOURCES) {
  loadOptions[source.method] = listLoader(source);
}

export class RecurPost implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'RecurPost',
    name: 'recurPost',
    icon: 'file:recurpost.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Schedule and automate social media posts with RecurPost',
    defaults: {
      name: 'RecurPost',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'recurPostApi',
        required: true,
      },
    ],
    // One resource per RecurPost API module and one operation per endpoint, built
    // from catalog.json (see scripts/sync-catalog.mjs).
    properties: buildNodeProperties(),
    usableAsTool: true,
  };

  methods = {
    loadOptions,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;
    const definition = findOperation(resource, operation);

    for (let i = 0; i < items.length; i++) {
      try {
        if (definition === undefined) {
          throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}" for resource "${resource}"`, {
            itemIndex: i,
          });
        }
        const endpoint = definition.endpoint;
        const legacy = definition.legacy;

        let body: IDataObject;
        if (legacy !== undefined) {
          body = {
            ...(await legacy.buildBody(this, i)),
            ...buildParamsBody(this, endpoint, i, legacy.covered),
          };
        } else {
          body = buildParamsBody(this, endpoint, i);
        }
        if (endpoint.params.some((p) => p.name === 'workspace_id')) {
          Object.assign(body, workspaceBody(this, i));
        }

        const response = await apiRequest.call(this, endpoint.id, body, i);

        if (endpoint.id === 'user_login') {
          // The node never outputs the access token.
          delete response.token;
        }

        const list = legacy?.unwrap !== undefined ? response[legacy.unwrap] : undefined;
        if (Array.isArray(list)) {
          for (const entry of list as IDataObject[]) {
            returnData.push({ json: entry, pairedItem: { item: i } });
          }
        } else {
          returnData.push({ json: response, pairedItem: { item: i } });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: errorToJson(error), pairedItem: { item: i } });
          continue;
        }
        throw toNodeApiError(this.getNode(), error, i);
      }
    }

    return [returnData];
  }
}

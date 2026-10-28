import { RecurPost } from '../nodes/RecurPost/RecurPost.node';

export interface HttpCall {
  url: string;
  body: Record<string, unknown>;
  options: Record<string, unknown>;
}

// A stubbed reply: a plain body (HTTP 200) or a full wire response.
export interface WireResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: unknown;
}

function isWireResponse(value: unknown): value is WireResponse {
  return typeof value === 'object' && value !== null && 'statusCode' in value;
}

// Minimal stand-in for IExecuteFunctions / ILoadOptionsFunctions. Node
// parameters come from `params`; every HTTP call is recorded and answered
// from `responses` (keyed by URL suffix, first match wins). A response entry
// may be a function so a test can answer differently on each call.
export function createContext(
  params: Record<string, unknown>,
  responses: Array<[string, unknown]> = [['', { status: 200, message: 'Success' }]],
) {
  const calls: HttpCall[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = {
    getInputData: () => [{ json: {} }],
    getCredentials: async () => ({
      email: 'test@example.com',
      apiKey: 'test-key',
      apiUrl: 'https://api.test',
    }),
    getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(params, name) ? params[name] : fallback,
    getCurrentNodeParameter: (name: string) => params[name],
    continueOnFail: () => false,
    getNode: () => ({ name: 'RecurPost', type: 'recurPost', typeVersion: 1 }),
    helpers: {
      httpRequestWithAuthentication: async (_credName: string, options: { url: string; body: Record<string, unknown> }) => {
        calls.push({ url: options.url, body: options.body, options });
        const match = responses.find(([suffix]) => options.url.endsWith(suffix));
        let reply: unknown = { status: 200, message: 'Success' };
        if (match) {
          reply = typeof match[1] === 'function' ? match[1]() : match[1];
        }
        if (isWireResponse(reply)) {
          return { statusCode: reply.statusCode, headers: reply.headers ?? {}, body: reply.body };
        }
        return { statusCode: 200, headers: {}, body: reply };
      },
    },
  };
  return { ctx, calls };
}

export async function run(params: Record<string, unknown>, responses?: Array<[string, unknown]>) {
  const { ctx, calls } = createContext(params, responses);
  const node = new RecurPost();
  const result = await node.execute.call(ctx);
  return { items: result[0], calls };
}

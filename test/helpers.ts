import { RecurPost } from '../nodes/RecurPost/RecurPost.node';

export interface HttpCall {
  credentialType: string;
  method?: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  json?: boolean;
}

export type Responder = (call: HttpCall) => unknown;

export const CREDENTIALS = {
  email: 'test@example.com',
  apiKey: 'test-key',
  apiUrl: 'https://api.test/',
  sessionToken: '',
};

// Minimal stand-in for IExecuteFunctions / ILoadOptionsFunctions. Node parameters come
// from `params`; every HTTP call is recorded and answered by `respond` (or from a
// table keyed by URL suffix). A responder that throws simulates an HTTP error.
export function createContext(
  params: Record<string, unknown>,
  respond: Responder | Array<[string, unknown]> = [],
  options: { continueOnFail?: boolean; items?: number } = {},
) {
  const calls: HttpCall[] = [];
  const responder: Responder =
    typeof respond === 'function'
      ? respond
      : (call) => {
          const match = respond.find(([suffix]) => call.url.endsWith(suffix));
          return match ? match[1] : { status: 200, message: 'Success' };
        };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = {
    getInputData: () => Array.from({ length: options.items ?? 1 }, () => ({ json: {} })),
    getCredentials: async () => ({ ...CREDENTIALS }),
    getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(params, name) ? params[name] : fallback,
    getCurrentNodeParameter: (name: string) => params[name],
    continueOnFail: () => options.continueOnFail === true,
    getNode: () => ({ id: 'n1', name: 'RecurPost', type: 'recurPost', typeVersion: 1, position: [0, 0], parameters: {} }),
    helpers: {
      httpRequestWithAuthentication: async (
        credentialType: string,
        request: { method?: string; url: string; headers?: Record<string, string>; body?: Record<string, unknown>; json?: boolean },
      ) => {
        const call: HttpCall = {
          credentialType,
          method: request.method,
          url: request.url,
          headers: request.headers ?? {},
          body: request.body ?? {},
          json: request.json,
        };
        calls.push(call);
        return responder(call);
      },
    },
  };
  return { ctx, calls };
}

export async function run(
  params: Record<string, unknown>,
  respond?: Responder | Array<[string, unknown]>,
  options?: { continueOnFail?: boolean; items?: number },
) {
  const { ctx, calls } = createContext(params, respond, options);
  const node = new RecurPost();
  const result = await node.execute.call(ctx);
  return { items: result[0], calls };
}

// An error shaped like the one n8n's request helper throws for an HTTP error answer:
// a NodeApiError-like object with the body in context.data and the axios error in cause.
export function httpError(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const axiosError = Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, statusText: 'Error', headers, data: body },
  });
  return Object.assign(new Error('The service was not able to process your request'), {
    httpCode: String(status),
    context: { data: body },
    cause: axiosError,
  });
}

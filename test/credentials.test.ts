/* eslint-disable @n8n/community-nodes/no-restricted-imports -- vitest is a devDependency; tests are excluded from the published package */
import { describe, it, expect } from 'vitest';
import { NodeApiError } from 'n8n-workflow';
import type { ICredentialDataDecryptedObject, IHttpRequestOptions } from 'n8n-workflow';
import { RecurPostApi } from '../credentials/RecurPostApi.credentials';
import { RecurPost } from '../nodes/RecurPost/RecurPost.node';
import { extractApiError, toNodeApiError } from '../nodes/RecurPost/GenericFunctions';
import { httpError } from './helpers';

const credentialType = new RecurPostApi();
const node = { id: 'n1', name: 'RecurPost', type: 'recurPost', typeVersion: 1, position: [0, 0] as [number, number], parameters: {} };

function axiosError(status: number, data: unknown, headers: Record<string, string> = {}) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, headers, data },
  });
}

describe('credential type', () => {
  it('has an expirable hidden session token, email, API key and API URL', () => {
    const [token, email, apiKey, apiUrl] = credentialType.properties;
    expect(token).toMatchObject({ name: 'sessionToken', type: 'hidden', typeOptions: { expirable: true, password: true } });
    expect(email.name).toBe('email');
    expect(apiKey).toMatchObject({ name: 'apiKey', typeOptions: { password: true } });
    expect(apiKey.description).toContain('Account Settings > API key');
    expect(apiUrl).toMatchObject({ name: 'apiUrl', default: 'https://social.recurpost.com' });
  });

  it('sends the Bearer token and the client header on every authenticated request', () => {
    expect(credentialType.authenticate).toEqual({
      type: 'generic',
      properties: {
        headers: {
          Authorization: '=Bearer {{$credentials.sessionToken}}',
          'X-RecurPost-Client': 'n8n',
        },
      },
    });
  });

  it('tests the credential with /api/user_login and the client header', () => {
    expect(credentialType.test.request).toMatchObject({
      url: '/api/user_login',
      method: 'POST',
      headers: { 'X-RecurPost-Client': 'n8n' },
      body: { emailid: '={{$credentials.email}}', api_key: '={{$credentials.apiKey}}' },
    });
  });

  it('preAuthentication logs in with api_key and the client header and returns the token', async () => {
    const requests: IHttpRequestOptions[] = [];
    const helpers = {
      httpRequest: async (options: IHttpRequestOptions) => {
        requests.push(options);
        return { status: 200, token: 'tok-1', expires_in: 3600 };
      },
    };
    const result = await credentialType.preAuthentication.call(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { helpers } as any,
      { email: 'test@example.com', apiKey: 'test-key', apiUrl: 'https://api.test/' },
    );
    expect(result).toEqual({ sessionToken: 'tok-1' });
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.test/api/user_login',
      body: { emailid: 'test@example.com', api_key: 'test-key' },
      json: true,
    });
    expect(requests[0].headers?.['X-RecurPost-Client']).toBe('n8n');
  });

  it('preAuthentication failures show the API error and code, without an HTTP response', async () => {
    const helpers = {
      httpRequest: async () => {
        throw axiosError(401, {
          status: 401,
          error: "We could not authenticate the user's RecurPost credentials.",
          code: 'invalid_credentials',
        });
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const error = await credentialType.preAuthentication.call({ helpers } as any, { email: 'x', apiKey: 'y' }).catch((e) => e);
    expect(error.message).toBe(
      "RecurPost login failed: We could not authenticate the user's RecurPost credentials. (code: invalid_credentials)",
    );
    // No response: n8n must not retry a failed login (that would count towards login_locked).
    expect(error.response).toBeUndefined();
    expect(extractApiError(error)).toMatchObject({ code: 'invalid_credentials', httpStatus: 401 });

    const locked = {
      httpRequest: async () => {
        throw axiosError(
          429,
          { status: 429, error: 'Too many failed attempts. Try again in 10 minutes.', code: 'login_locked' },
          { 'Retry-After': '600' },
        );
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lockedError = await credentialType.preAuthentication.call({ helpers: locked } as any, {}).catch((e) => e);
    expect(lockedError.message).toBe(
      'RecurPost login failed: Too many failed attempts. Try again in 10 minutes. (code: login_locked) Retry after 600 seconds.',
    );
  });

  it('preAuthentication rejects an answer without a token', async () => {
    const helpers = { httpRequest: async () => ({ status: 200 }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(credentialType.preAuthentication.call({ helpers } as any, {})).rejects.toThrow('has no token');
  });
});

// A stand-in for n8n-core's httpRequestWithAuthentication: run preAuthentication when the
// expirable token is empty, apply `authenticate`, and on a 401 log in again (expired) and
// retry once. It shows the credential type works with that flow.
function coreLikeRequester(
  credentials: ICredentialDataDecryptedObject,
  server: (options: IHttpRequestOptions) => unknown,
  logins: string[],
) {
  const helpers = {
    httpRequest: async (options: IHttpRequestOptions) => {
      const token = `tok-${logins.length + 1}`;
      logins.push(token);
      expect(options.url).toMatch(/\/api\/user_login$/);
      return { status: 200, token };
    },
  };
  const preAuth = async (expired: boolean) => {
    if (credentials.sessionToken === '' || expired) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.assign(credentials, await credentialType.preAuthentication.call({ helpers } as any, credentials));
    }
  };
  const authenticate = (options: IHttpRequestOptions): IHttpRequestOptions => {
    const headers = credentialType.authenticate.properties.headers as Record<string, string>;
    return {
      ...options,
      headers: {
        ...options.headers,
        Authorization: headers.Authorization.replace('=Bearer {{$credentials.sessionToken}}', `Bearer ${credentials.sessionToken}`),
        'X-RecurPost-Client': headers['X-RecurPost-Client'],
      },
    };
  };
  return async (_type: string, options: IHttpRequestOptions) => {
    try {
      await preAuth(false);
      return await server(authenticate(options));
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status === 401) {
        try {
          await preAuth(true);
          return await server(authenticate(options));
        } catch (retryError) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          throw new NodeApiError(node, retryError as any);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new NodeApiError(node, error as any);
    }
  };
}

describe('token lifecycle with the n8n request flow', () => {
  it('logs in again on 401 token_expired and retries the call once with the new token', async () => {
    const credentials: ICredentialDataDecryptedObject = {
      email: 'test@example.com',
      apiKey: 'test-key',
      apiUrl: 'https://api.test',
      sessionToken: 'old-token',
    };
    const logins: string[] = [];
    const seenTokens: string[] = [];
    const server = (options: IHttpRequestOptions) => {
      const auth = (options.headers as Record<string, string>).Authorization;
      seenTokens.push(auth);
      if (auth === 'Bearer old-token') {
        throw axiosError(401, { status: 401, error: 'Access token expired. Log in again to get a new one.', code: 'token_expired' });
      }
      return { status: 200, workspace_list: [{ ws_id: 'w1', ws_name: 'Mine' }] };
    };
    const requester = coreLikeRequester(credentials, server, logins);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx: any = {
      getInputData: () => [{ json: {} }],
      getCredentials: async () => credentials,
      getNodeParameter: (name: string) => ({ resource: 'workspace', operation: 'getAll' })[name],
      continueOnFail: () => false,
      getNode: () => node,
      helpers: { httpRequestWithAuthentication: requester },
    };
    const result = await new RecurPost().execute.call(ctx);
    expect(seenTokens).toEqual(['Bearer old-token', 'Bearer tok-1']);
    expect(logins).toEqual(['tok-1']);
    expect(credentials.sessionToken).toBe('tok-1');
    expect(result[0].map((i) => i.json)).toEqual([{ ws_id: 'w1', ws_name: 'Mine' }]);
  });

  it('logs in first when there is no token yet, and maps a second 401 to the API error', async () => {
    const credentials: ICredentialDataDecryptedObject = { email: 'e', apiKey: 'k', apiUrl: 'https://api.test', sessionToken: '' };
    const logins: string[] = [];
    const server = () => {
      throw axiosError(401, { status: 401, error: 'Invalid access token.', code: 'token_invalid' });
    };
    const requester = coreLikeRequester(credentials, server, logins);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx: any = {
      getInputData: () => [{ json: {} }],
      getCredentials: async () => credentials,
      getNodeParameter: (name: string) => ({ resource: 'workspace', operation: 'getAll' })[name],
      continueOnFail: () => false,
      getNode: () => node,
      helpers: { httpRequestWithAuthentication: requester },
    };
    await expect(new RecurPost().execute.call(ctx)).rejects.toThrow('Invalid access token. (code: token_invalid)');
    expect(logins).toEqual(['tok-1', 'tok-2']);
  });
});

describe('error mapping', () => {
  it('reads the error from an n8n NodeApiError, a raw axios error and a login error', () => {
    const wrapped = new NodeApiError(
      node,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      axiosError(409, { status: 409, error: 'Already exists.', code: 'conflict' }) as any,
    );
    expect(extractApiError(wrapped)).toMatchObject({ httpStatus: 409, error: 'Already exists.', code: 'conflict' });
    expect(
      extractApiError(axiosError(400, { status: 400, error: 'Bad id.', code: 'invalid_id', details: { id: 'x' } })),
    ).toMatchObject({ httpStatus: 400, code: 'invalid_id', details: { id: 'x' } });
    expect(extractApiError(httpError(500, { status: 500, error: 'Oops.', code: 'internal_error' }))).toMatchObject({
      httpStatus: 500,
      code: 'internal_error',
    });
    expect(extractApiError(new Error('socket hang up'))).toBeUndefined();
  });

  it('builds the NodeApiError message and description from the answer', () => {
    const error = toNodeApiError(
      node,
      httpError(403, { status: 403, error: 'Not allowed.', code: 'permission_denied', permission: 'library' }),
      2,
    ) as NodeApiError;
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toBe('Not allowed. (code: permission_denied)');
    expect(error.description).toBe('HTTP 403, code permission_denied, missing permission library');
    expect(error.httpCode).toBe('403');
    expect(error.context.itemIndex).toBe(2);
  });

  it('keeps errors that are not API answers', () => {
    const generic = toNodeApiError(node, new Error('socket hang up'));
    expect(generic).toBeInstanceOf(NodeApiError);
    expect(generic.message).toContain('socket hang up');
  });
});

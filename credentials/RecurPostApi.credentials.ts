import type {
  IAuthenticateGeneric,
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  IDataObject,
  IHttpRequestHelper,
  INodeProperties,
} from 'n8n-workflow';

const CLIENT_HEADER = 'X-RecurPost-Client';
const CLIENT_NAME = 'n8n';
const DEFAULT_API_URL = 'https://social.recurpost.com';

function baseUrl(value: unknown): string {
  const url = typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_API_URL;
  return url.replace(/\/+$/, '');
}

function responseOf(error: unknown): IDataObject | undefined {
  if (error === null || typeof error !== 'object') {
    return undefined;
  }
  const candidate = error as IDataObject;
  const response = (candidate.response ?? (candidate.cause as IDataObject | undefined)?.response) as
    | IDataObject
    | undefined;
  return response !== null && typeof response === 'object' ? response : undefined;
}

// The login failure as an Error whose message carries the API's error and code (and
// Retry-After on a 429). The answer is attached as `recurpost` for the node's error
// handling. It deliberately has no HTTP response attached: n8n retries a request whose
// error has a 401 response by logging in again, and a second login with the same wrong
// key would only count towards the API's login lockout.
function loginError(error: unknown): Error {
  const response = responseOf(error);
  let data = response?.data as IDataObject | string | undefined;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as IDataObject;
    } catch {
      data = undefined;
    }
  }
  const headers = (response?.headers ?? {}) as IDataObject;
  const retryHeader = Object.entries(headers).find(([key]) => key.toLowerCase() === 'retry-after')?.[1];
  const body = data !== undefined && typeof data === 'object' ? data : undefined;
  if (body === undefined || typeof body.error !== 'string') {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`RecurPost login failed: ${message}`);
  }
  const info: IDataObject = {
    httpStatus: Number(response?.status ?? body.status) || undefined,
    error: body.error,
    code: body.code,
  };
  let message = `RecurPost login failed: ${body.error}`;
  if (body.code) {
    message += ` (code: ${String(body.code)})`;
  }
  if (retryHeader !== undefined && retryHeader !== null) {
    info.retryAfter = String(retryHeader);
    message += ` Retry after ${String(retryHeader)} seconds.`;
  }
  const result = new Error(message) as Error & { recurpost?: IDataObject };
  result.recurpost = info;
  return result;
}

export class RecurPostApi implements ICredentialType {
  name = 'recurPostApi';
  displayName = 'RecurPost API';
  documentationUrl = 'https://developers.recurpost.com/';
  icon = 'file:recurpost.svg' as const;
  properties: INodeProperties[] = [
    {
      // Filled by preAuthentication() from /api/user_login and sent as the Bearer
      // token. n8n logs in again when it is empty or a call answers 401
      // (token_expired / token_invalid); tokens last one hour.
      displayName: 'Session Token',
      name: 'sessionToken',
      type: 'hidden',
      typeOptions: {
        expirable: true,
        password: true,
      },
      default: '',
    },
    {
      displayName: 'Email',
      name: 'email',
      type: 'string',
      placeholder: 'name@email.com',
      default: '',
      required: true,
      description: 'The email address of your RecurPost account',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'Your RecurPost API key, from Account Settings > API key in RecurPost',
    },
    {
      displayName: 'API URL',
      name: 'apiUrl',
      type: 'string',
      default: DEFAULT_API_URL,
      required: true,
      description: 'RecurPost API base URL',
    },
  ];

  // Exchanges the email and API key for an access token (POST /api/user_login).
  async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
    let response: IDataObject;
    try {
      response = (await this.helpers.httpRequest({
        method: 'POST',
        url: `${baseUrl(credentials.apiUrl)}/api/user_login`,
        headers: {
          [CLIENT_HEADER]: CLIENT_NAME,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: {
          emailid: credentials.email,
          api_key: credentials.apiKey,
        },
        json: true,
      })) as IDataObject;
    } catch (error) {
      throw loginError(error);
    }
    if (typeof response?.token !== 'string' || response.token === '') {
      throw new Error('RecurPost login failed: the answer of /api/user_login has no token');
    }
    return { sessionToken: response.token };
  }

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.sessionToken}}',
        [CLIENT_HEADER]: CLIENT_NAME,
      },
    },
  };

  // n8n runs preAuthentication() (a login) before the test request, so a wrong email or
  // key fails with the API's message. The test request logs in once more.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.apiUrl}}',
      url: '/api/user_login',
      method: 'POST',
      headers: {
        [CLIENT_HEADER]: CLIENT_NAME,
      },
      body: {
        emailid: '={{$credentials.email}}',
        api_key: '={{$credentials.apiKey}}',
      },
      json: true,
    },
  };
}

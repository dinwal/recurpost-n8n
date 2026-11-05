import {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  IN8nHttpFullResponse,
  JsonObject,
  NodeApiError,
} from 'n8n-workflow';

type RequestContext = IExecuteFunctions | ILoadOptionsFunctions;

// RecurPost reads every request with PHP's $_POST, so the body goes form encoded and
// nested values become bracket keys (image_url[0], tabs[facebook][message]) the way PHP
// rebuilds them. Empty strings, null and undefined are dropped; booleans go as 1 / 0.
export function flattenBody(body: IDataObject, prefix = ''): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [name, value] of Object.entries(body)) {
    const key = prefix ? `${prefix}[${name}]` : name;
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) {
      Object.assign(flat, flattenBody(value as IDataObject, key));
      continue;
    }
    if (typeof value === 'boolean') {
      flat[key] = value ? '1' : '0';
      continue;
    }
    flat[key] = String(value);
  }
  return flat;
}

function parseBody(raw: unknown): IDataObject {
  if (typeof raw !== 'string') {
    return (raw ?? {}) as IDataObject;
  }
  try {
    return JSON.parse(raw) as IDataObject;
  } catch {
    return { error: raw };
  }
}

/**
 * Posts to one RecurPost API endpoint and returns the decoded body.
 *
 * Credentials travel in the Authorization header (set by the credential type), never in the body.
 * The legacy endpoints answer HTTP 200 with the real code in the body `status` field, so both are
 * checked. A 429 (rate limit) surfaces as an error with the server's wait time in the message; the
 * node cannot sleep, so the user enables "Retry On Fail" on the node to wait it out.
 */
export async function recurPostRequest(
  ctx: RequestContext,
  endpoint: string,
  body: IDataObject = {},
  itemIndex?: number,
): Promise<IDataObject> {
  const credentials = await ctx.getCredentials('recurPostApi');
  const apiUrl = String(credentials.apiUrl ?? '').replace(/\/+$/, '');

  const options: IHttpRequestOptions = {
    method: 'POST',
    url: `${apiUrl}/api/${endpoint}`,
    // The user agent names this node, so the account's API key page can list n8n among the connected tools
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'n8n-nodes-recurpost' },
    body: flattenBody(body),
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
  };

  const response = (await ctx.helpers.httpRequestWithAuthentication.call(
    ctx,
    'recurPostApi',
    options,
  )) as IN8nHttpFullResponse;

  const data = parseBody(response.body);
  const status = Number(data.status ?? response.statusCode);
  if (response.statusCode >= 400 || status !== 200) {
    const message = String(data.error ?? data.message ?? `RecurPost API error ${status}`);
    throw new NodeApiError(ctx.getNode(), data as JsonObject, {
      message,
      httpCode: String(status),
      itemIndex,
    });
  }
  return data;
}

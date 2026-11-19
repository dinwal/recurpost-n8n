import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INode,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

// Sent on every request (login included) so RecurPost can tell n8n traffic apart
// in its request log, on the API key page and in analytics.
export const CLIENT_HEADER = 'X-RecurPost-Client';
export const CLIENT_NAME = 'n8n';

export const DEFAULT_API_URL = 'https://social.recurpost.com';

export function normalizeBaseUrl(value: unknown): string {
  const url = typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_API_URL;
  return url.replace(/\/+$/, '');
}

// The parts of a RecurPost API error answer: {status, error, code} plus extra fields
// such as permission or details, and the Retry-After header of a 429.
export interface RecurPostApiErrorInfo {
  httpStatus?: number;
  error?: string;
  code?: string;
  retryAfter?: string;
  permission?: string;
  details?: unknown;
}

function asObject(value: unknown): IDataObject | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as IDataObject;
  }
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      return asObject(parsed);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function headerValue(headers: unknown, name: string): string | undefined {
  const object = asObject(headers);
  if (object === undefined) {
    return undefined;
  }
  for (const [key, value] of Object.entries(object)) {
    if (key.toLowerCase() === name.toLowerCase() && value !== undefined && value !== null) {
      return String(Array.isArray(value) ? value[0] : value);
    }
  }
  return undefined;
}

function toStatus(value: unknown): number | undefined {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}

// Finds the RecurPost error answer inside whatever n8n threw: an axios error, a
// NodeApiError wrapping one (n8n puts the body in context.data and the axios error in
// cause), a NodeApiError made by toNodeApiError, or the error our credential's login
// step throws.
export function extractApiError(error: unknown): RecurPostApiErrorInfo | undefined {
  const candidates: IDataObject[] = [];
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  while (queue.length > 0 && candidates.length < 12) {
    const current = asObject(queue.shift());
    if (current === undefined || seen.has(current)) {
      continue;
    }
    seen.add(current);
    candidates.push(current);
    queue.push(current.recurpost, current.errorResponse, current.cause, current.context, current.response, current.error);
  }

  let body: IDataObject | undefined;
  let httpStatus: number | undefined;
  let retryAfter: string | undefined;
  for (const candidate of candidates) {
    const known = asObject(candidate.recurpost);
    if (known !== undefined && typeof known.error === 'string') {
      return known as RecurPostApiErrorInfo;
    }
    const response = asObject(candidate.response);
    // The answer itself (a NodeApiError built by toNodeApiError keeps it as errorResponse)
    const self =
      typeof candidate.error === 'string' && candidate.code !== undefined && toStatus(candidate.status) !== undefined
        ? candidate
        : undefined;
    const data = self ?? asObject(candidate.data) ?? asObject(response?.data) ?? asObject(candidate.body);
    if (body === undefined && data !== undefined && typeof data.error === 'string' && data.code !== undefined) {
      body = data;
    }
    httpStatus =
      httpStatus ??
      toStatus(response?.status) ??
      toStatus(candidate.statusCode) ??
      toStatus(candidate.httpCode);
    retryAfter =
      retryAfter ?? headerValue(response?.headers, 'retry-after') ?? headerValue(candidate.headers, 'retry-after');
  }

  if (body === undefined) {
    return undefined;
  }
  return {
    httpStatus: httpStatus ?? toStatus(body.status),
    error: body.error as string,
    code: body.code !== undefined ? String(body.code) : undefined,
    retryAfter: retryAfter ?? (body.retry_after !== undefined ? String(body.retry_after) : undefined),
    permission: typeof body.permission === 'string' ? body.permission : undefined,
    details: body.details,
  };
}

// One readable line: the API's error message, its code and, on a 429, when to retry.
export function formatApiErrorMessage(info: RecurPostApiErrorInfo): string {
  let message = info.error || 'RecurPost API error';
  if (info.code) {
    message += ` (code: ${info.code})`;
  }
  if (info.retryAfter) {
    message += ` Retry after ${info.retryAfter} seconds.`;
  }
  return message;
}

function formatApiErrorDescription(info: RecurPostApiErrorInfo): string {
  const parts: string[] = [];
  if (info.httpStatus) {
    parts.push(`HTTP ${info.httpStatus}`);
  }
  if (info.code) {
    parts.push(`code ${info.code}`);
  }
  if (info.permission) {
    parts.push(`missing permission ${info.permission}`);
  }
  if (info.retryAfter) {
    parts.push(`Retry-After ${info.retryAfter}s`);
  }
  if (info.details !== undefined && info.details !== null && info.details !== '') {
    parts.push(`details: ${typeof info.details === 'string' ? info.details : JSON.stringify(info.details)}`);
  }
  return parts.join(', ');
}

// Turns any request failure into a NodeApiError whose message shows the API's
// error and code (and Retry-After on a 429).
export function toNodeApiError(node: INode, error: unknown, itemIndex?: number): NodeApiError | NodeOperationError {
  if (error instanceof NodeOperationError) {
    return error;
  }
  const info = extractApiError(error);
  if (info === undefined) {
    if (error instanceof NodeApiError) {
      return error;
    }
    return new NodeApiError(node, (error ?? {}) as JsonObject, { itemIndex });
  }
  const errorObject: JsonObject = {
    status: info.httpStatus ?? null,
    error: info.error ?? null,
    code: info.code ?? null,
  };
  if (info.retryAfter !== undefined) {
    errorObject.retry_after = info.retryAfter;
  }
  if (info.permission !== undefined) {
    errorObject.permission = info.permission;
  }
  return new NodeApiError(node, errorObject, {
    message: formatApiErrorMessage(info),
    description: formatApiErrorDescription(info),
    httpCode: info.httpStatus !== undefined ? String(info.httpStatus) : undefined,
    itemIndex,
  });
}

// The JSON to return for a failed item when "Continue On Fail" is on.
export function errorToJson(error: unknown): IDataObject {
  const info = extractApiError(error);
  const message = error instanceof Error ? error.message : String(error);
  if (info === undefined) {
    return { error: message };
  }
  const result: IDataObject = { error: info.error ?? message, code: info.code ?? null };
  if (info.httpStatus !== undefined) {
    result.status = info.httpStatus;
  }
  if (info.retryAfter !== undefined) {
    result.retry_after = info.retryAfter;
  }
  if (info.permission !== undefined) {
    result.permission = info.permission;
  }
  return result;
}

// POST https://<host>/api/<endpoint> with a JSON body. The credential logs in through
// /api/user_login, sends the Bearer token and logs in again when a call answers 401
// (token_expired / token_invalid), after which n8n retries the call once.
export async function apiRequest(
  this: IExecuteFunctions | ILoadOptionsFunctions,
  endpoint: string,
  body: IDataObject = {},
  itemIndex?: number,
): Promise<IDataObject> {
  const credentials = await this.getCredentials('recurPostApi');
  const options: IHttpRequestOptions = {
    method: 'POST',
    url: `${normalizeBaseUrl(credentials.apiUrl)}/api/${endpoint}`,
    headers: {
      [CLIENT_HEADER]: CLIENT_NAME,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body,
    json: true,
  };
  try {
    const response = await this.helpers.httpRequestWithAuthentication.call(this, 'recurPostApi', options);
    return (asObject(response) ?? { data: response }) as IDataObject;
  } catch (error) {
    throw toNodeApiError(this.getNode(), error, itemIndex);
  }
}

// n8n dateTime values to the API's formats ("Y-m-d" or "Y-m-d H:i:s"). The wall-clock
// digits the user entered are kept as they are (the API reads them in the account's
// timezone), so the n8n server timezone never shifts them.
export function formatDateTime(value: unknown, includeTime: boolean): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    if (!includeTime) {
      return match[1];
    }
    return `${match[1]} ${match[2] ?? '00'}:${match[3] ?? '00'}:${match[4] ?? '00'}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (!includeTime) {
    return day;
  }
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// A list field: an array from an expression, a JSON array string or a
// comma-separated string.
export function toList(value: unknown): unknown[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Not JSON: fall back to comma-separated values.
      }
    }
    return text
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '');
  }
  return [value];
}

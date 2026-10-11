import type { ApiErrorCode } from "./types";

export type ApiErrorKind = "config" | "network" | "http" | "invalid_response" | "aborted";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  // The error.code of the API error body (prd.md section 8), when the body has the agreed shape.
  readonly code?: ApiErrorCode;

  constructor(kind: ApiErrorKind, message: string, options?: { status?: number; code?: ApiErrorCode; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = options?.status;
    this.code = options?.code;
  }
}

const ERROR_CODES: readonly ApiErrorCode[] = ["bad_request", "not_found", "upstream_unavailable", "internal"];

// The API writes error.message for users. Any other body (HTML, a stack trace, an unknown code) is never shown.
async function readErrorBody(response: Response): Promise<{ code: ApiErrorCode; message: string } | null> {
  try {
    const error = ((await response.json()) as { error?: { code?: unknown; message?: unknown } } | null)?.error;
    const code = ERROR_CODES.find((c) => c === error?.code);
    const message = typeof error?.message === "string" ? error.message.trim() : "";
    return code && message && message.length <= 300 ? { code, message } : null;
  } catch {
    return null;
  }
}

export type QueryValue = string | number | boolean | null | undefined | readonly string[];
export type Query = Record<string, QueryValue>;

export type RequestOptions = {
  method?: "GET" | "POST";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export function getApiBaseUrl(raw: string | undefined = process.env.NEXT_PUBLIC_API_URL): string {
  const value = raw?.trim();
  if (!value) {
    throw new ApiError("config", "The solGPU API URL is not configured (NEXT_PUBLIC_API_URL).");
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
  } catch (cause) {
    throw new ApiError("config", "The configured solGPU API URL is invalid.", { cause });
  }
  return value.replace(/\/+$/, "");
}

export function buildApiUrl(baseUrl: string, path: string, query?: Query): string {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    const values = typeof value === "object" ? value : [String(value)];
    for (const item of values) url.searchParams.append(key, item);
  }
  return url.toString();
}

export function apiRequest(path: string, options?: RequestOptions): Promise<unknown>;
export function apiRequest<T>(
  path: string,
  options: RequestOptions & { decode: (data: unknown) => T },
): Promise<T>;
export async function apiRequest<T>(
  path: string,
  { method = "GET", query, body, signal, baseUrl, fetchImpl = fetch, decode }: RequestOptions & {
    decode?: (data: unknown) => T;
  } = {},
): Promise<T | unknown> {
  const url = buildApiUrl(baseUrl ?? getApiBaseUrl(), path, query);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw new ApiError("aborted", "The request was cancelled.", { cause });
    throw new ApiError("network", "Could not reach the solGPU API.", { cause });
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new ApiError("http", body?.message ?? `The solGPU API responded with status ${response.status}.`, {
      status: response.status,
      code: body?.code,
    });
  }

  let data: unknown;
  try {
    data = response.status === 204 ? null : await response.json();
  } catch (cause) {
    if (signal?.aborted) throw new ApiError("aborted", "The request was cancelled.", { cause });
    throw new ApiError("invalid_response", "The solGPU API returned an unreadable response.", {
      cause,
    });
  }

  if (!decode) return data;
  try {
    return decode(data);
  } catch (cause) {
    throw new ApiError("invalid_response", "The solGPU API returned unexpected data.", { cause });
  }
}

export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong while loading data.";
}

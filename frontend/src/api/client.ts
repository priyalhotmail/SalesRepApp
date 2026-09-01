const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000/api";

export const ACCESS_TOKEN_KEY = "accessToken";

export type ApiListMeta = {
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type ApiListResponse<T> = {
  data: T[];
  meta?: ApiListMeta;
};

export type ApiRequestOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, number | string | boolean | undefined>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
  }
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function buildQueryString(
  query?: Record<string, number | string | boolean | undefined>
) {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(
    `${API_BASE_URL}/${path.replace(/^\//, "")}${buildQueryString(options.query)}`,
    {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      method: options.method ?? "GET"
    }
  );

  const text = await response.text();
  const responseText = text.trim();
  let parsed: unknown = null;

  // Some API handlers intentionally do not return a body. Depending on the
  // server/proxy in use, that can be serialized as the literal string
  // "undefined" rather than an empty response.
  if (responseText && responseText !== "undefined") {
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new ApiError(
        response.ok
          ? "The server returned an invalid response."
          : responseText || `Request failed with HTTP ${response.status}`,
        response.status
      );
    }
  }

  if (!response.ok) {
    const message =
      parsed &&
      typeof parsed === "object" &&
      "message" in parsed &&
      typeof parsed.message === "string"
        ? parsed.message
        : `Request failed with HTTP ${response.status}`;
    throw new ApiError(
      message,
      response.status,
      parsed
    );
  }

  return parsed as T;
}

export function normalizeListResponse<T>(response: unknown): ApiListResponse<T> {
  if (Array.isArray(response)) {
    return { data: response as T[] };
  }
  if (
    response &&
    typeof response === "object" &&
    Array.isArray((response as { data?: unknown }).data)
  ) {
    return response as ApiListResponse<T>;
  }
  return { data: [] };
}

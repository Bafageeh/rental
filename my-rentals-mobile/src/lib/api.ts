import Constants from "expo-constants";
import { clearAuthSession, getAuthToken } from "./auth";

const DEFAULT_API_BASE_URL = "https://rental.pm.sa/api";
const LEGACY_OR_BROKEN_API_BASE_URLS = new Set([
  "https://rentals-api.pm.sa/api",
  "http://rentals-api.pm.sa/api",
]);

declare global {
  // يستخدم لتقييد اختيارات التعديل حسب السجل المفتوح حاليًا، خصوصًا عند دخول المدير من مالك محدد.
  // eslint-disable-next-line no-var
  var __RENTAL_EDIT_CONTEXT__: { resource?: string; id?: string | number; owner_id?: string | number } | undefined;
}

function normalizeApiBaseUrl(value?: string | null) {
  const normalized = (value || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

  if (LEGACY_OR_BROKEN_API_BASE_URLS.has(normalized)) {
    return DEFAULT_API_BASE_URL;
  }

  return normalized;
}

const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ||
  DEFAULT_API_BASE_URL;

const API_BASE_URL = normalizeApiBaseUrl(configuredApiBaseUrl);

function buildErrorMessage(json: any, fallback: string) {
  if (Array.isArray(json?.blockers) && json.blockers.length > 0) {
    const details = json.blockers.map((item: unknown) => `- ${String(item)}`).join("\n");
    return `${json?.message || fallback}\n\nالارتباطات:\n${details}`;
  }

  if (json?.message && typeof json.message === "string") {
    if (json?.errors && typeof json.errors === "object") {
      const values = Object.values(json.errors) as unknown[];
      const firstValue = values.length > 0 ? values[0] : null;
      const firstError = Array.isArray(firstValue) ? firstValue[0] : firstValue;

      if (typeof firstError === "string") {
        return `${json.message}: ${firstError}`;
      }
    }

    return json.message;
  }

  return fallback;
}

function buildHeaders(hasJsonBody = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (hasJsonBody) {
    headers["Content-Type"] = "application/json";
  }

  return getAuthToken()
    .then((token) => {
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        headers["X-Api-Token"] = token;
      }
      return headers;
    })
    .catch(() => headers);
}

function parseResponse(response: Response) {
  return response.text().then((text) => {
    let json: any = null;

    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }

    if (!response.ok) {
      const error = new Error(buildErrorMessage(json, `API Error ${response.status}`));

      if (response.status === 401) {
        return clearAuthSession()
          .catch(() => undefined)
          .then(() => Promise.reject(error));
      }

      throw error;
    }

    return json;
  });
}

function normalizeFetchError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error("انتهت مهلة الاتصال بالخادم");
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowerMessage = message.toLowerCase();

  if (
    error instanceof TypeError ||
    lowerMessage.includes("network request failed") ||
    lowerMessage.includes("failed to fetch")
  ) {
    return new Error(`تعذر الاتصال بالخادم. عنوان API الحالي: ${API_BASE_URL}`);
  }

  return error instanceof Error ? error : new Error("تعذر الاتصال بالخادم");
}

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  })
    .catch((error) => {
      throw normalizeFetchError(error);
    })
    .finally(() => {
      clearTimeout(timer);
    });
}

function appendQuery(path: string, params: Record<string, string>) {
  const entries = Object.entries(params).filter(([, value]) => value !== "");
  if (entries.length === 0) return path;

  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

function addEditContextToScopedPath(path: string) {
  if (!path.includes("/edit-delete-center/lookups")) {
    return path;
  }

  const context = globalThis.__RENTAL_EDIT_CONTEXT__ || {};
  return appendQuery(path, {
    resource: context.resource === undefined ? "" : String(context.resource),
    id: context.id === undefined ? "" : String(context.id),
    owner_id: context.owner_id === undefined ? "" : String(context.owner_id),
  });
}

export function apiGet(path: string) {
  return buildHeaders(false)
    .then((headers) =>
      fetchWithTimeout(
        `${API_BASE_URL}${path}`,
        {
          headers,
        },
        10000,
      ),
    )
    .then((response) => parseResponse(response));
}

export function apiPost(path: string, body: Record<string, unknown> = {}) {
  return buildHeaders(true)
    .then((headers) =>
      fetchWithTimeout(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    )
    .then((response) => parseResponse(response));
}

export function apiGetScoped(_normalPath: string, scopedPath: string) {
  return apiGet(addEditContextToScopedPath(scopedPath));
}

export function apiPostFormData(path: string, formData: FormData) {
  return buildHeaders(false)
    .then((headers) =>
      fetchWithTimeout(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: formData,
      }),
    )
    .then((response) => parseResponse(response));
}

export function apiPostAny(paths: string[], body: Record<string, unknown> = {}) {
  let lastError: unknown = null;

  function tryAt(index: number): Promise<any> {
    if (index >= paths.length) {
      return Promise.reject(lastError instanceof Error ? lastError : new Error("تعذر تنفيذ العملية"));
    }

    return apiPost(paths[index], body).catch((error) => {
      lastError = error;
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      const is404 = msg.includes("404") || msg.includes("not found");

      if (!is404) {
        throw error;
      }

      return tryAt(index + 1);
    });
  }

  return tryAt(0);
}

import { clearAuthSession, getAuthToken } from "./auth";

const API_BASE_URL = "https://my.pm.sa/api";

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

export function apiGet(path: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  return buildHeaders(false)
    .then((headers) =>
      fetch(`${API_BASE_URL}${path}`, {
        headers,
        signal: controller.signal,
      }),
    )
    .then((response) => parseResponse(response))
    .catch((error) => {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("انتهت مهلة الاتصال بالخادم");
      }

      throw error;
    })
    .then(
      (result) => {
        clearTimeout(timer);
        return result;
      },
      (error) => {
        clearTimeout(timer);
        throw error;
      },
    );
}

export function apiPost(path: string, body: Record<string, unknown> = {}) {
  return buildHeaders(true)
    .then((headers) =>
      fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    )
    .then((response) => parseResponse(response));
}

export function apiGetScoped(_normalPath: string, scopedPath: string) {
  return apiGet(scopedPath);
}

export function apiPostFormData(path: string, formData: FormData) {
  return buildHeaders(false)
    .then((headers) =>
      fetch(`${API_BASE_URL}${path}`, {
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

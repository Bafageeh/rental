import { clearAuthSession, getAuthToken } from "./auth";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function buildErrorMessage(json: any, fallback: string) {
  if (json?.message && typeof json.message === "string") {
    if (json?.errors && typeof json.errors === "object") {
      const firstError = Object.values(json.errors).flat()[0];

      if (typeof firstError === "string") {
        return `${json.message}: ${firstError}`;
      }
    }

    return json.message;
  }

  return fallback;
}

async function buildHeaders(hasJsonBody = false) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (hasJsonBody) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const token = await getAuthToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      // احتياط مهم لبعض خوادم cPanel/Apache التي لا تمرر Authorization إلى Laravel.
      headers["X-Api-Token"] = token;
    }
  } catch {
    // لا نوقف التطبيق إذا فشل التخزين المحلي أو الدائم.
  }

  return headers;
}

async function parseResponse(response: Response) {
  const text = await response.text();

  let json: any = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = { message: text };
  }

  if (!response.ok) {
    // إذا انتهت الجلسة أو لم يصل التوكن للخادم، امسح الجلسة محليًا
    // حتى يعيد التطبيق المستخدم مباشرة إلى شاشة تسجيل الدخول.
    if (response.status === 401) {
      await clearAuthSession();
    }

    throw new Error(buildErrorMessage(json, `API Error ${response.status}`));
  }

  return json;
}

export async function apiGet(path: string) {
  if (!API_BASE_URL) {
    throw new Error("رابط API غير موجود");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: await buildHeaders(false),
      signal: controller.signal,
    });

    return await parseResponse(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("انتهت مهلة الاتصال بالخادم");
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiPost(path: string, body: Record<string, unknown> = {}) {
  if (!API_BASE_URL) {
    throw new Error("رابط API غير موجود");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: await buildHeaders(true),
    body: JSON.stringify(body),
  });

  return await parseResponse(response);
}

export async function apiGetScoped(_normalPath: string, scopedPath: string) {
  // مهم أمنيًا: لا نرجع للمسارات العامة عند فشل /my، لأن ذلك قد يعرض بيانات غير مفلترة.
  return await apiGet(scopedPath);
}

export async function apiPostFormData(path: string, formData: FormData) {
  if (!API_BASE_URL) {
    throw new Error("رابط API غير موجود");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  try {
    const token = await getAuthToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      // احتياط مهم لبعض خوادم cPanel/Apache التي لا تمرر Authorization إلى Laravel.
      headers["X-Api-Token"] = token;
    }
  } catch {
    // لا نوقف التطبيق إذا فشل التخزين المحلي أو الدائم.
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  return await parseResponse(response);
}

export async function apiPostAny(paths: string[], body: Record<string, unknown> = {}) {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await apiPost(path, body);
    } catch (error) {
      lastError = error;
      // Only continue trying alternate paths on 404 (route not found).
      // Validation errors, auth errors, server errors → fail fast.
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      const is404 = msg.includes("404") || msg.includes("not found");
      if (!is404) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("تعذر تنفيذ العملية");
}

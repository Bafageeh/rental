import { router } from "expo-router";

type Params = Record<string, unknown>;

const MAX_HISTORY_ITEMS = 60;
const AUTH_ROUTES = new Set(["/login"]);

let routeHistory: string[] = [];

function isMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(isMeaningfulValue);
  return true;
}

function stringifyValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(isMeaningfulValue).map((item) => String(item));
  }
  return isMeaningfulValue(value) ? [String(value)] : [];
}

function buildRoute(pathname: string, params: Params = {}): string {
  const cleanPath = pathname || "/";
  const queryParts: string[] = [];

  Object.keys(params)
    .sort()
    .forEach((key) => {
      const values = stringifyValue(params[key]);
      values.forEach((value) => {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
    });

  return queryParts.length ? `${cleanPath}?${queryParts.join("&")}` : cleanPath;
}

function compactHistory() {
  if (routeHistory.length <= MAX_HISTORY_ITEMS) return;
  routeHistory = routeHistory.slice(routeHistory.length - MAX_HISTORY_ITEMS);
}

export function resetNavigationHistory(initialRoute?: string) {
  routeHistory = initialRoute ? [initialRoute] : [];
}

export function getNavigationHistorySnapshot() {
  return [...routeHistory];
}

export function trackNavigationRoute(pathname?: string | null, params: Params = {}) {
  if (!pathname) return;
  if (AUTH_ROUTES.has(pathname)) {
    resetNavigationHistory();
    return;
  }

  const route = buildRoute(pathname, params);
  const lastRoute = routeHistory[routeHistory.length - 1];
  if (lastRoute === route) return;

  // إذا وصلنا لمسار كان هو السابق مباشرة فهذا غالبًا رجوع؛ احذف المسار الحالي بدل تكرار السجل.
  const previousRoute = routeHistory[routeHistory.length - 2];
  if (previousRoute === route) {
    routeHistory.pop();
    return;
  }

  routeHistory.push(route);
  compactHistory();
}

export function smartBack(fallbackRoute: string = "/") {
  const currentRoute = routeHistory[routeHistory.length - 1];

  while (routeHistory.length > 0 && routeHistory[routeHistory.length - 1] === currentRoute) {
    routeHistory.pop();
  }

  const previousRoute = routeHistory[routeHistory.length - 1];
  const target = previousRoute || fallbackRoute;

  if (target) {
    router.push(target as never);
    return;
  }

  const canGoBack = typeof (router as any).canGoBack === "function" ? (router as any).canGoBack() : false;
  if (canGoBack) {
    router.back();
  } else {
    router.replace("/" as never);
  }
}

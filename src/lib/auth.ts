type AuthUser = {
  id?: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  owner_id?: number | null;
  owner?: any;
  is_admin?: boolean;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

type AuthSessionListener = () => void;

const STORAGE_KEY = "my_rentals_auth_session_v1";

let memorySession: AuthSession | null = null;
let secureStoreModule: any | null | undefined = undefined;
let asyncStorageModule: any | null | undefined = undefined;
const listeners = new Set<AuthSessionListener>();

async function getSecureStore() {
  if (secureStoreModule !== undefined) {
    return secureStoreModule;
  }

  try {
    secureStoreModule = await import("expo-secure-store");
  } catch {
    secureStoreModule = null;
  }

  return secureStoreModule;
}

async function getAsyncStorage() {
  if (asyncStorageModule !== undefined) {
    return asyncStorageModule;
  }

  try {
    const imported = await import("@react-native-async-storage/async-storage");
    asyncStorageModule = imported?.default ?? imported;
  } catch {
    asyncStorageModule = null;
  }

  return asyncStorageModule;
}

function notifyAuthSessionChanged() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // لا نكسر التطبيق إذا فشل أحد المستمعين.
    }
  });
}

export function subscribeAuthSession(listener: AuthSessionListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function normalizeSession(value: unknown): AuthSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const session = value as Partial<AuthSession>;

  if (typeof session.token !== "string" || session.token.trim() === "") {
    return null;
  }

  return {
    token: session.token,
    user: session.user && typeof session.user === "object" ? session.user : {},
  };
}

async function writePersistentSession(session: AuthSession | null) {
  const serialized = session ? JSON.stringify(session) : null;

  try {
    const SecureStore = await getSecureStore();

    if (SecureStore?.setItemAsync && SecureStore?.deleteItemAsync) {
      if (!serialized) {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
      } else {
        await SecureStore.setItemAsync(STORAGE_KEY, serialized);
      }
    }
  } catch {
    // لا نكسر التطبيق إذا فشل التخزين الآمن.
  }

  try {
    const AsyncStorage = await getAsyncStorage();

    if (AsyncStorage?.setItem && AsyncStorage?.removeItem) {
      if (!serialized) {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, serialized);
      }
    }
  } catch {
    // احتياط فقط؛ الذاكرة الحالية تكفي للجلسة الحالية.
  }
}

async function readPersistentSession(): Promise<AuthSession | null> {
  try {
    const SecureStore = await getSecureStore();

    if (SecureStore?.getItemAsync) {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const parsed = normalizeSession(JSON.parse(raw));
        if (parsed) return parsed;
      }
    }
  } catch {
    // نكمل إلى AsyncStorage كمسار احتياطي.
  }

  try {
    const AsyncStorage = await getAsyncStorage();

    if (AsyncStorage?.getItem) {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = normalizeSession(JSON.parse(raw));
        if (parsed) return parsed;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function saveAuthSession(
  sessionOrToken: AuthSession | string,
  user?: AuthUser
) {
  if (typeof sessionOrToken === "string") {
    memorySession = {
      token: sessionOrToken,
      user: user || {},
    };
  } else {
    memorySession = normalizeSession(sessionOrToken);
  }

  await writePersistentSession(memorySession);
  notifyAuthSessionChanged();
}

export async function getAuthSession(): Promise<AuthSession | null> {
  if (memorySession?.token) {
    return memorySession;
  }

  const stored = await readPersistentSession();

  if (stored?.token) {
    memorySession = stored;
    return stored;
  }

  return null;
}

export async function getAuthToken(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.token || null;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getAuthSession();
  return session?.user || null;
}

export async function clearAuthSession() {
  memorySession = null;
  await writePersistentSession(null);
  notifyAuthSessionChanged();
}

export async function isLoggedIn(): Promise<boolean> {
  const session = await getAuthSession();
  return Boolean(session?.token);
}

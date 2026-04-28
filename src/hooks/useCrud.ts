import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { apiGet, apiGetScoped, apiPost } from '../lib/api';

// ─────────────────────────────────────────────────────────
// useList — paginated list with search, refresh, loadMore
// ─────────────────────────────────────────────────────────

type UseListOptions<T> = {
  endpoint: string;
  scopedEndpoint?: string;
  autoLoad?: boolean;
  perPage?: number;
  transform?: (res: any) => T[];
};

function defaultScopedEndpoint(endpoint: string): string | undefined {
  if (!endpoint || endpoint.startsWith('/my/')) {
    return undefined;
  }

  const protectedPrefixes = [
    '/properties',
    '/units',
    '/tenants',
    '/contracts',
    '/payments',
    '/expenses',
  ];

  for (const prefix of protectedPrefixes) {
    if (endpoint === prefix || endpoint.startsWith(`${prefix}?`) || endpoint.startsWith(`${prefix}/`)) {
      return `/my${endpoint}`;
    }
  }

  return undefined;
}

export function useList<T = any>(options: UseListOptions<T>) {
  const { endpoint, scopedEndpoint, autoLoad = true, perPage = 25, transform } = options;
  const effectiveScopedEndpoint = scopedEndpoint ?? defaultScopedEndpoint(endpoint);

  const [items,      setItems]      = useState<T[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState('');
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(false);
  const [total,      setTotal]      = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Track if component is mounted to avoid state updates after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(
    async (pageNum: number, isRefresh = false, query = searchQuery) => {
      try {
        if (isRefresh) setRefreshing(true);
        else if (pageNum === 1) setLoading(true);
        setError('');

        const params = new URLSearchParams({
          page: String(pageNum),
          per_page: String(perPage),
        });
        if (query) params.set('search', query);
        const sep = endpoint.includes('?') ? '&' : '?';
        const path = `${endpoint}${sep}${params}`;

        const result = effectiveScopedEndpoint
          ? await apiGetScoped(path, `${effectiveScopedEndpoint}${sep}${params}`)
          : await apiGet(path);

        if (!mountedRef.current) return;

        const newItems = transform ? transform(result) : (result.data ?? result);
        const safeItems = Array.isArray(newItems) ? newItems : [];
        const meta = result.meta;

        setItems((prev) => (pageNum === 1 ? safeItems : [...prev, ...safeItems]));
        setHasMore(meta ? meta.current_page < meta.last_page : false);
        setTotal(meta?.total ?? safeItems.length);
        setPage(pageNum);
      } catch (e) {
        if (!mountedRef.current) return;
        setError(e instanceof Error ? e.message : 'تعذر تحميل البيانات');
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [endpoint, effectiveScopedEndpoint, perPage, searchQuery, transform],
  );

  const load     = useCallback(() => fetchData(1, false), [fetchData]);
  const refresh  = useCallback(() => fetchData(1, true),  [fetchData]);
  const loadMore = useCallback(() => {
    if (hasMore && !loading) fetchData(page + 1);
  }, [hasMore, loading, page, fetchData]);
  const search = useCallback(
    (q: string) => {
      setSearchQuery(q);
      fetchData(1, false, q);
    },
    [fetchData],
  );

  useEffect(() => {
    if (autoLoad) load();
    // We intentionally only run this on mount; subsequent loads are user-triggered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    items,
    loading,
    refreshing,
    error,
    page,
    hasMore,
    total,
    load,
    refresh,
    loadMore,
    search,
    searchQuery,
  };
}

// ─────────────────────────────────────────────────────────
// useDetail — fetch single resource
// ─────────────────────────────────────────────────────────

export function useDetail<T = any>(options: { endpoint: string; autoLoad?: boolean }) {
  const { endpoint, autoLoad = true } = options;
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await apiGet(endpoint);
      if (!mountedRef.current) return;
      setData(result.data ?? result);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'تعذر التحميل');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (autoLoad) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  return { data, loading, error, reload: load };
}

// ─────────────────────────────────────────────────────────
// useAction — post/patch/delete with alert feedback
// ─────────────────────────────────────────────────────────

export function useAction(options: {
  endpoint: string;
  successMessage?: string;
  onSuccess?: (r: any) => void;
}) {
  const { endpoint, successMessage, onSuccess } = options;
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const execute = useCallback(
    async (body: Record<string, unknown> = {}) => {
      try {
        setSubmitting(true);
        setError('');
        const result = await apiPost(endpoint, body);
        if (successMessage) Alert.alert('تم', result.message || successMessage);
        onSuccess?.(result);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'تعذرت العملية';
        setError(msg);
        Alert.alert('خطأ', msg);
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [endpoint, successMessage, onSuccess],
  );

  return { execute, submitting, error };
}

import { useState, useEffect, useRef } from 'react';
import { REGISTRY_URL, REGISTRY_TOTAL } from '@/lib/vfRegistryVerification';

// Single shared cache — all components loading the registry share one fetch.
let _cache = null;
let _promise = null;

async function fetchRegistry() {
  if (_cache) return _cache;
  if (_promise) return _promise;

  _promise = (async () => {
    const resp = await fetch(REGISTRY_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.text();
    const buf = new TextEncoder().encode(raw);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const sha256 = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const data = JSON.parse(raw);
    _cache = {
      records: data.records || [],
      count: data.count || data.records?.length || 0,
      source: data.source || null,
      sha256,
      url: REGISTRY_URL,
    };
    return _cache;
  })();

  try {
    return await _promise;
  } catch (e) {
    _promise = null;
    throw e;
  }
}

/**
 * Loads the authoritative Vinculum Finalis Approved Asset Registry (1,001 records)
 * from the hosted governing JSON. Returns { records, count, source, sha256, url,
 * loading, error }.
 */
export function useApprovedAssetRegistry() {
  const [state, setState] = useState({
    records: [],
    count: 0,
    source: null,
    sha256: null,
    url: REGISTRY_URL,
    loading: true,
    error: null,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    fetchRegistry()
      .then((data) => {
        if (!mounted.current) return;
        setState({ ...data, loading: false, error: null });
      })
      .catch((e) => {
        if (!mounted.current) return;
        setState((s) => ({ ...s, loading: false, error: e.message }));
      });
    return () => { mounted.current = false; };
  }, []);

  return state;
}

export { REGISTRY_TOTAL };
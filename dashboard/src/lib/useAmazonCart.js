import { useCallback, useEffect, useRef, useState } from 'react';

export async function amazonApi(body) {
  const response = await fetch('/api/amazon-cart', body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Amazon session request failed.');
  return result;
}

export function useAmazonCart() {
  const [tabs, setTabs] = useState([]);
  const [session, setSession] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState('connecting');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(-1);
  const apply = useCallback(data => {
    if (data.version != null && data.version < version.current) return;
    version.current = data.version ?? version.current;
    setSession(data.session || null);
  }, []);
  useEffect(() => {
    let mounted = true;
    let polling = false;
    let pollTimer = null;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch('/api/amazon-cart', { signal: controller.signal });
        if (!response.ok) throw new Error('Session snapshot unavailable.');
        const data = await response.json();
        if (mounted) { setTabs(data.tabs); apply(data); setConnected(true); }
      } catch {
        if (mounted) setConnected(false);
      } finally {
        if (mounted && polling) pollTimer = setTimeout(refresh, 2000);
      }
    };
    amazonApi().then(data => { if (mounted) { setTabs(data.tabs); apply(data); } })
      .catch(e => { if (mounted) setError(e.message); }).finally(() => { if (mounted) setLoading(false); });
    const stream = new EventSource('/api/amazon-cart/events');
    stream.addEventListener('snapshot', event => {
      if (!mounted) return;
      try { apply(JSON.parse(event.data)); setConnected(true); } catch { setError('Could not read the session update.'); }
    });
    stream.onopen = () => { if (mounted) { setConnected(true); setConnectionMode('stream'); } };
    stream.onerror = () => {
      if (!mounted || polling) return;
      // Some local servers/proxies close large SSE snapshots. A read-only JSON
      // poll restores live controls without restarting or replaying the session.
      stream.close();
      polling = true;
      setConnectionMode('polling');
      void refresh();
    };
    return () => { mounted = false; stream.close(); clearTimeout(pollTimer); controller.abort(); };
  }, [apply]);
  async function action(body) {
    setBusy(true); setError('');
    try { const result = await amazonApi(body); apply(result); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }
  const reply = value => action({ op: 'reply', sessionId: session?.id, promptId: session?.prompt?.id, value });
  const control = op => action({ op, sessionId: session?.id });
  return { tabs, session, connected, connectionMode, loading, busy, error, setError, action, reply, control };
}

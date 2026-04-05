import { useState, useEffect } from 'react';

export interface ClaudeSessionStats {
  sessionsToday: number;
  sessionsTotal: number;
  messagesTotal: number;
  last7Days: number[];
}

export interface SessionData {
  today: number;
  total: number;
  streak: number;
  last7Days: number[];
  claude?: ClaudeSessionStats;
  buddy?: ClaudeSessionStats;
}

// ── Module-level singleton cache ───────────────────────────────────────────────
// Same pattern as useBuddy: data persists between remounts so Stats renders
// instantly when revisited instead of waiting for a new network round-trip.

let _cache: SessionData | null = null;
let _loading = true;
let _intervalId: ReturnType<typeof setInterval> | null = null;
const _listeners = new Set<() => void>();

async function _doFetch() {
  try {
    const res = await fetch('/api/sessions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _cache = (await res.json()) as SessionData;
  } catch {
    // keep previous cache on error
  } finally {
    _loading = false;
    _listeners.forEach(fn => fn());
  }
}

function _ensurePolling() {
  if (_intervalId !== null) return;
  void _doFetch();
  _intervalId = setInterval(() => { void _doFetch(); }, 10_000);
}

export function useSessions() {
  const [data, setData] = useState<SessionData | null>(_cache);
  const [loading, setLoading] = useState(_loading);

  useEffect(() => {
    const update = () => {
      setData(_cache);
      setLoading(_loading);
    };
    _listeners.add(update);
    _ensurePolling();
    update();
    return () => { _listeners.delete(update); };
  }, []);

  return { data, loading };
}

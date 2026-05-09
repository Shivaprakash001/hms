import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { setStoredStep } from './useOnboardingState';

/**
 * useActivation
 *
 * The canonical frontend hook for owner operational state.
 * Derives activation from the SERVER (real DB data), not localStorage.
 *
 * Returns:
 *   activation     — full ActivationResult from server
 *   loading        — initial load state
 *   error          — fetch error if any
 *   isNewOwner     — true if activation_score < 40 (no meaningful setup)
 *   isFullySetup   — true if operational_state === "FULLY_OPERATIONAL"
 *   nextAction     — the highest-priority recommendation
 *   refresh()      — force re-derive (call after any significant owner action)
 *   persistStep()  — persist a step server-side (cross-device sync)
 */

const CACHE_MS = 30 * 1000; // 30s client cache — avoids redundant fetches on navigation

let _cache = null;

export function useActivation() {
  const [activation, setActivation] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchActivation = useCallback(async (force = false) => {
    // Short-circuit if cache is fresh and not forced
    if (!force && _cache && Date.now() - _cache.ts < CACHE_MS) {
      if (isMounted.current) {
        setActivation(_cache.data);
        setLoading(false);
      }
      return _cache.data;
    }

    try {
      if (isMounted.current) setLoading(true);
      const { data } = await api.get('/owner/me/activation');

      // Sync localStorage step with server state (keeps them in sync)
      if (data?.operational_state === 'FULLY_OPERATIONAL') {
        setStoredStep('COMPLETED');
      }

      _cache = { data, ts: Date.now() };
      if (isMounted.current) {
        setActivation(data);
        setError(null);
      }
      return data;
    } catch (err) {
      if (isMounted.current) {
        setError(err?.response?.data?.detail || 'Failed to load activation state');
      }
      return null;
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  // Persist a step server-side (cross-device sync)
  const persistStep = useCallback(async (step, options = {}) => {
    try {
      await api.patch('/owner/me/activation', { step, ...options });
      _cache = null; // invalidate cache so next fetch re-derives
    } catch (err) {
      // Non-critical — localStorage already has the step
      console.warn('[useActivation] Failed to persist step server-side:', err?.message);
    }
  }, []);

  // Force a fresh re-derive (call after significant actions)
  const refresh = useCallback(() => {
    _cache = null;
    return fetchActivation(true);
  }, [fetchActivation]);

  useEffect(() => {
    fetchActivation();
  }, [fetchActivation]);

  const score       = activation?.activation_score ?? 0;
  const state       = activation?.operational_state ?? 'NEW';
  const isNewOwner  = score < 40;
  const isFullySetup = state === 'FULLY_OPERATIONAL';
  const nextAction  = activation?.next_action ?? null;
  const readiness   = activation?.readiness ?? null;

  return {
    activation,
    loading,
    error,
    score,
    operational_state: state,
    isNewOwner,
    isFullySetup,
    nextAction,
    readiness,
    completedSteps: activation?.completed_steps ?? [],
    missingSteps:   activation?.missing_steps ?? [],
    recommendations: activation?.recommendations ?? [],
    raw:            activation?.raw ?? {},
    refresh,
    persistStep,
  };
}

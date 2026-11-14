'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityDto, DayFlagsDto, LogDto, LogsResponse, PrayerStatus } from './worship-types';
import { api } from './api';

export type LogValue = { prayerStatus: PrayerStatus } | { done: boolean } | { amount: number };

export interface WorshipState {
  loading: boolean;
  error: boolean;
  today: string | null;
  backfillDays: number;
  activities: ActivityDto[];
  /** key: `${date}|${activityId}` */
  logs: Map<string, LogDto>;
  flags: Map<string, DayFlagsDto>;
}

export const logKey = (date: string, activityId: string) => `${date}|${activityId}`;

/**
 * Worship data for a date range, with optimistic writes: the UI updates
 * instantly and the API call happens in the background. Writes are idempotent
 * (natural key + client id + last-write-wins), so retries are always safe.
 */
export function useWorship(from: string | null, to: string | null) {
  const [state, setState] = useState<WorshipState>({
    loading: true,
    error: false,
    today: null,
    backfillDays: 7,
    activities: [],
    logs: new Map(),
    flags: new Map(),
  });
  const [saveError, setSaveError] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async () => {
    try {
      const activities = await api<ActivityDto[]>('/worship/activities');
      // Without an explicit range, ask for one day just to learn "today" from the server.
      const range = from && to ? `from=${from}&to=${to}` : 'from=2000-01-01&to=2000-01-01';
      let res = await api<LogsResponse>(`/worship/logs?${range}`);
      if (!from || !to) {
        const start = shift(res.today, -res.backfillDays);
        res = await api<LogsResponse>(`/worship/logs?from=${start}&to=${res.today}`);
      }
      setState({
        loading: false,
        error: false,
        today: res.today,
        backfillDays: res.backfillDays,
        activities,
        logs: new Map(res.logs.map((l) => [logKey(l.localDate, l.activityId), l])),
        flags: new Map(res.flags.map(({ localDate, ...f }) => [localDate, f])),
      });
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const setLog = useCallback(async (date: string, activityId: string, value: LogValue | null) => {
    const key = logKey(date, activityId);
    const previous = stateRef.current.logs.get(key);
    const clientUpdatedAt = new Date().toISOString();
    const next: LogDto | undefined = value
      ? {
          id: previous?.id ?? crypto.randomUUID(),
          activityId,
          localDate: date,
          prayerStatus: 'prayerStatus' in value ? value.prayerStatus : null,
          done: 'done' in value ? value.done : null,
          amount: 'amount' in value ? value.amount : null,
          clientUpdatedAt,
        }
      : undefined;
    setState((s) => {
      const logs = new Map(s.logs);
      if (next) logs.set(key, next);
      else logs.delete(key);
      return { ...s, logs };
    });
    try {
      if (next) {
        await api(`/worship/logs/${date}/${activityId}`, {
          method: 'PUT',
          body: { id: next.id, ...value, clientUpdatedAt },
        });
      } else {
        await api(`/worship/logs/${date}/${activityId}`, { method: 'DELETE' });
      }
      setSaveError(false);
    } catch {
      setSaveError(true);
      setState((s) => {
        const logs = new Map(s.logs);
        if (previous) logs.set(key, previous);
        else logs.delete(key);
        return { ...s, logs };
      });
    }
  }, []);

  const setFlags = useCallback(async (date: string, flags: DayFlagsDto) => {
    const previous = stateRef.current.flags.get(date);
    setState((s) => ({ ...s, flags: new Map(s.flags).set(date, flags) }));
    try {
      await api(`/worship/day-flags/${date}`, { method: 'PUT', body: flags });
      setSaveError(false);
    } catch {
      setSaveError(true);
      setState((s) => {
        const map = new Map(s.flags);
        if (previous) map.set(date, previous);
        else map.delete(date);
        return { ...s, flags: map };
      });
    }
  }, []);

  const setActivities = useCallback(
    (fn: (a: ActivityDto[]) => ActivityDto[]) =>
      setState((s) => ({ ...s, activities: fn(s.activities) })),
    [],
  );

  return { ...state, saveError, setLog, setFlags, setActivities, reload: load };
}

/** Shift a YYYY-MM-DD date by n days (UTC arithmetic, no timezone involved). */
export function shift(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Auxiliary windows (widget, panel, pill, toast) render from the schedule the main window sent to Rust.
 * They never compute times themselves and have no database access (least privilege).
 */
import { create } from 'zustand';
import { api, EV, listen } from '@/lib/bridge';
import type { SchedulePayload, ScheduleDay, ScheduleTimelineEvent } from './schedule';
import type { TimelineEvent } from './types';

interface ScheduleState {
  payload: SchedulePayload | null;
  events: TimelineEvent[];
}

export const useSchedule = create<ScheduleState>(() => ({ payload: null, events: [] }));

function toEvents(p: SchedulePayload | null): TimelineEvent[] {
  return (p?.timeline ?? []).map((e: ScheduleTimelineEvent) => ({ id: e.id, at: e.at, isFriday: e.friday, date: e.date }));
}

export async function startScheduleStore() {
  const set = (p: SchedulePayload | null) => useSchedule.setState({ payload: p, events: toEvents(p) });
  void listen<SchedulePayload>(EV.schedule, set);
  for (let i = 0; i < 20; i++) {
    const p = await api.getSchedule().catch(() => null);
    if (p) {
      set(p);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

export function dayFor(p: SchedulePayload | null, now: number): ScheduleDay | null {
  return p?.days.find((d) => now >= d.start && now < d.end) ?? null;
}

export function eventsOfDay(p: SchedulePayload | null, date: string): ScheduleTimelineEvent[] {
  return (p?.timeline ?? []).filter((e) => e.date === date);
}

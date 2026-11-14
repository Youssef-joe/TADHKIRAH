import { Inject, Injectable } from '@nestjs/common';
import type { OnboardingRequest, PrayerSettings, PrayerTimesResponse } from '@tadhkirah/contracts';
import { CalculationMethodSchema, OnboardingRequestSchema } from '@tadhkirah/contracts';
import { eq, schema, withUser, type DbHandle, type Tx } from '@tadhkirah/db';
import {
  addDays,
  computePrayerTimes,
  computeWindows,
  parseLocalDate,
  roundCoordinate,
  toHijri,
  toPrayerLocation,
  trackingDate,
  type CalculationMethodKey,
  type LocalDate,
} from '@tadhkirah/domain';
import type { z } from 'zod';
import { AppError } from '../common/http.js';
import { DB } from '../db/db.module.js';

const { prayerTimeSettings, userProfiles, userPreferences } = schema;

// Compile-time check: the contracts' method list must match the domain's.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _methodsMatch: Equals<z.infer<typeof CalculationMethodSchema>, CalculationMethodKey> = true;
void _methodsMatch;

const MAX_RANGE_DAYS = 31;

@Injectable()
export class PrayerService {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  async getSettings(tx: Tx, userId: string): Promise<PrayerSettings | null> {
    const [row] = await tx
      .select()
      .from(prayerTimeSettings)
      .where(eq(prayerTimeSettings.userId, userId));
    if (!row) return null;
    return {
      latitude: row.latitude,
      longitude: row.longitude,
      locationLabel: row.locationLabel,
      countryCode: row.countryCode,
      method: row.method as PrayerSettings['method'],
      asrMethod: row.asrMethod,
      highLatRule: row.highLatRule,
      adjustments: row.adjustments,
      jumuahKhutbahTime: row.jumuahKhutbahTime?.slice(0, 5) ?? null,
    };
  }

  /**
   * The user's current tracking day (ADR-001): from Fajr at their location, or
   * the 04:00 fallback while no location is set. Call it inside withUser().
   */
  async trackingToday(tx: Tx, userId: string, now = new Date()): Promise<LocalDate> {
    const [profile] = await tx
      .select({ timezone: userProfiles.timezone })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    const timeZone = profile?.timezone ?? 'Asia/Riyadh';
    const settings = await this.getSettings(tx, userId);
    return settings
      ? trackingDate(now, { kind: 'located', ...toPrayerLocation(settings, timeZone) })
      : trackingDate(now, { kind: 'unlocated', timeZone });
  }

  private async upsert(tx: Tx, userId: string, s: PrayerSettings): Promise<void> {
    const values = {
      ...s,
      // Privacy: store ~1 km precision only, whatever the client sends.
      latitude: roundCoordinate(s.latitude),
      longitude: roundCoordinate(s.longitude),
    };
    await tx
      .insert(prayerTimeSettings)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: prayerTimeSettings.userId, set: values });
  }

  async updateSettings(userId: string, s: PrayerSettings): Promise<PrayerSettings> {
    return withUser(this.handle.db, userId, async (tx) => {
      await this.upsert(tx, userId, s);
      return (await this.getSettings(tx, userId))!;
    });
  }

  /** Saves location, method and time zone in one go, and marks onboarding complete. */
  async completeOnboarding(
    userId: string,
    req: z.output<typeof OnboardingRequestSchema>,
  ): Promise<void> {
    await withUser(this.handle.db, userId, async (tx) => {
      await this.upsert(tx, userId, req.prayerSettings);
      await tx.insert(userProfiles).values({ userId }).onConflictDoNothing();
      await tx.insert(userPreferences).values({ userId }).onConflictDoNothing();
      await tx
        .update(userProfiles)
        .set({
          timezone: req.timezone,
          onboardedAt: new Date(),
          ...(req.locale ? { locale: req.locale } : {}),
        })
        .where(eq(userProfiles.userId, userId));
    });
  }

  /** Prayer times for a date range, computed from the user's own settings. */
  async prayerTimes(userId: string, from?: string, to?: string): Promise<PrayerTimesResponse> {
    const { settings, timeZone } = await withUser(this.handle.db, userId, async (tx) => {
      const [profile] = await tx
        .select({ timezone: userProfiles.timezone })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));
      return { settings: await this.getSettings(tx, userId), timeZone: profile?.timezone };
    });
    if (!settings || !timeZone) {
      throw new AppError(409, 'prayer.settings_missing', 'Set your location first.');
    }

    const loc = toPrayerLocation(settings, timeZone);
    const today = trackingDate(new Date(), { kind: 'located', ...loc });
    const start = (from ?? today) as LocalDate;
    const end = (to ?? start) as LocalDate;
    const span = daysBetween(start, end);
    if (span < 0 || span >= MAX_RANGE_DAYS) {
      throw new AppError(400, 'validation.failed', `Range must be 1–${MAX_RANGE_DAYS} days.`);
    }

    const days = [];
    for (let i = 0; i <= span; i++) {
      const date = addDays(start, i);
      const times = computePrayerTimes(date, loc);
      const windows = computeWindows(date, loc, times);
      const iso = (d: Date) => d.toISOString();
      days.push({
        date,
        hijri: toHijri(date),
        times: Object.fromEntries(Object.entries(times).map(([k, v]) => [k, iso(v)])) as Record<
          keyof typeof times,
          string
        >,
        windows: {
          lastThirdOfNight: {
            start: iso(windows.lastThirdOfNight.start),
            end: iso(windows.lastThirdOfNight.end),
          },
          afterAsrUntilMaghrib: {
            start: iso(windows.afterAsrUntilMaghrib.start),
            end: iso(windows.afterAsrUntilMaghrib.end),
          },
          ...(windows.jumuah
            ? { jumuah: { start: iso(windows.jumuah.start), end: iso(windows.jumuah.end) } }
            : {}),
        },
      });
    }
    return { timeZone, today, days };
  }
}

function daysBetween(a: LocalDate, b: LocalDate): number {
  const pa = parseLocalDate(a);
  const pb = parseLocalDate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) /
      86_400_000,
  );
}

export type { OnboardingRequest };

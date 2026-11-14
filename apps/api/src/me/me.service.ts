import { Inject, Injectable } from '@nestjs/common';
import type {
  MeResponse,
  Preferences,
  Profile,
  UpdatePreferencesRequest,
  UpdateProfileRequest,
} from '@tadhkirah/contracts';
import { eq, schema, withUser, type DbHandle, type Tx } from '@tadhkirah/db';
import { AppError } from '../common/http.js';
import { DB } from '../db/db.module.js';
import { PrayerService } from '../prayer/prayer.service.js';
import { PlannerService } from '../reminders/planner.service.js';

const { users, userProfiles, userPreferences } = schema;

@Injectable()
export class MeService {
  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    private readonly prayer: PrayerService,
    private readonly planner: PlannerService,
  ) {}

  async get(userId: string): Promise<MeResponse> {
    const [user] = await this.handle.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw new AppError(404, 'not_found');

    return withUser(this.handle.db, userId, async (tx) => {
      const profile = await this.profile(tx, userId);
      const [row] = await tx
        .select({ onboardedAt: userProfiles.onboardedAt })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));
      return {
        ...user,
        profile,
        preferences: await this.preferences(tx, userId),
        prayerSettings: await this.prayer.getSettings(tx, userId),
        onboarded: Boolean(row?.onboardedAt),
      };
    });
  }

  async updateProfile(userId: string, patch: UpdateProfileRequest): Promise<Profile> {
    // Reminders are planned in local time: a new time zone (e.g. travel) means re-planning (AC-TZ).
    if (patch.timezone || patch.locale) await this.planner.invalidate(userId);
    return withUser(this.handle.db, userId, async (tx) => {
      await this.profile(tx, userId); // make sure the row exists
      if (Object.keys(patch).length) {
        await tx.update(userProfiles).set(patch).where(eq(userProfiles.userId, userId));
      }
      return this.profile(tx, userId);
    });
  }

  async updatePreferences(userId: string, patch: UpdatePreferencesRequest): Promise<Preferences> {
    if (patch.weekStart !== undefined) await this.planner.invalidate(userId);
    return withUser(this.handle.db, userId, async (tx) => {
      await this.preferences(tx, userId);
      if (Object.keys(patch).length) {
        await tx.update(userPreferences).set(patch).where(eq(userPreferences.userId, userId));
      }
      return this.preferences(tx, userId);
    });
  }

  /** Reads the profile, creating it with defaults if it's missing (self-healing). */
  private async profile(tx: Tx, userId: string): Promise<Profile> {
    await tx.insert(userProfiles).values({ userId }).onConflictDoNothing();
    const [p] = await tx.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return {
      displayName: p!.displayName,
      locale: p!.locale,
      digits: p!.digits,
      timezone: p!.timezone,
    };
  }

  private async preferences(tx: Tx, userId: string): Promise<Preferences> {
    await tx.insert(userPreferences).values({ userId }).onConflictDoNothing();
    const [p] = await tx.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return {
      weekStart: p!.weekStart,
      hijriOffset: p!.hijriOffset,
      backfillDays: p!.backfillDays,
      theme: p!.theme,
    };
  }
}

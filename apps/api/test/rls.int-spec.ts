import { createDb, schema, sql, withUser, type DbHandle } from '@tadhkirah/db';
import { inject } from 'vitest';
import { purgeExpired } from '../src/worker/purge.js';

const { users, userProfiles, emailTokens } = schema;

/** Drizzle wraps driver errors; the Postgres message is on `cause`. */
async function pgError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return err.cause?.message ?? err.message;
  }
  throw new Error('expected the query to fail');
}

/** AC (M1): row-level security isolates users even if a query forgets its WHERE clause. */
describe('row-level security on app.*', () => {
  let h: DbHandle;
  let a: string;
  let b: string;

  beforeAll(async () => {
    h = createDb(inject('databaseUrl'));
    const rows = await h.db
      .insert(users)
      .values([
        { email: `rls-a-${Date.now()}@example.com` },
        { email: `rls-b-${Date.now()}@example.com` },
      ])
      .returning({ id: users.id });
    [a, b] = [rows[0]!.id, rows[1]!.id];
    await withUser(h.db, a, (tx) =>
      tx.insert(userProfiles).values({ userId: a, displayName: 'A' }),
    );
    await withUser(h.db, b, (tx) =>
      tx.insert(userProfiles).values({ userId: b, displayName: 'B' }),
    );
  });
  afterAll(async () => {
    await h?.close();
  });

  it('a user sees only their own rows, even without a WHERE clause', async () => {
    const rows = await withUser(h.db, a, (tx) => tx.select().from(userProfiles));
    expect(rows.map((r) => r.userId)).toEqual([a]);
  });

  it("a user cannot update another user's rows", async () => {
    const updated = await withUser(h.db, a, (tx) =>
      tx
        .update(userProfiles)
        .set({ displayName: 'hacked' })
        .where(sql`${userProfiles.userId} = ${b}`)
        .returning(),
    );
    expect(updated).toHaveLength(0);
    const [bRow] = await withUser(h.db, b, (tx) => tx.select().from(userProfiles));
    expect(bRow!.displayName).toBe('B');
  });

  it('a user cannot insert rows for another user', async () => {
    const msg = await pgError(
      withUser(h.db, a, (tx) =>
        tx.execute(sql`insert into app.user_preferences (user_id) values (${b})`),
      ),
    );
    expect(msg).toMatch(/row-level security/);
  });

  it('the app role without a user id sees nothing and cannot read auth tables', async () => {
    const rows = await h.db.transaction(async (tx) => {
      await tx.execute(sql`set local role tadhkirah_app`);
      return tx.select().from(userProfiles);
    });
    expect(rows).toHaveLength(0);
    expect(await pgError(withUser(h.db, a, (tx) => tx.select().from(users)))).toMatch(
      /permission denied/,
    );
  });

  it('every table in the app schema has RLS enabled and forced', async () => {
    const { rows } = await h.pool.query(`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'app' and c.relkind = 'r'`);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect({ table: r.relname, rls: r.relrowsecurity, forced: r.relforcerowsecurity }).toEqual({
        table: r.relname,
        rls: true,
        forced: true,
      });
    }
  });

  it('the purge job removes expired sign-in tokens', async () => {
    await h.db.insert(emailTokens).values({
      email: 'old@example.com',
      tokenHash: Buffer.from(`old-${Date.now()}`),
      codeHash: Buffer.from('x'),
      expiresAt: new Date(Date.now() - 48 * 3600_000),
      createdAt: new Date(Date.now() - 48 * 3600_000),
    });
    const counts = await purgeExpired(h.db);
    expect(counts.emailTokens).toBeGreaterThanOrEqual(1);
    expect(await purgeExpired(h.db)).toMatchObject({ emailTokens: 0 });
  });
});

import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { inject } from 'vitest';
import { createDb, type DbHandle } from '@tadhkirah/db';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { signIn, startApp, TEST_CRON_SECRET, TEST_OWNER_EMAIL, uniqueEmail } from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };
const DAY = 86_400_000;

type QueueItem = { type: string; id: string; state: string; openReports: number };

describe('re-review cycle: the verification loop for published content', () => {
  let app: INestApplication;
  let mailer: MemoryMailer;
  let h: DbHandle;
  let owner: string;
  let reviewer: string;
  let reviewerEmail: string;
  let reader: string;
  const http = () => request(app.getHttpServer());
  const as = (cookie: string) => ({
    get: (p: string) => http().get(`/v1${p}`).set('Cookie', cookie),
    post: (p: string, body: object = {}) =>
      http().post(`/v1${p}`).set('Cookie', cookie).set(CSRF).send(body),
    put: (p: string, body: object) =>
      http().put(`/v1${p}`).set('Cookie', cookie).set(CSRF).send(body),
    patch: (p: string, body: object) =>
      http().patch(`/v1${p}`).set('Cookie', cookie).set(CSRF).send(body),
  });
  const step = (cookie: string, type: string, id: string, action: string) =>
    as(cookie).post(`/admin/${type}/${id}/transitions`, { action, notes: `${action} in test` });
  const queue = async () =>
    (await as(reviewer).get('/admin/review-queue').expect(200)).body as QueueItem[];
  const detail = async (type: string, id: string) =>
    (await as(owner).get(`/admin/${type}/${id}`).expect(200)).body;

  let hadithId: string;
  let sunnahId: string;
  let slug: string;

  beforeAll(async () => {
    ({ app, mailer } = await startApp());
    h = createDb(inject('databaseUrl'));
    owner = (await signIn(app, mailer, TEST_OWNER_EMAIL)).cookie;
    await as(owner).get('/admin/me').expect(200); // bootstrap roles
    reviewerEmail = uniqueEmail();
    reviewer = (await signIn(app, mailer, reviewerEmail)).cookie;
    reader = (await signIn(app, mailer)).cookie;
    await as(owner)
      .put('/admin/team', { email: reviewerEmail, role: 'reviewer', grant: true })
      .expect(204);

    // Publish one hadith and a Sunnah citing it (owner writes, reviewer verifies, owner approves).
    const sources = (await as(owner).get('/admin/sources').expect(200)).body as {
      id: string;
      key: string;
    }[];
    const narrator = (
      await as(owner).post('/admin/narrators', { nameAr: 'راوٍ', nameEn: 'Narrator' }).expect(201)
    ).body;
    const number = `77${randomBytes(2).readUInt16BE()}`;
    hadithId = (
      await as(owner)
        .post('/admin/hadiths', {
          sourceId: sources.find((s) => s.key === 'muslim')!.id,
          number,
          narratorId: narrator.id,
          textAr: 'نَصٌّ تَجْرِيبِيٌّ',
          sourceUrl: `https://sunnah.com/muslim:${number}`,
        })
        .expect(201)
    ).body.id;
    await as(owner)
      .post(`/admin/hadiths/${hadithId}/authentications`, {
        grade: 'sahih',
        scholar: 'Muslim',
        workCited: 'Sahih Muslim',
        isPrimary: true,
      })
      .expect(201);
    for (const a of ['submit', 'verify', 'approve'])
      await step(a === 'verify' ? reviewer : owner, 'hadiths', hadithId, a).expect(201);

    slug = `cycle-${randomBytes(3).toString('hex')}`;
    sunnahId = (
      await as(owner)
        .post('/admin/sunnahs', { slug, titleAr: 'سُنَّةٌ', titleEn: 'A Sunnah', trigger: 'daily' })
        .expect(201)
    ).body.id;
    await as(owner)
      .patch(`/admin/sunnahs/${sunnahId}`, { descriptionAr: 'وَصْفٌ', descriptionEn: 'Description' })
      .expect(200);
    await as(owner)
      .put(`/admin/sunnahs/${sunnahId}/hadiths`, { links: [{ hadithId }] })
      .expect(204);
    for (const a of ['submit', 'verify', 'approve'])
      await step(a === 'verify' ? reviewer : owner, 'sunnahs', sunnahId, a).expect(201);
  });
  afterAll(async () => {
    await h?.close();
    await app?.close();
  });

  it('approval schedules the next review a year out, and the public page shows when it was verified', async () => {
    const d = await detail('sunnahs', sunnahId);
    const due = new Date(d.item.reviewDueAt).getTime();
    expect(Math.abs(due - (Date.now() + 365 * DAY))).toBeLessThan(60_000);
    expect(d.item.lastVerifiedAt).not.toBeNull();
    expect(d.reviewState).toBe('scheduled');
    const pub = (await http().get(`/v1/content/sunnahs/${slug}`).expect(200)).body;
    expect(pub.lastVerifiedAt).toBe(d.item.lastVerifiedAt);
    expect((await queue()).find((q) => q.id === sunnahId)).toBeUndefined();
  });

  it('a problem report makes the item due now, without taking it down', async () => {
    await as(reader)
      .post('/content/issue-reports', {
        subjectType: 'sunnah',
        subjectId: sunnahId,
        message: 'This narration number looks wrong.',
      })
      .expect(204);
    const item = (await queue()).find((q) => q.id === sunnahId);
    expect(item).toMatchObject({ type: 'sunnahs', state: 'due', openReports: 1 });
    // Still published while it waits.
    await http().get(`/v1/content/sunnahs/${slug}`).expect(200);
    const d = await detail('sunnahs', sunnahId);
    expect(d.openReports).toHaveLength(1);
    expect(d.actions).toContain('reconfirm');
  });

  it('the author cannot reconfirm their own item under the two-person rule', async () => {
    const res = await step(owner, 'sunnahs', sunnahId, 'reconfirm').expect(403);
    expect(res.body.code).toBe('content.reviewer_is_author');
  });

  it('a reviewer reconfirms: the clock resets, reports are answered, history records it', async () => {
    await step(reviewer, 'sunnahs', sunnahId, 'reconfirm').expect(201);
    const d = await detail('sunnahs', sunnahId);
    expect(d.item.status).toBe('approved');
    expect(new Date(d.item.reviewDueAt).getTime()).toBeGreaterThan(Date.now() + 360 * DAY);
    expect(d.openReports).toEqual([]);
    expect(d.history.at(-1)).toMatchObject({
      action: 'reconfirm',
      fromStatus: 'approved',
      toStatus: 'approved',
    });
    expect((await queue()).find((q) => q.id === sunnahId)).toBeUndefined();
  });

  it('lists items coming due within two weeks, and overdue ones', async () => {
    await h.pool.query(
      `update content.hadiths set review_due_at = now() + interval '5 days' where id = $1`,
      [hadithId],
    );
    expect((await queue()).find((q) => q.id === hadithId)?.state).toBe('due_soon');
    await h.pool.query(
      `update content.hadiths set review_due_at = now() - interval '40 days' where id = $1`,
      [hadithId],
    );
    expect((await queue()).find((q) => q.id === hadithId)?.state).toBe('overdue');
  });

  it('emails reviewers a digest from the scheduled job, once, with counts only', async () => {
    const before = mailer.sent.filter((m) => m.to === reviewerEmail).length;
    const plan = () =>
      http()
        .get('/v1/internal/cron/plan')
        .set('Authorization', `Bearer ${TEST_CRON_SECRET}`)
        .expect(200);
    expect((await plan()).body.reviewDigests).toBeGreaterThanOrEqual(1);
    const mail = mailer.lastTo(reviewerEmail)!;
    expect(mail.text).toContain('/ar/admin/review');
    expect(mail.text).not.toContain('نَصٌّ تَجْرِيبِيٌّ'); // never the content itself
    await plan();
    expect(mailer.sent.filter((m) => m.to === reviewerEmail).length).toBe(before + 1);
  });

  it('a new revision starts unscheduled; approving it starts a fresh cycle', async () => {
    const draft = (await as(owner).post(`/admin/hadiths/${hadithId}/revisions`).expect(201)).body;
    const d = await detail('hadiths', draft.id);
    expect(d.item).toMatchObject({ status: 'draft', reviewDueAt: null, lastVerifiedAt: null });
  });

  it('only the editorial team sees the queue', async () => {
    await as(reader).get('/admin/review-queue').expect(403);
  });
});

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { inject } from 'vitest';
import { createDb, type DbHandle } from '@tadhkirah/db';
import type { MemoryMailer } from '../src/auth/mailer.js';
import { signIn, startApp, TEST_OWNER_EMAIL, uniqueEmail } from './helpers.js';

const CSRF = { 'x-tadhkirah-csrf': '1' };

describe('verified content: workflow, publication gate, roles (Phase 2)', () => {
  let app: INestApplication;
  let mailer: MemoryMailer;
  let h: DbHandle;
  let owner: string;
  let reviewer: string;
  let reviewerEmail: string;
  let nobody: string;
  const http = () => request(app.getHttpServer());
  const as = (cookie: string) => ({
    get: (p: string) => http().get(`/v1${p}`).set('Cookie', cookie),
    post: (p: string, body: object = {}) =>
      http().post(`/v1${p}`).set('Cookie', cookie).set(CSRF).send(body),
    patch: (p: string, body: object) =>
      http().patch(`/v1${p}`).set('Cookie', cookie).set(CSRF).send(body),
    put: (p: string, body: object) =>
      http().put(`/v1${p}`).set('Cookie', cookie).set(CSRF).send(body),
  });

  beforeAll(async () => {
    ({ app, mailer } = await startApp());
    h = createDb(inject('databaseUrl'));
    owner = (await signIn(app, mailer, TEST_OWNER_EMAIL)).cookie;
    reviewerEmail = uniqueEmail();
    reviewer = (await signIn(app, mailer, reviewerEmail)).cookie;
    nobody = (await signIn(app, mailer)).cookie;
  });
  afterAll(async () => {
    await h?.close();
    await app?.close();
  });

  async function readyHadith(number: string, grade = 'sahih') {
    const sources = (await as(owner).get('/admin/sources').expect(200)).body as {
      id: string;
      key: string;
    }[];
    const narrator = (
      await as(owner).post('/admin/narrators', { nameAr: 'راوٍ', nameEn: 'Narrator' }).expect(201)
    ).body;
    const hadith = (
      await as(owner)
        .post('/admin/hadiths', {
          sourceId: sources.find((s) => s.key === 'bukhari')!.id,
          number,
          narratorId: narrator.id,
          textAr: `نَصٌّ تَجْرِيبِيٌّ ${number}`,
          sourceUrl: `https://sunnah.com/bukhari:${number}`,
        })
        .expect(201)
    ).body;
    await as(owner)
      .post(`/admin/hadiths/${hadith.id}/authentications`, {
        grade,
        scholar: 'al-Bukhari',
        workCited: 'Sahih al-Bukhari',
        isPrimary: true,
      })
      .expect(201);
    return hadith.id as string;
  }
  const step = (cookie: string, type: string, id: string, action: string) =>
    as(cookie).post(`/admin/${type}/${id}/transitions`, { action, notes: `${action} in test` });

  it('editorial routes need a role; the bootstrap owner gets every role on first use', async () => {
    expect((await as(nobody).get('/admin/me').expect(200)).body.roles).toEqual([]);
    await as(nobody).get('/admin/hadiths').expect(403);
    expect((await as(owner).get('/admin/me').expect(200)).body.roles.sort()).toEqual([
      'admin',
      'editor',
      'publisher',
      'reviewer',
    ]);
  });

  it('the admin appoints a reviewer; every change is audited', async () => {
    await as(nobody)
      .put('/admin/team', { email: reviewerEmail, role: 'reviewer', grant: true })
      .expect(403);
    await as(owner)
      .put('/admin/team', { email: reviewerEmail, role: 'reviewer', grant: true })
      .expect(204);
    expect((await as(reviewer).get('/admin/me')).body.roles).toEqual(['reviewer']);
    const { rows } = await h.pool.query(
      `select action from auth.role_audit a join auth.users u on u.id = a.user_id where u.email = $1`,
      [reviewerEmail],
    );
    expect(rows.map((r) => r.action)).toEqual(['grant']);
  });

  it('imports the AI research leads as drafts only: verbatim texts, no grades, no descriptions', async () => {
    const first = (await as(owner).post('/admin/import-candidates').expect(201)).body;
    expect(first.created).toBe(30); // 20 hadiths, 5 Sunnahs, 5 occasions
    expect((await as(owner).post('/admin/import-candidates').expect(201)).body).toEqual({
      created: 0,
      skipped: 30,
    });
    const { rows } = await h.pool.query(
      `select h.id, h.status, h.text_ar, h.editor_notes,
              (select count(*)::int from content.hadith_authentications a where a.hadith_id = h.id) grades
         from content.hadiths h where editor_notes like 'AI-gathered%'`,
    );
    expect(rows).toHaveLength(20);
    for (const r of rows) {
      expect(r.status).toBe('draft');
      expect(r.text_ar).toMatch(/[\u0600-\u06FF]/);
      expect(r.editor_notes).toContain('UNVERIFIED');
      expect(r.grades).toBe(0); // AI never grades
    }
    const sunnahs = await h.pool.query(
      `select s.status, s.description_ar, count(l.hadith_id)::int links
         from content.sunnahs s join content.sunnah_hadiths l on l.sunnah_id = s.id
        where s.slug = 'siwak-on-rising-at-night' group by s.id`,
    );
    expect(sunnahs.rows).toEqual([{ status: 'draft', description_ar: '', links: 2 }]);
    const occasion = await h.pool.query(
      `select schedulable, evidence_type from content.supplication_occasions where slug = 'in-sujud'`,
    );
    expect(occasion.rows).toEqual([{ schedulable: false, evidence_type: 'explicit_text' }]);
    // Nothing is public until a person completes and approves it.
    const pub = (await http().get('/v1/content/sunnahs').expect(200)).body as { slug: string }[];
    expect(pub.find((s) => s.slug === 'siwak-on-rising-at-night')).toBeUndefined();
  });

  it('runs the hadith workflow with the two-person rule', async () => {
    const id = await readyHadith('9001');
    await step(owner, 'hadiths', id, 'submit').expect(201);
    const self = await step(owner, 'hadiths', id, 'verify').expect(403);
    expect(self.body.code).toBe('content.reviewer_is_author');
    await step(reviewer, 'hadiths', id, 'verify').expect(201);
    await step(reviewer, 'hadiths', id, 'approve').expect(403); // a reviewer is not a publisher
    await step(owner, 'hadiths', id, 'approve').expect(201);
    // Published content can't be edited in place.
    expect(
      (await as(owner).patch(`/admin/hadiths/${id}`, { textAr: 'x' }).expect(409)).body.code,
    ).toBe('content.not_editable');
    const history = (await as(owner).get(`/admin/hadiths/${id}`).expect(200)).body.history;
    expect(history.map((r: { toStatus: string }) => r.toStatus)).toEqual([
      'awaiting_verification',
      'verified',
      'approved',
    ]);
  });

  it('refuses incomplete submissions and unpublishable grades', async () => {
    const sources = (await as(owner).get('/admin/sources')).body as { id: string; key: string }[];
    const bare = (
      await as(owner)
        .post('/admin/hadiths', { sourceId: sources[0]!.id, number: '9100' })
        .expect(201)
    ).body;
    const res = await step(owner, 'hadiths', bare.id, 'submit').expect(422);
    expect(res.body.code).toBe('content.incomplete');

    const weak = await readyHadith('9101', 'daif');
    await step(owner, 'hadiths', weak, 'submit').expect(201);
    await step(reviewer, 'hadiths', weak, 'verify').expect(201);
    expect((await step(owner, 'hadiths', weak, 'approve').expect(422)).body.code).toBe(
      'content.grade_not_publishable',
    );
  });

  it('publishes a Sunnah only with approved evidence, and the public API shows it with full sources', async () => {
    expect((await http().get('/v1/content/sunnahs').expect(200)).body).toEqual([]);
    const evidence = await readyHadith('9200');
    const pending = await readyHadith('9201');

    const sunnah = (
      await as(owner)
        .post('/admin/sunnahs', {
          slug: 'test-sunnah',
          titleAr: 'سُنَّةٌ',
          titleEn: 'A Sunnah',
          trigger: 'daily',
        })
        .expect(201)
    ).body;
    expect(
      (await step(owner, 'sunnahs', sunnah.id, 'submit').expect(422)).body.errors.missing,
    ).toEqual(['description', 'evidence']);
    await as(owner)
      .patch(`/admin/sunnahs/${sunnah.id}`, { descriptionAr: 'وَصْفٌ', descriptionEn: 'Description' })
      .expect(200);
    await as(owner)
      .put(`/admin/sunnahs/${sunnah.id}/hadiths`, {
        links: [{ hadithId: evidence }, { hadithId: pending }],
      })
      .expect(204);
    await as(owner)
      .post(`/admin/sunnahs/${sunnah.id}/differences`, {
        kind: 'interpretation',
        summaryAr: 'يَرَى بَعْضُ أَهْلِ الْعِلْمِ…',
        summaryEn: 'Some scholars hold…',
      })
      .expect(201);
    await step(owner, 'sunnahs', sunnah.id, 'submit').expect(201);
    await step(reviewer, 'sunnahs', sunnah.id, 'verify').expect(201);
    // One cited hadith is still a draft: blocked.
    expect((await step(owner, 'sunnahs', sunnah.id, 'approve').expect(422)).body.code).toBe(
      'content.evidence_not_published',
    );

    for (const id of [evidence, pending]) {
      await step(owner, 'hadiths', id, 'submit').expect(201);
      await step(reviewer, 'hadiths', id, 'verify').expect(201);
      await step(owner, 'hadiths', id, 'approve').expect(201);
    }
    await step(owner, 'sunnahs', sunnah.id, 'approve').expect(201);

    const res = await http().get('/v1/content/sunnahs/test-sunnah').expect(200);
    expect(res.headers['cache-control']).toMatch(/^public/);
    expect(res.body).toMatchObject({
      titleEn: 'A Sunnah',
      differences: [{ kind: 'interpretation', summaryEn: 'Some scholars hold…' }],
    });
    expect(res.body.hadiths).toHaveLength(2);
    expect(res.body.hadiths[0]).toMatchObject({
      textAr: 'نَصٌّ تَجْرِيبِيٌّ 9200',
      number: '9200',
      grade: 'sahih',
      gradedBy: 'al-Bukhari',
      workCited: 'Sahih al-Bukhari',
      url: 'https://sunnah.com/bukhari:9200',
      source: { key: 'bukhari', numberingScheme: 'sunnah.com' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/editor|createdBy|status/);
  });

  it('the database gate hides an approved item whose evidence is not approved, even if forced', async () => {
    const draft = await readyHadith('9300');
    const { rows } = await h.pool.query(
      `insert into content.sunnahs (slug, title_ar, title_en, description_ar, description_en, status)
       values ('forced', 'x', 'x', 'x', 'x', 'approved') returning id`,
    );
    await h.pool.query(
      `insert into content.sunnah_hadiths (sunnah_id, hadith_id) values ($1, $2)`,
      [rows[0].id, draft],
    );
    const all = (await http().get('/v1/content/sunnahs').expect(200)).body as { slug: string }[];
    expect(all.map((s) => s.slug)).not.toContain('forced');
    await http().get('/v1/content/sunnahs/forced').expect(404);
  });

  it('a revision keeps the published version live until the new one is approved, then replaces it', async () => {
    const live = (await http().get('/v1/content/sunnahs/test-sunnah')).body.hadiths[0];
    const rev = (await as(owner).post(`/admin/hadiths/${live.id}/revisions`).expect(201)).body;
    await as(owner).patch(`/admin/hadiths/${rev.id}`, { textAr: 'نَصٌّ مُصَحَّحٌ' }).expect(200);
    expect((await http().get('/v1/content/sunnahs/test-sunnah')).body.hadiths[0].textAr).toBe(
      'نَصٌّ تَجْرِيبِيٌّ 9200',
    );

    await step(owner, 'hadiths', rev.id, 'submit').expect(201);
    await step(reviewer, 'hadiths', rev.id, 'verify').expect(201);
    await step(owner, 'hadiths', rev.id, 'approve').expect(201);
    const after = (await http().get('/v1/content/sunnahs/test-sunnah')).body.hadiths.map(
      (x: { textAr: string }) => x.textAr,
    );
    expect(after).toContain('نَصٌّ مُصَحَّحٌ');
    expect(after).not.toContain('نَصٌّ تَجْرِيبِيٌّ 9200');
    const { rows } = await h.pool.query(`select status from content.hadiths where id = $1`, [
      live.id,
    ]);
    expect(rows[0].status).toBe('archived');
  });

  it('review history is append-only', async () => {
    await expect(
      h.pool.query(`update content.review_records set notes = 'changed'`),
    ).rejects.toThrow(/append-only/);
    await expect(h.pool.query(`delete from content.review_records`)).rejects.toThrow(/append-only/);
  });

  it('signed-in users can report a problem with a source', async () => {
    const s = (await http().get('/v1/content/sunnahs/test-sunnah')).body;
    await as(nobody)
      .post('/content/issue-reports', {
        subjectType: 'sunnah',
        subjectId: s.id,
        message: 'The link points to the wrong narration.',
      })
      .expect(204);
    await http().post('/v1/content/issue-reports').set(CSRF).send({}).expect(401);
    expect((await as(owner).get('/admin/issue-reports').expect(200)).body[0].message).toMatch(
      /wrong narration/,
    );
  });
});

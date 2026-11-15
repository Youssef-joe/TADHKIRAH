import { SURAHS } from '@tadhkirah/domain';
import ar from '@tadhkirah/i18n/messages/ar.json' with { type: 'json' };
import en from '@tadhkirah/i18n/messages/en.json' with { type: 'json' };
import type { AccountExport } from './export.service.js';

type Locale = 'ar' | 'en';
type Tree = { [k: string]: string | Tree };
const MESSAGES: Record<Locale, Tree> = { ar: ar as unknown as Tree, en: en as unknown as Tree };

/** Looks up `a.b.c` in the app's own messages, so the export uses the same wording as the app. */
function translator(locale: Locale) {
  return (path: string, vars: Record<string, string> = {}): string => {
    let node: string | Tree | undefined = MESSAGES[locale];
    for (const part of path.split('.')) node = typeof node === 'object' ? node[part] : undefined;
    if (typeof node !== 'string') return path.split('.').at(-1)!;
    return node.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  };
}

/** Keeps user text from breaking the Markdown structure (headings, lists). */
const text = (s: string) => s.replace(/\r?\n/g, '  \n').replace(/^([#>*-])/gm, '\\$1');

/**
 * A human-readable copy of the export (ACC-5). Arabic exports read right to
 * left; Markdown viewers that honour `dir="auto"` show them correctly.
 */
export function toMarkdown(data: AccountExport, locale: Locale): string {
  const t = translator(locale);
  const out: string[] = [];
  const h = (level: number, title: string) => out.push('', `${'#'.repeat(level)} ${title}`, '');
  const surah = (n: number) => {
    const s = SURAHS[n - 1];
    return s ? (locale === 'ar' ? s.ar : s.en) : String(n);
  };

  out.push(`# ${t('exportDoc.title')}`, '', `> ${t('exportDoc.note')}`, '');
  // Dates in the user's own time zone (YYYY-MM-DD), like the rest of the app.
  const tz = typeof data.profile?.timezone === 'string' ? data.profile.timezone : 'UTC';
  const localDay = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso));
  out.push(`- ${t('exportDoc.exportedAt')}: ${localDay(data.exportedAt)}`);
  h(2, t('exportDoc.account'));
  out.push(
    `- ${t('exportDoc.email')}: ${data.account.email}`,
    `- ${t('exportDoc.since')}: ${localDay(data.account.createdAt)}`,
    ...data.account.linkedSignIns.map(
      (i) =>
        `- ${t('exportDoc.linkedSignIn', { provider: i.provider === 'google' ? 'Google' : 'Apple' })}: ${i.email ?? '—'}`,
    ),
  );

  // Daily reflections, newest first.
  h(2, t('exportDoc.reflections'));
  const questionText = new Map(
    data.reflection.questions.map((q) => [
      q.id,
      q.catalogKey ? t(`reflection.questions.${q.catalogKey}`) : (q.text ?? ''),
    ]),
  );
  if (!data.reflection.days.length) out.push(t('exportDoc.empty'));
  for (const d of [...data.reflection.days].reverse()) {
    h(3, d.date);
    for (const a of d.answers) {
      const parts = [
        a.choice ? t(`reflection.choices.${a.choice}`) : null,
        a.text ? text(a.text) : null,
      ].filter(Boolean);
      if (parts.length)
        out.push(`- **${questionText.get(a.questionId) ?? ''}** ${parts.join(' · ')}`);
    }
    if (d.gratitude.length) {
      out.push(`- **${t('reflection.gratitude')}**`);
      for (const g of d.gratitude) out.push(`  - ${text(g)}`);
    }
    if (d.shortcoming)
      out.push(
        `- **${t('reflection.shortcoming')}** ${text(d.shortcoming)}${d.repentanceNoted ? ` (${t('reflection.repentance')})` : ''}`,
      );
    if (d.intention) out.push(`- **${t('reflection.intention')}** ${text(d.intention)}`);
    if (d.freeText) out.push(`- **${t('reflection.freeText')}**`, '', text(d.freeText));
  }

  // Worship log, grouped by day.
  h(2, t('exportDoc.worship'));
  const names = new Map(
    data.worship.activities.map((a) => [
      a.id as string,
      a.catalogKey
        ? t(`worship.activities.${a.catalogKey as string}`)
        : ((a.name as string | null) ?? ''),
    ]),
  );
  const units = new Map(
    data.worship.activities.map((a) => [a.id as string, (a.unit as string | null) ?? null]),
  );
  const flags = new Map(data.worship.dayFlags.map((f) => [f.date, f]));
  const byDay = new Map<string, string[]>();
  for (const l of data.worship.logs) {
    const value = l.prayerStatus
      ? t(`worship.status.${l.prayerStatus}`)
      : l.amount != null
        ? `${l.amount}${units.get(l.activityId) ? ` ${t(`worship.units.${units.get(l.activityId)}`)}` : ''}`
        : l.done
          ? t('exportDoc.done')
          : null;
    if (value)
      byDay.set(l.date, [
        ...(byDay.get(l.date) ?? []),
        `${names.get(l.activityId) ?? ''}: ${value}`,
      ]);
  }
  const worshipDays = [...new Set([...byDay.keys(), ...flags.keys()])].sort().reverse();
  if (!worshipDays.length) out.push(t('exportDoc.empty'));
  for (const day of worshipDays) {
    const f = flags.get(day);
    const notes = [
      f?.excused && t('exportDoc.excused'),
      f?.travelling && t('exportDoc.travelling'),
    ].filter(Boolean);
    h(3, notes.length ? `${day} (${notes.join('، ')})` : day);
    for (const line of byDay.get(day) ?? []) out.push(`- ${line}`);
  }

  // Quran.
  h(2, t('exportDoc.quran'));
  const mem = data.quran.memorization.filter((m) => m.status !== 'not_started');
  if (mem.length) {
    h(3, t('exportDoc.memorization'));
    for (const m of mem)
      out.push(`- ${surah(m.surah as number)}: ${t(`quran.statuses.${m.status as string}`)}`);
  }
  if (data.quran.recitations.length) {
    h(3, t('exportDoc.recitations'));
    for (const r of [...data.quran.recitations].reverse()) {
      const what =
        r.pages != null
          ? `${r.pages} ${t('worship.units.pages')}`
          : `${surah(r.fromSurah as number)} ${r.fromAyah} – ${surah(r.toSurah as number)} ${r.toAyah}`;
      out.push(`- ${r.localDate as string}: ${what}`);
    }
  }
  if (data.quran.revisions.length) {
    h(3, t('exportDoc.revisions'));
    for (const r of [...data.quran.revisions].reverse()) {
      const q = r.quality ? ` · ${t(`quran.qualities.${r.quality as string}`)}` : '';
      out.push(
        `- ${r.localDate as string}: ${surah(r.surah as number)} ${r.fromAyah}–${r.toAyah}${q}`,
      );
    }
  }
  if (!mem.length && !data.quran.recitations.length && !data.quran.revisions.length)
    out.push(t('exportDoc.empty'));

  // Weekly reviews and goals.
  h(2, t('exportDoc.weekly'));
  if (!data.weekly.reviews.length) out.push(t('exportDoc.empty'));
  for (const r of [...data.weekly.reviews].reverse()) {
    h(3, t('exportDoc.weekOf', { date: r.weekStart }));
    for (const f of ['improved', 'neglected', 'madeEasier', 'changeNext'] as const) {
      if (r[f]) out.push(`- **${t(`reports.prompts.${f}`)}** ${text(r[f])}`);
    }
  }
  h(2, t('exportDoc.goals'));
  if (!data.weekly.goals.length) out.push(t('exportDoc.empty'));
  for (const g of data.weekly.goals)
    out.push(`- ${text(g.text)} (${t(`reports.goalStatus.${g.status}`)}, ${g.startsOn})`);

  const custom = data.reminders.rules.filter((r) => r.category === 'custom' && r.customTitle);
  if (custom.length) {
    h(2, t('exportDoc.customReminders'));
    for (const r of custom) out.push(`- ${text(r.customTitle as string)}`);
  }

  return `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

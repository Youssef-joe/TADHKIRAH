'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { PublicDifference, PublicHadith } from '@tadhkirah/contracts';
import { api, errorKey } from '@/lib/api';
import { Button, Status } from '../ui/primitives';

/** "Some scholars hold…": scholarly differences are always shown, never hidden (CON-6, policy §7.4). */
export function Differences({ items }: { items: PublicDifference[] }) {
  const t = useTranslations('content');
  const locale = useLocale();
  if (!items.length) return null;
  return (
    <aside className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm">
      <p className="mb-1 font-medium text-accent">{t('differencesTitle')}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((d, i) => (
          <li key={i}>
            <span className="text-muted">{t(`difference_${d.kind}`)}: </span>
            {locale === 'ar' ? d.summaryAr : d.summaryEn}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** One cited narration with its full source and grading (policy §7.2). */
export function HadithEvidence({ h }: { h: PublicHadith }) {
  const t = useTranslations('content');
  const locale = useLocale();
  const source = locale === 'ar' ? h.source.nameAr : h.source.nameEn;
  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-4">
      <blockquote lang="ar" dir="rtl" className="font-display text-xl leading-loose">
        {h.textAr}
        {h.isExcerpt && (
          <span className="ms-2 align-middle text-xs text-muted">({t('excerpt')})</span>
        )}
      </blockquote>
      {locale === 'en' && h.translationEn && (
        <p className="leading-relaxed text-text/90">
          {h.translationEn}
          {h.translationBy && (
            <span className="mt-1 block text-xs text-muted">
              {t('translationBy', { by: h.translationBy })}
            </span>
          )}
        </p>
      )}
      <figcaption className="flex flex-col gap-1 text-sm text-muted">
        {h.narrator && (
          <span>
            {t('narratedBy', { name: locale === 'ar' ? h.narrator.nameAr : h.narrator.nameEn })}
          </span>
        )}
        <span>
          {t('citation', { source, number: h.number, scheme: h.source.numberingScheme })}
          {' · '}
          <a
            href={h.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
          >
            {t('openSource')}
          </a>
        </span>
        <span>
          <span className="me-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {t(`grade_${h.grade}`)}
          </span>
          {t('gradedBy', { scholar: h.gradedBy, work: h.workCited })}
        </span>
        {h.otherGradings.length > 0 && (
          <span>
            {t('otherGradings')}:{' '}
            {h.otherGradings
              .map((g) => `${t(`grade_${g.grade}`)} (${g.scholar}, ${g.workCited})`)
              .join('؛ ')}
          </span>
        )}
      </figcaption>
      <Differences items={h.differences} />
    </figure>
  );
}

/** "Report a problem with this source" → the editorial queue. */
export function ReportProblem({
  subjectType,
  subjectId,
}: {
  subjectType: 'sunnah' | 'occasion';
  subjectId: string;
}) {
  const t = useTranslations('content');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/content/issue-reports', {
        method: 'POST',
        body: { subjectType, subjectId, message },
      });
      setStatus({ tone: 'ok', text: t('reportThanks') });
      setOpen(false);
      setMessage('');
    } catch (err) {
      setStatus({ tone: 'error', text: te(errorKey(err)) });
    }
  }

  return (
    <div className="text-sm">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted underline-offset-4 hover:text-primary hover:underline"
        >
          {t('report')}
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={`report-${subjectId}`} className="font-medium">
            {t('report')}
          </label>
          <textarea
            id={`report-${subjectId}`}
            rows={3}
            minLength={5}
            maxLength={2000}
            required
            placeholder={t('reportPlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface p-3"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="ghost">
              {t('reportSend')}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
      {status && <Status tone={status.tone}>{status.text}</Status>}
    </div>
  );
}

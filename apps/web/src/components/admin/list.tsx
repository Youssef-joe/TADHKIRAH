'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { api, errorKey } from '@/lib/api';
import { Button, Card, Field, Input, Select, Status } from '../ui/primitives';
import { adminErrorKey, STATUSES, TRIGGERS, WINDOWS, type AdminType } from './shared';
import { StatusBadge } from './status-badge';

type Row = {
  id: string;
  status: string;
  revision: number;
  number?: string;
  sourceNameAr?: string;
  sourceNameEn?: string;
  narratorAr?: string | null;
  narratorEn?: string | null;
  hasText?: boolean;
  slug?: string;
  titleAr?: string;
  titleEn?: string;
};
type Source = { id: string; nameAr: string; nameEn: string };

export function AdminList({ type, initialStatus }: { type: AdminType; initialStatus?: string }) {
  const t = useTranslations('admin');
  const tc = useTranslations('content');
  const te = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const ar = locale === 'ar';
  const [status, setStatus] = useState(initialStatus ?? '');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) });
    const timer = setTimeout(() => {
      api<Row[]>(`/admin/${type}?${params}`).then(setRows, () => setRows([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [type, status, q]);
  useEffect(() => {
    if (type === 'hadiths') api<Source[]>('/admin/sources').then(setSources, () => undefined);
  }, [type]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const body =
      type === 'hadiths'
        ? { sourceId: form.sourceId ?? sources[0]?.id, number: form.number }
        : type === 'sunnahs'
          ? {
              slug: form.slug,
              titleAr: form.titleAr,
              titleEn: form.titleEn,
              trigger: form.trigger ?? 'daily',
            }
          : {
              slug: form.slug,
              titleAr: form.titleAr,
              titleEn: form.titleEn,
              window: form.window ?? WINDOWS[0],
            };
    try {
      const row = await api<{ id: string }>(`/admin/${type}`, { method: 'POST', body });
      router.push(`/admin/${type}/${row.id}`);
    } catch (err) {
      const k = adminErrorKey(err);
      setMsg(k ? t(k as 'err_duplicate') : te(errorKey(err)));
    }
  }
  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('search')} htmlFor="admin-q">
          <Input id="admin-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field label={t('statusFilter')} htmlFor="admin-status">
          <Select id="admin-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status_${s}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Card>
        {rows && !rows.length && <p className="text-muted">{t('empty')}</p>}
        <ul className="flex flex-col divide-y divide-border">
          {rows?.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/${type}/${r.id}`}
                className="flex flex-wrap items-center gap-3 py-3 hover:text-primary"
              >
                <StatusBadge status={r.status} />
                <span className="font-medium">
                  {type === 'hadiths'
                    ? `${ar ? r.sourceNameAr : r.sourceNameEn} ${r.number}`
                    : ar
                      ? r.titleAr
                      : r.titleEn}
                </span>
                <span className="text-sm text-muted">
                  {type === 'hadiths' ? (ar ? r.narratorAr : r.narratorEn) : r.slug}
                  {r.revision > 1 && ` · ${t('revision', { n: r.revision })}`}
                </span>
                {type === 'hadiths' && !r.hasText && (
                  <span className="text-xs text-accent">— {t('problem_text_ar')}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t('new')}>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          {type === 'hadiths' ? (
            <>
              <Field label={t('field_source')} htmlFor="new-source">
                <Select
                  id="new-source"
                  value={form.sourceId ?? sources[0]?.id ?? ''}
                  onChange={set('sourceId')}
                >
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {ar ? s.nameAr : s.nameEn}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('field_number')} htmlFor="new-number">
                <Input
                  id="new-number"
                  dir="ltr"
                  required
                  maxLength={40}
                  value={form.number ?? ''}
                  onChange={set('number')}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={t('field_slug')} htmlFor="new-slug">
                <Input
                  id="new-slug"
                  dir="ltr"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={form.slug ?? ''}
                  onChange={set('slug')}
                />
              </Field>
              {type === 'sunnahs' ? (
                <Field label={t('field_trigger')} htmlFor="new-trigger">
                  <Select
                    id="new-trigger"
                    value={form.trigger ?? 'daily'}
                    onChange={set('trigger')}
                  >
                    {TRIGGERS.map((x) => (
                      <option key={x} value={x}>
                        {tc(`trigger_${x}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label={t('field_window')} htmlFor="new-window">
                  <Select
                    id="new-window"
                    value={form.window ?? WINDOWS[0]}
                    onChange={set('window')}
                  >
                    {WINDOWS.map((x) => (
                      <option key={x} value={x}>
                        {t(`window_${x}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label={t('field_titleAr')} htmlFor="new-title-ar">
                <Input
                  id="new-title-ar"
                  dir="rtl"
                  lang="ar"
                  required
                  value={form.titleAr ?? ''}
                  onChange={set('titleAr')}
                />
              </Field>
              <Field label={t('field_titleEn')} htmlFor="new-title-en">
                <Input
                  id="new-title-en"
                  dir="ltr"
                  lang="en"
                  required
                  value={form.titleEn ?? ''}
                  onChange={set('titleEn')}
                />
              </Field>
            </>
          )}
          <div className="sm:col-span-2">
            <Button type="submit">{t('create')}</Button>
            {msg && <Status tone="error">{msg}</Status>}
          </div>
        </form>
      </Card>
    </div>
  );
}

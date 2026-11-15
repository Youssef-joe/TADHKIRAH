'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api, errorKey } from '@/lib/api';
import { Button, Card, Field, Input, Select, Status } from '../ui/primitives';
import { adminErrorKey, GRADES, TRIGGERS, WINDOWS, type AdminType } from './shared';
import { StatusBadge } from './status-badge';

type Item = Record<string, unknown> & { id: string; status: string; revision: number };
type Detail = {
  item: Item;
  authentications?: {
    id: string;
    grade: string;
    scholar: string;
    workCited: string;
    isPrimary: boolean;
    notes: string | null;
  }[];
  links?: {
    hadithId: string;
    relevance: string | null;
    status: string;
    number: string;
    sourceNameAr: string;
    sourceNameEn: string;
  }[];
  differences: { id: string; kind: string; summaryAr: string; summaryEn: string }[];
  history: {
    id: string;
    action: string;
    toStatus: string;
    actorEmail: string | null;
    actorRole: string;
    singleReviewer: boolean;
    notes: string | null;
    createdAt: string;
    revision: number;
  }[];
  problems: { problems: string[]; gate: string | null };
  actions: string[];
  editable: boolean;
};
type Named = { id: string; nameAr: string; nameEn: string };
type HadithRow = {
  id: string;
  status: string;
  number: string;
  sourceNameAr: string;
  sourceNameEn: string;
};

const textarea = 'w-full rounded-lg border border-border bg-surface p-3 text-base';

/** Fields for each type: [key, kind]. */
const FIELDS: Record<
  AdminType,
  [
    string,
    (
      | 'text'
      | 'textarea'
      | 'ar'
      | 'url'
      | 'bool'
      | 'source'
      | 'narrator'
      | 'trigger'
      | 'window'
      | 'classification'
      | 'evidenceType'
    ),
  ][]
> = {
  hadiths: [
    ['sourceId', 'source'],
    ['number', 'text'],
    ['bookChapter', 'text'],
    ['narratorId', 'narrator'],
    ['textAr', 'ar'],
    ['isExcerpt', 'bool'],
    ['translationEn', 'textarea'],
    ['translationBy', 'text'],
    ['sourceUrl', 'url'],
    ['editorNotes', 'textarea'],
  ],
  sunnahs: [
    ['titleAr', 'ar'],
    ['titleEn', 'text'],
    ['descriptionAr', 'ar'],
    ['descriptionEn', 'textarea'],
    ['instructionsAr', 'ar'],
    ['instructionsEn', 'textarea'],
    ['classification', 'classification'],
    ['trigger', 'trigger'],
  ],
  occasions: [
    ['titleAr', 'ar'],
    ['titleEn', 'text'],
    ['explanationAr', 'ar'],
    ['explanationEn', 'textarea'],
    ['window', 'window'],
    ['evidenceType', 'evidenceType'],
    ['schedulable', 'bool'],
  ],
};

export function AdminEditor({ type, id }: { type: AdminType; id: string }) {
  const t = useTranslations('admin');
  const te = useTranslations('errors');
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [sources, setSources] = useState<Named[]>([]);
  const [narrators, setNarrators] = useState<Named[]>([]);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const detail = await api<Detail>(`/admin/${type}/${id}`);
    setD(detail);
    setForm(detail.item);
  }, [type, id]);
  useEffect(() => {
    void load();
    if (type === 'hadiths') {
      api<Named[]>('/admin/sources').then(setSources, () => undefined);
      api<Named[]>('/admin/narrators').then(setNarrators, () => undefined);
    }
  }, [load, type]);

  /** Runs an API call, shows the outcome, reloads. */
  async function run(fn: () => Promise<unknown>, ok = t('saved')) {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'ok', text: ok });
      await load();
    } catch (err) {
      const k = adminErrorKey(err);
      setMsg({ tone: 'error', text: k ? t(k as 'err_forbidden') : te(errorKey(err)) });
    }
  }

  if (!d)
    return (
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-surface" aria-busy />
    );
  const disabled = !d.editable;

  async function save(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const [key] of FIELDS[type]) {
      if (form[key] !== d!.item[key]) body[key] = form[key] === '' ? null : form[key];
    }
    if (Object.keys(body).length)
      await run(() => api(`/admin/${type}/${id}`, { method: 'PATCH', body }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={d.item.status} />
        <span className="text-sm text-muted">{t('revision', { n: d.item.revision })}</span>
        {d.item.status === 'approved' && (
          <Button
            variant="ghost"
            className="ms-auto"
            onClick={async () => {
              try {
                const r = await api<{ id: string }>(`/admin/${type}/${id}/revisions`, {
                  method: 'POST',
                });
                router.push(`/admin/${type}/${r.id}`);
              } catch (err) {
                setMsg({ tone: 'error', text: te(errorKey(err)) });
              }
            }}
          >
            {t('revise')}
          </Button>
        )}
      </div>
      {msg && <Status tone={msg.tone}>{msg.text}</Status>}

      <Card>
        <form onSubmit={save} className="flex flex-col gap-4">
          {disabled && <p className="text-sm text-muted">{t('readOnly')}</p>}
          {FIELDS[type].map(([key, kind]) => (
            <FieldFor
              key={key}
              name={key}
              kind={kind}
              value={form[key]}
              disabled={disabled}
              sources={sources}
              narrators={narrators}
              onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
            />
          ))}
          {type === 'hadiths' && !disabled && (
            <NewNarrator
              onAdded={(n) => {
                setNarrators((all) => [...all, n]);
                setForm((f) => ({ ...f, narratorId: n.id }));
              }}
            />
          )}
          {!disabled && (
            <Button type="submit" className="self-start">
              {t('save')}
            </Button>
          )}
        </form>
      </Card>

      {type === 'hadiths' && (
        <Gradings
          items={d.authentications ?? []}
          disabled={disabled}
          onAdd={(body) =>
            run(() => api(`/admin/hadiths/${id}/authentications`, { method: 'POST', body }))
          }
          onRemove={(aid) =>
            run(() => api(`/admin/hadiths/${id}/authentications/${aid}`, { method: 'DELETE' }))
          }
        />
      )}
      {type !== 'hadiths' && (
        <Links
          items={d.links ?? []}
          disabled={disabled}
          onSave={(links) =>
            run(() => api(`/admin/${type}/${id}/hadiths`, { method: 'PUT', body: { links } }))
          }
        />
      )}
      <DifferencesEditor
        items={d.differences}
        disabled={disabled}
        onAdd={(body) =>
          run(() => api(`/admin/${type}/${id}/differences`, { method: 'POST', body }))
        }
        onRemove={(did) =>
          run(() => api(`/admin/${type}/${id}/differences/${did}`, { method: 'DELETE' }))
        }
      />
      <Workflow
        d={d}
        onAction={(action, notes) =>
          run(
            () =>
              api(`/admin/${type}/${id}/transitions`, { method: 'POST', body: { action, notes } }),
            t(`status_${nextStatus(action)}` as 'status_draft'),
          )
        }
      />
      <History items={d.history} />
    </div>
  );
}

const nextStatus = (a: string) =>
  ({
    submit: 'awaiting_verification',
    verify: 'verified',
    reject: 'rejected',
    approve: 'approved',
    archive: 'archived',
    reopen: 'draft',
  })[a] ?? 'draft';

function FieldFor({
  name,
  kind,
  value,
  disabled,
  sources,
  narrators,
  onChange,
}: {
  name: string;
  kind: string;
  value: unknown;
  disabled: boolean;
  sources: Named[];
  narrators: Named[];
  onChange: (v: unknown) => void;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('content');
  const ar = useLocale() === 'ar';
  const id = `f-${name}`;
  // Ids are stored as sourceId/narratorId; their labels are the plain field names.
  const label = t(`field_${name.replace(/Id$/, '')}` as 'field_source');
  const str = (value as string | null) ?? '';
  if (kind === 'bool') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          disabled={disabled}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    );
  }
  let control: ReactNode;
  const select = (options: [string, string][]) => (
    <Select
      id={id}
      disabled={disabled}
      value={str}
      onChange={(e) => onChange(e.target.value || null)}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </Select>
  );
  switch (kind) {
    case 'source':
      control = select(sources.map((s) => [s.id, ar ? s.nameAr : s.nameEn]));
      break;
    case 'narrator':
      control = select([
        ['', '—'],
        ...narrators.map((n): [string, string] => [n.id, ar ? n.nameAr : n.nameEn]),
      ]);
      break;
    case 'trigger':
      control = select(TRIGGERS.map((x) => [x, tc(`trigger_${x}`)]));
      break;
    case 'window':
      control = select(WINDOWS.map((x) => [x, t(`window_${x}`)]));
      break;
    case 'classification':
      control = select([
        ['established', t('classification_established')],
        ['less_commonly_practiced', t('classification_less_commonly_practiced')],
      ]);
      break;
    case 'evidenceType':
      control = select([
        ['explicit_text', t('evidence_explicit_text')],
        ['scholarly_interpretation', t('evidence_scholarly_interpretation')],
      ]);
      break;
    case 'ar':
      control = (
        <textarea
          id={id}
          lang="ar"
          dir="rtl"
          rows={name === 'titleAr' ? 1 : 4}
          disabled={disabled}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={`${textarea} font-display text-lg`}
        />
      );
      break;
    case 'textarea':
      control = (
        <textarea
          id={id}
          rows={3}
          disabled={disabled}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={textarea}
        />
      );
      break;
    default:
      control = (
        <Input
          id={id}
          dir={kind === 'url' ? 'ltr' : undefined}
          type={kind === 'url' ? 'url' : 'text'}
          disabled={disabled}
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
  return (
    <Field label={label} htmlFor={id}>
      {control}
    </Field>
  );
}

function NewNarrator({ onAdded }: { onAdded: (n: Named) => void }) {
  const t = useTranslations('admin');
  const [nameAr, setAr] = useState('');
  const [nameEn, setEn] = useState('');
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-primary">
        {t('add')}: {t('field_narrator')}
      </summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Input
          aria-label={`${t('field_narrator')} (ar)`}
          dir="rtl"
          lang="ar"
          value={nameAr}
          onChange={(e) => setAr(e.target.value)}
          className="max-w-xs"
        />
        <Input
          aria-label={`${t('field_narrator')} (en)`}
          dir="ltr"
          lang="en"
          value={nameEn}
          onChange={(e) => setEn(e.target.value)}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="ghost"
          disabled={!nameAr.trim() || !nameEn.trim()}
          onClick={async () => {
            onAdded(
              await api<Named>('/admin/narrators', { method: 'POST', body: { nameAr, nameEn } }),
            );
            setAr('');
            setEn('');
          }}
        >
          {t('add')}
        </Button>
      </div>
    </details>
  );
}

function Gradings({
  items,
  disabled,
  onAdd,
  onRemove,
}: {
  items: NonNullable<Detail['authentications']>;
  disabled: boolean;
  onAdd: (b: object) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('content');
  const [g, setG] = useState({
    grade: 'sahih',
    scholar: '',
    workCited: '',
    isPrimary: items.length === 0,
    notes: '',
  });
  return (
    <Card title={t('gradings')}>
      <ul className="mb-4 flex flex-col gap-2">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {tc(`grade_${a.grade}` as 'grade_sahih')}
            </span>
            {a.scholar} · {a.workCited}
            {a.isPrimary && <span className="text-xs text-accent">({t('primary')})</span>}
            {!disabled && (
              <button type="button" className="ms-auto text-danger" onClick={() => onRemove(a.id)}>
                {t('remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await onAdd({ ...g, notes: g.notes || null });
            setG({ grade: 'sahih', scholar: '', workCited: '', isPrimary: false, notes: '' });
          }}
        >
          <Field label={t('field_grade')} htmlFor="g-grade">
            <Select
              id="g-grade"
              value={g.grade}
              onChange={(e) => setG({ ...g, grade: e.target.value })}
            >
              {GRADES.map((x) => (
                <option key={x} value={x}>
                  {tc(`grade_${x}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('field_scholar')} htmlFor="g-scholar">
            <Input
              id="g-scholar"
              required
              value={g.scholar}
              onChange={(e) => setG({ ...g, scholar: e.target.value })}
            />
          </Field>
          <Field label={t('field_workCited')} htmlFor="g-work">
            <Input
              id="g-work"
              required
              value={g.workCited}
              onChange={(e) => setG({ ...g, workCited: e.target.value })}
            />
          </Field>
          <Field label={t('field_notes')} htmlFor="g-notes">
            <Input
              id="g-notes"
              value={g.notes}
              onChange={(e) => setG({ ...g, notes: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={g.isPrimary}
              onChange={(e) => setG({ ...g, isPrimary: e.target.checked })}
            />
            {t('field_isPrimary')}
          </label>
          <Button type="submit" variant="ghost" className="self-start">
            {t('addGrading')}
          </Button>
        </form>
      )}
    </Card>
  );
}

function Links({
  items,
  disabled,
  onSave,
}: {
  items: NonNullable<Detail['links']>;
  disabled: boolean;
  onSave: (l: { hadithId: string; relevance: string | null }[]) => Promise<void>;
}) {
  const t = useTranslations('admin');
  const ar = useLocale() === 'ar';
  const [all, setAll] = useState<HadithRow[]>([]);
  const [pick, setPick] = useState('');
  const [relevance, setRelevance] = useState('');
  useEffect(() => {
    if (!disabled)
      api<HadithRow[]>('/admin/hadiths').then(
        (r) => setAll(r.filter((h) => h.status !== 'archived' && h.status !== 'rejected')),
        () => undefined,
      );
  }, [disabled]);
  const current = items.map((l) => ({ hadithId: l.hadithId, relevance: l.relevance }));
  return (
    <Card title={t('evidenceLinks')}>
      {!items.length && <p className="mb-3 text-sm text-muted">{t('noLinks')}</p>}
      <ul className="mb-4 flex flex-col gap-2">
        {items.map((l) => (
          <li key={l.hadithId} className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={l.status} />
            {ar ? l.sourceNameAr : l.sourceNameEn} {l.number}
            {l.relevance && <span className="text-muted">— {l.relevance}</span>}
            {!disabled && (
              <button
                type="button"
                className="ms-auto text-danger"
                onClick={() => onSave(current.filter((c) => c.hadithId !== l.hadithId))}
              >
                {t('remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label={t('chooseHadith')} htmlFor="link-pick">
            <Select id="link-pick" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">—</option>
              {all
                .filter((h) => !items.some((l) => l.hadithId === h.id))
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {ar ? h.sourceNameAr : h.sourceNameEn} {h.number} (
                    {t(`status_${h.status}` as 'status_draft')})
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t('field_relevance')} htmlFor="link-rel">
            <Input id="link-rel" value={relevance} onChange={(e) => setRelevance(e.target.value)} />
          </Field>
          <Button
            type="button"
            variant="ghost"
            disabled={!pick}
            onClick={async () => {
              await onSave([...current, { hadithId: pick, relevance: relevance || null }]);
              setPick('');
              setRelevance('');
            }}
          >
            {t('addLink')}
          </Button>
        </div>
      )}
    </Card>
  );
}

function DifferencesEditor({
  items,
  disabled,
  onAdd,
  onRemove,
}: {
  items: Detail['differences'];
  disabled: boolean;
  onAdd: (b: object) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('content');
  const ar = useLocale() === 'ar';
  const [f, setF] = useState({ kind: 'interpretation', summaryAr: '', summaryEn: '' });
  if (disabled && !items.length) return null;
  return (
    <Card title={t('differences')}>
      <ul className="mb-4 flex flex-col gap-2 text-sm">
        {items.map((x) => (
          <li key={x.id} className="flex items-start gap-2">
            <span className="text-muted">{tc(`difference_${x.kind}` as 'difference_timing')}:</span>
            <span>{ar ? x.summaryAr : x.summaryEn}</span>
            {!disabled && (
              <button type="button" className="ms-auto text-danger" onClick={() => onRemove(x.id)}>
                {t('remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await onAdd(f);
            setF({ kind: 'interpretation', summaryAr: '', summaryEn: '' });
          }}
        >
          <Field label={t('field_kind')} htmlFor="d-kind">
            <Select
              id="d-kind"
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value })}
            >
              {(['authentication', 'interpretation', 'timing'] as const).map((k) => (
                <option key={k} value={k}>
                  {tc(`difference_${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('field_summaryAr')} htmlFor="d-ar">
            <textarea
              id="d-ar"
              lang="ar"
              dir="rtl"
              rows={2}
              required
              value={f.summaryAr}
              onChange={(e) => setF({ ...f, summaryAr: e.target.value })}
              className={textarea}
            />
          </Field>
          <Field label={t('field_summaryEn')} htmlFor="d-en">
            <textarea
              id="d-en"
              dir="ltr"
              rows={2}
              required
              value={f.summaryEn}
              onChange={(e) => setF({ ...f, summaryEn: e.target.value })}
              className={textarea}
            />
          </Field>
          <Button type="submit" variant="ghost" className="self-start">
            {t('addDifference')}
          </Button>
        </form>
      )}
    </Card>
  );
}

function Workflow({
  d,
  onAction,
}: {
  d: Detail;
  onAction: (action: string, notes: string | null) => Promise<void>;
}) {
  const t = useTranslations('admin');
  const [notes, setNotes] = useState('');
  const { problems, gate } = d.problems;
  return (
    <Card title={t('workflow')}>
      {d.item.status === 'draft' && problems.length > 0 && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm">
          <p className="mb-1 font-medium">{t('problems')}</p>
          <ul className="list-inside list-disc">
            {problems.map((p) => (
              <li key={p}>{t(`problem_${p}` as 'problem_title')}</li>
            ))}
          </ul>
        </div>
      )}
      {d.item.status === 'verified' && gate && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {t(gate === 'content.grade_not_publishable' ? 'gateGrade' : 'gateEvidence')}
        </p>
      )}
      {d.actions.length ? (
        <>
          <Field label={t('notes')} htmlFor="wf-notes">
            <textarea
              id="wf-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={textarea}
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.actions.map((a) => (
              <Button
                key={a}
                variant={a === 'reject' || a === 'archive' ? 'ghost' : 'primary'}
                onClick={async () => {
                  await onAction(a, notes.trim() || null);
                  setNotes('');
                }}
              >
                {t(`action_${a}` as 'action_submit')}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">{t('noActions')}</p>
      )}
    </Card>
  );
}

function History({ items }: { items: Detail['history'] }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <Card title={t('history')}>
      {!items.length && <p className="text-sm text-muted">{t('noHistory')}</p>}
      <ol className="flex flex-col gap-3 text-sm">
        {items.map((h) => (
          <li key={h.id} className="flex flex-col gap-0.5 border-s-2 border-border ps-3">
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={h.toStatus} />
              <span className="text-muted">{fmt.format(new Date(h.createdAt))}</span>
              <bdi dir="ltr" className="text-muted">
                {h.actorEmail ?? '—'}
              </bdi>
              <span className="text-muted">({t(`role_${h.actorRole}` as 'role_editor')})</span>
              {h.singleReviewer && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                  {t('singleReviewer')}
                </span>
              )}
            </span>
            {h.notes && <span className="whitespace-pre-line">{h.notes}</span>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

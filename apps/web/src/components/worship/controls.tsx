'use client';

import { useTranslations } from 'next-intl';
import type { ActivityDto, PrayerStatus } from '@/lib/worship-types';
import { Icon } from '../ui/icons';

const STATUSES: PrayerStatus[] = ['on_time', 'later', 'qada', 'excused'];

const STATUS_STYLE: Record<PrayerStatus, string> = {
  on_time: 'aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white',
  later: 'aria-pressed:border-accent aria-pressed:bg-accent/15 aria-pressed:text-text',
  qada: 'aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary',
  excused: 'aria-pressed:border-excused aria-pressed:bg-excused/25 aria-pressed:text-text',
};

/** Prayer status picker. Tapping the selected status again clears the log. */
export function PrayerStatusControl({
  value,
  onChange,
  label,
}: {
  value: PrayerStatus | null;
  onChange: (v: PrayerStatus | null) => void;
  label: string;
}) {
  const t = useTranslations('worship.status');
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(value === s ? null : s)}
          className={`min-h-9 rounded-full border border-border px-3 text-sm transition-all duration-200 hover:border-primary/60 active:scale-95 ${STATUS_STYLE[s]}`}
        >
          {s === 'on_time' && value === s && (
            <Icon name="check" size={14} className="-ms-0.5 me-1 inline" />
          )}
          {t(s)}
        </button>
      ))}
    </div>
  );
}

/** Done / not done toggle with a satisfying check animation. */
export function DoneToggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const t = useTranslations('worship');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className={`flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm transition-all duration-300 active:scale-95 ${
        value
          ? 'border-primary bg-primary text-white shadow-md shadow-primary/20'
          : 'border-border text-muted hover:border-primary/60'
      }`}
    >
      <span
        className={`flex size-5 items-center justify-center rounded-full border transition-all duration-300 ${
          value ? 'scale-110 border-white bg-white text-primary' : 'border-border'
        }`}
      >
        {value && <Icon name="check" size={13} strokeWidth={2.4} />}
      </span>
      {value ? t('done') : t('notYet')}
    </button>
  );
}

/** Number stepper for counted activities (pages, rak'ahs, …), with goal progress. */
export function CountStepper({
  activity,
  value,
  onChange,
  format,
  label,
}: {
  activity: ActivityDto;
  value: number;
  onChange: (v: number) => void;
  format: (n: number) => string;
  label: string;
}) {
  const t = useTranslations('worship');
  const max = activity.max ?? 10_000;
  const target = activity.dailyTarget;
  const pct = target ? Math.min(100, (value / target) * 100) : null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1" role="group" aria-label={label}>
        <button
          type="button"
          aria-label={t('decrease')}
          disabled={value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex size-9 items-center justify-center rounded-full border border-border text-lg transition-transform hover:border-primary/60 active:scale-90 disabled:opacity-40"
        >
          −
        </button>
        <output className="min-w-16 text-center tabular-nums" aria-live="polite">
          <span className="text-lg font-semibold">{format(value)}</span>{' '}
          <span className="text-xs text-muted">
            {activity.unit ? t(`units.${activity.unit}`) : ''}
          </span>
        </output>
        <button
          type="button"
          aria-label={t('increase')}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex size-9 items-center justify-center rounded-full border border-primary bg-primary/10 text-lg text-primary transition-transform hover:bg-primary hover:text-white active:scale-90 disabled:opacity-40"
        >
          +
        </button>
      </div>
      {pct !== null && (
        <div className="flex w-36 items-center gap-2" title={t('goal', { n: format(target!) })}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500 rtl:bg-gradient-to-l"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted tabular-nums">{format(target!)}</span>
        </div>
      )}
    </div>
  );
}

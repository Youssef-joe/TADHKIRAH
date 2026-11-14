/** Formatting helpers that honour the user's locale and numeral choice. */

export type Digits = 'arab' | 'latn';

export function timeFormatter(locale: string, digits: Digits, timeZone: string) {
  return new Intl.DateTimeFormat(`${locale}-u-nu-${digits}`, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

/** "2 hr, 15 min" / "ساعتان و١٥ دقيقة", using Intl.DurationFormat where available. */
export function formatDuration(ms: number, locale: string, digits: Digits): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  type DurationFormatCtor = new (
    locale: string,
    opts: { style: string },
  ) => { format(d: { hours?: number; minutes?: number }): string };
  const DF = (Intl as unknown as { DurationFormat?: DurationFormatCtor }).DurationFormat;
  if (DF) {
    return new DF(`${locale}-u-nu-${digits}`, { style: 'short' }).format(
      hours ? { hours, minutes } : { minutes },
    );
  }
  const n = new Intl.NumberFormat(`${locale}-u-nu-${digits}`);
  return hours
    ? `${n.format(hours)}:${n.format(minutes).padStart(2, n.format(0))}`
    : `${n.format(minutes)}′`;
}

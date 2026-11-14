import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger';
}) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' && 'bg-primary text-white hover:opacity-90',
        variant === 'ghost' && 'border border-border bg-surface text-text hover:bg-bg',
        variant === 'quiet' && 'text-primary underline-offset-4 hover:underline',
        variant === 'danger' && 'bg-danger text-white hover:opacity-90',
        className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

const control =
  'min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-text placeholder:text-muted';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, props.className)} />;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      {title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

/** Polite status line for form results (screen readers announce it). */
export function Status({ tone, children }: { tone: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx('text-sm', tone === 'ok' ? 'text-primary' : 'text-danger')}
    >
      {children}
    </p>
  );
}

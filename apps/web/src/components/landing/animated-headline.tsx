import { Fragment } from 'react';

/**
 * Reveals a headline word by word (soft blur → sharp, rising slightly). It splits
 * on spaces only, so Arabic letter joining inside each word is untouched, and
 * normal spaces between words keep line wrapping intact. Screen readers get
 * the whole sentence once.
 */
export function AnimatedHeadline({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <h1 className={className} aria-label={text}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span
            aria-hidden
            className="tk-word inline-block"
            style={{ animationDelay: `${150 + i * 90}ms` }}
          >
            {w}
          </span>
          {i < words.length - 1 && ' '}
        </Fragment>
      ))}
    </h1>
  );
}

import type { SVGProps } from 'react';

/** Simple stroke icons (24px grid, currentColor) so they follow the theme. */
export type IconName =
  | 'today'
  | 'worship'
  | 'reflection'
  | 'sunnah'
  | 'times'
  | 'reports'
  | 'settings'
  | 'pin'
  | 'locate'
  | 'clock'
  | 'check'
  | 'arrow'
  | 'lock'
  | 'shield'
  | 'heart'
  | 'book'
  | 'inbox';

const PATHS: Record<IconName, string> = {
  // Sun rising over the horizon
  today: 'M3 18h18M6 14a6 6 0 0 1 12 0M12 4v3M4.9 7.9l2.1 2.1M19.1 7.9 17 10M8 21h8',
  // Prayer mat with a mihrab arch
  worship: 'M6 21V9a6 6 0 0 1 12 0v12M4 21h16M9 21v-7a3 3 0 0 1 6 0v7',
  // Open notebook with a pen
  reflection: 'M4 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-4M14 13l5-5 2 2-5 5h-2z',
  // Eight-pointed star
  sunnah:
    'M12 2.5l2.4 3.3 4.1-.6-.6 4.1 3.3 2.4-3.3 2.4.6 4.1-4.1-.6L12 21.5l-2.4-3.3-4.1.6.6-4.1L2.8 12l3.3-2.4-.6-4.1 4.1.6z',
  // Crescent with a star
  times:
    'M15.5 3.5a8.5 8.5 0 1 0 5 13.3A7 7 0 0 1 15.5 3.5zM19 4.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  locate:
    'M12 2v3M12 19v3M2 12h3M19 12h3M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  heart:
    'M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 4 4 7.3 4c2 0 3.5 1.2 4.7 2.8C13.2 5.2 14.7 4 16.7 4 20 4 22.4 7.2 21.2 10.6 19.5 15.4 12 20 12 20z',
  inbox: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  book: 'M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20M9 7h7M9 10h5',
};

export function Icon({
  name,
  size = 20,
  flipInRtl = false,
  ...props
}: { name: IconName; size?: number; flipInRtl?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={flipInRtl ? 'rtl:-scale-x-100' : undefined}
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

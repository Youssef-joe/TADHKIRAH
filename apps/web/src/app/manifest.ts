import type { MetadataRoute } from 'next';

/** Installable PWA (M8). Arabic first; the locale middleware sends /app/today to the user's language. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'تَذْكِرَة · Tadhkirah',
    short_name: 'تَذْكِرَة',
    description: 'رَفِيقٌ خَاصٌّ لِمُحَاسَبَةِ النَّفْسِ كُلَّ يَوْم.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/app/today',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf6ee',
    theme_color: '#0f3d3a',
    categories: ['lifestyle', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

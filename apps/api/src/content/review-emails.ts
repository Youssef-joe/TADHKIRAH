import type { Locale } from '@tadhkirah/contracts';
import type { MailMessage } from '../auth/mailer.js';

const COPY = {
  ar: {
    subject: 'تَذْكِرَة: مُحْتَوًى يَنْتَظِرُ الْمُرَاجَعَة',
    intro: 'السَّلَامُ عَلَيْكُمْ،',
    due: (n: number) => `مَوَادُّ مَنْشُورَةٌ حَانَ مَوْعِدُ مُرَاجَعَتِهَا: ${n}`,
    reports: (n: number) => `بَلَاغَاتٌ عَنْ مَشَاكِلَ فِي الْمَصَادِرِ لَمْ تُعَالَجْ بَعْدُ: ${n}`,
    why: 'الْمُرَاجَعَةُ الدَّوْرِيَّةُ تَحْفَظُ لِلْمُحْتَوَى أَمَانَتَهُ: تَأَكَّدْ مِنَ النَّصِّ وَالْمَصْدَرِ وَالدَّرَجَةِ، ثُمَّ أَكِّدْهُ أَوْ عَدِّلْهُ.',
    button: 'افْتَحْ قَائِمَةَ الْمُرَاجَعَة',
    footer:
      'تَصِلُكَ هَذِهِ الرِّسَالَةُ لِأَنَّكَ مُرَاجِعٌ فِي فَرِيقِ الْمُحْتَوَى، مَرَّةً فِي الْأُسْبُوعِ عَلَى الْأَكْثَرِ، وَأَسْرَعَ عِنْدَ وُصُولِ بَلَاغٍ جَدِيدٍ.',
  },
  en: {
    subject: 'Tadhkirah: content waiting for review',
    intro: 'Assalamu alaikum,',
    due: (n: number) => `Published items due for re-review: ${n}`,
    reports: (n: number) => `Open reports of a problem with a source: ${n}`,
    why: 'Periodic re-review keeps the content trustworthy: check the text, source and grading, then reconfirm or revise.',
    button: 'Open the review queue',
    footer:
      "You're getting this because you're a reviewer on the content team. At most weekly, sooner when a new report arrives.",
  },
} as const;

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** The reviewer digest: counts and a link only, never content or reporters' details. */
export function reviewDigestEmail(
  to: string,
  locale: Locale,
  counts: { due: number; reports: number },
  link: string,
): MailMessage {
  const t = COPY[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const lines = [
    ...(counts.due ? [t.due(counts.due)] : []),
    ...(counts.reports ? [t.reports(counts.reports)] : []),
  ];
  const text = [t.intro, '', ...lines, '', t.why, '', link, '', t.footer].join('\n');
  const html = `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#faf6ee;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;color:#1e2a26">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<p style="font-size:16px">${escape(t.intro)}</p>
<ul style="font-size:16px;line-height:1.8;padding-inline-start:20px">${lines.map((l) => `<li>${escape(l)}</li>`).join('')}</ul>
<p style="font-size:14px">${escape(t.why)}</p>
<p style="text-align:center;margin:24px 0"><a href="${escape(link)}" style="background:#0f5d4a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block">${escape(t.button)}</a></p>
<p style="font-size:13px;color:#5e6b66">${escape(t.footer)}</p>
</div></body></html>`;
  return { to, subject: t.subject, text, html };
}

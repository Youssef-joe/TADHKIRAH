import type { Locale } from '@tadhkirah/contracts';
import type { MailMessage } from './mailer.js';

const COPY = {
  ar: {
    subject: 'رمز الدخول إلى تذكرة',
    intro: 'السلام عليكم،',
    codeLine: 'رمز الدخول الخاص بك:',
    linkLine: 'أو افتح هذا الرابط على الجهاز نفسه:',
    button: 'الدخول إلى تذكرة',
    expiry: 'ينتهي الرمز والرابط خلال ١٥ دقيقة، ولا يعمل إلا آخر رمز طلبته.',
    ignore: 'إن لم تطلب الدخول فتجاهل هذه الرسالة، ولن يتغير شيء في حسابك.',
  },
  en: {
    subject: 'Your Tadhkirah sign-in code',
    intro: 'Assalamu alaikum,',
    codeLine: 'Your sign-in code:',
    linkLine: 'Or open this link on the same device:',
    button: 'Sign in to Tadhkirah',
    expiry: 'The code and link expire in 15 minutes. Only the most recent code works.',
    ignore: "If you didn't request this, you can ignore this email — nothing will change.",
  },
} as const;

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** Sign-in email. Short and plain, no tracking pixels and no remote images. */
export function signInEmail(to: string, locale: Locale, code: string, link: string): MailMessage {
  const t = COPY[locale];
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const text = [
    t.intro,
    '',
    `${t.codeLine} ${code}`,
    '',
    t.linkLine,
    link,
    '',
    t.expiry,
    t.ignore,
  ].join('\n');
  const html = `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#faf6ee;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;color:#1e2a26">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<p style="font-size:16px">${escape(t.intro)}</p>
<p style="font-size:16px">${escape(t.codeLine)}</p>
<p dir="ltr" style="font-size:32px;letter-spacing:8px;font-weight:600;color:#0f5d4a;text-align:center;margin:24px 0">${code}</p>
<p style="font-size:14px">${escape(t.linkLine)}</p>
<p style="text-align:center;margin:24px 0"><a href="${escape(link)}" style="background:#0f5d4a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block">${escape(t.button)}</a></p>
<p style="font-size:13px;color:#5e6b66">${escape(t.expiry)}<br>${escape(t.ignore)}</p>
</div></body></html>`;
  return { to, subject: t.subject, text, html };
}

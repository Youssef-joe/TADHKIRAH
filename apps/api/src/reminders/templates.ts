/**
 * Notification wording (docs/05-ux.md §6): short and inviting, never
 * guilt-based: no "you missed", no countdown pressure, no exclamation marks.
 * Arabic carries full diacritics.
 */
type Locale = 'ar' | 'en';
type Category =
  | 'prayer'
  | 'adhkar_morning'
  | 'adhkar_evening'
  | 'quran'
  | 'reflection'
  | 'weekly_review'
  | 'custom';

const PRAYERS: Record<Locale, Record<string, string>> = {
  ar: {
    fajr: 'الْفَجْر',
    sunrise: 'الشُّرُوق',
    dhuhr: 'الظُّهْر',
    asr: 'الْعَصْر',
    maghrib: 'الْمَغْرِب',
    isha: 'الْعِشَاء',
  },
  en: {
    fajr: 'Fajr',
    sunrise: 'Sunrise',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
  },
};

const TEXT: Record<Locale, Record<Exclude<Category, 'prayer' | 'custom'>, [string, string]>> = {
  ar: {
    adhkar_morning: ['أَذْكَارُ الصَّبَاح', 'مَتَى مَا كُنْتَ مُسْتَعِدًّا، بِسْمِ اللَّه.'],
    adhkar_evening: ['أَذْكَارُ الْمَسَاء', 'مَتَى مَا كُنْتَ مُسْتَعِدًّا، بِسْمِ اللَّه.'],
    quran: ['وِرْدُ الْقُرْآن', 'وِرْدُكَ مِنَ الْقُرْآنِ لِهَذَا الْيَوْمِ.'],
    reflection: ['لَحْظَةٌ لِمُحَاسَبَةِ النَّفْس', 'لَحْظَةٌ تُرَاجِعُ فِيهَا يَوْمَكَ، إِنْ شِئْتَ.'],
    weekly_review: ['أُسْبُوعُكَ فِي سُطُور', 'تَقْرِيرُ أُسْبُوعِكَ جَاهِزٌ لِلنَّظَرِ فِيهِ.'],
  },
  en: {
    adhkar_morning: ['Morning adhkar', "Whenever you're ready, bismillah."],
    adhkar_evening: ['Evening adhkar', "Whenever you're ready, bismillah."],
    quran: ['Quran portion', 'Your Quran portion for today.'],
    reflection: ['A moment to reflect', "A moment to look back on your day, if you'd like."],
    weekly_review: ['Your week at a glance', 'Your week in review is ready.'],
  },
};

const PATHS: Record<Category, string> = {
  prayer: '/app/today',
  adhkar_morning: '/app/today',
  adhkar_evening: '/app/today',
  quran: '/app/today',
  reflection: '/app/reflection',
  weekly_review: '/app/reports',
  custom: '/app/today',
};

export interface RenderedNotification {
  title: string;
  body: string;
  url: string;
  snoozeLabel: string;
}

export function render(
  category: Category,
  params: Record<string, string>,
  locale: Locale,
  customTitle: string | null,
): RenderedNotification {
  const snoozeLabel = locale === 'ar' ? 'ذَكِّرْنِي بَعْدَ ١٠ دَقَائِق' : 'Remind me in 10 min';
  const url = `/${locale}${PATHS[category]}`;
  if (category === 'prayer') {
    const name = PRAYERS[locale][params.prayer ?? ''] ?? '';
    const offset = Number(params.offsetMin ?? 0);
    const body =
      locale === 'ar'
        ? offset === 0
          ? `حَانَ وَقْتُ صَلَاةِ ${name}.`
          : `تَذْكِيرٌ بِصَلَاةِ ${name}.`
        : offset === 0
          ? `${name} time has begun.`
          : `A reminder for ${name}.`;
    return { title: name, body, url, snoozeLabel };
  }
  if (category === 'custom') {
    return {
      title: customTitle ?? (locale === 'ar' ? 'تَذْكِرَة' : 'Tadhkirah'),
      body: locale === 'ar' ? 'تَذْكِيرُكَ الْخَاصّ.' : 'Your reminder.',
      url,
      snoozeLabel,
    };
  }
  const [title, body] = TEXT[locale][category];
  return { title, body, url, snoozeLabel };
}

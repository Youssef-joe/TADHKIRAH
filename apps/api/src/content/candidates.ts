/**
 * Research leads from docs/07-content-candidates.md, gathered by AI.
 * UNVERIFIED: references (source, number, narrator) plus the Arabic text copied
 * verbatim from an open dataset (candidate-texts.ts). AI writes no hadith text,
 * no grading, and no description: grades and descriptions are left for a person.
 * They become drafts that a person must check against the primary source and
 * take through the full review workflow (policy §7.6–7.7, CON-11).
 */
import type { z } from 'zod';
import type { OccasionWindowSchema, SunnahTriggerSchema } from '@tadhkirah/contracts';
export interface CandidateLead {
  source: 'bukhari' | 'muslim' | 'abudawud' | 'tirmidhi' | 'nasai' | 'ibnmajah';
  number: string;
  narrator: { ar: string; en: string };
  note: string;
}

const ABU_HURAYRAH = { ar: 'أبو هريرة', en: 'Abu Hurayrah' };
const ABU_MUSA = { ar: 'أبو موسى الأشعري', en: "Abu Musa al-Ash'ari" };
const JABIR = { ar: 'جابر بن عبد الله', en: "Jabir ibn 'Abdillah" };
const ANAS = { ar: 'أنس بن مالك', en: 'Anas ibn Malik' };
const HUDHAYFAH = { ar: 'حذيفة بن اليمان', en: 'Hudhayfah ibn al-Yaman' };
const ABU_QATADAH = { ar: 'أبو قتادة', en: 'Abu Qatadah' };
const BARA = { ar: 'البراء بن عازب', en: "al-Bara' ibn 'Azib" };
const UMAR_IBN_ABI_SALAMAH = { ar: 'عمر بن أبي سلمة', en: "'Umar ibn Abi Salamah" };
const IBN_UMAR = { ar: 'عبد الله بن عمر', en: "'Abdullah ibn 'Umar" };

export const CANDIDATE_LEADS: readonly CandidateLead[] = [
  {
    source: 'bukhari',
    number: '935',
    narrator: ABU_HURAYRAH,
    note: 'Occasion: an hour of response on Friday (existence of the hour; does not fix its timing).',
  },
  {
    source: 'muslim',
    number: '852',
    narrator: ABU_HURAYRAH,
    note: 'Occasion: an hour of response on Friday (existence of the hour).',
  },
  {
    source: 'muslim',
    number: '853',
    narrator: ABU_MUSA,
    note: "Occasion: from the Imam sitting until the prayer ends. Some scholars discussed whether parts are mawquf (e.g. al-Daraqutni's criticism): record the difference.",
  },
  {
    source: 'abudawud',
    number: '1048',
    narrator: JABIR,
    note: 'Occasion: the last hour after Asr on Friday. Check the grading (al-Albani: sahih in Sahih Abi Dawud, verify). Timing is one of the views: scholarly_interpretation.',
  },
  {
    source: 'nasai',
    number: '1389',
    narrator: JABIR,
    note: 'Occasion: the last hour after Asr on Friday. Check the grading.',
  },
  {
    source: 'muslim',
    number: '482',
    narrator: ABU_HURAYRAH,
    note: 'Occasion: during prostration (sujud). Not schedulable: guidance only.',
  },
  {
    source: 'bukhari',
    number: '1145',
    narrator: ABU_HURAYRAH,
    note: 'Occasion: the last third of the night. Document how "night" is measured (Maghrib to Fajr by default).',
  },
  {
    source: 'muslim',
    number: '758',
    narrator: ABU_HURAYRAH,
    note: 'Occasion: the last third of the night.',
  },
  {
    source: 'abudawud',
    number: '521',
    narrator: ANAS,
    note: 'Occasion: between the adhan and the iqamah. Check the grading (al-Albani: sahih, verify).',
  },
  {
    source: 'tirmidhi',
    number: '212',
    narrator: ANAS,
    note: "Occasion: between the adhan and the iqamah. Check the grading and al-Tirmidhi's own remark.",
  },
  {
    source: 'bukhari',
    number: '245',
    narrator: HUDHAYFAH,
    note: 'Sunnah: siwak when getting up at night. Check the wording; do not generalise beyond the text without a scholarly note.',
  },
  {
    source: 'muslim',
    number: '255',
    narrator: HUDHAYFAH,
    note: 'Sunnah: siwak when getting up at night.',
  },
  {
    source: 'bukhari',
    number: '444',
    narrator: ABU_QATADAH,
    note: 'Sunnah: two rak`ahs on entering the mosque. Fiqh differences about prohibited times: record a difference.',
  },
  {
    source: 'muslim',
    number: '714',
    narrator: ABU_QATADAH,
    note: 'Sunnah: two rak`ahs on entering the mosque.',
  },
  {
    source: 'bukhari',
    number: '247',
    narrator: BARA,
    note: 'Sunnah: wudu before sleep, lying on the right side, with the reported dua.',
  },
  {
    source: 'muslim',
    number: '2710',
    narrator: BARA,
    note: 'Sunnah: wudu before sleep, with the reported dua.',
  },
  {
    source: 'bukhari',
    number: '5376',
    narrator: UMAR_IBN_ABI_SALAMAH,
    note: 'Sunnah: saying Bismillah, eating with the right hand, eating from what is near you.',
  },
  {
    source: 'muslim',
    number: '2022',
    narrator: UMAR_IBN_ABI_SALAMAH,
    note: 'Sunnah: manners of eating.',
  },
  {
    source: 'bukhari',
    number: '877',
    narrator: IBN_UMAR,
    note: 'Sunnah: ghusl for Jumuah. Difference on whether it is obligatory or recommended: record a difference.',
  },
  { source: 'muslim', number: '844', narrator: IBN_UMAR, note: 'Sunnah: ghusl for Jumuah.' },
];

/** `source:number` of a lead, the key into CANDIDATE_TEXTS. */
export type LeadRef = `${CandidateLead['source']}:${string}`;

/**
 * Draft Sunnahs and occasions grouping the leads above. Titles are working labels for
 * the reviewer to edit; descriptions stay empty, so nothing can be submitted until a
 * person writes them.
 */
export interface CandidateSunnah {
  slug: string;
  titleAr: string;
  titleEn: string;
  trigger: z.infer<typeof SunnahTriggerSchema>;
  hadiths: LeadRef[];
}
export interface CandidateOccasion {
  slug: string;
  titleAr: string;
  titleEn: string;
  window: z.infer<typeof OccasionWindowSchema>;
  evidenceType: 'explicit_text' | 'scholarly_interpretation';
  schedulable: boolean;
  hadiths: LeadRef[];
}

export const CANDIDATE_SUNNAHS: readonly CandidateSunnah[] = [
  {
    slug: 'siwak-on-rising-at-night',
    titleAr: 'السِّوَاكُ عِنْدَ الْقِيَامِ مِنَ اللَّيْلِ',
    titleEn: 'Siwak when rising at night',
    trigger: 'on_waking',
    hadiths: ['bukhari:245', 'muslim:255'],
  },
  {
    slug: 'two-rakahs-entering-mosque',
    titleAr: 'رَكْعَتَانِ عِنْدَ دُخُولِ الْمَسْجِدِ',
    titleEn: 'Two rakʿahs on entering the mosque',
    trigger: 'entering_mosque',
    hadiths: ['bukhari:444', 'muslim:714'],
  },
  {
    slug: 'wudu-before-sleep',
    titleAr: 'الْوُضُوءُ قَبْلَ النَّوْمِ وَالِاضْطِجَاعُ عَلَى الشِّقِّ الْأَيْمَنِ',
    titleEn: 'Wudu before sleep and lying on the right side',
    trigger: 'before_sleep',
    hadiths: ['bukhari:247', 'muslim:2710'],
  },
  {
    slug: 'manners-of-eating',
    titleAr: 'التَّسْمِيَةُ وَالْأَكْلُ بِالْيَمِينِ وَمِمَّا يَلِيكَ',
    titleEn: 'Bismillah, eating with the right hand, from what is near you',
    trigger: 'eating',
    hadiths: ['bukhari:5376', 'muslim:2022'],
  },
  {
    slug: 'ghusl-for-jumuah',
    titleAr: 'غُسْلُ الْجُمُعَةِ',
    titleEn: 'Ghusl for Jumuʿah',
    trigger: 'friday',
    hadiths: ['bukhari:877', 'muslim:844'],
  },
];

export const CANDIDATE_OCCASIONS: readonly CandidateOccasion[] = [
  {
    slug: 'jumuah-imam-to-prayer',
    titleAr: 'يَوْمَ الْجُمُعَةِ: مِنْ جُلُوسِ الْإِمَامِ إِلَى أَنْ تُقْضَى الصَّلَاةُ',
    titleEn: 'Friday: from the Imam sitting until the prayer ends',
    window: 'jumuah_imam_to_prayer',
    evidenceType: 'explicit_text',
    schedulable: true,
    hadiths: ['muslim:853', 'bukhari:935', 'muslim:852'],
  },
  {
    slug: 'friday-last-hour-after-asr',
    titleAr: 'يَوْمَ الْجُمُعَةِ: آخِرُ سَاعَةٍ بَعْدَ الْعَصْرِ',
    titleEn: 'Friday: the last hour after ʿAsr',
    window: 'friday_last_hour_after_asr',
    evidenceType: 'scholarly_interpretation',
    schedulable: true,
    hadiths: ['abudawud:1048', 'nasai:1389', 'bukhari:935'],
  },
  {
    slug: 'last-third-of-night',
    titleAr: 'الثُّلُثُ الْأَخِيرُ مِنَ اللَّيْلِ',
    titleEn: 'The last third of the night',
    window: 'last_third_of_night',
    evidenceType: 'explicit_text',
    schedulable: true,
    hadiths: ['bukhari:1145', 'muslim:758'],
  },
  {
    slug: 'between-adhan-and-iqamah',
    titleAr: 'بَيْنَ الْأَذَانِ وَالْإِقَامَةِ',
    titleEn: 'Between the adhan and the iqamah',
    window: 'between_adhan_iqamah',
    evidenceType: 'explicit_text',
    schedulable: true,
    hadiths: ['abudawud:521', 'tirmidhi:212'],
  },
  {
    slug: 'in-sujud',
    titleAr: 'فِي السُّجُودِ',
    titleEn: 'During prostration',
    window: 'in_sujud',
    evidenceType: 'explicit_text',
    schedulable: false,
    hadiths: ['muslim:482'],
  },
];

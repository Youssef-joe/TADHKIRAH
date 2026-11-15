/**
 * Research leads from docs/07-content-candidates.md, gathered by AI.
 * UNVERIFIED: references only (source, number, narrator), never hadith text.
 * They become drafts that a person must complete from the primary source and
 * take through the full review workflow (policy §7.6–7.7, CON-11).
 */
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

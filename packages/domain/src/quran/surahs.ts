/**
 * Quran structure (Hafs ʿan ʿĀṣim): the 114 surahs with their ayah counts, and
 * the start of each of the 30 ajzāʾ. This is reference metadata only: the
 * product doesn't display Quran text (PRD QUR-6). A unit test checks the
 * total is 6,236 ayahs.
 */
export interface Surah {
  n: number;
  ar: string;
  en: string;
  ayahs: number;
}

// prettier-ignore
const DATA: [string, string, number][] = [
  ['الْفَاتِحَة', 'Al-Fatihah', 7], ['الْبَقَرَة', 'Al-Baqarah', 286], ['آلِ عِمْرَان', "Al 'Imran", 200],
  ['النِّسَاء', "An-Nisa'", 176], ['الْمَائِدَة', "Al-Ma'idah", 120], ['الْأَنْعَام', "Al-An'am", 165],
  ['الْأَعْرَاف', "Al-A'raf", 206], ['الْأَنْفَال', 'Al-Anfal', 75], ['التَّوْبَة', 'At-Tawbah', 129],
  ['يُونُس', 'Yunus', 109], ['هُود', 'Hud', 123], ['يُوسُف', 'Yusuf', 111],
  ['الرَّعْد', "Ar-Ra'd", 43], ['إِبْرَاهِيم', 'Ibrahim', 52], ['الْحِجْر', 'Al-Hijr', 99],
  ['النَّحْل', 'An-Nahl', 128], ['الْإِسْرَاء', "Al-Isra'", 111], ['الْكَهْف', 'Al-Kahf', 110],
  ['مَرْيَم', 'Maryam', 98], ['طه', 'Ta-Ha', 135], ['الْأَنْبِيَاء', "Al-Anbiya'", 112],
  ['الْحَجّ', 'Al-Hajj', 78], ['الْمُؤْمِنُون', "Al-Mu'minun", 118], ['النُّور', 'An-Nur', 64],
  ['الْفُرْقَان', 'Al-Furqan', 77], ['الشُّعَرَاء', "Ash-Shu'ara'", 227], ['النَّمْل', 'An-Naml', 93],
  ['الْقَصَص', 'Al-Qasas', 88], ['الْعَنْكَبُوت', "Al-'Ankabut", 69], ['الرُّوم', 'Ar-Rum', 60],
  ['لُقْمَان', 'Luqman', 34], ['السَّجْدَة', 'As-Sajdah', 30], ['الْأَحْزَاب', 'Al-Ahzab', 73],
  ['سَبَأ', "Saba'", 54], ['فَاطِر', 'Fatir', 45], ['يس', 'Ya-Sin', 83],
  ['الصَّافَّات', 'As-Saffat', 182], ['ص', 'Sad', 88], ['الزُّمَر', 'Az-Zumar', 75],
  ['غَافِر', 'Ghafir', 85], ['فُصِّلَت', 'Fussilat', 54], ['الشُّورَى', 'Ash-Shura', 53],
  ['الزُّخْرُف', 'Az-Zukhruf', 89], ['الدُّخَان', 'Ad-Dukhan', 59], ['الْجَاثِيَة', 'Al-Jathiyah', 37],
  ['الْأَحْقَاف', 'Al-Ahqaf', 35], ['مُحَمَّد', 'Muhammad', 38], ['الْفَتْح', 'Al-Fath', 29],
  ['الْحُجُرَات', 'Al-Hujurat', 18], ['ق', 'Qaf', 45], ['الذَّارِيَات', 'Adh-Dhariyat', 60],
  ['الطُّور', 'At-Tur', 49], ['النَّجْم', 'An-Najm', 62], ['الْقَمَر', 'Al-Qamar', 55],
  ['الرَّحْمَن', 'Ar-Rahman', 78], ['الْوَاقِعَة', "Al-Waqi'ah", 96], ['الْحَدِيد', 'Al-Hadid', 29],
  ['الْمُجَادِلَة', 'Al-Mujadilah', 22], ['الْحَشْر', 'Al-Hashr', 24], ['الْمُمْتَحَنَة', 'Al-Mumtahanah', 13],
  ['الصَّفّ', 'As-Saff', 14], ['الْجُمُعَة', "Al-Jumu'ah", 11], ['الْمُنَافِقُون', 'Al-Munafiqun', 11],
  ['التَّغَابُن', 'At-Taghabun', 18], ['الطَّلَاق', 'At-Talaq', 12], ['التَّحْرِيم', 'At-Tahrim', 12],
  ['الْمُلْك', 'Al-Mulk', 30], ['الْقَلَم', 'Al-Qalam', 52], ['الْحَاقَّة', 'Al-Haqqah', 52],
  ['الْمَعَارِج', "Al-Ma'arij", 44], ['نُوح', 'Nuh', 28], ['الْجِنّ', 'Al-Jinn', 28],
  ['الْمُزَّمِّل', 'Al-Muzzammil', 20], ['الْمُدَّثِّر', 'Al-Muddaththir', 56], ['الْقِيَامَة', 'Al-Qiyamah', 40],
  ['الْإِنْسَان', 'Al-Insan', 31], ['الْمُرْسَلَات', 'Al-Mursalat', 50], ['النَّبَأ', "An-Naba'", 40],
  ['النَّازِعَات', "An-Nazi'at", 46], ['عَبَسَ', "'Abasa", 42], ['التَّكْوِير', 'At-Takwir', 29],
  ['الِانْفِطَار', 'Al-Infitar', 19], ['الْمُطَفِّفِين', 'Al-Mutaffifin', 36], ['الِانْشِقَاق', 'Al-Inshiqaq', 25],
  ['الْبُرُوج', 'Al-Buruj', 22], ['الطَّارِق', 'At-Tariq', 17], ['الْأَعْلَى', "Al-A'la", 19],
  ['الْغَاشِيَة', 'Al-Ghashiyah', 26], ['الْفَجْر', 'Al-Fajr', 30], ['الْبَلَد', 'Al-Balad', 20],
  ['الشَّمْس', 'Ash-Shams', 15], ['اللَّيْل', 'Al-Layl', 21], ['الضُّحَى', 'Ad-Duha', 11],
  ['الشَّرْح', 'Ash-Sharh', 8], ['التِّين', 'At-Tin', 8], ['الْعَلَق', "Al-'Alaq", 19],
  ['الْقَدْر', 'Al-Qadr', 5], ['الْبَيِّنَة', 'Al-Bayyinah', 8], ['الزَّلْزَلَة', 'Az-Zalzalah', 8],
  ['الْعَادِيَات', "Al-'Adiyat", 11], ['الْقَارِعَة', "Al-Qari'ah", 11], ['التَّكَاثُر', 'At-Takathur', 8],
  ['الْعَصْر', "Al-'Asr", 3], ['الْهُمَزَة', 'Al-Humazah', 9], ['الْفِيل', 'Al-Fil', 5],
  ['قُرَيْش', 'Quraysh', 4], ['الْمَاعُون', "Al-Ma'un", 7], ['الْكَوْثَر', 'Al-Kawthar', 3],
  ['الْكَافِرُون', 'Al-Kafirun', 6], ['النَّصْر', 'An-Nasr', 3], ['الْمَسَد', 'Al-Masad', 5],
  ['الْإِخْلَاص', 'Al-Ikhlas', 4], ['الْفَلَق', 'Al-Falaq', 5], ['النَّاس', 'An-Nas', 6],
];

export const SURAHS: readonly Surah[] = DATA.map(([ar, en, ayahs], i) => ({
  n: i + 1,
  ar,
  en,
  ayahs,
}));
export const TOTAL_AYAHS = 6236;

/** Where each juz starts, as [surah, ayah]. Index 0 = juz 1. */
// prettier-ignore
export const JUZ_STARTS: readonly [number, number][] = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

export function surah(n: number): Surah {
  const s = SURAHS[n - 1];
  if (!s) throw new RangeError(`No surah ${n}`);
  return s;
}

/** The juz (1–30) that contains surah:ayah. */
export function juzOf(surahN: number, ayah = 1): number {
  let juz = 1;
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    const [s, a] = JUZ_STARTS[i]!;
    if (surahN > s || (surahN === s && ayah >= a)) juz = i + 1;
    else break;
  }
  return juz;
}

export interface AyahRef {
  surah: number;
  ayah: number;
}

export function isValidRef(r: AyahRef): boolean {
  return (
    Number.isInteger(r.surah) &&
    r.surah >= 1 &&
    r.surah <= 114 &&
    Number.isInteger(r.ayah) &&
    r.ayah >= 1 &&
    r.ayah <= surah(r.surah).ayahs
  );
}

/** Whether `from` comes no later than `to` in mushaf order. */
export function isOrdered(from: AyahRef, to: AyahRef): boolean {
  return from.surah < to.surah || (from.surah === to.surah && from.ayah <= to.ayah);
}

/** Number of ayahs from `from` to `to` inclusive, across surahs. */
export function ayahsBetween(from: AyahRef, to: AyahRef): number {
  if (!isOrdered(from, to)) return 0;
  if (from.surah === to.surah) return to.ayah - from.ayah + 1;
  let total = surah(from.surah).ayahs - from.ayah + 1;
  for (let s = from.surah + 1; s < to.surah; s++) total += surah(s).ayahs;
  return total + to.ayah;
}

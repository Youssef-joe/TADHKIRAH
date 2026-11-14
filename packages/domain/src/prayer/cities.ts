/**
 * Built-in city list for onboarding. It ships with the app, so choosing a city
 * never sends the user's search to a geocoding service (privacy first, works
 * offline). Coordinates are city centres to 2 decimals (~1 km), which is plenty
 * for prayer times. Middle East first (ADR-002), plus major cities elsewhere.
 * Users anywhere can still use device location or enter coordinates.
 */
export interface City {
  id: string;
  nameAr: string;
  nameEn: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

type Row = [id: string, ar: string, en: string, cc: string, lat: number, lng: number, tz: string];

// prettier-ignore
const ROWS: Row[] = [
  // Saudi Arabia
  ['makkah', 'مكة المكرمة', 'Makkah', 'SA', 21.42, 39.83, 'Asia/Riyadh'],
  ['madinah', 'المدينة المنورة', 'Madinah', 'SA', 24.47, 39.61, 'Asia/Riyadh'],
  ['riyadh', 'الرياض', 'Riyadh', 'SA', 24.71, 46.68, 'Asia/Riyadh'],
  ['jeddah', 'جدة', 'Jeddah', 'SA', 21.49, 39.19, 'Asia/Riyadh'],
  ['dammam', 'الدمام', 'Dammam', 'SA', 26.43, 50.10, 'Asia/Riyadh'],
  ['khobar', 'الخبر', 'Khobar', 'SA', 26.28, 50.21, 'Asia/Riyadh'],
  ['hofuf', 'الأحساء', 'Al-Ahsa', 'SA', 25.38, 49.59, 'Asia/Riyadh'],
  ['taif', 'الطائف', 'Taif', 'SA', 21.27, 40.42, 'Asia/Riyadh'],
  ['tabuk', 'تبوك', 'Tabuk', 'SA', 28.38, 36.57, 'Asia/Riyadh'],
  ['abha', 'أبها', 'Abha', 'SA', 18.22, 42.51, 'Asia/Riyadh'],
  ['khamis-mushait', 'خميس مشيط', 'Khamis Mushait', 'SA', 18.31, 42.73, 'Asia/Riyadh'],
  ['buraidah', 'بريدة', 'Buraidah', 'SA', 26.33, 43.97, 'Asia/Riyadh'],
  ['hail', 'حائل', 'Hail', 'SA', 27.52, 41.69, 'Asia/Riyadh'],
  ['jazan', 'جازان', 'Jazan', 'SA', 16.89, 42.55, 'Asia/Riyadh'],
  ['najran', 'نجران', 'Najran', 'SA', 17.49, 44.13, 'Asia/Riyadh'],
  ['yanbu', 'ينبع', 'Yanbu', 'SA', 24.09, 38.06, 'Asia/Riyadh'],
  // UAE
  ['dubai', 'دبي', 'Dubai', 'AE', 25.20, 55.27, 'Asia/Dubai'],
  ['abu-dhabi', 'أبوظبي', 'Abu Dhabi', 'AE', 24.45, 54.38, 'Asia/Dubai'],
  ['sharjah', 'الشارقة', 'Sharjah', 'AE', 25.35, 55.39, 'Asia/Dubai'],
  ['ajman', 'عجمان', 'Ajman', 'AE', 25.41, 55.45, 'Asia/Dubai'],
  ['al-ain', 'العين', 'Al Ain', 'AE', 24.21, 55.74, 'Asia/Dubai'],
  ['ras-al-khaimah', 'رأس الخيمة', 'Ras Al Khaimah', 'AE', 25.79, 55.94, 'Asia/Dubai'],
  ['fujairah', 'الفجيرة', 'Fujairah', 'AE', 25.13, 56.33, 'Asia/Dubai'],
  // Gulf
  ['doha', 'الدوحة', 'Doha', 'QA', 25.29, 51.53, 'Asia/Qatar'],
  ['kuwait-city', 'مدينة الكويت', 'Kuwait City', 'KW', 29.38, 47.99, 'Asia/Kuwait'],
  ['manama', 'المنامة', 'Manama', 'BH', 26.23, 50.59, 'Asia/Bahrain'],
  ['muscat', 'مسقط', 'Muscat', 'OM', 23.59, 58.41, 'Asia/Muscat'],
  ['salalah', 'صلالة', 'Salalah', 'OM', 17.02, 54.09, 'Asia/Muscat'],
  ['sohar', 'صحار', 'Sohar', 'OM', 24.35, 56.71, 'Asia/Muscat'],
  // Yemen
  ['sanaa', 'صنعاء', "Sana'a", 'YE', 15.37, 44.19, 'Asia/Aden'],
  ['aden', 'عدن', 'Aden', 'YE', 12.79, 45.03, 'Asia/Aden'],
  // Egypt
  ['cairo', 'القاهرة', 'Cairo', 'EG', 30.04, 31.24, 'Africa/Cairo'],
  ['giza', 'الجيزة', 'Giza', 'EG', 30.01, 31.21, 'Africa/Cairo'],
  ['alexandria', 'الإسكندرية', 'Alexandria', 'EG', 31.20, 29.92, 'Africa/Cairo'],
  ['mansoura', 'المنصورة', 'Mansoura', 'EG', 31.04, 31.38, 'Africa/Cairo'],
  ['tanta', 'طنطا', 'Tanta', 'EG', 30.79, 31.00, 'Africa/Cairo'],
  ['port-said', 'بورسعيد', 'Port Said', 'EG', 31.27, 32.30, 'Africa/Cairo'],
  ['suez', 'السويس', 'Suez', 'EG', 29.97, 32.55, 'Africa/Cairo'],
  ['asyut', 'أسيوط', 'Asyut', 'EG', 27.18, 31.18, 'Africa/Cairo'],
  ['luxor', 'الأقصر', 'Luxor', 'EG', 25.69, 32.64, 'Africa/Cairo'],
  ['aswan', 'أسوان', 'Aswan', 'EG', 24.09, 32.90, 'Africa/Cairo'],
  // Levant
  ['amman', 'عمّان', 'Amman', 'JO', 31.95, 35.93, 'Asia/Amman'],
  ['irbid', 'إربد', 'Irbid', 'JO', 32.56, 35.85, 'Asia/Amman'],
  ['zarqa', 'الزرقاء', 'Zarqa', 'JO', 32.07, 36.09, 'Asia/Amman'],
  ['aqaba', 'العقبة', 'Aqaba', 'JO', 29.53, 35.01, 'Asia/Amman'],
  ['al-quds', 'القدس', 'Al-Quds (Jerusalem)', 'PS', 31.78, 35.23, 'Asia/Hebron'],
  ['gaza', 'غزة', 'Gaza', 'PS', 31.50, 34.47, 'Asia/Gaza'],
  ['nablus', 'نابلس', 'Nablus', 'PS', 32.22, 35.26, 'Asia/Hebron'],
  ['al-khalil', 'الخليل', 'Hebron (Al-Khalil)', 'PS', 31.53, 35.10, 'Asia/Hebron'],
  ['beirut', 'بيروت', 'Beirut', 'LB', 33.89, 35.50, 'Asia/Beirut'],
  ['tripoli-lb', 'طرابلس (لبنان)', 'Tripoli (Lebanon)', 'LB', 34.44, 35.85, 'Asia/Beirut'],
  ['damascus', 'دمشق', 'Damascus', 'SY', 33.51, 36.29, 'Asia/Damascus'],
  ['aleppo', 'حلب', 'Aleppo', 'SY', 36.20, 37.13, 'Asia/Damascus'],
  ['homs', 'حمص', 'Homs', 'SY', 34.73, 36.71, 'Asia/Damascus'],
  // Iraq
  ['baghdad', 'بغداد', 'Baghdad', 'IQ', 33.32, 44.37, 'Asia/Baghdad'],
  ['basra', 'البصرة', 'Basra', 'IQ', 30.51, 47.81, 'Asia/Baghdad'],
  ['mosul', 'الموصل', 'Mosul', 'IQ', 36.34, 43.13, 'Asia/Baghdad'],
  ['erbil', 'أربيل', 'Erbil', 'IQ', 36.19, 44.01, 'Asia/Baghdad'],
  ['najaf', 'النجف', 'Najaf', 'IQ', 32.03, 44.35, 'Asia/Baghdad'],
  // North Africa & Sudan
  ['khartoum', 'الخرطوم', 'Khartoum', 'SD', 15.50, 32.56, 'Africa/Khartoum'],
  ['tripoli-ly', 'طرابلس (ليبيا)', 'Tripoli (Libya)', 'LY', 32.89, 13.19, 'Africa/Tripoli'],
  ['benghazi', 'بنغازي', 'Benghazi', 'LY', 32.12, 20.09, 'Africa/Tripoli'],
  ['tunis', 'تونس', 'Tunis', 'TN', 36.81, 10.18, 'Africa/Tunis'],
  ['algiers', 'الجزائر', 'Algiers', 'DZ', 36.75, 3.06, 'Africa/Algiers'],
  ['oran', 'وهران', 'Oran', 'DZ', 35.70, -0.63, 'Africa/Algiers'],
  ['rabat', 'الرباط', 'Rabat', 'MA', 34.02, -6.83, 'Africa/Casablanca'],
  ['casablanca', 'الدار البيضاء', 'Casablanca', 'MA', 33.57, -7.59, 'Africa/Casablanca'],
  ['marrakesh', 'مراكش', 'Marrakesh', 'MA', 31.63, -8.01, 'Africa/Casablanca'],
  ['fes', 'فاس', 'Fes', 'MA', 34.03, -5.00, 'Africa/Casablanca'],
  ['nouakchott', 'نواكشوط', 'Nouakchott', 'MR', 18.09, -15.98, 'Africa/Nouakchott'],
  // Wider Muslim world
  ['istanbul', 'إسطنبول', 'Istanbul', 'TR', 41.01, 28.98, 'Europe/Istanbul'],
  ['ankara', 'أنقرة', 'Ankara', 'TR', 39.93, 32.86, 'Europe/Istanbul'],
  ['karachi', 'كراتشي', 'Karachi', 'PK', 24.86, 67.01, 'Asia/Karachi'],
  ['lahore', 'لاهور', 'Lahore', 'PK', 31.55, 74.34, 'Asia/Karachi'],
  ['islamabad', 'إسلام آباد', 'Islamabad', 'PK', 33.68, 73.05, 'Asia/Karachi'],
  ['kuala-lumpur', 'كوالالمبور', 'Kuala Lumpur', 'MY', 3.14, 101.69, 'Asia/Kuala_Lumpur'],
  ['jakarta', 'جاكرتا', 'Jakarta', 'ID', -6.21, 106.85, 'Asia/Jakarta'],
  ['singapore', 'سنغافورة', 'Singapore', 'SG', 1.35, 103.82, 'Asia/Singapore'],
  // Europe & North America
  ['london', 'لندن', 'London', 'GB', 51.51, -0.13, 'Europe/London'],
  ['birmingham', 'برمنغهام', 'Birmingham', 'GB', 52.49, -1.89, 'Europe/London'],
  ['manchester', 'مانشستر', 'Manchester', 'GB', 53.48, -2.24, 'Europe/London'],
  ['paris', 'باريس', 'Paris', 'FR', 48.86, 2.35, 'Europe/Paris'],
  ['berlin', 'برلين', 'Berlin', 'DE', 52.52, 13.40, 'Europe/Berlin'],
  ['new-york', 'نيويورك', 'New York', 'US', 40.71, -74.01, 'America/New_York'],
  ['chicago', 'شيكاغو', 'Chicago', 'US', 41.88, -87.63, 'America/Chicago'],
  ['houston', 'هيوستن', 'Houston', 'US', 29.76, -95.37, 'America/Chicago'],
  ['los-angeles', 'لوس أنجلوس', 'Los Angeles', 'US', 34.05, -118.24, 'America/Los_Angeles'],
  ['toronto', 'تورونتو', 'Toronto', 'CA', 43.65, -79.38, 'America/Toronto'],
];

export const CITIES: readonly City[] = ROWS.map(
  ([id, nameAr, nameEn, countryCode, latitude, longitude, timeZone]) => ({
    id,
    nameAr,
    nameEn,
    countryCode,
    latitude,
    longitude,
    timeZone,
  }),
);

/**
 * Normalizes Arabic for searching: strips diacritics and tatweel, and unifies
 * alef, yaa and taa marbuta forms, so "مكه" finds "مكة المكرمة".
 */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const INDEX = CITIES.map((c) => ({
  city: c,
  keys: [normalizeForSearch(c.nameAr), normalizeForSearch(c.nameEn), c.id.replace(/-/g, ' ')],
}));

export function searchCities(query: string, limit = 8): City[] {
  const q = normalizeForSearch(query);
  if (!q) return [];
  const starts: City[] = [];
  const contains: City[] = [];
  for (const { city, keys } of INDEX) {
    if (keys.some((k) => k.startsWith(q) || k.split(' ').some((w) => w.startsWith(q))))
      starts.push(city);
    else if (keys.some((k) => k.includes(q))) contains.push(city);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The closest built-in city (used only to label a device-location fix). */
export function nearestCity(
  latitude: number,
  longitude: number,
): { city: City; distanceKm: number } {
  let best = { city: CITIES[0]!, distanceKm: Infinity };
  for (const city of CITIES) {
    const d = distanceKm(latitude, longitude, city.latitude, city.longitude);
    if (d < best.distanceKm) best = { city, distanceKm: d };
  }
  return best;
}

/** Rounds a coordinate to 2 decimals (~1 km) before it leaves the device. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

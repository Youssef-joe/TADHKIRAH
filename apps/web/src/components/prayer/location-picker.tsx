'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { nearestCity, roundCoordinate, searchCities, type City } from '@tadhkirah/domain';
import { Icon } from '../ui/icons';
import { Button, Field, Input, Status } from '../ui/primitives';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  locationLabel: string;
  countryCode: string | null;
  timeZone: string;
}

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Three ways to choose where prayer times are calculated, all private: search
 * the built-in city list (no geocoding service), use the device's location
 * (rounded to ~1 km), or type coordinates.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation | null;
  onChange: (v: PickedLocation) => void;
}) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [manual, setManual] = useState(false);
  const [coords, setCoords] = useState({ lat: '', lng: '', name: '' });
  const results = useMemo(() => searchCities(query), [query]);
  const name = (c: City) => (locale === 'ar' ? c.nameAr : c.nameEn);

  function pickCity(c: City) {
    onChange({
      latitude: c.latitude,
      longitude: c.longitude,
      locationLabel: name(c),
      countryCode: c.countryCode,
      timeZone: c.timeZone,
    });
    setQuery('');
  }

  function useDevice() {
    if (!('geolocation' in navigator)) return setGeoError(true);
    setLocating(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = roundCoordinate(pos.coords.latitude);
        const longitude = roundCoordinate(pos.coords.longitude);
        const near = nearestCity(latitude, longitude);
        // Only trust the nearest city's country if it's actually close.
        const close = near.distanceKm < 150;
        onChange({
          latitude,
          longitude,
          locationLabel: close
            ? t('nearCity', { city: name(near.city) })
            : `${latitude}, ${longitude}`,
          countryCode: close ? near.city.countryCode : null,
          timeZone: deviceTimeZone(),
        });
        setLocating(false);
      },
      () => {
        setGeoError(true);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  }

  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  const coordsValid =
    coords.lat !== '' && coords.lng !== '' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  return (
    <div className="flex flex-col gap-4">
      {value && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <Icon name="pin" className="shrink-0 text-primary" />
          <div>
            <p className="text-sm text-muted">{t('selected')}</p>
            <p className="font-medium">{value.locationLabel}</p>
          </div>
        </div>
      )}

      <Field label={t('searchCity')} htmlFor="city-search">
        <Input
          id="city-search"
          type="search"
          autoComplete="off"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-controls="city-results"
        />
      </Field>
      {query && (
        <ul
          id="city-results"
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
        >
          {results.length === 0 && <li className="p-3 text-sm text-muted">{t('noResults')}</li>}
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => pickCity(c)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-bg focus-visible:bg-bg"
              >
                <span>{name(c)}</span>
                <span className="text-sm text-muted">{locale === 'ar' ? c.nameEn : c.nameAr}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="ghost" onClick={useDevice} disabled={locating}>
          <Icon name="locate" size={18} />
          {locating ? t('locating') : t('useMyLocation')}
        </Button>
        <Button
          type="button"
          variant="quiet"
          onClick={() => setManual((m) => !m)}
          aria-expanded={manual}
        >
          {t('manual')}
        </Button>
      </div>
      {geoError && <Status tone="error">{t('locationDenied')}</Status>}

      {manual && (
        <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
          <Field label={t('latitude')} htmlFor="lat">
            <Input
              id="lat"
              dir="ltr"
              inputMode="decimal"
              value={coords.lat}
              onChange={(e) => setCoords({ ...coords, lat: e.target.value })}
            />
          </Field>
          <Field label={t('longitude')} htmlFor="lng">
            <Input
              id="lng"
              dir="ltr"
              inputMode="decimal"
              value={coords.lng}
              onChange={(e) => setCoords({ ...coords, lng: e.target.value })}
            />
          </Field>
          <Field label={t('placeName')} htmlFor="place">
            <Input
              id="place"
              maxLength={80}
              value={coords.name}
              onChange={(e) => setCoords({ ...coords, name: e.target.value })}
            />
          </Field>
          <Button
            type="button"
            variant="ghost"
            className="sm:col-span-3"
            disabled={!coordsValid}
            onClick={() =>
              onChange({
                latitude: roundCoordinate(lat),
                longitude: roundCoordinate(lng),
                locationLabel:
                  coords.name.trim() || `${roundCoordinate(lat)}, ${roundCoordinate(lng)}`,
                countryCode: null,
                timeZone: deviceTimeZone(),
              })
            }
          >
            {t('useCoordinates')}
          </Button>
        </div>
      )}
    </div>
  );
}

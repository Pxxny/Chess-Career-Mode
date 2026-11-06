import { useEffect, useState } from 'react';
import type { City, Country } from '@/types';
import { logError } from '@/utils/log';
import { fallbackCities, loadCities } from './cityService';

export type CityStatus = 'idle' | 'loading' | 'dataset' | 'fallback';

/** Loads the searchable city list for the selected country. */
export function useCities(country: Country | null): { cities: City[]; status: CityStatus } {
  const [state, setState] = useState<{ cities: City[]; status: CityStatus }>({ cities: [], status: 'idle' });

  useEffect(() => {
    if (!country) {
      setState({ cities: [], status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ cities: fallbackCities(country), status: 'loading' });
    loadCities(country)
      .then((result) => {
        if (!cancelled) setState({ cities: result.cities, status: result.fromDataset ? 'dataset' : 'fallback' });
      })
      .catch((error: unknown) => {
        // Never leave the selector broken: fall back to the curated list (custom cities stay possible).
        logError('cities', `loading cities for "${country.code}" failed`, error);
        if (!cancelled) setState({ cities: fallbackCities(country), status: 'fallback' });
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  return state;
}

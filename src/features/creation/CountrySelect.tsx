import { useMemo, useState } from 'react';
import { SearchSelect, type SelectOption } from '@/components/ui';
import { COUNTRIES, getCountry, searchCountries } from '@/data/world/countries';
import type { Country } from '@/types';

const toOption = (c: Country): SelectOption => ({
  id: c.code,
  label: c.name,
  description: `${c.nationality} · ${c.continent}`,
  leading: c.flag,
});

export function CountrySelect({ value, onChange }: { value: Country | null; onChange: (country: Country) => void }) {
  const [query, setQuery] = useState('');
  const options = useMemo(() => searchCountries(query).map(toOption), [query]);

  return (
    <SearchSelect
      label="Nationality"
      placeholder={`Search ${COUNTRIES.length} countries and territories`}
      options={options}
      selected={value ? toOption(value) : null}
      onQueryChange={setQuery}
      onSelect={(option) => {
        const country = getCountry(option.id);
        if (country) onChange(country);
      }}
      emptyMessage="No country matches your search"
    />
  );
}

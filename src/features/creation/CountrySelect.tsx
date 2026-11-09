import { useMemo, useState } from "react";
import { SearchSelect, type SelectOption } from "@/components/ui";
import { COUNTRIES, getCountry, searchCountries } from "@/data/world/countries";
import type { Country } from "@/types";
import { logError } from "@/utils/log";

const toOption = (c: Country): SelectOption => ({
  id: c.code,
  label: c.name,
  description: `${c.nationality} · ${c.continent}`,
  leading: c.flag,
});

export function CountrySelect({
  value,
  onChange,
  label = "Nationality",
}: {
  value: Country | null;
  onChange: (country: Country) => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => searchCountries(query).map(toOption), [query]);

  return (
    <SearchSelect
      label={label}
      placeholder={`Search ${COUNTRIES.length} countries and territories`}
      options={options}
      selected={value ? toOption(value) : null}
      onQueryChange={setQuery}
      onSelect={(option) => {
        const country = getCountry(option.id);
        if (country) onChange(country);
        else
          logError(
            "nationality",
            `selected option "${option.id}" is not a known country code`,
          );
      }}
      emptyMessage="No country matches your search"
    />
  );
}

import { useMemo, useState } from "react";
import { SearchSelect, type SelectOption } from "@/components/ui";
import { COUNTRIES, getCountry, searchCountries } from "@/data/world/countries";
import type { Country } from "@/types";
import { logError } from "@/utils/log";
import { translateUI } from "@/i18n/translate";
import { normalizeText } from "@/utils/text";

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
  const options = useMemo(() => {
    const matches = searchCountries(query);
    const q = normalizeText(query);
    // Both languages work for searching, irrespective of the selected display language.
    const translated = q
      ? COUNTRIES.filter((c) =>
          normalizeText(
            `${translateUI(c.name, "th")} ${translateUI(c.nationality, "th")}`,
          ).includes(q),
        )
      : [];
    return [
      ...new Map([...matches, ...translated].map((c) => [c.code, c])).values(),
    ]
      .slice(0, 300)
      .map(toOption);
  }, [query]);

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

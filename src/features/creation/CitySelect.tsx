import { useMemo, useState } from "react";
import { SearchSelect, type SelectOption } from "@/components/ui";
import {
  getMajorCities,
  hasExactCity,
  searchCities,
} from "@/game/world/citySearch";
import { useCities } from "@/features/world/useCities";
import type { City, Country, PlayerCity } from "@/types";
import { formatNumber } from "@/utils/format";

const CUSTOM_PREFIX = "custom:";

const toOption = (c: City): SelectOption => ({
  id: `city:${c.name}`,
  label: c.name,
  originalLabel: true,
  description: c.isCapital
    ? "Capital"
    : c.population > 0
      ? `${formatNumber(c.population)} residents`
      : undefined,
});

interface CitySelectProps {
  country: Country | null;
  value: PlayerCity | null;
  onChange: (city: PlayerCity) => void;
}

export function CitySelect({ country, value, onChange }: CitySelectProps) {
  const { cities, status } = useCities(country);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const options = useMemo(() => {
    const found = trimmed
      ? searchCities(cities, trimmed)
      : getMajorCities(cities);
    const list = found.map(toOption);
    if (trimmed.length >= 2 && !hasExactCity(cities, trimmed)) {
      list.push({
        id: `${CUSTOM_PREFIX}${trimmed}`,
        label: `Use “${trimmed}”`,
        description: "Add as a custom city",
      });
    }
    return list;
  }, [cities, trimmed]);

  const hint =
    status === "fallback"
      ? "Showing major cities only. Type any other city to add it."
      : status === "dataset"
        ? `Search ${formatNumber(cities.length)} cities, or type a new one to add it.`
        : undefined;

  return (
    <SearchSelect
      label="City"
      placeholder={
        country
          ? `Search cities in ${country.name}`
          : "Choose a nationality first"
      }
      disabled={!country}
      loading={status === "loading"}
      virtualized
      options={options}
      selected={
        value
          ? {
              id: `city:${value.name}`,
              label: value.name,
              originalLabel: true,
              description: value.custom ? "Custom city" : undefined,
            }
          : null
      }
      listHeading={
        trimmed
          ? `${formatNumber(options.filter((o) => !o.id.startsWith(CUSTOM_PREFIX)).length)} matching cities`
          : `${formatNumber(cities.length)} cities · scroll to browse all`
      }
      onQueryChange={setQuery}
      onSelect={(option) =>
        onChange(
          option.id.startsWith(CUSTOM_PREFIX)
            ? { name: option.id.slice(CUSTOM_PREFIX.length), custom: true }
            : { name: option.label, custom: false },
        )
      }
      hint={hint}
    />
  );
}

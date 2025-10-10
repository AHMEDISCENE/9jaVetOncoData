import { useEffect, useMemo, useState } from "react";

export interface SharedDataFiltersState {
  myClinicOnly: boolean;
  zones: string[];
  states: string[];
  clinicIds: string[];
  species: string[];
  tumourTypeIds: string[];
  from?: string;
  to?: string;
}

type MultiFilterKey = keyof Pick<
  SharedDataFiltersState,
  "zones" | "states" | "clinicIds" | "species" | "tumourTypeIds"
>;

const DEFAULT_STATE: SharedDataFiltersState = {
  myClinicOnly: false,
  zones: [],
  states: [],
  clinicIds: [],
  species: [],
  tumourTypeIds: [],
  from: undefined,
  to: undefined,
};

function normalizeArrayParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

export function useSharedDataFilters(pathname: string, clinicId?: string | null) {
  const [filters, setFilters] = useState<SharedDataFiltersState>(DEFAULT_STATE);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;

    const params = new URLSearchParams(window.location.search);
    const initialMyClinicOnly = params.get("myClinicOnly") === "true";

    const initialFilters: SharedDataFiltersState = {
      myClinicOnly: initialMyClinicOnly,
      zones: normalizeArrayParam(params.getAll("zone")),
      states: normalizeArrayParam(params.getAll("state")),
      clinicIds: normalizeArrayParam(params.getAll("clinicId")),
      species: normalizeArrayParam(params.getAll("species")),
      tumourTypeIds: normalizeArrayParam(params.getAll("tumourTypeId")),
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    };

    if (initialMyClinicOnly && clinicId) {
      initialFilters.clinicIds = [clinicId];
    }

    setFilters(initialFilters);
    setInitialized(true);
  }, [initialized, clinicId]);

  useEffect(() => {
    if (!initialized) return;

    const params = new URLSearchParams();

    if (filters.myClinicOnly) {
      params.set("myClinicOnly", "true");
    }

    const clinicFilters = filters.myClinicOnly
      ? clinicId
        ? [clinicId]
        : []
      : filters.clinicIds;

    filters.zones.forEach((zone) => params.append("zone", zone));
    filters.states.forEach((state) => params.append("state", state));
    clinicFilters.forEach((id) => params.append("clinicId", id));
    filters.species.forEach((value) => params.append("species", value));
    filters.tumourTypeIds.forEach((value) => params.append("tumourTypeId", value));

    if (filters.from) {
      params.set("from", filters.from);
    }
    if (filters.to) {
      params.set("to", filters.to);
    }

    const search = params.toString();
    const targetUrl = `${pathname}${search ? `?${search}` : ""}`;

    if (`${window.location.pathname}${window.location.search}` !== targetUrl) {
      window.history.replaceState({}, "", targetUrl);
    }
  }, [filters, pathname, clinicId, initialized]);

  useEffect(() => {
    if (!initialized) return;
    if (!filters.myClinicOnly) return;

    const expected = clinicId ? [clinicId] : [];
    const matches =
      expected.length === filters.clinicIds.length &&
      expected.every((value, index) => filters.clinicIds[index] === value);

    if (!matches) {
      setFilters((prev) => ({
        ...prev,
        clinicIds: expected,
      }));
    }
  }, [clinicId, initialized, filters.myClinicOnly, filters.clinicIds]);

  const setMultiFilter = (key: MultiFilterKey, values: string[]) => {
    setFilters((prev) => ({
      ...prev,
      myClinicOnly: key === "clinicIds" ? false : prev.myClinicOnly,
      [key]: values,
    }));
  };

  const setDateRange = (from?: string, to?: string) => {
    setFilters((prev) => ({
      ...prev,
      from: from || undefined,
      to: to || undefined,
    }));
  };

  const toggleMyClinicOnly = (value: boolean) => {
    setFilters((prev) => ({
      ...prev,
      myClinicOnly: value,
      clinicIds: value ? (clinicId ? [clinicId] : []) : prev.clinicIds.filter((id) => id !== clinicId),
    }));
  };

  const resetFilters = () => {
    setFilters({
      ...DEFAULT_STATE,
      myClinicOnly: false,
    });
  };

  const queryParams = useMemo(() => {
    const params: Record<string, string | string[]> = {};

    if (filters.myClinicOnly) {
      params.myClinicOnly = "true";
    }

    const clinicFilters = filters.myClinicOnly
      ? clinicId
        ? [clinicId]
        : []
      : filters.clinicIds;

    if (filters.zones.length > 0) {
      params.zone = filters.zones;
    }

    if (filters.states.length > 0) {
      params.state = filters.states;
    }

    if (clinicFilters.length > 0) {
      params.clinicId = clinicFilters;
    }

    if (filters.species.length > 0) {
      params.species = filters.species;
    }

    if (filters.tumourTypeIds.length > 0) {
      params.tumourTypeId = filters.tumourTypeIds;
    }

    if (filters.from) {
      params.from = filters.from;
    }

    if (filters.to) {
      params.to = filters.to;
    }

    return params;
  }, [filters, clinicId]);

  return {
    filters,
    setMultiFilter,
    setDateRange,
    toggleMyClinicOnly,
    resetFilters,
    queryParams,
  };
}

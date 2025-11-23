import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface AnalyticsFilters {
  species?: string;
  breed?: string;
  tumourType?: string;
  ageGroup?: string;
  sex?: string;
  zone?: string;
  state?: string;
  clinic?: string;
  status?: string;
}

interface AnalyticsFiltersContextValue {
  filters: AnalyticsFilters;
  setFilters: (filters: AnalyticsFilters) => void;
  updateFilter: (key: keyof AnalyticsFilters, value: string | undefined) => void;
  clearFilters: () => void;
}

const AnalyticsFiltersContext = createContext<AnalyticsFiltersContextValue | undefined>(undefined);

export function AnalyticsFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<AnalyticsFilters>({});

  const setFilters = useCallback((newFilters: AnalyticsFilters) => {
    setFiltersState(newFilters);
  }, []);

  const updateFilter = useCallback((key: keyof AnalyticsFilters, value: string | undefined) => {
    setFiltersState((prev) => {
      if (value === undefined || value === "" || value === "all") {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  const value = useMemo<AnalyticsFiltersContextValue>(
    () => ({
      filters,
      setFilters,
      updateFilter,
      clearFilters,
    }),
    [filters, setFilters, updateFilter, clearFilters]
  );

  return (
    <AnalyticsFiltersContext.Provider value={value}>{children}</AnalyticsFiltersContext.Provider>
  );
}

export function useAnalyticsFilters() {
  const context = useContext(AnalyticsFiltersContext);
  if (!context) {
    throw new Error("useAnalyticsFilters must be used within an AnalyticsFiltersProvider");
  }
  return context;
}

export function buildFilterParams(filters: AnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.species) params.append("species", filters.species);
  if (filters.breed) params.append("breed", filters.breed);
  if (filters.tumourType) params.append("tumourType", filters.tumourType);
  if (filters.ageGroup) params.append("ageGroup", filters.ageGroup);
  if (filters.sex) params.append("sex", filters.sex);
  if (filters.zone) params.append("zone", filters.zone);
  if (filters.state) params.append("state", filters.state);
  if (filters.clinic) params.append("clinic", filters.clinic);
  if (filters.status) params.append("status", filters.status);
  return params;
}

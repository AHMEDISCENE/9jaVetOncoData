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
  dateFrom?: string;
  dateTo?: string;
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
  
  // Send zone as-is (already in correct format: NORTH_CENTRAL, SOUTH_WEST, etc.)
  if (filters.zone) {
    params.append("geoZones", filters.zone);
  }
  
  // Send state as-is (already in correct format: LAGOS, KOGI, etc.)
  if (filters.state) {
    params.append("states", filters.state);
  }
  
  if (filters.tumourType) params.append("tumourTypeIds", filters.tumourType);
  if (filters.dateFrom) params.append("from", filters.dateFrom);
  if (filters.dateTo) params.append("to", filters.dateTo);
  // Note: ageGroup, sex, status, breed, and clinic filters need backend support to be functional
  return params;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

import {
  AnalyticsDateRangePreset,
  ResolvedAnalyticsDateRange,
  parseAnalyticsDateRange,
  resolveAnalyticsDateRange,
} from "@/lib/analytics-date-range";

interface AnalyticsDateRangeRequestState {
  preset: AnalyticsDateRangePreset;
  customStart?: string;
  customEnd?: string;
}

interface AnalyticsDateRangeContextValue extends ResolvedAnalyticsDateRange {
  customStart?: string;
  customEnd?: string;
  setPreset: (preset: AnalyticsDateRangePreset) => void;
  setCustomRange: (start: string, end: string) => void;
}

const AnalyticsDateRangeContext = createContext<AnalyticsDateRangeContextValue | undefined>(undefined);

function extractPathAndSearch(location: string): { path: string; search: string } {
  const [path, search = ""] = location.split("?");
  return { path, search };
}

export function AnalyticsDateRangeProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();

  const [requestState, setRequestState] = useState<AnalyticsDateRangeRequestState>(() => {
    const { search } = extractPathAndSearch(location);
    const params = new URLSearchParams(search);
    return parseAnalyticsDateRange(params);
  });

  useEffect(() => {
    const { search } = extractPathAndSearch(location);
    const params = new URLSearchParams(search);
    const parsed = parseAnalyticsDateRange(params);
    setRequestState((prev) => {
      if (
        prev.preset === parsed.preset &&
        prev.customStart === parsed.customStart &&
        prev.customEnd === parsed.customEnd
      ) {
        return prev;
      }

      return {
        preset: parsed.preset,
        customStart: parsed.customStart ?? prev.customStart,
        customEnd: parsed.customEnd ?? prev.customEnd,
      };
    });
  }, [location]);

  const resolved = useMemo<ResolvedAnalyticsDateRange>(() => {
    return resolveAnalyticsDateRange(requestState.preset, requestState.customStart, requestState.customEnd);
  }, [requestState]);

  useEffect(() => {
    const { path, search } = extractPathAndSearch(location);
    const params = new URLSearchParams(search);

    params.set("range", resolved.preset);

    if (resolved.preset === "custom") {
      params.set("start", resolved.startDate);
      params.set("end", resolved.endDate);
    } else {
      params.delete("start");
      params.delete("end");
    }

    const queryString = params.toString();
    const nextLocation = queryString ? `${path}?${queryString}` : path;

    if (nextLocation !== location) {
      setLocation(nextLocation, { replace: true });
    }
  }, [resolved, location, setLocation]);

  const setPreset = useCallback(
    (preset: AnalyticsDateRangePreset) => {
      setRequestState((prev) => ({
        preset,
        customStart: prev.customStart,
        customEnd: prev.customEnd,
      }));
    },
    []
  );

  const setCustomRange = useCallback((start: string, end: string) => {
    setRequestState((prev) => ({
      preset: "custom",
      customStart: start,
      customEnd: end,
    }));
  }, []);

  const value = useMemo<AnalyticsDateRangeContextValue>(
    () => ({
      ...resolved,
      customStart: requestState.customStart,
      customEnd: requestState.customEnd,
      setPreset,
      setCustomRange,
    }),
    [resolved, requestState.customStart, requestState.customEnd, setPreset, setCustomRange]
  );

  return <AnalyticsDateRangeContext.Provider value={value}>{children}</AnalyticsDateRangeContext.Provider>;
}

export function useAnalyticsDateRange() {
  const context = useContext(AnalyticsDateRangeContext);
  if (!context) {
    throw new Error("useAnalyticsDateRange must be used within an AnalyticsDateRangeProvider");
  }
  return context;
}


import { useMemo } from "react";

export const LAGOS_TIME_ZONE = "Africa/Lagos";
const LAGOS_OFFSET_MINUTES = 60; // Africa/Lagos is UTC+1 without DST

export type AnalyticsDateRangePreset = "last30d" | "last90d" | "ytd" | "custom";

export interface LagosDateParts {
  year: number;
  month: number;
  day: number;
}

export interface ResolvedAnalyticsDateRange {
  preset: AnalyticsDateRangePreset;
  startParts: LagosDateParts;
  endParts: LagosDateParts;
  startDate: string; // YYYY-MM-DD in Lagos timezone
  endDate: string; // YYYY-MM-DD in Lagos timezone
  startISO: string; // ISO string converted to UTC boundary
  endISO: string; // ISO string converted to UTC boundary
  label: string;
}

const lagosDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LAGOS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const lagosDisplayDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: LAGOS_TIME_ZONE,
  month: "short",
  day: "numeric",
});

const lagosDisplayFullFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: LAGOS_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parseFormatterParts(date: Date): LagosDateParts {
  const formatted = lagosDateFormatter.format(date);
  const [year, month, day] = formatted.split("-").map(Number);
  return { year, month, day };
}

function lagosDatePartsToUtcDate(parts: LagosDateParts, hours = 0, minutes = 0, seconds = 0): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hours, minutes, seconds) - LAGOS_OFFSET_MINUTES * 60 * 1000);
}

function toDateString(parts: LagosDateParts): string {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day
    .toString()
    .padStart(2, "0")}`;
}

function adjustParts(parts: LagosDateParts, deltaDays: number): LagosDateParts {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function getLagosTodayParts(): LagosDateParts {
  return parseFormatterParts(new Date());
}

function formatRangeLabel(startParts: LagosDateParts, endParts: LagosDateParts): string {
  const startDisplayDate = lagosDatePartsToUtcDate(startParts, 12);
  const endDisplayDate = lagosDatePartsToUtcDate(endParts, 12);

  const sameDay =
    startParts.year === endParts.year && startParts.month === endParts.month && startParts.day === endParts.day;
  const sameYear = startParts.year === endParts.year;

  if (sameDay) {
    return `${lagosDisplayFullFormatter.format(startDisplayDate)}`;
  }

  if (sameYear) {
    const startLabel = lagosDisplayDayFormatter.format(startDisplayDate);
    const endLabel = lagosDisplayDayFormatter.format(endDisplayDate);
    return `${startLabel}–${endLabel}, ${startParts.year}`;
  }

  const startFull = lagosDisplayFullFormatter.format(startDisplayDate);
  const endFull = lagosDisplayFullFormatter.format(endDisplayDate);
  return `${startFull} – ${endFull}`;
}

function resolvePreset(
  preset: AnalyticsDateRangePreset,
  customStart?: string,
  customEnd?: string
): ResolvedAnalyticsDateRange {
  let startParts: LagosDateParts;
  let endParts: LagosDateParts;

  if (preset === "custom" && customStart && customEnd) {
    const [startYear, startMonth, startDay] = customStart.split("-").map(Number);
    const [endYear, endMonth, endDay] = customEnd.split("-").map(Number);
    startParts = { year: startYear, month: startMonth, day: startDay };
    endParts = { year: endYear, month: endMonth, day: endDay };
  } else {
    const today = getLagosTodayParts();
    switch (preset) {
      case "last30d": {
        endParts = today;
        startParts = adjustParts(endParts, -29);
        break;
      }
      case "ytd": {
        endParts = today;
        startParts = { year: today.year, month: 1, day: 1 };
        break;
      }
      case "custom":
      case "last90d":
      default: {
        endParts = today;
        startParts = adjustParts(endParts, -89);
        break;
      }
    }
  }

  const startISO = lagosDatePartsToUtcDate(startParts, 0, 0, 0).toISOString();
  const endISO = lagosDatePartsToUtcDate(endParts, 23, 59, 59).toISOString();
  return {
    preset,
    startParts,
    endParts,
    startDate: toDateString(startParts),
    endDate: toDateString(endParts),
    startISO,
    endISO,
    label: formatRangeLabel(startParts, endParts),
  };
}

export function parseAnalyticsDateRange(searchParams: URLSearchParams): {
  preset: AnalyticsDateRangePreset;
  customStart?: string;
  customEnd?: string;
} {
  const presetParam = (searchParams.get("range") as AnalyticsDateRangePreset) || "last90d";

  if (presetParam === "custom") {
    const start = searchParams.get("start") || undefined;
    const end = searchParams.get("end") || undefined;
    if (start && end) {
      return { preset: "custom", customStart: start, customEnd: end };
    }
  }

  if (presetParam === "last30d" || presetParam === "ytd" || presetParam === "custom") {
    return { preset: presetParam };
  }

  return { preset: "last90d" };
}

export function resolveAnalyticsDateRange(
  preset: AnalyticsDateRangePreset,
  customStart?: string,
  customEnd?: string
): ResolvedAnalyticsDateRange {
  const resolved = resolvePreset(preset, customStart, customEnd);

  if (resolved.preset === "custom") {
    const startTime = lagosDatePartsToUtcDate(resolved.startParts, 0, 0, 0).getTime();
    const endTime = lagosDatePartsToUtcDate(resolved.endParts, 23, 59, 59).getTime();
    if (startTime > endTime) {
      // Invalid custom range - fall back to default preset
      return resolvePreset("last90d");
    }
  }

  return resolved;
}

export function useResolvedAnalyticsRange(
  preset: AnalyticsDateRangePreset,
  customStart?: string,
  customEnd?: string
) {
  return useMemo(() => resolveAnalyticsDateRange(preset, customStart, customEnd), [preset, customStart, customEnd]);
}


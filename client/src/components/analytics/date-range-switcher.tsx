import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAnalyticsDateRange } from "@/contexts/analytics-date-range-context";
import type { AnalyticsDateRangePreset } from "@/lib/analytics-date-range";

const presets: Array<{ value: AnalyticsDateRangePreset; label: string; helper: string }> = [
  { value: "last30d", label: "Last 30 days", helper: "Including today" },
  { value: "last90d", label: "Last 90 days", helper: "Default" },
  { value: "ytd", label: "Year to date", helper: "From Jan 1" },
  { value: "custom", label: "Custom range", helper: "Choose start & end" },
];

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateRangeSwitcher() {
  const { label, preset, setPreset, setCustomRange, customStart, customEnd } = useAnalyticsDateRange();
  const [open, setOpen] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<DateRange | undefined>(undefined);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (preset === "custom" && customStart && customEnd) {
      setRangeDraft({ from: new Date(`${customStart}T00:00:00`), to: new Date(`${customEnd}T00:00:00`) });
    } else {
      setRangeDraft(undefined);
      setValidationMessage(null);
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    if (preset !== "custom") {
      return;
    }

    const { from, to } = rangeDraft ?? {};

    if (!from || !to) {
      return;
    }

    if (from > to) {
      setValidationMessage("Start date must be before end date.");
      return;
    }

    setValidationMessage(null);
    const timeout = window.setTimeout(() => {
      const start = formatDateForInput(from);
      const end = formatDateForInput(to);
      setCustomRange(start, end);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [preset, rangeDraft, setCustomRange]);

  const activeHelper = useMemo(() => presets.find((item) => item.value === preset)?.helper ?? "", [preset]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-full border-border/80 bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
        >
          <CalendarRange className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Date range</span>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-foreground">{label}</span>
          <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-4" align="start">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Analytics date range</p>
            <p className="text-xs text-muted-foreground">{activeHelper}</p>
          </div>
          <RadioGroup
            value={preset}
            onValueChange={(value) => {
              const typedValue = value as AnalyticsDateRangePreset;
              setPreset(typedValue);
              if (typedValue !== "custom") {
                setOpen(false);
              }
            }}
            className="grid gap-2"
          >
            {presets.map((item) => (
              <Label
                key={item.value}
                htmlFor={`analytics-date-${item.value}`}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm transition",
                  preset === item.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
                )}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.helper}</span>
                </div>
                <RadioGroupItem id={`analytics-date-${item.value}`} value={item.value} />
              </Label>
            ))}
          </RadioGroup>

          {preset === "custom" ? (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <Calendar
                initialFocus
                mode="range"
                selected={rangeDraft}
                numberOfMonths={1}
                onSelect={(value) => setRangeDraft(value ?? undefined)}
              />
              {validationMessage ? (
                <p className="text-xs text-destructive">{validationMessage}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Pick a start and end date in Africa/Lagos time.</p>
              )}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}


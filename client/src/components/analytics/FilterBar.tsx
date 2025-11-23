import { useAnalyticsFilters } from "@/contexts/analytics-filters-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { useState } from "react";

const SPECIES_OPTIONS = ["Dog", "Cat"];
const AGE_GROUPS = ["<1", "1-3", "4-7", "8+"];
const SEX_OPTIONS = ["MALE_NEUTERED", "MALE_INTACT", "FEMALE_SPAYED", "FEMALE_INTACT"];
const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"];
const ZONES = ["NORTH_CENTRAL", "NORTH_EAST", "NORTH_WEST", "SOUTH_EAST", "SOUTH_SOUTH", "SOUTH_WEST"];
const STATES = [
  "ABIA", "ADAMAWA", "AKWA_IBOM", "ANAMBRA", "BAUCHI", "BAYELSA", "BENUE", "BORNO",
  "CROSS_RIVER", "DELTA", "EBONYI", "EDO", "EKITI", "ENUGU", "FCT", "GOMBE",
  "IMO", "JIGAWA", "KADUNA", "KANO", "KATSINA", "KEBBI", "KOGI", "KWARA",
  "LAGOS", "NASARAWA", "NIGER", "OGUN", "ONDO", "OSUN", "OYO", "PLATEAU",
  "RIVERS", "SOKOTO", "TARABA", "YOBE", "ZAMFARA"
];

export function FilterBar() {
  const { filters, updateFilter, clearFilters } = useAnalyticsFilters();
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = Object.values(filters).some(v => v);

  const displayFilters = [
    { label: "Species", key: "species", options: SPECIES_OPTIONS },
    { label: "Age Group", key: "ageGroup", options: AGE_GROUPS },
    { label: "Sex", key: "sex", options: SEX_OPTIONS },
    { label: "Status", key: "status", options: STATUS_OPTIONS },
    { label: "Zone", key: "zone", options: ZONES },
  ];

  if (!isOpen && !hasActiveFilters) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="mb-4"
        data-testid="button-open-filters"
      >
        + Add Filters
      </Button>
    );
  }

  return (
    <div className="mb-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Filters</h3>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              Clear all
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-toggle-filters"
          >
            {isOpen ? "Collapse" : "Expand"}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {displayFilters.map(({ label, key, options }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key} className="text-xs font-medium">{label}</Label>
              <Select
                value={filters[key as keyof typeof filters] || ""}
                onValueChange={(value) => updateFilter(key as any, value || undefined)}
              >
                <SelectTrigger id={key} className="h-8 text-xs" data-testid={`select-${key}`}>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {options.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {/* State depends on Zone */}
          {filters.zone && (
            <div className="space-y-1">
              <Label htmlFor="state" className="text-xs font-medium">State</Label>
              <Select
                value={filters.state || ""}
                onValueChange={(value) => updateFilter("state", value || undefined)}
              >
                <SelectTrigger id="state" className="h-8 text-xs" data-testid="select-state">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {STATES.map(state => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, value]) => value && (
            <div
              key={key}
              className="inline-flex items-center gap-2 px-2 py-1 bg-primary/20 text-primary rounded-full text-xs"
            >
              {value}
              <button
                onClick={() => updateFilter(key as any, undefined)}
                className="ml-1 hover:opacity-70"
                data-testid={`button-remove-filter-${key}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

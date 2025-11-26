import { useAnalyticsFilters } from "@/contexts/analytics-filters-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, ChevronDown, RotateCcw, Filter } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

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

interface FilterCategory {
  title: string;
  icon: string;
  filters: Array<{ label: string; key: string; options: string[] }>;
}

export function FilterBar() {
  const { filters, updateFilter, updateMultiSelect, clearFilters } = useAnalyticsFilters();
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = Object.values(filters).some(v => v);
  const activeFilterCount = Object.values(filters).filter(v => {
    if (Array.isArray(v)) return v.length > 0;
    return !!v;
  }).length;
  
  // Collapsed by default unless filters are active
  const shouldShow = isOpen || hasActiveFilters;

  const filterCategories: FilterCategory[] = [
    {
      title: "Animal Demographics",
      icon: "🐾",
      filters: [
        { label: "Species", key: "species", options: SPECIES_OPTIONS },
        { label: "Sex", key: "sex", options: SEX_OPTIONS },
        { label: "Age Group", key: "ageGroup", options: AGE_GROUPS },
      ]
    },
    {
      title: "Case Status",
      icon: "📋",
      filters: [
        { label: "Status", key: "status", options: STATUS_OPTIONS },
      ]
    },
    {
      title: "Location",
      icon: "📍",
      filters: [
        { label: "Zone", key: "zone", options: ZONES },
      ]
    }
  ];

  const handleDateChange = (dateType: "dateFrom" | "dateTo", value: string) => {
    updateFilter(dateType, value || undefined);
  };

  if (!isOpen && !hasActiveFilters) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="gap-2 bg-gradient-to-r from-primary/80 to-primary hover:from-primary hover:to-primary/90 shadow-md hover:shadow-lg transition-all"
          data-testid="button-open-filters"
        >
          <Filter className="w-4 h-4" />
          Add Filters
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`mb-4 border border-border/50 rounded-lg bg-gradient-to-br from-card via-card to-card/50 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-slate-900/20 backdrop-blur-sm shadow-md ${shouldShow ? 'p-4' : 'p-0'}`}
    >
      {/* Header */}
      <div className={`flex justify-between items-center ${shouldShow ? 'mb-3 pb-3 border-b border-border/30' : ''}`}>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-filters"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="gap-1"
            data-testid="button-toggle-filters"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
            <span className="hidden sm:inline">{isOpen ? "Hide" : "Show"}</span>
          </Button>
        </div>
      </div>

      {/* Filter Content */}
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-2.5"
        >
          {/* Filter Categories - All in single compact grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {filterCategories.flatMap((category) =>
              category.filters.map(({ label, key, options }) => {
                // Skip sex filter in main grid - it will be rendered as checkboxes below
                if (key === "sex") return null;
                
                const value = filters[key as keyof typeof filters];
                const hasValue = !!value;
                
                return (
                  <div key={key} className="space-y-1">
                    <Label
                      htmlFor={key}
                      className="text-xs font-medium text-foreground truncate block"
                    >
                      {label}
                    </Label>
                    <Select
                      value={value || "all"}
                      onValueChange={(val) => updateFilter(key as any, val === "all" ? undefined : val)}
                    >
                      <SelectTrigger
                        id={key}
                        className={`h-8 text-xs border-border/50 transition-all ${
                          hasValue 
                            ? 'bg-primary/10 border-primary/50 dark:bg-primary/20' 
                            : 'bg-background'
                        }`}
                        data-testid={`select-${key}`}
                      >
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {options.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })
            )}
          </div>

          {/* Sex Filter - Multi-select Checkboxes */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2 pt-2 border-t border-border/20"
          >
            <Label className="text-xs font-medium text-foreground">Sex</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SEX_OPTIONS.map(option => {
                const selectedSex = (filters.sex as string[] | undefined) || [];
                const isChecked = selectedSex.includes(option);
                return (
                  <div key={option} className="flex items-center gap-2">
                    <Checkbox
                      id={`sex-${option}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => updateMultiSelect("sex", option, checked as boolean)}
                      data-testid={`checkbox-sex-${option}`}
                    />
                    <label
                      htmlFor={`sex-${option}`}
                      className="text-xs cursor-pointer text-foreground/80 hover:text-foreground transition-colors"
                    >
                      {option}
                    </label>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* State Filter - Conditional */}
          {filters.zone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-1 pt-2 border-t border-border/20"
            >
              <Label htmlFor="state" className="text-xs font-medium text-foreground">
                State
              </Label>
              <Select
                value={filters.state || "all"}
                onValueChange={(value) => updateFilter("state", value === "all" ? undefined : value)}
              >
                <SelectTrigger
                  id="state"
                  className="h-8 text-xs border-border/50 bg-primary/10 border-primary/50 dark:bg-primary/20"
                  data-testid="select-state"
                >
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATES.map(state => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
          )}

          {/* Date Range Filter - Compact */}
          <div className="space-y-1 pt-2 border-t border-border/20">
            <Label className="text-xs font-medium text-foreground">Time Period</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={(e) => handleDateChange("dateFrom", e.target.value)}
                  className="h-8 text-xs border-border/50 transition-all bg-background hover:bg-muted/50 focus:bg-background"
                  data-testid="input-date-from"
                  placeholder="From"
                />
              </div>
              <div>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo || ""}
                  onChange={(e) => handleDateChange("dateTo", e.target.value)}
                  className="h-8 text-xs border-border/50 transition-all bg-background hover:bg-muted/50 focus:bg-background"
                  data-testid="input-date-to"
                  placeholder="To"
                />
              </div>
            </div>
          </div>

          {/* Active Filters Summary - Inline */}
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-border/20"
            >
              {Object.entries(filters).map(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return null;
                
                // Handle sex array
                if (key === "sex" && Array.isArray(value)) {
                  return value.map(sexValue => (
                    <motion.div
                      key={`${key}-${sexValue}`}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/15 text-primary rounded-full text-xs font-medium border border-primary/30 transition-all"
                    >
                      <span className="truncate max-w-[100px]">{sexValue}</span>
                      <button
                        onClick={() => updateMultiSelect("sex", sexValue, false)}
                        className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                        data-testid={`button-remove-filter-sex-${sexValue}`}
                        title="Remove filter"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  ));
                }
                
                return (
                  <motion.div
                    key={key}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/15 text-primary rounded-full text-xs font-medium border border-primary/30 transition-all"
                  >
                    <span className="truncate max-w-[100px]">{key === 'dateFrom' || key === 'dateTo' ? `${key}: ${value}` : value}</span>
                    <button
                      onClick={() => updateFilter(key as any, undefined)}
                      className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                      data-testid={`button-remove-filter-${key}`}
                      title="Remove filter"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

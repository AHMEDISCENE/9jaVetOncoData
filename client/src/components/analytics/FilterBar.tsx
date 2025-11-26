import { useAnalyticsFilters } from "@/contexts/analytics-filters-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, ChevronDown, RotateCcw, Filter } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const SPECIES_OPTIONS = ["Dog", "Cat"];
const AGE_GROUPS = ["<1", "1-3", "4-7", "8+"];
const SEX_OPTIONS = ["MALE_NEUTERED", "MALE_INTACT", "FEMALE_SPAYED", "FEMALE_INTACT"];
const SEX_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  "MALE_NEUTERED": { label: "♂ Neutered", icon: "🔵", color: "from-blue-500/20 to-blue-400/10 border-blue-500/30 hover:from-blue-500/30 hover:to-blue-400/20" },
  "MALE_INTACT": { label: "♂ Intact", icon: "🔵", color: "from-blue-600/20 to-blue-500/10 border-blue-600/30 hover:from-blue-600/30 hover:to-blue-500/20" },
  "FEMALE_SPAYED": { label: "♀ Spayed", icon: "🔴", color: "from-pink-500/20 to-pink-400/10 border-pink-500/30 hover:from-pink-500/30 hover:to-pink-400/20" },
  "FEMALE_INTACT": { label: "♀ Intact", icon: "🔴", color: "from-pink-600/20 to-pink-500/10 border-pink-600/30 hover:from-pink-600/30 hover:to-pink-500/20" }
};
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
      className={`mb-4 border border-border/50 rounded-xl bg-gradient-to-br from-card via-card to-card/50 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-slate-900/20 backdrop-blur-sm shadow-lg ${shouldShow ? 'p-5' : 'p-0'}`}
    >
      {/* Header */}
      <div className={`flex justify-between items-center ${shouldShow ? 'mb-4 pb-3 border-b border-border/30' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
            <Filter className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Advanced Filters</h3>
            {activeFilterCount > 0 && (
              <p className="text-xs text-muted-foreground">{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
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
            className="gap-1 transition-all"
            data-testid="button-toggle-filters"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
            <span className="hidden sm:inline text-xs">{isOpen ? "Hide" : "Show"}</span>
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
                const stringValue = typeof value === 'string' ? value : (Array.isArray(value) ? "all" : "all");
                
                return (
                  <div key={key} className="space-y-1">
                    <Label
                      htmlFor={key}
                      className="text-xs font-medium text-foreground truncate block"
                    >
                      {label}
                    </Label>
                    <Select
                      value={stringValue}
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

          {/* Sex Filter - Stylish Pill Buttons */}
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3 pt-3 border-t border-border/20"
          >
            <Label className="text-xs font-semibold text-foreground flex items-center gap-2">
              <span className="text-sm">Sex</span>
              <span className="text-xs text-muted-foreground">(select multiple)</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SEX_OPTIONS.map(option => {
                const selectedSex = (filters.sex as string[] | undefined) || [];
                const isChecked = selectedSex.includes(option);
                const sexInfo = SEX_LABELS[option];
                return (
                  <motion.button
                    key={option}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => updateMultiSelect("sex", option, !isChecked)}
                    className={`relative px-3 py-2 rounded-lg border-2 transition-all duration-200 cursor-pointer text-xs font-medium ${
                      isChecked 
                        ? `bg-gradient-to-r ${sexInfo.color} border-current shadow-md` 
                        : 'bg-muted/30 border-border/40 hover:border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid={`button-sex-${option}`}
                  >
                    <div className="flex items-center justify-center gap-1.5 relative z-10">
                      <span className="text-base">{sexInfo.icon}</span>
                      <span>{sexInfo.label}</span>
                    </div>
                    {isChecked && (
                      <motion.div
                        layoutId="pill-underline"
                        className="absolute inset-0 rounded-lg bg-gradient-to-r opacity-0 -z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.1 }}
                        exit={{ opacity: 0 }}
                      />
                    )}
                  </motion.button>
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

          {/* Date Range Filter - Enhanced */}
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-2 pt-3 border-t border-border/20"
          >
            <Label className="text-xs font-semibold text-foreground">Time Period</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={(e) => handleDateChange("dateFrom", e.target.value)}
                  className="h-9 text-xs border-border/50 transition-all bg-background hover:bg-muted/50 focus:bg-background focus:border-primary/50 rounded-lg"
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
                  className="h-9 text-xs border-border/50 transition-all bg-background hover:bg-muted/50 focus:bg-background focus:border-primary/50 rounded-lg"
                  data-testid="input-date-to"
                  placeholder="To"
                />
              </div>
            </div>
          </motion.div>

          {/* Active Filters Summary - Enhanced Badges */}
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-2 pt-3 mt-2 border-t border-border/20"
            >
              {Object.entries(filters).map(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return null;
                
                // Handle sex array
                if (key === "sex" && Array.isArray(value)) {
                  return value.map(sexValue => {
                    const sexInfo = SEX_LABELS[sexValue];
                    return (
                      <motion.div
                        key={`${key}-${sexValue}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileHover={{ scale: 1.05 }}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r ${sexInfo.color} rounded-full text-xs font-medium border-2 transition-all cursor-pointer hover:shadow-md`}
                      >
                        <span>{sexInfo.icon}</span>
                        <span className="truncate max-w-[80px]">{sexInfo.label}</span>
                        <button
                          onClick={() => updateMultiSelect("sex", sexValue, false)}
                          className="ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
                          data-testid={`button-remove-filter-sex-${sexValue}`}
                          title="Remove filter"
                        >
                          <X size={13} />
                        </button>
                      </motion.div>
                    );
                  });
                }
                
                return (
                  <motion.div
                    key={key}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/15 text-primary rounded-full text-xs font-medium border-2 border-primary/30 transition-all cursor-pointer hover:shadow-md"
                  >
                    <span className="truncate max-w-[80px]">{key === 'dateFrom' || key === 'dateTo' ? `${key}: ${value}` : value}</span>
                    <button
                      onClick={() => updateFilter(key as any, undefined)}
                      className="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                      data-testid={`button-remove-filter-${key}`}
                      title="Remove filter"
                    >
                      <X size={13} />
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

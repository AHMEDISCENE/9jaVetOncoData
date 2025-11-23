import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LocationCaseStat } from "@/lib/types";

// Nigeria states with coordinates and zones for visualization
const NIGERIA_STATES: Record<string, { zone: string; color?: string; x: number; y: number }> = {
  ABIA: { zone: "SOUTH_EAST", x: 75, y: 65 },
  ADAMAWA: { zone: "NORTH_EAST", x: 80, y: 25 },
  AKWA_IBOM: { zone: "SOUTH_SOUTH", x: 85, y: 70 },
  ANAMBRA: { zone: "SOUTH_EAST", x: 72, y: 60 },
  BAUCHI: { zone: "NORTH_EAST", x: 70, y: 35 },
  BAYELSA: { zone: "SOUTH_SOUTH", x: 60, y: 75 },
  BENUE: { zone: "NORTH_CENTRAL", x: 65, y: 45 },
  BORNO: { zone: "NORTH_EAST", x: 85, y: 15 },
  CROSS_RIVER: { zone: "SOUTH_SOUTH", x: 80, y: 65 },
  DELTA: { zone: "SOUTH_SOUTH", x: 62, y: 70 },
  EBONYI: { zone: "SOUTH_EAST", x: 75, y: 55 },
  EDO: { zone: "SOUTH_SOUTH", x: 60, y: 62 },
  EKITI: { zone: "SOUTH_WEST", x: 45, y: 62 },
  ENUGU: { zone: "SOUTH_EAST", x: 73, y: 57 },
  FCT: { zone: "NORTH_CENTRAL", x: 60, y: 42 },
  GOMBE: { zone: "NORTH_EAST", x: 78, y: 30 },
  IMO: { zone: "SOUTH_EAST", x: 70, y: 63 },
  JIGAWA: { zone: "NORTH_WEST", x: 50, y: 20 },
  KADUNA: { zone: "NORTH_CENTRAL", x: 55, y: 35 },
  KANO: { zone: "NORTH_WEST", x: 48, y: 18 },
  KATSINA: { zone: "NORTH_WEST", x: 42, y: 15 },
  KEBBI: { zone: "NORTH_WEST", x: 30, y: 20 },
  KOGI: { zone: "NORTH_CENTRAL", x: 65, y: 48 },
  KWARA: { zone: "NORTH_CENTRAL", x: 50, y: 50 },
  LAGOS: { zone: "SOUTH_WEST", x: 30, y: 72 },
  NASARAWA: { zone: "NORTH_CENTRAL", x: 62, y: 40 },
  NIGER: { zone: "NORTH_CENTRAL", x: 58, y: 42 },
  OGUN: { zone: "SOUTH_WEST", x: 38, y: 68 },
  ONDO: { zone: "SOUTH_WEST", x: 50, y: 68 },
  OSUN: { zone: "SOUTH_WEST", x: 42, y: 65 },
  OYO: { zone: "SOUTH_WEST", x: 40, y: 62 },
  PLATEAU: { zone: "NORTH_CENTRAL", x: 65, y: 38 },
  RIVERS: { zone: "SOUTH_SOUTH", x: 65, y: 75 },
  SOKOTO: { zone: "NORTH_WEST", x: 25, y: 18 },
  TARABA: { zone: "NORTH_EAST", x: 75, y: 40 },
  YOBE: { zone: "NORTH_EAST", x: 72, y: 22 },
  ZAMFARA: { zone: "NORTH_WEST", x: 35, y: 15 },
};

const ZONE_COLORS: Record<string, string> = {
  NORTH_CENTRAL: "#06b6d4",
  NORTH_EAST: "#f59e0b",
  NORTH_WEST: "#8b5cf6",
  SOUTH_EAST: "#10b981",
  SOUTH_SOUTH: "#3b82f6",
  SOUTH_WEST: "#ef4444",
};

interface NigeriaCaseDensityMapProps {
  data: Array<{ state: string; zone: string; caseCount: number }>;
  isLoading: boolean;
  error?: Error | null;
  onRetry: () => void;
  totalCases: number;
}

export function NigeriaCaseDensityMap({ 
  data, 
  isLoading, 
  error, 
  onRetry,
  totalCases 
}: NigeriaCaseDensityMapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<LocationCaseStat | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full rounded-lg" />
        <p className="text-sm text-muted-foreground text-center">Loading case density map…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center space-y-4">
        <p className="text-sm font-medium text-destructive">Failed to load geographic data</p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Create a map of state to case count
  const stateDataMap = new Map(data.map(d => [d.state, d]));

  // Get min/max for color intensity
  const counts = Array.from(stateDataMap.values()).map(d => d.caseCount);
  const maxCount = Math.max(...counts, 1);
  const minCount = Math.min(...counts, 1);

  const getIntensity = (count: number) => {
    if (maxCount === minCount) return 0.5;
    return (count - minCount) / (maxCount - minCount);
  };

  const getStateColor = (state: string) => {
    const statData = stateDataMap.get(state);
    if (!statData) return "#f3f4f6"; // Gray for no data

    const zone = NIGERIA_STATES[state]?.zone;
    if (!zone) return "#f3f4f6";

    const baseColor = ZONE_COLORS[zone] || "#9ca3af";
    const intensity = getIntensity(statData.caseCount);
    
    // Convert hex to RGB and apply opacity for intensity
    const hex = baseColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.7})`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-border p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Geographic Distribution</h3>
            <p className="text-sm text-muted-foreground">Cancer case density by state</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{totalCases.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total cases across states</p>
          </div>
        </div>

        {/* State Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {Object.entries(NIGERIA_STATES).map(([stateName, stateInfo]) => {
            const statData = stateDataMap.get(stateName);
            const isHovered = hoveredState === stateName;
            const isSelected = selectedState?.state === stateName;

            return (
              <div
                key={stateName}
                onMouseEnter={() => setHoveredState(stateName)}
                onMouseLeave={() => setHoveredState(null)}
                onClick={() => setSelectedState(statData || null)}
                className="relative cursor-pointer transition-all"
              >
                <div
                  className={`
                    p-2 rounded-md border transition-all text-center
                    ${isSelected ? "ring-2 ring-primary border-primary" : "border-border"}
                    ${isHovered ? "shadow-md" : ""}
                  `}
                  style={{
                    backgroundColor: getStateColor(stateName),
                  }}
                >
                  <p className="text-xs font-semibold text-foreground truncate">
                    {stateName.substring(0, 3)}
                  </p>
                  {statData && (
                    <p className="text-xs font-bold text-foreground">
                      {statData.caseCount}
                    </p>
                  )}
                </div>
                {isHovered && statData && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-card text-card-foreground border border-border px-2 py-1 rounded text-xs whitespace-nowrap z-10 shadow-lg">
                    {stateName.replace(/_/g, " ")}: {statData.caseCount} cases
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(ZONE_COLORS).map(([zone, color]) => (
          <div key={zone} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: color }}
            />
            <p className="text-xs text-muted-foreground">
              {zone.replace(/_/g, " ")}
            </p>
          </div>
        ))}
      </div>

      {/* State Detail Panel */}
      {selectedState && (
        <div className="bg-accent/50 rounded-lg border border-border p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-foreground">
                {selectedState.state.replace(/_/g, " ")}
              </h4>
              <p className="text-xs text-muted-foreground">
                {selectedState.zone.replace(/_/g, " ")}
              </p>
            </div>
            <button
              onClick={() => setSelectedState(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Cases</p>
              <p className="text-2xl font-bold text-primary">
                {selectedState.caseCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">% of Total</p>
              <p className="text-2xl font-bold text-foreground">
                {totalCases > 0 
                  ? Math.round((selectedState.caseCount / totalCases) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

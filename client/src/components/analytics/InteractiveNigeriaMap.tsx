import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LocationCaseStat } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// Nigeria states with geographic positioning (normalized to 0-100 grid)
const NIGERIA_STATES = {
  SOKOTO: { x: 10, y: 8, zone: "NORTH_WEST" },
  KEBBI: { x: 15, y: 12, zone: "NORTH_WEST" },
  ZAMFARA: { x: 20, y: 8, zone: "NORTH_WEST" },
  KATSINA: { x: 28, y: 5, zone: "NORTH_WEST" },
  KANO: { x: 32, y: 8, zone: "NORTH_WEST" },
  JIGAWA: { x: 38, y: 10, zone: "NORTH_WEST" },
  KADUNA: { x: 38, y: 25, zone: "NORTH_CENTRAL" },
  KOGI: { x: 42, y: 35, zone: "NORTH_CENTRAL" },
  NIGER: { x: 38, y: 32, zone: "NORTH_CENTRAL" },
  NASARAWA: { x: 45, y: 32, zone: "NORTH_CENTRAL" },
  FCT: { x: 45, y: 36, zone: "NORTH_CENTRAL" },
  PLATEAU: { x: 48, y: 28, zone: "NORTH_CENTRAL" },
  BAUCHI: { x: 48, y: 18, zone: "NORTH_EAST" },
  GOMBE: { x: 55, y: 20, zone: "NORTH_EAST" },
  YOBE: { x: 52, y: 12, zone: "NORTH_EAST" },
  BORNO: { x: 58, y: 8, zone: "NORTH_EAST" },
  ADAMAWA: { x: 62, y: 18, zone: "NORTH_EAST" },
  TARABA: { x: 58, y: 28, zone: "NORTH_EAST" },
  BENUE: { x: 48, y: 38, zone: "NORTH_CENTRAL" },
  KWARA: { x: 32, y: 38, zone: "NORTH_CENTRAL" },
  OGUN: { x: 28, y: 50, zone: "SOUTH_WEST" },
  LAGOS: { x: 22, y: 52, zone: "SOUTH_WEST" },
  OSUN: { x: 30, y: 55, zone: "SOUTH_WEST" },
  OYO: { x: 32, y: 50, zone: "SOUTH_WEST" },
  EKITI: { x: 38, y: 52, zone: "SOUTH_WEST" },
  ONDO: { x: 42, y: 55, zone: "SOUTH_WEST" },
  DELTA: { x: 42, y: 60, zone: "SOUTH_SOUTH" },
  EDO: { x: 40, y: 57, zone: "SOUTH_SOUTH" },
  BAYELSA: { x: 45, y: 62, zone: "SOUTH_SOUTH" },
  RIVERS: { x: 50, y: 65, zone: "SOUTH_SOUTH" },
  CROSS_RIVER: { x: 58, y: 62, zone: "SOUTH_SOUTH" },
  AKWA_IBOM: { x: 62, y: 65, zone: "SOUTH_SOUTH" },
  ENUGU: { x: 52, y: 50, zone: "SOUTH_EAST" },
  EBONYI: { x: 58, y: 48, zone: "SOUTH_EAST" },
  ANAMBRA: { x: 50, y: 52, zone: "SOUTH_EAST" },
  IMO: { x: 52, y: 58, zone: "SOUTH_EAST" },
  ABIA: { x: 58, y: 55, zone: "SOUTH_EAST" },
} as const;

const ZONE_COLORS: Record<string, { base: string; light: string; dark: string }> = {
  NORTH_CENTRAL: { base: "#06b6d4", light: "#cffafe", dark: "#0c4a6e" },
  NORTH_EAST: { base: "#f59e0b", light: "#fef3c7", dark: "#92400e" },
  NORTH_WEST: { base: "#8b5cf6", light: "#ede9fe", dark: "#3730a3" },
  SOUTH_EAST: { base: "#10b981", light: "#d1fae5", dark: "#064e3b" },
  SOUTH_SOUTH: { base: "#3b82f6", light: "#dbeafe", dark: "#1e3a8a" },
  SOUTH_WEST: { base: "#ef4444", light: "#fee2e2", dark: "#7f1d1d" },
};

interface InteractiveNigeriaMapProps {
  data: Array<{ state: string; zone: string; caseCount: number }>;
  isLoading: boolean;
  error?: Error | null;
  onRetry: () => void;
  totalCases: number;
}

export function InteractiveNigeriaMap({
  data,
  isLoading,
  error,
  onRetry,
  totalCases,
}: InteractiveNigeriaMapProps) {
  const [selectedState, setSelectedState] = useState<LocationCaseStat | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96 w-full rounded-lg" />
        <p className="text-sm text-muted-foreground text-center">Loading Nigeria map…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center space-y-4">
        <p className="text-sm font-medium text-destructive">Failed to load map data</p>
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

  const stateDataMap = new Map(data.map(d => [d.state, d]));
  const counts = Array.from(stateDataMap.values()).map(d => d.caseCount);
  const maxCount = Math.max(...counts, 1);
  const minCount = Math.min(...counts, 1);

  const getIntensity = (count: number) => {
    if (maxCount === minCount) return 0.5;
    return (count - minCount) / (maxCount - minCount);
  };

  const getStateColor = (stateName: string) => {
    const statData = stateDataMap.get(stateName);
    if (!statData) return "#f3f4f6";

    const stateInfo = NIGERIA_STATES[stateName as keyof typeof NIGERIA_STATES];
    if (!stateInfo) return "#f3f4f6";

    const baseColor = ZONE_COLORS[stateInfo.zone]?.base || "#9ca3af";
    const intensity = getIntensity(statData.caseCount);

    const hex = baseColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.7})`;
  };

  const stateNames = Object.keys(NIGERIA_STATES) as Array<keyof typeof NIGERIA_STATES>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-border p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Geographic Distribution of Cases</h3>
            <p className="text-sm text-muted-foreground">Interactive map showing case density by state</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{totalCases.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total cases</p>
          </div>
        </div>

        {/* Interactive Map */}
        <div className="mb-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-4 overflow-x-auto">
          <svg
            viewBox="0 0 100 80"
            className="w-full min-w-full"
            style={{ aspectRatio: "100/80", maxHeight: "500px" }}
          >
            {/* Background */}
            <rect width="100" height="80" fill="transparent" />

            {/* State buttons arranged geographically */}
            {stateNames.map((stateName) => {
              const stateInfo = NIGERIA_STATES[stateName];
              const statData = stateDataMap.get(stateName);
              const isHovered = hoveredState === stateName;
              const isSelected = selectedState?.state === stateName;
              const intensity = statData ? getIntensity(statData.caseCount) : 0;

              return (
                <g key={stateName}>
                  {/* State circle/box */}
                  <circle
                    cx={stateInfo.x}
                    cy={stateInfo.y}
                    r={2.5}
                    fill={getStateColor(stateName)}
                    stroke={isSelected ? "#3b82f6" : isHovered ? "#000" : "#ccc"}
                    strokeWidth={isSelected ? 0.3 : isHovered ? 0.2 : 0.1}
                    style={{
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      filter: isHovered ? "drop-shadow(0 0 4px rgba(0,0,0,0.3))" : "none",
                    }}
                    onClick={() => setSelectedState(statData || null)}
                    onMouseEnter={() => setHoveredState(stateName)}
                    onMouseLeave={() => setHoveredState(null)}
                  />

                  {/* State label */}
                  <text
                    x={stateInfo.x}
                    y={stateInfo.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="1"
                    fontWeight={isSelected ? "bold" : "500"}
                    fill={isSelected ? "#fff" : isHovered ? "#000" : "#333"}
                    style={{
                      pointerEvents: "none",
                      fontFamily: "sans-serif",
                      fontSize: isHovered ? "1.2px" : "0.8px",
                    }}
                  >
                    {stateName.substring(0, 2).toUpperCase()}
                  </text>

                  {/* Case count if data exists */}
                  {statData && (
                    <text
                      x={stateInfo.x}
                      y={stateInfo.y + 1.2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="0.7"
                      fontWeight="bold"
                      fill="#333"
                      style={{
                        pointerEvents: "none",
                        fontFamily: "sans-serif",
                      }}
                    >
                      {statData.caseCount}
                    </text>
                  )}

                  {/* Tooltip on hover */}
                  {isHovered && statData && (
                    <title>{`${stateName.replace(/_/g, " ")}: ${statData.caseCount} cases (${Math.round((statData.caseCount / totalCases) * 100)}%)`}</title>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {Object.entries(ZONE_COLORS).map(([zone, colors]) => (
            <div key={zone} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: colors.base }} />
              <p className="text-xs text-muted-foreground">{zone.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-accent/50 rounded p-3">
            <p className="text-muted-foreground text-xs">Highest Cases</p>
            <p className="font-bold text-lg">
              {stateDataMap.size > 0 ? Array.from(stateDataMap.values()).reduce((a, b) => a.caseCount > b.caseCount ? a : b).state.substring(0, 3) : "—"}
            </p>
          </div>
          <div className="bg-accent/50 rounded p-3">
            <p className="text-muted-foreground text-xs">States with Cases</p>
            <p className="font-bold text-lg">{stateDataMap.size}</p>
          </div>
          <div className="bg-accent/50 rounded p-3">
            <p className="text-muted-foreground text-xs">Avg Cases/State</p>
            <p className="font-bold text-lg">
              {stateDataMap.size > 0 ? Math.round(totalCases / stateDataMap.size) : 0}
            </p>
          </div>
          <div className="bg-accent/50 rounded p-3">
            <p className="text-muted-foreground text-xs">Click on a state</p>
            <p className="font-bold text-lg">for details →</p>
          </div>
        </div>
      </div>

      {/* State Detail Dialog */}
      <Dialog open={!!selectedState} onOpenChange={() => setSelectedState(null)}>
        <DialogContent className="max-w-2xl">
          {selectedState && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedState.state.replace(/_/g, " ")} — {selectedState.zone.replace(/_/g, " ")}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Key metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Total Cases</p>
                    <p className="text-3xl font-bold text-primary">{selectedState.caseCount}</p>
                  </div>
                  <div className="bg-blue-500/10 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">% of Total</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {totalCases > 0 ? Math.round((selectedState.caseCount / totalCases) * 100) : 0}%
                    </p>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Rank</p>
                    <p className="text-3xl font-bold text-green-600">
                      {Array.from(stateDataMap.values())
                        .sort((a, b) => b.caseCount - a.caseCount)
                        .findIndex(s => s.state === selectedState.state) + 1}
                    </p>
                  </div>
                </div>

                {/* Comparison chart */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Top 5 States Comparison</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={Array.from(stateDataMap.values())
                        .sort((a, b) => b.caseCount - a.caseCount)
                        .slice(0, 5)}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="state"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.substring(0, 3)}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="caseCount" fill="#3b82f6">
                        {Array.from(stateDataMap.values())
                          .sort((a, b) => b.caseCount - a.caseCount)
                          .slice(0, 5)
                          .map((entry, idx) => (
                            <Cell
                              key={`cell-${idx}`}
                              fill={
                                entry.state === selectedState.state ? "#ef4444" : "#3b82f6"
                              }
                            />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Zone statistics */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Zone Statistics ({selectedState.zone})</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(() => {
                      const zoneStates = Array.from(stateDataMap.values()).filter(
                        s => s.zone === selectedState.zone
                      );
                      const zoneTotal = zoneStates.reduce((sum, s) => sum + s.caseCount, 0);
                      const statePercentOfZone = zoneTotal > 0 ? (selectedState.caseCount / zoneTotal) * 100 : 0;

                      return (
                        <>
                          <div className="bg-slate-100 dark:bg-slate-800 rounded p-3">
                            <p className="text-xs text-muted-foreground mb-1">Zone Total</p>
                            <p className="text-2xl font-bold">{zoneTotal}</p>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-800 rounded p-3">
                            <p className="text-xs text-muted-foreground mb-1">% of Zone</p>
                            <p className="text-2xl font-bold">{Math.round(statePercentOfZone)}%</p>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-800 rounded p-3">
                            <p className="text-xs text-muted-foreground mb-1">States in Zone</p>
                            <p className="text-2xl font-bold">{zoneStates.length}</p>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-800 rounded p-3">
                            <p className="text-xs text-muted-foreground mb-1">Avg per State</p>
                            <p className="text-2xl font-bold">{Math.round(zoneTotal / zoneStates.length)}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

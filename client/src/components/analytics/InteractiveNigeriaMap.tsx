import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { LocationCaseStat } from "@/lib/types";

// State to zone mapping
const STATE_TO_ZONE: Record<string, string> = {
  ABIA: "SOUTH_EAST",
  ADAMAWA: "NORTH_EAST",
  AKWA_IBOM: "SOUTH_SOUTH",
  ANAMBRA: "SOUTH_EAST",
  BAUCHI: "NORTH_EAST",
  BAYELSA: "SOUTH_SOUTH",
  BENUE: "NORTH_CENTRAL",
  BORNO: "NORTH_EAST",
  CROSS_RIVER: "SOUTH_SOUTH",
  DELTA: "SOUTH_SOUTH",
  EBONYI: "SOUTH_EAST",
  EDO: "SOUTH_SOUTH",
  EKITI: "SOUTH_WEST",
  ENUGU: "SOUTH_EAST",
  FCT: "NORTH_CENTRAL",
  GOMBE: "NORTH_EAST",
  IMO: "SOUTH_EAST",
  JIGAWA: "NORTH_WEST",
  KADUNA: "NORTH_CENTRAL",
  KANO: "NORTH_WEST",
  KATSINA: "NORTH_WEST",
  KEBBI: "NORTH_WEST",
  KOGI: "NORTH_CENTRAL",
  KWARA: "NORTH_CENTRAL",
  LAGOS: "SOUTH_WEST",
  NASARAWA: "NORTH_CENTRAL",
  NIGER: "NORTH_CENTRAL",
  OGUN: "SOUTH_WEST",
  ONDO: "SOUTH_WEST",
  OSUN: "SOUTH_WEST",
  OYO: "SOUTH_WEST",
  PLATEAU: "NORTH_CENTRAL",
  RIVERS: "SOUTH_SOUTH",
  SOKOTO: "NORTH_WEST",
  TARABA: "NORTH_EAST",
  YOBE: "NORTH_EAST",
  ZAMFARA: "NORTH_WEST",
};

const ZONE_COLORS: Record<string, { base: string; light: string }> = {
  NORTH_CENTRAL: { base: "#06b6d4", light: "#cffafe" },
  NORTH_EAST: { base: "#f59e0b", light: "#fef3c7" },
  NORTH_WEST: { base: "#8b5cf6", light: "#ede9fe" },
  SOUTH_EAST: { base: "#10b981", light: "#d1fae5" },
  SOUTH_SOUTH: { base: "#3b82f6", light: "#dbeafe" },
  SOUTH_WEST: { base: "#ef4444", light: "#fee2e2" },
};

// State positions in a grid (representing geographical layout)
const STATE_POSITIONS: Record<string, { row: number; col: number }> = {
  SOKOTO: { row: 0, col: 0 },
  KEBBI: { row: 0, col: 1 },
  KATSINA: { row: 0, col: 2 },
  KANO: { row: 0, col: 3 },
  YOBE: { row: 0, col: 4 },
  BORNO: { row: 0, col: 5 },
  ZAMFARA: { row: 1, col: 0 },
  JIGAWA: { row: 1, col: 3 },
  ADAMAWA: { row: 1, col: 5 },
  KADUNA: { row: 2, col: 1 },
  KOGI: { row: 2, col: 2 },
  NASARAWA: { row: 2, col: 2 },
  PLATEAU: { row: 2, col: 3 },
  TARABA: { row: 2, col: 4 },
  GOMBE: { row: 2, col: 4 },
  KWARA: { row: 3, col: 1 },
  NIGER: { row: 3, col: 2 },
  FCT: { row: 3, col: 2 },
  BENUE: { row: 3, col: 3 },
  EBONYI: { row: 3, col: 4 },
  OGUN: { row: 4, col: 0 },
  LAGOS: { row: 4, col: 0 },
  OSUN: { row: 4, col: 1 },
  OYO: { row: 4, col: 1 },
  EKITI: { row: 4, col: 2 },
  ONDO: { row: 4, col: 2 },
  ENUGU: { row: 4, col: 3 },
  EDO: { row: 4, col: 1 },
  DELTA: { row: 5, col: 1 },
  ANAMBRA: { row: 4, col: 3 },
  CROSS_RIVER: { row: 4, col: 5 },
  IMO: { row: 5, col: 3 },
  ABIA: { row: 5, col: 4 },
  BAYELSA: { row: 5, col: 0 },
  RIVERS: { row: 5, col: 1 },
  AKWA_IBOM: { row: 5, col: 4 },
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

  const stateDataMap = useMemo(
    () => new Map(data.map((d) => [d.state, d])),
    [data]
  );

  const { maxCount, minCount } = useMemo(() => {
    const counts = Array.from(stateDataMap.values()).map((d) => d.caseCount);
    return {
      maxCount: Math.max(...counts, 1),
      minCount: Math.min(...counts, 0),
    };
  }, [stateDataMap]);

  const getIntensity = (count: number) => {
    if (maxCount === minCount) return 0.5;
    return (count - minCount) / (maxCount - minCount);
  };

  const getStateColor = (stateName: string) => {
    const stateData = stateDataMap.get(stateName);
    const zone = STATE_TO_ZONE[stateName];

    if (!zone) return "#e5e7eb";
    const zoneColor = ZONE_COLORS[zone];
    if (!zoneColor) return "#e5e7eb";

    if (!stateData) {
      return zoneColor.light;
    }

    const intensity = getIntensity(stateData.caseCount);
    const baseColor = zoneColor.base;

    const hex = baseColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${0.4 + intensity * 0.6})`;
  };

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

  const allStates = Object.keys(STATE_POSITIONS) as Array<keyof typeof STATE_POSITIONS>;
  const stateSize = 100;
  const padding = 10;
  const cellSize = stateSize + padding;

  const zoneStats = useMemo(() => {
    const stats: Record<string, { total: number; states: number }> = {};
    
    data.forEach((item) => {
      if (!stats[item.zone]) {
        stats[item.zone] = { total: 0, states: 0 };
      }
      stats[item.zone].total += item.caseCount;
      stats[item.zone].states += 1;
    });

    return stats;
  }, [data]);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-border p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Geographic Distribution of Cases</h3>
            <p className="text-sm text-muted-foreground">Interactive map of Nigerian states - click on any state for details</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">{totalCases.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total cases</p>
          </div>
        </div>

        {/* Interactive Map Grid */}
        <div className="bg-white dark:bg-slate-950 rounded-lg p-4 shadow-inner overflow-x-auto">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(6, minmax(120px, 1fr))" }}>
            {allStates.map((stateName) => {
              const stateData = stateDataMap.get(stateName);
              const isHovered = hoveredState === stateName;
              const isSelected = selectedState?.state === stateName;
              const zone = STATE_TO_ZONE[stateName];

              return (
                <button
                  key={stateName}
                  onClick={() => {
                    if (stateData) {
                      setSelectedState(stateData);
                    }
                  }}
                  onMouseEnter={() => setHoveredState(stateName)}
                  onMouseLeave={() => setHoveredState(null)}
                  className={`
                    p-4 rounded-lg border-2 transition-all duration-200 text-center relative
                    ${isSelected
                      ? "border-primary bg-primary/20 shadow-lg scale-105"
                      : isHovered
                      ? "border-primary/50 shadow-md scale-102"
                      : "border-border"
                    }
                  `}
                  style={{
                    backgroundColor: getStateColor(stateName),
                  }}
                  data-testid={`state-${stateName}`}
                >
                  <div className="font-bold text-sm text-foreground">{stateName.substring(0, 3)}</div>
                  <div className="text-xs text-foreground/70">{stateName.slice(3, 6)}</div>
                  {stateData && (
                    <div className="text-lg font-bold text-foreground mt-1">{stateData.caseCount}</div>
                  )}
                  {!stateData && (
                    <div className="text-xs text-muted-foreground mt-1">No data</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          {Object.entries(ZONE_COLORS).map(([zone, colors]) => {
            const stats = zoneStats[zone];
            return (
              <div
                key={zone}
                className="flex items-center gap-2 p-2 rounded-md bg-accent/50 border border-border"
              >
                <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: colors.base }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {zone.replace(/_/g, " ")}
                  </p>
                  {stats && (
                    <p className="text-xs text-muted-foreground">
                      {stats.total} cases
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-primary/10 rounded-lg p-4 text-center border border-primary/20">
          <p className="text-2xl font-bold text-primary">{data.length}</p>
          <p className="text-xs text-muted-foreground mt-1">States with cases</p>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4 text-center border border-blue-500/20">
          <p className="text-2xl font-bold text-blue-600">
            {data.length > 0
              ? data.reduce((max, s) => (s.caseCount > max.caseCount ? s : max)).state.substring(0, 3)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Highest cases</p>
        </div>
        <div className="bg-green-500/10 rounded-lg p-4 text-center border border-green-500/20">
          <p className="text-2xl font-bold text-green-600">
            {data.length > 0 ? Math.round(totalCases / data.length) : 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Avg per state</p>
        </div>
        <div className="bg-amber-500/10 rounded-lg p-4 text-center border border-amber-500/20">
          <p className="text-2xl font-bold text-amber-600">{Object.keys(zoneStats).length}</p>
          <p className="text-xs text-muted-foreground mt-1">Active zones</p>
        </div>
      </div>

      {/* State Detail Dialog */}
      <Dialog open={!!selectedState} onOpenChange={() => setSelectedState(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedState && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {selectedState.state.replace(/_/g, " ")} State
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedState.zone.replace(/_/g, " ")} Zone
                </p>
              </DialogHeader>

              <div className="space-y-6">
                {/* Key Metrics */}
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
                      #{data
                        .sort((a, b) => b.caseCount - a.caseCount)
                        .findIndex((s) => s.state === selectedState.state) + 1}
                    </p>
                  </div>
                </div>

                {/* Comparison Chart */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Top 10 States by Case Count</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={data
                        .sort((a, b) => b.caseCount - a.caseCount)
                        .slice(0, 10)}
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="state"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => value.substring(0, 4)}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="caseCount" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        {data
                          .sort((a, b) => b.caseCount - a.caseCount)
                          .slice(0, 10)
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

                {/* Zone Statistics */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    {selectedState.zone.replace(/_/g, " ")} Zone Statistics
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(() => {
                      const zoneStates = data.filter((s) => s.zone === selectedState.zone);
                      const zoneTotal = zoneStates.reduce((sum, s) => sum + s.caseCount, 0);
                      const statePercentOfZone =
                        zoneTotal > 0 ? (selectedState.caseCount / zoneTotal) * 100 : 0;

                      return (
                        <>
                          <div className="bg-slate-100 dark:bg-slate-800 rounded p-3">
                            <p className="text-xs text-muted-foreground mb-1">Zone Total Cases</p>
                            <p className="text-2xl font-bold">{zoneTotal.toLocaleString()}</p>
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
                            <p className="text-xs text-muted-foreground mb-1">Zone Avg</p>
                            <p className="text-2xl font-bold">
                              {Math.round(zoneTotal / zoneStates.length)}
                            </p>
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

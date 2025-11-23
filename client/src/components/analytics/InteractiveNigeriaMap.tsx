import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import type { LocationCaseStat } from "@/lib/types";

// State to zone mapping
const STATE_TO_ZONE: Record<string, string> = {
  SOKOTO: "NORTH_WEST", KEBBI: "NORTH_WEST", ZAMFARA: "NORTH_WEST", KATSINA: "NORTH_WEST",
  KANO: "NORTH_WEST", JIGAWA: "NORTH_WEST",
  YOBE: "NORTH_EAST", BORNO: "NORTH_EAST", ADAMAWA: "NORTH_EAST", GOMBE: "NORTH_EAST",
  BAUCHI: "NORTH_EAST", TARABA: "NORTH_EAST",
  FCT: "NORTH_CENTRAL", NIGER: "NORTH_CENTRAL", KADUNA: "NORTH_CENTRAL", PLATEAU: "NORTH_CENTRAL",
  NASARAWA: "NORTH_CENTRAL", KOGI: "NORTH_CENTRAL", BENUE: "NORTH_CENTRAL", KWARA: "NORTH_CENTRAL",
  OYO: "SOUTH_WEST", OSUN: "SOUTH_WEST", EKITI: "SOUTH_WEST", ONDO: "SOUTH_WEST",
  EDO: "SOUTH_SOUTH", LAGOS: "SOUTH_WEST", OGUN: "SOUTH_WEST",
  DELTA: "SOUTH_SOUTH", BAYELSA: "SOUTH_SOUTH", RIVERS: "SOUTH_SOUTH",
  AKWA_IBOM: "SOUTH_SOUTH", CROSS_RIVER: "SOUTH_SOUTH",
  IMO: "SOUTH_EAST", ABIA: "SOUTH_EAST", ENUGU: "SOUTH_EAST",
  EBONYI: "SOUTH_EAST", ANAMBRA: "SOUTH_EAST",
};

const ZONE_COLORS: Record<string, { base: string; light: string; dark: string; name: string }> = {
  NORTH_CENTRAL: { base: "#06b6d4", light: "#cffafe", dark: "#0c4a6e", name: "North Central" },
  NORTH_EAST: { base: "#f59e0b", light: "#fef3c7", dark: "#92400e", name: "North East" },
  NORTH_WEST: { base: "#8b5cf6", light: "#ede9fe", dark: "#3730a3", name: "North West" },
  SOUTH_EAST: { base: "#10b981", light: "#d1fae5", dark: "#064e3b", name: "South East" },
  SOUTH_SOUTH: { base: "#3b82f6", light: "#dbeafe", dark: "#1e3a8a", name: "South South" },
  SOUTH_WEST: { base: "#ef4444", light: "#fee2e2", dark: "#7f1d1d", name: "South West" },
};

// All Nigeria states in proper grid layout (36 states + FCT = 37 total)
const NIGERIA_STATES_GRID = [
  ["SOKOTO", "ZAMFARA", "KATSINA", "KANO", "JIGAWA", "YOBE", "BORNO"],
  ["KEBBI", "KADUNA", "BAUCHI", "GOMBE", "ADAMAWA"],
  ["NIGER", "FCT", "PLATEAU", "TARABA"],
  ["KWARA", "NASARAWA", "BENUE"],
  ["OYO", "KOGI", "ENUGU", "EBONYI", "CROSS_RIVER"],
  ["OSUN", "EKITI", "EDO", "ANAMBRA", "ABIA", "AKWA_IBOM"],
  ["OGUN", "ONDO", "DELTA", "IMO"],
  ["LAGOS", "BAYELSA", "RIVERS"],
];

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
  const [zoneStats, setZoneStats] = useState<any>(null);
  const [zoneLoading, setZoneLoading] = useState(false);

  useEffect(() => {
    if (selectedState?.zone) {
      setZoneLoading(true);
      fetch(`/api/analytics/zone-stats?zone=${selectedState.zone}`)
        .then(res => res.json())
        .then(data => setZoneStats(data))
        .catch(err => console.error('Failed to fetch zone stats:', err))
        .finally(() => setZoneLoading(false));
    }
  }, [selectedState?.zone]);

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

  const stateDataMap = new Map(data.map((d) => [d.state, d]));
  const maxCount = Math.max(...data.map(d => d.caseCount), 1);

  const getStateColor = (stateName: string) => {
    const zone = STATE_TO_ZONE[stateName];
    if (!zone) return "#e5e7eb";

    const stateData = stateDataMap.get(stateName);
    const zoneColor = ZONE_COLORS[zone];

    if (!stateData) {
      return zoneColor.light;
    }

    const intensity = stateData.caseCount / maxCount;
    const hex = zoneColor.base.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${0.4 + intensity * 0.6})`;
  };

  const zoneAggregates: Record<string, { total: number; states: number }> = {};
  data.forEach((item) => {
    if (!zoneAggregates[item.zone]) {
      zoneAggregates[item.zone] = { total: 0, states: 0 };
    }
    zoneAggregates[item.zone].total += item.caseCount;
    zoneAggregates[item.zone].states += 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-foreground">Geographic Distribution of Cases – Nigeria</h3>
          <p className="text-sm text-muted-foreground">Interactive map showing case density by state</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold text-primary">{totalCases.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total cases across states</p>
        </div>
      </div>

      {/* Map Grid */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-border p-6">
        <div className="space-y-2">
          {NIGERIA_STATES_GRID.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-2 justify-center">
              {row.map((stateName) => {
                const stateData = stateDataMap.get(stateName);
                const zone = STATE_TO_ZONE[stateName];
                const isHovered = hoveredState === stateName;
                const isSelected = selectedState?.state === stateName;

                return (
                  <button
                    key={stateName}
                    onClick={() => stateData && setSelectedState(stateData)}
                    onMouseEnter={() => setHoveredState(stateName)}
                    onMouseLeave={() => setHoveredState(null)}
                    className={`
                      relative flex flex-col items-center justify-center
                      min-w-[80px] md:min-w-[100px] h-16 md:h-20
                      rounded-lg border-2 transition-all duration-200
                      ${isSelected ? "border-primary ring-4 ring-primary/30 scale-105" : "border-slate-300 dark:border-slate-600"}
                      ${isHovered ? "scale-105 shadow-lg z-10" : "shadow"}
                      ${stateData ? "cursor-pointer hover:shadow-xl" : "cursor-default opacity-60"}
                    `}
                    style={{
                      backgroundColor: getStateColor(stateName),
                    }}
                    data-testid={`state-${stateName}`}
                  >
                    <div className="text-[10px] md:text-xs font-bold text-slate-900 dark:text-slate-100 uppercase leading-tight text-center px-1">
                      {stateName.replace(/_/g, " ")}
                    </div>
                    {stateData && (
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {stateData.caseCount}
                      </div>
                    )}
                    {!stateData && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        No data
                      </div>
                    )}
                    
                    {/* Hover tooltip */}
                    {isHovered && stateData && (
                      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-md shadow-xl text-xs whitespace-nowrap z-20 pointer-events-none">
                        <div className="font-semibold">{stateName.replace(/_/g, " ")}</div>
                        <div>{stateData.caseCount} cases • {zone.replace(/_/g, " ")}</div>
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Geopolitical Zones</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(ZONE_COLORS).map(([zone, colors]) => {
            const stats = zoneAggregates[zone];
            return (
              <div
                key={zone}
                className="flex items-center gap-2 p-3 rounded-md bg-white dark:bg-slate-800 border border-border shadow-sm"
              >
                <div className="w-5 h-5 rounded flex-shrink-0" style={{ backgroundColor: colors.base }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {colors.name}
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
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <p className="text-2xl font-bold text-amber-600">
            {Object.keys(zoneAggregates).length}
          </p>
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
                  {ZONE_COLORS[selectedState.zone]?.name || selectedState.zone.replace(/_/g, " ")} Zone
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
                    {ZONE_COLORS[selectedState.zone]?.name || selectedState.zone.replace(/_/g, " ")} Zone Statistics
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

                {/* Zone Tumour Types */}
                {zoneLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : zoneStats?.tumours?.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Tumour Types Found in Zone</h4>
                    <div className="space-y-2">
                      {zoneStats.tumours.slice(0, 5).map((t: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded text-sm">
                          <span className="font-medium">{t.name}</span>
                          <span className="text-muted-foreground">{t.count} cases ({t.percentage}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Zone Species */}
                {!zoneLoading && zoneStats?.species?.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Species Affected in Zone</h4>
                    <div className="space-y-2">
                      {zoneStats.species.map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded text-sm">
                          <span className="font-medium capitalize">{s.name}</span>
                          <span className="text-muted-foreground">{s.count} cases ({s.percentage}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Zone Case Status */}
                {!zoneLoading && zoneStats?.statuses?.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Case Status Distribution in Zone</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={zoneStats.statuses}
                              dataKey="count"
                              nameKey="status"
                              cx="50%"
                              cy="50%"
                              outerRadius={60}
                            >
                              {zoneStats.statuses.map((entry: any, idx: number) => (
                                <Cell key={`cell-${idx}`} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b'][idx % 4]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 flex flex-col justify-center">
                        {zoneStats.statuses.map((s: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'][idx % 4] }} />
                              <span className="capitalize">{s.status?.replace(/_/g, ' ').toLowerCase() || 'Unknown'}</span>
                            </div>
                            <span className="text-muted-foreground font-medium">{s.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Top Breeds */}
                {!zoneLoading && zoneStats?.breeds?.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Top Breeds Affected in Zone</h4>
                    <div className="space-y-2">
                      {zoneStats.breeds.slice(0, 5).map((b: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded text-sm">
                          <span className="font-medium capitalize">{b.name}</span>
                          <span className="text-muted-foreground">{b.count} cases ({b.percentage}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

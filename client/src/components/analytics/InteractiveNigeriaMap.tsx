import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { LocationCaseStat } from "@/lib/types";

const nigeriaGeoJSON = "/nigeria-states.geojson";

// Map GeoJSON state names to our state enum format
const STATE_NAME_MAP: Record<string, string> = {
  "Abia": "ABIA",
  "Adamawa": "ADAMAWA",
  "Akwa Ibom": "AKWA_IBOM",
  "Anambra": "ANAMBRA",
  "Bauchi": "BAUCHI",
  "Bayelsa": "BAYELSA",
  "Benue": "BENUE",
  "Borno": "BORNO",
  "Cross River": "CROSS_RIVER",
  "Delta": "DELTA",
  "Ebonyi": "EBONYI",
  "Edo": "EDO",
  "Ekiti": "EKITI",
  "Enugu": "ENUGU",
  "Federal Capital Territory": "FCT",
  "Gombe": "GOMBE",
  "Imo": "IMO",
  "Jigawa": "JIGAWA",
  "Kaduna": "KADUNA",
  "Kano": "KANO",
  "Katsina": "KATSINA",
  "Kebbi": "KEBBI",
  "Kogi": "KOGI",
  "Kwara": "KWARA",
  "Lagos": "LAGOS",
  "Nasarawa": "NASARAWA",
  "Niger": "NIGER",
  "Ogun": "OGUN",
  "Ondo": "ONDO",
  "Osun": "OSUN",
  "Oyo": "OYO",
  "Plateau": "PLATEAU",
  "Rivers": "RIVERS",
  "Sokoto": "SOKOTO",
  "Taraba": "TARABA",
  "Yobe": "YOBE",
  "Zamfara": "ZAMFARA",
};

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
  const [tooltipContent, setTooltipContent] = useState<{ name: string; cases: number; x: number; y: number } | null>(null);

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

  const getStateFill = (stateName: string) => {
    const stateCode = STATE_NAME_MAP[stateName];
    if (!stateCode) return "#e5e7eb";

    const stateData = stateDataMap.get(stateCode);
    const zone = STATE_TO_ZONE[stateCode];

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

  const handleGeographyClick = (geo: { properties: { shapeName: string } }) => {
    const stateName = geo.properties.shapeName;
    const stateCode = STATE_NAME_MAP[stateName];
    if (stateCode) {
      const stateData = stateDataMap.get(stateCode);
      if (stateData) {
        setSelectedState(stateData);
      }
    }
  };

  const handleGeographyMouseEnter = (geo: { properties: { shapeName: string } }, event: React.MouseEvent) => {
    const stateName = geo.properties.shapeName;
    const stateCode = STATE_NAME_MAP[stateName];
    setHoveredState(stateCode || null);

    if (stateCode) {
      const stateData = stateDataMap.get(stateCode);
      if (stateData) {
        setTooltipContent({
          name: stateName,
          cases: stateData.caseCount,
          x: event.clientX,
          y: event.clientY,
        });
      }
    }
  };

  const handleGeographyMouseLeave = () => {
    setHoveredState(null);
    setTooltipContent(null);
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
      {/* Map Card */}
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-border p-6 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Interactive Nigeria Map</h3>
            <p className="text-sm text-muted-foreground">Click on any state to view detailed analytics</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">{totalCases.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total cases</p>
          </div>
        </div>

        {/* Interactive Map */}
        <div className="bg-white dark:bg-slate-950 rounded-lg p-4 shadow-inner" data-testid="nigeria-map-container">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 2400,
              center: [8, 9.5],
            }}
            style={{
              width: "100%",
              height: "auto",
            }}
            className="w-full"
          >
            <ZoomableGroup center={[8, 9.5]} zoom={1}>
              <Geographies geography={nigeriaGeoJSON}>
                {({ geographies }: { geographies: any[] }) =>
                  geographies.map((geo: any) => {
                    const stateName = geo.properties.shapeName;
                    const stateCode = STATE_NAME_MAP[stateName];
                    const isHovered = hoveredState === stateCode;
                    const isSelected = selectedState?.state === stateCode;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getStateFill(stateName)}
                        stroke={
                          isSelected
                            ? "#3b82f6"
                            : isHovered
                            ? "#1f2937"
                            : "#94a3b8"
                        }
                        strokeWidth={isSelected ? 1.5 : isHovered ? 1 : 0.5}
                        style={{
                          default: {
                            outline: "none",
                          },
                          hover: {
                            outline: "none",
                            cursor: "pointer",
                            filter: "brightness(0.9)",
                          },
                          pressed: {
                            outline: "none",
                          },
                        }}
                        onClick={() => handleGeographyClick(geo)}
                        onMouseEnter={(event) => handleGeographyMouseEnter(geo, event)}
                        onMouseLeave={handleGeographyMouseLeave}
                        data-testid={`state-${stateCode}`}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Tooltip */}
        {tooltipContent && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltipContent.x + 10,
              top: tooltipContent.y - 40,
            }}
          >
            <div className="bg-slate-900 text-white px-3 py-2 rounded-md shadow-lg text-sm">
              <p className="font-semibold">{tooltipContent.name}</p>
              <p className="text-xs">Cases: {tooltipContent.cases}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-primary/10 rounded-lg p-4 text-center border border-primary/20">
          <p className="text-2xl font-bold text-primary">
            {data.length}
          </p>
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
            {Object.keys(zoneStats).length}
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

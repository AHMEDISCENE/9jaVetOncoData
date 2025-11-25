import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/export";
import { useCasesLocationData } from "@/hooks/useCasesLocationData";
import { InteractiveNigeriaMap } from "@/components/analytics/InteractiveNigeriaMap";
import { FilterBar } from "@/components/analytics/FilterBar";
import { MetricDrilldown } from "@/components/analytics/MetricDrilldown";
import { useAnalyticsFilters, buildFilterParams } from "@/contexts/analytics-filters-context";
import type { DashboardStats } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";

const COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

// Helper function to group tumours - keep top 7-10, combine rest as "Others"
function groupTumourTypes(tumours: Array<{ name: string; count: number }>, maxItems: number = 8) {
  if (tumours.length <= maxItems) return tumours;
  
  const top = tumours.slice(0, maxItems);
  const others = tumours.slice(maxItems);
  const othersCount = others.reduce((sum, t) => sum + t.count, 0);
  
  return [...top, { name: 'Others', count: othersCount }];
}

type MetricType = "totalCases" | "newThisMonth" | "remissionRate" | "activeClinics" | null;

interface SurvivalAnalysisPanelProps {
  filters: any;
}

interface SurvivalDataPoint {
  time: number;
  survival: number;
}

interface SurvivalAnalysisResponse {
  data: SurvivalDataPoint[];
  meta: {
    nAtRisk: number;
    nEvents: number;
    nCensored: number;
    totalCases: number;
  };
}

function SurvivalAnalysisPanel({ filters }: SurvivalAnalysisPanelProps) {
  const [survivalFilters, setSurvivalFilters] = useState({
    species: filters.species?.[0] || "",
    stage: filters.stage?.[0] || "",
  });
  const [showCurve, setShowCurve] = useState(false);

  const buildSurvivalUrl = () => {
    const params = new URLSearchParams();
    if (survivalFilters.species) params.append("species", survivalFilters.species);
    if (survivalFilters.stage) params.append("stage", survivalFilters.stage);
    if (filters.dateRange?.from) params.append("startDate", filters.dateRange.from);
    if (filters.dateRange?.to) params.append("endDate", filters.dateRange.to);
    if (filters.clinicIds?.[0]) params.append("clinicId", filters.clinicIds[0]);
    return `/api/analytics/survival${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const survivalUrl = buildSurvivalUrl();
  const { data: survivalData, isLoading: isSurvivalLoading } = useQuery<SurvivalAnalysisResponse>({
    queryKey: [survivalUrl],
    enabled: showCurve,
  });

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Survival Analysis (Kaplan–Meier Curves)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Species</label>
              <input
                type="text"
                placeholder="Filter by species"
                value={survivalFilters.species}
                onChange={(e) => setSurvivalFilters({ ...survivalFilters, species: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                data-testid="input-survival-species"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Stage</label>
              <input
                type="text"
                placeholder="Filter by stage"
                value={survivalFilters.stage}
                onChange={(e) => setSurvivalFilters({ ...survivalFilters, stage: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                data-testid="input-survival-stage"
              />
            </div>
          </div>

          {/* Update Button */}
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowCurve(true)}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-update-survival-curve"
            >
              {isSurvivalLoading ? "Loading..." : "Update Curve"}
            </Button>
          </div>

          {/* Chart */}
          {showCurve && (
            <div className="space-y-4 mt-6">
              <div className="h-80 w-full">
                {isSurvivalLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Skeleton className="h-full w-full" />
                  </div>
                ) : survivalData?.data && survivalData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={survivalData.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="time" label={{ value: "Time (days)", position: "insideBottomRight", offset: -5 }} />
                      <YAxis label={{ value: "Survival (%)", angle: -90, position: "insideLeft" }} domain={[0, 100]} />
                      <Tooltip 
                        formatter={(value) => [`${(value as number).toFixed(1)}%`, "Survival"]}
                        labelFormatter={(label) => `Day ${label}`}
                        contentStyle={{ 
                          backgroundColor: "rgba(255,255,255,0.95)", 
                          border: "1px solid #ccc",
                          borderRadius: "4px"
                        }}
                      />
                      <Line 
                        type="stepAfter" 
                        dataKey="survival" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <p>No sufficient data for survival analysis with current filters</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata */}
              {survivalData?.meta && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-1">N at Risk (baseline)</p>
                    <p className="text-lg font-bold text-foreground" data-testid="text-survival-n-at-risk">
                      {survivalData.meta.nAtRisk}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Events</p>
                    <p className="text-lg font-bold text-red-600" data-testid="text-survival-events">
                      {survivalData.meta.nEvents}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Censored</p>
                    <p className="text-lg font-bold text-green-600" data-testid="text-survival-censored">
                      {survivalData.meta.nCensored}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!showCurve && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <p>Click "Update Curve" to calculate Kaplan–Meier survival estimates for the selected cohort.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { toast } = useToast();
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const { filters } = useAnalyticsFilters();
  
  const handleMetricClick = (metric: MetricType) => {
    setSelectedMetric(metric);
    setIsDrilldownOpen(true);
  };
  
  const handleCloseDrilldown = () => {
    setIsDrilldownOpen(false);
    setTimeout(() => setSelectedMetric(null), 300); // Wait for animation
  };
  
  // Build query key with filters
  const filterParams = buildFilterParams(filters);
  const queryString = filterParams.toString();
  const statsUrl = queryString ? `/api/dashboard/stats?${queryString}` : "/api/dashboard/stats";
  
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: [statsUrl],
  });

  const { 
    data: locationData,
    isLoading: isLocationLoading,
    error: locationError,
    refetch: refetchLocation
  } = useCasesLocationData();

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <FilterBar />
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 sm:p-6">
        <FilterBar />
        <Card>
          <CardContent className="p-6 text-center">
            <i className="fas fa-exclamation-triangle text-destructive text-4xl mb-4"></i>
            <h3 className="text-lg font-semibold mb-2">Unable to load analytics</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Please check your connection and try again."}
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-retry-analytics">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const casesOverTimeRows = stats.casesByMonth.map((item) => ({
    period: item.month,
    cases: item.count,
  }));
  const hasCasesOverTimeData = casesOverTimeRows.length > 0;

  const tumourDistributionTotal = stats.topTumourTypes.reduce((total, item) => total + item.count, 0);
  const tumourDistributionRows = stats.topTumourTypes.map((item) => {
    const candidatePercent =
      (item as { percent?: number | string; percentage?: number | string; pct?: number | string }).percent ??
      (item as { percent?: number | string; percentage?: number | string; pct?: number | string }).percentage ??
      (item as { percent?: number | string; percentage?: number | string; pct?: number | string }).pct;

    let percent = "";

    if (candidatePercent !== undefined && candidatePercent !== null && candidatePercent !== "") {
      if (typeof candidatePercent === "number") {
        const normalizedValue = candidatePercent > 1 ? candidatePercent : candidatePercent * 100;
        percent = `${Math.round(normalizedValue)}%`;
      } else {
        const trimmed = String(candidatePercent).trim();
        percent = trimmed.endsWith("%") ? trimmed : `${trimmed}%`;
      }
    } else if (tumourDistributionTotal > 0) {
      percent = `${Math.round((item.count / tumourDistributionTotal) * 100)}%`;
    }

    return {
      tumour_type: item.name,
      cases: item.count,
      percent,
    };
  });
  const hasTumourDistributionData = tumourDistributionRows.length > 0;

  // Generic export handler for analytics with format support
  const handleAnalyticsExport = async (
    chartName: string,
    headers: string[],
    rows: any[],
    summary: any,
    format: 'csv' | 'xlsx' | 'pdf'
  ) => {
    try {
      const response = await apiRequest('POST', '/api/analytics/export', {
        chartName,
        headers,
        rows,
        summary,
        format,
      });

      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition?.split('filename="')[1]?.split('"')[0] || `export.${format}`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const formatLabel = format === 'csv' ? 'CSV' : format === 'xlsx' ? 'Excel' : 'PDF';
      toast({
        title: "Export successful",
        description: `${chartName} has been exported as ${formatLabel}`,
      });
    } catch (err) {
      console.error(err);
      const formatLabel = format === 'csv' ? 'CSV' : format === 'xlsx' ? 'Excel' : 'PDF';
      toast({
        variant: "destructive",
        title: "Export failed",
        description: `We couldn't export as ${formatLabel}. Please try again.`,
      });
    }
  };

  const handleCasesOverTimeExport = async (format: 'csv' | 'xlsx' | 'pdf' = 'csv') => {
    if (!hasCasesOverTimeData) {
      return;
    }

    const totalCases = casesOverTimeRows.reduce((sum, row) => sum + (row.cases || 0), 0);
    const avgCases = totalCases / casesOverTimeRows.length;
    const caseValues = casesOverTimeRows.map(r => r.cases || 0);
    const maxCases = Math.max(...caseValues);
    const minCases = Math.min(...caseValues);

    await handleAnalyticsExport('Cases Over Time', ['period', 'cases'], casesOverTimeRows, {
      total: totalCases,
      average: Math.round(avgCases * 100) / 100,
      highest: maxCases,
      lowest: minCases,
      recordCount: casesOverTimeRows.length,
    }, format);
  };

  const handleTumourDistributionExport = async (format: 'csv' | 'xlsx' | 'pdf' = 'csv') => {
    if (!hasTumourDistributionData) {
      return;
    }

    const totalCases = tumourDistributionRows.reduce((sum, row) => sum + (row.cases || 0), 0);

    await handleAnalyticsExport('Tumour Type Distribution', ['tumour_type', 'cases', 'percent'], tumourDistributionRows, {
      total: totalCases,
      recordCount: tumourDistributionRows.length,
    }, format);
  };

  const speciesRows = stats.casesBySpecies.map((item) => ({
    species: item.name,
    cases: item.count,
  }));
  const hasSpeciesData = speciesRows.length > 0;

  const handleSpeciesExport = async (format: 'csv' | 'xlsx' | 'pdf' = 'csv') => {
    if (!hasSpeciesData) {
      return;
    }

    const totalCases = speciesRows.reduce((sum, row) => sum + (row.cases || 0), 0);
    const avgCases = totalCases / speciesRows.length;

    await handleAnalyticsExport('Cases by Species', ['species', 'cases'], speciesRows, {
      total: totalCases,
      average: Math.round(avgCases * 100) / 100,
      recordCount: speciesRows.length,
    }, format);
  };

  const outcomeRows = stats.treatmentOutcomes.map((item) => ({
    status: item.name,
    count: item.count,
  }));
  const hasOutcomeData = outcomeRows.length > 0;

  const handleOutcomeExport = async (format: 'csv' | 'xlsx' | 'pdf' = 'csv') => {
    if (!hasOutcomeData) {
      return;
    }

    const totalOutcomes = outcomeRows.reduce((sum, row) => sum + (row.count || 0), 0);
    const remissionCount = outcomeRows.find(r => r.status?.toLowerCase().includes('remission'))?.count || 0;
    const remissionPercent = totalOutcomes > 0 ? Math.round((remissionCount / totalOutcomes) * 100) : 0;

    await handleAnalyticsExport('Treatment Outcomes', ['status', 'count'], outcomeRows, {
      total: totalOutcomes,
      successRate: remissionPercent,
      recordCount: outcomeRows.length,
    }, format);
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Global Filter Bar */}
      <FilterBar />
      
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Analytics & Insights</h2>
        <p className="text-lg font-semibold text-foreground">Comprehensive analysis of veterinary oncology data</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card 
          className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl focus:scale-105 focus:shadow-xl active:scale-95"
          role="button"
          tabIndex={0}
          onClick={() => handleMetricClick("totalCases")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMetricClick("totalCases");
            }
          }}
          data-testid="card-total-cases"
        >
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-300 mb-2" data-testid="metric-total-cases">
              {stats.totalCases.toLocaleString()}
            </div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-200">Total Cases</p>
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">Click for details</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl focus:scale-105 focus:shadow-xl active:scale-95"
          role="button"
          tabIndex={0}
          onClick={() => handleMetricClick("newThisMonth")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMetricClick("newThisMonth");
            }
          }}
          data-testid="card-new-this-month"
        >
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-300 mb-2" data-testid="metric-new-cases">
              {stats.newThisMonth.toLocaleString()}
            </div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-200">New This Month</p>
            <p className="text-xs text-purple-500 dark:text-purple-400 mt-2">Click for details</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl focus:scale-105 focus:shadow-xl active:scale-95"
          role="button"
          tabIndex={0}
          onClick={() => handleMetricClick("remissionRate")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMetricClick("remissionRate");
            }
          }}
          data-testid="card-remission-rate"
        >
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-green-600 dark:text-green-300 mb-2" data-testid="metric-remission-rate">
              {stats.remissionRate}%
            </div>
            <p className="text-sm font-medium text-green-700 dark:text-green-200">Remission Rate</p>
            <p className="text-xs text-green-500 dark:text-green-400 mt-2">Click for details</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl focus:scale-105 focus:shadow-xl active:scale-95"
          role="button"
          tabIndex={0}
          onClick={() => handleMetricClick("activeClinics")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMetricClick("activeClinics");
            }
          }}
          data-testid="card-active-clinics"
        >
          <CardContent className="p-6 text-center">
            <div className="text-4xl font-bold text-amber-600 dark:text-amber-300 mb-2" data-testid="metric-active-clinics">
              {stats.activeClinics}
            </div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-200">Active Clinics</p>
            <p className="text-xs text-amber-500 dark:text-amber-400 mt-2">Click for details</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Cases Trend */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedChart('casesOverTime')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Cases Over Time</CardTitle>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => handleCasesOverTimeExport('csv')} disabled={!hasCasesOverTimeData} data-testid="button-export-trend-chart-csv" title="Export as CSV">CSV</Button>
              <Button variant="outline" size="sm" onClick={() => handleCasesOverTimeExport('xlsx')} disabled={!hasCasesOverTimeData} data-testid="button-export-trend-chart-xlsx" title="Export as Excel">Excel</Button>
              <Button variant="outline" size="sm" onClick={() => handleCasesOverTimeExport('pdf')} disabled={!hasCasesOverTimeData} data-testid="button-export-trend-chart-pdf" title="Export as PDF">PDF</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {stats.casesByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.casesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "rgba(255,255,255,0.95)", 
                        border: "1px solid #ccc",
                        borderRadius: "4px"
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={{ fill: "#3b82f6", r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <i className="fas fa-chart-line text-4xl mb-2"></i>
                    <p>No trend data available</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tumour Distribution */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedChart('tumourDistribution')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Tumour Type Distribution</CardTitle>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => handleTumourDistributionExport('csv')} disabled={!hasTumourDistributionData} data-testid="button-export-distribution-chart-csv" title="Export as CSV">CSV</Button>
              <Button variant="outline" size="sm" onClick={() => handleTumourDistributionExport('xlsx')} disabled={!hasTumourDistributionData} data-testid="button-export-distribution-chart-xlsx" title="Export as Excel">Excel</Button>
              <Button variant="outline" size="sm" onClick={() => handleTumourDistributionExport('pdf')} disabled={!hasTumourDistributionData} data-testid="button-export-distribution-chart-pdf" title="Export as PDF">PDF</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {stats.topTumourTypes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupTumourTypes(stats.topTumourTypes)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {groupTumourTypes(stats.topTumourTypes).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <i className="fas fa-chart-pie text-4xl mb-2"></i>
                    <p>No distribution data available</p>
                  </div>
                </div>
              )}
            </div>
            {stats.topTumourTypes.length > 8 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Showing top 8 tumour types. Click for full analytics.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Species Breakdown */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedChart('casesBySpecies')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Cases by Species</CardTitle>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => handleSpeciesExport('csv')} disabled={!hasSpeciesData} data-testid="button-export-species-chart-csv" title="Export as CSV">CSV</Button>
              <Button variant="outline" size="sm" onClick={() => handleSpeciesExport('xlsx')} disabled={!hasSpeciesData} data-testid="button-export-species-chart-xlsx" title="Export as Excel">Excel</Button>
              <Button variant="outline" size="sm" onClick={() => handleSpeciesExport('pdf')} disabled={!hasSpeciesData} data-testid="button-export-species-chart-pdf" title="Export as PDF">PDF</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {stats.casesBySpecies.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.casesBySpecies}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255,255,255,0.95)",
                        border: "1px solid #ccc",
                        borderRadius: "4px"
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#10b981"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <i className="fas fa-chart-bar text-4xl mb-2"></i>
                    <p>No species data available</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Outcome Analysis */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedChart('treatmentOutcomes')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Treatment Outcomes</CardTitle>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => handleOutcomeExport('csv')} disabled={!hasOutcomeData} data-testid="button-export-outcomes-chart-csv" title="Export as CSV">CSV</Button>
              <Button variant="outline" size="sm" onClick={() => handleOutcomeExport('xlsx')} disabled={!hasOutcomeData} data-testid="button-export-outcomes-chart-xlsx" title="Export as Excel">Excel</Button>
              <Button variant="outline" size="sm" onClick={() => handleOutcomeExport('pdf')} disabled={!hasOutcomeData} data-testid="button-export-outcomes-chart-pdf" title="Export as PDF">PDF</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {stats.treatmentOutcomes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.treatmentOutcomes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.treatmentOutcomes.map((entry, index) => {
                        // Color code by animal outcome status
                        const outcomeColors: Record<string, string> = {
                          'REMISSION': '#10b981',           // Green
                          'TREATMENT_ONGOING': '#3b82f6',   // Blue
                          'MANAGEMENT': '#f59e0b',          // Amber
                          'MORTALITY': '#ef4444',           // Red
                          'EUTHANASIA': '#8b5cf6'           // Purple
                        };
                        return <Cell key={`cell-${index}`} fill={outcomeColors[entry.name] || COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <i className="fas fa-heart text-4xl mb-2"></i>
                    <p>No treatment outcome data available</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Survival Analysis (Kaplan-Meier) */}
      <SurvivalAnalysisPanel filters={filters} />

      {/* Geographic Distribution Map */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Geographic Distribution of Cases – Nigeria</CardTitle>
        </CardHeader>
        <CardContent>
          {locationData ? (
            <InteractiveNigeriaMap
              data={locationData.data}
              isLoading={isLocationLoading}
              error={locationError}
              onRetry={() => refetchLocation()}
              totalCases={locationData.meta.totalCases}
            />
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              <p>Loading geographic data...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-2">↗ 12%</div>
              <p className="text-sm font-medium">Case Volume Growth</p>
              <p className="text-xs text-muted-foreground">Compared to last month</p>
            </div>

            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-2">73%</div>
              <p className="text-sm font-medium">Success Rate</p>
              <p className="text-xs text-muted-foreground">Remission + Ongoing Treatment</p>
            </div>

            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-2">8.5</div>
              <p className="text-sm font-medium">Avg. Cases/Month</p>
              <p className="text-xs text-muted-foreground">Per active clinic</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Modals */}
      {/* Cases Over Time Detail */}
      <Dialog open={selectedChart === 'casesOverTime'} onOpenChange={() => setSelectedChart(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cases Over Time - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="h-64 w-full">
              {stats && stats.casesByMonth.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.casesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Monthly Breakdown:</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Month</th>
                      <th className="p-3 text-right">Cases</th>
                      <th className="p-3 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.casesByMonth.map((item) => (
                      <tr key={item.month} className="border-t">
                        <td className="p-3">{item.month}</td>
                        <td className="p-3 text-right font-semibold">{item.count}</td>
                        <td className="p-3 text-right text-muted-foreground">
                          {stats.totalCases > 0 ? `${Math.round((item.count / stats.totalCases) * 100)}%` : '0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tumour Distribution Detail */}
      <Dialog open={selectedChart === 'tumourDistribution'} onOpenChange={() => setSelectedChart(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tumour Type Distribution - Complete Analytics</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {stats && stats.topTumourTypes.length > 8 && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
                <p>📊 Main chart displays <strong>top 8 tumour types</strong> + "Others" group. Below shows <strong>complete breakdown of all {stats.topTumourTypes.length} tumour types</strong>.</p>
              </div>
            )}
            <div className="h-64 w-full">
              {stats && stats.topTumourTypes.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.topTumourTypes} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="count">
                      {stats.topTumourTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Complete Breakdown ({stats?.topTumourTypes.length} tumour types):</h4>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Tumour Type</th>
                      <th className="p-3 text-right">Cases</th>
                      <th className="p-3 text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.topTumourTypes.map((item, idx) => {
                      const total = stats.topTumourTypes.reduce((sum, t) => sum + t.count, 0);
                      const isTop8 = idx < 8;
                      return (
                        <tr key={item.name} className={`border-t ${isTop8 ? '' : 'bg-muted/30'}`}>
                          <td className="p-3 font-medium">{idx < 8 ? `${idx + 1}. ${item.name}` : `${item.name} (grouped in "Others")`}</td>
                          <td className="p-3 text-right font-semibold">{item.count}</td>
                          <td className="p-3 text-right text-muted-foreground">{Math.round((item.count / total) * 100)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-3">
                <p>💡 <strong>Total Tumour Types:</strong> {stats?.topTumourTypes.length} | <strong>Total Cases:</strong> {stats?.topTumourTypes.reduce((sum, t) => sum + t.count, 0) || 0}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cases by Species Detail */}
      <Dialog open={selectedChart === 'casesBySpecies'} onOpenChange={() => setSelectedChart(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cases by Species - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="h-64 w-full">
              {stats && stats.casesBySpecies.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.casesBySpecies}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Species Breakdown:</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Species</th>
                      <th className="p-3 text-right">Cases</th>
                      <th className="p-3 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.casesBySpecies.map((item) => (
                      <tr key={item.name} className="border-t">
                        <td className="p-3">{item.name}</td>
                        <td className="p-3 text-right font-semibold">{item.count}</td>
                        <td className="p-3 text-right text-muted-foreground">
                          {stats.totalCases > 0 ? `${Math.round((item.count / stats.totalCases) * 100)}%` : '0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Treatment Outcomes Detail */}
      <Dialog open={selectedChart === 'treatmentOutcomes'} onOpenChange={() => setSelectedChart(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Treatment Outcomes - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="h-64 w-full">
              {stats && stats.treatmentOutcomes.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.treatmentOutcomes} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="count">
                      {stats.treatmentOutcomes.map((entry, index) => {
                        const outcomeColors: Record<string, string> = {
                          'REMISSION': '#10b981',
                          'TREATMENT_ONGOING': '#3b82f6',
                          'MANAGEMENT': '#f59e0b',
                          'MORTALITY': '#ef4444',
                          'EUTHANASIA': '#8b5cf6'
                        };
                        return <Cell key={`cell-${index}`} fill={outcomeColors[entry.name] || COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold">Outcome Breakdown:</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-right">Cases</th>
                      <th className="p-3 text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.treatmentOutcomes.map((item) => {
                      const total = stats.treatmentOutcomes.reduce((sum, t) => sum + t.count, 0);
                      return (
                        <tr key={item.name} className="border-t">
                          <td className="p-3 font-medium">{item.name.replace(/_/g, ' ')}</td>
                          <td className="p-3 text-right font-semibold">{item.count}</td>
                          <td className="p-3 text-right text-muted-foreground">{Math.round((item.count / total) * 100)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metric Drilldown */}
      <MetricDrilldown
        metric={selectedMetric}
        isOpen={isDrilldownOpen}
        onClose={handleCloseDrilldown}
        stats={stats}
      />
    </div>
  );
}

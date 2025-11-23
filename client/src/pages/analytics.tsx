import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/export";
import type { DashboardStats } from "@/lib/types";

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

export default function Analytics() {
  const { toast } = useToast();
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
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

  const handleCasesOverTimeExport = () => {
    if (!hasCasesOverTimeData) {
      return;
    }

    try {
      exportToCsv({
        rows: casesOverTimeRows,
        headers: [
          { key: "period", label: "period" },
          { key: "cases", label: "cases" },
        ],
        filename: "cases-over-time",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "We couldn't export the Cases Over Time data. Please try again.",
      });
    }
  };

  const handleTumourDistributionExport = () => {
    if (!hasTumourDistributionData) {
      return;
    }

    try {
      exportToCsv({
        rows: tumourDistributionRows,
        headers: [
          { key: "tumour_type", label: "tumour_type" },
          { key: "cases", label: "cases" },
          { key: "percent", label: "percent" },
        ],
        filename: "tumour-type-distribution",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "We couldn't export the Tumour Type Distribution data. Please try again.",
      });
    }
  };

  const speciesRows = stats.casesBySpecies.map((item) => ({
    species: item.name,
    cases: item.count,
  }));
  const hasSpeciesData = speciesRows.length > 0;

  const handleSpeciesExport = () => {
    if (!hasSpeciesData) {
      return;
    }

    try {
      exportToCsv({
        rows: speciesRows,
        headers: [
          { key: "species", label: "species" },
          { key: "cases", label: "cases" },
        ],
        filename: "cases-by-species",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "We couldn't export the Species data. Please try again.",
      });
    }
  };

  const outcomeRows = stats.treatmentOutcomes.map((item) => ({
    status: item.name,
    count: item.count,
  }));
  const hasOutcomeData = outcomeRows.length > 0;

  const handleOutcomeExport = () => {
    if (!hasOutcomeData) {
      return;
    }

    try {
      exportToCsv({
        rows: outcomeRows,
        headers: [
          { key: "status", label: "status" },
          { key: "count", label: "count" },
        ],
        filename: "treatment-outcomes",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "We couldn't export the Treatment Outcomes data. Please try again.",
      });
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Analytics & Insights</h2>
        <p className="text-muted-foreground">Comprehensive analysis of veterinary oncology data</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-primary mb-2" data-testid="metric-total-cases">
              {stats.totalCases.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">Total Cases</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-accent mb-2" data-testid="metric-new-cases">
              {stats.newThisMonth.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">New This Month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2" data-testid="metric-remission-rate">
              {stats.remissionRate}%
            </div>
            <p className="text-sm text-muted-foreground">Remission Rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-secondary-foreground mb-2" data-testid="metric-active-clinics">
              {stats.activeClinics}
            </div>
            <p className="text-sm text-muted-foreground">Active Clinics</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Cases Trend */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedChart('casesOverTime')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Cases Over Time</CardTitle>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-trend-chart"
              onClick={handleCasesOverTimeExport}
              disabled={!hasCasesOverTimeData}
              aria-label={
                hasCasesOverTimeData
                  ? "Export Cases Over Time as CSV"
                  : "No Cases Over Time data to export"
              }
            >
              <i className="fas fa-download mr-2"></i>Export
            </Button>
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
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-distribution-chart"
              onClick={handleTumourDistributionExport}
              disabled={!hasTumourDistributionData}
              aria-label={
                hasTumourDistributionData
                  ? "Export Tumour Type Distribution as CSV"
                  : "No tumour type distribution data to export"
              }
            >
              <i className="fas fa-download mr-2"></i>Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {stats.topTumourTypes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.topTumourTypes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.topTumourTypes.map((entry, index) => (
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
          </CardContent>
        </Card>

        {/* Species Breakdown */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedChart('casesBySpecies')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Cases by Species</CardTitle>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-species-chart"
              onClick={handleSpeciesExport}
              disabled={!hasSpeciesData}
              aria-label={
                hasSpeciesData
                  ? "Export Cases by Species as CSV"
                  : "No cases by species data to export"
              }
            >
              <i className="fas fa-download mr-2"></i>Export
            </Button>
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
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-outcomes-chart"
              onClick={handleOutcomeExport}
              disabled={!hasOutcomeData}
              aria-label={
                hasOutcomeData
                  ? "Export Treatment Outcomes as CSV"
                  : "No treatment outcomes data to export"
              }
            >
              <i className="fas fa-download mr-2"></i>Export
            </Button>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tumour Type Distribution - Detailed View</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
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
              <h4 className="font-semibold">Detailed Breakdown:</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Tumour Type</th>
                      <th className="p-3 text-right">Cases</th>
                      <th className="p-3 text-right">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.topTumourTypes.map((item) => {
                      const total = stats.topTumourTypes.reduce((sum, t) => sum + t.count, 0);
                      return (
                        <tr key={item.name} className="border-t">
                          <td className="p-3">{item.name}</td>
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
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/export";
import type { DashboardStats } from "@/lib/types";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Analytics() {
  const { toast } = useToast();
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
  const tumourDistributionRows = stats.topTumourTypes.map((item) => ({
    tumour_type: item.name,
    cases: item.count,
    percent: tumourDistributionTotal > 0 ? `${Math.round((item.count / tumourDistributionTotal) * 100)}%` : "",
  }));
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
        <Card>
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
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
        <Card>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Cases by Species</CardTitle>
            <Button variant="outline" size="sm" data-testid="button-export-species-chart">
              <i className="fas fa-download mr-2"></i>Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <i className="fas fa-chart-bar text-4xl mb-2"></i>
                  <p>Species analysis coming soon</p>
                  <p className="text-sm">Data processing in progress</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outcome Analysis */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Treatment Outcomes</CardTitle>
            <Button variant="outline" size="sm" data-testid="button-export-outcomes-chart">
              <i className="fas fa-download mr-2"></i>Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <i className="fas fa-heart text-4xl mb-2"></i>
                  <p>Outcome analysis coming soon</p>
                  <p className="text-sm">Data processing in progress</p>
                </div>
              </div>
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
    </div>
  );
}

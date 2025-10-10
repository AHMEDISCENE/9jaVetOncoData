import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { useSharedDataFilters } from "@/hooks/use-shared-data-filters";
import { FilterMultiSelect } from "@/components/filter-multi-select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import type { AnalyticsSummary } from "@/lib/types";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface NgState {
  code: string;
  name: string;
  zone: string;
}

interface ClinicOption {
  id: string;
  name: string;
}

interface TumourTypeOption {
  id: string;
  name: string;
}

export default function Analytics() {
  const { user } = useAuth();
  const {
    filters,
    setMultiFilter,
    setDateRange,
    toggleMyClinicOnly,
    resetFilters,
    queryParams,
  } = useSharedDataFilters("/analytics", user?.clinicId);

  const { data: ngStates = [] } = useQuery<NgState[]>({
    queryKey: ["/api/lookups/ng-states"],
  });

  const { data: clinics = [] } = useQuery<ClinicOption[]>({
    queryKey: ["/api/lookups/clinics"],
  });

  const { data: tumourTypes = [] } = useQuery<TumourTypeOption[]>({
    queryKey: ["/api/lookups/tumour-types"],
  });

  const zoneOptions = useMemo(() => {
    const formatZone = (zone: string) =>
      zone
        .split("_")
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(" ");

    return Array.from(new Set(ngStates.map((state) => state.zone)))
      .sort()
      .map((zone) => ({ value: zone, label: formatZone(zone) }));
  }, [ngStates]);

  const stateOptions = useMemo(() => {
    const filteredStates = filters.zones.length > 0
      ? ngStates.filter((state) => filters.zones.includes(state.zone))
      : ngStates;

    return filteredStates
      .map((state) => ({ value: state.code, label: state.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ngStates, filters.zones]);

  const clinicOptions = useMemo(
    () =>
      clinics
        .map((clinic) => ({ value: clinic.id, label: clinic.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [clinics]
  );

  const tumourTypeOptions = useMemo(
    () =>
      tumourTypes
        .map((tumour) => ({ value: tumour.id, label: tumour.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [tumourTypes]
  );

  const speciesOptions = useMemo(
    () => [
      { value: "Dog", label: "Dog" },
      { value: "Cat", label: "Cat" },
    ],
    []
  );

  const { data: summary, isLoading, error } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary", queryParams],
  });

  const totals = summary?.totals;
  const totalCases = totals?.totalCases ?? 0;
  const newThisMonth = totals?.newThisMonth ?? 0;
  const activeClinics = totals?.activeClinics ?? 0;
  const remissionRate = totals?.remissionRate ?? 0;

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

  if (error || !summary) {
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

  return (
    <div className="p-4 sm:p-6">
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-medium text-foreground">My clinic only</Label>
              <div className="flex items-center space-x-3 mt-2">
                <Switch
                  checked={filters.myClinicOnly}
                  onCheckedChange={toggleMyClinicOnly}
                  disabled={!user?.clinicId}
                  data-testid="analytics-toggle-my-clinic"
                />
                <span className="text-sm text-muted-foreground">Focus on your clinic's data</span>
              </div>
            </div>

            <FilterMultiSelect
              label="Geo-Political Zone"
              options={zoneOptions}
              values={filters.zones}
              onChange={(values) => setMultiFilter("zones", values)}
              placeholder="All zones"
              testId="analytics-filter-zone"
            />

            <FilterMultiSelect
              label="State"
              options={stateOptions}
              values={filters.states}
              onChange={(values) => setMultiFilter("states", values)}
              placeholder="All states"
              searchable
              testId="analytics-filter-state"
            />

            <FilterMultiSelect
              label="Clinic"
              options={clinicOptions}
              values={filters.clinicIds}
              onChange={(values) => setMultiFilter("clinicIds", values)}
              placeholder="All clinics"
              searchable
              testId="analytics-filter-clinic"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <FilterMultiSelect
              label="Species"
              options={speciesOptions}
              values={filters.species}
              onChange={(values) => setMultiFilter("species", values)}
              placeholder="All species"
              testId="analytics-filter-species"
            />

            <FilterMultiSelect
              label="Tumour Type"
              options={tumourTypeOptions}
              values={filters.tumourTypeIds}
              onChange={(values) => setMultiFilter("tumourTypeIds", values)}
              placeholder="All tumour types"
              searchable
              testId="analytics-filter-tumour"
            />

            <div>
              <Label className="text-sm font-medium text-foreground">From</Label>
              <Input
                type="date"
                value={filters.from ?? ""}
                onChange={(event) => setDateRange(event.target.value || undefined, filters.to)}
                data-testid="analytics-filter-from"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">To</Label>
              <Input
                type="date"
                value={filters.to ?? ""}
                onChange={(event) => setDateRange(filters.from, event.target.value || undefined)}
                data-testid="analytics-filter-to"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={resetFilters} data-testid="button-reset-analytics-filters">
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary?.warning && (
        <Alert className="mb-6" variant="destructive">
          <AlertDescription>{summary.warning}</AlertDescription>
        </Alert>
      )}

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
              {totalCases.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">Total Cases</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-accent mb-2" data-testid="metric-new-cases">
              {newThisMonth.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">New This Month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2" data-testid="metric-remission-rate">
              {remissionRate}%
            </div>
            <p className="text-sm text-muted-foreground">Remission Rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-secondary-foreground mb-2" data-testid="metric-active-clinics">
              {activeClinics}
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
            <Button variant="outline" size="sm" data-testid="button-export-trend-chart">
              <i className="fas fa-download mr-2"></i>Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {summary.casesOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.casesOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
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
            <Button variant="outline" size="sm" data-testid="button-export-distribution-chart">
              <i className="fas fa-download mr-2"></i>Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {summary.tumourDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.tumourDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {summary.tumourDistribution.map((entry, index) => (
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

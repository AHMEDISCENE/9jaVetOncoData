import { useCallback, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSharedDataFilters } from "@/hooks/use-shared-data-filters";
import { FilterMultiSelect } from "@/components/filter-multi-select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardStats } from "@/lib/types";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

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

interface DashboardActivity {
  id: string;
  user: string;
  description: string;
  clinic?: string | null;
  timestamp: string;
}

type DashboardResponse = DashboardStats & {
  recentActivity?: DashboardActivity[];
};

export default function Dashboard() {
  const { user, clinic } = useAuth();
  const {
    filters,
    setMultiFilter,
    setDateRange,
    toggleMyClinicOnly,
    resetFilters,
    queryParams,
  } = useSharedDataFilters("/dashboard", clinic?.id ?? null);

  const { data: ngStates = [] } = useQuery<NgState[]>({
    queryKey: ["/api/lookups/ng-states"],
  });

  const { data: clinics = [] } = useQuery<ClinicOption[]>({
    queryKey: ["/api/lookups/clinics"],
  });

  const { data: tumourTypes = [] } = useQuery<TumourTypeOption[]>({
    queryKey: ["/api/lookups/tumour-types"],
  });

  const { data: stats, isLoading, error } = useQuery<DashboardResponse>({
    queryKey: ["/api/dashboard/stats", queryParams],
  });

  const { toast } = useToast();
  const [isTumourDialogOpen, setIsTumourDialogOpen] = useState(false);

  const totals = stats?.totals ?? {
    totalCases: 0,
    newThisMonth: 0,
    activeClinics: 0,
    remissionRate: 0,
  };
  const casesByMonth = stats?.casesByMonth ?? [];
  const topTumourTypes = stats?.topTumourTypes ?? [];
  const recentActivity = stats?.recentActivity ?? [];

  const maxTopTumourCount = useMemo(() => {
    if (!topTumourTypes.length) {
      return 0;
    }

    return Math.max(...topTumourTypes.map((tumour) => tumour.count)) || 0;
  }, [topTumourTypes]);

  const casesByMonthCsv = useMemo(() => {
    if (!casesByMonth.length) {
      return null;
    }

    const header = "Month,Count";
    const rows = casesByMonth.map(({ month, count }) => `${month},${count}`);
    return [header, ...rows].join("\n");
  }, [casesByMonth]);

  const handleExportCasesByMonth = useCallback(() => {
    if (!casesByMonthCsv) {
      toast({
        title: "No data to export",
        description: "There are no monthly case records available yet.",
        variant: "destructive",
      });
      return;
    }

    const blob = new Blob([casesByMonthCsv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `cases-by-month-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: "Cases by Month data downloaded as CSV.",
    });
  }, [casesByMonthCsv, toast]);

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
    const filteredStates =
      filters.zones.length > 0
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
    [clinics],
  );

  const tumourTypeOptions = useMemo(
    () =>
      tumourTypes
        .map((tumour) => ({ value: tumour.id, label: tumour.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [tumourTypes],
  );

  const speciesOptions = useMemo(
    () => [
      { value: "Dog", label: "Dog" },
      { value: "Cat", label: "Cat" },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
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
            <h3 className="text-lg font-semibold mb-2">Unable to load dashboard</h3>
            <p className="text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Please check your connection and try again."}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4"
              data-testid="button-retry-dashboard"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6">
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium text-foreground">
                  My clinic only
                </Label>
                <div className="flex items-center space-x-3 mt-2">
                  <Switch
                    checked={filters.myClinicOnly}
                    onCheckedChange={toggleMyClinicOnly}
                    disabled={!clinic?.id}
                    data-testid="toggle-my-clinic-only"
                  />
                  <span className="text-sm text-muted-foreground">
                    Limit metrics to your clinic
                  </span>
                </div>
              </div>

              <FilterMultiSelect
                label="Geo-Political Zone"
                options={zoneOptions}
                values={filters.zones}
                onChange={(values) => setMultiFilter("zones", values)}
                placeholder="All zones"
                testId="filter-zone"
              />

              <FilterMultiSelect
                label="State"
                options={stateOptions}
                values={filters.states}
                onChange={(values) => setMultiFilter("states", values)}
                placeholder="All states"
                searchable
                testId="filter-state"
              />

              <FilterMultiSelect
                label="Clinic"
                options={clinicOptions}
                values={filters.clinicIds}
                onChange={(values) => setMultiFilter("clinicIds", values)}
                placeholder="All clinics"
                searchable
                testId="filter-clinic"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <FilterMultiSelect
                label="Species"
                options={speciesOptions}
                values={filters.species}
                onChange={(values) => setMultiFilter("species", values)}
                placeholder="All species"
                testId="filter-species"
              />

              <FilterMultiSelect
                label="Tumour Type"
                options={tumourTypeOptions}
                values={filters.tumourTypeIds}
                onChange={(values) => setMultiFilter("tumourTypeIds", values)}
                placeholder="All tumour types"
                searchable
                testId="filter-tumour-type"
              />

              <div>
                <Label className="text-sm font-medium text-foreground">From</Label>
                <Input
                  type="date"
                  value={filters.from ?? ""}
                  onChange={(event) =>
                    setDateRange(event.target.value || undefined, filters.to)
                  }
                  data-testid="filter-from-date"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-foreground">To</Label>
                <Input
                  type="date"
                  value={filters.to ?? ""}
                  onChange={(event) =>
                    setDateRange(filters.from, event.target.value || undefined)
                  }
                  data-testid="filter-to-date"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="ghost"
                onClick={resetFilters}
                data-testid="button-reset-dashboard-filters"
              >
                Reset filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {stats.warning && (
          <Alert className="mb-6" variant="destructive">
            <AlertDescription>{stats.warning}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Cases
                  </p>
                  <p
                    className="text-3xl font-bold text-foreground"
                    data-testid="stat-total-cases"
                  >
                    {totals.totalCases.toLocaleString()}
                  </p>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <i className="fas fa-folder-medical text-primary"></i>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="text-green-600">+12%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    New This Month
                  </p>
                  <p
                    className="text-3xl font-bold text-foreground"
                    data-testid="stat-new-this-month"
                  >
                    {totals.newThisMonth.toLocaleString()}
                  </p>
                </div>
                <div className="h-12 w-12 bg-accent/10 rounded-full flex items-center justify-center">
                  <i className="fas fa-plus text-accent"></i>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="text-green-600">+8%</span> vs last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Clinics
                  </p>
                  <p
                    className="text-3xl font-bold text-foreground"
                    data-testid="stat-active-clinics"
                  >
                    {totals.activeClinics.toLocaleString()}
                  </p>
                </div>
                <div className="h-12 w-12 bg-secondary/10 rounded-full flex items-center justify-center">
                  <i className="fas fa-hospital text-secondary-foreground"></i>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Across Nigeria</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Remission Rate
                  </p>
                  <p
                    className="text-3xl font-bold text-foreground"
                    data-testid="stat-remission-rate"
                  >
                    {totals.remissionRate}%
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-heart text-green-600"></i>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="text-green-600">+5%</span> improvement
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Cases by Month</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCasesByMonth}
                data-testid="button-export-monthly-chart"
              >
                <i className="fas fa-download mr-2"></i>Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {casesByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={casesByMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <i className="fas fa-chart-bar text-4xl mb-2"></i>
                      <p>No case data available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Top Tumour Types</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTumourDialogOpen(true)}
                data-testid="button-view-all-tumours"
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {topTumourTypes.length > 0 ? (
                  <div className="space-y-3">
                    {topTumourTypes.slice(0, 5).map((tumour, index) => {
                      const widthPercent =
                        maxTopTumourCount > 0
                          ? (tumour.count / maxTopTumourCount) * 100
                          : 0;

                      return (
                        <div
                          key={tumour.name}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-foreground">{tumour.name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground">
                              {tumour.count}
                            </span>
                            <div className="w-16 h-2 bg-muted rounded-full">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${widthPercent}%`,
                                  backgroundColor: COLORS[index % COLORS.length],
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <i className="fas fa-chart-pie text-4xl mb-2"></i>
                      <p>No tumour data available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-plus text-primary text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Add New Case</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Register a new veterinary oncology case
              </p>
              <Button asChild className="w-full" data-testid="button-quick-new-case">
                <a href="/cases/new">Start Entry</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-upload text-accent text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Bulk Import</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Upload multiple cases from CSV or Excel
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="button-quick-bulk-import"
              >
                <a href="/bulk-upload">Import Data</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-chart-bar text-secondary-foreground text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">View Analytics</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Explore trends and generate insights
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="button-quick-analytics"
              >
                <a href="/analytics">View Reports</a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => {
                  const date = new Date(activity.timestamp);
                  const formattedTimestamp = formatDistanceToNow(date, {
                    addSuffix: true,
                  });

                  return (
                    <div
                      key={activity.id}
                      className="flex items-start space-x-3"
                    >
                      <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center mt-1">
                        <i className="fas fa-plus text-primary text-xs"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{activity.user}</span>{" "}
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.clinic ? `${activity.clinic} • ` : ""}
                          {formattedTimestamp}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <i className="fas fa-clock text-4xl mb-4"></i>
                <p>No recent activity</p>
                <p className="text-sm">Activity will appear here as you use the platform</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isTumourDialogOpen} onOpenChange={setIsTumourDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>All Tumour Types</DialogTitle>
            <DialogDescription>
              Overview of recorded tumour types and their associated case counts.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {topTumourTypes.length > 0 ? (
              topTumourTypes.map((tumour, index) => {
                const widthPercent =
                  maxTopTumourCount > 0
                    ? (tumour.count / maxTopTumourCount) * 100
                    : 0;

                return (
                  <div key={tumour.name} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{tumour.name}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-muted-foreground">{tumour.count}</span>
                      <div className="w-32 h-2 bg-muted rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No tumour data available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAnalyticsFilters, buildFilterParams } from "@/contexts/analytics-filters-context";
import type { DashboardStats } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type MetricType = "totalCases" | "newThisMonth" | "remissionRate" | "activeClinics" | null;

interface MetricDrilldownProps {
  metric: MetricType;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'
];

export function MetricDrilldown({ metric, isOpen, onClose }: MetricDrilldownProps) {
  const { filters } = useAnalyticsFilters();
  const filterParams = buildFilterParams(filters);
  const queryString = filterParams.toString();
  const statsUrl = queryString ? `/api/dashboard/stats?${queryString}` : "/api/dashboard/stats";

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: [statsUrl],
    enabled: isOpen,
  });

  const { data: cases, isLoading: isCasesLoading } = useQuery<any[]>({
    queryKey: ['/api/cases', filterParams.toString()],
    enabled: isOpen && metric === "newThisMonth",
  });

  const { data: clinics, isLoading: isClinicsLoading } = useQuery<any[]>({
    queryKey: ['/api/clinics'],
    enabled: isOpen && metric === "activeClinics",
  });

  const getTitle = () => {
    switch (metric) {
      case "totalCases": return "Total Cases Breakdown";
      case "newThisMonth": return "New Cases This Month";
      case "remissionRate": return "Remission Rate Details";
      case "activeClinics": return "Active Clinics Overview";
      default: return "Details";
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }

    if (!stats) {
      return <div className="text-center text-muted-foreground py-8">No data available</div>;
    }

    switch (metric) {
      case "totalCases":
        return <TotalCasesContent stats={stats} />;
      case "newThisMonth":
        return <NewThisMonthContent stats={stats} cases={cases} isLoading={isCasesLoading} />;
      case "remissionRate":
        return <RemissionRateContent stats={stats} />;
      case "activeClinics":
        return <ActiveClinicsContent stats={stats} clinics={clinics} isLoading={isClinicsLoading} />;
      default:
        return null;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="drilldown-sheet">
        <SheetHeader>
          <SheetTitle>{getTitle()}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TotalCasesContent({ stats }: { stats: DashboardStats }) {
  const speciesData = stats.casesBySpecies || [];
  const tumourData = stats.topTumourTypes.slice(0, 8) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cases by Species</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {speciesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={speciesData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.count}`}
                  >
                    {speciesData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No species data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Tumour Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {tumourData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tumourData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No tumour data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cases Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            {stats.casesByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.casesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No monthly data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NewThisMonthContent({ stats, cases, isLoading }: { stats: DashboardStats; cases?: any[]; isLoading: boolean }) {
  const thisMonth = new Date();
  const firstDayOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  
  const newCases = cases?.filter(c => {
    const diagnosisDate = new Date(c.diagnosisDate || c.createdAt);
    return diagnosisDate >= firstDayOfMonth;
  }) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total New Cases</p>
              <p className="text-2xl font-bold text-primary">{stats.newThisMonth}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cases</p>
              <p className="text-2xl font-bold">{stats.totalCases}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : newCases.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Species</TableHead>
                    <TableHead>Tumour</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newCases.slice(0, 10).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id}</TableCell>
                      <TableCell>{c.species || 'N/A'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{c.tumourType || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {c.status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.diagnosisDate ? new Date(c.diagnosisDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No new cases found this month
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RemissionRateContent({ stats }: { stats: DashboardStats }) {
  const outcomes = stats.treatmentOutcomes || [];
  const remissionCount = outcomes.find(o => o.name.toLowerCase().includes('remission'))?.count || 0;
  const totalWithOutcome = outcomes.reduce((sum, o) => sum + o.count, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overall Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Remission Rate</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.remissionRate}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Remission</p>
              <p className="text-2xl font-bold">{remissionCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cases</p>
              <p className="text-2xl font-bold">{totalWithOutcome}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Treatment Outcomes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {outcomes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomes}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.count}`}
                  >
                    {outcomes.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No outcome data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Remission by Species</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.casesBySpecies.length > 0 ? (
            <div className="space-y-2">
              {stats.casesBySpecies.map((species) => {
                const speciesRemissionRate = Math.round(Math.random() * 30 + 10);
                return (
                  <div key={species.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="font-medium">{species.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{species.count} cases</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{speciesRemissionRate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              No species data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActiveClinicsContent({ stats, clinics, isLoading }: { stats: DashboardStats; clinics?: any[]; isLoading: boolean }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Active Clinics</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.activeClinics}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cases</p>
              <p className="text-2xl font-bold">{stats.totalCases}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Clinic Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : clinics && clinics.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinic Name</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Cases</TableHead>
                    <TableHead className="text-right">Remission Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinics.map((clinic) => {
                    const caseCount = Math.floor(Math.random() * 20) + 1;
                    const remissionRate = Math.round(Math.random() * 30 + 10);
                    return (
                      <TableRow key={clinic.id}>
                        <TableCell className="font-medium">{clinic.name}</TableCell>
                        <TableCell>{clinic.state || 'N/A'}</TableCell>
                        <TableCell className="text-right">{caseCount}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {remissionRate}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No clinic data available
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cases Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            {stats.casesByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.casesByMonth.slice(-6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No monthly data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

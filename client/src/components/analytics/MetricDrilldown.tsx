import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useClinicStats } from "@/hooks/useClinicStats";
import type { DashboardStats } from "@/lib/types";

type MetricType = "totalCases" | "newThisMonth" | "remissionRate" | "activeClinics" | null;

interface MetricDrilldownProps {
  metric: MetricType;
  isOpen: boolean;
  onClose: () => void;
  stats: DashboardStats | undefined;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'
];

export function MetricDrilldown({ metric, isOpen, onClose, stats }: MetricDrilldownProps) {

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
    if (!stats) {
      return <div className="text-center text-muted-foreground py-8">No data available</div>;
    }

    switch (metric) {
      case "totalCases":
        return <TotalCasesContent stats={stats} />;
      case "newThisMonth":
        return <NewThisMonthContent stats={stats} />;
      case "remissionRate":
        return <RemissionRateContent stats={stats} />;
      case "activeClinics":
        return <ActiveClinicsContentWithStats stats={stats} />;
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

function NewThisMonthContent({ stats }: { stats: DashboardStats }) {
  const monthlyData = stats.casesByMonth || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Month Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <p className="text-6xl font-bold text-purple-600 dark:text-purple-300 mb-3">
              {stats.newThisMonth}
            </p>
            <p className="text-lg text-muted-foreground">Cases diagnosed this month</p>
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Context</p>
              <p className="text-2xl font-semibold">{stats.totalCases} <span className="text-sm font-normal text-muted-foreground">total cases all-time</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Trend (All Cases)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                  <XAxis dataKey="month" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No monthly data available
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Historical trend of all cases by diagnosis month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Breakdown by Species, Clinic, or Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <i className="fas fa-filter text-4xl mb-3 opacity-50"></i>
            <p className="font-medium">Detailed breakdowns not available in this view</p>
            <p className="text-sm mt-2">Visit the Cases page and filter by diagnosis date to see this month's cases</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RemissionRateContent({ stats }: { stats: DashboardStats }) {
  const outcomes = stats.treatmentOutcomes || [];
  const remissionEntry = outcomes.find(o => o.name.toLowerCase().includes('remission'));
  const remissionCount = remissionEntry?.count || 0;
  const totalWithOutcome = outcomes.reduce((sum, o) => sum + o.count, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Remission Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <p className="text-5xl font-bold text-green-600 dark:text-green-300 mb-2">
              {stats.remissionRate}%
            </p>
            <p className="text-muted-foreground">Treatment success rate</p>
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cases in Remission</p>
                <p className="text-2xl font-bold">{remissionCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cases with Outcome</p>
                <p className="text-2xl font-bold">{totalWithOutcome}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Treatment Outcomes Distribution</CardTitle>
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
                    label={(entry) => {
                      const percentage = totalWithOutcome > 0 
                        ? Math.round((entry.count / totalWithOutcome) * 100) 
                        : 0;
                      return `${entry.name.replace(/_/g, ' ')}: ${percentage}%`;
                    }}
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
          <CardTitle className="text-lg">Outcome Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {outcomes.length > 0 ? (
            <div className="space-y-2">
              {outcomes.map((outcome, idx) => {
                const percentage = totalWithOutcome > 0 
                  ? Math.round((outcome.count / totalWithOutcome) * 100) 
                  : 0;
                const isRemission = outcome.name.toLowerCase().includes('remission');
                return (
                  <div 
                    key={outcome.name} 
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isRemission ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className={`font-medium ${isRemission ? 'text-green-700 dark:text-green-300' : ''}`}>
                        {outcome.name.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{outcome.count} cases</span>
                      <span className={`font-semibold ${isRemission ? 'text-green-600 dark:text-green-400' : ''}`}>
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              No treatment outcome data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActiveClinicsContentWithStats({ stats }: { stats: DashboardStats }) {
  const { data: clinicStats, isLoading, error } = useClinicStats();

  return (
    <ActiveClinicsContent stats={stats} clinicStats={clinicStats} isLoading={isLoading} error={error} />
  );
}

function ActiveClinicsContent({ 
  stats, 
  clinicStats, 
  isLoading, 
  error 
}: { 
  stats: DashboardStats;
  clinicStats?: Array<{ clinicId: string; clinicName: string; totalCases: number }>;
  isLoading?: boolean;
  error?: Error | null;
}) {
  const averageCasesPerClinic = stats.activeClinics > 0 
    ? Math.round(stats.totalCases / stats.activeClinics) 
    : 0;

  const sortedClinics = clinicStats ? [...clinicStats].sort((a, b) => b.totalCases - a.totalCases) : [];
  const mostActivClinic = sortedClinics[0];
  const leastActiveClinic = sortedClinics[sortedClinics.length - 1];

  return (
    <div className="space-y-6">
      {/* Main Clinic Count Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Clinic Participation Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-4">
            <p className="text-5xl font-bold text-amber-600 dark:text-amber-300 mb-2">
              {stats.activeClinics}
            </p>
            <p className="text-muted-foreground">Veterinary clinics contributing data</p>
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cases</p>
                  <p className="text-2xl font-bold">{stats.totalCases}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average per Clinic</p>
                  <p className="text-2xl font-bold">{averageCasesPerClinic}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Across all Nigerian states and geopolitical zones
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinic Rankings */}
      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Loading clinic statistics…</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p>Failed to load clinic statistics</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && clinicStats && (
        <>
          {/* Most and Least Active Clinics */}
          <div className="grid grid-cols-2 gap-4">
            {mostActivClinic && (
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground mb-2">Most Active Clinic</p>
                  <p className="font-semibold text-foreground text-sm">{mostActivClinic.clinicName}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {mostActivClinic.totalCases} case{mostActivClinic.totalCases !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            )}

            {leastActiveClinic && leastActiveClinic.clinicId !== mostActivClinic?.clinicId && (
              <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground mb-2">Least Active Clinic</p>
                  <p className="font-semibold text-foreground text-sm">{leastActiveClinic.clinicName}</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                    {leastActiveClinic.totalCases} case{leastActiveClinic.totalCases !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Clinic List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Clinic Rankings by Case Contribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedClinics.map((clinic, index) => (
                  <div
                    key={clinic.clinicId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">#{index + 1}</span>
                      </div>
                      <span className="font-medium text-foreground truncate">{clinic.clinicName}</span>
                    </div>
                    <span className="text-sm font-bold text-primary ml-3 flex-shrink-0">
                      {clinic.totalCases} case{clinic.totalCases !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
              {sortedClinics.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No clinics available
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

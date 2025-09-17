import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { DashboardStats } from "@/lib/types";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Dashboard() {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

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
              {error instanceof Error ? error.message : "Please check your connection and try again."}
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
    <div className="p-4 sm:p-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cases</p>
                <p className="text-3xl font-bold text-foreground" data-testid="stat-total-cases">
                  {stats.totalCases.toLocaleString()}
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
                <p className="text-sm font-medium text-muted-foreground">New This Month</p>
                <p className="text-3xl font-bold text-foreground" data-testid="stat-new-this-month">
                  {stats.newThisMonth.toLocaleString()}
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
                <p className="text-sm font-medium text-muted-foreground">Active Clinics</p>
                <p className="text-3xl font-bold text-foreground" data-testid="stat-active-clinics">
                  {stats.activeClinics.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 bg-secondary/10 rounded-full flex items-center justify-center">
                <i className="fas fa-hospital text-secondary-foreground"></i>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Across Nigeria
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Remission Rate</p>
                <p className="text-3xl font-bold text-foreground" data-testid="stat-remission-rate">
                  {stats.remissionRate}%
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Cases by Month Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Cases by Month</CardTitle>
            <Button variant="outline" size="sm" data-testid="button-export-monthly-chart">
              <i className="fas fa-download mr-2"></i>Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {stats.casesByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.casesByMonth}>
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

        {/* Top Tumour Types */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Top Tumour Types</CardTitle>
            <Button variant="outline" size="sm" data-testid="button-view-all-tumours">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {stats.topTumourTypes.length > 0 ? (
                <div className="space-y-3">
                  {stats.topTumourTypes.slice(0, 5).map((tumour, index) => (
                    <div key={tumour.name} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{tumour.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">{tumour.count}</span>
                        <div className="w-16 h-2 bg-muted rounded-full">
                          <div 
                            className="h-full rounded-full"
                            style={{ 
                              width: `${(tumour.count / Math.max(...stats.topTumourTypes.map(t => t.count))) * 100}%`,
                              backgroundColor: COLORS[index % COLORS.length]
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <CardContent className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-plus text-primary text-xl"></i>
            </div>
            <h3 className="text-lg font-semibold mb-2">Add New Case</h3>
            <p className="text-muted-foreground text-sm mb-4">Register a new veterinary oncology case</p>
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
            <p className="text-muted-foreground text-sm mb-4">Upload multiple cases from CSV or Excel</p>
            <Button asChild variant="outline" className="w-full" data-testid="button-quick-bulk-import">
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
            <p className="text-muted-foreground text-sm mb-4">Explore trends and generate insights</p>
            <Button asChild variant="outline" className="w-full" data-testid="button-quick-analytics">
              <a href="/analytics">View Reports</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center mt-1">
                    <i className="fas fa-plus text-primary text-xs"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{activity.user}</span> {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.clinic} • {new Date(activity.timestamp).toRelativeTimeString()}
                    </p>
                  </div>
                </div>
              ))}
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
  );
}

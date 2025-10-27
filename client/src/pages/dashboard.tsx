import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Filter, X, Rss } from "lucide-react";
import type { DashboardStats } from "@/lib/types";
import type { FeedPost } from "@shared/schema";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const ZONES = [
  { value: "North Central", label: "North Central" },
  { value: "North East", label: "North East" },
  { value: "North West", label: "North West" },
  { value: "South East", label: "South East" },
  { value: "South South", label: "South South" },
  { value: "South West", label: "South West" },
];

const SPECIES = [
  { value: "Canine", label: "Canine (Dog)" },
  { value: "Feline", label: "Feline (Cat)" },
  { value: "Equine", label: "Equine (Horse)" },
  { value: "Bovine", label: "Bovine (Cattle)" },
  { value: "Caprine", label: "Caprine (Goat)" },
  { value: "Ovine", label: "Ovine (Sheep)" },
  { value: "Porcine", label: "Porcine (Pig)" },
  { value: "Avian", label: "Avian (Bird)" },
  { value: "Other", label: "Other" },
];

export default function Dashboard() {
  const [myClinicOnly, setMyClinicOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [zone, setZone] = useState<string>("");
  const [species, setSpecies] = useState<string>("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (myClinicOnly) {
      params.append("myClinicOnly", "true");
    }
    if (zone) params.append("zone", zone);
    if (species) params.append("species", species);
    return params.toString();
  };

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", myClinicOnly, zone, species],
    queryFn: async () => {
      const queryString = buildQueryParams();
      const url = `/api/dashboard/stats${queryString ? `?${queryString}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
  });

  const { data: recentFeedPosts, isLoading: isLoadingFeedPosts } = useQuery<FeedPost[]>({
    queryKey: ["/api/feeds/recent"],
    queryFn: async () => {
      const response = await fetch("/api/feeds/recent?limit=5");
      if (!response.ok) throw new Error("Failed to fetch recent feed posts");
      return response.json();
    },
  });

  const clearFilters = () => {
    setZone("");
    setSpecies("");
  };

  const hasActiveFilters = zone || species;

  const handleExport = (): void => {
    if (!stats) {
      toast({
        title: "No data available",
        description: "There is no dashboard data to export right now.",
        variant: "destructive",
      });
      console.warn("Export attempted without available dashboard stats");
      return;
    }

    try {
      console.log("Exporting dashboard analytics", stats);

      const csvRows: string[][] = [
        ["Metric", "Value"],
        ["Total Cases", stats.totalCases.toString()],
        ["New This Month", stats.newThisMonth.toString()],
        ["Active Clinics", stats.activeClinics.toString()],
        ["Remission Rate", `${stats.remissionRate}%`],
        [],
        ["Cases by Month"],
        ["Month", "Cases"],
        ...stats.casesByMonth.map((item) => [item.month, item.count.toString()]),
        [],
        ["Top Tumour Types"],
        ["Tumour Type", "Cases"],
        ...stats.topTumourTypes.map((tumour) => [tumour.name, tumour.count.toString()]),
      ];

      const csvContent = csvRows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `vetonco_dashboard_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export complete",
        description: "Dashboard analytics downloaded successfully.",
      });
    } catch (exportError) {
      console.error("Failed to export dashboard analytics", exportError);
      toast({
        title: "Export failed",
        description: "We couldn't export the dashboard data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewAll = (): void => {
    console.log("Navigating to full analytics page");
    setLocation("/analytics");
    toast({
      title: "Opening analytics",
      description: "Redirecting to the full analytics dashboard...",
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-10 w-full max-w-2xl" />
        </div>
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
            <h3 className="text-lg font-semibold mb-2">
              Unable to load dashboard
            </h3>
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
    <div className="p-4 sm:p-6">
      {/* Header with Filters */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {myClinicOnly
                ? "Viewing your clinic's data"
                : "Viewing shared data from all clinics"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Filter Bar */}
        <Card className={showFilters ? "block" : "hidden"}>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* My Clinic Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="my-clinic-only"
                  checked={myClinicOnly}
                  onCheckedChange={setMyClinicOnly}
                  data-testid="switch-my-clinic-only"
                />
                <Label htmlFor="my-clinic-only" className="text-sm">
                  My clinic only
                </Label>
              </div>

              {/* Zone Filter */}
              <Select
                value={zone || "all"}
                onValueChange={(val) => setZone(val === "all" ? "" : val)}
                disabled={myClinicOnly}
              >
                <SelectTrigger data-testid="select-zone">
                  <SelectValue placeholder="All zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All zones</SelectItem>
                  {ZONES.map((z) => (
                    <SelectItem key={z.value} value={z.value}>
                      {z.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Species Filter */}
              <Select
                value={species || "all"}
                onValueChange={(val) => setSpecies(val === "all" ? "" : val)}
              >
                <SelectTrigger data-testid="select-species">
                  <SelectValue placeholder="All species" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All species</SelectItem>
                  {SPECIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
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
                  {stats.totalCases.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <i className="fas fa-folder-medical text-primary"></i>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {myClinicOnly ? "From your clinic" : "Across all clinics"}
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
                  {stats.newThisMonth.toLocaleString()}
                </p>
              </div>
              <div className="h-12 w-12 bg-accent/10 rounded-full flex items-center justify-center">
                <i className="fas fa-plus text-accent"></i>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Diagnosed this month
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
                  {stats.activeClinics.toLocaleString()}
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
                  {stats.remissionRate}%
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <i className="fas fa-heart text-green-600 dark:text-green-400"></i>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Treatment success
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Cases by Month Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">
              Cases by Month
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-monthly-chart"
              onClick={handleExport}
            >
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
            <CardTitle className="text-lg font-semibold">
              Top Tumour Types
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-view-all-tumours"
              onClick={handleViewAll}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {stats.topTumourTypes.length > 0 ? (
                <div className="space-y-3">
                  {stats.topTumourTypes.slice(0, 5).map((tumour, index) => (
                    <div
                      key={tumour.name}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-foreground">
                        {tumour.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">
                          {tumour.count}
                        </span>
                        <div className="w-16 h-2 bg-muted rounded-full">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(tumour.count / Math.max(...stats.topTumourTypes.map((t) => t.count))) * 100}%`,
                              backgroundColor: COLORS[index % COLORS.length],
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
            <p className="text-muted-foreground text-sm mb-4">
              Register a new veterinary oncology case
            </p>
            <Button
              asChild
              className="w-full"
              data-testid="button-quick-new-case"
            >
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

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingFeedPosts ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentFeedPosts && recentFeedPosts.length > 0 ? (
            <div className="space-y-4">
              {recentFeedPosts.map((post) => (
                <div key={post.id} className="flex items-start space-x-3" data-testid={`activity-feed-${post.id}`}>
                  <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center mt-1">
                    <Rss className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{post.title}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Rss className="h-10 w-10 mx-auto mb-4 opacity-50" />
              <p>No recent activity</p>
              <p className="text-sm">
                Activity will appear here as you use the platform
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

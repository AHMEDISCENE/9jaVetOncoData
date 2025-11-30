import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MetricDrilldown } from "@/components/analytics/MetricDrilldown";
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
  Cell,
} from "recharts";
import { Filter, X, Rss, Plus, Upload, TrendingUp, ExternalLink, Newspaper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DashboardStats } from "@/lib/types";
import type { FeedPost } from "@shared/schema";

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  image?: string;
  publishedAt: string;
  content?: string;
}

interface VeterinaryOncologyNewsProps {
  currentIndex: number;
  isFlipped: boolean;
  onFlip: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function VeterinaryOncologyNews({ currentIndex, isFlipped, onFlip, onNext, onPrev }: VeterinaryOncologyNewsProps) {
  const { data: newsData, isLoading: isLoadingNews } = useQuery({
    queryKey: ['/api/news/veterinary-oncology'],
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const articles = newsData?.articles?.slice(0, 5) || [];
  const currentArticle = articles[currentIndex];

  return (
    <Card className="bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200/50 dark:border-blue-800/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Newspaper className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-black dark:text-white">Veterinary Oncology around the globe</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 font-normal">Latest breakthroughs & research</p>
            </div>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingNews ? (
          <Skeleton className="h-[200px] w-full" />
        ) : articles.length > 0 && currentArticle ? (
          <div className="space-y-4">
            <div className="h-[200px]">
              <FlipCard
                isFlipped={isFlipped}
                onFlip={onFlip}
                frontContent={
                  <div 
                    className="h-full p-6 rounded-xl text-white flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden"
                    style={{
                      backgroundImage: currentArticle.image ? `url(${currentArticle.image})` : 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Dark overlay for better text readability */}
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative z-10">
                      <h4 className="text-lg font-bold line-clamp-3">{currentArticle.title}</h4>
                      <p className="text-sm opacity-90 mt-2">Click to view more</p>
                    </div>
                  </div>
                }
                backContent={
                  <div className="h-full p-6 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex flex-col justify-between">
                    <div className="space-y-3">
                      <a href={currentArticle.url} target="_blank" rel="noopener noreferrer" className="text-base font-bold hover:text-blue-100 block line-clamp-3">
                        {currentArticle.title}
                      </a>
                      <p className="text-sm leading-relaxed line-clamp-4">{currentArticle.description}</p>
                      <div className="flex flex-col text-xs opacity-90 border-t border-white/20 pt-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{currentArticle.source}</span>
                          <span>{new Date(currentArticle.publishedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-white/20">
                      <a 
                        href={currentArticle.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded inline-block transition-colors"
                      >
                        Read Full Article →
                      </a>
                      <p className="text-xs opacity-60 text-center mt-2">Click card to collapse</p>
                    </div>
                  </div>
                }
                frontClassName="bg-gradient-to-br from-blue-500 to-cyan-500"
                backClassName="bg-gradient-to-br from-blue-600 to-cyan-600"
                testId="news-card"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={onPrev}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
                data-testid="button-prev-news"
              >
                ← Previous
              </button>
              <span className="text-sm font-semibold text-foreground">
                {currentIndex + 1} / {articles.length}
              </span>
              <button
                onClick={onNext}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
                data-testid="button-next-news"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 px-4">
            <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
              <Newspaper className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm font-medium text-foreground">No news available</p>
            <p className="text-xs text-muted-foreground mt-1">Check back later for updates</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FlipCardProps {
  isFlipped: boolean;
  onFlip: () => void;
  frontContent: React.ReactNode;
  backContent: React.ReactNode;
  frontClassName?: string;
  backClassName?: string;
  testId?: string;
}

function FlipCard({ isFlipped, onFlip, frontContent, backContent, frontClassName, backClassName, testId }: FlipCardProps) {
  return (
    <div
      className="flip-card-container h-[200px] cursor-pointer"
      onClick={onFlip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFlip();
        }
      }}
      role="button"
      tabIndex={0}
      data-testid={testId}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateX: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <div
          className={`absolute inset-0 w-full h-full rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl ${frontClassName}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {frontContent}
        </div>
        <div
          className={`absolute inset-0 w-full h-full rounded-xl shadow-lg overflow-hidden ${backClassName}`}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateX(180deg)",
          }}
        >
          {backContent}
        </div>
      </motion.div>
    </div>
  );
}

type MetricType = "totalCases" | "newThisMonth" | "remissionRate" | "activeClinics" | null;

const COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#14b8a6", // Teal
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
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({
    totalCases: false,
    newThisMonth: false,
    activeClinics: false,
    remissionRate: false,
  });
  const [slideIndices, setSlideIndices] = useState<Record<string, number>>({
    totalCases: 0,
    newThisMonth: 0,
    activeClinics: 0,
    remissionRate: 0,
  });
  const [showCasesByMonthModal, setShowCasesByMonthModal] = useState(false);
  const [showTumourTypesModal, setShowTumourTypesModal] = useState(false);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [newsFlipped, setNewsFlipped] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const toggleCardFlip = (cardId: string) => {
    setFlippedCards(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const handleMetricClick = (metric: MetricType) => {
    setSelectedMetric(metric);
    setIsDrilldownOpen(true);
  };

  const handleCloseDrilldown = () => {
    setIsDrilldownOpen(false);
    setTimeout(() => setSelectedMetric(null), 300);
  };

  const handleNextNews = () => {
    setCurrentNewsIndex(prev => (prev + 1) % 5);
    setNewsFlipped(false);
  };

  const handlePrevNews = () => {
    setCurrentNewsIndex(prev => (prev - 1 + 5) % 5);
    setNewsFlipped(false);
  };

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

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
  });

  // Auto-rotate slides every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndices(prev => {
        const newIndices = { ...prev };
        
        // Total Cases: main + top 5 species
        const totalCasesSlides = stats?.casesBySpecies?.length || 0;
        if (totalCasesSlides > 1) {
          newIndices.totalCases = (prev.totalCases + 1) % (totalCasesSlides + 1);
        }
        
        // New This Month: main + last 5 months
        const newThisMonthSlides = stats?.casesByMonth?.length || 0;
        if (newThisMonthSlides > 1) {
          newIndices.newThisMonth = (prev.newThisMonth + 1) % (newThisMonthSlides + 1);
        }
        
        // Active Clinics: main + top 5 clinics
        const activeClinicsSlides = stats?.clinicsByCount?.length || 0;
        if (activeClinicsSlides > 1) {
          newIndices.activeClinics = (prev.activeClinics + 1) % (activeClinicsSlides + 1);
        }
        
        // Remission Rate: main + top 5 outcomes
        const remissionRateSlides = stats?.treatmentOutcomes?.length || 0;
        if (remissionRateSlides > 1) {
          newIndices.remissionRate = (prev.remissionRate + 1) % (remissionRateSlides + 1);
        }
        
        return newIndices;
      });
    }, 4000);
    
    return () => clearInterval(interval);
  }, [stats]);

  // Auto-advance news every 5 seconds
  useEffect(() => {
    const newsInterval = setInterval(() => {
      setCurrentNewsIndex(prev => (prev + 1) % 5);
      setNewsFlipped(false);
    }, 5000);
    
    return () => clearInterval(newsInterval);
  }, []);

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

  const handleViewCasesByMonth = (): void => {
    setShowCasesByMonthModal(true);
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
      {/* Welcome Message */}
      {currentUser && (
        <div className="mb-6">
          <p className="text-xl font-semibold text-foreground">
            Welcome back, <span className="text-blue-600 dark:text-blue-400">{currentUser.user?.name || currentUser.user?.email || 'User'}</span>!
          </p>
        </div>
      )}

      {/* Header with Filters */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-lg font-semibold text-foreground">
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

      {/* Quick Stats with Flip Animation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Cases Card */}
        <FlipCard
          isFlipped={flippedCards.totalCases}
          onFlip={() => toggleCardFlip("totalCases")}
          testId="card-total-cases"
          frontClassName="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800"
          backClassName="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-950 border border-blue-200 dark:border-blue-800"
          frontContent={
            <div className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slideIndices.totalCases}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                  >
                    {slideIndices.totalCases === 0 ? (
                      <>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-200">
                          Total Cases
                        </p>
                        <p className="text-4xl font-bold text-blue-600 dark:text-blue-300" data-testid="stat-total-cases">
                          {stats.totalCases.toLocaleString()}
                        </p>
                      </>
                    ) : stats.casesBySpecies && slideIndices.totalCases - 1 < stats.casesBySpecies.length ? (
                      <>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-200">
                          {stats.casesBySpecies[slideIndices.totalCases - 1].name}
                        </p>
                        <p className="text-4xl font-bold text-blue-600 dark:text-blue-300">
                          {stats.casesBySpecies[slideIndices.totalCases - 1].count}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-200">
                          Total Cases
                        </p>
                        <p className="text-4xl font-bold text-blue-600 dark:text-blue-300">
                          {stats.totalCases.toLocaleString()}
                        </p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="h-14 w-14 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center">
                  <i className="fas fa-clipboard-list text-blue-600 dark:text-blue-300 text-xl"></i>
                </div>
              </div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-300 mt-2">
                Click to see breakdown
              </p>
            </div>
          }
          backContent={
            <div className="p-3 h-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-950 flex flex-col">
              <p className="text-xs font-bold text-blue-800 dark:text-blue-200 mb-2">Cases by Species</p>
              <div className="flex-1 space-y-1 min-h-0 fancy-scroll">
                {stats.casesBySpecies?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-blue-700 dark:text-blue-300 truncate max-w-[65%]">{item.name}</span>
                    <span className="font-semibold text-blue-800 dark:text-blue-200 ml-2">{item.count}</span>
                  </div>
                ))}
                {(!stats.casesBySpecies || stats.casesBySpecies.length === 0) && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">No data available</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMetricClick("totalCases");
                }}
                className="mt-auto pt-2 w-full text-xs font-semibold px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                data-testid="button-view-more-total-cases"
              >
                View More
              </button>
            </div>
          }
        />

        {/* New This Month Card */}
        <FlipCard
          isFlipped={flippedCards.newThisMonth}
          onFlip={() => toggleCardFlip("newThisMonth")}
          testId="card-new-this-month"
          frontClassName="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border border-purple-200 dark:border-purple-800"
          backClassName="bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-950 border border-purple-200 dark:border-purple-800"
          frontContent={
            <div className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slideIndices.newThisMonth}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                  >
                    {slideIndices.newThisMonth === 0 ? (
                      <>
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-200">
                          New This Month
                        </p>
                        <p className="text-4xl font-bold text-purple-600 dark:text-purple-300" data-testid="stat-new-this-month">
                          {stats.newThisMonth.toLocaleString()}
                        </p>
                      </>
                    ) : stats.casesByMonth && slideIndices.newThisMonth - 1 < stats.casesByMonth.length ? (
                      <>
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-200">
                          {stats.casesByMonth[stats.casesByMonth.length - (slideIndices.newThisMonth)].month}
                        </p>
                        <p className="text-4xl font-bold text-purple-600 dark:text-purple-300">
                          {stats.casesByMonth[stats.casesByMonth.length - (slideIndices.newThisMonth)].count}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-200">
                          New This Month
                        </p>
                        <p className="text-4xl font-bold text-purple-600 dark:text-purple-300">
                          {stats.newThisMonth.toLocaleString()}
                        </p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="h-14 w-14 bg-purple-200 dark:bg-purple-800 rounded-full flex items-center justify-center">
                  <i className="fas fa-plus text-purple-600 dark:text-purple-300 text-xl"></i>
                </div>
              </div>
              <p className="text-xs font-medium text-purple-600 dark:text-purple-300 mt-2">
                Click to see trend
              </p>
            </div>
          }
          backContent={
            <div className="p-3 h-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-950 flex flex-col">
              <p className="text-xs font-bold text-purple-800 dark:text-purple-200 mb-2">Monthly Trend</p>
              <div className="flex-1 space-y-1 min-h-0 fancy-scroll">
                {stats.casesByMonth?.slice(-5).reverse().map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-purple-700 dark:text-purple-300">{item.month}</span>
                    <span className="font-semibold text-purple-800 dark:text-purple-200 ml-2">{item.count}</span>
                  </div>
                ))}
                {(!stats.casesByMonth || stats.casesByMonth.length === 0) && (
                  <p className="text-xs text-purple-600 dark:text-purple-400">No data available</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMetricClick("newThisMonth");
                }}
                className="mt-auto pt-2 w-full text-xs font-semibold px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                data-testid="button-view-more-new-this-month"
              >
                View More
              </button>
            </div>
          }
        />

        {/* Active Clinics Card */}
        <FlipCard
          isFlipped={flippedCards.activeClinics}
          onFlip={() => toggleCardFlip("activeClinics")}
          testId="card-active-clinics"
          frontClassName="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border border-amber-200 dark:border-amber-800"
          backClassName="bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-950 border border-amber-200 dark:border-amber-800"
          frontContent={
            <div className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slideIndices.activeClinics}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                  >
                    {slideIndices.activeClinics === 0 ? (
                      <>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-200">
                          Active Clinics
                        </p>
                        <p className="text-4xl font-bold text-amber-600 dark:text-amber-300" data-testid="stat-active-clinics">
                          {stats.activeClinics.toLocaleString()}
                        </p>
                      </>
                    ) : stats.clinicsByCount && slideIndices.activeClinics - 1 < stats.clinicsByCount.length ? (
                      <>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-200">
                          {stats.clinicsByCount[slideIndices.activeClinics - 1].name}
                        </p>
                        <p className="text-4xl font-bold text-amber-600 dark:text-amber-300">
                          {stats.clinicsByCount[slideIndices.activeClinics - 1].count}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-200">
                          Active Clinics
                        </p>
                        <p className="text-4xl font-bold text-amber-600 dark:text-amber-300">
                          {stats.activeClinics.toLocaleString()}
                        </p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="h-14 w-14 bg-amber-200 dark:bg-amber-800 rounded-full flex items-center justify-center">
                  <i className="fas fa-hospital text-amber-600 dark:text-amber-300 text-xl"></i>
                </div>
              </div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-300 mt-2">
                Click to see top clinics
              </p>
            </div>
          }
          backContent={
            <div className="p-3 h-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900 dark:to-amber-950 flex flex-col">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-200 mb-2">Top Clinics</p>
              <div className="flex-1 space-y-1 min-h-0 fancy-scroll">
                {stats.clinicsByCount?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-amber-700 dark:text-amber-300 truncate max-w-[65%]">{item.name}</span>
                    <span className="font-semibold text-amber-800 dark:text-amber-200 ml-2">{item.count}</span>
                  </div>
                ))}
                {(!stats.clinicsByCount || stats.clinicsByCount.length === 0) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">No data available</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMetricClick("activeClinics");
                }}
                className="mt-auto pt-2 w-full text-xs font-semibold px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                data-testid="button-view-more-active-clinics"
              >
                View More
              </button>
            </div>
          }
        />

        {/* Remission Rate Card */}
        <FlipCard
          isFlipped={flippedCards.remissionRate}
          onFlip={() => toggleCardFlip("remissionRate")}
          testId="card-remission-rate"
          frontClassName="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border border-green-200 dark:border-green-800"
          backClassName="bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-950 border border-green-200 dark:border-green-800"
          frontContent={
            <div className="p-6 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slideIndices.remissionRate}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                  >
                    {slideIndices.remissionRate === 0 ? (
                      <>
                        <p className="text-sm font-medium text-green-700 dark:text-green-200">
                          Remission Rate
                        </p>
                        <p className="text-4xl font-bold text-green-600 dark:text-green-300" data-testid="stat-remission-rate">
                          {stats.remissionRate}%
                        </p>
                      </>
                    ) : stats.treatmentOutcomes && slideIndices.remissionRate - 1 < stats.treatmentOutcomes.length ? (
                      <>
                        <p className="text-sm font-medium text-green-700 dark:text-green-200">
                          {stats.treatmentOutcomes[slideIndices.remissionRate - 1].name}
                        </p>
                        <p className="text-4xl font-bold text-green-600 dark:text-green-300">
                          {stats.treatmentOutcomes[slideIndices.remissionRate - 1].count}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-green-700 dark:text-green-200">
                          Remission Rate
                        </p>
                        <p className="text-4xl font-bold text-green-600 dark:text-green-300">
                          {stats.remissionRate}%
                        </p>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="h-14 w-14 bg-green-200 dark:bg-green-800 rounded-full flex items-center justify-center">
                  <i className="fas fa-heart text-green-600 dark:text-green-300 text-xl"></i>
                </div>
              </div>
              <p className="text-xs font-medium text-green-600 dark:text-green-300 mt-2">
                Click to see outcomes
              </p>
            </div>
          }
          backContent={
            <div className="p-3 h-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-950 flex flex-col">
              <p className="text-xs font-bold text-green-800 dark:text-green-200 mb-2">Treatment Outcomes</p>
              <div className="flex-1 space-y-1 min-h-0 fancy-scroll">
                {stats.treatmentOutcomes?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-green-700 dark:text-green-300 truncate max-w-[65%]">{item.name}</span>
                    <span className="font-semibold text-green-800 dark:text-green-200 ml-2">{item.count}</span>
                  </div>
                ))}
                {(!stats.treatmentOutcomes || stats.treatmentOutcomes.length === 0) && (
                  <p className="text-xs text-green-600 dark:text-green-400">No data available</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMetricClick("remissionRate");
                }}
                className="mt-auto pt-2 w-full text-xs font-semibold px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                data-testid="button-view-more-remission-rate"
              >
                View More
              </button>
            </div>
          }
        />
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
              data-testid="button-view-all-cases-by-month"
              onClick={handleViewAll}
            >
              <i className="fas fa-external-link mr-2"></i>View All
            </Button>
          </CardHeader>
          <CardContent 
            className="cursor-pointer hover:bg-muted/50 transition-colors rounded-lg"
            onClick={handleViewCasesByMonth}
          >
            <div className="h-64">
              {stats.casesByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.casesByMonth}>
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
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {stats.casesByMonth.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
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
          <CardContent 
            className="cursor-pointer hover:bg-muted/50 transition-colors rounded-lg"
            onClick={() => setShowTumourTypesModal(true)}
          >
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
      <div className="grid grid-cols-3 md:grid-cols-3 gap-2 md:gap-6 mb-8">
        {/* Add New Case Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 group overflow-hidden">
          <CardContent className="p-2 md:p-8 text-center relative">
            <div className="h-10 md:h-16 w-10 md:w-16 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center mx-auto mb-1 md:mb-6 group-hover:scale-110 transition-transform duration-200 shadow-lg">
              <Plus className="h-5 md:h-8 w-5 md:w-8 text-white" strokeWidth={3} />
            </div>
            <h3 className="text-xs md:text-xl font-bold mb-1 md:mb-3 text-foreground">Add New Case</h3>
            <p className="text-foreground/70 text-xs md:text-sm mb-2 md:mb-6 leading-relaxed hidden md:block">
              Register a new veterinary oncology case with complete medical information
            </p>
            <Button
              asChild
              className="w-full text-xs md:text-base h-7 md:h-10 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              data-testid="button-quick-new-case"
            >
              <a href="/cases/new">Start Entry</a>
            </Button>
          </CardContent>
        </Card>

        {/* Bulk Import Card */}
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 group overflow-hidden">
          <CardContent className="p-2 md:p-8 text-center relative">
            <div className="h-10 md:h-16 w-10 md:w-16 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center mx-auto mb-1 md:mb-6 group-hover:scale-110 transition-transform duration-200 shadow-lg">
              <Upload className="h-5 md:h-8 w-5 md:w-8 text-white" strokeWidth={3} />
            </div>
            <h3 className="text-xs md:text-xl font-bold mb-1 md:mb-3 text-foreground">Bulk Import</h3>
            <p className="text-foreground/70 text-xs md:text-sm mb-2 md:mb-6 leading-relaxed hidden md:block">
              Upload multiple cases from CSV or Excel files with smart field mapping
            </p>
            <Button
              asChild
              className="w-full text-xs md:text-base h-7 md:h-10 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              data-testid="button-quick-bulk-import"
            >
              <a href="/bulk-upload">Import Data</a>
            </Button>
          </CardContent>
        </Card>

        {/* View Analytics Card */}
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-emerald-200 dark:border-emerald-800 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200 group overflow-hidden">
          <CardContent className="p-2 md:p-8 text-center relative">
            <div className="h-10 md:h-16 w-10 md:w-16 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-full flex items-center justify-center mx-auto mb-1 md:mb-6 group-hover:scale-110 transition-transform duration-200 shadow-lg">
              <TrendingUp className="h-5 md:h-8 w-5 md:w-8 text-white" strokeWidth={3} />
            </div>
            <h3 className="text-xs md:text-xl font-bold mb-1 md:mb-3 text-foreground">View Analytics</h3>
            <p className="text-foreground/70 text-xs md:text-sm mb-2 md:mb-6 leading-relaxed hidden md:block">
              Explore trends, generate insights, and view interactive reports
            </p>
            <Button
              asChild
              className="w-full text-xs md:text-base h-7 md:h-10 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              data-testid="button-quick-analytics"
            >
              <a href="/analytics">View Reports</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Feed Highlights */}
      <Card className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200/50 dark:border-purple-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Rss className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-black dark:text-white">Feed Highlights</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 font-normal">Get the latest information from other platform users</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingFeedPosts ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : recentFeedPosts && recentFeedPosts.length > 0 ? (
            <div className="space-y-3">
              {recentFeedPosts.slice(0, 5).map((post) => (
                <motion.div 
                  key={post.id} 
                  whileHover={{ x: 4 }}
                  onClick={() => setSelectedPost(post)}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-purple-100 dark:border-purple-900/30 hover:border-purple-400 dark:hover:border-purple-700 hover:shadow-md transition-all cursor-pointer group"
                  data-testid={`activity-feed-${post.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Rss className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-purple-600 dark:group-hover:text-pink-400 transition-colors truncate">
                        {post.title}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {(post as any).authorName || "Unknown Author"}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 px-4">
              <div className="h-14 w-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
                <Rss className="h-7 w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Activity will appear here as your team uses the platform
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Veterinary Oncology News */}
      <div className="mt-8">
        <VeterinaryOncologyNews 
          currentIndex={currentNewsIndex}
          isFlipped={newsFlipped}
          onFlip={() => setNewsFlipped(!newsFlipped)}
          onNext={handleNextNews}
          onPrev={handlePrevNews}
        />
      </div>

      {/* Post Detail Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPost.title}</DialogTitle>
                <DialogDescription>
                  By {(selectedPost as any).authorName || "Unknown Author"} • Posted on {new Date(selectedPost.createdAt).toLocaleDateString()} at {new Date(selectedPost.createdAt).toLocaleTimeString()}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {selectedPost.body.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-2 last:mb-0 text-foreground text-sm leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
                
                {selectedPost.tags && selectedPost.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedPost.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button 
                    onClick={() => {
                      setSelectedPost(null);
                      setLocation("/feeds");
                    }}
                    className="w-full"
                    data-testid="button-view-full-post"
                  >
                    View Full Post
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Metric Drilldown */}
      {stats && (
        <MetricDrilldown
          isOpen={isDrilldownOpen}
          onClose={handleCloseDrilldown}
          metric={selectedMetric}
          stats={stats}
        />
      )}

      {/* Cases by Month Modal */}
      <Dialog open={showCasesByMonthModal} onOpenChange={setShowCasesByMonthModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cases by Month</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="h-80 w-full">
              {stats?.casesByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.casesByMonth}>
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
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {stats.casesByMonth.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>No data available</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm font-semibold text-foreground">Total Cases</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.totalCases || 0}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">New This Month</p>
                <p className="text-2xl font-bold text-purple-600">{stats?.newThisMonth || 0}</p>
              </div>
            </div>
            <div className="pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Monthly Breakdown</p>
              <div className="space-y-2 max-h-48 overflow-y-auto fancy-scroll">
                {stats?.casesByMonth.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="text-sm text-foreground">{item.month}</span>
                    <span className="font-semibold text-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button 
              onClick={() => setShowCasesByMonthModal(false)}
              className="w-full mt-4"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Top Tumour Types Modal */}
      <Dialog open={showTumourTypesModal} onOpenChange={setShowTumourTypesModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Tumour Types</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-96 overflow-y-auto fancy-scroll">
              <div className="space-y-3">
                {stats?.topTumourTypes.length > 0 ? (
                  stats.topTumourTypes.map((tumour, index) => (
                    <div
                      key={tumour.name}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground">
                          {tumour.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-semibold text-foreground min-w-fit">
                          {tumour.count} cases
                        </span>
                        <div className="w-24 h-2 bg-muted rounded-full">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(tumour.count / Math.max(...stats.topTumourTypes.map((t) => t.count))) * 100}%`,
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No tumour data available</p>
                  </div>
                )}
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Total Types: {stats?.topTumourTypes.length || 0}
              </p>
            </div>
            <Button 
              onClick={() => setShowTumourTypesModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

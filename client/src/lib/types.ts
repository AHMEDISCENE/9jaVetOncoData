import type {
  DashboardStats as SharedDashboardStats,
  AnalyticsSummary as SharedAnalyticsSummary,
  FeedListItem,
  FeedListResponse,
} from "@shared/schema";

export type DashboardStats = SharedDashboardStats;

export type AnalyticsSummary = SharedAnalyticsSummary;

export type FeedResponse = FeedListResponse;

export type FeedItem = FeedListItem;

export interface CaseFilters {
  species?: string;
  tumourType?: string;
  outcome?: string;
  startDate?: string;
  endDate?: string;
  zone?: string[];
  state?: string[];
  clinicId?: string[];
  tumourTypeId?: string[];
  sort?: 'clinic' | 'zone' | 'state' | 'date' | 'case_number';
  order?: 'asc' | 'desc';
  groupBy?: 'none' | 'zone' | 'state' | 'clinic';
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

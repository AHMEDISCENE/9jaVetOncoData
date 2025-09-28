export interface DashboardStats {
  totalCases: number;
  newThisMonth: number;
  activeClinics: number;
  remissionRate: number;
  casesByMonth: Array<{month: string; count: number}>;
  topTumourTypes: Array<{name: string; count: number}>;
  casesByState: Array<{state: string; count: number}>;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
    user: string;
    clinic: string;
  }>;
}

export interface CaseFilters {
  species?: string;
  tumourType?: string;
  outcome?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

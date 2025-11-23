export interface DashboardStats {
  totalCases: number;
  newThisMonth: number;
  activeClinics: number;
  remissionRate: number;
  casesByMonth: Array<{month: string; count: number}>;
  topTumourTypes: Array<{name: string; count: number}>;
  casesBySpecies: Array<{name: string; count: number}>;
  treatmentOutcomes: Array<{name: string; count: number}>;
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

export interface LocationCaseStat {
  zone: string;
  state: string;
  caseCount: number;
}

export interface CasesByLocationResponse {
  data: LocationCaseStat[];
  meta: {
    totalCases: number;
    generatedAt: string;
  };
}

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
  groupBy?: 'none' | 'zone' | 'state' | 'clinic' | 'tumourType' | 'species' | 'breed' | 'sex';
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

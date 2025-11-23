import { useQuery } from "@tanstack/react-query";
import type { CasesByLocationResponse } from "@/lib/types";

interface UseCasesByLocationOptions {
  startDate: string;
  endDate: string;
  species?: string;
  tumourType?: string;
  clinicId?: string[];
}

export function useCasesByLocation(options: UseCasesByLocationOptions) {
  const queryParams = new URLSearchParams();
  
  queryParams.set("startDate", options.startDate);
  queryParams.set("endDate", options.endDate);
  
  if (options.species) queryParams.set("species", options.species);
  if (options.tumourType) queryParams.set("tumourType", options.tumourType);
  if (options.clinicId?.length) {
    queryParams.set("clinicId", options.clinicId.join(","));
  }

  return useQuery<CasesByLocationResponse>({
    queryKey: ["/api/analytics/cases-by-location", options],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/cases-by-location?${queryParams}`);
      if (!response.ok) throw new Error("Failed to fetch location data");
      return response.json();
    },
  });
}

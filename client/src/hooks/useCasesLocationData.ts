import { useQuery } from "@tanstack/react-query";
import type { CasesByLocationResponse, LocationCaseStat } from "@/lib/types";
import { getZoneForState } from "@/lib/constants";

export function useCasesLocationData() {
  return useQuery<CasesByLocationResponse>({
    queryKey: ["/api/cases"],
    queryFn: async () => {
      const response = await fetch("/api/cases");
      if (!response.ok) throw new Error("Failed to fetch cases");
      const cases = await response.json();

      // Calculate location distribution from cases
      const stateMap = new Map<string, number>();

      // Count cases by state
      for (const caseItem of cases) {
        if (caseItem.state) {
          const count = stateMap.get(caseItem.state) || 0;
          stateMap.set(caseItem.state, count + 1);
        }
      }

      // Convert to LocationCaseStat format
      const data: LocationCaseStat[] = Array.from(stateMap.entries()).map(
        ([state, caseCount]) => ({
          state,
          zone: getZoneForState(state) || "",
          caseCount,
        })
      );

      return {
        data,
        meta: {
          totalCases: cases.length,
          generatedAt: new Date().toISOString(),
        },
      };
    },
  });
}

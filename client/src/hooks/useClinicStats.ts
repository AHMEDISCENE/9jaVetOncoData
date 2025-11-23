import { useQuery } from "@tanstack/react-query";

export interface ClinicStat {
  clinicId: string;
  clinicName: string;
  totalCases: number;
}

export function useClinicStats() {
  return useQuery<ClinicStat[]>({
    queryKey: ["/api/dashboard/clinic-stats"],
  });
}

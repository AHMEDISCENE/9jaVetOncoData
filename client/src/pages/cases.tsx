import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import type { CaseWithDetails } from "@shared/schema";
import type { CaseFilters } from "@/lib/types";

const outcomeColors = {
  REMISSION: "bg-green-100 text-green-800",
  TREATMENT_ONGOING: "bg-blue-100 text-blue-800",
  DECEASED: "bg-red-100 text-red-800",
  LOST_TO_FOLLOWUP: "bg-gray-100 text-gray-800",
};

const outcomeLabels = {
  REMISSION: "Remission",
  TREATMENT_ONGOING: "Treatment Ongoing",
  DECEASED: "Deceased",
  LOST_TO_FOLLOWUP: "Lost to Follow-up",
};

export default function Cases() {
  const [filters, setFilters] = useState<CaseFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const { data: cases, isLoading, error } = useQuery<CaseWithDetails[]>({
    queryKey: ["/api/cases", filters, { limit: pageSize, offset: (currentPage - 1) * pageSize }],
  });

  const handleFilterChange = (key: keyof CaseFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: (value === "__all" || !value) ? undefined : value
    }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-16 mb-1" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[...Array(6)].map((_, i) => (
                      <TableHead key={i}>
                        <Skeleton className="h-4 w-16" />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <i className="fas fa-exclamation-triangle text-destructive text-4xl mb-4"></i>
            <h3 className="text-lg font-semibold mb-2">Unable to load cases</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Please check your connection and try again."}
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-retry-cases">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Cases Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Case Management</h2>
          <p className="text-muted-foreground">Manage and view all veterinary oncology cases</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <Button asChild data-testid="button-new-case">
            <a href="/cases/new">
              <i className="fas fa-plus mr-2"></i>New Case
            </a>
          </Button>
          <Button asChild variant="outline" data-testid="button-bulk-import">
            <a href="/bulk-upload">
              <i className="fas fa-upload mr-2"></i>Bulk Import
            </a>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-1">Species</Label>
              <Select value={filters.species || undefined} onValueChange={(value) => handleFilterChange("species", value)}>
                <SelectTrigger data-testid="filter-species">
                  <SelectValue placeholder="All Species" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All Species</SelectItem>
                  <SelectItem value="Dog">Dog</SelectItem>
                  <SelectItem value="Cat">Cat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground mb-1">Outcome</Label>
              <Select value={filters.outcome || undefined} onValueChange={(value) => handleFilterChange("outcome", value)}>
                <SelectTrigger data-testid="filter-outcome">
                  <SelectValue placeholder="All Outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All Outcomes</SelectItem>
                  <SelectItem value="REMISSION">Remission</SelectItem>
                  <SelectItem value="TREATMENT_ONGOING">Treatment Ongoing</SelectItem>
                  <SelectItem value="DECEASED">Deceased</SelectItem>
                  <SelectItem value="LOST_TO_FOLLOWUP">Lost to Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground mb-1">Start Date</Label>
              <Input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                data-testid="filter-start-date"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground mb-1">End Date</Label>
              <Input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                data-testid="filter-end-date"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            {Object.entries(filters).map(([key, value]) => 
              value && (
                <Badge key={key} variant="secondary" className="flex items-center gap-1">
                  {key}: {value}
                  <button
                    onClick={() => handleFilterChange(key as keyof CaseFilters, "")}
                    className="ml-1 hover:text-destructive"
                    data-testid={`remove-filter-${key}`}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </Badge>
              )
            )}
            {Object.keys(filters).length > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} data-testid="button-clear-filters">
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Tumour Type</TableHead>
                  <TableHead>Diagnosis Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases && cases.length > 0 ? (
                  cases.map((caseItem) => (
                    <TableRow key={caseItem.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium" data-testid={`case-id-${caseItem.id}`}>
                        {caseItem.caseNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm text-foreground" data-testid={`patient-name-${caseItem.id}`}>
                            {caseItem.patientName || "Unnamed"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {caseItem.species} • {caseItem.breed} • 
                            {caseItem.ageYears ? `${caseItem.ageYears}y` : ""}{caseItem.ageMonths ? ` ${caseItem.ageMonths}m` : ""}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {caseItem.tumourType?.name || caseItem.tumourTypeCustom || "Not specified"}
                      </TableCell>
                      <TableCell>
                        {new Date(caseItem.diagnosisDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {caseItem.outcome && (
                          <Badge className={outcomeColors[caseItem.outcome]}>
                            {outcomeLabels[caseItem.outcome]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" data-testid={`button-view-case-${caseItem.id}`}>
                            <i className="fas fa-eye mr-1"></i>View
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-edit-case-${caseItem.id}`}>
                            <i className="fas fa-edit mr-1"></i>Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-muted-foreground">
                        <i className="fas fa-folder-open text-4xl mb-4"></i>
                        <p className="text-lg font-medium mb-2">No cases found</p>
                        <p className="text-sm">
                          {Object.keys(filters).length > 0 
                            ? "Try adjusting your filters or clearing them to see more results."
                            : "Get started by adding your first case."
                          }
                        </p>
                        <Button asChild className="mt-4" data-testid="button-add-first-case">
                          <a href="/cases/new">
                            <i className="fas fa-plus mr-2"></i>Add First Case
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {cases && cases.length > 0 && (
            <div className="bg-muted/30 px-4 py-3 flex items-center justify-between border-t border-border">
              <div className="text-sm text-muted-foreground" data-testid="pagination-info">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, cases.length)} results
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-previous-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={cases.length < pageSize}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

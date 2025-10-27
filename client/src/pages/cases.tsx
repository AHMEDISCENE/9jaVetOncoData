import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CaseWithDetails } from "@shared/schema";
import type { CaseFilters } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

interface NgState {
  code: string;
  name: string;
  zone: string;
}

interface Clinic {
  id: string;
  name: string;
}

interface TumourType {
  id: string;
  name: string;
}

function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select...",
  testId,
  searchable = false,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  testId?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handleToggle = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newValues);
  };

  const displayText = selectedValues.length === 0 
    ? placeholder 
    : selectedValues.length === 1 
    ? options.find(o => o.value === selectedValues[0])?.label || placeholder
    : `${selectedValues.length} selected`;

  return (
    <div>
      <Label className="text-sm font-medium text-foreground mb-1">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            data-testid={testId}
          >
            <span className="truncate">{displayText}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          {searchable ? (
            <Command>
              <CommandInput 
                placeholder={`Search ${label.toLowerCase()}...`} 
                data-testid={`${testId}-search`}
              />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      onSelect={() => handleToggle(option.value)}
                      className="cursor-pointer"
                      data-testid={`${testId}-option-${option.value}`}
                    >
                      <Checkbox
                        checked={selectedValues.includes(option.value)}
                        className="mr-2"
                        data-testid={`${testId}-checkbox-${option.value}`}
                      />
                      {option.label}
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : (
            <div className="p-2 max-h-64 overflow-y-auto">
              {options.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 py-2 px-2 hover:bg-accent rounded cursor-pointer"
                  onClick={() => handleToggle(option.value)}
                  data-testid={`${testId}-option-${option.value}`}
                >
                  <Checkbox 
                    checked={selectedValues.includes(option.value)} 
                    data-testid={`${testId}-checkbox-${option.value}`}
                  />
                  <span className="text-sm">{option.label}</span>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function Cases() {
  const { user, clinic } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [filters, setFilters] = useState<CaseFilters>({
    groupBy: 'none',
    sort: 'date',
    order: 'desc',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<{ id: string; caseNumber: string } | null>(null);

  // Load filters from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFilters: CaseFilters = {
      groupBy: (params.get('groupBy') as CaseFilters['groupBy']) || 'none',
      sort: (params.get('sort') as CaseFilters['sort']) || 'date',
      order: (params.get('order') as CaseFilters['order']) || 'desc',
    };

    if (params.get('species')) urlFilters.species = params.get('species')!;
    if (params.get('outcome')) urlFilters.outcome = params.get('outcome')!;
    if (params.get('startDate')) urlFilters.startDate = params.get('startDate')!;
    if (params.get('endDate')) urlFilters.endDate = params.get('endDate')!;
    if (params.getAll('zone').length) urlFilters.zone = params.getAll('zone');
    if (params.getAll('state').length) urlFilters.state = params.getAll('state');
    if (params.getAll('clinicId').length) urlFilters.clinicId = params.getAll('clinicId');
    if (params.getAll('tumourTypeId').length) urlFilters.tumourTypeId = params.getAll('tumourTypeId');

    setFilters(urlFilters);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (filters.species) params.set('species', filters.species);
    if (filters.outcome) params.set('outcome', filters.outcome);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.zone) filters.zone.forEach(z => params.append('zone', z));
    if (filters.state) filters.state.forEach(s => params.append('state', s));
    if (filters.clinicId) filters.clinicId.forEach(c => params.append('clinicId', c));
    if (filters.tumourTypeId) filters.tumourTypeId.forEach(t => params.append('tumourTypeId', t));
    if (filters.groupBy && filters.groupBy !== 'none') params.set('groupBy', filters.groupBy);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.order) params.set('order', filters.order);

    const newSearch = params.toString();
    const newUrl = `/cases${newSearch ? `?${newSearch}` : ''}`;
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [filters]);

  // Fetch lookup data
  const { data: ngStates = [] } = useQuery<NgState[]>({
    queryKey: ['/api/lookups/ng-states'],
  });

  const { data: clinics = [] } = useQuery<Clinic[]>({
    queryKey: ['/api/lookups/clinics'],
  });

  const { data: tumourTypes = [] } = useQuery<TumourType[]>({
    queryKey: ['/api/lookups/tumour-types'],
  });

  // Fetch cases with filters
  const { data: cases, isLoading, error } = useQuery<CaseWithDetails[]>({
    queryKey: ["/api/cases", filters, { limit: pageSize, offset: (currentPage - 1) * pageSize }],
  });

  // Delete case mutation
  const deleteMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete case");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Case deleted successfully",
      });
      setDeleteDialogOpen(false);
      setCaseToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete case",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setCaseToDelete(null);
    },
  });

  const handleDeleteClick = (caseItem: CaseWithDetails) => {
    setCaseToDelete({ id: caseItem.id, caseNumber: caseItem.caseNumber });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (caseToDelete) {
      deleteMutation.mutate(caseToDelete.id);
    }
  };

  const canDeleteCase = (caseItem: CaseWithDetails) => {
    if (!user || !clinic) return false;
    
    const isAdmin = user.role === 'ADMIN';
    const isManager = user.role === 'MANAGER';
    const isCreator = caseItem.createdBy && caseItem.createdBy.id === user.id;
    const isSameClinic = caseItem.clinic && caseItem.clinic.id === clinic.id;
    
    // Allow if:
    // 1. User is ADMIN (can delete any case)
    // 2. User is MANAGER from the same clinic
    // 3. User is the creator from the same clinic
    if (isAdmin) return true;
    if (isManager && isSameClinic) return true;
    if (isCreator && isSameClinic) return true;
    
    return false;
  };

  // Extract unique zones with proper formatting
  const zones = useMemo(() => {
    const formatZoneName = (zone: string) => {
      return zone
        .split('_')
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
    };
    
    const uniqueZones = Array.from(new Set(ngStates.map(s => s.zone))).sort();
    return uniqueZones.map(zone => ({ 
      value: zone, 
      label: formatZoneName(zone) 
    }));
  }, [ngStates]);

  // Filter states based on selected zones (cascading)
  const availableStates = useMemo(() => {
    let statesToShow = ngStates;
    
    if (filters.zone && filters.zone.length > 0) {
      statesToShow = ngStates.filter(s => filters.zone!.includes(s.zone));
    }
    
    return statesToShow
      .map(s => ({ value: s.code, label: s.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ngStates, filters.zone]);

  // Clinic options
  const clinicOptions = useMemo(() => 
    clinics.map(c => ({ value: c.id, label: c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [clinics]
  );

  // Tumour type options
  const tumourTypeOptions = useMemo(() => 
    tumourTypes.map(t => ({ value: t.id, label: t.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [tumourTypes]
  );

  const handleFilterChange = (key: keyof CaseFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: (value === "__all" || !value) ? undefined : value
    }));
    setCurrentPage(1);
  };

  const handleMultiSelectChange = (key: keyof CaseFilters, values: string[]) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: values.length > 0 ? values : undefined };
      
      // Clear state filter if zones change and selected states are no longer in available states
      if (key === 'zone' && prev.state) {
        const validStates = ngStates
          .filter(s => values.length === 0 || values.includes(s.zone))
          .map(s => s.code);
        const filteredStates = prev.state.filter(s => validStates.includes(s));
        newFilters.state = filteredStates.length > 0 ? filteredStates : undefined;
      }
      
      return newFilters;
    });
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({
      groupBy: 'none',
      sort: 'date',
      order: 'desc',
    });
    setCurrentPage(1);
  };

  // Group cases - trust server-provided geoZone
  const groupedCases = useMemo(() => {
    if (!cases || filters.groupBy === 'none') {
      return [{ key: 'all', label: '', cases: cases || [] }];
    }

    const groups = new Map<string, CaseWithDetails[]>();
    
    cases.forEach(caseItem => {
      let groupKey = '';
      let groupLabel = '';
      
      switch (filters.groupBy) {
        case 'zone':
          // Use server-computed geoZone (always present, may be "Unknown")
          groupKey = caseItem.geoZone || 'Unknown';
          groupLabel = groupKey;
          break;
        case 'state':
          groupKey = caseItem.state || 'Unspecified';
          groupLabel = groupKey === 'Unspecified' ? groupKey : (ngStates.find(s => s.code === groupKey)?.name || groupKey);
          break;
        case 'clinic':
          groupKey = caseItem.clinic?.id || 'Unspecified';
          groupLabel = caseItem.clinic?.name || 'Unspecified';
          break;
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(caseItem);
    });

    return Array.from(groups.entries())
      .map(([key, cases]) => ({
        key,
        label: key === 'all' ? '' : ngStates.find(s => s.code === key)?.name || 
               clinics.find(c => c.id === key)?.name || 
               key,
        cases
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cases, filters.groupBy, ngStates, clinics]);

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
        <CardContent className="p-4 space-y-4">
          {/* Row 1: Basic Filters */}
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

          {/* Row 2: Multi-Select Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MultiSelectFilter
              label="Geo-Political Zone"
              options={zones}
              selectedValues={filters.zone || []}
              onSelectionChange={(values) => handleMultiSelectChange('zone', values)}
              placeholder="All Zones"
              testId="filter-zone"
            />

            <MultiSelectFilter
              label="State"
              options={availableStates}
              selectedValues={filters.state || []}
              onSelectionChange={(values) => handleMultiSelectChange('state', values)}
              placeholder="All States"
              testId="filter-state"
              searchable
            />

            <MultiSelectFilter
              label="Clinic"
              options={clinicOptions}
              selectedValues={filters.clinicId || []}
              onSelectionChange={(values) => handleMultiSelectChange('clinicId', values)}
              placeholder="All Clinics"
              testId="filter-clinic"
              searchable
            />

            <MultiSelectFilter
              label="Tumour Type"
              options={tumourTypeOptions}
              selectedValues={filters.tumourTypeId || []}
              onSelectionChange={(values) => handleMultiSelectChange('tumourTypeId', values)}
              placeholder="All Tumour Types"
              testId="filter-tumour-type"
              searchable
            />
          </div>

          {/* Row 3: Grouping and Sorting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-1">Group By</Label>
              <Select value={filters.groupBy || 'none'} onValueChange={(value) => handleFilterChange("groupBy", value as CaseFilters['groupBy'])}>
                <SelectTrigger data-testid="filter-group-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="zone">Geo-Political Zone</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground mb-1">Sort By</Label>
              <Select value={filters.sort || 'date'} onValueChange={(value) => handleFilterChange("sort", value as CaseFilters['sort'])}>
                <SelectTrigger data-testid="filter-sort-by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Diagnosis Date</SelectItem>
                  <SelectItem value="case_number">Case Number</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                  <SelectItem value="zone">Zone</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground mb-1">Sort Order</Label>
              <Select value={filters.order || 'desc'} onValueChange={(value) => handleFilterChange("order", value as CaseFilters['order'])}>
                <SelectTrigger data-testid="filter-sort-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters} data-testid="button-clear-filters" className="w-full">
                <i className="fas fa-times mr-2"></i>Clear All
              </Button>
            </div>
          </div>

          {/* Active Filters Display */}
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
            {filters.species && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Species: {filters.species}
                <button
                  onClick={() => handleFilterChange('species', '')}
                  className="ml-1 hover:text-destructive"
                  data-testid="remove-filter-species"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </Badge>
            )}
            {filters.outcome && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Outcome: {outcomeLabels[filters.outcome as keyof typeof outcomeLabels]}
                <button
                  onClick={() => handleFilterChange('outcome', '')}
                  className="ml-1 hover:text-destructive"
                  data-testid="remove-filter-outcome"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </Badge>
            )}
            {filters.zone && filters.zone.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Zones: {filters.zone.length}
                <button
                  onClick={() => handleMultiSelectChange('zone', [])}
                  className="ml-1 hover:text-destructive"
                  data-testid="remove-filter-zone"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </Badge>
            )}
            {filters.state && filters.state.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                States: {filters.state.length}
                <button
                  onClick={() => handleMultiSelectChange('state', [])}
                  className="ml-1 hover:text-destructive"
                  data-testid="remove-filter-state"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </Badge>
            )}
            {filters.clinicId && filters.clinicId.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Clinics: {filters.clinicId.length}
                <button
                  onClick={() => handleMultiSelectChange('clinicId', [])}
                  className="ml-1 hover:text-destructive"
                  data-testid="remove-filter-clinic"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </Badge>
            )}
            {filters.tumourTypeId && filters.tumourTypeId.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Tumour Types: {filters.tumourTypeId.length}
                <button
                  onClick={() => handleMultiSelectChange('tumourTypeId', [])}
                  className="ml-1 hover:text-destructive"
                  data-testid="remove-filter-tumour-type"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cases Table with Grouping */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {groupedCases.map((group) => (
              <div key={group.key}>
                {group.label && (
                  <div className="sticky top-0 z-10 bg-muted px-4 py-3 border-b">
                    <h3 className="text-lg font-semibold text-foreground">{group.label}</h3>
                  </div>
                )}
                <Table>
                  {group.key === 'all' && (
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case ID</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Tumour Type</TableHead>
                        <TableHead>Clinic</TableHead>
                        <TableHead>Geo-Political Zone</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Diagnosis Date</TableHead>
                        <TableHead>Files</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  )}
                  <TableBody>
                    {group.cases && group.cases.length > 0 ? (
                      group.cases.map((caseItem) => (
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
                            {caseItem.clinic?.name || "Not specified"}
                          </TableCell>
                          <TableCell>
                            {caseItem.geoZone || "Unknown"}
                          </TableCell>
                          <TableCell>
                            {caseItem.state ? ngStates.find(s => s.code === caseItem.state)?.name || caseItem.state : "Not specified"}
                          </TableCell>
                          <TableCell>
                            {new Date(caseItem.diagnosisDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {caseItem.attachmentsCount && caseItem.attachmentsCount > 0 ? (
                              <div className="flex items-center gap-2">
                                {caseItem.firstImageUrl && (
                                  <img
                                    src={caseItem.firstImageUrl}
                                    alt="Thumbnail"
                                    className="h-8 w-8 object-cover rounded border"
                                    data-testid={`attachment-thumbnail-${caseItem.id}`}
                                  />
                                )}
                                <Badge variant="secondary" data-testid={`attachment-count-${caseItem.id}`}>
                                  {caseItem.attachmentsCount}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {caseItem.outcome && (
                              <Badge className={outcomeColors[caseItem.outcome]}>
                                {outcomeLabels[caseItem.outcome]}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button asChild variant="ghost" size="sm" data-testid={`view-case-${caseItem.id}`}>
                                <Link href={`/cases/${caseItem.id}`}>
                                  <i className="fas fa-eye mr-2"></i>View
                                </Link>
                              </Button>
                              {canDeleteCase(caseItem) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(caseItem)}
                                  data-testid={`delete-case-${caseItem.id}`}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          No cases found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {cases && cases.length >= pageSize && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {currentPage}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={cases.length < pageSize}
            data-testid="button-next-page"
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-case-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Case</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete case <strong>{caseToDelete?.caseNumber}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-case">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-case"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

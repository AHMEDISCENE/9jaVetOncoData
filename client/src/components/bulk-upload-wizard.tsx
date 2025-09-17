import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ImportJob } from "@shared/schema";

interface FileUploadState {
  file: File | null;
  uploading: boolean;
  preview: any[] | null;
  headers: string[] | null;
  mapping: Record<string, string>;
  validation: {
    valid: number;
    warnings: number;
    errors: number;
  } | null;
}

const caseFields = [
  { value: "patientName", label: "Patient Name" },
  { value: "species", label: "Species" },
  { value: "breed", label: "Breed" },
  { value: "sex", label: "Sex" },
  { value: "ageYears", label: "Age (Years)" },
  { value: "ageMonths", label: "Age (Months)" },
  { value: "diagnosisDate", label: "Diagnosis Date" },
  { value: "tumourTypeCustom", label: "Tumour Type" },
  { value: "anatomicalSiteCustom", label: "Anatomical Site" },
  { value: "laterality", label: "Laterality" },
  { value: "stage", label: "Stage" },
  { value: "diagnosisMethod", label: "Diagnosis Method" },
  { value: "treatmentPlan", label: "Treatment Plan" },
  { value: "treatmentStart", label: "Treatment Start Date" },
  { value: "notes", label: "Notes" },
];

const allowedFileTypes = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'application/zip',
  'application/pdf'
];

export default function BulkUploadWizard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadState, setUploadState] = useState<FileUploadState>({
    file: null,
    uploading: false,
    preview: null,
    headers: null,
    mapping: {},
    validation: null,
  });

  const [dragActive, setDragActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'validation'>('upload');

  // Fetch import jobs history
  const { data: importJobs, isLoading: jobsLoading } = useQuery<ImportJob[]>({
    queryKey: ["/api/bulk-upload/jobs"],
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/bulk-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-upload/jobs"] });
      toast({
        title: "File uploaded successfully",
        description: "Your file has been processed and is ready for mapping.",
      });
      // Mock preview data for demonstration
      setUploadState(prev => ({
        ...prev,
        preview: generateMockPreview(),
        headers: ['patient_name', 'species', 'breed', 'tumour_type', 'diagnosis_date'],
        validation: { valid: 247, warnings: 12, errors: 3 }
      }));
      setCurrentStep('mapping');
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Import data mutation
  const importMutation = useMutation({
    mutationFn: async (mapping: Record<string, string>) => {
      const response = await apiRequest("POST", "/api/bulk-upload/import", {
        fileId: "temp-id", // Would be real file ID
        mapping,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-upload/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Import started",
        description: "Your data import is processing in the background.",
      });
      resetUploadState();
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateMockPreview = () => [
    { patient_name: "Max", species: "Canine", breed: "Golden Retriever", tumour_type: "Mammary Gland Tumour", diagnosis_date: "2024-01-15" },
    { patient_name: "Bella", species: "Feline", breed: "Persian", tumour_type: "Lymphoma", diagnosis_date: "2024-01-20" },
    { patient_name: "Charlie", species: "Canine", breed: "German Shepherd", tumour_type: "Skin Tumour", diagnosis_date: "2024-01-25" },
  ];

  const resetUploadState = () => {
    setUploadState({
      file: null,
      uploading: false,
      preview: null,
      headers: null,
      mapping: {},
      validation: null,
    });
    setCurrentStep('upload');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!allowedFileTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV, XLSX, JSON, ZIP, or PDF file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 50MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadState(prev => ({ ...prev, file, uploading: true }));
    uploadMutation.mutate(file);
  };

  const handleMappingChange = (csvColumn: string, caseField: string) => {
    setUploadState(prev => ({
      ...prev,
      mapping: {
        ...prev.mapping,
        [csvColumn]: caseField
      }
    }));
  };

  const handleImport = () => {
    if (Object.keys(uploadState.mapping).length === 0) {
      toast({
        title: "No mapping defined",
        description: "Please map at least one column before importing.",
        variant: "destructive",
      });
      return;
    }
    
    importMutation.mutate(uploadState.mapping);
  };

  const downloadTemplate = () => {
    const csvContent = "patient_name,species,breed,sex,age_years,age_months,diagnosis_date,tumour_type,anatomical_site,laterality,stage,diagnosis_method,treatment_plan,treatment_start,notes\n";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = '9ja-vetoncodata-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Bulk Data Upload</h2>
        <p className="text-muted-foreground">Import multiple cases from CSV, XLSX, JSON, or PDF files</p>
      </div>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <Card className={`mb-8 border-dashed ${dragActive ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <CardContent
            className="p-8 text-center"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            data-testid="file-upload-area"
          >
            <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <i className="fas fa-cloud-upload-alt text-primary text-2xl"></i>
            </div>
            
            <h3 className="text-lg font-semibold text-foreground mb-2">Upload your data files</h3>
            <p className="text-muted-foreground mb-4">
              Supports CSV, XLSX, JSON, ZIP files, and PDF table extraction
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                data-testid="button-choose-files"
              >
                {uploadMutation.isPending ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Uploading...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus mr-2"></i>
                    Choose Files
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={downloadTemplate}
                data-testid="button-download-template"
              >
                <i className="fas fa-download mr-2"></i>
                Download Template
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              Maximum file size: 50MB. For larger files, please split into multiple uploads.
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInput}
              accept=".csv,.xlsx,.xls,.json,.zip,.pdf"
              className="hidden"
              data-testid="file-input-hidden"
            />
          </CardContent>
        </Card>
      )}

      {/* Mapping Step */}
      {currentStep === 'mapping' && uploadState.headers && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Column Mapping</CardTitle>
            <p className="text-sm text-muted-foreground">
              Map your file columns to the case data fields. Unmapped columns will be ignored.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadState.headers.map((column) => (
                <div key={column} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      CSV Column: <span className="font-mono bg-muted px-2 py-1 rounded">{column}</span>
                    </Label>
                  </div>
                  <div>
                    <Select
                      value={uploadState.mapping[column] || ""}
                      onValueChange={(value) => handleMappingChange(column, value)}
                    >
                      <SelectTrigger data-testid={`mapping-select-${column}`}>
                        <SelectValue placeholder="Select field to map to" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Don't map</SelectItem>
                        {caseFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {/* Validation Preview */}
            {uploadState.validation && (
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="text-md font-medium text-foreground mb-3">Validation Preview</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600" data-testid="validation-valid-count">
                      {uploadState.validation.valid}
                    </div>
                    <div className="text-muted-foreground">Valid rows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600" data-testid="validation-warning-count">
                      {uploadState.validation.warnings}
                    </div>
                    <div className="text-muted-foreground">Warnings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600" data-testid="validation-error-count">
                      {uploadState.validation.errors}
                    </div>
                    <div className="text-muted-foreground">Errors</div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Data */}
            {uploadState.preview && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-foreground mb-3">Data Preview</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {uploadState.headers.map((header) => (
                          <TableHead key={header}>{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadState.preview.slice(0, 3).map((row, index) => (
                        <TableRow key={index}>
                          {uploadState.headers!.map((header) => (
                            <TableCell key={header} className="text-sm">
                              {row[header] || "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing first 3 rows. Full dataset will be processed during import.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={resetUploadState}
                data-testid="button-start-over"
              >
                Start Over
              </Button>
              
              <div className="space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('validation')}
                  data-testid="button-preview-data"
                >
                  Preview Data
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importMutation.isPending || Object.keys(uploadState.mapping).length === 0}
                  data-testid="button-import-data"
                >
                  {importMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Importing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-upload mr-2"></i>
                      Import Data
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Imports</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : importJobs && importJobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.filename}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          job.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : job.status === "FAILED"
                            ? "bg-red-100 text-red-800"
                            : job.status === "PROCESSING"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span data-testid={`job-records-${job.id}`}>
                        {job.successRows || 0} / {job.totalRows || 0}
                      </span>
                      {job.errorRows && job.errorRows > 0 && (
                        <span className="text-destructive ml-2">
                          ({job.errorRows} errors)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(job.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {job.status === "COMPLETED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-view-log-${job.id}`}
                          >
                            <i className="fas fa-list mr-1"></i>View Log
                          </Button>
                        )}
                        {job.errorFileUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-download-errors-${job.id}`}
                          >
                            <i className="fas fa-download mr-1"></i>Download Errors
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <i className="fas fa-upload text-4xl mb-4"></i>
              <h3 className="text-lg font-medium mb-2">No imports yet</h3>
              <p className="text-sm">
                Upload your first data file to get started with bulk importing cases.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

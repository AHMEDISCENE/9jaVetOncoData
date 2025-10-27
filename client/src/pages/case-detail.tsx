import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { FileText, Image, Upload, X, ArrowLeft } from "lucide-react";
import type { CaseFile } from "@shared/schema";

interface CaseWithDetails {
  id: string;
  caseNumber: string;
  patientName?: string;
  species: string;
  breed: string;
  sex?: string;
  ageYears?: number;
  ageMonths?: number;
  diagnosisDate: string;
  tumourType?: { name: string };
  tumourTypeCustom?: string;
  anatomicalSite?: { name: string };
  anatomicalSiteCustom?: string;
  laterality?: string;
  stage?: string;
  diagnosisMethod?: string;
  treatmentPlan?: string;
  treatmentStart?: string;
  notes?: string;
  outcome?: string;
  createdBy: { name: string };
  clinic: { name: string };
}

export default function CaseDetail() {
  const [, params] = useRoute("/cases/:id");
  const caseId = params?.id;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: caseData, isLoading: caseLoading } = useQuery<CaseWithDetails>({
    queryKey: [`/api/cases/${caseId}`],
    enabled: !!caseId,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<CaseFile[]>({
    queryKey: [`/api/cases/${caseId}/files`],
    enabled: !!caseId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/cases/${caseId}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/files`] });
      toast({
        title: "File uploaded successfully",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await apiRequest(`/api/cases/${caseId}/files/${fileId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cases/${caseId}/files`] });
      toast({
        title: "File deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete file",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 20MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    uploadMutation.mutate(file);
  };

  if (caseLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Case not found</div>
      </div>
    );
  }

  const imageFiles = files.filter(f => f.kind === 'image');
  const documentFiles = files.filter(f => f.kind === 'file');

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/cases">
            <Button variant="ghost" size="sm" data-testid="button-back-to-cases">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cases
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-2" data-testid="text-case-number">{caseData.caseNumber}</h1>
          <p className="text-muted-foreground" data-testid="text-patient-name">
            {caseData.patientName || "Unnamed Patient"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/cases/${caseId}/edit`}>
            <Button variant="outline" data-testid="button-edit-case">
              Edit Case
            </Button>
          </Link>
        </div>
      </div>

      {/* Patient Information */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Species</p>
              <p className="font-medium" data-testid="text-species">{caseData.species}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Breed</p>
              <p className="font-medium" data-testid="text-breed">{caseData.breed}</p>
            </div>
            {caseData.sex && (
              <div>
                <p className="text-sm text-muted-foreground">Sex</p>
                <p className="font-medium">{caseData.sex.replace(/_/g, ' ')}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Age</p>
              <p className="font-medium">{caseData.ageYears || 0}y {caseData.ageMonths || 0}m</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tumour Details */}
      <Card>
        <CardHeader>
          <CardTitle>Tumour Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Tumour Type</p>
              <p className="font-medium">{caseData.tumourType?.name || caseData.tumourTypeCustom || "Not specified"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Anatomical Site</p>
              <p className="font-medium">{caseData.anatomicalSite?.name || caseData.anatomicalSiteCustom || "Not specified"}</p>
            </div>
            {caseData.laterality && (
              <div>
                <p className="text-sm text-muted-foreground">Laterality</p>
                <p className="font-medium">{caseData.laterality}</p>
              </div>
            )}
            {caseData.stage && (
              <div>
                <p className="text-sm text-muted-foreground">Stage</p>
                <p className="font-medium">{caseData.stage}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis & Treatment */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnosis & Treatment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Diagnosis Date</p>
            <p className="font-medium">{new Date(caseData.diagnosisDate).toLocaleDateString()}</p>
          </div>
          {caseData.diagnosisMethod && (
            <div>
              <p className="text-sm text-muted-foreground">Diagnosis Method</p>
              <p className="font-medium">{caseData.diagnosisMethod}</p>
            </div>
          )}
          {caseData.treatmentPlan && (
            <div>
              <p className="text-sm text-muted-foreground">Treatment Plan</p>
              <p className="font-medium whitespace-pre-wrap">{caseData.treatmentPlan}</p>
            </div>
          )}
          {caseData.treatmentStart && (
            <div>
              <p className="text-sm text-muted-foreground">Treatment Start</p>
              <p className="font-medium">{new Date(caseData.treatmentStart).toLocaleDateString()}</p>
            </div>
          )}
          {caseData.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="font-medium whitespace-pre-wrap">{caseData.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Attachments</CardTitle>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.csv"
                data-testid="input-file-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || files.length >= 10}
                data-testid="button-upload-file"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          </div>
          {files.length >= 10 && (
            <p className="text-sm text-muted-foreground mt-2">Maximum 10 files per case</p>
          )}
        </CardHeader>
        <CardContent>
          {filesLoading ? (
            <div className="text-center py-4">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No attachments yet</p>
              <p className="text-sm">Upload images or documents to attach to this case</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Images */}
              {imageFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Images</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imageFiles.map((file) => (
                      <div key={file.id} className="relative group" data-testid={`image-${file.id}`}>
                        <img
                          src={`/api/cases/${caseData.id}/files/${file.id}/download`}
                          alt={file.originalName}
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMutation.mutate(file.id)}
                            data-testid={`button-delete-${file.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs truncate mt-1">{file.originalName}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              {documentFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Documents</h3>
                  <div className="space-y-2">
                    {documentFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                        data-testid={`document-${file.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{file.originalName}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            data-testid={`button-download-${file.id}`}
                          >
                            <a href={`/api/cases/${caseData.id}/files/${file.id}/download`} target="_blank" rel="noopener noreferrer">
                              View
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(file.id)}
                            data-testid={`button-delete-${file.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

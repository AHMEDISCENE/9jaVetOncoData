import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { FileText, Image, Upload, X, ArrowLeft, Eye, MapPin, User, Calendar, Stethoscope, AlertCircle } from "lucide-react";
import type { CaseFile } from "@shared/schema";

const outcomeColors: Record<string, string> = {
  REMISSION: "bg-emerald-100 text-emerald-900",
  TREATMENT_ONGOING: "bg-blue-100 text-blue-900",
  MORTALITY: "bg-red-100 text-red-900",
  EUTHANASIA: "bg-orange-100 text-orange-900",
  MANAGEMENT: "bg-purple-100 text-purple-900",
};

const outcomeLabels: Record<string, string> = {
  REMISSION: "Remission",
  TREATMENT_ONGOING: "Ongoing Treatment",
  MORTALITY: "Mortality",
  EUTHANASIA: "Euthanasia",
  MANAGEMENT: "Management",
};

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
  createdBy: { 
    name: string;
    title?: string;
    jobTitle?: string;
    specialty?: string;
    image?: string;
  };
  clinic: { 
    name: string;
    state?: string;
    city?: string;
    address?: string;
  };
}

export default function CaseDetail() {
  const [, params] = useRoute("/cases/:id");
  const caseId = params?.id;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

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
      return await apiRequest("DELETE", `/api/cases/${caseId}/files/${fileId}`);
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

    const maxSize = 20 * 1024 * 1024;
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading case details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8">
        <div className="container mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">Case Not Found</h2>
            <p className="text-muted-foreground mb-6">We couldn't find the case you're looking for.</p>
            <Link href="/cases">
              <Button><ArrowLeft className="h-4 w-4 mr-2" />Back to Cases</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const imageFiles = files.filter(f => f.kind === 'image');
  const documentFiles = files.filter(f => f.kind === 'file');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl space-y-8">
        {/* Header Section */}
        <div>
          <Link href="/cases">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-cases">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cases
            </Button>
          </Link>
          
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="mb-2">
                <Badge variant="outline" className="mb-3">{caseData.caseNumber}</Badge>
              </div>
              <h1 className="text-4xl font-bold text-foreground mb-1" data-testid="text-case-number">
                {caseData.patientName || "Patient Case"}
              </h1>
              <p className="text-lg text-muted-foreground">
                {caseData.species} • {caseData.breed}
              </p>
            </div>

            {/* User & Clinic Info Card */}
            <div className="flex flex-col gap-3 w-full sm:w-80">
              {/* User Card */}
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {caseData.createdBy.image ? (
                      <img 
                        src={caseData.createdBy.image} 
                        alt={caseData.createdBy.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-primary/20"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/20">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight" data-testid="text-creator-name">
                        {caseData.createdBy.title ? `${caseData.createdBy.title}. ` : ""}{caseData.createdBy.name}
                      </p>
                      {caseData.createdBy.jobTitle && (
                        <p className="text-xs text-muted-foreground" data-testid="text-creator-job">
                          {caseData.createdBy.jobTitle}
                        </p>
                      )}
                    </div>
                  </div>
                  {caseData.createdBy.specialty && (
                    <Badge variant="secondary" className="text-xs" data-testid="text-creator-specialty">
                      {caseData.createdBy.specialty}
                    </Badge>
                  )}
                </CardContent>
              </Card>

              {/* Edit Button */}
              <Link href={`/cases/${caseId}/edit`}>
                <Button className="w-full" data-testid="button-edit-case">
                  Edit Case
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Key Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Patient Age */}
          <Card className="bg-white/50 dark:bg-slate-900/50 border-none shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Age</p>
              <p className="text-2xl font-bold">{caseData.ageYears || 0}y {caseData.ageMonths || 0}m</p>
            </CardContent>
          </Card>

          {/* Sex */}
          {caseData.sex && (
            <Card className="bg-white/50 dark:bg-slate-900/50 border-none shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Sex</p>
                <p className="text-2xl font-bold">{caseData.sex.replace(/_/g, ' ')}</p>
              </CardContent>
            </Card>
          )}

          {/* Diagnosis Date */}
          <Card className="bg-white/50 dark:bg-slate-900/50 border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Diagnosis</p>
              </div>
              <p className="text-lg font-bold">{new Date(caseData.diagnosisDate).toLocaleDateString()}</p>
            </CardContent>
          </Card>

          {/* Outcome Status */}
          {caseData.outcome && (
            <Card className="bg-white/50 dark:bg-slate-900/50 border-none shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Status</p>
                <Badge className={outcomeColors[caseData.outcome] || "bg-gray-100 text-gray-800"}>
                  {outcomeLabels[caseData.outcome] || caseData.outcome}
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Patient & Tumour Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Patient Information */}
            <Card className="border-none shadow-md">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-1 w-1 rounded-full bg-primary"></div>
                  Patient Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InfoField label="Patient Name" value={caseData.patientName || "Unnamed Patient"} testId="text-patient-name" />
                  <InfoField label="Species" value={caseData.species} testId="text-species" />
                  <InfoField label="Breed" value={caseData.breed} testId="text-breed" />
                </div>
              </CardContent>
            </Card>

            {/* Tumour Details */}
            <Card className="border-none shadow-md">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Tumour Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <InfoField 
                    label="Tumour Type" 
                    value={caseData.tumourType?.name || caseData.tumourTypeCustom || "Not specified"} 
                  />
                  <InfoField 
                    label="Anatomical Site" 
                    value={caseData.anatomicalSite?.name || caseData.anatomicalSiteCustom || "Not specified"} 
                  />
                  {caseData.laterality && (
                    <InfoField label="Laterality" value={caseData.laterality} />
                  )}
                  {caseData.stage && (
                    <InfoField label="Stage" value={caseData.stage} />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Diagnosis & Treatment */}
            <Card className="border-none shadow-md">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b">
                <CardTitle className="text-lg">Diagnosis & Treatment</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {caseData.diagnosisMethod && (
                  <InfoField label="Diagnosis Method" value={caseData.diagnosisMethod} />
                )}
                {caseData.treatmentStart && (
                  <InfoField 
                    label="Treatment Started" 
                    value={new Date(caseData.treatmentStart).toLocaleDateString()} 
                  />
                )}
                {caseData.treatmentPlan && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Treatment Plan</p>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                      <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">{caseData.treatmentPlan}</p>
                    </div>
                  </div>
                )}
                {caseData.notes && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                      <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">{caseData.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Clinic Info & Files Summary */}
          <div className="space-y-6">
            {/* Clinic Information */}
            <Card className="border-l-4 border-l-amber-500 shadow-md">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-amber-600" />
                  Clinic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <InfoField label="Clinic Name" value={caseData.clinic.name} testId="text-clinic-name" />
                {caseData.clinic.state && (
                  <InfoField 
                    label="State" 
                    value={caseData.clinic.state.replace(/_/g, ' ')} 
                    testId="text-clinic-state"
                  />
                )}
                {caseData.clinic.city && (
                  <InfoField label="City" value={caseData.clinic.city} testId="text-clinic-city" />
                )}
                {caseData.clinic.address && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Address</p>
                    <p className="text-sm text-foreground leading-relaxed" data-testid="text-clinic-address">
                      {caseData.clinic.address}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Files Summary */}
            {files.length > 0 && (
              <Card className="shadow-md">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {imageFiles.length > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                        <span className="text-sm font-medium">📷 {imageFiles.length} Image{imageFiles.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {documentFiles.length > 0 && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                        <span className="text-sm font-medium">📄 {documentFiles.length} Document{documentFiles.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Attachments Section */}
        <Card className="border-none shadow-md">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Attachments</CardTitle>
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
                  size="sm"
                  data-testid="button-upload-file"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
            {files.length >= 10 && (
              <p className="text-xs text-muted-foreground mt-2">Maximum 10 files per case reached</p>
            )}
          </CardHeader>
          <CardContent className="p-6">
            {filesLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-2 text-muted-foreground text-sm">Loading files...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Upload className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-foreground mb-1">No attachments yet</p>
                <p className="text-sm text-muted-foreground">Upload images or documents to attach to this case</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Images */}
                {imageFiles.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Image className="h-5 w-5 text-blue-500" />
                      Images ({imageFiles.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {imageFiles.map((file) => (
                        <div key={file.id} className="relative group" data-testid={`image-${file.id}`}>
                          <div className="relative overflow-hidden rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                            <img
                              src={`/api/cases/${caseData.id}/files/${file.id}/download`}
                              alt={file.originalName}
                              className="w-full h-32 object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                              onClick={() => setSelectedImageId(file.id)}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                              <Button
                                onClick={() => setSelectedImageId(file.id)}
                                className="bg-white/95 hover:bg-white text-black h-8 rounded-lg text-xs"
                                data-testid={`button-view-${file.id}`}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => deleteMutation.mutate(file.id)}
                                data-testid={`button-delete-${file.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs truncate mt-2 text-muted-foreground">{file.originalName}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {documentFiles.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-amber-500" />
                      Documents ({documentFiles.length})
                    </h3>
                    <div className="space-y-2">
                      {documentFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group"
                          data-testid={`document-${file.id}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-5 w-5 text-amber-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{file.originalName}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
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
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
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

      {/* Fullscreen Image Viewer */}
      <Dialog open={!!selectedImageId} onOpenChange={(open) => !open && setSelectedImageId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-black border-0">
          <DialogTitle className="sr-only">Image Viewer</DialogTitle>
          {selectedImageId && imageFiles.find(f => f.id === selectedImageId) && (
            <div className="relative w-full h-[80vh] flex items-center justify-center">
              <img
                src={`/api/cases/${caseData?.id}/files/${selectedImageId}/download`}
                alt="Full view"
                className="max-w-full max-h-full object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full h-10 w-10 shadow-lg"
                onClick={() => setSelectedImageId(null)}
                data-testid="button-close-fullscreen"
              >
                <X className="h-6 w-6" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="absolute bottom-6 right-6 rounded-full h-10 w-10 shadow-lg"
                onClick={() => {
                  deleteMutation.mutate(selectedImageId);
                  setSelectedImageId(null);
                }}
                data-testid="button-delete-fullscreen"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for consistent info fields
function InfoField({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
      <p className="text-foreground font-semibold" data-testid={testId}>{value}</p>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { TumourType, AnatomicalSite, Clinic } from "@shared/schema";
import { NIGERIA_STATES, getZoneForState, formatStateName, formatZoneName, SPECIES_BREEDS } from "@/lib/constants";
import { useAttachmentQueue } from "@/hooks/use-attachment-queue";
import { Paperclip, X, Upload, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const caseSchema = z.object({
  state: z.string().min(1, "State is required"),
  clinicId: z.string().min(1, "Clinic is required"),
  patientName: z.string().optional(),
  species: z.string().min(1, "Species is required"),
  breed: z.string().min(1, "Breed is required"),
  sex: z.enum(["MALE_NEUTERED", "MALE_INTACT", "FEMALE_SPAYED", "FEMALE_INTACT"]).optional(),
  ageYears: z.number().min(0).max(30).optional(),
  ageMonths: z.number().min(0).max(11).optional(),
  diagnosisDate: z.string().min(1, "Diagnosis date is required"),
  tumourTypeId: z.string().transform(val => val === "" ? undefined : val).optional(),
  tumourTypeCustom: z.string().transform(val => val === "" ? undefined : val).optional(),
  anatomicalSiteId: z.string().transform(val => val === "" ? undefined : val).optional(),
  anatomicalSiteCustom: z.string().transform(val => val === "" ? undefined : val).optional(),
  laterality: z.string().optional(),
  stage: z.string().optional(),
  diagnosisMethod: z.string().optional(),
  treatmentPlan: z.string().optional(),
  treatmentStart: z.string().transform(val => val === "" ? undefined : val).optional(),
  notes: z.string().optional(),
});

type CaseFormData = z.infer<typeof caseSchema>;

const steps = [
  { id: 1, title: "Patient & Signalment", description: "Basic patient information" },
  { id: 2, title: "Tumour Details", description: "Tumour type and location" },
  { id: 3, title: "Diagnosis & Treatment", description: "Diagnostic and treatment details" },
  { id: 4, title: "Review", description: "Review and submit" },
];

export default function CaseWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { clinic: userClinic } = useAuth();
  
  // Attachment queue
  const attachmentQueue = useAttachmentQueue();
  const [uploadProgress, setUploadProgress] = useState<Record<string, { progress: number; error?: string }>>({});
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  useEffect(() => {
    setUploadProgress(prev => {
      const activeIds = new Set(attachmentQueue.queuedFiles.map(file => file.id));
      let mutated = false;
      const next = { ...prev };
      for (const key of Object.keys(prev)) {
        if (!activeIds.has(key)) {
          delete next[key];
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [attachmentQueue.queuedFiles]);

  const form = useForm<CaseFormData>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      state: "",
      clinicId: userClinic?.id || "",
      patientName: "",
      species: "",
      breed: "",
      diagnosisDate: new Date().toISOString().split('T')[0],
      tumourTypeId: "",
      tumourTypeCustom: "",
      anatomicalSiteId: "", 
      anatomicalSiteCustom: "",
      laterality: "",
      stage: "",
      diagnosisMethod: "",
      treatmentPlan: "",
      treatmentStart: "",
      notes: "",
    },
  });

  const watchedSpecies = form.watch("species");
  const watchedState = form.watch("state");
  const geoZone = watchedState ? getZoneForState(watchedState) : null;

  // Auto-save draft
  useEffect(() => {
    const subscription = form.watch((values) => {
      localStorage.setItem("caseWizardDraft", JSON.stringify(values));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem("caseWizardDraft");
    if (draft) {
      try {
        const draftData = JSON.parse(draft);
        form.reset(draftData);
      } catch (error) {
        console.error("Failed to load draft:", error);
      }
    }
  }, [form]);

  // Reset breed when species changes
  useEffect(() => {
    form.setValue("breed", "");
  }, [watchedSpecies, form]);

  const { data: clinics } = useQuery<Clinic[]>({
    queryKey: ["/api/clinics"],
  });

  const { data: tumourTypes } = useQuery<TumourType[]>({
    queryKey: ["/api/vocabulary/tumour-types", { species: watchedSpecies }],
    enabled: !!watchedSpecies,
  });

  const { data: anatomicalSites } = useQuery<AnatomicalSite[]>({
    queryKey: ["/api/vocabulary/anatomical-sites", { species: watchedSpecies }],
    enabled: !!watchedSpecies,
  });

  // Prefill clinic when user clinic is available
  useEffect(() => {
    if (userClinic?.id && !form.getValues("clinicId")) {
      form.setValue("clinicId", userClinic.id);
    }
  }, [userClinic, form]);

  const createCaseMutation = useMutation({
    mutationFn: async (data: CaseFormData) => {
      // Transform data to properly handle custom vs selected values
      const transformedData = {
        ...data,
        // If tumourTypeId is "OTHER", clear it and use tumourTypeCustom instead
        tumourTypeId: data.tumourTypeId === "OTHER" ? undefined : data.tumourTypeId,
        tumourTypeCustom: data.tumourTypeId === "OTHER" ? data.tumourTypeCustom : undefined,
        // If anatomicalSiteId is "OTHER", clear it and use anatomicalSiteCustom instead  
        anatomicalSiteId: data.anatomicalSiteId === "OTHER" ? undefined : data.anatomicalSiteId,
        anatomicalSiteCustom: data.anatomicalSiteId === "OTHER" ? data.anatomicalSiteCustom : undefined,
      };

      const response = await apiRequest("POST", "/api/cases", transformedData);
      return response.json();
    },
    onSuccess: async (newCase) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      localStorage.removeItem("caseWizardDraft");
      
      // Upload queued files if any
      if (attachmentQueue.hasFiles) {
        setIsUploadingFiles(true);
        const failedFiles: string[] = [];
        const totalFiles = attachmentQueue.fileCount;

        for (const queuedFile of attachmentQueue.queuedFiles) {
          setUploadProgress(prev => ({ ...prev, [queuedFile.id]: { progress: 0 } }));

          const formData = new FormData();
          formData.append('file', queuedFile.file);

          const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/api/cases/${newCase.id}/files`);
            xhr.withCredentials = true;
            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) return;
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(prev => ({
                ...prev,
                [queuedFile.id]: { progress: percent },
              }));
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setUploadProgress(prev => ({
                  ...prev,
                  [queuedFile.id]: { progress: 100 },
                }));
                resolve({ success: true });
              } else {
                let errorMessage = 'Upload failed';
                try {
                  const response = JSON.parse(xhr.responseText);
                  if (response?.message) {
                    errorMessage = response.message;
                  }
                } catch (parseError) {
                  console.error('Failed to parse upload error response', parseError);
                }
                setUploadProgress(prev => ({
                  ...prev,
                  [queuedFile.id]: { progress: 0, error: errorMessage },
                }));
                resolve({ success: false, error: errorMessage });
              }
            };

            xhr.onerror = () => {
              const errorMessage = 'Network error while uploading';
              setUploadProgress(prev => ({
                ...prev,
                [queuedFile.id]: { progress: 0, error: errorMessage },
              }));
              resolve({ success: false, error: errorMessage });
            };

            xhr.send(formData);
          });

          if (!result.success) {
            failedFiles.push(queuedFile.file.name);
          }
        }

        setIsUploadingFiles(false);
        attachmentQueue.clearQueue();
        setUploadProgress({});

        try {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: [`/api/cases/${newCase.id}/files`] }),
            queryClient.invalidateQueries({ queryKey: [`/api/cases/${newCase.id}`] }),
          ]);
        } catch (invalidateError) {
          console.error('Failed to refresh case attachment queries', invalidateError);
        }

        if (failedFiles.length > 0) {
          toast({
            title: 'Case saved',
            description: failedFiles.length === 1
              ? 'Case saved; 1 file failed to upload. You can retry from Attachments.'
              : `Case saved; ${failedFiles.length} files failed to upload. You can retry from Attachments.`,
          });
        } else {
          toast({
            title: 'Case saved',
            description: totalFiles > 0
              ? `Case saved; ${totalFiles} attachment${totalFiles === 1 ? '' : 's'} uploaded.`
              : 'The new case has been added to your records.',
          });
        }
      } else {
        toast({
          title: 'Case saved',
          description: 'The new case has been added to your records.',
        });
      }

      setLocation(`/cases/${newCase.id}`);
    },
    onError: (error) => {
      toast({
        title: "Failed to create case",
        description: error instanceof Error ? error.message : "Please check your information and try again.",
        variant: "destructive",
      });
    },
  });

  const nextStep = () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    form.trigger(fieldsToValidate).then((isValid) => {
      if (isValid) {
        setCurrentStep(prev => Math.min(4, prev + 1));
      }
    });
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const getFieldsForStep = (step: number): (keyof CaseFormData)[] => {
    switch (step) {
      case 1:
        return ["state", "clinicId", "species", "breed", "diagnosisDate"];
      case 2:
        return [];
      case 3:
        return [];
      default:
        return [];
    }
  };

  const onSubmit = (data: CaseFormData) => {
    createCaseMutation.mutate(data);
  };

  const clearDraft = () => {
    localStorage.removeItem("caseWizardDraft");
    form.reset();
    toast({
      title: "Draft cleared",
      description: "The saved draft has been cleared.",
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Wizard Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-4">New Case Entry</h2>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center space-x-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.id 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  {step.id}
                </div>
                <div className="hidden sm:block">
                  <span className={`text-sm font-medium ${
                    currentStep >= step.id ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {step.title}
                  </span>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 h-px bg-border mx-4"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Patient & Signalment */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  {/* State, Zone, and Clinic */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-state">
                                <SelectValue placeholder="Select State" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {NIGERIA_STATES.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {formatStateName(state)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">Geo-political Zone</div>
                      <Input 
                        value={geoZone ? formatZoneName(geoZone) : ""} 
                        disabled 
                        className="bg-muted" 
                        placeholder="Auto-filled from state"
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="clinicId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clinic *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-clinic">
                                <SelectValue placeholder="Select Clinic" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clinics?.map((clinic) => (
                                <SelectItem key={clinic.id} value={clinic.id}>
                                  {clinic.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            Prefilled from your profile, can be changed
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="patientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Patient Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter patient name" data-testid="input-patient-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">Case ID</div>
                      <Input value="Auto-generated on save" disabled className="bg-muted" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="species"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Species *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-species">
                                <SelectValue placeholder="Select Species" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.keys(SPECIES_BREEDS).map((species) => (
                                <SelectItem key={species} value={species}>
                                  {species}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="breed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Breed *</FormLabel>
                          <FormControl>
                            <Combobox
                              value={field.value}
                              onValueChange={field.onChange}
                              options={watchedSpecies ? (SPECIES_BREEDS[watchedSpecies] || []) : []}
                              placeholder={watchedSpecies ? "Select or type breed" : "Select species first"}
                              searchPlaceholder="Search breeds..."
                              emptyText="No breed found. Type to add custom."
                              disabled={!watchedSpecies}
                              testId="select-breed"
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Select from list or type a custom breed
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sex"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sex</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-sex">
                                <SelectValue placeholder="Select Sex" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MALE_NEUTERED">Male Neutered</SelectItem>
                              <SelectItem value="MALE_INTACT">Male Intact</SelectItem>
                              <SelectItem value="FEMALE_SPAYED">Female Spayed</SelectItem>
                              <SelectItem value="FEMALE_INTACT">Female Intact</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <FormLabel>Age</FormLabel>
                      <div className="flex space-x-2 mt-2">
                        <FormField
                          control={form.control}
                          name="ageYears"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Years"
                                  min="0"
                                  max="30"
                                  data-testid="input-age-years"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="ageMonths"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Months"
                                  min="0"
                                  max="11"
                                  data-testid="input-age-months"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="diagnosisDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Diagnosis Date *</FormLabel>
                          <FormControl>
                            <Input type="date" data-testid="input-diagnosis-date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Tumour Details */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="tumourTypeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tumour Type</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              if (value === "OTHER") {
                                field.onChange("OTHER");
                                form.setValue("tumourTypeCustom", "");
                              } else {
                                field.onChange(value);
                                form.setValue("tumourTypeCustom", "");
                              }
                            }} 
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-tumour-type">
                                <SelectValue placeholder="Select tumour type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tumourTypes?.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="OTHER">Other (specify)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("tumourTypeId") === "OTHER" && (
                      <FormField
                        control={form.control}
                        name="tumourTypeCustom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Other (specify)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter custom tumour type" data-testid="input-custom-tumour" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="anatomicalSiteId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Anatomical Site</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              if (value === "OTHER") {
                                field.onChange("OTHER");
                                form.setValue("anatomicalSiteCustom", "");
                              } else {
                                field.onChange(value);
                                form.setValue("anatomicalSiteCustom", "");
                              }
                            }} 
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-anatomical-site">
                                <SelectValue placeholder="Select anatomical site" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {anatomicalSites?.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="OTHER">Other (specify)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("anatomicalSiteId") === "OTHER" && (
                      <FormField
                        control={form.control}
                        name="anatomicalSiteCustom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Other (specify)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter custom anatomical site" data-testid="input-custom-site" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="laterality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Laterality</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-laterality">
                                <SelectValue placeholder="Select laterality" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="left">Left</SelectItem>
                              <SelectItem value="right">Right</SelectItem>
                              <SelectItem value="bilateral">Bilateral</SelectItem>
                              <SelectItem value="central">Central</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="stage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stage</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., T1N0M0, Stage I" data-testid="input-stage" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Diagnosis & Treatment */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="diagnosisMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Diagnosis Method</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Histopathology, Cytology, Imaging" data-testid="input-diagnosis-method" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="treatmentPlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Treatment Plan</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the treatment plan and approach"
                            className="min-h-20"
                            data-testid="textarea-treatment-plan"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="treatmentStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Treatment Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-treatment-start" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any additional notes or observations"
                            className="min-h-20"
                            data-testid="textarea-notes"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Attachments Panel */}
                  <div className="border-t pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            Attachments (Optional)
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Add images, PDFs, or documents. Max 20MB per file, up to {attachmentQueue.maxFiles} files total.
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {attachmentQueue.fileCount}/{attachmentQueue.maxFiles}
                        </Badge>
                      </div>

                      {/* Validation Errors */}
                      {attachmentQueue.validationErrors.length > 0 && (
                        <Alert variant="destructive">
                          <AlertDescription>
                            <ul className="list-disc list-inside space-y-1">
                              {attachmentQueue.validationErrors.map((error, idx) => (
                                <li key={idx} className="text-sm">
                                  {error.fileName}: {error.message}
                                </li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* File Upload Area */}
                      <div
                        className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => document.getElementById('file-input')?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('border-primary');
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('border-primary');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-primary');
                          if (e.dataTransfer.files) {
                            attachmentQueue.addFiles(e.dataTransfer.files);
                          }
                        }}
                        data-testid="attachment-drop-zone"
                      >
                        <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Images, PDF, DOC, DOCX, CSV (max 20MB each)
                        </p>
                        <input
                          id="file-input"
                          type="file"
                          multiple
                          accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) {
                              attachmentQueue.addFiles(e.target.files);
                              e.target.value = ''; // Reset input
                            }
                          }}
                          data-testid="input-file-upload"
                        />
                      </div>

                      {/* Queued Files Preview */}
                      {attachmentQueue.queuedFiles.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Queued Files ({attachmentQueue.fileCount})</h4>
                          <div className="space-y-2">
                            {attachmentQueue.queuedFiles.map((queuedFile) => {
                              const progressInfo = uploadProgress[queuedFile.id];
                              return (
                                <div
                                  key={queuedFile.id}
                                  className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                                  data-testid={`attachment-item-${queuedFile.id}`}
                                >
                                  {/* File Preview/Icon */}
                                  <div className="flex-shrink-0">
                                    {queuedFile.preview ? (
                                      <img
                                        src={queuedFile.preview}
                                        alt={queuedFile.file.name}
                                        className="h-12 w-12 object-cover rounded"
                                      />
                                    ) : queuedFile.file.type.includes('pdf') ? (
                                      <FileText className="h-12 w-12 text-red-500" />
                                    ) : (
                                      <FileText className="h-12 w-12 text-blue-500" />
                                    )}
                                  </div>

                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {queuedFile.file.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {(queuedFile.file.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                    {progressInfo && (
                                      <div className="mt-2 space-y-1">
                                        <Progress value={progressInfo.progress} className="h-2" />
                                        <div className="flex items-center justify-between text-xs">
                                          <span className={progressInfo.error ? 'text-destructive' : 'text-muted-foreground'}>
                                            {progressInfo.error ?? `${progressInfo.progress}%`}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Remove Button */}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => attachmentQueue.removeFile(queuedFile.id)}
                                    data-testid={`button-remove-attachment-${queuedFile.id}`}
                                    disabled={isUploadingFiles}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Upload Progress (shown during file upload) */}
                      {isUploadingFiles && (
                        <Alert>
                          <AlertDescription>
                            <div className="flex items-center gap-2">
                              <Upload className="h-4 w-4 animate-pulse" />
                              <span className="text-sm">Uploading attachments...</span>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h3 className="font-semibold mb-4">Case Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Patient:</strong> {form.getValues("patientName") || "Unnamed"}
                      </div>
                      <div>
                        <strong>Species:</strong> {form.getValues("species")}
                      </div>
                      <div>
                        <strong>Breed:</strong> {form.getValues("breed")}
                      </div>
                      <div>
                        <strong>Age:</strong> {form.getValues("ageYears")}y {form.getValues("ageMonths")}m
                      </div>
                      <div>
                        <strong>Diagnosis Date:</strong> {form.getValues("diagnosisDate")}
                      </div>
                      <div>
                        <strong>Tumour Type:</strong> {form.getValues("tumourTypeCustom") || "Selected from list"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    Please review all information before submitting. You can edit the case after creation if needed.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation & Actions */}
          <div className="flex justify-between items-center pt-6">
            <div className="flex items-center space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/cases")}
                data-testid="button-cancel-case"
              >
                Cancel
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                onClick={clearDraft}
                data-testid="button-clear-draft"
              >
                Clear Draft
              </Button>
            </div>

            <div className="flex items-center space-x-4">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  data-testid="button-previous-step"
                >
                  Previous
                </Button>
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  data-testid="button-next-step"
                >
                  Next: {steps[currentStep].title}
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createCaseMutation.isPending}
                  data-testid="button-submit-case"
                >
                  {createCaseMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Creating Case...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2"></i>
                      Create Case
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Auto-save indicator */}
          <div className="mt-4 text-center">
            <span className="text-xs text-muted-foreground">
              <i className="fas fa-save mr-1"></i>
              Draft auto-saved
            </span>
          </div>
        </form>
      </Form>
    </div>
  );
}

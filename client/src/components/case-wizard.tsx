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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TumourType, AnatomicalSite } from "@shared/schema";

const caseSchema = z.object({
  patientName: z.string().optional(),
  species: z.string().min(1, "Species is required"),
  breed: z.string().min(1, "Breed is required"),
  sex: z.enum(["MALE_NEUTERED", "MALE_INTACT", "FEMALE_SPAYED", "FEMALE_INTACT"]).optional(),
  ageYears: z.number().min(0).max(30).optional(),
  ageMonths: z.number().min(0).max(11).optional(),
  diagnosisDate: z.string().min(1, "Diagnosis date is required"),
  tumourTypeId: z.string().transform(val => val === "" || val === undefined ? undefined : val).optional(),
  tumourTypeCustom: z.string().optional(),
  anatomicalSiteId: z.string().transform(val => val === "" || val === undefined ? undefined : val).optional(),
  anatomicalSiteCustom: z.string().optional(),
  laterality: z.string().optional(),
  stage: z.string().optional(),
  diagnosisMethod: z.string().optional(),
  treatmentPlan: z.string().optional(),
  treatmentStart: z.string().transform(val => val === "" || val === undefined ? undefined : val).optional(),
  notes: z.string().optional(),
});

type CaseFormData = z.infer<typeof caseSchema>;

const steps = [
  { id: 1, title: "Patient & Signalment", description: "Basic patient information" },
  { id: 2, title: "Tumour Details", description: "Tumour type and location" },
  { id: 3, title: "Diagnosis & Treatment", description: "Diagnostic and treatment details" },
  { id: 4, title: "Review", description: "Review and submit" },
];

const speciesBreeds: Record<string, string[]> = {
  "Dog": [
    "Mongrel (Mixed)", "Boerboel", "Rottweiler", "German Shepherd", "Lhasa Apso", 
    "Caucasian Shepherd", "Pit Bull Terrier", "Labrador Retriever", "Golden Retriever", 
    "Poodle", "Chihuahua", "Dobermann", "English Bulldog", "Cane Corso", 
    "American Eskimo", "Great Dane", "Maltese", "Shih Tzu", "Other (specify)"
  ],
  "Cat": [
    "Domestic Shorthair", "Domestic Longhair", "Persian", "Siamese", 
    "British Shorthair", "American Shorthair", "Maine Coon", "Bengal", 
    "Sphynx", "Russian Blue", "Other (specify)"
  ],
};

export default function CaseWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CaseFormData>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      patientName: "",
      species: "",
      breed: "",
      diagnosisDate: new Date().toISOString().split('T')[0],
      tumourTypeId: undefined,
      tumourTypeCustom: "",
      anatomicalSiteId: undefined, 
      anatomicalSiteCustom: "",
      laterality: "",
      stage: "",
      diagnosisMethod: "",
      treatmentPlan: "",
      treatmentStart: undefined,
      notes: "",
    },
  });

  const watchedSpecies = form.watch("species");

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

  const { data: tumourTypes } = useQuery<TumourType[]>({
    queryKey: ["/api/vocabulary/tumour-types", { species: watchedSpecies }],
    enabled: !!watchedSpecies,
  });

  const { data: anatomicalSites } = useQuery<AnatomicalSite[]>({
    queryKey: ["/api/vocabulary/anatomical-sites", { species: watchedSpecies }],
    enabled: !!watchedSpecies,
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: CaseFormData) => {
      // Transform data to properly handle custom vs selected values
      const transformedData = {
        ...data,
        // If tumourTypeId is "custom", clear it and use tumourTypeCustom instead
        tumourTypeId: data.tumourTypeId === "custom" ? undefined : data.tumourTypeId,
        tumourTypeCustom: data.tumourTypeId === "custom" ? data.tumourTypeCustom : undefined,
        // If anatomicalSiteId is "custom", clear it and use anatomicalSiteCustom instead  
        anatomicalSiteId: data.anatomicalSiteId === "custom" ? undefined : data.anatomicalSiteId,
        anatomicalSiteCustom: data.anatomicalSiteId === "custom" ? data.anatomicalSiteCustom : undefined,
      };

      const response = await apiRequest("POST", "/api/cases", transformedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      localStorage.removeItem("caseWizardDraft");
      toast({
        title: "Case created successfully",
        description: "The new case has been added to your records.",
      });
      setLocation("/cases");
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
        return ["species", "breed", "diagnosisDate"];
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
                              {Object.keys(speciesBreeds).map((species) => (
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
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!watchedSpecies}>
                            <FormControl>
                              <SelectTrigger data-testid="select-breed">
                                <SelectValue placeholder={watchedSpecies ? "Select Breed" : "Select species first"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {watchedSpecies && speciesBreeds[watchedSpecies]?.map((breed) => (
                                <SelectItem key={breed} value={breed}>
                                  {breed}
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tumour-type">
                                <SelectValue placeholder="Select or add custom" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tumourTypes?.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="custom">Add custom type</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("tumourTypeId") === "custom" && (
                      <FormField
                        control={form.control}
                        name="tumourTypeCustom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Tumour Type</FormLabel>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-anatomical-site">
                                <SelectValue placeholder="Select or add custom" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {anatomicalSites?.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="custom">Add custom site</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("anatomicalSiteId") === "custom" && (
                      <FormField
                        control={form.control}
                        name="anatomicalSiteCustom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Anatomical Site</FormLabel>
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

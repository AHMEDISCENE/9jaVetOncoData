import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

const clinicSetupSchema = z.object({
  clinicMode: z.enum(["create", "join"]).default("create"),
  clinicId: z.string().optional(),
  clinicName: z.string().optional(),
  clinicState: z.string().optional(),
  clinicCity: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "CLINICIAN", "RESEARCHER", "STUDENT"]).default("CLINICIAN"),
}).refine((data) => {
  if (data.clinicMode === "create") {
    return data.clinicName && data.clinicState && data.clinicCity;
  }
  if (data.clinicMode === "join") {
    return data.clinicId;
  }
  return true;
}, {
  message: "Please complete all clinic information",
  path: ["clinicName"],
});

const nigerianStates = [
  "ABIA", "ADAMAWA", "AKWA_IBOM", "ANAMBRA", "BAUCHI", "BAYELSA", "BENUE", "BORNO",
  "CROSS_RIVER", "DELTA", "EBONYI", "EDO", "EKITI", "ENUGU", "FCT", "GOMBE",
  "IMO", "JIGAWA", "KADUNA", "KANO", "KATSINA", "KEBBI", "KOGI", "KWARA",
  "LAGOS", "NASARAWA", "NIGER", "OGUN", "ONDO", "OSUN", "OYO", "PLATEAU",
  "RIVERS", "SOKOTO", "TARABA", "YOBE", "ZAMFARA"
];

export default function SetupClinic() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof clinicSetupSchema>>({
    resolver: zodResolver(clinicSetupSchema),
    defaultValues: {
      clinicMode: "create",
      clinicId: "",
      clinicName: "",
      clinicState: "",
      clinicCity: "",
      role: "CLINICIAN",
    },
  });

  // Fetch available clinics
  const { data: availableClinics = [] } = useQuery<Array<{ id: string; name: string; state: string; city: string }>>({
    queryKey: ["/api/clinics/available"],
  });

  // Watch clinic mode and selected clinic
  const clinicMode = form.watch("clinicMode");
  const selectedClinicId = form.watch("clinicId");

  // Auto-fill state and city when a clinic is selected
  useEffect(() => {
    if (clinicMode === "join" && selectedClinicId) {
      const selectedClinic = availableClinics.find(c => c.id === selectedClinicId);
      if (selectedClinic) {
        form.setValue("clinicState", selectedClinic.state);
        form.setValue("clinicCity", selectedClinic.city);
      }
    }
  }, [selectedClinicId, availableClinics, clinicMode, form]);

  const onSubmit = async (values: z.infer<typeof clinicSetupSchema>) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      if (values.clinicMode === "create") {
        // Create new clinic
        const response = await apiRequest("POST", "/api/auth/setup-clinic", {
          clinicName: values.clinicName,
          clinicState: values.clinicState,
          clinicCity: values.clinicCity,
          role: values.role,
        });
        
        if (response.ok) {
          toast({
            title: "Clinic setup complete!",
            description: "Welcome to 9ja VetOncoData. Your clinic has been created.",
          });
          window.location.href = "/dashboard";
        } else {
          throw new Error("Failed to setup clinic");
        }
      } else {
        // Join existing clinic
        const response = await apiRequest("POST", "/api/auth/join-clinic", {
          clinicId: values.clinicId,
          role: values.role,
        });
        
        if (response.ok) {
          toast({
            title: "Clinic setup complete!",
            description: "Welcome to 9ja VetOncoData. You have joined the clinic successfully.",
          });
          window.location.href = "/dashboard";
        } else {
          throw new Error("Failed to join clinic");
        }
      }
    } catch (error) {
      toast({
        title: "Setup failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <i className="fas fa-hospital text-primary-foreground text-2xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Complete Your Setup</h1>
          <p className="text-muted-foreground mt-2">
            Welcome {user.name}! Let's set up your veterinary clinic.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Clinic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="clinicMode"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Clinic Option</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="create" id="create-clinic" data-testid="radio-create-clinic" />
                            <Label htmlFor="create-clinic" className="font-normal cursor-pointer">
                              Create New Clinic
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="join" id="join-clinic" data-testid="radio-join-clinic" />
                            <Label htmlFor="join-clinic" className="font-normal cursor-pointer">
                              Join Existing Clinic
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {clinicMode === "join" && (
                  <FormField
                    control={form.control}
                    name="clinicId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Clinic *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-clinic">
                              <SelectValue placeholder="Choose a clinic" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableClinics.map((clinic) => (
                              <SelectItem key={clinic.id} value={clinic.id}>
                                {clinic.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {clinicMode === "create" && (
                  <FormField
                    control={form.control}
                    name="clinicName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinic Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your clinic name"
                            data-testid="input-clinic-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="clinicState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={clinicMode === "join"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-clinic-state">
                            <SelectValue placeholder="Select your state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {nigerianStates.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state.replace(/_/g, " ")}
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
                  name="clinicCity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your city"
                          data-testid="input-clinic-city"
                          disabled={clinicMode === "join"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Role *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-role">
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ADMIN">Administrator</SelectItem>
                          <SelectItem value="MANAGER">Manager</SelectItem>
                          <SelectItem value="CLINICIAN">Clinician</SelectItem>
                          <SelectItem value="RESEARCHER">Researcher</SelectItem>
                          <SelectItem value="STUDENT">Student</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                  data-testid="button-setup-clinic"
                >
                  {isSubmitting ? "Setting up..." : clinicMode === "create" ? "Create Clinic" : "Join Clinic"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            By {clinicMode === "create" ? "creating" : "joining"} a clinic, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}

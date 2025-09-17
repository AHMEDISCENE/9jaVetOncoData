import { useState } from "react";
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
import { apiRequest } from "@/lib/queryClient";

const clinicSetupSchema = z.object({
  clinicName: z.string().min(1, "Clinic name is required"),
  clinicState: z.string().min(1, "State is required"),
  clinicCity: z.string().min(1, "City is required"),
  role: z.enum(["ADMIN", "MANAGER", "CLINICIAN", "RESEARCHER"]).default("CLINICIAN"),
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
      clinicName: "",
      clinicState: "",
      clinicCity: "",
      role: "CLINICIAN",
    },
  });

  const onSubmit = async (values: z.infer<typeof clinicSetupSchema>) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/setup-clinic", values);
      
      if (response.ok) {
        toast({
          title: "Clinic setup complete!",
          description: "Welcome to 9ja VetOncoData. Your clinic has been created.",
        });
        // Force a page reload to refresh auth context
        window.location.href = "/dashboard";
      } else {
        throw new Error("Failed to setup clinic");
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

                <FormField
                  control={form.control}
                  name="clinicState"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  {isSubmitting ? "Creating Clinic..." : "Complete Setup"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            By creating a clinic, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
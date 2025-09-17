import { useState } from "react";
import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/contexts/theme-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { User, Cog, Moon, Sun, Monitor } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
});

const clinicSchema = z.object({
  name: z.string().min(2, "Clinic name must be at least 2 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type ClinicFormData = z.infer<typeof clinicSchema>;

export default function Settings() {
  const { user, clinic } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  // Clinic form
  const clinicForm = useForm<ClinicFormData>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: "",
      city: "",
    },
  });

  // Update form values when user/clinic data loads
  React.useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user, profileForm]);

  React.useEffect(() => {
    if (clinic) {
      clinicForm.reset({
        name: clinic.name || "",
        city: clinic.city || "",
      });
    }
  }, [clinic, clinicForm]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("PATCH", "/api/users/profile", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ description: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive", 
        description: error.message || "Failed to update profile" 
      });
    },
  });

  // Update clinic mutation
  const updateClinicMutation = useMutation({
    mutationFn: async (data: ClinicFormData) => {
      const response = await apiRequest("PATCH", "/api/clinics/update", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ description: "Clinic information updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive", 
        description: error.message || "Failed to update clinic information" 
      });
    },
  });

  // Theme preference mutation
  const updateThemeMutation = useMutation({
    mutationFn: async (theme: string) => {
      const response = await apiRequest("PATCH", "/api/users/preferences", { theme });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const handleProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handleClinicSubmit = (data: ClinicFormData) => {
    updateClinicMutation.mutate(data);
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    // Update server preferences
    updateThemeMutation.mutate(newTheme);
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2" data-testid="heading-settings">
          <Cog className="h-8 w-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your account, appearance, and clinic information
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-settings">
          <TabsTrigger value="account" data-testid="tab-account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
          <TabsTrigger value="appearance" data-testid="tab-appearance">
            <Moon className="h-4 w-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="clinic" data-testid="tab-clinic">
            <Cog className="h-4 w-4 mr-2" />
            Clinic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card data-testid="card-account">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Update your personal information and account settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" data-testid="input-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your email address" 
                            data-testid="input-email"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Your email is used for login and notifications
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium">Account Status</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" data-testid="badge-active">
                          Active
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Role: {user?.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card data-testid="card-appearance">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how 9ja VetOncoData looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-4">Theme</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => handleThemeChange("light")}
                      data-testid="button-theme-light"
                    >
                      <Sun className="h-6 w-6" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => handleThemeChange("dark")}
                      data-testid="button-theme-dark"
                    >
                      <Moon className="h-6 w-6" />
                      Dark
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => handleThemeChange("system")}
                      data-testid="button-theme-system"
                    >
                      <Monitor className="h-6 w-6" />
                      System
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-medium">Email Notifications</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive email notifications for important updates
                      </p>
                    </div>
                    <Switch data-testid="switch-notifications" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-medium">Browser Notifications</h4>
                      <p className="text-sm text-muted-foreground">
                        Show desktop notifications for new cases and updates
                      </p>
                    </div>
                    <Switch data-testid="switch-browser-notifications" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clinic">
          <Card data-testid="card-clinic">
            <CardHeader>
              <CardTitle>Clinic Information</CardTitle>
              <CardDescription>
                Manage your clinic's details and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...clinicForm}>
                <form onSubmit={clinicForm.handleSubmit(handleClinicSubmit)} className="space-y-6">
                  <FormField
                    control={clinicForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinic Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter clinic name" data-testid="input-clinic-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clinicForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter city" data-testid="input-clinic-city" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium">Clinic Details</h4>
                      <div className="mt-1 space-y-2">
                        <p className="text-sm text-muted-foreground">
                          <strong>State:</strong> {clinic?.state || "Not specified"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Created:</strong> {clinic?.createdAt ? new Date(clinic.createdAt).toLocaleDateString() : "Unknown"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Button 
                    type="submit" 
                    disabled={updateClinicMutation.isPending}
                    data-testid="button-save-clinic"
                  >
                    {updateClinicMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
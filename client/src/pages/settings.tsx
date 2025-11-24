import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
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
import { User, Cog, Moon, Sun, Monitor, Upload, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  title: z.string().optional(), // Dr., Prof., Mr., Ms., etc.
  displayName: z.string().optional(),
  jobTitle: z.string().optional(),
  specialty: z.string().optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
});

const clinicSchema = z.object({
  name: z.string().min(2, "Clinic name must be at least 2 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type ClinicFormData = z.infer<typeof clinicSchema>;

const titles = ["Dr.", "Prof.", "Mr.", "Ms.", "Mrs.", "Eng.", "Pharm."];

export default function Settings() {
  const { user, clinic } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  // Parse name into first and last
  const [firstName, lastName] = user?.name?.split(" ") || ["", ""];

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: (user as any)?.firstName || firstName || "",
      lastName: (user as any)?.lastName || lastName || "",
      email: user?.email || "",
      title: (user as any)?.title || "",
      displayName: (user as any)?.displayName || "",
      jobTitle: (user as any)?.jobTitle || "",
      specialty: (user as any)?.specialty || "",
      bio: (user as any)?.bio || "",
    },
  });

  // Clinic form
  const clinicForm = useForm<ClinicFormData>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: clinic?.name || "",
      city: clinic?.city || "",
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => apiRequest("PATCH", "/api/users/profile", data),
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

  // Upload avatar mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const response = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ description: "Avatar uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive", 
        description: error.message || "Failed to upload avatar" 
      });
    },
  });

  // Update clinic mutation
  const updateClinicMutation = useMutation({
    mutationFn: (data: ClinicFormData) => apiRequest("PATCH", "/api/clinics/update", data),
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
    mutationFn: (theme: string) => fetch("/api/users/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ theme }),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const handleProfileSubmit = (data: ProfileFormData) => {
    // Combine first and last name into full name for display
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    updateProfileMutation.mutate({
      ...data,
      name: fullName,
    } as any);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ 
        variant: "destructive", 
        description: "Please select an image file" 
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        variant: "destructive", 
        description: "Image must be less than 5MB" 
      });
      return;
    }

    // Upload
    uploadAvatarMutation.mutate(file);
  };

  const handleClinicSubmit = (data: ClinicFormData) => {
    updateClinicMutation.mutate(data);
  };

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    } else {
      // System theme
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemTheme) {
        document.documentElement.classList.add("dark");
        setIsDarkMode(true);
      } else {
        document.documentElement.classList.remove("dark");
        setIsDarkMode(false);
      }
    }
    
    // Save to local storage
    localStorage.setItem("theme", theme);
    
    // Update server preferences
    updateThemeMutation.mutate(theme);
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
                  {/* Avatar Section */}
                  <div className="space-y-4 border-b pb-4">
                    <h3 className="text-base font-semibold">Profile Picture</h3>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20" data-testid="avatar-preview">
                        <AvatarImage src={user?.image || undefined} alt="Profile" />
                        <AvatarFallback>
                          {user?.name?.split(" ").map(n => n[0]).join("") || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarSelect}
                          className="hidden"
                          data-testid="input-avatar-file"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadAvatarMutation.isPending}
                          data-testid="button-upload-avatar"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadAvatarMutation.isPending ? "Uploading..." : "Upload Photo"}
                        </Button>
                        {user?.image && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (fileInputRef.current) {
                                fileInputRef.current.value = "";
                              }
                            }}
                            data-testid="button-remove-avatar"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                    <FormDescription>
                      Upload a JPG, PNG, or GIF image (max 5MB)
                    </FormDescription>
                  </div>

                  {/* Name Section */}
                  <div className="space-y-4 border-b pb-4">
                    <h3 className="text-base font-semibold">Full Name</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="First name" data-testid="input-firstName" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Last name" data-testid="input-lastName" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Professional Information */}
                  <div className="space-y-4 border-b pb-4">
                    <h3 className="text-base font-semibold">Professional Information</h3>
                    
                    <FormField
                      control={profileForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g. Dr., Prof., Mr., Ms." 
                              data-testid="input-title"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Professional title (Dr., Prof., Mr., Ms., etc.)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g. Veterinarian, Veterinary Technician" 
                              data-testid="input-jobTitle"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Your position in the clinic
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="specialty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialty</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="e.g. Oncology, Internal Medicine" 
                              data-testid="input-specialty"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Your area of specialization
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Display & Communication */}
                  <div className="space-y-4 border-b pb-4">
                    <h3 className="text-base font-semibold">Display & Communication</h3>
                    
                    <FormField
                      control={profileForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="How your name appears on cases and comments" 
                              data-testid="input-displayName"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            This name will appear on cases, comments, and feed posts
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <textarea 
                              placeholder="Tell us about yourself..." 
                              data-testid="input-bio"
                              className="min-h-24 w-full px-3 py-2 border border-input rounded-md text-sm shadow-sm placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            A brief biography (up to 500 characters)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email Section */}
                  <div className="space-y-4 border-b pb-4">
                    <h3 className="text-base font-semibold">Contact Information</h3>
                    
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
                  </div>

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
                      variant={!isDarkMode ? "default" : "outline"}
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => handleThemeChange("light")}
                      data-testid="button-theme-light"
                    >
                      <Sun className="h-6 w-6" />
                      Light
                    </Button>
                    <Button
                      variant={isDarkMode ? "default" : "outline"}
                      className="h-20 flex flex-col items-center justify-center gap-2"
                      onClick={() => handleThemeChange("dark")}
                      data-testid="button-theme-dark"
                    >
                      <Moon className="h-6 w-6" />
                      Dark
                    </Button>
                    <Button
                      variant="outline"
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
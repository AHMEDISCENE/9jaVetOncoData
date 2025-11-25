import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ArrowLeft, Edit, Mail, Briefcase, Stethoscope, FileText, Phone, Linkedin, BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Profile() {
  const { user, clinic, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Unable to load profile information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const firstName = (user as any)?.firstName || user?.name?.split(" ")[0] || "";
  const lastName = (user as any)?.lastName || user?.name?.split(" ").slice(1).join(" ") || "";
  const title = (user as any)?.title || "";
  const jobTitle = (user as any)?.jobTitle || "";
  const specialty = (user as any)?.specialty || "";
  const bio = (user as any)?.bio || "";
  const phone = (user as any)?.phone || "";
  const linkedIn = (user as any)?.linkedIn || "";
  const googleScholar = (user as any)?.googleScholar || "";
  const userImage = (user as any)?.image;
  const displayName = user?.name || "";  // Use full name for display

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
    ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
    MANAGER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    CLINICIAN: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    RESEARCHER: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
    STUDENT: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="outline" size="icon" data-testid="button-back-to-settings">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profile</h1>
            <p className="text-sm text-muted-foreground">Your professional information</p>
          </div>
        </div>
        <Link href="/settings">
          <Button className="gap-2" data-testid="button-edit-profile">
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
        </Link>
      </div>

      {/* Main Profile Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar and Basic Info */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6 text-center">
            <Avatar className="h-32 w-32 mx-auto mb-4 ring-4 ring-primary/20">
              {userImage ? (
                <AvatarImage 
                  src={`${window.location.origin}${userImage}?t=${Date.now()}`}
                  alt={displayName}
                />
              ) : null}
              <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                {user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>

            <h2 className="text-xl font-bold text-foreground mb-1" data-testid="text-profile-name">
              {displayName}
            </h2>

            {title && (
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-profile-title">
                {title}
              </p>
            )}

            <Badge className={`${roleColors[user?.role || "STUDENT"]} font-semibold mb-4`} data-testid="badge-profile-role">
              {user?.role || "UNKNOWN"}
            </Badge>

            {clinic && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">CLINIC</p>
                <p className="font-semibold text-foreground" data-testid="text-profile-clinic">
                  {clinic.name}
                </p>
                {clinic.city && (
                  <p className="text-sm text-muted-foreground" data-testid="text-profile-clinic-city">
                    {clinic.city}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Information */}
        <div className="lg:col-span-2 space-y-4">
          {/* Name Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">First Name</p>
                  <p className="font-medium text-foreground" data-testid="text-profile-first-name">
                    {firstName || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Last Name</p>
                  <p className="font-medium text-foreground" data-testid="text-profile-last-name">
                    {lastName || "—"}
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">Email</p>
                </div>
                <p className="font-medium text-foreground" data-testid="text-profile-email">
                  {user?.email || "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
          {(jobTitle || specialty) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Professional Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {jobTitle && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Job Title</p>
                    <p className="font-medium text-foreground" data-testid="text-profile-job-title">
                      {jobTitle}
                    </p>
                  </div>
                )}
                {specialty && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Stethoscope className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground">Specialty</p>
                    </div>
                    <p className="font-medium text-foreground" data-testid="text-profile-specialty">
                      {specialty}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bio Section */}
          {bio && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Bio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap" data-testid="text-profile-bio">
                  {bio}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Contact Details */}
          {(phone || linkedIn || googleScholar) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {phone && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Phone Number</p>
                    <p className="font-medium text-foreground" data-testid="text-profile-phone">
                      {phone}
                    </p>
                  </div>
                )}
                {linkedIn && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Linkedin className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground">LinkedIn</p>
                    </div>
                    <a 
                      href={linkedIn} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline" 
                      data-testid="link-profile-linkedin"
                    >
                      View Profile
                    </a>
                  </div>
                )}
                {googleScholar && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground">Google Scholar</p>
                    </div>
                    <a 
                      href={googleScholar} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline" 
                      data-testid="link-profile-scholar"
                    >
                      View Profile
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Role</p>
                <div className="flex items-center gap-2">
                  <Badge className={roleColors[user?.role || "STUDENT"]} data-testid="badge-profile-role-account">
                    {user?.role || "UNKNOWN"}
                  </Badge>
                </div>
              </div>
              {clinic && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Clinic Association</p>
                  <p className="font-medium text-foreground" data-testid="text-profile-clinic-assoc">
                    {clinic.name}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

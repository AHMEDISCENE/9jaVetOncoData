import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FollowUp } from "@shared/schema";

const priorityColors = {
  high: "bg-red-100 text-red-800",
  medium: "bg-yellow-100 text-yellow-800", 
  low: "bg-green-100 text-green-800",
};

export default function Calendar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDays, setSelectedDays] = useState(7);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: upcomingFollowUps, isLoading, error } = useQuery<FollowUp[]>({
    queryKey: ["/api/calendar/upcoming", { days: selectedDays }],
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (followUpId: string) => {
      const response = await apiRequest("PUT", `/api/follow-ups/${followUpId}`, {
        isCompleted: true,
        completedAt: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/upcoming"] });
      toast({
        title: "Follow-up completed",
        description: "The follow-up has been marked as completed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update follow-up",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const getDaysUntil = (date: string | Date) => {
    const targetDate = new Date(date);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPriority = (daysUntil: number) => {
    if (daysUntil <= 1) return "high";
    if (daysUntil <= 3) return "medium";
    return "low";
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32 mt-4 sm:mt-0" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-12 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {[...Array(5)].map((_, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-4 w-16" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(5)].map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <i className="fas fa-exclamation-triangle text-destructive text-4xl mb-4"></i>
            <h3 className="text-lg font-semibold mb-2">Unable to load calendar</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Please check your connection and try again."}
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-retry-calendar">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const todayFollowUps = upcomingFollowUps?.filter(f => getDaysUntil(f.scheduledFor) === 0) || [];
  const tomorrowFollowUps = upcomingFollowUps?.filter(f => getDaysUntil(f.scheduledFor) === 1) || [];
  const overdue = upcomingFollowUps?.filter(f => getDaysUntil(f.scheduledFor) < 0) || [];

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Calendar & Follow-ups</h2>
          <p className="text-muted-foreground">Manage scheduled follow-ups and reminders</p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="days-select" className="text-sm">Show next:</Label>
            <select
              id="days-select"
              value={selectedDays}
              onChange={(e) => setSelectedDays(Number(e.target.value))}
              className="px-3 py-1 border border-input rounded-md text-sm bg-background"
              data-testid="select-days-filter"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-followup">
                <i className="fas fa-plus mr-2"></i>Add Follow-up
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Follow-up</DialogTitle>
              </DialogHeader>
              <div className="text-center py-8 text-muted-foreground">
                <i className="fas fa-tools text-4xl mb-4"></i>
                <p>Follow-up scheduling coming soon</p>
                <p className="text-sm">This feature will be available in the next update</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-red-600 mb-2" data-testid="stat-overdue">
              {overdue.length}
            </div>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2" data-testid="stat-today">
              {todayFollowUps.length}
            </div>
            <p className="text-sm text-muted-foreground">Due Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2" data-testid="stat-tomorrow">
              {tomorrowFollowUps.length}
            </div>
            <p className="text-sm text-muted-foreground">Due Tomorrow</p>
          </CardContent>
        </Card>
      </div>

      {/* Follow-ups Table */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingFollowUps && upcomingFollowUps.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingFollowUps.map((followUp) => {
                  const daysUntil = getDaysUntil(followUp.scheduledFor);
                  const priority = getPriority(daysUntil);
                  
                  return (
                    <TableRow key={followUp.id} className={daysUntil < 0 ? "bg-red-50" : ""}>
                      <TableCell>
                        <div className="font-medium" data-testid={`patient-name-${followUp.id}`}>
                          Patient Name
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Case #{followUp.caseId?.slice(-8)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{followUp.title}</div>
                        {followUp.description && (
                          <div className="text-sm text-muted-foreground">
                            {followUp.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{formatDate(followUp.scheduledFor)}</div>
                        <div className="text-sm text-muted-foreground">
                          {daysUntil < 0 
                            ? `${Math.abs(daysUntil)} days overdue`
                            : daysUntil === 0 
                            ? "Today"
                            : daysUntil === 1
                            ? "Tomorrow"
                            : `In ${daysUntil} days`
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityColors[priority]}>
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markCompleteMutation.mutate(followUp.id)}
                            disabled={markCompleteMutation.isPending || followUp.isCompleted}
                            data-testid={`button-complete-${followUp.id}`}
                          >
                            {followUp.isCompleted ? (
                              <>
                                <i className="fas fa-check mr-1 text-green-600"></i>
                                Completed
                              </>
                            ) : (
                              <>
                                <i className="fas fa-check mr-1"></i>
                                Complete
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost" 
                            size="sm"
                            data-testid={`button-edit-${followUp.id}`}
                          >
                            <i className="fas fa-edit mr-1"></i>Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <i className="fas fa-calendar-alt text-4xl mb-4"></i>
              <h3 className="text-lg font-medium mb-2">No upcoming follow-ups</h3>
              <p className="text-sm mb-4">
                Schedule follow-ups for your cases to track patient progress and treatment outcomes.
              </p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                data-testid="button-schedule-first-followup"
              >
                <i className="fas fa-plus mr-2"></i>Schedule First Follow-up
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

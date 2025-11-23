import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  lastRun?: string;
  status: string;
}

const scheduleSchema = z.object({
  frequency: z.enum(["weekly", "monthly", "quarterly"]),
  format: z.enum(["pdf", "xlsx", "csv"]),
  email: z.string().email("Please enter a valid email"),
});

const mockTemplates: ReportTemplate[] = [
  {
    id: "1",
    name: "Monthly Oncology Summary",
    description: "Comprehensive monthly report of all oncology cases, outcomes, and trends",
    lastRun: "2024-01-15",
    status: "available"
  },
  {
    id: "2", 
    name: "Tumour Incidence Analysis",
    description: "Detailed analysis of tumour types by species, breed, and anatomical site",
    lastRun: "2024-01-10",
    status: "available"
  },
  {
    id: "3",
    name: "Treatment Outcomes Report",
    description: "Success rates and outcome analysis by treatment modality",
    status: "available"
  },
  {
    id: "4",
    name: "Clinic Performance Dashboard",
    description: "Comparative analysis of clinic performance metrics",
    status: "available"
  }
];

const mockReportHistory = [
  {
    id: "1",
    template: "Monthly Oncology Summary",
    generatedAt: "2024-01-15T10:30:00Z",
    format: "PDF",
    status: "completed",
    downloadUrl: "#"
  },
  {
    id: "2",
    template: "Tumour Incidence Analysis", 
    generatedAt: "2024-01-10T14:20:00Z",
    format: "XLSX",
    status: "completed",
    downloadUrl: "#"
  },
  {
    id: "3",
    template: "Monthly Oncology Summary",
    generatedAt: "2024-01-01T09:00:00Z",
    format: "PDF", 
    status: "failed",
    error: "Insufficient data for the selected period"
  }
];

export default function Reports() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [runningReportId, setRunningReportId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const scheduleForm = useForm({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      frequency: "weekly",
      format: "pdf",
      email: "",
    },
  });

  // Mock query - would fetch real data in production
  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/reports/templates"],
    queryFn: () => Promise.resolve(mockTemplates),
  });

  const { data: reportHistory } = useQuery({
    queryKey: ["/api/reports/history"],
    queryFn: () => Promise.resolve(mockReportHistory),
  });

  const runReportMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      const filename = `report_${Date.now()}.txt`;
      return {
        success: true,
        filename,
        templateId,
      };
    },
    onSuccess: (data) => {
      // Generate and trigger download
      generateAndDownloadReport(data.templateId, data.filename);
      
      toast({
        title: "Report Generated & Downloaded",
        description: `Report ${data.filename} is ready`,
      });
      setRunningReportId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/reports/history"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate the report. Please try again.",
        variant: "destructive",
      });
      setRunningReportId(null);
    },
  });

  const scheduleReportMutation = useMutation({
    mutationFn: async (data: z.infer<typeof scheduleSchema>) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Report Scheduled",
        description: "Your report has been scheduled for automated delivery",
      });
      setScheduleDialogOpen(false);
      scheduleForm.reset();
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to schedule the report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRunReport = (templateId: string) => {
    setRunningReportId(templateId);
    runReportMutation.mutate(templateId);
  };

  const handleScheduleClick = (templateId: string) => {
    setSelectedTemplate(templateId);
    setScheduleDialogOpen(true);
  };

  const handleDownloadReport = (filename: string) => {
    // Generate mock report and download
    const reportContent = `
      9ja VetOncoData - Report
      Generated: ${new Date().toLocaleString()}
      
      This is a veterinary oncology report.
      
      Summary Statistics:
      - Total Cases: 17
      - New Cases This Month: 3
      - Active Clinics: 3
      - Remission Rate: 17%
      
      Report File: ${filename}
    `;

    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: `${filename} is downloading`,
    });
  };

  const onScheduleSubmit = (data: z.infer<typeof scheduleSchema>) => {
    scheduleReportMutation.mutate(data);
  };

  const generateAndDownloadReport = (templateId: string, filename: string) => {
    // Generate mock report content
    const reportContent = `
      9ja VetOncoData - Report
      Generated: ${new Date().toLocaleString()}
      
      Report ID: ${templateId}
      
      This is a sample veterinary oncology report.
      
      Summary Statistics:
      - Total Cases: 17
      - New Cases This Month: 3
      - Active Clinics: 3
      - Remission Rate: 17%
      
      Cases by Month:
      - January 2025: 4 cases
      - September 2024: 3 cases
      - October 2025: 8 cases
      - November 2025: 2 cases
      
      Top Tumour Types:
      - Unknown: 9 cases
      - Melanoma: 3 cases
      - Lymphoma: 2 cases
      - GI Lymphoma: 2 cases
      - WWW: 1 case
    `;

    // Create blob and trigger download
    const blob = new Blob([reportContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Reports & Analytics</h2>
        <p className="text-muted-foreground">Generate comprehensive reports and schedule automated deliveries</p>
      </div>

      {/* Report Templates */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Available Report Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates?.map((template) => (
            <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{template.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {template.lastRun && (
                    <p className="text-xs text-muted-foreground">
                      Last run: {new Date(template.lastRun).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      data-testid={`button-run-report-${template.id}`}
                      onClick={() => handleRunReport(template.id)}
                      disabled={runningReportId === template.id}
                    >
                      <i className="fas fa-play mr-2"></i>
                      {runningReportId === template.id ? "Generating..." : "Run Report"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      data-testid={`button-schedule-report-${template.id}`}
                      onClick={() => handleScheduleClick(template.id)}
                    >
                      <i className="fas fa-clock mr-2"></i>Schedule
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
        </CardHeader>
        <CardContent>
          {reportHistory && reportHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Template</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportHistory.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.template}</TableCell>
                    <TableCell>
                      {new Date(report.generatedAt).toLocaleDateString()} at{" "}
                      {new Date(report.generatedAt).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.format}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={
                          report.status === "completed" 
                            ? "bg-green-100 text-green-800"
                            : report.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }
                      >
                        {report.status}
                      </Badge>
                      {report.error && (
                        <p className="text-xs text-destructive mt-1">{report.error}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {report.status === "completed" && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-download-report-${report.id}`}
                          onClick={() => handleDownloadReport(`${report.template.replace(/\s+/g, "_")}_${report.id}.${report.format.toLowerCase()}`)}
                        >
                          <i className="fas fa-download mr-2"></i>Download
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <i className="fas fa-file-alt text-4xl mb-4"></i>
              <p className="text-lg font-medium mb-2">No reports generated yet</p>
              <p className="text-sm">Start by running one of the available report templates above.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Report Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Report Delivery</DialogTitle>
            <DialogDescription>
              Set up automated report generation and delivery
            </DialogDescription>
          </DialogHeader>
          <Form {...scheduleForm}>
            <form onSubmit={scheduleForm.handleSubmit(onScheduleSubmit)} className="space-y-4">
              <FormField
                control={scheduleForm.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-frequency">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={scheduleForm.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Format</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-format">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="xlsx">Excel</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={scheduleForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        {...field}
                        className="w-full px-3 py-2 border border-input rounded-md text-sm"
                        data-testid="input-email"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setScheduleDialogOpen(false)}
                  data-testid="button-cancel-schedule"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={scheduleReportMutation.isPending}
                  data-testid="button-confirm-schedule"
                >
                  {scheduleReportMutation.isPending ? "Scheduling..." : "Schedule"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

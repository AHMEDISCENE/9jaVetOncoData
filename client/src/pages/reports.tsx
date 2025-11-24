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
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { Checkbox } from "@/components/ui/checkbox";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  lastRun?: string;
  status: string;
}

const customizeReportSchema = z.object({
  duration: z.enum(["week", "month", "quarter", "year", "custom"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dataTypes: z.array(z.string()).min(1, "Select at least one data type"),
  includeSummary: z.boolean().default(true),
  includeCharts: z.boolean().default(true),
  format: z.enum(["pdf", "xlsx", "csv"]).default("pdf"),
});

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
  const [customizeDialogOpen, setCustomizeDialogOpen] = useState(false);
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "xlsx" | "csv">("pdf");
  const [reportTemplateForFormat, setReportTemplateForFormat] = useState<string | null>(null);
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

  const customizeForm = useForm({
    resolver: zodResolver(customizeReportSchema),
    defaultValues: {
      duration: "month",
      dataTypes: ["summary", "cases", "outcomes"],
      includeSummary: true,
      includeCharts: true,
      format: "pdf",
    },
  });

  const dataTypeOptions = [
    { id: "summary", label: "Summary Statistics" },
    { id: "cases", label: "Case Details" },
    { id: "tumours", label: "Tumour Analysis" },
    { id: "outcomes", label: "Treatment Outcomes" },
    { id: "trends", label: "Trends & Comparisons" },
    { id: "demographics", label: "Patient Demographics" },
  ];

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
    mutationFn: async (data: { 
      templateId: string; 
      format: "pdf" | "xlsx" | "csv";
      customization?: {
        duration: string;
        startDate?: string;
        endDate?: string;
        dataTypes: string[];
        includeSummary: boolean;
        includeCharts: boolean;
      };
    }) => {
      // Call backend to generate real report data
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: data.templateId,
          duration: data.customization?.duration || "month",
          startDate: data.customization?.startDate,
          endDate: data.customization?.endDate,
          dataTypes: data.customization?.dataTypes || [],
          format: data.format,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to generate report");
      const reportData = await response.json();
      
      let fileExtension = "txt";
      if (data.format === "pdf") fileExtension = "pdf";
      else if (data.format === "xlsx") fileExtension = "xlsx";
      else if (data.format === "csv") fileExtension = "csv";
      const filename = `report_${Date.now()}.${fileExtension}`;
      
      return {
        success: true,
        filename,
        templateId: data.templateId,
        format: data.format,
        customization: data.customization,
        reportData,
      };
    },
    onSuccess: (data) => {
      // Generate and trigger download with real data
      generateAndDownloadReport(data.templateId, data.filename, data.format, data.reportData);
      
      toast({
        title: "Report Generated & Downloaded",
        description: `Report ${data.filename} is ready`,
      });
      setRunningReportId(null);
      setFormatDialogOpen(false);
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
    setReportTemplateForFormat(templateId);
    setCustomizeDialogOpen(true);
  };

  const handleCustomizeSubmit = (data: any) => {
    if (reportTemplateForFormat) {
      setRunningReportId(reportTemplateForFormat);
      runReportMutation.mutate({
        templateId: reportTemplateForFormat,
        format: data.format as "pdf" | "xlsx" | "csv",
        customization: {
          duration: data.duration as string,
          startDate: data.startDate,
          endDate: data.endDate,
          dataTypes: data.dataTypes,
          includeSummary: data.includeSummary,
          includeCharts: data.includeCharts,
        },
      });
      setCustomizeDialogOpen(false);
    }
  };

  const handleConfirmRunReport = () => {
    if (reportTemplateForFormat) {
      setRunningReportId(reportTemplateForFormat);
      runReportMutation.mutate({
        templateId: reportTemplateForFormat,
        format: selectedFormat,
      });
    }
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

  const onScheduleSubmit = (data: any) => {
    scheduleReportMutation.mutate(data as z.infer<typeof scheduleSchema>);
  };

  const generateAndDownloadReport = (templateId: string, filename: string, format: "pdf" | "xlsx" | "csv" = "pdf", reportData: any = {}) => {
    const data = reportData?.data || {};
    
    if (format === "csv") {
      // CSV format - dynamic based on template
      let content = "Metric,Value\n";
      
      if (templateId === "1") {
        content += `Total Cases,${data.totalCases || 0}\n`;
        content += `Remission Cases,${data.remissionCases || 0}\n`;
        content += `Progression Cases,${data.progressionCases || 0}\n`;
        content += `Remission Rate,${data.remissionRate || 0}%\n`;
        Object.entries(data.casesByMonth || {}).forEach(([month, count]: any) => {
          content += `${month},${count}\n`;
        });
      } else if (templateId === "2") {
        content += `Total Cases,${data.totalCases || 0}\n`;
        Object.entries(data.tumourIncidence || {}).forEach(([type, count]: any) => {
          content += `Tumour Type: ${type},${count}\n`;
        });
        content += "\nSpecies Distribution\n";
        Object.entries(data.speciesDistribution || {}).forEach(([species, count]: any) => {
          content += `${species},${count}\n`;
        });
      } else if (templateId === "3") {
        content += `Total Cases,${data.totalCases || 0}\n`;
        content += `Success Rate,${data.successRate || 0}%\n`;
        content += `Progression Rate,${data.progressionRate || 0}%\n`;
        content += `Deceased Rate,${data.deceasedRate || 0}%\n`;
        Object.entries(data.outcomes || {}).forEach(([outcome, count]: any) => {
          content += `${outcome},${count}\n`;
        });
      } else if (templateId === "4") {
        content += `Total Cases,${data.totalCases || 0}\n`;
        content += `Number of Clinics,${data.clinicsCount || 0}\n`;
      }
      
      content += `Generated,${new Date().toLocaleString()}\n`;
      
      const blob = new Blob([content], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } else if (format === "xlsx") {
      // Excel format using XLSX library
      const workbook = XLSX.utils.book_new();
      const summaryData: any[] = [
        ["9ja VetOncoData Report"],
        ["Generated: " + new Date().toLocaleString()],
        ["Template: " + templateId],
        [],
      ];
      
      if (templateId === "1") {
        summaryData.push(["Monthly Oncology Summary"]);
        summaryData.push(["Metric", "Value"]);
        summaryData.push(["Total Cases", data.totalCases || 0]);
        summaryData.push(["Remission Cases", data.remissionCases || 0]);
        summaryData.push(["Progression Cases", data.progressionCases || 0]);
        summaryData.push(["Remission Rate", `${data.remissionRate || 0}%`]);
        summaryData.push([]);
        summaryData.push(["Cases by Month"]);
        summaryData.push(["Month", "Cases"]);
        Object.entries(data.casesByMonth || {}).forEach(([month, count]: any) => {
          summaryData.push([month, count]);
        });
      } else if (templateId === "2") {
        summaryData.push(["Tumour Incidence Analysis"]);
        summaryData.push(["Total Cases", data.totalCases || 0]);
        summaryData.push([]);
        summaryData.push(["Tumour Type", "Cases"]);
        Object.entries(data.tumourIncidence || {}).forEach(([type, count]: any) => {
          summaryData.push([type, count]);
        });
        summaryData.push([]);
        summaryData.push(["Species", "Cases"]);
        Object.entries(data.speciesDistribution || {}).forEach(([species, count]: any) => {
          summaryData.push([species, count]);
        });
      } else if (templateId === "3") {
        summaryData.push(["Treatment Outcomes Report"]);
        summaryData.push(["Total Cases", data.totalCases || 0]);
        summaryData.push(["Success Rate", `${data.successRate || 0}%`]);
        summaryData.push(["Progression Rate", `${data.progressionRate || 0}%`]);
        summaryData.push(["Deceased Rate", `${data.deceasedRate || 0}%`]);
        summaryData.push([]);
        summaryData.push(["Outcome", "Cases"]);
        Object.entries(data.outcomes || {}).forEach(([outcome, count]: any) => {
          summaryData.push([outcome, count]);
        });
      } else if (templateId === "4") {
        summaryData.push(["Clinic Performance Dashboard"]);
        summaryData.push(["Total Cases", data.totalCases || 0]);
        summaryData.push(["Number of Clinics", data.clinicsCount || 0]);
      }
      
      const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
      XLSX.writeFile(workbook, filename);
      
    } else {
      // PDF format using jsPDF
      const doc = new jsPDF();
      let yPosition = 20;
      
      doc.setFontSize(18);
      doc.text("9ja VetOncoData", 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(14);
      doc.text("Veterinary Oncology Report", 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.text("Generated: " + new Date().toLocaleString(), 20, yPosition);
      yPosition += 6;
      doc.text("Report Type: " + templateId, 20, yPosition);
      yPosition += 10;
      
      if (templateId === "1") {
        doc.setFontSize(12);
        doc.text("MONTHLY ONCOLOGY SUMMARY", 20, yPosition);
        yPosition += 10;
        doc.setFontSize(10);
        doc.text(`Total Cases: ${data.totalCases || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Remission Cases: ${data.remissionCases || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Progression Cases: ${data.progressionCases || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Remission Rate: ${data.remissionRate || 0}%`, 20, yPosition);
      } else if (templateId === "2") {
        doc.setFontSize(12);
        doc.text("TUMOUR INCIDENCE ANALYSIS", 20, yPosition);
        yPosition += 10;
        doc.setFontSize(10);
        doc.text(`Total Cases: ${data.totalCases || 0}`, 20, yPosition);
        yPosition += 8;
        doc.text("Top Tumour Types:", 20, yPosition);
        yPosition += 6;
        Object.entries(data.tumourIncidence || {}).slice(0, 5).forEach(([type, count]: any) => {
          doc.text(`${type}: ${count}`, 25, yPosition);
          yPosition += 6;
        });
      } else if (templateId === "3") {
        doc.setFontSize(12);
        doc.text("TREATMENT OUTCOMES", 20, yPosition);
        yPosition += 10;
        doc.setFontSize(10);
        doc.text(`Total Cases: ${data.totalCases || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Success Rate: ${data.successRate || 0}%`, 20, yPosition);
        yPosition += 6;
        doc.text(`Progression Rate: ${data.progressionRate || 0}%`, 20, yPosition);
        yPosition += 6;
        doc.text(`Deceased Rate: ${data.deceasedRate || 0}%`, 20, yPosition);
      }
      
      doc.save(filename);
    }
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
        <p className="text-lg font-semibold text-foreground">Generate comprehensive reports and schedule automated deliveries</p>
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

      {/* Customize Report Dialog */}
      <Dialog open={customizeDialogOpen} onOpenChange={setCustomizeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customize Report</DialogTitle>
            <DialogDescription>
              Select the data types, duration, and format for your report
            </DialogDescription>
          </DialogHeader>
          <Form {...customizeForm}>
            <form onSubmit={customizeForm.handleSubmit(handleCustomizeSubmit)} className="space-y-6">
              {/* Duration Selection */}
              <FormField
                control={customizeForm.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Period</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-duration">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="week">Last 7 Days</SelectItem>
                        <SelectItem value="month">Last 30 Days</SelectItem>
                        <SelectItem value="quarter">Last 90 Days</SelectItem>
                        <SelectItem value="year">Last 12 Months</SelectItem>
                        <SelectItem value="custom">Custom Date Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Custom Date Range - Show if custom selected */}
              {customizeForm.watch("duration") === "custom" && (
                <div className="grid grid-cols-2 gap-4">
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <input
                        type="date"
                        value={customizeForm.getValues("startDate") || ""}
                        onChange={(e) => customizeForm.setValue("startDate", e.target.value)}
                        className="w-full px-3 py-2 border border-input rounded-md text-sm"
                        data-testid="input-start-date"
                      />
                    </FormControl>
                  </FormItem>
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <input
                        type="date"
                        value={customizeForm.getValues("endDate") || ""}
                        onChange={(e) => customizeForm.setValue("endDate", e.target.value)}
                        className="w-full px-3 py-2 border border-input rounded-md text-sm"
                        data-testid="input-end-date"
                      />
                    </FormControl>
                  </FormItem>
                </div>
              )}

              {/* Data Type Selection */}
              <FormField
                control={customizeForm.control}
                name="dataTypes"
                render={() => (
                  <FormItem>
                    <FormLabel>Data Types to Include</FormLabel>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {dataTypeOptions.map((option) => (
                        <FormField
                          key={option.id}
                          control={customizeForm.control}
                          name="dataTypes"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <Checkbox
                                checked={field.value?.includes(option.id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, option.id]);
                                  } else {
                                    field.onChange(current.filter((val: string) => val !== option.id));
                                  }
                                }}
                                data-testid={`checkbox-${option.id}`}
                              />
                              <FormLabel className="!mt-0 text-sm font-normal cursor-pointer">
                                {option.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              {/* Report Options */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={customizeForm.control}
                  name="includeSummary"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-summary"
                      />
                      <FormLabel className="!mt-0 text-sm font-normal cursor-pointer">
                        Include Summary
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={customizeForm.control}
                  name="includeCharts"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-charts"
                      />
                      <FormLabel className="!mt-0 text-sm font-normal cursor-pointer">
                        Include Charts & Graphs
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {/* Format Selection */}
              <FormField
                control={customizeForm.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Format</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-report-format">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Document</SelectItem>
                        <SelectItem value="xlsx">Excel Spreadsheet</SelectItem>
                        <SelectItem value="csv">CSV File</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* Buttons */}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCustomizeDialogOpen(false)}
                  data-testid="button-cancel-customize"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={runningReportId === reportTemplateForFormat}
                  data-testid="button-generate-custom-report"
                >
                  {runningReportId === reportTemplateForFormat ? "Generating..." : "Generate Report"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Format Selection Dialog */}
      <Dialog open={formatDialogOpen} onOpenChange={setFormatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Report Format</DialogTitle>
            <DialogDescription>
              Choose the format you want to download your report in
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors" onClick={() => setSelectedFormat("pdf")}>
                <input
                  type="radio"
                  id="format-pdf"
                  name="format"
                  value="pdf"
                  checked={selectedFormat === "pdf"}
                  onChange={() => setSelectedFormat("pdf")}
                  data-testid="radio-format-pdf"
                />
                <label htmlFor="format-pdf" className="flex-1 cursor-pointer">
                  <div className="font-medium">PDF Document</div>
                  <div className="text-sm text-muted-foreground">Professional formatted document</div>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors" onClick={() => setSelectedFormat("xlsx")}>
                <input
                  type="radio"
                  id="format-xlsx"
                  name="format"
                  value="xlsx"
                  checked={selectedFormat === "xlsx"}
                  onChange={() => setSelectedFormat("xlsx")}
                  data-testid="radio-format-xlsx"
                />
                <label htmlFor="format-xlsx" className="flex-1 cursor-pointer">
                  <div className="font-medium">Excel Spreadsheet</div>
                  <div className="text-sm text-muted-foreground">Editable data in Excel format</div>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors" onClick={() => setSelectedFormat("csv")}>
                <input
                  type="radio"
                  id="format-csv"
                  name="format"
                  value="csv"
                  checked={selectedFormat === "csv"}
                  onChange={() => setSelectedFormat("csv")}
                  data-testid="radio-format-csv"
                />
                <label htmlFor="format-csv" className="flex-1 cursor-pointer">
                  <div className="font-medium">CSV File</div>
                  <div className="text-sm text-muted-foreground">Comma-separated values for data import</div>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormatDialogOpen(false)}
                data-testid="button-cancel-format"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmRunReport}
                disabled={runningReportId === reportTemplateForFormat}
                data-testid="button-confirm-format"
              >
                {runningReportId === reportTemplateForFormat ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

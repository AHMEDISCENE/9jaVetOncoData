import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  lastRun?: string;
  status: string;
}

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

  // Mock query - would fetch real data in production
  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/reports/templates"],
    queryFn: () => Promise.resolve(mockTemplates),
  });

  const { data: reportHistory } = useQuery({
    queryKey: ["/api/reports/history"],
    queryFn: () => Promise.resolve(mockReportHistory),
  });

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
                    >
                      <i className="fas fa-play mr-2"></i>Run Report
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      data-testid={`button-schedule-report-${template.id}`}
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
                      {report.status === "completed" && report.downloadUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-download-report-${report.id}`}
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
    </div>
  );
}

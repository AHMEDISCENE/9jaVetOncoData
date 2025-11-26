import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, ChevronDown, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AnalyticsQueryResponse {
  summary: string;
  columns: string[];
  rows: any[];
  caseReferences?: Array<{ id: string; case_number?: string; patient_name?: string; clinic_name?: string }>;
}

type AIMode = "strict" | "universal";

const MODE_DESCRIPTIONS: Record<AIMode, string> = {
  strict: "Answers only from your VetOncoData database.",
  universal: "Uses VetOncoData + general veterinary knowledge.",
};

// Columns to hide from results table (internal IDs and timestamps)
const HIDDEN_COLUMNS = new Set([
  "id",
  "clinic_id",
  "created_by",
  "created_at",
  "updated_at",
  "tumour_type_id",
  "anatomical_site_id",
  "attachments",
  "extra",
  "publishedAt",
  "authorId",
  "clinicId",
  "importId",
  "commentId"
]);

// Function to get display columns (exclude hidden ones)
function getDisplayColumns(columns: string[]): string[] {
  return columns.filter(col => !HIDDEN_COLUMNS.has(col));
}

export function AIAnalyticsPanel() {
  const [question, setQuestion] = useState("");
  const [aiMode, setAiMode] = useState<AIMode>("strict");
  const [response, setResponse] = useState<AnalyticsQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question about your data",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/ai/analytics-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode: aiMode }),
      });

      if (!res.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await res.json();
      setResponse(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadAsCSV = () => {
    if (!response) return;

    const headers = response.columns;
    const rows = response.rows;

    // Convert rows to CSV format
    const csvContent = [
      // Add summary as comment rows
      [`# AI Analytics Report - ${new Date().toLocaleString()}`],
      [`# Mode: ${aiMode}`],
      [`# Summary: ${response.summary.substring(0, 100)}...`],
      [],
      // Add headers
      headers.map(h => `"${h}"`).join(","),
      // Add rows
      ...rows.map(row =>
        headers.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '""';
          const strVal = String(val).replace(/"/g, '""');
          return `"${strVal}"`;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-analytics-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Report downloaded as CSV",
    });
  };

  const downloadAsExcel = () => {
    if (!response) return;

    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["AI Analytics Report"],
      ["Generated", new Date().toLocaleString()],
      ["Mode", aiMode],
      ["Summary", response.summary],
      [],
      ["Total Rows", response.rows.length],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 20 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // Results sheet
    const dataArray = [response.columns, ...response.rows.map(row => response.columns.map(col => row[col]))];
    const dataSheet = XLSX.utils.aoa_to_sheet(dataArray);
    dataSheet["!cols"] = response.columns.map(() => ({ wch: 15 }));
    XLSX.utils.book_append_sheet(workbook, dataSheet, "Results");

    XLSX.writeFile(workbook, `ai-analytics-${Date.now()}.xlsx`);

    toast({
      title: "Success",
      description: "Report downloaded as Excel",
    });
  };

  const downloadAsPDF = () => {
    if (!response) return;

    const pdf = new jsPDF();
    let yPosition = 15;

    // Title
    pdf.setFontSize(16);
    pdf.text("AI Analytics Report", 15, yPosition);
    yPosition += 10;

    // Metadata
    pdf.setFontSize(9);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 15, yPosition);
    yPosition += 5;
    pdf.text(`Mode: ${aiMode}`, 15, yPosition);
    yPosition += 10;

    // Summary
    pdf.setFontSize(11);
    pdf.text("Summary", 15, yPosition);
    yPosition += 5;
    pdf.setFontSize(9);
    const summaryLines = pdf.splitTextToSize(response.summary, 170);
    pdf.text(summaryLines, 15, yPosition);
    yPosition += Math.min(summaryLines.length * 3.5 + 3, 50);

    // Results header
    if (response.rows.length > 0) {
      pdf.setFontSize(11);
      pdf.text(`Results (${response.rows.length} rows)`, 15, yPosition);
      yPosition += 7;

      // Simple text table for first 10 rows
      pdf.setFontSize(8);
      const colCount = Math.min(response.columns.length, 5);
      const cols = response.columns.slice(0, colCount);
      const colWidth = (180 / colCount);

      // Headers
      cols.forEach((col, i) => {
        pdf.text(col.substring(0, 15), 15 + (i * colWidth), yPosition);
      });
      yPosition += 4;
      pdf.setDrawColor(200);
      pdf.line(15, yPosition - 1, 195, yPosition - 1);

      // Rows
      response.rows.slice(0, 10).forEach(row => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 15;
        }
        cols.forEach((col, i) => {
          const val = String(row[col] ?? "").substring(0, 12);
          pdf.text(val, 15 + (i * colWidth), yPosition);
        });
        yPosition += 4;
      });

      if (response.rows.length > 10) {
        yPosition += 3;
        pdf.setFontSize(8);
        pdf.text(`... and ${response.rows.length - 10} more rows`, 15, yPosition);
      }
    }

    pdf.save(`ai-analytics-${Date.now()}.pdf`);

    toast({
      title: "Success",
      description: "Report downloaded as PDF",
    });
  };

  return (
    <Card className="mb-8 border-blue-200 dark:border-blue-900">
      <CardHeader className="bg-blue-50 dark:bg-blue-950">
        <CardTitle className="flex items-center gap-2">
          <span>🤖</span> Ask AI About Your Data
        </CardTitle>
        <CardDescription>
          Ask a natural language question about your cases and clinics
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleAsk} className="space-y-4">
          {/* Mode Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">AI Response Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAiMode("strict")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  aiMode === "strict"
                    ? "bg-teal-600 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-foreground hover:bg-slate-300 dark:hover:bg-slate-700"
                }`}
                data-testid="button-mode-strict"
              >
                Strictly VetOncoData
              </button>
              <button
                type="button"
                onClick={() => setAiMode("universal")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  aiMode === "universal"
                    ? "bg-teal-600 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-foreground hover:bg-slate-300 dark:hover:bg-slate-700"
                }`}
                data-testid="button-mode-universal"
              >
                Universal Oncology AI
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {MODE_DESCRIPTIONS[aiMode]}
            </p>
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="e.g., 'How many cases by species?', 'Show me all remission cases from Lagos', 'What's the most common tumor type?'"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
              className="min-h-20 resize-none"
              data-testid="textarea-ai-question"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            data-testid="button-ask-ai"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Analyzing..." : "Ask AI"}
          </Button>
        </form>

        {response && (
          <div className="mt-6 space-y-4">
            {/* Download Button with Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-download">
                  <Download className="h-4 w-4" />
                  Download Report
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={downloadAsCSV} data-testid="menu-download-csv">
                  CSV File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadAsExcel} data-testid="menu-download-excel">
                  Excel Spreadsheet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadAsPDF} data-testid="menu-download-pdf">
                  PDF Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Summary */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-sm text-foreground mb-2">Summary</h3>
              <div className="text-sm text-foreground leading-relaxed space-y-2">
                {response.summary.split('\n').map((paragraph, idx) => (
                  <p key={idx} className="text-sm">
                    {paragraph.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
                      if (part?.startsWith('**') && part?.endsWith('**')) {
                        return <strong key={i} className="font-semibold text-blue-900 dark:text-blue-200">{part.slice(2, -2)}</strong>;
                      } else if (part?.startsWith('*') && part?.endsWith('*')) {
                        return <em key={i} className="italic text-blue-800 dark:text-blue-300">{part.slice(1, -1)}</em>;
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </p>
                ))}
              </div>
            </div>

            {/* Results Table */}
            {response.rows.length > 0 && (() => {
              const displayColumns = getDisplayColumns(response.columns);
              return displayColumns.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-foreground">Results ({response.rows.length} rows)</h3>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                          {displayColumns.map((col) => (
                            <th
                              key={col}
                              className="px-4 py-2 text-left font-medium text-foreground whitespace-nowrap"
                            >
                              {col.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")}
                            </th>
                          ))}
                          <th className="px-4 py-2 text-left font-medium text-foreground whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {response.rows.slice(0, 10).map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          >
                            {displayColumns.map((col) => (
                              <td
                                key={`${idx}-${col}`}
                                className="px-4 py-2 text-foreground text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-sm"
                                title={String(row[col])}
                              >
                                {row[col] !== null && row[col] !== undefined && row[col] !== "" 
                                  ? String(row[col]).length > 30 
                                    ? String(row[col]).substring(0, 27) + "..."
                                    : String(row[col])
                                  : <span className="text-slate-400">—</span>
                                }
                              </td>
                            ))}
                            <td className="px-4 py-2">
                              {row.id ? (
                                <Link href={`/cases/${row.id}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2 h-8"
                                    data-testid={`button-view-case-${idx}`}
                                  >
                                    View
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </Link>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {response.rows.length > 10 && (
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                        Showing 10 of {response.rows.length} rows
                      </div>
                    )}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

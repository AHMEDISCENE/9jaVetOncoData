import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";

interface AnalyticsQueryResponse {
  summary: string;
  columns: string[];
  rows: any[];
}

export function AIAnalyticsPanel() {
  const [question, setQuestion] = useState("");
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
        body: JSON.stringify({ question }),
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
            {/* Summary */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-sm text-foreground mb-2">Summary</h3>
              <p className="text-sm text-foreground leading-relaxed">{response.summary}</p>
            </div>

            {/* Results Table */}
            {response.rows.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-foreground">Results ({response.rows.length} rows)</h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                        {response.columns.map((col) => (
                          <th
                            key={col}
                            className="px-4 py-2 text-left font-medium text-foreground whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {response.rows.slice(0, 10).map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        >
                          {response.columns.map((col) => (
                            <td
                              key={`${idx}-${col}`}
                              className="px-4 py-2 text-foreground text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-xs"
                              title={String(row[col])}
                            >
                              {row[col] !== null ? String(row[col]) : <span className="text-slate-400">—</span>}
                            </td>
                          ))}
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
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

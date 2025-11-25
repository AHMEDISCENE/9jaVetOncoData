import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AITest() {
  const [question1, setQuestion1] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [loading1, setLoading1] = useState(false);

  const [question2, setQuestion2] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [loading2, setLoading2] = useState(false);

  const { toast } = useToast();

  const handleBasicTest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question1.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question",
        variant: "destructive",
      });
      return;
    }

    setLoading1(true);
    setAnswer1("");

    try {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question1 }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();
      setAnswer1(data.answer);
      toast({
        title: "Success",
        description: "AI response received",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response",
        variant: "destructive",
      });
    } finally {
      setLoading1(false);
    }
  };

  const handleLiveTest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question2.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question",
        variant: "destructive",
      });
      return;
    }

    setLoading2(true);
    setAnswer2("");

    try {
      const response = await fetch("/api/ai/live-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question2 }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();
      setAnswer2(data.answer);
      toast({
        title: "Success",
        description: "AI response received with live database context",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response",
        variant: "destructive",
      });
    } finally {
      setLoading2(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Test */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic ChatGPT</CardTitle>
            <CardDescription>
              Ask without database context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleBasicTest} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask me anything..."
                  value={question1}
                  onChange={(e) => setQuestion1(e.target.value)}
                  disabled={loading1}
                  data-testid="input-ai-question-basic"
                />
                <Button
                  type="submit"
                  disabled={loading1}
                  data-testid="button-submit-basic"
                >
                  {loading1 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading1 ? "..." : "Ask"}
                </Button>
              </div>
            </form>

            {answer1 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <p className="text-sm text-foreground whitespace-pre-wrap">{answer1}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Data Test */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ChatGPT with Live Data</CardTitle>
            <CardDescription>
              Ask with real-time database context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleLiveTest} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about case data..."
                  value={question2}
                  onChange={(e) => setQuestion2(e.target.value)}
                  disabled={loading2}
                  data-testid="input-ai-question-live"
                />
                <Button
                  type="submit"
                  disabled={loading2}
                  data-testid="button-submit-live"
                >
                  {loading2 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading2 ? "..." : "Ask"}
                </Button>
              </div>
            </form>

            {answer2 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-foreground whitespace-pre-wrap">{answer2}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

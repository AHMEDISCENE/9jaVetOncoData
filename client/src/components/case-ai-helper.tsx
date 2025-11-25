import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2, CheckCircle2 } from "lucide-react";

interface CaseSuggestion {
  species?: string;
  breed?: string;
  sex?: string;
  ageYears?: number;
  ageMonths?: number;
  diagnosisMethod?: string;
  tumourTypeCustom?: string;
  anatomicalSiteCustom?: string;
  laterality?: string;
  stage?: string;
  treatmentPlan?: string;
  notes?: string;
}

interface CaseAIHelperProps {
  onApplySuggestions: (suggestions: CaseSuggestion) => void;
}

export function CaseAIHelper({ onApplySuggestions }: CaseAIHelperProps) {
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [suggestions, setSuggestions] = useState<CaseSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAskAI = async () => {
    if (!clinicalNotes.trim()) {
      toast({
        title: "Error",
        description: "Please paste clinical notes first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/ai/suggest-case-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: clinicalNotes }),
      });

      if (!response.ok) {
        throw new Error("Failed to get suggestions");
      }

      const data = await response.json();
      setSuggestions(data.suggestions);
      
      toast({
        title: "Success",
        description: "AI suggestions generated. Review and apply as needed.",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to generate suggestions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (suggestions) {
      onApplySuggestions(suggestions);
      toast({
        title: "Applied",
        description: "Suggestions applied to form fields. You can edit them as needed.",
      });
      setClinicalNotes("");
      setSuggestions(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            AI Clinical Notes Helper
          </CardTitle>
          <CardDescription>
            Paste free-text clinical notes and let AI extract structured data for your case form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Paste Clinical Notes</label>
            <Textarea
              placeholder="e.g., Golden Retriever, 8 years old female. Left front leg swelling for 2 months. Ultrasound shows osteosarcoma, Stage III. Plan: surgical amputation + chemotherapy."
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              disabled={loading}
              className="min-h-24 resize-none"
              data-testid="textarea-clinical-notes"
            />
          </div>

          {/* Ask Button */}
          <Button
            onClick={handleAskAI}
            disabled={loading || !clinicalNotes.trim()}
            className="w-full"
            data-testid="button-ai-suggest"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Analyzing..." : "Get AI Suggestions"}
          </Button>

          {/* Suggestions Display */}
          {suggestions && Object.keys(suggestions).length > 0 && (
            <div className="space-y-3 pt-2 border-t border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-sm text-foreground">Suggested Values</span>
              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white dark:bg-slate-900 rounded-lg p-4">
                {suggestions.species && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Species</span>
                    <Badge variant="secondary">{suggestions.species}</Badge>
                  </div>
                )}
                {suggestions.breed && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Breed</span>
                    <Badge variant="secondary">{suggestions.breed}</Badge>
                  </div>
                )}
                {suggestions.sex && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Sex</span>
                    <Badge variant="secondary">{suggestions.sex}</Badge>
                  </div>
                )}
                {suggestions.ageYears && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Age</span>
                    <Badge variant="secondary">
                      {suggestions.ageYears}y{suggestions.ageMonths ? ` ${suggestions.ageMonths}m` : ""}
                    </Badge>
                  </div>
                )}
                {suggestions.diagnosisMethod && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Diagnosis Method</span>
                    <Badge variant="secondary" className="text-wrap text-left">{suggestions.diagnosisMethod}</Badge>
                  </div>
                )}
                {suggestions.tumourTypeCustom && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Tumor Type</span>
                    <Badge variant="secondary">{suggestions.tumourTypeCustom}</Badge>
                  </div>
                )}
                {suggestions.anatomicalSiteCustom && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Location</span>
                    <Badge variant="secondary">{suggestions.anatomicalSiteCustom}</Badge>
                  </div>
                )}
                {suggestions.laterality && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Laterality</span>
                    <Badge variant="secondary">{suggestions.laterality}</Badge>
                  </div>
                )}
                {suggestions.stage && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Stage</span>
                    <Badge variant="secondary">{suggestions.stage}</Badge>
                  </div>
                )}
                {suggestions.treatmentPlan && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Treatment Plan</span>
                    <Badge variant="secondary" className="text-wrap text-left">{suggestions.treatmentPlan}</Badge>
                  </div>
                )}
              </div>

              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <AlertDescription className="text-sm text-foreground">
                  💡 These are AI-generated suggestions. Review and edit them as needed before applying to your form.
                </AlertDescription>
              </Alert>

              {/* Apply Button */}
              <Button
                onClick={handleApply}
                className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-800 dark:hover:bg-green-900"
                data-testid="button-apply-suggestions"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Apply Suggestions to Form
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

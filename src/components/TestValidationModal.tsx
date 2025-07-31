import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, X } from "lucide-react";
import { useAI } from "@/hooks/useAI";
import { useProfile } from "@/hooks/useProfile";

interface TestValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  onValidationComplete: (isCorrect: boolean, feedback: string) => void;
}

export function TestValidationModal({ 
  isOpen, 
  onClose, 
  question, 
  onValidationComplete 
}: TestValidationModalProps) {
  const [answer, setAnswer] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    credible: boolean;
    reason: string;
  } | null>(null);
  
  const { validateTest } = useAI();
  const { userName } = useProfile();

  const handleSubmit = async () => {
    if (!answer.trim()) return;

    setIsValidating(true);
    try {
      const result = await validateTest(question, answer.trim(), userName);
      if (result) {
        setValidationResult(result);
        onValidationComplete(result.credible, result.reason);
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        credible: false,
        reason: "Unable to validate answer due to technical issues. Please try again."
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleClose = () => {
    setAnswer("");
    setValidationResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-floating border-border animate-in zoom-in-95 duration-300">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">Answer the Question</CardTitle>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Question */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-medium text-foreground mb-2">Question:</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{question}</p>
          </div>

          {/* Answer Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Your Answer:</label>
            <Textarea
              placeholder="Type your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="min-h-[120px] resize-none"
              disabled={isValidating || !!validationResult}
            />
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div className={`p-4 rounded-lg border ${
              validationResult.credible 
                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {validationResult.credible ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <Badge variant={validationResult.credible ? "default" : "destructive"}>
                  {validationResult.credible ? "Correct" : "Incorrect"}
                </Badge>
              </div>
              <p className="text-sm text-foreground">{validationResult.reason}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            {!validationResult && (
              <Button 
                onClick={handleSubmit}
                disabled={!answer.trim() || isValidating}
                className="bg-ai-gradient hover:shadow-neural-glow transition-all duration-300"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Submit Answer"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
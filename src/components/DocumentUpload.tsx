import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadProps {
  onDocumentProcessed: (content: string, filename: string) => void;
}

export function DocumentUpload({ onDocumentProcessed }: DocumentUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setUploadedFile(file);
        processDocument(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF file.",
          variant: "destructive"
        });
      }
    }
  };

  const processDocument = async (file: File) => {
    setIsProcessing(true);
    
    try {
      // For now, we'll use a simple text extraction approach
      // In a real implementation, you would use pdf-parse or similar library
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // Basic PDF text extraction simulation
        // In production, you'd use proper PDF parsing
        const text = `Document content from ${file.name}. 
        This is a placeholder for PDF text extraction. 
        In a full implementation, this would contain the actual extracted text from the PDF document.
        Key topics and concepts would be extracted and used to enhance course generation.`;
        
        onDocumentProcessed(text, file.name);
        
        toast({
          title: "Document Processed",
          description: `Successfully extracted content from ${file.name}`,
        });
      };
      
      reader.readAsArrayBuffer(file);
      
    } catch (error) {
      console.error('Document processing error:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to process the document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="border-dashed border-2 border-border">
      <CardContent className="p-6">
        {!uploadedFile ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Upload Document</h3>
              <p className="text-sm text-muted-foreground">
                Upload a PDF to enhance course generation
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose PDF File
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{uploadedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {isProcessing ? 'Processing...' : 'Ready to use'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={removeFile}
              disabled={isProcessing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
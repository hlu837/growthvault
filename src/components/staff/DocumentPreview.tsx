import { useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCw, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface DocumentPreviewProps {
  filePath: string | null;
  bucketName: "kyc-documents" | "deposit-proofs";
  className?: string;
}

const DocumentPreview = ({ filePath, bucketName, className }: DocumentPreviewProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const loadDocument = useCallback(async () => {
    if (!filePath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: signError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 7200); // 2 hours

      if (signError) throw signError;
      setSignedUrl(data.signedUrl);
    } catch (err: any) {
      setError(err.message || "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [filePath, bucketName]);

  // Auto-load on mount if filePath exists
  useEffect(() => {
    if (filePath) {
      loadDocument();
    }
  }, [filePath, loadDocument]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  if (!filePath) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center bg-slate-900/50 border border-red-500/30 rounded-lg p-8",
        className
      )}>
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-400 font-semibold text-center">
          WARNING: No Document Uploaded
        </p>
        <p className="text-slate-500 text-sm text-center mt-2">
          This user has not submitted any identity verification document.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center bg-slate-900/50 border border-slate-800 rounded-lg p-8",
        className
      )}>
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center bg-slate-900/50 border border-red-500/30 rounded-lg p-8",
        className
      )}>
        <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
        <p className="text-red-400 text-sm text-center">{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4 border-slate-700"
          onClick={loadDocument}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!signedUrl) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center bg-slate-900/50 border border-slate-800 rounded-lg p-8",
        className
      )}>
        <Button 
          variant="outline" 
          className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
          onClick={loadDocument}
        >
          Load Document Preview
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={handleZoomOut}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-500 min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={handleZoomIn}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="w-px h-4 bg-slate-700 mx-2" />
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={handleRotate}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-slate-400 hover:text-white gap-1"
          onClick={() => window.open(signedUrl, '_blank')}
        >
          <ExternalLink className="w-3 h-3" />
          Open Full
        </Button>
      </div>

      {/* Image Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
        <img
          src={signedUrl}
          alt="Document preview"
          className="max-w-full transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
          }}
          onError={() => setError("Failed to load image")}
        />
      </div>
    </div>
  );
};

export default DocumentPreview;

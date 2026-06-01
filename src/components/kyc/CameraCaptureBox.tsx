import { useState, useRef, useCallback } from "react";
import { Camera, RotateCcw, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface CameraCaptureBoxProps {
  label: string;
  required?: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const CameraCaptureBox = ({ label, required, file, onFileChange }: CameraCaptureBoxProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try front camera first, fall back to any camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }
      setIsCameraOpen(true);
    } catch (error: any) {
      console.error("Camera error:", error);
      toast({
        title: "Camera access denied",
        description: "Please allow camera access in your browser settings to take a selfie.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    
    if (!context) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Flip horizontally to match mirrored preview
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        onFileChange(capturedFile);
        stopCamera();
      }
    }, "image/jpeg", 0.9);
  }, [onFileChange, stopCamera]);

  const retake = useCallback(() => {
    onFileChange(null);
    setPreviewUrl(null);
  }, [onFileChange]);

  // Clean up on unmount
  const handleClose = useCallback(() => {
    stopCamera();
    retake();
  }, [stopCamera, retake]);

  // If we have a captured photo
  if (file && previewUrl) {
    return (
      <div className="space-y-2">
        <Label className="font-mono text-sm">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="border-[0.5px] border-accent/50 rounded-md overflow-hidden bg-secondary">
          <div className="relative aspect-[4/3]">
            <img 
              src={previewUrl} 
              alt="Selfie preview" 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 right-2 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={retake}
                className="h-8 gap-1 font-mono text-xs"
              >
                <RotateCcw className="w-3 h-3" />
                Retake
              </Button>
            </div>
            <div className="absolute top-2 right-2">
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                <Check className="w-4 h-4 text-accent-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Camera view
  if (isCameraOpen) {
    return (
      <div className="space-y-2">
        <Label className="font-mono text-sm">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="border-[0.5px] border-accent/50 rounded-md overflow-hidden bg-black">
          <div className="relative aspect-[4/3]">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Camera controls */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-10 w-10 rounded-full bg-destructive/80 hover:bg-destructive text-destructive-foreground"
              >
                <X className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={capturePhoto}
                className="h-14 w-14 rounded-full bg-background hover:bg-muted text-foreground border-4 border-primary"
              >
                <Camera className="w-6 h-6" />
              </Button>
              <div className="w-10" /> {/* Spacer for balance */}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Initial state - button to open camera
  return (
    <div className="space-y-2">
      <Label className="font-mono text-sm">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="border-[0.5px] border-dashed border-border rounded-md p-4 text-center hover:border-accent/50 transition-colors">
        <button 
          onClick={startCamera}
          disabled={isLoading}
          className="w-full cursor-pointer"
          type="button"
        >
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-secondary flex items-center justify-center">
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <p className="text-sm text-foreground font-mono mb-1">
            {isLoading ? "Opening camera..." : "Take a Selfie"}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            Use your camera to capture a photo
          </p>
        </button>
      </div>
    </div>
  );
};

export default CameraCaptureBox;

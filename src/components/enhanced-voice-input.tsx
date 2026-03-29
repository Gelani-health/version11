"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Copy,
  Trash2,
  Volume2,
  Edit3,
  Check,
  X,
  Sparkles,
  Activity,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ============================================
// TYPES
// ============================================

type RecordingState = "idle" | "recording" | "processing" | "review" | "success" | "error";

interface TranscriptionResult {
  text: string;
  confidence: number;
  wordCount: number;
  processingTimeMs: number;
  medicalTerms: string[];
  engine: string;
  timestamp: Date;
}

interface EnhancedVoiceInputProps {
  onTranscript: (text: string) => void;
  onAppend?: (text: string) => void;
  currentValue?: string;
  context?: "medical" | "general" | "lab" | "consultation" | "notes" | "soap-subjective" | "soap-objective" | "soap-assessment" | "soap-plan";
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "outline" | "ghost" | "floating";
  className?: string;
  disabled?: boolean;
  showStatus?: boolean;
  showReview?: boolean;
  language?: string;
  placeholder?: string;
  multiline?: boolean;
  autoInsert?: boolean;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
}

// ============================================
// ENHANCED MEDICAL MICROPHONE ICON
// ============================================

function MedicalMicIcon({ 
  className, 
  isRecording, 
  audioLevel = 0 
}: { 
  className?: string; 
  isRecording?: boolean;
  audioLevel?: number;
}) {
  return (
    <div className={cn("relative", className)}>
      {/* Audio wave rings when recording */}
      {isRecording && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-400"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.8, 0, 0.8],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border border-red-300"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          />
        </>
      )}
      
      {/* Main icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          "relative z-10 transition-all",
          isRecording && "animate-pulse"
        )}
      >
        {/* Medical cross background */}
        <circle cx="12" cy="12" r="10" className="opacity-10" fill="currentColor" />
        
        {/* Microphone body */}
        <path
          d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
          className="fill-current opacity-20"
        />
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        
        {/* Microphone stand */}
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
        
        {/* Medical pulse line */}
        <path
          d="M8 22h8"
          className="opacity-60"
        />
        <path
          d="M10 21l2-2 2 2"
          className="opacity-60"
        />
      </svg>
      
      {/* Audio level indicator */}
      {isRecording && audioLevel > 0 && (
        <motion.div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="w-0.5 bg-red-500 rounded-full"
              animate={{
                height: [4, 8 + audioLevel * 8, 4],
              }}
              transition={{
                duration: 0.3,
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ============================================
// MAIN ENHANCED VOICE INPUT COMPONENT
// ============================================

export function EnhancedVoiceInput({
  onTranscript,
  onAppend,
  currentValue = "",
  context = "medical",
  size = "md",
  variant = "default",
  className,
  disabled = false,
  showStatus = true,
  showReview = true,
  language = "en-US",
  placeholder = "Click to start voice recording...",
  multiline = false,
  autoInsert = false,
  onRecordingStart,
  onRecordingEnd,
}: EnhancedVoiceInputProps) {
  // State
  const [state, setState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [editedTranscript, setEditedTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [recordingHistory, setRecordingHistory] = useState<TranscriptionResult[]>([]);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Get size classes
  const getSizeClasses = useCallback(() => {
    switch (size) {
      case "sm": return { button: "h-8 w-8", icon: "h-4 w-4" };
      case "lg": return { button: "h-12 w-12", icon: "h-6 w-6" };
      case "xl": return { button: "h-16 w-16", icon: "h-8 w-8" };
      default: return { button: "h-10 w-10", icon: "h-5 w-5" };
    }
  }, [size]);

  // Get variant classes
  const getVariantClasses = useCallback(() => {
    switch (variant) {
      case "floating":
        return "rounded-full shadow-lg hover:shadow-xl transition-shadow";
      case "outline":
        return "border-2";
      case "ghost":
        return "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800";
      default:
        return "";
    }
  }, [variant]);

  // Start audio monitoring
  const startAudioMonitoring = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      analyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
        }
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (err) {
      console.error("Audio monitoring error:", err);
    }
  }, []);

  // Stop audio monitoring
  const stopAudioMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Process audio
  const processAudio = useCallback(async (audioBlob: Blob) => {
    setState("processing");
    const startTime = Date.now();
    
    try {
      // Convert to base64
      const reader = new FileReader();
      
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        
        try {
          // Try MedASR service first
          const response = await fetch("/api/medasr/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio_base64: base64Audio,
              sample_rate: 16000,
              language: "en",
              context,
              enable_medical_postprocess: true,
            }),
          });
          
          const data = await response.json();
          
          if (response.ok && data.transcription) {
            const result: TranscriptionResult = {
              text: data.transcription,
              confidence: data.confidence || 0.95,
              wordCount: data.word_count || data.transcription.split(" ").length,
              processingTimeMs: Date.now() - startTime,
              medicalTerms: data.medical_terms_detected || [],
              engine: data.engine || "medasr",
              timestamp: new Date(),
            };
            
            setLastResult(result);
            setTranscript(result.text);
            setEditedTranscript(result.text);
            
            // Add to history
            setRecordingHistory(prev => [result, ...prev.slice(0, 9)]);
            
            if (showReview && !autoInsert) {
              setState("review");
              setShowReviewDialog(true);
            } else {
              // Auto insert
              handleAcceptTranscript(result.text);
            }
            
          } else {
            // Fallback to Web Speech API
            await processWithWebSpeechAPI();
          }
          
        } catch (err) {
          console.log("MedASR unavailable, using Web Speech API fallback");
          await processWithWebSpeechAPI();
        }
      };
      
      reader.readAsDataURL(audioBlob);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Processing failed";
      setError(errorMessage);
      setState("error");
      
      toast({
        title: "Processing Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [context, showReview, autoInsert, toast]);

  // Fallback to Web Speech API
  const processWithWebSpeechAPI = useCallback(async () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Speech recognition not supported");
      setState("error");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;
    
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      
      const result: TranscriptionResult = {
        text,
        confidence,
        wordCount: text.split(" ").length,
        processingTimeMs: 0,
        medicalTerms: [],
        engine: "web-speech-api",
        timestamp: new Date(),
      };
      
      setLastResult(result);
      setTranscript(text);
      setEditedTranscript(text);
      
      setRecordingHistory(prev => [result, ...prev.slice(0, 9)]);
      
      if (showReview && !autoInsert) {
        setState("review");
        setShowReviewDialog(true);
      } else {
        handleAcceptTranscript(text);
      }
    };
    
    recognition.onerror = (event: any) => {
      setError(event.error);
      setState("error");
    };
    
    recognition.start();
  }, [language, showReview, autoInsert]);

  // Handle accept transcript
  const handleAcceptTranscript = useCallback((text: string) => {
    if (onAppend && currentValue) {
      const newText = currentValue.trim() ? `${currentValue.trim()} ${text}` : text;
      onTranscript(newText);
    } else {
      onTranscript(text);
    }
    
    setState("success");
    setShowReviewDialog(false);
    
    toast({
      title: "Transcription Accepted",
      description: `${text.split(" ").length} words inserted`,
    });
    
    // Reset after delay
    setTimeout(() => {
      setState("idle");
      setTranscript("");
      setEditedTranscript("");
    }, 1500);
  }, [onTranscript, onAppend, currentValue, toast]);

  // Handle rerecord
  const handleRerecord = useCallback(() => {
    setShowReviewDialog(false);
    setTranscript("");
    setEditedTranscript("");
    setLastResult(null);
    setState("idle");
    
    // Start new recording after short delay
    setTimeout(() => {
      startRecording();
    }, 300);
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript("");
      setEditedTranscript("");
      setRecordingTime(0);
      setLastResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });
      
      streamRef.current = stream;
      startAudioMonitoring(stream);
      
      // Determine best MIME type
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      
      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      if (!selectedMimeType) {
        throw new Error("No supported audio format");
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        stopAudioMonitoring();
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        processAudio(audioBlob);
        onRecordingEnd?.();
      };
      
      mediaRecorder.start(100);
      setState("recording");
      onRecordingStart?.();
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Microphone access denied";
      setError(errorMessage);
      setState("error");
      
      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [startAudioMonitoring, stopAudioMonitoring, processAudio, onRecordingStart, onRecordingEnd, toast]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (disabled) return;
    
    if (state === "recording") {
      stopRecording();
    } else if (state === "idle" || state === "error") {
      startRecording();
    }
  }, [disabled, state, startRecording, stopRecording]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get button state class
  const getButtonStateClass = useCallback(() => {
    switch (state) {
      case "recording":
        return "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/30";
      case "processing":
        return "bg-gradient-to-r from-amber-500 to-orange-500 text-white";
      case "success":
        return "bg-gradient-to-r from-emerald-500 to-teal-500 text-white";
      case "error":
        return "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
      default:
        return "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50";
    }
  }, [state]);

  const sizeClasses = getSizeClasses();

  return (
    <>
      <TooltipProvider>
        <div className={cn("inline-flex items-center gap-2", className)}>
          {/* Main Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                type="button"
                suppressHydrationWarning
                className={cn(
                  "relative rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
                  sizeClasses.button,
                  getButtonStateClass(),
                  getVariantClasses()
                )}
                onClick={toggleRecording}
                disabled={disabled || state === "processing"}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {state === "idle" && (
                  <MedicalMicIcon className={sizeClasses.icon} />
                )}
                {state === "recording" && (
                  <MedicalMicIcon 
                    className={sizeClasses.icon} 
                    isRecording 
                    audioLevel={audioLevel} 
                  />
                )}
                {state === "processing" && (
                  <Loader2 className={cn(sizeClasses.icon, "animate-spin")} />
                )}
                {state === "success" && (
                  <CheckCircle2 className={sizeClasses.icon} />
                )}
                {state === "error" && (
                  <AlertCircle className={sizeClasses.icon} />
                )}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {state === "idle" && "Click to start voice recording"}
              {state === "recording" && `Recording... (${formatTime(recordingTime)})`}
              {state === "processing" && "Processing audio..."}
              {state === "success" && "Transcription complete!"}
              {state === "error" && "Error - Click to retry"}
            </TooltipContent>
          </Tooltip>

          {/* Status Indicators */}
          {showStatus && (
            <AnimatePresence mode="wait">
              {state === "recording" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
                    <Activity className="h-3 w-3 mr-1 animate-pulse" />
                    {formatTime(recordingTime)}
                  </Badge>
                  
                  {/* Audio level bar */}
                  <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                      animate={{ width: `${audioLevel * 100}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </motion.div>
              )}
              
              {state === "success" && lastResult && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                    <Check className="h-3 w-3 mr-1" />
                    {lastResult.wordCount} words
                  </Badge>
                  {lastResult.medicalTerms.length > 0 && (
                    <Badge variant="outline" className="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {lastResult.medicalTerms.length} terms
                    </Badge>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </TooltipProvider>

      {/* Transcription Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-emerald-500" />
              Review Transcription
            </DialogTitle>
            <DialogDescription>
              Review and edit the transcription before inserting
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Transcription stats */}
            {lastResult && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                  Confidence: {Math.round(lastResult.confidence * 100)}%
                </Badge>
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                  {lastResult.wordCount} words
                </Badge>
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                  Engine: {lastResult.engine}
                </Badge>
                {lastResult.processingTimeMs > 0 && (
                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800">
                    {lastResult.processingTimeMs}ms
                  </Badge>
                )}
              </div>
            )}
            
            {/* Medical terms detected */}
            {lastResult?.medicalTerms && lastResult.medicalTerms.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Medical Terms Detected:
                </p>
                <div className="flex flex-wrap gap-1">
                  {lastResult.medicalTerms.map((term, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Editable transcription */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Transcription (editable):
              </label>
              <Textarea
                value={editedTranscript}
                onChange={(e) => setEditedTranscript(e.target.value)}
                placeholder="Transcription will appear here..."
                className="min-h-[120px] font-mono text-sm"
              />
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleRerecord}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Re-record
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowReviewDialog(false);
                setState("idle");
              }}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={() => handleAcceptTranscript(editedTranscript)}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Check className="h-4 w-4 mr-2" />
              Insert Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// VOICE INPUT TEXTAREA - DROP-IN REPLACEMENT
// ============================================

interface VoiceInputTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  context?: EnhancedVoiceInputProps["context"];
  disabled?: boolean;
  className?: string;
  rows?: number;
  label?: string;
}

export function VoiceInputTextarea({
  value,
  onChange,
  placeholder = "Type or use voice input...",
  context = "medical",
  disabled = false,
  className,
  rows = 4,
  label,
}: VoiceInputTextareaProps) {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <div className={cn("relative", className)}>
      {label && (
        <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      
      <div className={cn(
        "relative rounded-lg border transition-all",
        isFocused && "ring-2 ring-emerald-500/30 border-emerald-500"
      )}>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="border-0 focus-visible:ring-0 pr-12"
        />
        
        {/* Voice input button overlay */}
        <div className="absolute right-2 bottom-2">
          <EnhancedVoiceInput
            onTranscript={onChange}
            currentValue={value}
            onAppend={onChange}
            context={context}
            size="sm"
            variant="ghost"
            showStatus={false}
            showReview={true}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// VOICE INPUT INPUT - FOR SINGLE LINE FIELDS
// ============================================

interface VoiceInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  context?: EnhancedVoiceInputProps["context"];
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function VoiceInputField({
  value,
  onChange,
  placeholder = "Type or use voice input...",
  type = "text",
  context = "medical",
  disabled = false,
  className,
  label,
}: VoiceInputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <div className={cn("relative", className)}>
      {label && (
        <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      
      <div className={cn(
        "relative rounded-lg border transition-all",
        isFocused && "ring-2 ring-emerald-500/30 border-emerald-500"
      )}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full h-10 px-3 py-2 bg-transparent border-0 focus:outline-none focus-visible:ring-0 pr-12"
        />
        
        {/* Voice input button overlay */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <EnhancedVoiceInput
            onTranscript={onChange}
            currentValue={value}
            onAppend={onChange}
            context={context}
            size="sm"
            variant="ghost"
            showStatus={false}
            showReview={false}
            autoInsert
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// FLOATING VOICE INPUT FAB
// ============================================

interface FloatingVoiceInputFABProps {
  onTranscript: (text: string, targetId?: string) => void;
  activeTargetId?: string;
  position?: "bottom-right" | "bottom-left" | "bottom-center";
}

export function FloatingVoiceInputFAB({
  onTranscript,
  activeTargetId,
  position = "bottom-right",
}: FloatingVoiceInputFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  
  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2",
  };
  
  const handleInsert = useCallback(() => {
    if (transcript) {
      onTranscript(transcript, activeTargetId);
      setTranscript("");
      setIsOpen(false);
    }
  }, [transcript, activeTargetId, onTranscript]);
  
  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            suppressHydrationWarning
            className={cn(
              "fixed z-50 w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow",
              positionClasses[position]
            )}
            onClick={() => setIsOpen(true)}
          >
            <MedicalMicIcon className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Expanded Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed z-50 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden",
              positionClasses[position]
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
              <div className="flex items-center gap-2">
                <Waves className="h-5 w-5" />
                <span className="font-semibold">Medical Voice Input</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-3">
              <VoiceInputTextarea
                value={transcript}
                onChange={setTranscript}
                context="medical"
                placeholder="Click mic to start recording..."
                rows={3}
              />
              
              {transcript && (
                <Button
                  onClick={handleInsert}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Insert into Active Field
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default EnhancedVoiceInput;

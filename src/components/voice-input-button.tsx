"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  Check,
  AlertCircle,
  Volume2,
  Settings,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onAppend?: (text: string) => void; // Append to existing text
  currentValue?: string; // Current input value
  context?: "medical" | "general" | "lab" | "consultation" | "notes";
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  disabled?: boolean;
  showStatus?: boolean;
  language?: string;
}

type RecordingState = "idle" | "recording" | "processing" | "success" | "error";

// ============================================
// WEB SPEECH API TYPE DECLARATIONS
// ============================================

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// ============================================
// HELPER: Check Web Speech API Support
// ============================================

function checkSpeechRecognitionSupport(): boolean {
  if (typeof window === 'undefined') return false;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return !!SpeechRecognition;
}

// ============================================
// MAIN COMPONENT - Using Web Speech API
// ============================================

export function VoiceInputButton({
  onTranscript,
  onAppend,
  currentValue = "",
  context = "medical",
  size = "md",
  variant = "outline",
  className,
  disabled = false,
  showStatus = true,
  language = "en-US",
}: VoiceInputButtonProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Check support once on module level (client-side only)
  const isSupported = typeof window !== 'undefined' && 
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup function defined inline to avoid dependency issues
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  // Medical term post-processing
  const processMedicalText = useCallback((text: string): string => {
    if (context !== "medical") return text;
    
    // Capitalize common medical terms
    const medicalTerms = [
      'patient', 'doctor', 'diagnosis', 'treatment', 'medication', 'symptoms',
      'blood', 'pressure', 'heart', 'lung', 'chest', 'abdomen', 'fever',
      'cough', 'pain', 'headache', 'nausea', 'vomiting', 'diarrhea',
      'diabetes', 'hypertension', 'pneumonia', 'infection', 'antibiotic',
      'ibuprofen', 'paracetamol', 'aspirin', 'insulin', 'metformin'
    ];
    
    let processed = text;
    medicalTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      processed = processed.replace(regex, term.charAt(0).toUpperCase() + term.slice(1));
    });
    
    return processed;
  }, [context]);

  // Start recognition
  const startRecognition = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.");
      setState("error");
      toast({
        title: "Not Supported",
        description: "Speech recognition requires Chrome, Edge, or Safari.",
        variant: "destructive",
      });
      return;
    }

    try {
      setError(null);
      setTranscript("");
      setInterimTranscript("");
      setRecordingTime(0);
      finalTranscriptRef.current = "";

      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create recognition instance
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setState("recording");
        
        // Start timer
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);

        // Simulate audio level for visual feedback
        audioLevelIntervalRef.current = setInterval(() => {
          setAudioLevel(Math.random() * 0.5 + 0.2);
        }, 100);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscriptRef.current += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }
        
        setInterimTranscript(interim);
        
        if (finalTranscriptRef.current) {
          const processed = processMedicalText(finalTranscriptRef.current.trim());
          setTranscript(processed);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // "aborted" is normal when user stops speaking or cancels - don't show error
        if (event.error === 'aborted') {
          setState("idle");
          if (audioLevelIntervalRef.current) {
            clearInterval(audioLevelIntervalRef.current);
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return;
        }
        
        console.error("Speech recognition error:", event.error);
        
        let errorMessage = "Speech recognition failed";
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = "No speech detected. Please try speaking louder.";
            break;
          case 'audio-capture':
            errorMessage = "No microphone found. Please check your microphone.";
            break;
          case 'not-allowed':
            errorMessage = "Microphone access denied. Please allow microphone access.";
            break;
          case 'network':
            errorMessage = "Network error. Please check your internet connection.";
            break;
        }
        
        setError(errorMessage);
        setState("error");
        
        if (audioLevelIntervalRef.current) {
          clearInterval(audioLevelIntervalRef.current);
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        toast({
          title: "Recognition Error",
          description: errorMessage,
          variant: "destructive",
        });
      };

      recognition.onend = () => {
        // Only process if we have final transcript
        const finalText = finalTranscriptRef.current.trim();
        if (finalText) {
          const processed = processMedicalText(finalText);
          
          setState("success");
          setTranscript(processed);
          
          // Call callback
          if (onAppend && currentValue) {
            const newText = currentValue.trim() 
              ? `${currentValue.trim()} ${processed}`
              : processed;
            onTranscript(newText);
          } else {
            onTranscript(processed);
          }

          const wordCount = processed.split(/\s+/).filter(w => w).length;
          
          toast({
            title: "Transcription Complete",
            description: `${wordCount} words transcribed`,
          });

          // Reset to idle after success
          setTimeout(() => {
            setState("idle");
            setTranscript("");
            setInterimTranscript("");
          }, 1500);
        } else {
          // No transcript - return to idle
          setState("idle");
        }
        
        // Clear timers
        if (audioLevelIntervalRef.current) {
          clearInterval(audioLevelIntervalRef.current);
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setAudioLevel(0);
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err) {
      console.error("Failed to start recognition:", err);
      setError("Microphone access denied. Please allow microphone access.");
      setState("error");
      toast({
        title: "Microphone Error",
        description: "Please allow microphone access to use voice input.",
        variant: "destructive",
      });
    }
  }, [toast, language, processMedicalText, onTranscript, onAppend, currentValue]);

  // Stop recognition
  const stopRecognition = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    setAudioLevel(0);
  }, []);

  // Toggle recording
  const toggleRecording = () => {
    if (disabled || !isSupported) return;
    
    if (state === "recording") {
      stopRecognition();
    } else if (state === "idle" || state === "error" || state === "success") {
      startRecognition();
    }
  };

  // Get button size
  const getSize = () => {
    switch (size) {
      case "sm": return "h-8 w-8";
      case "lg": return "h-12 w-12";
      default: return "h-10 w-10";
    }
  };

  // Get icon size
  const getIconSize = () => {
    switch (size) {
      case "sm": return "h-4 w-4";
      case "lg": return "h-6 w-6";
      default: return "h-5 w-5";
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TooltipProvider>
      <div className="inline-flex items-center gap-2">
        {/* Main Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={variant}
              size="icon"
              className={cn(
                getSize(),
                "relative transition-all duration-200",
                state === "recording" && "bg-red-500 hover:bg-red-600 text-white border-red-500",
                state === "processing" && "bg-amber-500 hover:bg-amber-600 text-white",
                state === "success" && "bg-emerald-500 hover:bg-emerald-600 text-white",
                state === "error" && "bg-red-500 hover:bg-red-600 text-white",
                disabled && "opacity-50 cursor-not-allowed",
                className
              )}
              onClick={toggleRecording}
              disabled={disabled || state === "processing"}
            >
              <AnimatePresence mode="wait">
                {state === "idle" && (
                  <Mic className={getIconSize()} />
                )}
                {state === "recording" && (
                  <motion.div
                    key="recording"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Square className={getIconSize()} />
                  </motion.div>
                )}
                {state === "processing" && (
                  <Loader2 className={cn(getIconSize(), "animate-spin")} />
                )}
                {state === "success" && (
                  <motion.div
                    key="success"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <Check className={getIconSize()} />
                  </motion.div>
                )}
                {state === "error" && (
                  <AlertCircle className={getIconSize()} />
                )}
              </AnimatePresence>

              {/* Audio Level Indicator */}
              {state === "recording" && (
                <motion.div
                  className="absolute inset-0 rounded-md border-2 border-red-300"
                  animate={{
                    scale: [1, 1 + audioLevel * 0.3, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {state === "idle" && "Click to start voice input"}
            {state === "recording" && "Click to stop recording"}
            {state === "processing" && "Processing audio..."}
            {state === "success" && "Transcription complete!"}
            {state === "error" && "Error - Click to retry"}
          </TooltipContent>
        </Tooltip>

        {/* Status Badge */}
        {showStatus && state === "recording" && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <motion.div
                className="w-2 h-2 rounded-full bg-red-500 mr-2"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              {formatTime(recordingTime)}
            </Badge>
          </motion.div>
        )}

        {/* Success Indicator */}
        {showStatus && state === "success" && transcript && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
          >
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Check className="h-3 w-3 mr-1" />
              Transcribed
            </Badge>
          </motion.div>
        )}

        {/* Error Message */}
        {showStatus && state === "error" && error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              Error
            </Badge>
          </motion.div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ============================================
// VOICE INPUT WRAPPER - For Text Areas/Inputs
// ============================================

interface VoiceInputWrapperProps {
  children: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  context?: "medical" | "general" | "lab" | "consultation" | "notes";
  position?: "inside" | "outside";
  size?: "sm" | "md" | "lg";
}

export function VoiceInputWrapper({
  children,
  value,
  onChange,
  context = "medical",
  position = "inside",
  size = "md",
}: VoiceInputWrapperProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleTranscript = (text: string) => {
    setLocalValue(text);
    onChange(text);
  };

  if (position === "outside") {
    return (
      <div className="flex items-start gap-2">
        <div className="flex-1">{children}</div>
        <VoiceInputButton
          onTranscript={handleTranscript}
          currentValue={localValue}
          onAppend={handleTranscript}
          context={context}
          size={size}
        />
      </div>
    );
  }

  // Clone child and add voice button inside
  return (
    <div className="relative">
      {children}
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <VoiceInputButton
          onTranscript={handleTranscript}
          currentValue={localValue}
          onAppend={handleTranscript}
          context={context}
          size="sm"
          variant="ghost"
          className="bg-white/80 hover:bg-white"
        />
      </div>
    </div>
  );
}

// ============================================
// FLOATING VOICE INPUT - Always visible
// ============================================

interface FloatingVoiceInputProps {
  onTranscript: (text: string, targetId?: string) => void;
  activeTargetId?: string;
}

export function FloatingVoiceInput({ onTranscript, activeTargetId }: FloatingVoiceInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [state, setState] = useState<RecordingState>("idle");

  return (
    <motion.div
      className="fixed bottom-20 right-4 z-50"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <Card className="bg-white shadow-lg border-slate-200">
        <CardContent className="p-3">
          <VoiceInputButton
            onTranscript={(text) => onTranscript(text, activeTargetId)}
            context="medical"
            size="lg"
            showStatus={false}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// EXPORTS
// ============================================

export default VoiceInputButton;

// Import Card and CardContent for FloatingVoiceInput
import { Card, CardContent } from "@/components/ui/card";

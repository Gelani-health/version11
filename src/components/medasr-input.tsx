"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { 
  Mic, 
  Square, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw,
  Volume2,
  History,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/**
 * MedASRInput - World-Class Medical Voice Input Component
 * 
 * Features:
 * - Real-time audio level visualization
 * - Primary: z-ai-web-dev-sdk ASR (cloud)
 * - Fallback 1: MedASR Python service (local)
 * - Fallback 2: Web Speech API (browser)
 * - Medical term auto-correction
 * - Rerecord capability
 * - Recording history
 * 
 * @version 2.0.0
 */

// Recording states
type RecordingState = "idle" | "recording" | "processing" | "success" | "error";

interface MedASRInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  multiline?: boolean;
  context?: string; // Medical context hint
  showTranscript?: boolean;
  appendMode?: boolean; // Append to existing text
  showHistory?: boolean; // Show recording history
  onTranscriptionStart?: () => void;
  onTranscriptionEnd?: (transcript: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

export function MedASRInput({
  value,
  onChange,
  placeholder = "Click microphone to start recording...",
  className = "",
  disabled = false,
  multiline = false,
  context = "general",
  showTranscript = true,
  appendMode = false,
  showHistory = false,
  onTranscriptionStart,
  onTranscriptionEnd,
  onError,
  language = "en",
}: MedASRInputProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [engine, setEngine] = useState<string>("");
  const [medicalTerms, setMedicalTerms] = useState<string[]>([]);
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [recordingHistory, setRecordingHistory] = useState<string[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Monitor audio levels
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

  // Process audio with unified ASR API
  const processAudio = useCallback(async (audioBlob: Blob, isRerecord: boolean = false) => {
    const startTime = Date.now();
    
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        
        try {
          // Call unified ASR API
          const response = await fetch('/api/asr', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio_base64: base64Audio,
              sample_rate: 16000,
              language,
              context,
              enable_medical_postprocess: true,
            }),
          });

          const data = await response.json();

          if (response.ok && data.transcription) {
            const processingTimeMs = Date.now() - startTime;
            setProcessingTime(processingTimeMs);
            setEngine(data.engine || 'z-ai-asr');
            
            // Get transcription
            const transcription = data.transcription || "";
            setTranscript(transcription);
            setMedicalTerms(data.medical_terms_detected || []);
            
            // Store for rerecord
            if (!isRerecord) {
              setLastAudioBlob(audioBlob);
            }
            
            // Update value
            if (appendMode && value) {
              onChange(value + " " + transcription);
            } else {
              onChange(transcription);
            }
            
            setRecordingState("success");
            onTranscriptionEnd?.(transcription);
            
            // Add to history
            if (!isRerecord && transcription) {
              setRecordingHistory(prev => [...prev.slice(-4), transcription]);
            }
            
            // Reset to idle after 2 seconds
            setTimeout(() => {
              setRecordingState("idle");
            }, 2000);
            
            // Show detected medical terms
            if (data.medical_terms_detected?.length > 0) {
              toast({
                title: "Medical Terms Detected",
                description: `Found ${data.medical_terms_detected.length} medical term(s): ${data.medical_terms_detected.slice(0, 3).join(", ")}${data.medical_terms_detected.length > 3 ? '...' : ''}`,
              });
            }
            
          } else {
            // API returned empty transcription - use Web Speech API fallback
            console.log("ASR API returned empty, falling back to Web Speech API");
            await processWithWebSpeechAPI(isRerecord);
          }
          
        } catch (err) {
          // Network error - fallback to Web Speech API
          console.log("ASR API unavailable, using Web Speech API fallback:", err);
          await processWithWebSpeechAPI(isRerecord);
        }
      };
      
      reader.readAsDataURL(audioBlob);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Processing failed";
      setError(errorMessage);
      setRecordingState("error");
      onError?.(errorMessage);
      
      toast({
        title: "Processing Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [context, language, appendMode, value, onChange, onTranscriptionEnd, onError, toast]);

  // Fallback to Web Speech API
  const processWithWebSpeechAPI = useCallback(async (isRerecord: boolean = false) => {
    const SpeechRecognition = (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition; SpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition || 
                              (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser");
      setRecordingState("error");
      toast({
        title: "Not Supported",
        description: "Speech recognition is not available. Please use Chrome, Edge, or Safari.",
        variant: "destructive",
      });
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === "en" ? "en-US" : language;
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcription = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      
      setTranscript(transcription);
      setEngine('web-speech-api');
      setProcessingTime(0);
      setMedicalTerms([]);
      
      if (appendMode && value) {
        onChange(value + " " + transcription);
      } else {
        onChange(transcription);
      }
      
      // Store for rerecord
      if (!isRerecord) {
        setRecordingHistory(prev => [...prev.slice(-4), transcription]);
      }
      
      setRecordingState("success");
      onTranscriptionEnd?.(transcription);
      
      setTimeout(() => setRecordingState("idle"), 2000);
      
      toast({
        title: "Transcription Complete",
        description: `Confidence: ${Math.round(confidence * 100)}% (Web Speech API)`,
      });
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(event.error);
      setRecordingState("error");
      onError?.(event.error);
      
      toast({
        title: "Recognition Error",
        description: `Speech recognition error: ${event.error}`,
        variant: "destructive",
      });
    };
    
    recognition.start();
    setRecordingState("processing");
  }, [language, appendMode, value, onChange, onTranscriptionEnd, onError, toast]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript("");
      setMedicalTerms([]);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        } 
      });
      
      streamRef.current = stream;
      startAudioMonitoring(stream);
      
      // Determine the best supported MIME type
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/wav"
      ];
      
      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      
      if (!selectedMimeType) {
        throw new Error("No supported audio format found");
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        stopAudioMonitoring();
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Process audio
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        await processAudio(audioBlob);
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setRecordingState("recording");
      onTranscriptionStart?.();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to access microphone";
      setError(errorMessage);
      setRecordingState("error");
      onError?.(errorMessage);
      
      toast({
        title: "Microphone Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [startAudioMonitoring, stopAudioMonitoring, processAudio, onTranscriptionStart, onError, toast]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
      setRecordingState("processing");
    }
  }, [recordingState]);

  // Rerecord - reprocess last audio
  const rerecord = useCallback(async () => {
    if (lastAudioBlob) {
      setRecordingState("processing");
      await processAudio(lastAudioBlob, true);
    } else {
      toast({
        title: "No Previous Recording",
        description: "Start a new recording first",
        variant: "destructive",
      });
    }
  }, [lastAudioBlob, processAudio, toast]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (disabled) return;
    
    if (recordingState === "recording") {
      stopRecording();
    } else if (recordingState === "idle" || recordingState === "error" || recordingState === "success") {
      startRecording();
    }
  }, [disabled, recordingState, startRecording, stopRecording]);

  // Get button icon
  const getButtonIcon = () => {
    switch (recordingState) {
      case "recording":
        return <Square className="h-4 w-4" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Mic className="h-4 w-4" />;
    }
  };

  // Get button color based on state
  const getButtonClass = () => {
    switch (recordingState) {
      case "recording":
        return "bg-red-500 hover:bg-red-600 text-white animate-pulse";
      case "processing":
        return "bg-amber-500 hover:bg-amber-600 text-white";
      case "success":
        return "bg-green-500 hover:bg-green-600 text-white";
      case "error":
        return "bg-red-100 hover:bg-red-200 text-red-600";
      default:
        return "bg-emerald-500 hover:bg-emerald-600 text-white";
    }
  };

  return (
    <div className={cn("relative", className)} suppressHydrationWarning>
      {/* Input area */}
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "flex-1 min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              recordingState === "recording" && "ring-2 ring-red-500 animate-pulse"
            )}
            suppressHydrationWarning
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "flex-1 h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              recordingState === "recording" && "ring-2 ring-red-500"
            )}
            suppressHydrationWarning
          />
        )}
        
        {/* Voice button group */}
        <div className="flex flex-col gap-1">
          {/* Main voice button */}
          <Button
            type="button"
            variant="default"
            size="icon"
            onClick={toggleRecording}
            disabled={disabled || recordingState === "processing"}
            className={cn("shrink-0", getButtonClass())}
            title={recordingState === "recording" ? "Stop recording" : "Start recording"}
            suppressHydrationWarning
          >
            {getButtonIcon()}
          </Button>
          
          {/* Rerecord button */}
          {lastAudioBlob && recordingState === "idle" && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={rerecord}
              disabled={disabled}
              className="shrink-0 h-8 w-8"
              title="Rerecord last audio"
              suppressHydrationWarning
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          
          {/* History button */}
          {showHistory && recordingHistory.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              className="shrink-0 h-8 w-8"
              title="View recording history"
              suppressHydrationWarning
            >
              <History className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Audio level indicator */}
      <AnimatePresence>
        {recordingState === "recording" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                  animate={{ width: `${audioLevel * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <span className="text-xs text-slate-500 w-12 text-right">
                {Math.round(audioLevel * 100)}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 animate-pulse">
              Recording... Click again to stop
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Status message */}
      <AnimatePresence>
        {(recordingState === "processing" || error) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              "mt-2 text-xs flex items-center gap-1",
              recordingState === "processing" && "text-amber-600",
              error && "text-red-600"
            )}
          >
            {recordingState === "processing" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Processing audio...
              </>
            )}
            {error && (
              <>
                <AlertCircle className="h-3 w-3" />
                Error: {error}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Success info */}
      <AnimatePresence>
        {recordingState === "success" && processingTime > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 text-xs text-green-600 flex items-center gap-2"
          >
            <Volume2 className="h-3 w-3" />
            Transcribed in {processingTime}ms {engine && `(${engine})`}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Medical terms detected */}
      <AnimatePresence>
        {medicalTerms.length > 0 && recordingState === "success" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 text-xs text-blue-600"
          >
            <span className="font-medium">Medical terms:</span>{" "}
            {medicalTerms.join(", ")}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Recording history panel */}
      <AnimatePresence>
        {showHistoryPanel && recordingHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 p-2 bg-slate-50 rounded-md border text-xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-slate-700">Recent Recordings</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowHistoryPanel(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <ul className="space-y-1">
              {recordingHistory.map((item, index) => (
                <li
                  key={index}
                  className="p-1 bg-white rounded cursor-pointer hover:bg-slate-100 truncate"
                  onClick={() => {
                    onChange(item);
                    setShowHistoryPanel(false);
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Medical terms hint */}
      <div className="text-xs text-slate-400 text-center mt-2">
        Medical terms will be auto-detected and corrected
      </div>
    </div>
  );
}

// Voice input wrapper for existing inputs
interface VoiceInputWrapperProps {
  children: React.ReactNode;
  onVoiceInput: (text: string) => void;
  context?: string;
  disabled?: boolean;
  appendMode?: boolean;
  currentValue?: string;
  language?: string;
}

export function VoiceInputWrapper({
  children,
  onVoiceInput,
  context = "general",
  disabled = false,
  appendMode = false,
  currentValue = "",
  language = "en",
}: VoiceInputWrapperProps) {
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  
  return (
    <div className="relative" suppressHydrationWarning>
      {children}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
        onClick={() => setShowVoiceInput(!showVoiceInput)}
        disabled={disabled}
        title="Voice input"
        suppressHydrationWarning
      >
        <Mic className="h-4 w-4 text-slate-400 hover:text-emerald-500" />
      </Button>
      
      {showVoiceInput && (
        <div className="mt-2" suppressHydrationWarning>
          <MedASRInput
            value={currentValue}
            onChange={onVoiceInput}
            context={context}
            appendMode={appendMode}
            multiline
            language={language}
          />
        </div>
      )}
    </div>
  );
}

export default MedASRInput;

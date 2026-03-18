"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Square, Loader2, AlertCircle, CheckCircle2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Recording states
type RecordingState = "idle" | "recording" | "processing" | "success" | "error";

interface MedASRInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  multiline?: boolean;
  context?: string; // Medical context hint (e.g., "soap-subjective", "chief-complaint")
  showTranscript?: boolean;
  appendMode?: boolean; // Append to existing text instead of replacing
  onTranscriptionStart?: () => void;
  onTranscriptionEnd?: (transcript: string) => void;
  onError?: (error: string) => void;
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
  onTranscriptionStart,
  onTranscriptionEnd,
  onError,
}: MedASRInputProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [engine, setEngine] = useState<string>("");
  
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

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript("");
      
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
  }, [startAudioMonitoring, stopAudioMonitoring, onTranscriptionStart, onError, toast]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
      setRecordingState("processing");
    }
  }, [recordingState]);

  // Process audio with ASR API (primary) or Web Speech API (fallback)
  const processAudio = useCallback(async (audioBlob: Blob) => {
    const startTime = Date.now();
    
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        
        try {
          // Primary: Call MedASR service (port 3033)
          const response = await fetch('/api/medasr/transcribe', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio_base64: base64Audio,
              sample_rate: 16000,
              language: "en",
              context: context,
              enable_medical_postprocess: true,
            }),
          });

          const data = await response.json();

          if (response.ok && data.transcription) {
            const processingTimeMs = Date.now() - startTime;
            setProcessingTime(processingTimeMs);
            setEngine('medasr');
            
            // Get transcription
            const transcription = data.transcription || "";
            setTranscript(transcription);
            
            // Update value
            if (appendMode && value) {
              onChange(value + " " + transcription);
            } else {
              onChange(transcription);
            }
            
            setRecordingState("success");
            onTranscriptionEnd?.(transcription);
            
            // Reset to idle after 2 seconds
            setTimeout(() => {
              setRecordingState("idle");
            }, 2000);
            
            // Show detected medical terms
            if (data.medical_terms_detected?.length > 0) {
              toast({
                title: "Medical Terms Detected",
                description: `Found ${data.medical_terms_detected.length} medical term(s)`,
              });
            }
            
          } else {
            // API returned error or empty transcription
            console.log("ASR API returned empty or error, falling back to Web Speech API");
            await processWithWebSpeechAPI();
          }
          
        } catch (err) {
          // Network error - fallback to Web Speech API
          console.log("ASR API unavailable, using Web Speech API fallback:", err);
          await processWithWebSpeechAPI();
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
  }, [context, appendMode, value, onChange, onTranscriptionEnd, onError, toast]);

  // Fallback to Web Speech API
  const processWithWebSpeechAPI = useCallback(async () => {
    // Check browser support
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
    recognition.lang = "en-US";
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcription = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      
      setTranscript(transcription);
      setEngine('web-speech-api');
      setProcessingTime(0);
      
      if (appendMode && value) {
        onChange(value + " " + transcription);
      } else {
        onChange(transcription);
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
  }, [appendMode, value, onChange, onTranscriptionEnd, onError, toast]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (disabled) return;
    
    if (recordingState === "recording") {
      stopRecording();
    } else if (recordingState === "idle" || recordingState === "error") {
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
    <div className={cn("relative", className)}>
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
              recordingState === "recording" && "ring-2 ring-red-500"
            )}
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
          />
        )}
        
        {/* Voice button */}
        <Button
          type="button"
          variant="default"
          size="icon"
          onClick={toggleRecording}
          disabled={disabled || recordingState === "processing"}
          className={cn("shrink-0", getButtonClass())}
          title={recordingState === "recording" ? "Stop recording" : "Start recording"}
        >
          {getButtonIcon()}
        </Button>
      </div>
      
      {/* Audio level indicator */}
      {recordingState === "recording" && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 w-12 text-right">
            {Math.round(audioLevel * 100)}%
          </span>
        </div>
      )}
      
      {/* Status message */}
      {(recordingState === "processing" || error) && (
        <div className={cn(
          "mt-2 text-xs flex items-center gap-1",
          recordingState === "processing" && "text-amber-600",
          error && "text-red-600"
        )}>
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
        </div>
      )}
      
      {/* Success info */}
      {recordingState === "success" && processingTime > 0 && (
        <div className="mt-1 text-xs text-green-600 flex items-center gap-2">
          <Volume2 className="h-3 w-3" />
          Transcribed in {processingTime}ms {engine && `(${engine})`}
        </div>
      )}
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
}

export function VoiceInputWrapper({
  children,
  onVoiceInput,
  context = "general",
  disabled = false,
  appendMode = false,
  currentValue = "",
}: VoiceInputWrapperProps) {
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  
  return (
    <div className="relative">
      {children}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
        onClick={() => setShowVoiceInput(!showVoiceInput)}
        disabled={disabled}
      >
        <Mic className="h-4 w-4 text-slate-400 hover:text-emerald-500" />
      </Button>
      
      {showVoiceInput && (
        <div className="mt-2">
          <MedASRInput
            value={currentValue}
            onChange={onVoiceInput}
            context={context}
            appendMode={appendMode}
            multiline
          />
        </div>
      )}
    </div>
  );
}

export default MedASRInput;

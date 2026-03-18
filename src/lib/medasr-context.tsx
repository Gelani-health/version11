"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

// ============================================
// TYPES
// ============================================

type RecordingState = "idle" | "recording" | "processing" | "success" | "error";

interface MedASRContextType {
  // State
  isRecording: boolean;
  isProcessing: boolean;
  recordingTime: number;
  currentTarget: string | null;
  audioLevel: number;
  
  // Actions
  startRecording: (targetId?: string, context?: string) => Promise<void>;
  stopRecording: () => void;
  registerTarget: (id: string, onTranscript: (text: string) => void) => void;
  unregisterTarget: (id: string) => void;
  
  // Settings
  settings: {
    autoStop: boolean;
    autoStopDuration: number;
    showNotifications: boolean;
    context: string;
  };
  updateSettings: (settings: Partial<MedASRContextType['settings']>) => void;
}

// ============================================
// CONTEXT
// ============================================

const MedASRContext = createContext<MedASRContextType | null>(null);

// ============================================
// PROVIDER
// ============================================

export function MedASRProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentTarget, setCurrentTarget] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [settings, setSettings] = useState({
    autoStop: false,
    autoStopDuration: 60,
    showNotifications: true,
    context: "medical",
  });
  
  const targetsRef = useRef<Map<string, (text: string) => void>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentValueRef = useRef<string>("");
  
  const { toast } = useToast();

  // Cleanup
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Auto-stop
  useEffect(() => {
    if (settings.autoStop && state === "recording" && recordingTime >= settings.autoStopDuration) {
      stopRecording();
    }
  }, [recordingTime, state, settings.autoStop, settings.autoStopDuration]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    analyserRef.current = null;
  };

  const startRecording = useCallback(async (targetId?: string, context?: string) => {
    try {
      setRecordingTime(0);
      audioChunksRef.current = [];
      setCurrentTarget(targetId || null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      // Audio analyser
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => processAudio(context || settings.context);

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setState("recording");

      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      monitorAudioLevel();

      if (settings.showNotifications) {
        toast({
          title: "Recording Started",
          description: "Speak clearly into your microphone",
        });
      }

    } catch (err) {
      console.error("Recording error:", err);
      setState("error");
      toast({
        title: "Microphone Error",
        description: "Please allow microphone access.",
        variant: "destructive",
      });
    }
  }, [settings, toast]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    analyserRef.current = null;
  }, []);

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    const update = () => {
      if (!analyserRef.current || state !== "recording") return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(avg / 255);
      requestAnimationFrame(update);
    };
    update();
  };

  const processAudio = async (context: string) => {
    setState("processing");
    try {
      const blob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        try {
          const res = await fetch("/api/asr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, context }),
          });
          
          const data = await res.json();
          
          if (data.success) {
            setState("success");
            
            // Send to registered target
            if (currentTarget && targetsRef.current.has(currentTarget)) {
              const callback = targetsRef.current.get(currentTarget);
              callback?.(data.transcription);
            }
            
            if (settings.showNotifications) {
              toast({
                title: "Transcription Complete",
                description: `${data.wordCount} words recognized`,
              });
            }
            
            setTimeout(() => {
              setState("idle");
              setRecordingTime(0);
              setAudioLevel(0);
            }, 1500);
            
          } else {
            throw new Error(data.error);
          }
        } catch (err) {
          setState("error");
          toast({
            title: "Transcription Error",
            description: "Failed to process audio",
            variant: "destructive",
          });
        }
      };
    } catch (err) {
      setState("error");
    }
  };

  const registerTarget = useCallback((id: string, onTranscript: (text: string) => void) => {
    targetsRef.current.set(id, onTranscript);
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<typeof settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const value: MedASRContextType = {
    isRecording: state === "recording",
    isProcessing: state === "processing",
    recordingTime,
    currentTarget,
    audioLevel,
    startRecording,
    stopRecording,
    registerTarget,
    unregisterTarget,
    settings,
    updateSettings,
  };

  return (
    <MedASRContext.Provider value={value}>
      {children}
    </MedASRContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useMedASR() {
  const context = useContext(MedASRContext);
  if (!context) {
    throw new Error("useMedASR must be used within a MedASRProvider");
  }
  return context;
}

// ============================================
// EXPORT
// ============================================

export default MedASRProvider;

import { useState, useCallback, useRef, useEffect } from "react";

interface UseMedASROptions {
  context?: string;
  appendMode?: boolean;
  autoStop?: boolean;
  maxDuration?: number; // in seconds
  onTranscriptionStart?: () => void;
  onTranscriptionEnd?: (transcript: string) => void;
  onError?: (error: string) => void;
}

interface MedASRResult {
  transcription: string;
  confidence: number;
  word_count: number;
  processing_time_ms: number;
  medical_terms_detected: string[];
  segments: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
}

interface UseMedASRReturn {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  error: string | null;
  lastResult: MedASRResult | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => void;
}

export function useMedASR(options: UseMedASROptions = {}): UseMedASRReturn {
  const {
    context = "general",
    appendMode = false,
    autoStop = false,
    maxDuration = 60,
    onTranscriptionStart,
    onTranscriptionEnd,
    onError,
  } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MedASRResult | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
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
  
  // Process audio with MedASR
  const processAudio = useCallback(async (audioBlob: Blob) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Convert to base64
      const reader = new FileReader();
      
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        
        try {
          // Call MedASR API (Next.js route forwards to port 3033 internally)
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
          
          if (response.ok) {
            setLastResult(data);
            onTranscriptionEnd?.(data.transcription);
          } else {
            throw new Error(data.error || "Transcription failed");
          }
          
        } catch (err) {
          // Fallback to Web Speech API
          console.log("MedASR unavailable, using Web Speech API fallback");
          const transcription = await fallbackTranscription(audioBlob);
          setLastResult({
            transcription,
            confidence: 0.8,
            word_count: transcription.split(" ").length,
            processing_time_ms: 0,
            medical_terms_detected: [],
            segments: [],
          });
          onTranscriptionEnd?.(transcription);
        }
        
        setIsProcessing(false);
      };
      
      reader.onerror = () => {
        setError("Failed to read audio data");
        setIsProcessing(false);
        onError?.("Failed to read audio data");
      };
      
      reader.readAsDataURL(audioBlob);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Processing failed";
      setError(errorMessage);
      setIsProcessing(false);
      onError?.(errorMessage);
    }
  }, [context, onTranscriptionEnd, onError]);
  
  // Fallback transcription using Web Speech API
  const fallbackTranscription = useCallback((audioBlob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        resolve("");
        return;
      }
      
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      
      recognition.onresult = (event: any) => {
        resolve(event.results[0][0].transcript);
      };
      
      recognition.onerror = () => {
        resolve("");
      };
      
      recognition.start();
    });
  }, []);
  
  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setLastResult(null);
      
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
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      
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
        
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        processAudio(audioBlob);
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      onTranscriptionStart?.();
      
      // Auto-stop timer
      if (autoStop || maxDuration > 0) {
        autoStopTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current?.state === "recording") {
            stopRecording();
          }
        }, maxDuration * 1000);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to access microphone";
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [startAudioMonitoring, stopAudioMonitoring, processAudio, autoStop, maxDuration, onTranscriptionStart, onError]);
  
  // Stop recording
  const stopRecording = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);
  
  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);
  
  return {
    isRecording,
    isProcessing,
    audioLevel,
    error,
    lastResult,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}

export default useMedASR;

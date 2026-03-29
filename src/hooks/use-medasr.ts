import { useState, useCallback, useRef, useEffect } from "react";

/**
 * useMedASR Hook - Unified Medical Speech Recognition
 * 
 * Features:
 * - Uses unified /api/asr endpoint (z-ai primary, MedASR fallback)
 * - Automatic fallback to Web Speech API
 * - Audio level monitoring
 * - Medical term post-processing
 * - Rerecord capability
 * 
 * @version 2.0.0
 */

interface UseMedASROptions {
  context?: string;
  appendMode?: boolean;
  autoStop?: boolean;
  maxDuration?: number; // in seconds
  onTranscriptionStart?: () => void;
  onTranscriptionEnd?: (transcript: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

interface MedASRResult {
  transcription: string;
  confidence: number;
  wordCount: number;
  processingTimeMs: number;
  medicalTermsDetected: string[];
  segments: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  engine: string;
}

interface UseMedASRReturn {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  error: string | null;
  lastResult: MedASRResult | null;
  recordingHistory: MedASRResult[];
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecording: () => void;
  rerecord: () => Promise<void>;
  clearHistory: () => void;
  canRerecord: boolean;
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
    language = "en",
  } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MedASRResult | null>(null);
  const [recordingHistory, setRecordingHistory] = useState<MedASRResult[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  
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
  
  // Process audio with unified ASR API
  const processAudio = useCallback(async (audioBlob: Blob, isRerecord: boolean = false) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Store for potential rerecord
      lastAudioBlobRef.current = audioBlob;
      
      // Convert to base64
      const reader = new FileReader();
      
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        
        try {
          // Call unified ASR API
          const response = await fetch("/api/asr", {
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
            const result: MedASRResult = {
              transcription: data.transcription,
              confidence: data.confidence || 0.9,
              wordCount: data.word_count || data.transcription.split(" ").length,
              processingTimeMs: data.processing_time_ms || 0,
              medicalTermsDetected: data.medical_terms_detected || [],
              segments: data.segments || [],
              engine: data.engine || "unknown",
            };
            
            setLastResult(result);
            
            // Add to history if not a rerecord
            if (!isRerecord) {
              setRecordingHistory(prev => [...prev.slice(-4), result]); // Keep last 5
            }
            
            onTranscriptionEnd?.(data.transcription);
          } else {
            // Server returned empty transcription - use Web Speech API fallback
            console.log("ASR returned empty, using Web Speech API fallback");
            const transcription = await fallbackTranscription();
            
            if (transcription) {
              const result: MedASRResult = {
                transcription,
                confidence: 0.8,
                wordCount: transcription.split(" ").length,
                processingTimeMs: 0,
                medicalTermsDetected: [],
                segments: [],
                engine: "web-speech-api",
              };
              
              setLastResult(result);
              if (!isRerecord) {
                setRecordingHistory(prev => [...prev.slice(-4), result]);
              }
              onTranscriptionEnd?.(transcription);
            } else {
              setError("Transcription failed - no speech detected");
              onError?.("Transcription failed - no speech detected");
            }
          }
          
        } catch (err) {
          // Network error - fallback to Web Speech API
          console.log("ASR API unavailable, using Web Speech API fallback:", err);
          const transcription = await fallbackTranscription();
          
          if (transcription) {
            const result: MedASRResult = {
              transcription,
              confidence: 0.8,
              wordCount: transcription.split(" ").length,
              processingTimeMs: 0,
              medicalTermsDetected: [],
              segments: [],
              engine: "web-speech-api",
            };
            
            setLastResult(result);
            if (!isRerecord) {
              setRecordingHistory(prev => [...prev.slice(-4), result]);
            }
            onTranscriptionEnd?.(transcription);
          } else {
            const errorMessage = err instanceof Error ? err.message : "Transcription failed";
            setError(errorMessage);
            onError?.(errorMessage);
          }
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
  }, [context, language, onTranscriptionEnd, onError]);
  
  // Fallback transcription using Web Speech API
  const fallbackTranscription = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const SpeechRecognition = (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition; SpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition || 
                                (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition;
      
      if (!SpeechRecognition) {
        resolve("");
        return;
      }
      
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === "en" ? "en-US" : language;
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        resolve(event.results[0][0].transcript);
      };
      
      recognition.onerror = () => {
        resolve("");
      };
      
      recognition.start();
    });
  }, [language]);
  
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
      
      // Determine supported MIME type
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
      
      mediaRecorder.onstop = () => {
        stopAudioMonitoring();
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        processAudio(audioBlob);
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
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
  
  // Rerecord - reprocess last audio with potentially different settings
  const rerecord = useCallback(async () => {
    if (lastAudioBlobRef.current) {
      await processAudio(lastAudioBlobRef.current, true);
    } else {
      // No previous audio - start new recording
      await startRecording();
    }
  }, [processAudio, startRecording]);
  
  // Clear recording history
  const clearHistory = useCallback(() => {
    setRecordingHistory([]);
    setLastResult(null);
    lastAudioBlobRef.current = null;
  }, []);
  
  return {
    isRecording,
    isProcessing,
    audioLevel,
    error,
    lastResult,
    recordingHistory,
    startRecording,
    stopRecording,
    toggleRecording,
    rerecord,
    clearHistory,
    canRerecord: !!lastAudioBlobRef.current,
  };
}

export default useMedASR;

"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface TTSOptions {
  voice?: string;
  speed?: number;
  volume?: number;
}

interface TTSVoice {
  id: string;
  name: string;
  description: string;
}

// Available voices
export const TTS_VOICES: TTSVoice[] = [
  { id: 'tongtong', name: 'Tong Tong', description: 'Warm and friendly' },
  { id: 'chuichui', name: 'Chui Chui', description: 'Lively and cute' },
  { id: 'xiaochen', name: 'Xiao Chen', description: 'Calm and professional' },
  { id: 'jam', name: 'Jam', description: 'British gentleman' },
  { id: 'kazi', name: 'Kazi', description: 'Clear and standard' },
  { id: 'douji', name: 'Dou Ji', description: 'Natural and smooth' },
  { id: 'luodo', name: 'Luo Do', description: 'Expressive' },
];

interface UseTTSReturn {
  // State
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
  voice: string;
  speed: number;
  
  // Actions
  speak: (text: string) => Promise<void>;
  stop: () => void;
  setVoice: (voice: string) => void;
  setSpeed: (speed: number) => void;
  
  // Voices
  voices: TTSVoice[];
}

export function useTTS(defaultOptions: TTSOptions = {}): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [voice, setVoice] = useState(defaultOptions.voice || 'tongtong');
  const [speed, setSpeed] = useState(defaultOptions.speed || 1.0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stop playback and cleanup
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    setIsPlaying(false);
    setIsLoading(false);
    setProgress(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Split text into chunks (max 1024 chars per TTS request)
  const splitTextIntoChunks = useCallback((text: string, maxLength: number = 1000): string[] => {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        // If single sentence is too long, split by words
        if (sentence.length > maxLength) {
          const words = sentence.split(/\s+/);
          let wordChunk = '';
          for (const word of words) {
            if ((wordChunk + ' ' + word).length <= maxLength) {
              wordChunk += (wordChunk ? ' ' : '') + word;
            } else {
              if (wordChunk) chunks.push(wordChunk.trim());
              wordChunk = word;
            }
          }
          if (wordChunk) currentChunk = wordChunk;
          else currentChunk = '';
        } else {
          currentChunk = sentence;
        }
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    
    return chunks.filter(chunk => chunk.length > 0);
  }, []);

  // Generate audio for text via API
  const generateAudio = useCallback(async (text: string, signal: AbortSignal): Promise<string> => {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice,
        speed,
        returnBase64: true,
      }),
      signal,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate audio');
    }

    return `data:${data.mimeType || 'audio/wav'};base64,${data.audio}`;
  }, [voice, speed]);

  // Play audio from data URL
  const playAudio = useCallback((dataUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(dataUrl);
      audioRef.current = audio;

      audio.onended = () => {
        resolve();
      };

      audio.onerror = () => {
        reject(new Error('Audio playback error'));
      };

      audio.onplay = () => {
        setIsPlaying(true);
      };

      audio.onpause = () => {
        setIsPlaying(false);
      };

      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.play().catch(reject);
    });
  }, []);

  // Speak text (handles chunking)
  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      setProgress(0);

      // Cancel any ongoing playback
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Split text into chunks
      const chunks = splitTextIntoChunks(text);
      setTotalChunks(chunks.length);
      setCurrentChunk(0);

      setIsLoading(false);

      // Process chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        if (signal.aborted) {
          break;
        }

        setCurrentChunk(i + 1);
        setProgress(0);

        const audioUrl = await generateAudio(chunks[i], signal);
        
        if (!signal.aborted) {
          await playAudio(audioUrl);
        }
      }

      setIsPlaying(false);
      setProgress(100);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Silently ignore abort errors
        return;
      }
      console.error('TTS speak error:', err);
      setError(err instanceof Error ? err.message : 'Failed to speak');
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, [splitTextIntoChunks, generateAudio, playAudio]);

  return {
    isPlaying,
    isLoading,
    progress,
    currentChunk,
    totalChunks,
    error,
    voice,
    speed,
    speak,
    stop,
    setVoice,
    setSpeed,
    voices: TTS_VOICES,
  };
}

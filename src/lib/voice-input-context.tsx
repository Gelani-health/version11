"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";

// ============================================
// TYPES
// ============================================

interface TranscriptionResult {
  transcription: string;
  confidence: number;
  wordCount: number;
  processingTimeMs: number;
  medicalTermsDetected: string[];
  engine: string;
}

interface VoiceInputContextType {
  // Active target tracking
  activeTargetId: string | null;
  setActiveTargetId: (id: string | null) => void;
  
  // Last transcription
  lastTranscription: TranscriptionResult | null;
  setLastTranscription: (result: TranscriptionResult | null) => void;
  
  // Recording history
  recordingHistory: TranscriptionResult[];
  addToHistory: (result: TranscriptionResult) => void;
  clearHistory: () => void;
  
  // Global voice input state
  isGlobalRecording: boolean;
  setIsGlobalRecording: (recording: boolean) => void;
  
  // Voice input enabled state
  isVoiceEnabled: boolean;
  setVoiceEnabled: (enabled: boolean) => void;
  
  // Preferred language
  language: string;
  setLanguage: (lang: string) => void;
  
  // Insert text into active target
  insertIntoActiveTarget: (text: string) => void;
  
  // Register/unregister targets
  registerTarget: (id: string, onInsert: (text: string) => void) => void;
  unregisterTarget: (id: string) => void;
}

// ============================================
// CONTEXT
// ============================================

const VoiceInputContext = createContext<VoiceInputContextType | null>(null);

// ============================================
// PROVIDER
// ============================================

export function VoiceInputProvider({ children }: { children: React.ReactNode }) {
  // State
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [lastTranscription, setLastTranscription] = useState<TranscriptionResult | null>(null);
  const [recordingHistory, setRecordingHistory] = useState<TranscriptionResult[]>([]);
  const [isGlobalRecording, setIsGlobalRecording] = useState(false);
  const [isVoiceEnabled, setVoiceEnabled] = useState(true);
  const [language, setLanguage] = useState("en-US");
  
  // Target registry (using ref to avoid re-renders)
  const targetRegistryRef = useRef<Map<string, (text: string) => void>>(new Map());
  
  // Add to history
  const addToHistory = useCallback((result: TranscriptionResult) => {
    setRecordingHistory(prev => [result, ...prev.slice(0, 19)]); // Keep last 20
  }, []);
  
  // Clear history
  const clearHistory = useCallback(() => {
    setRecordingHistory([]);
  }, []);
  
  // Register target
  const registerTarget = useCallback((id: string, onInsert: (text: string) => void) => {
    targetRegistryRef.current.set(id, onInsert);
  }, []);
  
  // Unregister target
  const unregisterTarget = useCallback((id: string) => {
    targetRegistryRef.current.delete(id);
  }, []);
  
  // Insert into active target
  const insertIntoActiveTarget = useCallback((text: string) => {
    if (activeTargetId && targetRegistryRef.current.has(activeTargetId)) {
      const callback = targetRegistryRef.current.get(activeTargetId);
      callback?.(text);
    }
  }, [activeTargetId]);
  
  const value: VoiceInputContextType = {
    activeTargetId,
    setActiveTargetId,
    lastTranscription,
    setLastTranscription,
    recordingHistory,
    addToHistory,
    clearHistory,
    isGlobalRecording,
    setIsGlobalRecording,
    isVoiceEnabled,
    setVoiceEnabled,
    language,
    setLanguage,
    insertIntoActiveTarget,
    registerTarget,
    unregisterTarget,
  };
  
  return (
    <VoiceInputContext.Provider value={value}>
      {children}
    </VoiceInputContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useVoiceInput() {
  const context = useContext(VoiceInputContext);
  if (!context) {
    throw new Error("useVoiceInput must be used within a VoiceInputProvider");
  }
  return context;
}

// ============================================
// HOOK FOR TARGET REGISTRATION
// ============================================

export function useVoiceInputTarget(
  id: string,
  onInsert: (text: string) => void
) {
  const { 
    registerTarget, 
    unregisterTarget, 
    setActiveTargetId,
    activeTargetId 
  } = useVoiceInput();
  
  // Register on mount, unregister on unmount
  React.useEffect(() => {
    registerTarget(id, onInsert);
    return () => unregisterTarget(id);
  }, [id, onInsert, registerTarget, unregisterTarget]);
  
  const onFocus = React.useCallback(() => {
    setActiveTargetId(id);
  }, [id, setActiveTargetId]);
  
  const onBlur = React.useCallback(() => {
    // Don't clear active target immediately - allow time for voice input
    setTimeout(() => {
      setActiveTargetId(null);
    }, 100);
  }, [setActiveTargetId]);
  
  const isActive = activeTargetId === id;
  
  return { onFocus, onBlur, isActive };
}

export default VoiceInputProvider;

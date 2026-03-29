"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Square, Loader2, X, Copy, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MedASRInput } from "./medasr-input";

interface FloatingVoiceInputProps {
  onInsert?: (text: string) => void;
  defaultContext?: string;
  position?: "bottom-right" | "bottom-left" | "bottom-center";
}

export function FloatingVoiceInput({
  onInsert,
  defaultContext = "general",
  position = "bottom-right",
}: FloatingVoiceInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [copied, setCopied] = useState(false);
  
  const { toast } = useToast();
  
  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2",
  };
  
  const handleCopy = useCallback(() => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied",
        description: "Transcript copied to clipboard",
      });
    }
  }, [transcript, toast]);
  
  const handleInsert = useCallback(() => {
    if (transcript && onInsert) {
      onInsert(transcript);
      setTranscript("");
      setIsOpen(false);
      
      toast({
        title: "Inserted",
        description: "Transcript inserted into active field",
      });
    }
  }, [transcript, onInsert, toast]);
  
  const handleClear = useCallback(() => {
    setTranscript("");
  }, []);
  
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  
  return (
    <>
      {/* Floating button */}
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
            title="Voice Input"
          >
            <Mic className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Expanded panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed z-50 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden",
              positionClasses[position]
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
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
            <div className="p-4 space-y-4">
              {/* Voice input */}
              <MedASRInput
                value={transcript}
                onChange={setTranscript}
                context={defaultContext}
                multiline
                placeholder="Click microphone to start recording..."
              />
              
              {/* Word count */}
              {wordCount > 0 && (
                <div className="text-xs text-slate-500 text-right">
                  {wordCount} word{wordCount !== 1 ? "s" : ""}
                </div>
              )}
              
              {/* Actions */}
              {transcript && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="flex-1"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copy
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  
                  {onInsert && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleInsert}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                    >
                      Insert
                    </Button>
                  )}
                </div>
              )}
              
              {/* Medical terms hint */}
              <div className="text-xs text-slate-400 text-center">
                Medical terms will be auto-detected and corrected
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingVoiceInput;

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Stethoscope, Activity, FileText, Syringe, Heart, Brain, Beaker, Building2, AlertCircle } from "lucide-react";
import { searchMedicalTerms, type MedicalTerm } from "@/lib/medical-dictionary";
import { cn } from "@/lib/utils";
import { VoiceInputButton } from "@/components/voice-input-button";

// Category icons and colors
const categoryConfig: Record<string, { icon: React.ElementType; color: string }> = {
  "Vitals": { icon: Activity, color: "text-red-500" },
  "Prescription": { icon: Pill, color: "text-blue-500" },
  "Clinical": { icon: Stethoscope, color: "text-emerald-500" },
  "Symptoms": { icon: AlertCircle, color: "text-orange-500" },
  "OB/GYN": { icon: Heart, color: "text-pink-500" },
  "Cardiovascular": { icon: Heart, color: "text-red-500" },
  "Antihypertensive": { icon: Heart, color: "text-red-500" },
  "Antidiabetic": { icon: Pill, color: "text-blue-500" },
  "Antibiotic": { icon: Pill, color: "text-purple-500" },
  "Analgesic": { icon: Pill, color: "text-amber-500" },
  "Endocrine": { icon: Brain, color: "text-teal-500" },
  "Respiratory": { icon: Activity, color: "text-cyan-500" },
  "Psychiatric": { icon: Brain, color: "text-indigo-500" },
  "GI": { icon: Building2, color: "text-yellow-500" },
  "Renal": { icon: Building2, color: "text-slate-500" },
  "Labs": { icon: Beaker, color: "text-green-500" },
  "Diagnostics": { icon: Activity, color: "text-violet-500" },
  "Clinical Note": { icon: FileText, color: "text-slate-600" },
  "Clinical Phrase": { icon: FileText, color: "text-slate-500" },
  "SOAP": { icon: FileText, color: "text-emerald-500" },
  "IV Fluids": { icon: Syringe, color: "text-blue-400" },
  "default": { icon: Pill, color: "text-slate-400" },
};

interface MedicalAutocompleteTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minChars?: number;
  maxSuggestions?: number;
  rows?: number;
  label?: string;
  labelClassName?: string;
  enableVoiceInput?: boolean;
  voiceContext?: "medical" | "general" | "consultation" | "notes";
}

export function MedicalAutocompleteTextarea({
  value,
  onChange,
  onBlur,
  placeholder = "Start typing...",
  className = "",
  disabled = false,
  minChars = 2,
  maxSuggestions = 8,
  rows = 3,
  label,
  labelClassName,
  enableVoiceInput = true,
  voiceContext = "medical",
}: MedicalAutocompleteTextareaProps) {
  const [suggestions, setSuggestions] = useState<MedicalTerm[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get current word being typed
  const getCurrentWord = useCallback((text: string, cursorPos: number) => {
    const beforeCursor = text.substring(0, cursorPos);
    const words = beforeCursor.split(/\s+/);
    return words[words.length - 1] || "";
  }, []);

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newText);
    setCursorPosition(cursorPos);
    
    const word = getCurrentWord(newText, cursorPos);
    
    if (word.length >= minChars) {
      const results = searchMedicalTerms(word, maxSuggestions);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle cursor position change
  const handleCursorChange = () => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart || 0;
      setCursorPosition(cursorPos);
      
      const word = getCurrentWord(value, cursorPos);
      
      if (word.length >= minChars) {
        const results = searchMedicalTerms(word, maxSuggestions);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } else {
        setShowSuggestions(false);
      }
    }
  };

  // Insert selected suggestion
  const insertSuggestion = (term: MedicalTerm) => {
    if (!textareaRef.current) return;
    
    const cursorPos = cursorPosition;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);
    
    // Find the start of the current word
    const lastSpaceIndex = beforeCursor.lastIndexOf(" ");
    const beforeWord = beforeCursor.substring(0, lastSpaceIndex + 1);
    
    // Insert the term with a space
    const newValue = beforeWord + term.term + " " + afterCursor;
    onChange(newValue);
    
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    
    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeWord.length + term.term.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case "Tab":
          if (selectedIndex >= 0) {
            e.preventDefault();
            insertSuggestion(suggestions[selectedIndex]);
          }
          break;
        case "Enter":
          if (selectedIndex >= 0) {
            e.preventDefault();
            insertSuggestion(suggestions[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
      }
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getCategoryIcon = (category: string) => {
    return categoryConfig[category] || categoryConfig.default;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className={cn("text-sm font-medium block mb-1", labelClassName)}>
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onClick={handleCursorChange}
          onKeyUp={handleCursorChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          disabled={disabled}
          rows={rows}
        />
        
        {/* Voice Input Button */}
        {enableVoiceInput && (
          <div className="absolute right-2 top-2">
            <VoiceInputButton
              onTranscript={(text) => {
                const newValue = value ? `${value} ${text}` : text;
                onChange(newValue);
              }}
              currentValue={value}
              context={voiceContext}
              size="sm"
              variant="ghost"
              className="bg-white/80 hover:bg-white h-7 w-7"
            />
          </div>
        )}
        
        {/* Autocomplete indicator - moved down if voice is enabled */}
        {!enableVoiceInput && (
          <div className="absolute right-2 top-2 pointer-events-none">
            <Activity className={cn(
              "h-3.5 w-3.5 transition-opacity",
              showSuggestions ? "text-emerald-500 animate-pulse" : "text-slate-300"
            )} />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            ref={suggestionsRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-[280px] overflow-y-auto"
          >
            <div className="p-1">
              {suggestions.map((term, index) => {
                const config = getCategoryIcon(term.category);
                const Icon = config.icon;
                const isSelected = index === selectedIndex;
                
                return (
                  <div
                    key={`${term.term}-${term.category}`}
                    onClick={() => insertSuggestion(term)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                      isSelected 
                        ? "bg-emerald-50 border border-emerald-200" 
                        : "hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "p-1.5 rounded-md shrink-0",
                      isSelected ? "bg-emerald-100" : "bg-slate-100"
                    )}>
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "font-medium text-sm",
                          isSelected ? "text-emerald-700" : "text-slate-800"
                        )}>
                          {term.term}
                        </span>
                        {term.icdCode && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                            {term.icdCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {term.category}
                        </span>
                        {term.description && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs text-slate-500 truncate">
                              {term.description}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Footer hint */}
            <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50 rounded-b-lg">
              <p className="text-[10px] text-slate-400 flex items-center gap-2">
                <span>↑↓ Navigate</span>
                <span>•</span>
                <span>Tab/Enter = Select</span>
                <span>•</span>
                <span>Esc = Close</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

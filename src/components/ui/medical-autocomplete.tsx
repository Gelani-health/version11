"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Stethoscope, Activity, FileText, Syringe, Heart, Brain, Beaker, Building2, AlertCircle } from "lucide-react";
import { searchMedicalTerms, type MedicalTerm } from "@/lib/medical-dictionary";
import { cn } from "@/lib/utils";

interface MedicalAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minChars?: number;
  maxSuggestions?: number;
  textarea?: boolean;
  rows?: number;
}

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

export function MedicalAutocomplete({
  value,
  onChange,
  onKeyDown,
  placeholder = "Type to search medical terms...",
  className = "",
  disabled = false,
  minChars = 2,
  maxSuggestions = 8,
  textarea = false,
  rows = 4,
}: MedicalAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<MedicalTerm[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentWord, setCurrentWord] = useState("");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get current word being typed
  const getCurrentWord = useCallback((text: string, cursorPos: number) => {
    const beforeCursor = text.substring(0, cursorPos);
    const words = beforeCursor.split(/\s+/);
    return words[words.length - 1] || "";
  }, []);

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newText);
    setCursorPosition(cursorPos);
    
    const word = getCurrentWord(newText, cursorPos);
    setCurrentWord(word);
    
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
    if (inputRef.current) {
      const cursorPos = inputRef.current.selectionStart || 0;
      setCursorPosition(cursorPos);
      
      const word = getCurrentWord(value, cursorPos);
      setCurrentWord(word);
      
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
    if (!inputRef.current) return;
    
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
    
    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = beforeWord.length + term.term.length + 1;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        case "Enter":
          if (selectedIndex >= 0) {
            e.preventDefault();
            insertSuggestion(suggestions[selectedIndex]);
          } else {
            setShowSuggestions(false);
            onKeyDown?.(e);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
        default:
          onKeyDown?.(e);
      }
    } else {
      onKeyDown?.(e);
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

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const getCategoryIcon = (category: string) => {
    return categoryConfig[category] || categoryConfig.default;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {textarea ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onClick={handleCursorChange}
          onKeyUp={handleCursorChange}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          disabled={disabled}
          rows={rows}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onClick={handleCursorChange}
          onKeyUp={handleCursorChange}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          disabled={disabled}
        />
      )}

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            ref={suggestionsRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-[300px] overflow-y-auto"
          >
            <div className="p-1">
              {suggestions.map((term, index) => {
                const config = getCategoryIcon(term.category);
                const Icon = config.icon;
                const isSelected = index === selectedIndex;
                
                return (
                  <motion.div
                    key={`${term.term}-${term.category}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => insertSuggestion(term)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                      isSelected 
                        ? "bg-emerald-50 border border-emerald-200" 
                        : "hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "p-1.5 rounded-md",
                      isSelected ? "bg-emerald-100" : "bg-slate-100"
                    )}>
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
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
                        <span className="text-xs text-slate-400">
                          {term.category}
                        </span>
                      </div>
                      {term.description && (
                        <p className="text-xs text-slate-500 truncate">
                          {term.description}
                        </p>
                      )}
                    </div>
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400">
                      {index === 0 ? "Tab" : `${index + 1}`}
                    </kbd>
                  </motion.div>
                );
              })}
            </div>
            
            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 rounded-b-lg">
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>↑↓ Navigate</span>
                <span>•</span>
                <span>Tab/Enter Select</span>
                <span>•</span>
                <span>Esc Close</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Typing indicator */}
      {currentWord.length >= minChars && !showSuggestions && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Activity className="h-3 w-3 animate-pulse" />
            <span>typing...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Higher-order component for easy integration
export function withMedicalAutocomplete<T extends { value: string; onChange: (value: string) => void }>(
  WrappedComponent: React.ComponentType<T>
) {
  return function MedicalAutocompleteWrapper(props: T & { enableAutocomplete?: boolean }) {
    const { enableAutocomplete = true, ...rest } = props;
    
    if (!enableAutocomplete) {
      return <WrappedComponent {...(rest as T)} />;
    }
    
    return (
      <MedicalAutocomplete
        value={props.value}
        onChange={props.onChange}
      />
    );
  };
}

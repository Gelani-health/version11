"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  Check,
  X,
  Plus,
  Info,
  ChevronRight,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { debounce } from "lodash";

// ============================================
// TYPES
// ============================================

export interface ICDCode {
  id: string;
  code: string;
  description: string;
  category?: string;
  chapter?: string;
  isICD11?: boolean;
}

interface ICDCodeSearchProps {
  value?: ICDCode | null;
  onSelect: (code: ICDCode) => void;
  placeholder?: string;
  disabled?: boolean;
  showCategory?: boolean;
  recentCodes?: ICDCode[];
  onRecentCodesChange?: (codes: ICDCode[]) => void;
}

// ============================================
// COMMON ICD-10 CODES (Fallback)
// ============================================

const commonICDCodes: ICDCode[] = [
  // Respiratory
  { id: "1", code: "J06.9", description: "Acute upper respiratory infection, unspecified", category: "Respiratory" },
  { id: "2", code: "J18.9", description: "Pneumonia, unspecified organism", category: "Respiratory" },
  { id: "3", code: "J45.909", description: "Unspecified asthma, uncomplicated", category: "Respiratory" },
  { id: "4", code: "J20.9", description: "Acute bronchitis, unspecified", category: "Respiratory" },
  { id: "5", code: "J40", description: "Bronchitis, not specified as acute or chronic", category: "Respiratory" },
  { id: "6", code: "R05", description: "Cough", category: "Respiratory" },
  
  // Cardiovascular
  { id: "7", code: "I10", description: "Essential (primary) hypertension", category: "Cardiovascular" },
  { id: "8", code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery", category: "Cardiovascular" },
  { id: "9", code: "I50.9", description: "Heart failure, unspecified", category: "Cardiovascular" },
  { id: "10", code: "I48.91", description: "Unspecified atrial fibrillation", category: "Cardiovascular" },
  { id: "11", code: "I35.0", description: "Nonrheumatic aortic (valve) stenosis", category: "Cardiovascular" },
  
  // Endocrine
  { id: "12", code: "E11.9", description: "Type 2 diabetes mellitus without complications", category: "Endocrine" },
  { id: "13", code: "E10.9", description: "Type 1 diabetes mellitus without complications", category: "Endocrine" },
  { id: "14", code: "E78.5", description: "Hyperlipidemia, unspecified", category: "Endocrine" },
  { id: "15", code: "E03.9", description: "Hypothyroidism, unspecified", category: "Endocrine" },
  { id: "16", code: "E05.90", description: "Thyrotoxicosis, unspecified", category: "Endocrine" },
  
  // Gastrointestinal
  { id: "17", code: "K29.70", description: "Gastritis, unspecified, without bleeding", category: "GI" },
  { id: "18", code: "K21.0", description: "Gastro-esophageal reflux disease with esophagitis", category: "GI" },
  { id: "19", code: "K52.9", description: "Noninfective gastroenteritis and colitis, unspecified", category: "GI" },
  { id: "20", code: "K76.0", description: "Fatty (change of) liver, not elsewhere classified", category: "GI" },
  { id: "21", code: "K59.00", description: "Constipation, unspecified", category: "GI" },
  { id: "22", code: "A09", description: "Infectious gastroenteritis and colitis, unspecified", category: "GI" },
  
  // Musculoskeletal
  { id: "23", code: "M54.5", description: "Low back pain", category: "Musculoskeletal" },
  { id: "24", code: "M79.3", description: "Panniculitis, unspecified", category: "Musculoskeletal" },
  { id: "25", code: "M25.561", description: "Pain in right knee", category: "Musculoskeletal" },
  { id: "26", code: "M25.562", description: "Pain in left knee", category: "Musculoskeletal" },
  { id: "27", code: "M54.2", description: "Cervicalgia", category: "Musculoskeletal" },
  { id: "28", code: "M54.9", description: "Dorsalgia, unspecified", category: "Musculoskeletal" },
  
  // Neurological
  { id: "29", code: "R51", description: "Headache", category: "Neurological" },
  { id: "30", code: "G43.909", description: "Migraine, unspecified, not intractable", category: "Neurological" },
  { id: "31", code: "G47.00", description: "Insomnia, unspecified", category: "Neurological" },
  { id: "32", code: "R42", description: "Dizziness and giddiness", category: "Neurological" },
  { id: "33", code: "G40.909", description: "Epilepsy, unspecified, not intractable", category: "Neurological" },
  
  // Psychiatric
  { id: "34", code: "F32.9", description: "Major depressive disorder, unspecified", category: "Psychiatric" },
  { id: "35", code: "F41.9", description: "Anxiety disorder, unspecified", category: "Psychiatric" },
  { id: "36", code: "F32.0", description: "Major depressive disorder, single episode, mild", category: "Psychiatric" },
  { id: "37", code: "F32.1", description: "Major depressive disorder, single episode, moderate", category: "Psychiatric" },
  { id: "38", code: "F41.1", description: "Generalized anxiety disorder", category: "Psychiatric" },
  
  // Genitourinary
  { id: "39", code: "N39.0", description: "Urinary tract infection, site not specified", category: "GU" },
  { id: "40", code: "N40.0", description: "Benign prostatic hyperplasia without lower urinary tract symptoms", category: "GU" },
  { id: "41", code: "N20.0", description: "Calculus of kidney", category: "GU" },
  
  // Skin
  { id: "42", code: "L30.9", description: "Dermatitis, unspecified", category: "Skin" },
  { id: "43", code: "L70.0", description: "Acne vulgaris", category: "Skin" },
  { id: "44", code: "L20.9", description: "Atopic dermatitis, unspecified", category: "Skin" },
  
  // Infectious
  { id: "45", code: "A09", description: "Infectious gastroenteritis and colitis, unspecified", category: "Infectious" },
  { id: "46", code: "B00.9", description: "Herpesviral infection, unspecified", category: "Infectious" },
  { id: "47", code: "B34.9", description: "Viral infection, unspecified", category: "Infectious" },
  
  // General Symptoms
  { id: "48", code: "R50.9", description: "Fever, unspecified", category: "Symptoms" },
  { id: "49", code: "R53", description: "Malaise and fatigue", category: "Symptoms" },
  { id: "50", code: "R63.4", description: "Abnormal weight loss", category: "Symptoms" },
  
  // Injury
  { id: "51", code: "S06.0X0A", description: "Concussion without loss of consciousness, initial encounter", category: "Injury" },
  { id: "52", code: "S83.511A", description: "Sprain of cruciate ligament of right knee, initial encounter", category: "Injury" },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function ICDCodeSearch({
  value,
  onSelect,
  placeholder = "Search ICD-10 code or diagnosis...",
  disabled = false,
  showCategory = true,
  recentCodes = [],
  onRecentCodesChange,
}: ICDCodeSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<ICDCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get unique categories
  const categories = [...new Set(commonICDCodes.map(c => c.category))].filter(Boolean);

  // Search function
  const searchCodes = useCallback(
    debounce(async (term: string) => {
      if (!term.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      
      try {
        // Try API first
        const response = await fetch(`/api/icd-codes?search=${encodeURIComponent(term)}&limit=20`);
        const data = await response.json();
        
        if (data.success && data.data?.codes?.length > 0) {
          setResults(data.data.codes);
        } else {
          // Fallback to local search
          const filtered = commonICDCodes.filter(
            c =>
              c.code.toLowerCase().includes(term.toLowerCase()) ||
              c.description.toLowerCase().includes(term.toLowerCase())
          );
          setResults(filtered.slice(0, 20));
        }
      } catch (error) {
        // Fallback to local search
        const filtered = commonICDCodes.filter(
          c =>
            c.code.toLowerCase().includes(term.toLowerCase()) ||
            c.description.toLowerCase().includes(term.toLowerCase())
        );
        setResults(filtered.slice(0, 20));
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (searchTerm) {
      searchCodes(searchTerm);
    } else {
      setResults([]);
    }
  }, [searchTerm, searchCodes]);

  const handleSelect = (code: ICDCode) => {
    onSelect(code);
    setOpen(false);
    setSearchTerm("");
    
    // Add to recent codes
    if (onRecentCodesChange) {
      const newRecent = [code, ...recentCodes.filter(c => c.code !== code.code)].slice(0, 10);
      onRecentCodesChange(newRecent);
    }
  };

  const filteredResults = selectedCategory
    ? results.filter(c => c.category === selectedCategory)
    : results;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {value ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {value.code}
              </Badge>
              <span className="truncate text-sm">
                {value.description}
              </span>
            </div>
          ) : (
            <span>{placeholder}</span>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Type to search ICD codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          
          {/* Category Filters */}
          {showCategory && (
            <div className="flex flex-wrap gap-1 mt-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                className="h-6 text-xs"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.slice(0, 6).map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setSelectedCategory(cat || null)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          )}
        </div>
        
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="p-2">
              {/* Recent Codes */}
              {!searchTerm && recentCodes.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                    Recent
                  </div>
                  <div className="space-y-1">
                    {recentCodes.slice(0, 5).map((code) => (
                      <div
                        key={code.id}
                        className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSelect(code)}
                      >
                        <Badge variant="outline" className="font-mono text-xs">
                          {code.code}
                        </Badge>
                        <span className="text-sm truncate flex-1">
                          {code.description}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Search Results */}
              {searchTerm && filteredResults.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No codes found</p>
                  <p className="text-xs">Try a different search term</p>
                </div>
              )}
              
              {filteredResults.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                    {searchTerm ? "Results" : "Common Codes"}
                  </div>
                  {filteredResults.map((code) => (
                    <div
                      key={code.id}
                      className="flex items-start gap-2 p-2 rounded-md cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSelect(code)}
                    >
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "font-mono text-xs mt-0.5",
                          value?.code === code.code && "bg-green-100 text-green-700 border-green-300"
                        )}
                      >
                        {code.code}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">
                          {code.description}
                        </div>
                        {showCategory && code.category && (
                          <div className="text-xs text-muted-foreground">
                            {code.category}
                          </div>
                        )}
                      </div>
                      {value?.code === code.code && (
                        <Check className="h-4 w-4 text-green-500 shrink-0 mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Common Codes (when no search) */}
              {!searchTerm && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                    Common Diagnoses
                  </div>
                  {commonICDCodes.slice(0, 10).map((code) => (
                    <div
                      key={code.id}
                      className="flex items-start gap-2 p-2 rounded-md cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSelect(code)}
                    >
                      <Badge variant="outline" className="font-mono text-xs mt-0.5">
                        {code.code}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">
                          {code.description}
                        </div>
                        {showCategory && code.category && (
                          <div className="text-xs text-muted-foreground">
                            {code.category}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t text-xs text-muted-foreground text-center">
          ICD-10-CM codes • Type to search
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// DIAGNOSIS ENTRY COMPONENT
// ============================================

interface DiagnosisEntryProps {
  primaryDiagnosis?: ICDCode | null;
  differentials?: ICDCode[];
  onPrimaryChange: (code: ICDCode | null) => void;
  onDifferentialsChange: (codes: ICDCode[]) => void;
  maxDifferentials?: number;
  disabled?: boolean;
}

export function DiagnosisEntry({
  primaryDiagnosis,
  differentials = [],
  onPrimaryChange,
  onDifferentialsChange,
  maxDifferentials = 5,
  disabled = false,
}: DiagnosisEntryProps) {
  const addDifferential = () => {
    if (differentials.length < maxDifferentials) {
      onDifferentialsChange([...differentials, null as any]);
    }
  };

  const updateDifferential = (index: number, code: ICDCode) => {
    const newDifferentials = [...differentials];
    newDifferentials[index] = code;
    onDifferentialsChange(newDifferentials);
  };

  const removeDifferential = (index: number) => {
    onDifferentialsChange(differentials.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Primary Diagnosis */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-green-700">
          Primary Diagnosis *
        </label>
        <ICDCodeSearch
          value={primaryDiagnosis}
          onSelect={onPrimaryChange}
          placeholder="Search primary diagnosis..."
          disabled={disabled}
        />
        {primaryDiagnosis && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg"
          >
            <Check className="h-4 w-4 text-green-600" />
            <div>
              <div className="font-mono font-bold text-green-700">
                {primaryDiagnosis.code}
              </div>
              <div className="text-sm text-green-800">
                {primaryDiagnosis.description}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Differential Diagnoses */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            Differential Diagnoses (Optional)
          </label>
          {differentials.length < maxDifferentials && !disabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={addDifferential}
              className="h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {differentials.map((diff, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <ICDCodeSearch
                  value={diff}
                  onSelect={(code) => updateDifferential(index, code)}
                  placeholder={`Differential #${index + 1}...`}
                  disabled={disabled}
                  showCategory={false}
                />
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDifferential(index)}
                  className="h-10"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {differentials.length === 0 && (
            <div className="text-sm text-muted-foreground italic">
              No differential diagnoses recorded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ICDCodeSearch;

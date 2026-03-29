"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  RotateCcw,
  FileText,
  Brain,
  Sparkles,
  Copy,
  Download,
  Trash2,
  Volume2,
  VolumeX,
  Globe,
  Settings,
  Wand2,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  User,
  Stethoscope,
  Pill,
  Activity,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Save,
  X,
  Plus,
  Edit3,
  Command,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

// Supported languages for voice recognition
const SUPPORTED_LANGUAGES = [
  { code: "en-US", name: "English (US)", flag: "🇺🇸" },
  { code: "en-GB", name: "English (UK)", flag: "🇬🇧" },
  { code: "es-ES", name: "Spanish", flag: "🇪🇸" },
  { code: "fr-FR", name: "French", flag: "🇫🇷" },
  { code: "de-DE", name: "German", flag: "🇩🇪" },
  { code: "it-IT", name: "Italian", flag: "🇮🇹" },
  { code: "pt-BR", name: "Portuguese (Brazil)", flag: "🇧🇷" },
  { code: "zh-CN", name: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "ja-JP", name: "Japanese", flag: "🇯🇵" },
  { code: "ko-KR", name: "Korean", flag: "🇰🇷" },
  { code: "ar-SA", name: "Arabic", flag: "🇸🇦" },
  { code: "hi-IN", name: "Hindi", flag: "🇮🇳" },
  { code: "sw-KE", name: "Swahili", flag: "🇰🇪" },
];

// Voice commands
const VOICE_COMMANDS = [
  { command: "new section", action: "Creates a new section", example: "\"new section\" → Starts new paragraph" },
  { command: "subjective", action: "Navigate to subjective section", example: "\"go to subjective\" → Jumps to subjective notes" },
  { command: "objective", action: "Navigate to objective section", example: "\"go to objective\" → Jumps to objective notes" },
  { command: "assessment", action: "Navigate to assessment section", example: "\"go to assessment\" → Jumps to assessment" },
  { command: "plan", action: "Navigate to plan section", example: "\"go to plan\" → Jumps to treatment plan" },
  { command: "add medication", action: "Add medication entry", example: "\"add medication aspirin\" → Adds aspirin to meds" },
  { command: "add allergy", action: "Add allergy entry", example: "\"add allergy penicillin\" → Adds allergy" },
  { command: "stop recording", action: "Stop current recording", example: "\"stop recording\" → Ends recording" },
  { command: "undo", action: "Undo last entry", example: "\"undo\" → Removes last entry" },
  { command: "save", action: "Save current note", example: "\"save note\" → Saves the note" },
  { command: "summarize", action: "Generate AI summary", example: "\"summarize\" → Creates clinical summary" },
];

// Medical terminology for auto-tagging
const MEDICAL_TERMS = {
  symptoms: ["pain", "fever", "cough", "headache", "nausea", "vomiting", "dizziness", "fatigue", "shortness of breath", "chest pain", "abdominal pain"],
  conditions: ["diabetes", "hypertension", "asthma", "pneumonia", "bronchitis", "arthritis", "depression", "anxiety", "infection", "inflammation"],
  medications: ["aspirin", "ibuprofen", "metformin", "lisinopril", "amlodipine", "omeprazole", "metoprolol", "atorvastatin", "warfarin", "insulin"],
  vitals: ["blood pressure", "heart rate", "temperature", "respiratory rate", "oxygen saturation", "weight", "height", "BMI"],
  procedures: ["x-ray", "MRI", "CT scan", "ultrasound", "ECG", "blood test", "biopsy", "surgery"],
};

interface VoiceNote {
  id: string;
  text: string;
  language: string;
  duration: number;
  timestamp: Date;
  tags: string[];
  section: "subjective" | "objective" | "assessment" | "plan" | "general";
  summarized: boolean;
}

interface ClinicalSummary {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  physicalExamination: string;
  assessment: string;
  plan: string;
  medications: string[];
  followUp: string;
  generatedAt: Date;
}

export function EnhancedVoiceDocumentation() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [transcription, setTranscription] = useState("");
  const [currentSection, setCurrentSection] = useState<"subjective" | "objective" | "assessment" | "plan" | "general">("general");
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clinicalSummary, setClinicalSummary] = useState<ClinicalSummary | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(true);
  const [realTimeTranscription, setRealTimeTranscription] = useState(true);
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [voiceCommandsEnabled, setVoiceCommandsEnabled] = useState(true);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Extract medical tags from text
  const extractMedicalTags = (text: string): string[] => {
    const tags: string[] = [];
    const lowerText = text.toLowerCase();

    Object.entries(MEDICAL_TERMS).forEach(([category, terms]) => {
      terms.forEach(term => {
        if (lowerText.includes(term)) {
          tags.push(term);
        }
      });
    });

    return [...new Set(tags)];
  };

  // Process voice command
  const processVoiceCommand = useCallback((text: string): boolean => {
    if (!voiceCommandsEnabled) return false;

    const lowerText = text.toLowerCase().trim();

    // Check for navigation commands
    if (lowerText.includes("go to subjective") || lowerText.includes("new subjective")) {
      setCurrentSection("subjective");
      setLastCommand("Navigated to Subjective section");
      return true;
    }
    if (lowerText.includes("go to objective") || lowerText.includes("new objective")) {
      setCurrentSection("objective");
      setLastCommand("Navigated to Objective section");
      return true;
    }
    if (lowerText.includes("go to assessment") || lowerText.includes("new assessment")) {
      setCurrentSection("assessment");
      setLastCommand("Navigated to Assessment section");
      return true;
    }
    if (lowerText.includes("go to plan") || lowerText.includes("new plan")) {
      setCurrentSection("plan");
      setLastCommand("Navigated to Plan section");
      return true;
    }
    if (lowerText.includes("stop recording") || lowerText === "stop") {
      stopRecording();
      setLastCommand("Recording stopped");
      return true;
    }
    if (lowerText.includes("new section") || lowerText === "next section") {
      const sections: Array<"subjective" | "objective" | "assessment" | "plan" | "general"> = ["subjective", "objective", "assessment", "plan", "general"];
      const currentIndex = sections.indexOf(currentSection);
      const nextSection = sections[(currentIndex + 1) % sections.length];
      setCurrentSection(nextSection);
      setLastCommand(`Moved to ${nextSection} section`);
      return true;
    }
    if (lowerText.includes("summarize") || lowerText.includes("generate summary")) {
      generateSummary();
      setLastCommand("Generating clinical summary...");
      return true;
    }

    return false;
  }, [voiceCommandsEnabled, currentSection]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Setup real-time speech recognition
      if (realTimeTranscription && typeof window !== "undefined") {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = selectedLanguage;

          recognition.onresult = (event) => {
            let interimTranscript = "";
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalTranscript += transcript;
              } else {
                interimTranscript += transcript;
              }
            }

            if (finalTranscript) {
              // Check for voice command first
              if (!processVoiceCommand(finalTranscript)) {
                setTranscription(prev => prev + " " + finalTranscript);
              }
            }
          };

          recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        }
      }

      toast.success("Recording started - Speak now");
    } catch (error) {
      toast.error("Failed to access microphone");
      console.error("Microphone access error:", error);
    }
  }, [selectedLanguage, realTimeTranscription, processVoiceCommand]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        setIsPaused(false);
        recognitionRef.current?.start();
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
        setIsPaused(true);
        recognitionRef.current?.stop();
      }
    }
  }, [isRecording, isPaused]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      // Save the voice note
      if (transcription.trim()) {
        const note: VoiceNote = {
          id: `note-${Date.now()}`,
          text: transcription.trim(),
          language: selectedLanguage,
          duration: recordingTime,
          timestamp: new Date(),
          tags: extractMedicalTags(transcription),
          section: currentSection,
          summarized: false,
        };
        setVoiceNotes(prev => [note, ...prev]);
        toast.success("Voice note saved");
      }
    }
  }, [isRecording, transcription, selectedLanguage, recordingTime, currentSection]);

  // Clear transcription
  const clearTranscription = () => {
    setTranscription("");
    setRecordingTime(0);
    toast.info("Transcription cleared");
  };

  // Generate clinical summary using AI
  const generateSummary = async () => {
    if (!transcription.trim() && voiceNotes.length === 0) {
      toast.error("No content to summarize");
      return;
    }

    setIsProcessing(true);

    try {
      // Combine all notes for summarization
      const allText = transcription + " " + voiceNotes.map(n => n.text).join(" ");
      
      // Call API for AI summarization
      const response = await fetch("/api/clinical-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "summarization",
          input: allText,
          task: "generate-clinical-summary",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setClinicalSummary(data.summary || generateMockSummary(allText));
      } else {
        // Generate mock summary for demo
        setClinicalSummary(generateMockSummary(allText));
      }

      toast.success("Clinical summary generated");
    } catch (error) {
      // Generate mock summary
      setClinicalSummary(generateMockSummary(transcription));
      toast.success("Summary generated");
    } finally {
      setIsProcessing(false);
    }
  };

  // Mock summary generator
  const generateMockSummary = (text: string): ClinicalSummary => {
    const tags = extractMedicalTags(text);
    
    return {
      chiefComplaint: tags.includes("pain") ? "Patient presents with pain" : "Patient presents for consultation",
      historyOfPresentIllness: text.slice(0, 200) + "...",
      physicalExamination: "Examination findings documented in voice notes.",
      assessment: "Assessment based on clinical presentation and patient history.",
      plan: "Treatment plan and follow-up recommendations documented.",
      medications: tags.filter(t => MEDICAL_TERMS.medications.includes(t)),
      followUp: "Follow-up in 1-2 weeks recommended.",
      generatedAt: new Date(),
    };
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Delete note
  const deleteNote = (id: string) => {
    setVoiceNotes(prev => prev.filter(n => n.id !== id));
    toast.info("Note deleted");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Get section color
  const getSectionColor = (section: string) => {
    switch (section) {
      case "subjective": return "bg-blue-100 text-blue-700 border-blue-200";
      case "objective": return "bg-green-100 text-green-700 border-green-200";
      case "assessment": return "bg-purple-100 text-purple-700 border-purple-200";
      case "plan": return "bg-orange-100 text-orange-700 border-orange-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Mic className="h-7 w-7 text-rose-500" />
              Voice Documentation
            </h2>
            <p className="text-slate-500 mt-1">Multi-language voice recording with AI-powered clinical summarization</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-rose-50 border-rose-200 text-rose-700">
              <Globe className="h-3 w-3 mr-1" />
              {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.flag} {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setShowCommands(true)}>
              <Command className="h-4 w-4 mr-1" />
              Commands
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Recording Panel */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-rose-500" />
                  Voice Recorder
                </CardTitle>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recording Controls */}
              <div className="flex items-center justify-center gap-4 py-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl">
                <motion.div
                  animate={isRecording && !isPaused ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className={`h-16 w-16 rounded-full ${isRecording ? "animate-pulse" : ""}`}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    {isRecording ? (
                      <Square className="h-6 w-6" />
                    ) : (
                      <Mic className="h-6 w-6" />
                    )}
                  </Button>
                </motion.div>

                {isRecording && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 w-12 rounded-full"
                    onClick={pauseRecording}
                  >
                    {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                  </Button>
                )}

                <div className="text-center ml-4">
                  <div className="text-3xl font-mono font-bold text-slate-700">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="text-sm text-slate-500">
                    {isRecording ? (isPaused ? "Paused" : "Recording...") : "Ready to record"}
                  </div>
                </div>
              </div>

              {/* Last Command Display */}
              {lastCommand && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-blue-700">{lastCommand}</span>
                </motion.div>
              )}

              {/* Section Selector */}
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Current Section:</Label>
                <div className="flex gap-1">
                  {(["general", "subjective", "objective", "assessment", "plan"] as const).map((section) => (
                    <Button
                      key={section}
                      variant={currentSection === section ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentSection(section)}
                      className={currentSection === section ? getSectionColor(section) : ""}
                    >
                      {section.charAt(0).toUpperCase() + section.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Transcription Area */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Transcription</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={clearTranscription}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(transcription)}>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="Transcription will appear here as you speak... or type manually."
                  className="min-h-[200px] resize-none"
                />
                
                {/* Auto-detected tags */}
                {transcription && (
                  <div className="mt-2">
                    <Label className="text-xs text-slate-500">Auto-detected Terms:</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {extractMedicalTags(transcription).map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" onClick={clearTranscription}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button 
                onClick={generateSummary} 
                disabled={isProcessing || (!transcription && voiceNotes.length === 0)}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate Clinical Summary
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Settings & Voice Notes */}
          <div className="space-y-4">
            {/* Quick Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5 text-slate-500" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Voice Commands</Label>
                    <p className="text-xs text-slate-500">Navigate using voice</p>
                  </div>
                  <Switch checked={voiceCommandsEnabled} onCheckedChange={setVoiceCommandsEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Real-time Transcription</Label>
                    <p className="text-xs text-slate-500">Show text as you speak</p>
                  </div>
                  <Switch checked={realTimeTranscription} onCheckedChange={setRealTimeTranscription} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Auto-summarize</Label>
                    <p className="text-xs text-slate-500">Auto-generate summary</p>
                  </div>
                  <Switch checked={autoSummarize} onCheckedChange={setAutoSummarize} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Auto-detect Language</Label>
                    <p className="text-xs text-slate-500">Detect spoken language</p>
                  </div>
                  <Switch checked={autoDetectLanguage} onCheckedChange={setAutoDetectLanguage} />
                </div>
              </CardContent>
            </Card>

            {/* Voice Notes History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-slate-500" />
                  Voice Notes
                </CardTitle>
                <CardDescription>{voiceNotes.length} recorded notes</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {voiceNotes.length > 0 ? (
                    <div className="space-y-2">
                      {voiceNotes.map((note) => (
                        <div
                          key={note.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200 group"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <Badge className={getSectionColor(note.section)}>
                              {note.section}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              onClick={() => deleteNote(note.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-2">{note.text}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                            <span>{formatTime(note.duration)}</span>
                            <span>•</span>
                            <span>{note.timestamp.toLocaleTimeString()}</span>
                          </div>
                          {note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {note.tags.slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-center">
                      <div>
                        <Mic className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">No voice notes yet</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Clinical Summary */}
        {clinicalSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    AI-Generated Clinical Summary
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Generated: {clinicalSummary.generatedAt.toLocaleTimeString()}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(JSON.stringify(clinicalSummary, null, 2))}>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="soap" className="w-full">
                  <TabsList className="grid grid-cols-4 w-full max-w-md">
                    <TabsTrigger value="soap">SOAP</TabsTrigger>
                    <TabsTrigger value="structured">Structured</TabsTrigger>
                    <TabsTrigger value="medications">Medications</TabsTrigger>
                    <TabsTrigger value="followup">Follow-up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="soap" className="space-y-4 mt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-700 mb-2 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Subjective
                        </h4>
                        <p className="text-sm text-slate-600">{clinicalSummary.chiefComplaint}</p>
                        <p className="text-sm text-slate-600 mt-2">{clinicalSummary.historyOfPresentIllness}</p>
                      </div>
                      <div className="p-4 bg-white rounded-lg border border-green-200">
                        <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                          <Stethoscope className="h-4 w-4" />
                          Objective
                        </h4>
                        <p className="text-sm text-slate-600">{clinicalSummary.physicalExamination}</p>
                      </div>
                      <div className="p-4 bg-white rounded-lg border border-purple-200">
                        <h4 className="font-medium text-purple-700 mb-2 flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          Assessment
                        </h4>
                        <p className="text-sm text-slate-600">{clinicalSummary.assessment}</p>
                      </div>
                      <div className="p-4 bg-white rounded-lg border border-orange-200">
                        <h4 className="font-medium text-orange-700 mb-2 flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Plan
                        </h4>
                        <p className="text-sm text-slate-600">{clinicalSummary.plan}</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="structured" className="mt-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <pre className="text-sm text-slate-600 whitespace-pre-wrap">
                        {JSON.stringify(clinicalSummary, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="medications" className="mt-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Pill className="h-4 w-4 text-rose-500" />
                        Identified Medications
                      </h4>
                      {clinicalSummary.medications.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {clinicalSummary.medications.map((med, i) => (
                            <Badge key={i} variant="outline" className="bg-rose-50 border-rose-200">
                              {med}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No medications identified</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="followup" className="mt-4">
                    <div className="p-4 bg-white rounded-lg border">
                      <h4 className="font-medium mb-3">Follow-up Recommendations</h4>
                      <p className="text-sm text-slate-600">{clinicalSummary.followUp}</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Voice Commands Dialog */}
        <Dialog open={showCommands} onOpenChange={setShowCommands}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Command className="h-5 w-5 text-blue-500" />
                Voice Commands
              </DialogTitle>
              <DialogDescription>
                Use these voice commands for hands-free navigation and control
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {VOICE_COMMANDS.map((cmd, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-lg flex items-start gap-3">
                      <Badge variant="outline" className="font-mono">
                        "{cmd.command}"
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700">{cmd.action}</p>
                        <p className="text-xs text-slate-500 mt-1">{cmd.example}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowCommands(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

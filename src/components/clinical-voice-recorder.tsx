"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Square,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Save,
  Trash2,
  Tag,
  Clock,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface VoiceNote {
  id: string;
  transcription: string;
  tags: string;
  audioDuration?: number | null;
  noteType: string;
  status: string;
  recordedAt: string;
}

interface ClinicalVoiceRecorderProps {
  patientId?: string;
  consultationId?: string;
  noteType?: "soap-subjective" | "soap-objective" | "soap-assessment" | "soap-plan" | "general";
  onTranscriptionComplete?: (transcription: string, tags: string[]) => void;
  onTranscriptionChange?: (text: string) => void;
  existingText?: string;
  placeholder?: string;
  compact?: boolean;
}

export function ClinicalVoiceRecorder({
  patientId,
  consultationId,
  noteType = "general",
  onTranscriptionComplete,
  onTranscriptionChange,
  existingText = "",
  placeholder = "Click the microphone to start recording your clinical note...",
  compact = false,
}: ClinicalVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState(existingText);
  const [tags, setTags] = useState<string[]>([]);
  const [savedNotes, setSavedNotes] = useState<VoiceNote[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimeRef = useRef<number>(0);

  const { toast } = useToast();

  // Fetch saved voice notes on mount
  useEffect(() => {
    if (patientId || consultationId) {
      fetchVoiceNotes();
    }
  }, [patientId, consultationId]);

  // Update transcription when existingText changes
  useEffect(() => {
    if (existingText && existingText !== transcription) {
      setTranscription(existingText);
    }
  }, [existingText]);

  const fetchVoiceNotes = async () => {
    try {
      const params = new URLSearchParams();
      if (patientId) params.append("patientId", patientId);
      if (consultationId) params.append("consultationId", consultationId);

      const response = await fetch(`/api/voice-notes?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setSavedNotes(data.data.voiceNotes);
      }
    } catch (error) {
      console.error("Failed to fetch voice notes:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          recordingTimeRef.current = newTime;
          return newTime;
        });
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setError("Microphone access denied. Please allow microphone access to record.");
      toast({
        title: "Microphone Error",
        description: "Please allow microphone access to record voice notes.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Stop all audio tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Convert audio to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      reader.onloadend = async () => {
        const audioBase64 = (reader.result as string).split(",")[1];
        const duration = recordingTimeRef.current;

        try {
          const response = await fetch("/api/voice-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64,
              patientId,
              consultationId,
              noteType,
              audioDuration: duration,
              audioFormat: "webm",
            }),
          });

          const data = await response.json();

          if (data.success) {
            setTranscription((prev) => {
              const newText = prev ? `${prev}\n\n${data.data.transcription}` : data.data.transcription;
              onTranscriptionChange?.(newText);
              return newText;
            });
            setTags(data.data.tags);
            setRecordingTime(0);

            toast({
              title: "Transcription Complete",
              description: "Voice note has been transcribed successfully.",
            });

            onTranscriptionComplete?.(data.data.transcription, data.data.tags);
            fetchVoiceNotes();
          } else {
            setError(data.error || "Transcription failed");
            toast({
              title: "Transcription Failed",
              description: data.error || "Failed to transcribe audio. Please try again.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Failed to process audio:", error);
          setError("Failed to process audio. Please try again.");
          toast({
            title: "Processing Error",
            description: "Failed to process audio. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError("Failed to read audio data");
        setIsProcessing(false);
      };
    } catch (error) {
      console.error("Failed to process audio:", error);
      setError("Failed to process audio");
      setIsProcessing(false);
    }
  };

  const handleTextChange = (text: string) => {
    setTranscription(text);
    onTranscriptionChange?.(text);
  };

  const handleSave = async () => {
    if (!transcription.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/voice-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: savedNotes[0]?.id,
          transcription,
          tags,
          status: "reviewed",
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Saved",
          description: "Clinical note saved successfully.",
        });
        fetchVoiceNotes();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save clinical note.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcription);
    toast({
      title: "Copied",
      description: "Transcription copied to clipboard.",
    });
  };

  const handleClear = () => {
    setTranscription("");
    setTags([]);
    setRecordingTime(0);
    setError(null);
    onTranscriptionChange?.("");
  };

  const loadNote = (note: VoiceNote) => {
    setTranscription(note.transcription);
    try {
      setTags(JSON.parse(note.tags || "[]"));
    } catch {
      setTags([]);
    }
    onTranscriptionChange?.(note.transcription);
    setShowHistory(false);
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`
              relative w-12 h-12 rounded-full flex items-center justify-center
              ${isRecording
                ? "bg-gradient-to-r from-red-500 to-pink-500"
                : "bg-gradient-to-r from-violet-500 to-purple-500"
              }
              shadow-lg transition-all duration-300 disabled:opacity-50
            `}
          >
            {isRecording ? (
              <Square className="h-5 w-5 text-white" />
            ) : (
              <Mic className="h-5 w-5 text-white" />
            )}
            {isRecording && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-red-400"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.button>

          <div className="flex-1">
            {isRecording ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-bold text-red-500">
                  {formatTime(recordingTime)}
                </span>
                <span className="text-sm text-slate-500">Recording...</span>
              </div>
            ) : (
              <span className="text-sm text-slate-500">
                {isProcessing ? "Processing..." : "Click to record"}
              </span>
            )}
          </div>

          {isProcessing && (
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 5).map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs bg-violet-50 border-violet-200 text-violet-700">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {tags.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 5} more
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-violet-500" />
          Record Clinical Note
        </CardTitle>
        <CardDescription>
          Click the microphone to start recording your clinical note
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Controls */}
        <div className="flex flex-col items-center py-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`
              relative w-20 h-20 rounded-full flex items-center justify-center
              ${isRecording
                ? "bg-gradient-to-r from-red-500 to-pink-500"
                : "bg-gradient-to-r from-violet-500 to-purple-500"
              }
              shadow-lg transition-all duration-300 disabled:opacity-50
            `}
          >
            {isRecording ? (
              <Square className="h-8 w-8 text-white" />
            ) : (
              <Mic className="h-8 w-8 text-white" />
            )}
            {isRecording && (
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-red-400"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.button>

          <div className="mt-3 text-center">
            {isRecording ? (
              <div>
                <p className="text-2xl font-mono font-bold text-red-500">
                  {formatTime(recordingTime)}
                </p>
                <p className="text-sm text-slate-500">Recording... Click to stop</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {isProcessing ? "Processing audio..." : "Click to start recording"}
              </p>
            )}
          </div>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-violet-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Transcribing audio...</span>
            </div>
            <Progress value={66} className="h-2" />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Detected Medical Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="bg-violet-50 border-violet-200 text-violet-700">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Transcription Textarea */}
        <div className="space-y-2">
          <Textarea
            value={transcription}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[150px] font-mono text-sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleCopy} disabled={!transcription}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button
            onClick={handleSave}
            disabled={!transcription || isSaving}
            className="bg-gradient-to-r from-violet-500 to-purple-500"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Note
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={!transcription && !isRecording}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
          {(patientId || consultationId) && savedNotes.length > 0 && (
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Clock className="h-4 w-4 mr-2" />
                  History ({savedNotes.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Voice Note History</DialogTitle>
                  <DialogDescription>Previous voice notes for this patient/consultation</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {savedNotes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => loadNote(note)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-500">
                            {new Date(note.recordedAt).toLocaleString()}
                          </span>
                          <div className="flex items-center gap-2">
                            {note.audioDuration && (
                              <Badge variant="outline" className="text-xs">
                                {formatTime(note.audioDuration)}
                              </Badge>
                            )}
                            <Badge
                              className={
                                note.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : note.status === "reviewed"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-700"
                              }
                            >
                              {note.status}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2">{note.transcription}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowHistory(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Status Badge */}
        {transcription && (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle className="h-4 w-4" />
            Transcription ready for review
          </div>
        )}
      </CardContent>
    </Card>
  );
}

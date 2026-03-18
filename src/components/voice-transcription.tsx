"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Save,
  Copy,
  Trash2,
  Loader2,
  Volume2,
  FileText,
  Clock,
  Waves,
  CheckCircle,
  AlertCircle,
  Download,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
}

interface TranscriptionRecord {
  id: string;
  patientId?: string;
  patientName?: string;
  text: string;
  duration: number;
  timestamp: Date;
  status: "draft" | "reviewed" | "approved";
  tags?: string[];
  noteType?: string;
}

export function VoiceTranscription({ preselectedPatientId }: { preselectedPatientId?: string | null }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || "");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionRecord[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Fetch voice notes when patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      fetchVoiceNotes(selectedPatientId);
    }
  }, [selectedPatientId]);

  // Update selected patient when preselectedPatientId changes
  useEffect(() => {
    if (preselectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
    }
  }, [preselectedPatientId]);

  const fetchVoiceNotes = async (patientId: string) => {
    try {
      const response = await fetch(`/api/voice-notes?patientId=${patientId}`);
      const data = await response.json();
      if (data.success && data.data.voiceNotes) {
        const notes: TranscriptionRecord[] = data.data.voiceNotes.map((note: { id: string; patientId?: string; transcription: string; audioDuration?: number; recordedAt: string; status: string; tags?: string; noteType?: string }) => ({
          id: note.id,
          patientId: note.patientId,
          text: note.transcription,
          duration: note.audioDuration || 0,
          timestamp: new Date(note.recordedAt),
          status: note.status as "draft" | "reviewed" | "approved",
          tags: note.tags ? JSON.parse(note.tags) : [],
          noteType: note.noteType,
        }));
        setTranscriptionHistory(notes);
      }
    } catch (error) {
      console.error("Failed to fetch voice notes:", error);
    }
  };

  // Filter transcriptions by selected patient
  const filteredTranscriptions = selectedPatientId
    ? transcriptionHistory.filter((t) => t.patientId === selectedPatientId)
    : transcriptionHistory;

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const fetchPatients = async () => {
    try {
      setIsLoadingPatients(true);
      const response = await fetch("/api/patients?limit=100");
      const data = await response.json();
      if (data.success) {
        setPatients(data.data.patients);
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error);
      toast({
        title: "Error",
        description: "Failed to load patients",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const getSelectedPatient = () => {
    return patients.find((p) => p.id === selectedPatientId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    try {
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

      mediaRecorder.start();
      setIsRecording(true);
      setTranscription("");
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Microphone Error",
        description: "Please allow microphone access to record voice notes.",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = () => {
    // Stop the media recorder
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all audio tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
    
    setIsRecording(false);

    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsProcessing(true);

    // Process audio with ASR
    const processAudio = async () => {
      try {
        // Convert audio chunks to blob
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);

        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];

          try {
            const response = await fetch("/api/voice-notes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audioBase64: base64Audio,
                patientId: selectedPatientId,
                audioDuration: recordingTime,
                audioFormat: "webm",
              }),
            });

            const data = await response.json();

            if (data.success) {
              setTranscription(data.data.transcription);
              setTags(data.data.tags || []);
              // Refresh voice notes list
              if (selectedPatientId) {
                fetchVoiceNotes(selectedPatientId);
              }
            } else {
              setTranscription("");
              toast({
                title: "Transcription Failed",
                description: data.error || "Failed to transcribe audio. Please try again.",
                variant: "destructive",
              });
            }
          } catch (error) {
            console.error("Failed to process audio:", error);
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
          setIsProcessing(false);
          toast({
            title: "Audio Error",
            description: "Failed to read audio data.",
            variant: "destructive",
          });
        };
      } catch (error) {
        console.error("Failed to stop recording:", error);
        setIsProcessing(false);
      }
    };

    processAudio();
  };

  // Reference for audio chunks
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleSaveTranscription = async () => {
    if (!transcription.trim()) return;

    const selectedPatient = getSelectedPatient();
    setIsSaving(true);
    
    try {
      // In a real app, this would save to the database
      const newRecord: TranscriptionRecord = {
        id: Date.now().toString(),
        patientId: selectedPatientId || undefined,
        patientName: selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : undefined,
        text: transcription,
        duration: recordingTime,
        timestamp: new Date(),
        status: "draft",
      };
      setTranscriptionHistory([newRecord, ...transcriptionHistory]);
      setTranscription("");
      setRecordingTime(0);
      
      toast({
        title: "Saved",
        description: "Voice note saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save transcription",
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
      description: "Transcription copied to clipboard",
    });
  };

  const selectedPatient = getSelectedPatient();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Mic className="h-6 w-6 text-violet-500" />
            Voice Notes
          </h2>
          <p className="text-slate-500">Speech-to-text for clinical documentation</p>
        </div>
        <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700 w-fit">
          <Volume2 className="h-3 w-3 mr-1" />
          ASR Powered
        </Badge>
      </div>

      {/* Patient Selection */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-violet-500" />
            Patient Context
          </CardTitle>
          <CardDescription>Select a patient to link voice notes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select 
              value={selectedPatientId} 
              onValueChange={setSelectedPatientId}
              disabled={isLoadingPatients}
            >
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder={isLoadingPatients ? "Loading patients..." : "Select a patient..."} />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName} ({patient.mrn})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPatient && (
              <div className="flex items-center gap-4 flex-1">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-violet-100 text-violet-700">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                  <p className="text-sm text-slate-500">{selectedPatient.mrn} • {selectedPatient.gender} • DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="bg-violet-50 border-violet-200 text-violet-700">
                  {filteredTranscriptions.length} Notes
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert className="bg-violet-50 border-violet-200">
        <Waves className="h-4 w-4 text-violet-600" />
        <AlertTitle className="text-violet-800">Medical Speech Recognition</AlertTitle>
        <AlertDescription className="text-violet-700">
          Record clinical notes and let AI transcribe them. Optimized for medical terminology and clinical workflows.
        </AlertDescription>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recording Section */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">
              Record Clinical Note
              {selectedPatient && (
                <Badge variant="outline" className="ml-2 bg-violet-50 border-violet-200 text-violet-700">
                  {selectedPatient.firstName} {selectedPatient.lastName[0]}.
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Click the microphone to start recording</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recording Button */}
            <div className="flex flex-col items-center py-8">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={`
                  relative w-24 h-24 rounded-full flex items-center justify-center
                  ${isRecording
                    ? "bg-gradient-to-r from-red-500 to-pink-500"
                    : "bg-gradient-to-r from-violet-500 to-purple-500"
                  }
                  shadow-lg transition-all duration-300
                `}
              >
                {isRecording ? (
                  <Square className="h-8 w-8 text-white" />
                ) : (
                  <Mic className="h-10 w-10 text-white" />
                )}
                {isRecording && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-4 border-red-400"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.button>

              <div className="mt-4 text-center">
                {isRecording ? (
                  <div>
                    <p className="text-2xl font-mono font-bold text-red-500">{formatTime(recordingTime)}</p>
                    <p className="text-sm text-slate-500">Recording... Click to stop</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Click to start recording</p>
                )}
              </div>
            </div>

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-violet-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing audio...</span>
                </div>
                <Progress value={66} className="h-2" />
              </div>
            )}

            {/* Transcription Result */}
            {transcription && !isProcessing && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className="bg-emerald-100 text-emerald-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Transcription Complete
                  </Badge>
                  <span className="text-sm text-slate-500">{formatTime(recordingTime)}</span>
                </div>
                
                {/* Tags Display */}
                {tags.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Detected Medical Terms:</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="bg-violet-50 border-violet-200 text-violet-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <Textarea
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  className="min-h-[200px]"
                  placeholder="Transcription will appear here..."
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    onClick={handleSaveTranscription}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-violet-500 to-purple-500"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {isSaving ? "Saving..." : "Save Note"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transcription History */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedPatient ? `${selectedPatient.firstName}'s Voice Notes` : "Recent Transcriptions"}
            </CardTitle>
            <CardDescription>
              {selectedPatient 
                ? `${filteredTranscriptions.length} notes for this patient`
                : "All saved voice notes and transcriptions"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {filteredTranscriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[350px] text-center">
                  <Mic className="h-12 w-12 text-slate-300 mb-4" />
                  <h3 className="font-medium text-slate-600">
                    {selectedPatient ? `No notes for ${selectedPatient.firstName}` : "No Transcriptions"}
                  </h3>
                  <p className="text-sm text-slate-400">Start recording to create voice notes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTranscriptions.map((record) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className="text-xs text-slate-500">
                            {record.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {formatTime(record.duration)}
                          </Badge>
                          <Badge
                            className={
                              record.status === "approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : record.status === "reviewed"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-100 text-slate-700"
                            }
                          >
                            {record.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 line-clamp-3">{record.text}</p>
                      <div className="flex gap-2 mt-3">
                        <Button variant="ghost" size="sm">
                          <FileText className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Tips Section */}
      <Card className="border-0 shadow-md bg-slate-50">
        <CardHeader>
          <CardTitle className="text-lg">Recording Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Mic, title: "Clear Speech", desc: "Speak clearly at a moderate pace" },
              { icon: Volume2, title: "Quiet Environment", desc: "Minimize background noise" },
              { icon: CheckCircle, title: "Review Output", desc: "Always verify transcribed text" },
            ].map((tip, i) => {
              const Icon = tip.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <Icon className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-700">{tip.title}</h4>
                    <p className="text-sm text-slate-500">{tip.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

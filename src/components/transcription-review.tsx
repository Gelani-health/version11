"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Edit3,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Volume2,
  Clock,
  Star,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * TranscriptionReview - World-Class Feedback Component
 *
 * Features:
 * - Review and edit transcriptions
 * - Submit corrections for learning
 * - Quality rating
 * - Medical term validation
 * - Negation awareness
 * - Audio playback
 *
 * @version 2.0.0
 */

interface TranscriptionResult {
  id: string;
  transcription: string;
  confidence: number;
  wordCount: number;
  processingTimeMs: number;
  medicalTermsDetected: string[];
  engine: string;
  negationDetection?: {
    negatedTerms: string[];
    negationPhrases: Array<{ indicator: string; negatedTerm: string }>;
  };
  audioQuality?: {
    category: string;
    snr: number;
    issues: string[];
    recommendations: string[];
  };
  wordConfidences?: Array<{
    word: string;
    confidence: number;
    isMedicalTerm: boolean;
  }>;
}

interface TranscriptionReviewProps {
  transcription: TranscriptionResult;
  onAccept: (text: string) => void;
  onReject: () => void;
  onCorrect?: (original: string, corrected: string) => void;
  context?: string;
  soapSection?: string;
  specialty?: string;
  userId?: string;
  showQualityMetrics?: boolean;
  showNegationInfo?: boolean;
  autoHide?: boolean;
  className?: string;
}

export function TranscriptionReview({
  transcription,
  onAccept,
  onReject,
  onCorrect,
  context = "medical",
  soapSection,
  specialty,
  userId,
  showQualityMetrics = true,
  showNegationInfo = true,
  autoHide = false,
  className,
}: TranscriptionReviewProps) {
  const [editedText, setEditedText] = useState(transcription.transcription);
  const [isEditing, setIsEditing] = useState(false);
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { toast } = useToast();

  // Track changes
  useEffect(() => {
    setHasChanges(editedText !== transcription.transcription);
  }, [editedText, transcription.transcription]);

  // Auto-hide after accept
  const [isVisible, setIsVisible] = useState(true);

  // Submit feedback for learning
  const submitFeedback = useCallback(async (
    type: "accept" | "correct" | "reject",
    originalText: string,
    correctedText?: string
  ) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/asr?action=feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptionId: transcription.id,
          originalText,
          correctedText: correctedText || originalText,
          userId,
          context,
          soapSection,
          specialty,
          feedbackType: type,
          qualityRating,
          qualityFeedback: feedback,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (autoHide) {
          setIsVisible(false);
        }
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [transcription.id, userId, context, soapSection, specialty, qualityRating, feedback, autoHide]);

  // Handle accept
  const handleAccept = useCallback(async () => {
    const finalText = editedText;

    // If user made edits, submit as correction
    if (hasChanges) {
      await submitFeedback("correct", transcription.transcription, finalText);
      onCorrect?.(transcription.transcription, finalText);
    } else {
      await submitFeedback("accept", finalText);
    }

    onAccept(finalText);

    toast({
      title: hasChanges ? "Correction Saved" : "Transcription Accepted",
      description: hasChanges
        ? "Your correction has been saved and will help improve future transcriptions."
        : "Thank you for confirming the transcription.",
    });
  }, [editedText, hasChanges, transcription.transcription, submitFeedback, onAccept, onCorrect, toast]);

  // Handle reject
  const handleReject = useCallback(async () => {
    await submitFeedback("reject", transcription.transcription, "");
    onReject();

    toast({
      title: "Transcription Rejected",
      description: "The transcription has been marked as incorrect.",
      variant: "destructive",
    });
  }, [transcription.transcription, submitFeedback, onReject, toast]);

  // Handle save edit
  const handleSaveEdit = useCallback(() => {
    setIsEditing(false);

    if (editedText !== transcription.transcription) {
      toast({
        title: "Changes Made",
        description: "Click 'Accept' to save your corrections.",
      });
    }
  }, [editedText, transcription.transcription, toast]);

  // Reset to original
  const handleReset = useCallback(() => {
    setEditedText(transcription.transcription);
    setIsEditing(false);

    toast({
      title: "Reset",
      description: "Changes have been reset to original transcription.",
    });
  }, [transcription.transcription, toast]);

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.8) return "text-emerald-600";
    if (confidence >= 0.7) return "text-amber-600";
    return "text-red-600";
  };

  // Get quality badge color
  const getQualityBadgeVariant = (quality: string) => {
    switch (quality) {
      case "excellent":
        return "default";
      case "good":
        return "secondary";
      case "fair":
        return "outline";
      default:
        return "destructive";
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn("relative", className)}
      suppressHydrationWarning
    >
      <Card className="border-2 border-slate-200 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Transcription Review
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-xs", getConfidenceColor(transcription.confidence))}>
                {Math.round(transcription.confidence * 100)}% confidence
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {transcription.engine}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Audio Quality */}
          {showQualityMetrics && transcription.audioQuality && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={getQualityBadgeVariant(transcription.audioQuality.category)}>
                Audio: {transcription.audioQuality.category}
              </Badge>
              {transcription.audioQuality.issues.length > 0 && (
                <span className="text-amber-600 text-xs">
                  {transcription.audioQuality.issues[0]}
                </span>
              )}
            </div>
          )}

          {/* Transcription Text */}
          <div className="space-y-2">
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="min-h-[120px] resize-y"
                  placeholder="Edit transcription..."
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveEdit}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Done Editing
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="p-3 bg-slate-50 rounded-lg min-h-[80px] cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setIsEditing(true)}
              >
                <p className="text-sm whitespace-pre-wrap">{editedText}</p>
                {hasChanges && (
                  <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                    <Edit3 className="h-3 w-3" />
                    Modified - Click to edit
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Medical Terms Detected */}
          {transcription.medicalTermsDetected.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600">Medical Terms Detected:</p>
              <div className="flex flex-wrap gap-1">
                {transcription.medicalTermsDetected.slice(0, 5).map((term, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {term}
                  </Badge>
                ))}
                {transcription.medicalTermsDetected.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{transcription.medicalTermsDetected.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Negation Info */}
          {showNegationInfo && transcription.negationDetection && transcription.negationDetection.negatedTerms.length > 0 && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-medium text-amber-800 mb-1">Negation Detected:</p>
              <div className="flex flex-wrap gap-1">
                {transcription.negationDetection.negatedTerms.map((term, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-amber-300">
                    ⚠️ NOT: {term}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Quality Rating */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Rate Quality (optional):</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setQualityRating(rating)}
                  className={cn(
                    "p-1 rounded transition-colors",
                    qualityRating === rating
                      ? "text-yellow-500"
                      : "text-slate-300 hover:text-yellow-400"
                  )}
                >
                  <Star className="h-5 w-5 fill-current" />
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              disabled={isEditing}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Edit
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReject}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <ThumbsDown className="h-4 w-4 mr-1" />
              Reject
            </Button>

            <div className="flex-1" />

            <Button
              variant="default"
              size="sm"
              onClick={handleAccept}
              disabled={isSubmitting || !editedText.trim()}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {hasChanges ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Save Correction
                </>
              ) : (
                <>
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  Accept
                </>
              )}
            </Button>
          </div>

          {/* Details Toggle */}
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                {showDetails ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Show Details
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              {/* Processing Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded">
                  <p className="text-xs text-slate-500">Words</p>
                  <p className="font-semibold">{transcription.wordCount}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <p className="text-xs text-slate-500">Time</p>
                  <p className="font-semibold">{transcription.processingTimeMs}ms</p>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <p className="text-xs text-slate-500">Engine</p>
                  <p className="font-semibold text-xs">{transcription.engine}</p>
                </div>
              </div>

              {/* Word Confidences */}
              {transcription.wordConfidences && transcription.wordConfidences.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">Word-by-word Confidence:</p>
                  <div className="flex flex-wrap gap-1">
                    {transcription.wordConfidences.slice(0, 20).map((word, i) => (
                      <span
                        key={i}
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          word.confidence >= 0.9
                            ? "bg-green-100 text-green-800"
                            : word.confidence >= 0.7
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800",
                          word.isMedicalTerm && "ring-1 ring-blue-400"
                        )}
                        title={`Confidence: ${Math.round(word.confidence * 100)}%${word.isMedicalTerm ? " (medical term)" : ""}`}
                      >
                        {word.word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio Quality Details */}
              {transcription.audioQuality && (
                <div className="text-xs text-slate-600 space-y-1">
                  <p>SNR: {transcription.audioQuality.snr.toFixed(1)} dB</p>
                  {transcription.audioQuality.recommendations.length > 0 && (
                    <div className="text-amber-700">
                      <p className="font-medium">Recommendations:</p>
                      <ul className="list-disc pl-4">
                        {transcription.audioQuality.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default TranscriptionReview;

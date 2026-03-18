"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown, Star, Check, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface FeedbackButtonsProps {
  suggestionId: string;
  suggestionType: "diagnosis" | "drug" | "lab" | "imaging" | "general";
  category: string;
  suggestion: string;
  onFeedbackSubmitted?: (feedback: { rating: number; wasHelpful: boolean }) => void;
}

export function FeedbackButtons({
  suggestionId,
  suggestionType,
  category,
  suggestion,
  onFeedbackSubmitted,
}: FeedbackButtonsProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [wasHelpful, setWasHelpful] = useState<boolean | null>(null);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleQuickFeedback = async (helpful: boolean) => {
    setWasHelpful(helpful);
    setRating(helpful ? 4 : 2);
    await submitFeedback(helpful ? 4 : 2, helpful);
  };

  const handleStarRating = async (star: number) => {
    setRating(star);
    setWasHelpful(star >= 3);
    await submitFeedback(star, star >= 3);
  };

  const submitFeedback = async (ratingValue: number, helpful: boolean) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/rl/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId,
          suggestionType,
          category,
          suggestion,
          rating: ratingValue,
          wasHelpful: helpful,
          wasAccepted: false,
          wasModified: false,
          feedbackNotes: notes || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitted(true);
        onFeedbackSubmitted?.({ rating: ratingValue, wasHelpful: helpful });
        toast({
          title: "Thank you!",
          description: "Your feedback helps improve AI suggestions.",
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 text-emerald-600"
      >
        <Check className="h-4 w-4" />
        <span className="text-sm">Thanks for your feedback!</span>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Was this helpful?</span>
        
        {/* Quick thumbs up/down */}
        <Button
          variant={wasHelpful === true ? "default" : "outline"}
          size="sm"
          className={`h-7 px-2 ${
            wasHelpful === true
              ? "bg-emerald-500 hover:bg-emerald-600"
              : ""
          }`}
          onClick={() => handleQuickFeedback(true)}
          disabled={isSubmitting}
        >
          <ThumbsUp className="h-3 w-3" />
        </Button>
        
        <Button
          variant={wasHelpful === false ? "default" : "outline"}
          size="sm"
          className={`h-7 px-2 ${
            wasHelpful === false
              ? "bg-red-500 hover:bg-red-600"
              : ""
          }`}
          onClick={() => handleQuickFeedback(false)}
          disabled={isSubmitting}
        >
          <ThumbsDown className="h-3 w-3" />
        </Button>

        {/* Detailed feedback toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => setShowDetailedFeedback(!showDetailedFeedback)}
        >
          <MessageSquare className="h-3 w-3" />
        </Button>
      </div>

      {/* Star rating */}
      <AnimatePresence>
        {showDetailedFeedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 pt-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Rate:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleStarRating(star)}
                    disabled={isSubmitting}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-5 w-5 transition-colors ${
                        rating && star <= rating
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating && (
                <Badge variant="outline" className="text-xs">
                  {rating}/5
                </Badge>
              )}
            </div>

            {/* Optional notes */}
            <div className="space-y-1">
              <Textarea
                placeholder="Optional: What could be improved?"
                className="h-16 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isSubmitting && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="animate-spin h-3 w-3 border-2 border-slate-300 border-t-slate-600 rounded-full" />
          Submitting...
        </div>
      )}
    </div>
  );
}

// Feedback badge component for displaying RL-adjusted confidence
interface ConfidenceBadgeProps {
  originalConfidence: number;
  adjustedConfidence: number;
  explorationBonus?: number;
}

export function ConfidenceBadge({
  originalConfidence,
  adjustedConfidence,
  explorationBonus,
}: ConfidenceBadgeProps) {
  const diff = adjustedConfidence - originalConfidence;
  const isImproved = diff > 0.02;
  const isDecreased = diff < -0.02;

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={`
          ${
            isImproved
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : isDecreased
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-slate-50 border-slate-200 text-slate-700"
          }
        `}
      >
        {Math.round(adjustedConfidence * 100)}% confidence
        {isImproved && " ↑"}
        {isDecreased && " ↓"}
      </Badge>
      {explorationBonus && explorationBonus > 1 && (
        <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-600">
          Learning
        </Badge>
      )}
    </div>
  );
}

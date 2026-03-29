"use client";

import { useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Volume2,
  Loader2,
  Square,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useTTS, TTS_VOICES } from "@/hooks/use-tts";
import { cn } from "@/lib/utils";

interface TTSButtonProps {
  text: string;
  voice?: string;
  speed?: number;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline" | "default";
  showSettings?: boolean;
  showProgress?: boolean;
  className?: string;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  label?: string;
}

export function TTSButton({
  text,
  voice: defaultVoice = "tongtong",
  speed: defaultSpeed = 1.0,
  size = "md",
  variant = "ghost",
  showSettings = true,
  showProgress = true,
  className,
  onSpeakStart,
  onSpeakEnd,
  onError,
  disabled = false,
  label,
}: TTSButtonProps) {
  const {
    isPlaying,
    isLoading,
    progress,
    currentChunk,
    totalChunks,
    error,
    voice,
    speed,
    speak,
    stop,
    setVoice,
    setSpeed,
    voices,
  } = useTTS({ voice: defaultVoice, speed: defaultSpeed });

  // Handle errors
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  const handleSpeak = useCallback(async () => {
    if (!text.trim()) return;

    if (isPlaying) {
      stop();
      return;
    }

    try {
      onSpeakStart?.();
      await speak(text);
      onSpeakEnd?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "TTS failed";
      onError?.(errorMessage);
    }
  }, [text, isPlaying, speak, stop, onSpeakStart, onSpeakEnd, onError]);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <TooltipProvider>
      <div className={cn("inline-flex items-center gap-2", className)}>
        {/* Main TTS Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size="icon"
              className={cn(
                sizeClasses[size],
                isPlaying && "bg-emerald-100 hover:bg-emerald-200 text-emerald-600",
                isLoading && "animate-pulse"
              )}
              onClick={handleSpeak}
              disabled={disabled || isLoading}
            >
              {isLoading ? (
                <Loader2 className={cn(iconSizes[size], "animate-spin")} />
              ) : isPlaying ? (
                <Square className={iconSizes[size]} />
              ) : (
                <Volume2 className={iconSizes[size]} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isLoading
              ? "Generating speech..."
              : isPlaying
              ? "Stop speaking"
              : label || "Read aloud"}
          </TooltipContent>
        </Tooltip>

        {/* Progress indicator */}
        {showProgress && (isPlaying || isLoading) && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            {totalChunks > 1 && (
              <span className="text-xs text-slate-500">
                {currentChunk}/{totalChunks}
              </span>
            )}
          </div>
        )}

        {/* Settings Popover */}
        {showSettings && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-3.5 w-3.5 text-slate-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="start">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Voice Settings</h4>

                {/* Voice Selection */}
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">Voice</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {voices.map((v) => (
                      <Button
                        key={v.id}
                        variant={voice === v.id ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "justify-start h-auto py-1.5 px-2 text-xs",
                          voice === v.id && "bg-emerald-500 hover:bg-emerald-600"
                        )}
                        onClick={() => setVoice(v.id)}
                      >
                        {v.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Speed Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-500">Speed</Label>
                    <Badge variant="outline" className="text-xs">
                      {speed.toFixed(1)}x
                    </Badge>
                  </div>
                  <Slider
                    value={[speed]}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    onValueChange={([value]) => setSpeed(value)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Slow</span>
                    <span>Normal</span>
                    <span>Fast</span>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600">{error}</p>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TooltipProvider>
  );
}

// Compact inline TTS component for text sections
interface InlineTTSProps {
  text: string;
  className?: string;
}

export function InlineTTS({ text, className }: InlineTTSProps) {
  const { isPlaying, isLoading, speak, stop } = useTTS();

  const handleClick = () => {
    if (isPlaying) {
      stop();
    } else {
      speak(text);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors",
        isPlaying && "text-emerald-600 bg-emerald-50",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
    </button>
  );
}

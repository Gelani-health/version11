'use client';

/**
 * Clinical Predictions Panel Component
 * =====================================
 *
 * Displays clinical prediction models:
 * - LACE Index (30-day readmission risk)
 * - NEWS2 (clinical deterioration risk)
 *
 * References:
 * - van Walraven C, et al. CMAJ 2010 (LACE)
 * - Royal College of Physicians. NEWS2 (2017)
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Heart,
  Brain,
  RefreshCw,
  ChevronRight,
  Shield,
  Info,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Types
interface PredictionResult {
  modelName: string;
  modelVersion: string;
  riskScore: number;
  riskLevel: string;
  probability: number;
  confidence: number;
  contributingFactors: Array<{
    factor: string;
    value: string;
    points: number;
  }>;
  recommendations: string[];
  explanation: string;
  timestamp: string;
  evidenceLevel: string;
  references: string[];
}

interface PredictionsPanelProps {
  patientId?: string | null;
}

// Risk level colors
const riskColors = {
  low: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300',
};

// Model icons
const modelIcons: Record<string, React.ReactNode> = {
  readmission: <TrendingUp className="h-5 w-5" />,
  deterioration: <Activity className="h-5 w-5" />,
};

export function PredictionsPanel({ patientId }: PredictionsPanelProps) {
  const { toast } = useToast();
  const [predictions, setPredictions] = useState<{
    readmission?: PredictionResult;
    deterioration?: PredictionResult;
  }>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Run prediction
  const runPrediction = useCallback(async (modelType: 'readmission' | 'deterioration') => {
    if (!patientId) {
      toast({
        title: 'No Patient Selected',
        description: 'Please select a patient to run predictions',
        variant: 'destructive',
      });
      return;
    }

    setLoading(modelType);
    try {
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          modelType,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPredictions((prev) => ({
          ...prev,
          [modelType]: data.prediction,
        }));
        toast({
          title: 'Prediction Complete',
          description: `${data.prediction.modelName} calculated successfully`,
        });
      } else {
        throw new Error(data.error || 'Prediction failed');
      }
    } catch (error) {
      toast({
        title: 'Prediction Error',
        description: error instanceof Error ? error.message : 'Failed to run prediction',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  }, [patientId, toast]);

  // Get score bar color
  const getScoreColor = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.7) return 'bg-red-500';
    if (ratio >= 0.4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Render prediction card
  const PredictionCard = ({
    type,
    title,
    description,
    prediction,
    maxScore,
  }: {
    type: 'readmission' | 'deterioration';
    title: string;
    description: string;
    prediction?: PredictionResult;
    maxScore: number;
  }) => (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-muted">
              {modelIcons[type]}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runPrediction(type)}
            disabled={loading !== null || !patientId}
          >
            {loading === type ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              'Calculate'
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {prediction ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Score Display */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl font-bold">{prediction.riskScore}</div>
                <div className="text-sm text-muted-foreground">/ {maxScore}</div>
              </div>
              <Badge
                className={`${riskColors[prediction.riskLevel as keyof typeof riskColors]} text-sm px-3 py-1`}
              >
                {prediction.riskLevel.toUpperCase()} RISK
              </Badge>
            </div>

            {/* Score Bar */}
            <div className="relative">
              <Progress
                value={(prediction.riskScore / maxScore) * 100}
                className="h-2"
              />
            </div>

            {/* Probability */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Probability:</span>
              <span className="font-medium">
                {(prediction.probability * 100).toFixed(1)}%
              </span>
            </div>

            {/* Contributing Factors */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Contributing Factors</p>
              <div className="grid grid-cols-2 gap-2">
                {prediction.contributingFactors.slice(0, 4).map((factor, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-muted rounded text-xs"
                  >
                    <span className="truncate">{factor.factor}</span>
                    <Badge variant="outline" className="ml-2">
                      +{factor.points}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Recommendations */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Key Recommendations</p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {prediction.recommendations[0]}
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedModel(type);
                  setDetailsDialogOpen(true);
                }}
              >
                View Details
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground text-right">
              Calculated: {new Date(prediction.timestamp).toLocaleString()}
            </p>
          </motion.div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Click "Calculate" to run prediction</p>
            {!patientId && (
              <p className="text-xs mt-1">Select a patient first</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" />
            Clinical Predictions
          </h2>
          <p className="text-muted-foreground">
            Evidence-based risk assessment models
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                Clinical Decision Support
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                These predictions are based on validated clinical models and should be used
                in conjunction with clinical judgment. They do not replace professional medical assessment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prediction Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <PredictionCard
          type="readmission"
          title="LACE Index"
          description="30-day readmission risk"
          prediction={predictions.readmission}
          maxScore={19}
        />
        <PredictionCard
          type="deterioration"
          title="NEWS2 Score"
          description="Clinical deterioration risk"
          prediction={predictions.deterioration}
          maxScore={20}
        />
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedModel === 'readmission' ? 'LACE Index Details' : 'NEWS2 Score Details'}
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown and recommendations
            </DialogDescription>
          </DialogHeader>
          {selectedModel && predictions[selectedModel as keyof typeof predictions] && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {(() => {
                  const pred = predictions[selectedModel as keyof typeof predictions];
                  if (!pred) return null;

                  return (
                    <>
                      {/* Summary */}
                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">Risk Level</p>
                          <p className="text-2xl font-bold capitalize">{pred.riskLevel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Score</p>
                          <p className="text-2xl font-bold">
                            {pred.riskScore}
                            <span className="text-sm text-muted-foreground ml-1">
                              / {selectedModel === 'readmission' ? 19 : 20}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Explanation */}
                      <div>
                        <p className="text-sm font-medium mb-2">Explanation</p>
                        <p className="text-sm text-muted-foreground">{pred.explanation}</p>
                      </div>

                      <Separator />

                      {/* Contributing Factors */}
                      <div>
                        <p className="text-sm font-medium mb-2">Contributing Factors</p>
                        <div className="space-y-2">
                          {pred.contributingFactors.map((factor, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 bg-muted rounded"
                            >
                              <div>
                                <p className="text-sm font-medium">{factor.factor}</p>
                                <p className="text-xs text-muted-foreground">{factor.value}</p>
                              </div>
                              <Badge
                                variant={factor.points >= 2 ? 'destructive' : 'secondary'}
                              >
                                +{factor.points} points
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Recommendations */}
                      <div>
                        <p className="text-sm font-medium mb-2">Recommendations</p>
                        <ul className="space-y-2">
                          {pred.recommendations.map((rec, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm"
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Separator />

                      {/* References */}
                      <div>
                        <p className="text-sm font-medium mb-2">References</p>
                        <ul className="space-y-1">
                          {pred.references.map((ref, i) => (
                            <li key={i} className="text-xs text-muted-foreground">
                              • {ref}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Confidence */}
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Model Confidence</span>
                          <span className="font-medium">{(pred.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={pred.confidence * 100} className="h-1 mt-2" />
                      </div>
                    </>
                  );
                })()}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PredictionsPanel;

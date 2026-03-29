"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Heart,
  Brain,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PredictionsDashboardProps {
  patientId?: string | null;
}

interface PredictionResult {
  prediction_type: string;
  score: number;
  risk_level: string;
  probability: number;
  probability_percent: string;
  contributing_factors: Array<{
    factor: string;
    value: string;
    points?: number;
  }>;
  recommendations: string[];
  model_name: string;
  model_version: string;
  timestamp: string;
}

export function PredictionsDashboard({ patientId }: PredictionsDashboardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activePrediction, setActivePrediction] = useState<"readmission" | "deterioration">("readmission");
  const [result, setResult] = useState<PredictionResult | null>(null);
  
  // Form states for readmission
  const [lengthOfStay, setLengthOfStay] = useState("3");
  const [admissionType, setAdmissionType] = useState("elective");
  const [edVisits, setEdVisits] = useState("0");
  
  // Form states for deterioration
  const [respiratoryRate, setRespiratoryRate] = useState("16");
  const [oxygenSaturation, setOxygenSaturation] = useState("98");
  const [supplementalO2, setSupplementalO2] = useState(false);
  const [systolicBP, setSystolicBP] = useState("120");
  const [heartRate, setHeartRate] = useState("72");
  const [temperature, setTemperature] = useState("37.0");
  const [consciousness, setConsciousness] = useState("alert");

  const calculatePrediction = async () => {
    if (!patientId) {
      toast({
        title: "No Patient Selected",
        description: "Please select a patient first",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = activePrediction === "readmission" 
        ? "/api/predictions?predictionType=readmission"
        : "/api/predictions?predictionType=deterioration";

      const payload = activePrediction === "readmission"
        ? {
            predictionType: "readmission",
            patientId,
            lengthOfStayDays: parseFloat(lengthOfStay),
            admissionType,
            edVisits6months: parseInt(edVisits),
            conditions: [],
          }
        : {
            predictionType: "deterioration",
            patientId,
            respiratoryRate: parseInt(respiratoryRate),
            oxygenSaturation: parseFloat(oxygenSaturation),
            supplementalOxygen: supplementalO2,
            systolicBp: parseInt(systolicBP),
            heartRate: parseInt(heartRate),
            temperature: parseFloat(temperature),
            consciousness,
          };

      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to calculate prediction",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "text-emerald-600";
      case "moderate": return "text-amber-600";
      case "high": return "text-orange-600";
      case "very_high": return "text-red-600";
      default: return "text-slate-600";
    }
  };

  const getRiskBadge = (level: string) => {
    const colors: Record<string, string> = {
      low: "bg-emerald-100 text-emerald-700",
      moderate: "bg-amber-100 text-amber-700",
      high: "bg-orange-100 text-orange-700",
      very_high: "bg-red-100 text-red-700",
    };
    return colors[level] || "bg-slate-100 text-slate-700";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-purple-500" />
            Risk Predictions
          </h2>
          <p className="text-slate-500">Clinical prediction models for risk assessment</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
            LACE Index • NEWS2
          </Badge>
        </div>
      </div>

      {!patientId ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600">Select a Patient</h3>
            <p className="text-sm text-slate-500">
              Select a patient to run clinical predictions
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Input Parameters</CardTitle>
              <CardDescription>Enter patient data for prediction</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activePrediction} onValueChange={(v) => setActivePrediction(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="readmission">
                    <Activity className="h-4 w-4 mr-2" />
                    Readmission Risk
                  </TabsTrigger>
                  <TabsTrigger value="deterioration">
                    <Heart className="h-4 w-4 mr-2" />
                    Deterioration Risk
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="readmission" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Length of Stay (days)</Label>
                    <Input
                      type="number"
                      value={lengthOfStay}
                      onChange={(e) => setLengthOfStay(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Admission Type</Label>
                    <Select value={admissionType} onValueChange={setAdmissionType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="elective">Elective</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ED Visits (last 6 months)</Label>
                    <Input
                      type="number"
                      value={edVisits}
                      onChange={(e) => setEdVisits(e.target.value)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="deterioration" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Respiratory Rate</Label>
                      <Input
                        type="number"
                        value={respiratoryRate}
                        onChange={(e) => setRespiratoryRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SpO2 (%)</Label>
                      <Input
                        type="number"
                        value={oxygenSaturation}
                        onChange={(e) => setOxygenSaturation(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Systolic BP</Label>
                      <Input
                        type="number"
                        value={systolicBP}
                        onChange={(e) => setSystolicBP(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Heart Rate</Label>
                      <Input
                        type="number"
                        value={heartRate}
                        onChange={(e) => setHeartRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Temperature (°C)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Consciousness</Label>
                      <Select value={consciousness} onValueChange={setConsciousness}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alert">Alert</SelectItem>
                          <SelectItem value="cvpu">CVPU</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="supplementalO2"
                      checked={supplementalO2}
                      onChange={(e) => setSupplementalO2(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="supplementalO2">On Supplemental Oxygen</Label>
                  </div>
                </TabsContent>
              </Tabs>

              <Separator className="my-4" />

              <Button
                onClick={calculatePrediction}
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Calculate Risk
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prediction Results</CardTitle>
              <CardDescription>
                {result ? `Model: ${result.model_name}` : "Run prediction to see results"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Main Score */}
                  <div className="text-center p-6 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100">
                    <div className={cn("text-5xl font-bold mb-2", getRiskColor(result.risk_level))}>
                      {result.probability_percent}
                    </div>
                    <Badge className={getRiskBadge(result.risk_level)}>
                      {result.risk_level.replace("_", " ").toUpperCase()} RISK
                    </Badge>
                    <p className="text-sm text-slate-500 mt-2">
                      Score: {result.score} | Model: {result.model_name}
                    </p>
                  </div>

                  {/* Contributing Factors */}
                  <div>
                    <h4 className="font-medium text-slate-700 mb-3">Contributing Factors</h4>
                    <div className="space-y-2">
                      {result.contributing_factors.map((factor, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <span className="text-sm text-slate-600">{factor.factor}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{factor.value}</span>
                            {factor.points !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                +{factor.points}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 className="font-medium text-slate-700 mb-3">Recommendations</h4>
                    <ul className="space-y-2">
                      {result.recommendations.slice(0, 5).map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>Enter parameters and click Calculate to see prediction</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Model Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            About the Prediction Models
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-medium text-slate-800">LACE Index (Readmission Risk)</h4>
              <p className="text-sm text-slate-600">
                Predicts 30-day readmission probability based on Length of stay, Acuity, 
                Comorbidity, and ED visits. Score range: 0-20.
              </p>
              <p className="text-xs text-slate-500">
                Reference: Van Walraven et al., CMAJ 2010
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-slate-800">NEWS2 (Deterioration Risk)</h4>
              <p className="text-sm text-slate-600">
                National Early Warning Score for detecting clinical deterioration. 
                Uses 7 physiological parameters. Score range: 0-20.
              </p>
              <p className="text-xs text-slate-500">
                Reference: Royal College of Physicians, 2017
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PredictionsDashboard;

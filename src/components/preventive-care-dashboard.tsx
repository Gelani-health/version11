"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  Filter,
  User,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
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

// Types
interface USPSTFRecommendation {
  id: string;
  name: string;
  grade: "A" | "B";
  category: string;
  target_population: string;
  age_range: string;
  frequency: string;
  description: string;
  implementation_notes: string;
  shared_decision_making: boolean;
  icd10_codes: string[];
  cpt_codes: string[];
  last_performed?: string;
  patient_specific_notes?: string;
}

interface PreventiveCareResult {
  assessment_date: string;
  patient_context: {
    age: number;
    gender: string;
    smoking_status?: string;
    pregnant: boolean;
  };
  recommendations: {
    due_now: USPSTFRecommendation[];
    overdue: USPSTFRecommendation[];
    upcoming: USPSTFRecommendation[];
  };
  total_recommendations: number;
  high_priority_count: number;
  shared_decision_making_count: number;
}

interface PreventiveCareDashboardProps {
  patientId?: string | null;
}

const categoryColors: Record<string, string> = {
  cancer: "bg-pink-100 text-pink-700 border-pink-200",
  cardiovascular: "bg-red-100 text-red-700 border-red-200",
  infectious_disease: "bg-orange-100 text-orange-700 border-orange-200",
  metabolic: "bg-yellow-100 text-yellow-700 border-yellow-200",
  mental_health: "bg-purple-100 text-purple-700 border-purple-200",
  reproductive: "bg-teal-100 text-teal-700 border-teal-200",
  sensory: "bg-blue-100 text-blue-700 border-blue-200",
  musculoskeletal: "bg-green-100 text-green-700 border-green-200",
};

const categoryIcons: Record<string, string> = {
  cancer: "🎗️",
  cardiovascular: "❤️",
  infectious_disease: "🦠",
  metabolic: "🩺",
  mental_health: "🧠",
  reproductive: "👶",
  sensory: "👁️",
  musculoskeletal: "🦴",
};

export function PreventiveCareDashboard({ patientId }: PreventiveCareDashboardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PreventiveCareResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  useEffect(() => {
    if (patientId) {
      fetchRecommendations();
    }
  }, [patientId]);

  const fetchRecommendations = async () => {
    if (!patientId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/preventive-care?patientId=${patientId}`);
      const data = await response.json();
      
      if (data.success) {
        setResult(data.data.recommendations || data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load preventive care recommendations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterByCategory = (recs: USPSTFRecommendation[]) => {
    if (selectedCategory === "all") return recs;
    return recs.filter((r) => r.category === selectedCategory);
  };

  const getGradeColor = (grade: string) => {
    return grade === "A" 
      ? "bg-emerald-100 text-emerald-700 border-emerald-200" 
      : "bg-blue-100 text-blue-700 border-blue-200";
  };

  const renderRecommendation = (rec: USPSTFRecommendation, isOverdue = false) => {
    const isExpanded = expandedRec === rec.id;
    
    return (
      <motion.div
        key={rec.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-lg border p-4 transition-all",
          isOverdue && "border-red-200 bg-red-50",
          !isOverdue && rec.grade === "A" && "border-emerald-200 bg-emerald-50",
          !isOverdue && rec.grade === "B" && "border-blue-50 bg-blue-50/50"
        )}
      >
        <div
          className="flex items-start justify-between cursor-pointer"
          onClick={() => setExpandedRec(isExpanded ? null : rec.id)}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{categoryIcons[rec.category] || "📋"}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-slate-800">{rec.name}</h4>
                <Badge className={getGradeColor(rec.grade)}>
                  Grade {rec.grade}
                </Badge>
                {rec.shared_decision_making && (
                  <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                    <Info className="h-3 w-3 mr-1" />
                    SDM
                  </Badge>
                )}
                {isOverdue && (
                  <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Overdue
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-1">{rec.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {rec.target_population}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {rec.frequency}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Separator className="my-3" />
              <div className="space-y-3">
                <div>
                  <h5 className="text-sm font-medium text-slate-700">Implementation Notes</h5>
                  <p className="text-sm text-slate-600 mt-1">{rec.implementation_notes}</p>
                </div>
                
                {rec.patient_specific_notes && (
                  <div className="p-2 bg-amber-50 rounded border border-amber-200">
                    <p className="text-sm text-amber-800">
                      <strong>Patient-Specific:</strong> {rec.patient_specific_notes}
                    </p>
                  </div>
                )}

                {rec.icd10_codes.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-slate-700">ICD-10 Codes</h5>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rec.icd10_codes.map((code, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {rec.cpt_codes.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-slate-700">CPT Codes</h5>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rec.cpt_codes.map((code, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark as Completed
                  </Button>
                  <Button size="sm" variant="outline">
                    Schedule
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // Get unique categories from recommendations
  const categories = result?.recommendations
    ? [
        "all",
        ...new Set([
          ...result.recommendations.due_now.map((r) => r.category),
          ...result.recommendations.overdue.map((r) => r.category),
          ...result.recommendations.upcoming.map((r) => r.category),
        ]),
      ]
    : ["all"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-500" />
            Preventive Care
          </h2>
          <p className="text-slate-500">
            USPSTF A/B grade screening recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchRecommendations}
            disabled={isLoading || !patientId}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {!patientId ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600">Select a Patient</h3>
            <p className="text-sm text-slate-500">
              Select a patient to view personalized preventive care recommendations
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 text-emerald-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-600">Loading recommendations...</p>
          </CardContent>
        </Card>
      ) : result ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-slate-800">
                  {result.total_recommendations}
                </div>
                <p className="text-sm text-slate-500">Total Recommendations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-emerald-600">
                  {result.high_priority_count}
                </div>
                <p className="text-sm text-slate-500">Grade A (High Priority)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-red-600">
                  {result.recommendations.overdue.length}
                </div>
                <p className="text-sm text-slate-500">Overdue</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-amber-600">
                  {result.shared_decision_making_count}
                </div>
                <p className="text-sm text-slate-500">Shared Decision Making</p>
              </CardContent>
            </Card>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "all" ? "All Categories" : cat.replace("_", " ").toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recommendations Tabs */}
          <Tabs defaultValue="overdue" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overdue" className="relative">
                Overdue
                {result.recommendations.overdue.length > 0 && (
                  <Badge className="ml-2 bg-red-500">{result.recommendations.overdue.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="due_now">
                Due Now
                {result.recommendations.due_now.length > 0 && (
                  <Badge className="ml-2 bg-emerald-500">{result.recommendations.due_now.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming
                {result.recommendations.upcoming.length > 0 && (
                  <Badge className="ml-2 bg-slate-400">{result.recommendations.upcoming.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overdue" className="mt-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {filterByCategory(result.recommendations.overdue).length > 0 ? (
                    filterByCategory(result.recommendations.overdue).map((rec) => 
                      renderRecommendation(rec, true)
                    )
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center">
                        <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-slate-600">No overdue screenings</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="due_now" className="mt-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {filterByCategory(result.recommendations.due_now).length > 0 ? (
                    filterByCategory(result.recommendations.due_now).map((rec) => 
                      renderRecommendation(rec)
                    )
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center">
                        <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-600">No screenings due at this time</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="upcoming" className="mt-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {filterByCategory(result.recommendations.upcoming).length > 0 ? (
                    filterByCategory(result.recommendations.upcoming).map((rec) => 
                      renderRecommendation(rec)
                    )
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="py-8 text-center">
                        <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-600">No upcoming screenings scheduled</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

export default PreventiveCareDashboard;

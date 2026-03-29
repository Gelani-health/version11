'use client';

/**
 * Preventive Care Panel Component
 * ================================
 *
 * Displays USPSTF A/B screening recommendations for patients
 * with due/overdue status visualization and ordering capability.
 *
 * Reference: US Preventive Services Task Force Guidelines
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronRight,
  RefreshCw,
  Filter,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Activity,
  Heart,
  Brain,
  Eye,
  Baby,
  Bug,
  Pill,
  Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Types
interface ScreeningRecommendation {
  screening: {
    id: string;
    name: string;
    category: string;
    grade: string;
    description: string;
    frequency: string;
    cptCode?: string;
    icd10Code?: string;
    benefits: string[];
    harms: string[];
    source: string;
  };
  status: 'due' | 'overdue' | 'up_to_date' | 'not_applicable';
  lastPerformed?: string;
  nextDue: string;
  urgency: 'routine' | 'overdue' | 'urgent';
  patientSpecificNotes?: string;
}

interface PreventiveCarePanelProps {
  patientId?: string | null;
}

// Category icons
const categoryIcons: Record<string, React.ReactNode> = {
  cancer: <Activity className="h-4 w-4" />,
  cardiovascular: <Heart className="h-4 w-4" />,
  infectious: <Bug className="h-4 w-4" />,
  metabolic: <Pill className="h-4 w-4" />,
  mental_health: <Brain className="h-4 w-4" />,
  reproductive: <Baby className="h-4 w-4" />,
  developmental: <Baby className="h-4 w-4" />,
  sensory: <Eye className="h-4 w-4" />,
  musculoskeletal: <Stethoscope className="h-4 w-4" />,
};

// Status colors
const statusColors = {
  due: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  overdue: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  up_to_date: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  not_applicable: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300',
};

// Grade colors
const gradeColors = {
  A: 'bg-green-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-orange-500 text-white',
  I: 'bg-gray-500 text-white',
};

export function PreventiveCarePanel({ patientId }: PreventiveCarePanelProps) {
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<ScreeningRecommendation[]>([]);
  const [statistics, setStatistics] = useState<any>({});
  const [allScreenings, setAllScreenings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedScreening, setSelectedScreening] = useState<ScreeningRecommendation | null>(null);

  // Fetch screenings
  const fetchScreenings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (patientId) params.append('patientId', patientId);
      if (filterCategory !== 'all') params.append('category', filterCategory);

      const response = await fetch(`/api/preventive-care?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        if (patientId && data.recommendations) {
          setRecommendations(data.recommendations.due || []);
          // Combine due, overdue, and up_to_date
          const all = [
            ...(data.recommendations.due || []),
            ...(data.recommendations.overdue || []),
            ...(data.recommendations.upToDate || []),
          ];
          setRecommendations(all);
        } else {
          setAllScreenings(data.screenings || []);
        }
        setStatistics(data.statistics || {});
      }
    } catch (error) {
      console.error('Error fetching screenings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch preventive care data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [patientId, filterCategory, toast]);

  useEffect(() => {
    fetchScreenings();
  }, [fetchScreenings]);

  // Filter screenings
  const filteredRecommendations = recommendations.filter(rec => {
    if (filterStatus !== 'all' && rec.status !== filterStatus) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      rec.screening.name.toLowerCase().includes(query) ||
      rec.screening.description.toLowerCase().includes(query)
    );
  });

  // Order screening
  const handleOrderScreening = async () => {
    if (!selectedScreening || !patientId) return;

    try {
      const response = await fetch('/api/preventive-care', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          screeningId: selectedScreening.screening.id,
          orderedBy: 'current-user',
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `${selectedScreening.screening.name} ordered successfully`,
        });
        setOrderDialogOpen(false);
        setSelectedScreening(null);
        fetchScreenings();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to order screening',
        variant: 'destructive',
      });
    }
  };

  // Summary stats
  const summaryStats = {
    due: recommendations.filter(r => r.status === 'due').length,
    overdue: recommendations.filter(r => r.status === 'overdue').length,
    upToDate: recommendations.filter(r => r.status === 'up_to_date').length,
    total: recommendations.length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-500" />
            Preventive Care
          </h2>
          <p className="text-muted-foreground">
            USPSTF A/B screening recommendations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchScreenings}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due</p>
                <p className="text-2xl font-bold text-blue-500">{summaryStats.due}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-500">{summaryStats.overdue}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Up to Date</p>
                <p className="text-2xl font-bold text-green-500">{summaryStats.upToDate}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{summaryStats.total}</p>
              </div>
              <Shield className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search screenings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="cancer">Cancer</SelectItem>
            <SelectItem value="cardiovascular">Cardiovascular</SelectItem>
            <SelectItem value="infectious">Infectious Disease</SelectItem>
            <SelectItem value="metabolic">Metabolic</SelectItem>
            <SelectItem value="mental_health">Mental Health</SelectItem>
            <SelectItem value="reproductive">Reproductive</SelectItem>
            <SelectItem value="sensory">Sensory</SelectItem>
            <SelectItem value="musculoskeletal">Musculoskeletal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="due">Due</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="up_to_date">Up to Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Screening List */}
      <ScrollArea className="h-[calc(100vh-400px)]">
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredRecommendations.map((rec) => (
              <motion.div
                key={rec.screening.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className={`${
                  rec.status === 'overdue' ? 'border-red-200 dark:border-red-800' : ''
                }`}>
                  <Collapsible
                    open={expandedItem === rec.screening.id}
                    onOpenChange={(open) => setExpandedItem(open ? rec.screening.id : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              {categoryIcons[rec.screening.category] || <Shield className="h-4 w-4" />}
                            </div>
                            <div>
                              <CardTitle className="text-base">{rec.screening.name}</CardTitle>
                              <CardDescription className="text-xs">
                                {rec.screening.frequency} • {rec.screening.source}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={gradeColors[rec.screening.grade as keyof typeof gradeColors]}>
                              Grade {rec.screening.grade}
                            </Badge>
                            <Badge className={statusColors[rec.status]}>
                              {rec.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                            {expandedItem === rec.screening.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-4">
                        <Separator className="mb-4" />
                        <div className="grid gap-4">
                          {/* Description */}
                          <div>
                            <p className="text-sm text-muted-foreground">{rec.screening.description}</p>
                          </div>

                          {/* Status Details */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Status</p>
                              <p className="text-sm capitalize">{rec.status.replace('_', ' ')}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Next Due</p>
                              <p className="text-sm">
                                {rec.nextDue ? new Date(rec.nextDue).toLocaleDateString() : 'Now'}
                              </p>
                            </div>
                            {rec.lastPerformed && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Last Performed</p>
                                <p className="text-sm">{new Date(rec.lastPerformed).toLocaleDateString()}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Codes</p>
                              <p className="text-sm">
                                {rec.screening.cptCode && `CPT: ${rec.screening.cptCode}`}
                                {rec.screening.icd10Code && ` • ICD-10: ${rec.screening.icd10Code}`}
                              </p>
                            </div>
                          </div>

                          {/* Patient Notes */}
                          {rec.patientSpecificNotes && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                              <p className="text-sm text-amber-800 dark:text-amber-200">
                                <Info className="h-4 w-4 inline mr-2" />
                                {rec.patientSpecificNotes}
                              </p>
                            </div>
                          )}

                          {/* Benefits & Harms */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-green-600 mb-1">Benefits</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {rec.screening.benefits.slice(0, 2).map((b, i) => (
                                  <li key={i}>• {b}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-amber-600 mb-1">Potential Harms</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {rec.screening.harms.slice(0, 2).map((h, i) => (
                                  <li key={i}>• {h}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          {(rec.status === 'due' || rec.status === 'overdue') && patientId && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedScreening(rec);
                                  setOrderDialogOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Order Screening
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredRecommendations.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              {patientId
                ? 'No preventive care recommendations for this patient'
                : 'Select a patient to see personalized recommendations'}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Screening</DialogTitle>
            <DialogDescription>
              Create a clinical order for this preventive screening
            </DialogDescription>
          </DialogHeader>
          {selectedScreening && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium">{selectedScreening.screening.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedScreening.screening.description}
                </p>
                {selectedScreening.screening.cptCode && (
                  <p className="text-xs mt-1">CPT: {selectedScreening.screening.cptCode}</p>
                )}
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  Ensure shared decision-making discussion has occurred with the patient before ordering.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOrderScreening}>
              Confirm Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PreventiveCarePanel;

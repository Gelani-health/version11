"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Star,
  ThumbsUp,
  Activity,
  Loader2,
  BarChart3,
  RefreshCw,
  Zap,
  Award,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface RLStats {
  totalFeedback: number;
  overallAcceptance: number;
  overallHelpful: number;
  recentAccuracy: number;
  arms: Array<{
    id: string;
    armKey: string;
    armType: string;
    category: string;
    totalPulls: number;
    averageReward: number;
    qValue: number;
    acceptanceRate: number;
    avgRating: number;
    alpha: number;
    beta: number;
  }>;
  topPerformers: Array<{
    id: string;
    armKey: string;
    armType: string;
    category: string;
    totalPulls: number;
    qValue: number;
    averageReward: number;
  }>;
  needsExploration: Array<{
    id: string;
    armKey: string;
    armType: string;
    category: string;
    totalPulls: number;
  }>;
}

export function RLDashboard() {
  const [stats, setStats] = useState<RLStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/rl");
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch RL stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      const response = await fetch("/api/rl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "init" }),
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
        toast({
          title: "Initialized",
          description: "RL system initialized with default suggestion categories",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initialize RL system",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="flex flex-col items-center justify-center h-[300px]">
          <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
          <h3 className="font-medium text-slate-600 mb-2">RL System Not Initialized</h3>
          <Button onClick={handleInitialize} disabled={isInitializing}>
            {isInitializing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Initialize RL System
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" />
            Reinforcement Learning
          </h2>
          <p className="text-slate-500">AI learns from doctor feedback to improve suggestions</p>
        </div>
        <Button variant="outline" onClick={fetchStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Algorithm Overview */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <Brain className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Multi-Armed Bandit Learning</h3>
              <p className="text-purple-100">Combining UCB, Thompson Sampling, and Q-Learning</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white/20 rounded-lg p-3">
              <p className="text-purple-100 text-sm">UCB Algorithm</p>
              <p className="text-xl font-bold">Active</p>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <p className="text-purple-100 text-sm">Thompson Sampling</p>
              <p className="text-xl font-bold">Active</p>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <p className="text-purple-100 text-sm">Q-Learning</p>
              <p className="text-xl font-bold">Active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalFeedback}</p>
                <p className="text-sm text-slate-500">Total Feedback</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <ThumbsUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(stats.overallHelpful * 100)}%
                </p>
                <p className="text-sm text-slate-500">Helpful Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(stats.overallAcceptance * 100)}%
                </p>
                <p className="text-sm text-slate-500">Acceptance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(stats.recentAccuracy * 100)}%
                </p>
                <p className="text-sm text-slate-500">Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Top Performing Categories
            </CardTitle>
            <CardDescription>Suggestion types with highest learned value</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topPerformers.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No feedback data yet. Start rating AI suggestions!
              </p>
            ) : (
              <div className="space-y-3">
                {stats.topPerformers.map((arm, index) => (
                  <motion.div
                    key={arm.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium capitalize">{arm.category}</p>
                        <p className="text-xs text-slate-500">{arm.armType}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">
                          {Math.round(arm.qValue * 100)}%
                        </p>
                        <p className="text-xs text-slate-500">{arm.totalPulls} ratings</p>
                      </div>
                    </div>
                    <Progress
                      value={arm.qValue * 100}
                      className="h-2 mt-2"
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Needs Exploration */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-500" />
              Needs More Feedback
            </CardTitle>
            <CardDescription>Categories that would benefit from more ratings</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.needsExploration.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                All categories have sufficient feedback!
              </p>
            ) : (
              <div className="space-y-2">
                {stats.needsExploration.map((arm) => (
                  <div
                    key={arm.id}
                    className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100"
                  >
                    <div>
                      <p className="font-medium capitalize">{arm.category}</p>
                      <p className="text-xs text-slate-500">{arm.armType}</p>
                    </div>
                    <Badge variant="outline" className="bg-purple-100 border-purple-200 text-purple-700">
                      {arm.totalPulls} ratings
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Arms Table */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            All Learning Categories
          </CardTitle>
          <CardDescription>Detailed view of all suggestion type performance</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {stats.arms.map((arm) => (
                <div
                  key={arm.id}
                  className="grid grid-cols-12 gap-2 p-3 bg-slate-50 rounded-lg items-center"
                >
                  <div className="col-span-3">
                    <p className="font-medium capitalize text-sm">{arm.category}</p>
                    <p className="text-xs text-slate-500">{arm.armType}</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="text-sm font-medium">{arm.totalPulls}</p>
                    <p className="text-xs text-slate-500">Ratings</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="text-sm font-medium text-emerald-600">
                      {Math.round(arm.qValue * 100)}%
                    </p>
                    <p className="text-xs text-slate-500">Q-Value</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="text-sm font-medium">
                      {arm.avgRating.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-500">Avg Rating</p>
                  </div>
                  <div className="col-span-3">
                    <Progress
                      value={arm.qValue * 100}
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="border-0 shadow-md bg-slate-800 text-white">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5" />
            How Reinforcement Learning Improves Suggestions
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl mb-2">1️⃣</div>
              <h4 className="font-medium mb-1">Doctor Feedback</h4>
              <p className="text-sm text-slate-300">
                Rate AI suggestions with thumbs up/down or 1-5 stars
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl mb-2">2️⃣</div>
              <h4 className="font-medium mb-1">Learning Update</h4>
              <p className="text-sm text-slate-300">
                Algorithm updates confidence weights using UCB, Thompson Sampling, and Q-Learning
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl mb-2">3️⃣</div>
              <h4 className="font-medium mb-1">Better Suggestions</h4>
              <p className="text-sm text-slate-300">
                Future suggestions are adjusted based on learned preferences
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

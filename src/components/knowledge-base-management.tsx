"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Search,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Pill,
  Activity,
  Brain,
  FileText,
  Plus,
  Trash2,
  Edit,
  Eye,
  Sparkles,
  BarChart3,
  Clock,
  Hash,
  Tag,
  Loader2,
  Play,
  Pause,
  Settings,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface KnowledgeStats {
  totalKnowledge: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
  cacheEntries: number;
  coverage: number;
  byCategory: Array<{ category: string; count: number }>;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  category: string;
  subcategory: string | null;
  specialty: string | null;
  source: string | null;
  evidenceLevel: string | null;
  retrievalCount: number;
  embedding: string | null;
  createdAt: string;
}

export function KnowledgeBaseManagement() {
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/knowledge/embeddings");
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      toast.error("Failed to load knowledge base statistics");
    } finally {
      setIsLoading(false);
    }
  };

  const generateAllEmbeddings = async () => {
    try {
      setIsGenerating(true);
      toast.info("Starting embedding generation...");

      const response = await fetch("/api/knowledge/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-all" }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Generated embeddings for ${data.data.updated} entries`);
        fetchStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Failed to generate embeddings:", error);
      toast.error("Failed to generate embeddings");
    } finally {
      setIsGenerating(false);
    }
  };

  const searchKnowledge = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(`/api/rag-healthcare?q=${encodeURIComponent(searchQuery)}&limit=20&mode=semantic`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.data.results);
        toast.success(`Found ${data.data.count} results`);
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("Search failed");
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "clinical-guideline": return <BookOpen className="h-4 w-4" />;
      case "drug-interaction": return <Pill className="h-4 w-4" />;
      case "lab-interpretation": return <Activity className="h-4 w-4" />;
      case "treatment": return <Brain className="h-4 w-4" />;
      case "symptom": return <FileText className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "clinical-guideline": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "drug-interaction": return "bg-rose-100 text-rose-700 border-rose-200";
      case "lab-interpretation": return "bg-blue-100 text-blue-700 border-blue-200";
      case "treatment": return "bg-purple-100 text-purple-700 border-purple-200";
      case "symptom": return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="h-6 w-6 text-emerald-500" />
            Knowledge Base Management
          </h2>
          <p className="text-slate-500">Manage medical knowledge and vector embeddings for RAG</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
            <Sparkles className="h-3 w-3 mr-1" />
            Vector RAG
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
            Semantic Search
          </Badge>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <BookOpen className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats?.totalKnowledge || 0}</p>
                <p className="text-sm text-slate-500">Total Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats?.withEmbeddings || 0}</p>
                <p className="text-sm text-slate-500">With Embeddings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats?.coverage || 0}%</p>
                <p className="text-sm text-slate-500">Coverage</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Database className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats?.cacheEntries || 0}</p>
                <p className="text-sm text-slate-500">Cache Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Embedding Generation Progress */}
      {stats && stats.withoutEmbeddings > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">Missing Embeddings</p>
                  <p className="text-sm text-amber-700">
                    {stats.withoutEmbeddings} entries need vector embeddings for semantic search
                  </p>
                </div>
              </div>
              <Button
                onClick={generateAllEmbeddings}
                disabled={isGenerating}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Embeddings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-emerald-500" />
            Knowledge by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats?.byCategory.map((cat) => (
              <div
                key={cat.category}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${getCategoryColor(cat.category)}`}
                onClick={() => setCategoryFilter(cat.category)}
              >
                <div className="flex items-center gap-2 mb-1">
                  {getCategoryIcon(cat.category)}
                  <span className="text-sm font-medium capitalize">{cat.category.replace("-", " ")}</span>
                </div>
                <p className="text-xl font-bold">{cat.count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search & Browse */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-emerald-500" />
            Search Knowledge Base
          </CardTitle>
          <CardDescription>Search using semantic vector similarity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search medical knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchKnowledge()}
              className="flex-1"
            />
            <Button onClick={searchKnowledge}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          {searchResults.length > 0 && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {searchResults.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-slate-50 rounded-lg border hover:border-emerald-300 transition-colors cursor-pointer"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(entry.category)}
                        <h4 className="font-medium text-slate-800">{entry.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getCategoryColor(entry.category)}>
                          {entry.category}
                        </Badge>
                        {entry.embedding && (
                          <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Vectorized
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {entry.summary || entry.content.slice(0, 200)}...
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      {entry.specialty && (
                        <span className="flex items-center gap-1">
                          <Brain className="h-3 w-3" />
                          {entry.specialty}
                        </span>
                      )}
                      {entry.source && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {entry.source}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {entry.retrievalCount} retrievals
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Entry Detail Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedEntry(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getCategoryIcon(selectedEntry.category)}
                    <h3 className="text-xl font-bold text-slate-800">{selectedEntry.title}</h3>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedEntry(null)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={getCategoryColor(selectedEntry.category)}>
                    {selectedEntry.category}
                  </Badge>
                  {selectedEntry.specialty && (
                    <Badge variant="outline">{selectedEntry.specialty}</Badge>
                  )}
                  {selectedEntry.evidenceLevel && (
                    <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
                      Level {selectedEntry.evidenceLevel}
                    </Badge>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[60vh] p-6">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 p-4 rounded-lg overflow-x-auto">
                    {selectedEntry.content}
                  </pre>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Source</p>
                    <p className="font-medium">{selectedEntry.source || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Retrieval Count</p>
                    <p className="font-medium">{selectedEntry.retrievalCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Vector Status</p>
                    <p className="font-medium flex items-center gap-1">
                      {selectedEntry.embedding ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          Embedding Generated
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          No Embedding
                        </>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Created</p>
                    <p className="font-medium">{new Date(selectedEntry.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </ScrollArea>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vector RAG Info */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-purple-800">Vector-Based RAG System</h3>
              <p className="text-sm text-purple-700">
                This knowledge base uses semantic vector embeddings for intelligent retrieval.
                Unlike keyword search, vector search understands medical context and finds
                relevant information even when exact terms aren't used.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-800">{stats?.coverage || 0}%</p>
              <p className="text-sm text-purple-600">Vectorized</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

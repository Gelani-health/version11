"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Beaker,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Loader2,
  TestTube,
  Droplets,
  Activity,
  User,
  Calendar,
  FileText,
  FlaskConical,
  ClipboardList,
  Check,
  X,
  Send,
  RefreshCw,
  Save,
  ChevronDown,
  ChevronRight,
  Printer,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================
// LAB TEST CATALOG
// ============================================

const LAB_TEST_CATALOG = {
  haematology: {
    name: "Haematology",
    icon: Droplets,
    color: "text-red-500",
    bgColor: "bg-red-50",
    tests: [
      // CBC
      { name: "Hemoglobin (Hb)", code: "HGB", unit: "g/dL", maleRange: "13.5-17.5", femaleRange: "12.0-16.0", subcategory: "CBC" },
      { name: "Hematocrit (Hct)", code: "HCT", unit: "%", maleRange: "40-54", femaleRange: "36-48", subcategory: "CBC" },
      { name: "RBC Count", code: "RBC", unit: "x10^6/µL", maleRange: "4.5-5.9", femaleRange: "4.0-5.2", subcategory: "CBC" },
      { name: "WBC Count", code: "WBC", unit: "x10^3/µL", maleRange: "4.5-11.0", femaleRange: "4.5-11.0", subcategory: "CBC" },
      { name: "Platelet Count", code: "PLT", unit: "x10^3/µL", maleRange: "150-400", femaleRange: "150-400", subcategory: "CBC" },
      { name: "MCV", code: "MCV", unit: "fL", maleRange: "80-100", femaleRange: "80-100", subcategory: "CBC" },
      { name: "MCH", code: "MCH", unit: "pg", maleRange: "27-33", femaleRange: "27-33", subcategory: "CBC" },
      { name: "MCHC", code: "MCHC", unit: "g/dL", maleRange: "32-36", femaleRange: "32-36", subcategory: "CBC" },
      { name: "RDW", code: "RDW", unit: "%", maleRange: "11.5-14.5", femaleRange: "11.5-14.5", subcategory: "CBC" },
      // Differential
      { name: "Neutrophils %", code: "NEUT%", unit: "%", maleRange: "40-75", femaleRange: "40-75", subcategory: "Differential" },
      { name: "Lymphocytes %", code: "LYMPH%", unit: "%", maleRange: "20-45", femaleRange: "20-45", subcategory: "Differential" },
      { name: "Monocytes %", code: "MONO%", unit: "%", maleRange: "2-10", femaleRange: "2-10", subcategory: "Differential" },
      { name: "Eosinophils %", code: "EOS%", unit: "%", maleRange: "0-6", femaleRange: "0-6", subcategory: "Differential" },
      { name: "Basophils %", code: "BASO%", unit: "%", maleRange: "0-2", femaleRange: "0-2", subcategory: "Differential" },
      // Coagulation
      { name: "Prothrombin Time (PT)", code: "PT", unit: "sec", maleRange: "11-13.5", femaleRange: "11-13.5", subcategory: "Coagulation" },
      { name: "INR", code: "INR", unit: "", maleRange: "0.9-1.2", femaleRange: "0.9-1.2", subcategory: "Coagulation" },
      { name: "APTT", code: "APTT", unit: "sec", maleRange: "25-35", femaleRange: "25-35", subcategory: "Coagulation" },
      { name: "ESR", code: "ESR", unit: "mm/hr", maleRange: "0-15", femaleRange: "0-20", subcategory: "Special" },
      { name: "Blood Group", code: "BG", unit: "", maleRange: "", femaleRange: "", subcategory: "Special" },
    ],
  },
  chemistry: {
    name: "Clinical Chemistry",
    icon: TestTube,
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    tests: [
      // Renal
      { name: "Urea", code: "UREA", unit: "mg/dL", maleRange: "7-20", femaleRange: "7-20", subcategory: "Renal" },
      { name: "Creatinine", code: "CREA", unit: "mg/dL", maleRange: "0.7-1.3", femaleRange: "0.6-1.1", subcategory: "Renal" },
      { name: "eGFR", code: "eGFR", unit: "mL/min", maleRange: ">90", femaleRange: ">90", subcategory: "Renal" },
      { name: "Uric Acid", code: "URIC", unit: "mg/dL", maleRange: "3.5-7.2", femaleRange: "2.6-6.0", subcategory: "Renal" },
      // Electrolytes
      { name: "Sodium", code: "NA", unit: "mmol/L", maleRange: "136-145", femaleRange: "136-145", subcategory: "Electrolytes" },
      { name: "Potassium", code: "K", unit: "mmol/L", maleRange: "3.5-5.0", femaleRange: "3.5-5.0", subcategory: "Electrolytes" },
      { name: "Chloride", code: "CL", unit: "mmol/L", maleRange: "98-107", femaleRange: "98-107", subcategory: "Electrolytes" },
      { name: "Bicarbonate", code: "HCO3", unit: "mmol/L", maleRange: "22-28", femaleRange: "22-28", subcategory: "Electrolytes" },
      // Liver
      { name: "ALT (SGPT)", code: "ALT", unit: "U/L", maleRange: "7-56", femaleRange: "7-56", subcategory: "Liver" },
      { name: "AST (SGOT)", code: "AST", unit: "U/L", maleRange: "10-40", femaleRange: "10-40", subcategory: "Liver" },
      { name: "ALP", code: "ALP", unit: "U/L", maleRange: "44-147", femaleRange: "44-147", subcategory: "Liver" },
      { name: "GGT", code: "GGT", unit: "U/L", maleRange: "9-48", femaleRange: "7-32", subcategory: "Liver" },
      { name: "Total Bilirubin", code: "TBIL", unit: "mg/dL", maleRange: "0.3-1.2", femaleRange: "0.3-1.2", subcategory: "Liver" },
      { name: "Direct Bilirubin", code: "DBIL", unit: "mg/dL", maleRange: "0.0-0.3", femaleRange: "0.0-0.3", subcategory: "Liver" },
      { name: "Total Protein", code: "TP", unit: "g/dL", maleRange: "6.0-8.3", femaleRange: "6.0-8.3", subcategory: "Liver" },
      { name: "Albumin", code: "ALB", unit: "g/dL", maleRange: "3.5-5.5", femaleRange: "3.5-5.5", subcategory: "Liver" },
      // Lipid
      { name: "Total Cholesterol", code: "CHOL", unit: "mg/dL", maleRange: "<200", femaleRange: "<200", subcategory: "Lipid" },
      { name: "HDL Cholesterol", code: "HDL", unit: "mg/dL", maleRange: ">40", femaleRange: ">50", subcategory: "Lipid" },
      { name: "LDL Cholesterol", code: "LDL", unit: "mg/dL", maleRange: "<100", femaleRange: "<100", subcategory: "Lipid" },
      { name: "Triglycerides", code: "TG", unit: "mg/dL", maleRange: "<150", femaleRange: "<150", subcategory: "Lipid" },
      // Diabetes
      { name: "Fasting Glucose", code: "FBG", unit: "mg/dL", maleRange: "70-100", femaleRange: "70-100", subcategory: "Diabetes" },
      { name: "HbA1c", code: "HBA1C", unit: "%", maleRange: "4.0-5.6", femaleRange: "4.0-5.6", subcategory: "Diabetes" },
      // Thyroid
      { name: "TSH", code: "TSH", unit: "mIU/L", maleRange: "0.4-4.0", femaleRange: "0.4-4.0", subcategory: "Thyroid" },
      { name: "Free T4", code: "FT4", unit: "ng/dL", maleRange: "0.8-1.8", femaleRange: "0.8-1.8", subcategory: "Thyroid" },
    ],
  },
  urinalysis: {
    name: "Urinalysis",
    icon: Activity,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
    tests: [
      { name: "Color", code: "UCOLOR", unit: "", maleRange: "Yellow", femaleRange: "Yellow", subcategory: "Physical" },
      { name: "Appearance", code: "UAPPEAR", unit: "", maleRange: "Clear", femaleRange: "Clear", subcategory: "Physical" },
      { name: "Specific Gravity", code: "USG", unit: "", maleRange: "1.005-1.030", femaleRange: "1.005-1.030", subcategory: "Physical" },
      { name: "pH", code: "UPH", unit: "", maleRange: "4.6-8.0", femaleRange: "4.6-8.0", subcategory: "Physical" },
      { name: "Protein", code: "UPROT", unit: "", maleRange: "Negative", femaleRange: "Negative", subcategory: "Chemical" },
      { name: "Glucose", code: "UGLU", unit: "", maleRange: "Negative", femaleRange: "Negative", subcategory: "Chemical" },
      { name: "Ketones", code: "UKET", unit: "", maleRange: "Negative", femaleRange: "Negative", subcategory: "Chemical" },
      { name: "Blood", code: "UBLD", unit: "", maleRange: "Negative", femaleRange: "Negative", subcategory: "Chemical" },
      { name: "Leukocytes", code: "ULEU", unit: "", maleRange: "Negative", femaleRange: "Negative", subcategory: "Chemical" },
      { name: "RBC", code: "URBC", unit: "/HPF", maleRange: "0-3", femaleRange: "0-3", subcategory: "Microscopic" },
      { name: "WBC", code: "UWBC", unit: "/HPF", maleRange: "0-5", femaleRange: "0-5", subcategory: "Microscopic" },
    ],
  },
};

// Quick Lab Panels
const LAB_PANELS = {
  cbc: { name: "Complete Blood Count (CBC)", category: "haematology", tests: ["HGB", "HCT", "RBC", "WBC", "PLT", "MCV", "MCH", "MCHC", "RDW"] },
  cbcDiff: { name: "CBC with Differential", category: "haematology", tests: ["HGB", "HCT", "RBC", "WBC", "PLT", "MCV", "MCH", "MCHC", "NEUT%", "LYMPH%", "MONO%", "EOS%", "BASO%"] },
  renal: { name: "Renal Function Panel", category: "chemistry", tests: ["UREA", "CREA", "NA", "K", "CL", "eGFR"] },
  liver: { name: "Liver Function Panel", category: "chemistry", tests: ["ALT", "AST", "ALP", "GGT", "TBIL", "DBIL", "TP", "ALB"] },
  lipid: { name: "Lipid Profile", category: "chemistry", tests: ["CHOL", "HDL", "LDL", "TG"] },
  electrolytes: { name: "Electrolyte Panel", category: "chemistry", tests: ["NA", "K", "CL", "HCO3"] },
  thyroid: { name: "Thyroid Panel", category: "chemistry", tests: ["TSH", "FT4"] },
  diabetes: { name: "Diabetes Panel", category: "chemistry", tests: ["FBG", "HBA1C"] },
  coagulation: { name: "Coagulation Panel", category: "haematology", tests: ["PT", "INR", "APTT"] },
  urinalysis: { name: "Complete Urinalysis", category: "urinalysis", tests: ["UCOLOR", "UAPPEAR", "USG", "UPH", "UPROT", "UGLU", "UKET", "UBLD", "ULEU", "URBC", "UWBC"] },
};

// ============================================
// TYPES
// ============================================

interface LabOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    gender?: string;
    dateOfBirth?: string;
  };
  orderDate: string;
  priority: string;
  status: string;
  clinicalNotes?: string;
  diagnosis?: string;
  orderedBy?: string;
  sampleCollected: boolean;
  collectedAt?: string;
  collectedBy?: string;
  orderItems: LabOrderItem[];
}

interface LabOrderItem {
  id: string;
  testName: string;
  testCode?: string;
  category?: string;
  subcategory?: string;
  unit?: string;
  referenceRange?: string;
  status: string;
  resultValue?: string;
  interpretation?: string;
  resultNotes?: string;
  resultEnteredAt?: string;
  enteredBy?: string;
}

interface SelectedTest {
  name: string;
  code: string;
  category: string;
  subcategory: string;
  unit: string;
  referenceRange: string;
}

// ============================================
// COMPONENT
// ============================================

interface LabModuleProps {
  patientId?: string;
  patientGender?: string;
  patientName?: string;
  mode?: "ordering" | "results" | "both";
}

export function LabModule({ 
  patientId, 
  patientGender = "male",
  patientName,
  mode = "both" 
}: LabModuleProps) {
  const [activeTab, setActiveTab] = useState<string>(mode === "results" ? "results" : "ordering");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Lab Order State
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [orderPriority, setOrderPriority] = useState<string>("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("haematology");
  const [activeSubcategory, setActiveSubcategory] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["haematology"]));

  // Lab Results State
  const [pendingOrders, setPendingOrders] = useState<LabOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [resultValues, setResultValues] = useState<Record<string, string>>({});
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);
  const [showConfirmResults, setShowConfirmResults] = useState(false);

  // Fetch pending orders for results entry
  useEffect(() => {
    if (activeTab === "results") {
      fetchPendingOrders();
    }
  }, [activeTab, patientId]);

  const fetchPendingOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (patientId) params.append("patientId", patientId);
      params.append("status", "pending,collected,in-lab");
      
      const response = await fetch(`/api/lab-orders?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setPendingOrders(data.data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add test to selection
  const addTest = (test: typeof LAB_TEST_CATALOG.haematology.tests[0], categoryName: string) => {
    const exists = selectedTests.some(t => t.code === test.code);
    if (exists) {
      setSelectedTests(prev => prev.filter(t => t.code !== test.code));
    } else {
      setSelectedTests(prev => [...prev, {
        name: test.name,
        code: test.code,
        category: categoryName,
        subcategory: test.subcategory,
        unit: test.unit,
        referenceRange: patientGender === "female" ? test.femaleRange : test.maleRange,
      }]);
    }
  };

  // Add panel
  const addPanel = (panelKey: keyof typeof LAB_PANELS) => {
    const panel = LAB_PANELS[panelKey];
    const category = LAB_TEST_CATALOG[panel.category as keyof typeof LAB_TEST_CATALOG];
    
    panel.tests.forEach(code => {
      const test = category.tests.find(t => t.code === code);
      if (test && !selectedTests.some(s => s.code === code)) {
        addTest(test, panel.category);
      }
    });
    
    toast({
      title: "Panel Added",
      description: `${panel.name} tests added`,
    });
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTests([]);
    setClinicalNotes("");
    setDiagnosis("");
  };

  // Submit lab order
  const submitOrder = async () => {
    if (!patientId) {
      toast({ title: "Error", description: "Please select a patient first", variant: "destructive" });
      return;
    }
    
    if (selectedTests.length === 0) {
      toast({ title: "Error", description: "Please select at least one test", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/lab-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          priority: orderPriority,
          clinicalNotes,
          diagnosis,
          tests: selectedTests,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Order Submitted",
          description: `Lab order ${data.data.orderNumber} created successfully`,
        });
        clearSelection();
        setShowConfirmOrder(false);
        if (mode === "both") {
          setActiveTab("results");
          fetchPendingOrders();
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit lab order",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Collect sample
  const collectSample = async (orderId: string) => {
    try {
      const response = await fetch("/api/lab-orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          action: "collectSample",
          data: { collectedBy: "Lab Tech" },
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sample Collected",
          description: "Sample has been collected",
        });
        fetchPendingOrders();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update sample status",
        variant: "destructive",
      });
    }
  };

  // Update result value
  const updateResultValue = (itemId: string, value: string) => {
    setResultValues(prev => ({ ...prev, [itemId]: value }));
  };

  // Save results
  const saveResults = async () => {
    if (!selectedOrder) return;

    setIsSaving(true);
    try {
      const updates = selectedOrder.orderItems.map(item => ({
        itemId: item.id,
        resultValue: resultValues[item.id] || "",
      }));

      for (const update of updates) {
        if (update.resultValue) {
          await fetch("/api/lab-orders", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: update.itemId,
              action: "updateItemResult",
              data: {
                resultValue: update.resultValue,
                status: "completed",
                enteredBy: "Lab Tech",
              },
            }),
          });
        }
      }

      toast({
        title: "Results Saved",
        description: "Lab results have been saved successfully",
      });
      
      setShowConfirmResults(false);
      setSelectedOrder(null);
      setResultValues({});
      fetchPendingOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save results",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-slate-100 text-slate-700",
      collected: "bg-blue-100 text-blue-700",
      "in-lab": "bg-purple-100 text-purple-700",
      completed: "bg-emerald-100 text-emerald-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return (
      <Badge className={styles[status] || styles.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      routine: "bg-slate-100 text-slate-600",
      urgent: "bg-amber-100 text-amber-700",
      stat: "bg-red-100 text-red-700",
    };
    return (
      <Badge variant="outline" className={styles[priority] || styles.routine}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  // Filter tests by search
  const getFilteredTests = () => {
    if (searchQuery) {
      const results: typeof LAB_TEST_CATALOG.haematology.tests = [];
      Object.values(LAB_TEST_CATALOG).forEach(cat => {
        cat.tests.forEach(test => {
          if (test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              test.code.toLowerCase().includes(searchQuery.toLowerCase())) {
            results.push(test);
          }
        });
      });
      return results;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      {mode === "both" && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ordering" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Lab Orders
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Enter Results
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* ============================================ */}
      {/* LAB ORDERING TAB */}
      {/* ============================================ */}
      {(activeTab === "ordering" || mode === "ordering") && (
        <div className="space-y-4">
          {/* Header */}
          <Card className="border-0 shadow-md bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Lab Test Ordering</h3>
                    <p className="text-sm text-white/80">Select tests and submit lab order</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-white/20 text-white">
                    {selectedTests.length} tests selected
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Panels */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-slate-600">Quick Panels:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(LAB_PANELS).map(([key, panel]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                    onClick={() => addPanel(key as keyof typeof LAB_PANELS)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {panel.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Test Selection */}
            <div className="lg:col-span-2 space-y-4">
              {/* Search */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search tests by name or code..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Category Tabs */}
              {!searchQuery && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {Object.entries(LAB_TEST_CATALOG).map(([key, cat]) => {
                    const Icon = cat.icon;
                    return (
                      <Button
                        key={key}
                        variant={activeCategory === key ? "default" : "outline"}
                        className={activeCategory === key ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                        onClick={() => setActiveCategory(key)}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {cat.name}
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* Tests List */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="p-4 space-y-1">
                      {(searchQuery ? getFilteredTests() : LAB_TEST_CATALOG[activeCategory as keyof typeof LAB_TEST_CATALOG]?.tests)?.map(test => {
                        const isSelected = selectedTests.some(t => t.code === test.code);
                        return (
                          <div
                            key={test.code}
                            onClick={() => addTest(test, activeCategory)}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                              isSelected
                                ? "bg-emerald-50 border-emerald-300"
                                : "bg-white hover:bg-slate-50 border-slate-200"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center",
                                isSelected ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                              )}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{test.name}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <Badge variant="outline" className="text-xs">{test.code}</Badge>
                                  <span>{test.subcategory}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium">
                                {patientGender === "female" ? test.femaleRange : test.maleRange || "-"}
                              </p>
                              <p className="text-xs text-slate-400">{test.unit}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-md sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Priority */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Priority</Label>
                    <Select value={orderPriority} onValueChange={setOrderPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Routine</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="stat">STAT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clinical Notes */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Clinical Notes</Label>
                    <Textarea
                      placeholder="Reason for test, clinical history..."
                      value={clinicalNotes}
                      onChange={e => setClinicalNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Diagnosis */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Working Diagnosis</Label>
                    <Input
                      placeholder="e.g., Anemia, Diabetes screening"
                      value={diagnosis}
                      onChange={e => setDiagnosis(e.target.value)}
                    />
                  </div>

                  <Separator />

                  {/* Selected Tests */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Selected Tests</Label>
                      <span className="text-xs text-slate-500">{selectedTests.length} tests</span>
                    </div>
                    <ScrollArea className="h-[200px]">
                      {selectedTests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                          <Beaker className="h-8 w-8 mb-2" />
                          <p className="text-sm">No tests selected</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedTests.map(test => (
                            <div key={test.code} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium">{test.name}</p>
                                <p className="text-xs text-slate-500">{test.code} • {test.category}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => addTest({ code: test.code } as any, test.category)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={clearSelection}
                      disabled={selectedTests.length === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500"
                      onClick={() => setShowConfirmOrder(true)}
                      disabled={selectedTests.length === 0 || isSaving || !patientId}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Submit Order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* LAB RESULTS ENTRY TAB */}
      {/* ============================================ */}
      {(activeTab === "results" || mode === "results") && (
        <div className="space-y-4">
          {/* Header */}
          <Card className="border-0 shadow-md bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <FlaskConical className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Lab Results Entry</h3>
                    <p className="text-sm text-white/80">Enter results for pending lab orders</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  onClick={fetchPendingOrders}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : selectedOrder ? (
            // Results Entry Form
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Order: {selectedOrder.orderNumber}
                    </CardTitle>
                    <CardDescription>
                      Patient: {selectedOrder.patient.firstName} {selectedOrder.patient.lastName} ({selectedOrder.patient.mrn})
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                    <X className="h-4 w-4 mr-1" />
                    Back to List
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {selectedOrder.orderItems.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.testName}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Badge variant="outline">{item.testCode}</Badge>
                            <span>{item.subcategory}</span>
                          </div>
                        </div>
                        <div className="text-right w-24">
                          <p className="text-sm font-medium">{item.referenceRange || "-"}</p>
                          <p className="text-xs text-slate-400">Ref Range</p>
                        </div>
                        <div className="w-32">
                          <Input
                            placeholder="Enter result"
                            value={resultValues[item.id] || ""}
                            onChange={e => updateResultValue(item.id, e.target.value)}
                          />
                        </div>
                        <div className="w-20 text-center">
                          <p className="text-xs text-slate-500">{item.unit || "-"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-gradient-to-r from-purple-500 to-indigo-500"
                    onClick={() => setShowConfirmResults(true)}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Results
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Pending Orders List
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Pending Lab Orders</CardTitle>
                <CardDescription>
                  {pendingOrders.length} order(s) awaiting results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <CheckCircle className="h-12 w-12 text-slate-300 mb-4" />
                    <p className="text-slate-500">No pending lab orders</p>
                    <p className="text-sm text-slate-400">All lab orders have been processed</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {pendingOrders.map(order => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarFallback className="bg-purple-100 text-purple-700">
                                {order.patient.firstName[0]}{order.patient.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{order.patient.firstName} {order.patient.lastName}</p>
                                <span className="text-sm text-slate-500">({order.patient.mrn})</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="font-mono">{order.orderNumber}</Badge>
                                {getPriorityBadge(order.priority)}
                                {getStatusBadge(order.status)}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                {order.orderItems.length} test(s) • Ordered: {new Date(order.orderDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!order.sampleCollected && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => collectSample(order.id)}
                              >
                                <Droplets className="h-4 w-4 mr-1" />
                                Collect
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="bg-purple-500 hover:bg-purple-600"
                              onClick={() => {
                                setSelectedOrder(order);
                                // Initialize result values
                                const values: Record<string, string> = {};
                                order.orderItems.forEach(item => {
                                  values[item.id] = item.resultValue || "";
                                });
                                setResultValues(values);
                              }}
                            >
                              <FlaskConical className="h-4 w-4 mr-1" />
                              Enter Results
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Confirm Order Dialog */}
      <Dialog open={showConfirmOrder} onOpenChange={setShowConfirmOrder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Lab Order?</DialogTitle>
            <DialogDescription>
              You are about to submit a lab order with {selectedTests.length} test(s).
              <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                <p className="text-sm"><strong>Priority:</strong> {orderPriority.toUpperCase()}</p>
                {diagnosis && <p className="text-sm"><strong>Diagnosis:</strong> {diagnosis}</p>}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmOrder(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
              onClick={submitOrder}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Results Dialog */}
      <Dialog open={showConfirmResults} onOpenChange={setShowConfirmResults}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Lab Results?</DialogTitle>
            <DialogDescription>
              You are about to save results for order {selectedOrder?.orderNumber}.
              <div className="mt-2">
                <p className="text-sm font-medium">Results to save:</p>
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {selectedOrder?.orderItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm py-1">
                      <span>{item.testName}</span>
                      <span className="font-medium">{resultValues[item.id] || "No value"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmResults(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-r from-purple-500 to-indigo-500"
              onClick={saveResults}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LabModule;

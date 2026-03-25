"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Activity, 
  Brain, 
  FileText, 
  Pill, 
  Image as ImageIcon, 
  Mic, 
  Users, 
  Settings,
  Stethoscope,
  Heart,
  AlertTriangle,
  Search,
  Menu,
  X,
  ChevronRight,
  MessageSquare,
  TrendingUp,
  Shield,
  Database,
  Sparkles,
  Zap,
  Target,
  Globe,
  Moon,
  Sun,
  FlaskConical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Import module components
import { ClinicalDecisionSupport } from "@/components/clinical-decision-support";
import { PatientManagement } from "@/components/patient-management";
import { ConsultationModule } from "@/components/consultation-module";
import { ClinicalWorkflowDashboard } from "@/components/clinical-workflow-dashboard";
import { DocumentationAssistant } from "@/components/documentation-assistant";
import { DrugInteractionChecker } from "@/components/drug-interaction-checker";
import PatientDrugChecker from "@/components/patient-drug-checker";
import { ImageAnalysis } from "@/components/image-analysis";
import { LabModule } from "@/components/lab-module";
import { VoiceTranscription } from "@/components/voice-transcription";
import { EnhancedVoiceDocumentation } from "@/components/enhanced-voice-documentation";
import { BahmniIntegration } from "@/components/bahmni-integration";
import { EnhancedIntegrations } from "@/components/enhanced-integrations";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { EnhancedAnalytics } from "@/components/enhanced-analytics";
import { RLDashboard } from "@/components/rl-dashboard";
import { AdvancedAIIntelligence } from "@/components/advanced-ai-intelligence";
import { RoleBasedAccessControl } from "@/components/role-based-access-control";
import { OfflineSupport } from "@/components/offline-support";
import { ThemeToggle } from "@/components/theme-toggle";
import { VoiceInputButton } from "@/components/voice-input-button";
import { ClinicalIntelligence } from "@/components/clinical-intelligence";
import { HealthcareAIFeatures } from "@/components/healthcare-ai-features";
import { LLMIntegrationsSettings } from "@/components/llm/llm-integrations-settings";
import { AIModelFooter } from "@/components/ai-model-footer";
import { AIModelSelector } from "@/components/ai-model-selector";
import { KnowledgeBaseManagement } from "@/components/knowledge-base-management";
import MedicalRAGDiagnostic from "@/components/medical-rag-diagnostic";
import { SmartPatientIdentityDashboard } from "@/components/smart-patient-identity-dashboard";
import { RAGIndicator } from "@/components/rag-indicator";
import { RAGSettings } from "@/components/rag-settings";
import { UnifiedLabModule } from "@/components/unified-lab-module";
import { UnifiedImagingModule } from "@/components/unified-imaging-module";

// Import role-based access
import { useRoleBasedAccess, getVisibleModules } from "@/hooks/use-role-based-access";
import { UserRole, Permission } from "@/lib/rbac-middleware";

// User roles for demo
const DEMO_USERS: Record<string, { id: string; employeeId: string; role: UserRole; email: string; name: string; permissions: Permission[] }> = {
  doctor: {
    id: 'demo-doctor',
    employeeId: 'DOC-001',
    role: 'doctor',
    email: 'doctor@gelani-health.ai',
    name: 'Dr. Demo User',
    permissions: ['patient:read', 'patient:write', 'soap_note:read', 'soap_note:write', 'soap_note:sign', 'vitals:read', 'prescription:read', 'prescription:write', 'clinical_order:read', 'clinical_order:write', 'nurse_task:read', 'nurse_task:write', 'ai:use', 'lab:read', 'lab:write', 'lab:verify', 'imaging:read', 'imaging:write'],
  },
  radiologist: {
    id: 'demo-radiologist',
    employeeId: 'RAD-001',
    role: 'radiologist',
    email: 'radiologist@gelani-health.ai',
    name: 'Dr. Radiologist',
    permissions: ['patient:read', 'clinical_order:read', 'ai:use', 'imaging:read', 'imaging:write', 'imaging:interpret', 'imaging:approve', 'lab:read'],
  },
  lab_worker: {
    id: 'demo-lab',
    employeeId: 'LAB-001',
    role: 'lab_worker',
    email: 'lab@gelani-health.ai',
    name: 'Lab Technician',
    permissions: ['patient:read', 'clinical_order:read', 'ai:use', 'lab:read', 'lab:write', 'lab:result_entry', 'lab:verify', 'imaging:read'],
  },
  nurse: {
    id: 'demo-nurse',
    employeeId: 'NRS-001',
    role: 'nurse',
    email: 'nurse@gelani-health.ai',
    name: 'Nurse Demo',
    permissions: ['patient:read', 'soap_note:read', 'vitals:read', 'vitals:write', 'prescription:read', 'clinical_order:read', 'nurse_task:read', 'nurse_task:write', 'lab:read', 'imaging:read'],
  },
  admin: {
    id: 'demo-admin',
    employeeId: 'ADM-001',
    role: 'admin',
    email: 'admin@gelani-health.ai',
    name: 'Admin User',
    permissions: ['patient:read', 'patient:write', 'patient:delete', 'soap_note:read', 'soap_note:write', 'soap_note:sign', 'vitals:read', 'prescription:read', 'clinical_order:read', 'clinical_order:write', 'nurse_task:read', 'nurse_task:write', 'audit_log:read', 'employee:read', 'employee:write', 'ai:use', 'lab:read', 'lab:write', 'lab:result_entry', 'lab:verify', 'lab:approve', 'imaging:read', 'imaging:write', 'imaging:perform', 'imaging:interpret', 'imaging:approve'],
  },
};

// All sidebar items with permission requirements
const allSidebarItems = [
  // Main Clinical Features
  { id: "dashboard", label: "Dashboard", icon: Activity, permission: null },
  { id: "smart-identity", label: "Smart Identity", icon: Shield, permission: 'patient:read' as Permission },
  { id: "patients", label: "Patients", icon: Users, permission: 'patient:read' as Permission },
  { id: "consultations", label: "Consultations", icon: Stethoscope, permission: 'clinical_order:read' as Permission },
  { id: "clinical-intelligence", label: "Clinical Intelligence", icon: Brain, permission: 'ai:use' as Permission },
  { id: "healthcare-ai", label: "Healthcare AI", icon: Sparkles, permission: 'ai:use' as Permission },
  { id: "documentation", label: "Documentation", icon: FileText, permission: 'soap_note:read' as Permission },
  { id: "drugs", label: "Drug Safety", icon: Pill, permission: 'prescription:read' as Permission },
  { id: "imaging", label: "Imaging", icon: ImageIcon, permission: 'imaging:read' as Permission },
  { id: "lab", label: "Laboratory", icon: FlaskConical, permission: 'lab:read' as Permission },
];

// Configuration/Integration section (shown at bottom)
const allConfigItems = [
  { id: "advanced-ai", label: "AI Intelligence", icon: Zap, permission: 'ai:use' as Permission },
  { id: "rl-dashboard", label: "AI Learning", icon: Sparkles, permission: 'ai:use' as Permission },
  { id: "bahmni", label: "Integrations", icon: Database, permission: 'employee:read' as Permission },
  { id: "voice", label: "Voice Notes", icon: Mic, permission: 'soap_note:write' as Permission },
  { id: "analytics", label: "Analytics", icon: TrendingUp, permission: 'audit_log:read' as Permission },
  { id: "settings", label: "Settings", icon: Settings, roles: ['admin'] as UserRole[] },
];

export default function AIHealthcareDashboard() {
  const [activeModule, setActiveModule] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>("doctor");

  // Get current user based on selected role
  const currentUser = DEMO_USERS[currentRole];
  const { can, is, ui, permissions } = useRoleBasedAccess(currentUser);

  // Filter sidebar items based on permissions
  const sidebarItems = useMemo(() => {
    return allSidebarItems.filter(item => {
      if (!item.permission) return true; // Always visible (Dashboard)
      return permissions.includes(item.permission!);
    });
  }, [permissions]);

  // Filter config items based on permissions/roles
  const configItems = useMemo(() => {
    return allConfigItems.filter(item => {
      if (item.roles) {
        return item.roles.includes(currentRole);
      }
      if (item.permission) {
        return permissions.includes(item.permission!);
      }
      return true;
    });
  }, [permissions, currentRole]);

  const handleNavigate = (moduleId: string, patientId?: string) => {
    setActiveModule(moduleId);
    if (patientId) {
      setSelectedPatientId(patientId);
    }
  };

  const renderContent = () => {
    switch (activeModule) {
      case "dashboard":
        return <DashboardHome onNavigate={handleNavigate} />;
      case "smart-identity":
        return <SmartPatientIdentityDashboard />;
      case "patients":
        return <PatientManagement onNavigate={handleNavigate} />;
      case "consultations":
        return <ClinicalWorkflowDashboard preselectedPatientId={selectedPatientId} />;
      case "clinical-intelligence":
        return <ClinicalIntelligence preselectedPatientId={selectedPatientId} />;
      case "healthcare-ai":
        return <HealthcareAIFeatures />;
      case "advanced-ai":
        return <AdvancedAIIntelligence preselectedPatientId={selectedPatientId} />;
      case "rl-dashboard":
        return <RLDashboard />;
      case "documentation":
        return <DocumentationAssistant preselectedPatientId={selectedPatientId} />;
      case "drugs":
        return <PatientDrugChecker preselectedPatientId={selectedPatientId} />;
      case "imaging":
        return <UnifiedImagingModule preselectedPatientId={selectedPatientId || undefined} />;
      case "lab":
        return <UnifiedLabModule preselectedPatientId={selectedPatientId || undefined} />;
      case "voice":
        return <EnhancedVoiceDocumentation />;
      case "bahmni":
        return <EnhancedIntegrations />;
      case "analytics":
        return <EnhancedAnalytics />;
      case "settings":
        return <SettingsModule />;
      default:
        return <DashboardHome onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg blur opacity-30"></div>
                <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 p-2 rounded-lg">
                  <Heart className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Gelani AI Healthcare Assistant
                </h1>
                <p className="text-xs text-slate-500">AI-Powered Clinical Decision Support</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Role Selector */}
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-xs text-slate-500">View as:</span>
              <Select value={currentRole} onValueChange={(value) => setCurrentRole(value as UserRole)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="radiologist">Radiologist</SelectItem>
                  <SelectItem value="lab_worker">Lab Worker</SelectItem>
                  <SelectItem value="nurse">Nurse</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-64 hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search patients, records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-slate-50 border-slate-200"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <VoiceInputButton
                  onTranscript={(text) => setSearchQuery(text)}
                  currentValue={searchQuery}
                  context="medical"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6"
                  showStatus={false}
                />
              </div>
            </div>
            <RAGIndicator compact />
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Badge className={`${ui.badgeColor} text-xs`}>{ui.displayName}</Badge>
              <Avatar className="h-8 w-8">
                <AvatarImage src="" />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
                  {currentUser.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            fixed lg:sticky top-[65px] left-0 z-40
            w-64 h-[calc(100vh-65px)]
            bg-white border-r border-slate-200
            transition-transform duration-300 ease-in-out
            lg:translate-x-0
          `}
        >
          <ScrollArea className="h-full py-4">
            {/* Main Clinical Features */}
            <nav className="px-3 space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => {
                      setActiveModule(item.id);
                      if (window.innerWidth < 1024) setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${isActive
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                        : "text-slate-600 hover:bg-slate-100"
                      }
                    `}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                    {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                  </motion.button>
                );
              })}
            </nav>

            {/* Configuration Section */}
            <div className="px-3 mt-6">
              <Separator className="mb-3" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Configuration
              </p>
              <nav className="space-y-1">
                {configItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => {
                        setActiveModule(item.id);
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                        transition-all duration-200
                        ${isActive
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                          : "text-slate-600 hover:bg-slate-100"
                        }
                      `}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                      {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                    </motion.button>
                  );
                })}
              </nav>
            </div>

            <div className="px-3 mt-6">
              <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">AI Safety Mode</span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">
                    All AI suggestions require human review before clinical use.
                  </p>
                  <Progress value={85} className="h-1.5 bg-emerald-100" />
                  <p className="text-xs text-slate-500 mt-1">85% compliance rate</p>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 min-h-[calc(100vh-65px)]">
          <motion.div
            key={activeModule}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </main>
      </div>

      {/* Footer */}
      <footer className="sticky bottom-0 bg-white border-t border-slate-200 py-2 px-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>Gelani AI Healthcare Assistant v2.0</span>
            <span>•</span>
            <span className="text-emerald-600">RAG-Enhanced Clinical AI</span>
          </div>
          <div className="flex items-center gap-4">
            <AIModelFooter />
            <span>•</span>
            <span>HIPAA Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Dashboard Home Component
function DashboardHome({ onNavigate }: { onNavigate: (id: string) => void }) {
  const quickActions = [
    { id: "patients", label: "New Patient", icon: Users, color: "from-blue-500 to-cyan-500" },
    { id: "clinical-intelligence", label: "Clinical AI", icon: Brain, color: "from-purple-500 to-pink-500" },
    { id: "documentation", label: "Write Notes", icon: FileText, color: "from-amber-500 to-orange-500" },
    { id: "drugs", label: "Check Drugs", icon: Pill, color: "from-rose-500 to-red-500" },
  ];

  const stats = [
    { label: "Patients Today", value: "24", change: "+3", icon: Users },
    { label: "AI Consultations", value: "156", change: "+12", icon: Brain },
    { label: "Documents Created", value: "89", change: "+8", icon: FileText },
    { label: "Drug Alerts", value: "7", change: "-2", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-6 text-white shadow-xl shadow-emerald-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Welcome to Gelani AI Healthcare Assistant</h2>
            <p className="text-emerald-100 max-w-xl">
              RAG-enhanced clinical decision support with AI-powered diagnosis assistance, 
              drug interaction checking, and intelligent documentation.
            </p>
          </div>
          <Stethoscope className="h-24 w-24 text-white/20 hidden lg:block" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className="cursor-pointer border-0 shadow-lg hover:shadow-xl transition-shadow"
                onClick={() => onNavigate(action.id)}
              >
                <CardContent className="p-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-800">{action.label}</h3>
                  <p className="text-sm text-slate-500">Quick access</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-5 w-5 text-slate-400" />
                  <Badge variant="secondary" className="text-xs">
                    {stat.change}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity & AI Features */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              Recent Activity
            </CardTitle>
            <CardDescription>Your latest clinical activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { patient: "John Doe", action: "New consultation created", time: "10 min ago" },
                { patient: "Jane Smith", action: "AI diagnosis suggestions reviewed", time: "25 min ago" },
                { patient: "Mike Johnson", action: "Drug interaction alert resolved", time: "1 hour ago" },
                { patient: "Sarah Wilson", action: "SOAP notes generated", time: "2 hours ago" },
              ].map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                      {activity.patient.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{activity.patient}</p>
                    <p className="text-xs text-slate-500">{activity.action}</p>
                  </div>
                  <span className="text-xs text-slate-400">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Features Overview
            </CardTitle>
            <CardDescription>Clinical AI capabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Clinical Decision Support", status: "Active", accuracy: "94%" },
                { name: "Drug Interaction Checker", status: "Active", accuracy: "98%" },
                { name: "Medical Image Analysis", status: "Active", accuracy: "91%" },
                { name: "Voice Transcription", status: "Active", accuracy: "96%" },
              ].map((feature, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-medium text-slate-700">{feature.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700">
                      {feature.accuracy} accuracy
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Settings Module
function SettingsModule() {
  const [activeSettingsTab, setActiveSettingsTab] = useState("llm");

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>Configure Gelani AI Healthcare Assistant</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSettingsTab} onValueChange={setActiveSettingsTab}>
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="llm">LLM Providers</TabsTrigger>
              <TabsTrigger value="rag">RAG Services</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
              <TabsTrigger value="ai">AI Config</TabsTrigger>
              <TabsTrigger value="safety">Safety</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="offline">Offline</TabsTrigger>
            </TabsList>
            <TabsContent value="llm" className="mt-4">
              <LLMIntegrationsSettings />
            </TabsContent>
            <TabsContent value="rag" className="mt-4">
              <RAGSettings />
            </TabsContent>
            <TabsContent value="knowledge" className="mt-4">
              <KnowledgeBaseManagement />
            </TabsContent>
            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium mb-2">AI Model Selection</h4>
                  <p className="text-sm text-slate-600 mb-3">Choose the default AI model for clinical decision support. Click on a model to set it as default.</p>
                  <AIModelSelector />
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium mb-2">Response Temperature</h4>
                  <p className="text-sm text-slate-600 mb-3">Control AI creativity vs precision</p>
                  <Progress value={70} className="h-2" />
                  <p className="text-xs text-slate-500 mt-1">Current: 0.7 (Balanced)</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="safety" className="space-y-4 mt-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h4 className="font-medium text-amber-800">Safety First</h4>
                </div>
                <p className="text-sm text-amber-700">
                  All AI-generated clinical suggestions must be reviewed by a qualified healthcare professional before use.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium mb-2">Human Review Required</h4>
                <p className="text-sm text-slate-600">All AI suggestions require human verification</p>
              </div>
            </TabsContent>
            <TabsContent value="features" className="space-y-4 mt-4">
              {[
                { name: "Clinical Decision Support", enabled: true },
                { name: "Drug Interaction Checker", enabled: true },
                { name: "Medical Image Analysis", enabled: true },
                { name: "Voice Transcription", enabled: true },
                { name: "Auto-documentation", enabled: false },
              ].map((feature, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <span className="font-medium">{feature.name}</span>
                  <Badge variant={feature.enabled ? "default" : "secondary"}>
                    {feature.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="access" className="mt-4">
              <RoleBasedAccessControl />
            </TabsContent>
            <TabsContent value="offline" className="mt-4">
              <OfflineSupport />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

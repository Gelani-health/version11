"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  ChevronRight,
  Heart,
  Search,
  Bell,
  User,
  Settings,
  LogOut,
  Activity,
  Users,
  Stethoscope,
  Brain,
  FileText,
  Pill,
  Image as ImageIcon,
  Mic,
  Database,
  TrendingUp,
  Sparkles,
  Zap,
  Wifi,
  WifiOff,
  Moon,
  Sun,
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme-provider";

interface MobileNavigationProps {
  activeModule: string;
  setActiveModule: (id: string) => void;
  isOnline: boolean;
}

export function MobileNavigation({ activeModule, setActiveModule, isOnline }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { resolvedTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "patients", label: "Patients", icon: Users },
    { id: "consultations", label: "Consultations", icon: Stethoscope },
    { id: "advanced-ai", label: "AI Intelligence", icon: Zap },
    { id: "clinical-support", label: "Clinical Support", icon: Brain },
    { id: "rl-dashboard", label: "AI Learning", icon: Sparkles },
    { id: "documentation", label: "Documentation", icon: FileText },
    { id: "drugs", label: "Drug Safety", icon: Pill },
    { id: "imaging", label: "Medical Imaging", icon: ImageIcon },
    { id: "voice", label: "Voice Notes", icon: Mic },
    { id: "bahmni", label: "Integrations", icon: Database },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle navigation
  const handleNavigate = (id: string) => {
    setActiveModule(id);
    setIsOpen(false);
  };

  // Quick actions for mobile
  const quickActions = [
    { id: "patients", label: "New Patient", icon: Users, color: "bg-blue-500" },
    { id: "consultations", label: "Consult", icon: Stethoscope, color: "bg-emerald-500" },
    { id: "advanced-ai", label: "AI Analysis", icon: Zap, color: "bg-purple-500" },
    { id: "drugs", label: "Check Drugs", icon: Pill, color: "bg-rose-500" },
  ];

  // Get current page info
  const currentPage = sidebarItems.find(item => item.id === activeModule);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-3">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <div className="flex flex-col h-full">
                  {/* Logo */}
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg blur opacity-30"></div>
                        <div className="relative bg-gradient-to-r from-emerald-500 to-teal-500 p-2 rounded-lg">
                          <Heart className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div>
                        <h1 className="font-bold text-slate-800">Gelani AI</h1>
                        <p className="text-xs text-slate-500">Healthcare Assistant</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="p-4 border-b bg-slate-50">
                    <p className="text-xs font-medium text-slate-500 mb-3">QUICK ACTIONS</p>
                    <div className="grid grid-cols-2 gap-2">
                      {quickActions.map((action) => (
                        <Button
                          key={action.id}
                          variant="outline"
                          size="sm"
                          className="justify-start h-auto py-2"
                          onClick={() => handleNavigate(action.id)}
                        >
                          <div className={`p-1.5 rounded ${action.color} mr-2`}>
                            <action.icon className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-xs">{action.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Navigation */}
                  <ScrollArea className="flex-1 p-4">
                    <p className="text-xs font-medium text-slate-500 mb-3">MENU</p>
                    <nav className="space-y-1">
                      {sidebarItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeModule === item.id;
                        return (
                          <motion.button
                            key={item.id}
                            onClick={() => handleNavigate(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                              isActive
                                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Icon className="h-5 w-5" />
                            {item.label}
                            {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                          </motion.button>
                        );
                      })}
                    </nav>
                  </ScrollArea>

                  {/* Footer */}
                  <div className="p-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isOnline ? (
                          <Wifi className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-rose-500" />
                        )}
                        <span className="text-xs text-slate-500">
                          {isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">v2.0</span>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div>
              <h1 className="font-semibold text-slate-800">
                {currentPage?.label || "Dashboard"}
              </h1>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm">
                DR
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search patients, records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-50"
            />
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-pb">
        <div className="flex items-center justify-around py-2">
          {[
            { id: "dashboard", icon: Home, label: "Home" },
            { id: "patients", icon: Users, label: "Patients" },
            { id: "consultations", icon: Stethoscope, label: "Consult" },
            { id: "advanced-ai", icon: Zap, label: "AI" },
            { id: "settings", icon: Settings, label: "More" },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 min-w-[60px] ${
                  isActive ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isActive ? "bg-emerald-50" : ""}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button (Mobile) */}
      <AnimatePresence>
        {activeModule === "dashboard" && isMobile && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed right-4 bottom-20 z-40 lg:hidden"
          >
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              onClick={() => setActiveModule("consultations")}
            >
              <Stethoscope className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
  Download,
  Upload,
  Database,
  Clock,
  HardDrive,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Sync,
  AlertCircle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// Types
interface SyncQueueItem {
  id: string;
  type: "patient" | "consultation" | "document" | "voice-note" | "medication";
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
  timestamp: Date;
  synced: boolean;
  error?: string;
}

interface OfflineData {
  patients: Record<string, unknown>[];
  consultations: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  voiceNotes: Record<string, unknown>[];
  lastSync: Date | null;
}

// IndexedDB helper
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("GelaniHealthcareDB", 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create stores
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("offlineData")) {
        db.createObjectStore("offlineData", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("patients")) {
        db.createObjectStore("patients", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("consultations")) {
        db.createObjectStore("consultations", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("voiceNotes")) {
        db.createObjectStore("voiceNotes", { keyPath: "id" });
      }
    };
  });
};

// Save to IndexedDB
const saveToIndexedDB = async (storeName: string, data: unknown): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Get all from IndexedDB
const getAllFromIndexedDB = async <T,>(storeName: string): Promise<T[]> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// Delete from IndexedDB
const deleteFromIndexedDB = async (storeName: string, id: string): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export function OfflineSupport() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [offlineDataSize, setOfflineDataSize] = useState(0);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);

  // Check online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online - Syncing data...");
      syncPendingChanges();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You're offline - Changes will be queued");
    };

    // Set initial status
    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load sync queue from IndexedDB
  useEffect(() => {
    const loadSyncQueue = async () => {
      try {
        const queue = await getAllFromIndexedDB<SyncQueueItem>("syncQueue");
        setSyncQueue(queue.filter(item => !item.synced));
        setPendingChanges(queue.filter(item => !item.synced).length);
      } catch (error) {
        console.error("Failed to load sync queue:", error);
      }
    };

    loadSyncQueue();
    
    // Load last sync time
    const savedLastSync = localStorage.getItem("gelani-last-sync");
    if (savedLastSync) {
      setLastSync(new Date(savedLastSync));
    }
  }, []);

  // Add item to sync queue
  const addToSyncQueue = useCallback(async (item: Omit<SyncQueueItem, "id" | "timestamp" | "synced">) => {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      synced: false,
    };

    try {
      await saveToIndexedDB("syncQueue", queueItem);
      setSyncQueue(prev => [...prev, queueItem]);
      setPendingChanges(prev => prev + 1);
      
      if (!isOnline) {
        toast.info("Change queued for sync when online");
      }
    } catch (error) {
      console.error("Failed to add to sync queue:", error);
      toast.error("Failed to save change");
    }
  }, [isOnline]);

  // Sync pending changes
  const syncPendingChanges = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    
    try {
      const queue = await getAllFromIndexedDB<SyncQueueItem>("syncQueue");
      const pendingItems = queue.filter(item => !item.synced);

      for (const item of pendingItems) {
        try {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Mark as synced
          item.synced = true;
          await saveToIndexedDB("syncQueue", item);
          
          setSyncQueue(prev => prev.filter(i => i.id !== item.id));
        } catch {
          item.error = "Sync failed";
          await saveToIndexedDB("syncQueue", item);
        }
      }

      const now = new Date();
      setLastSync(now);
      localStorage.setItem("gelani-last-sync", now.toISOString());
      setPendingChanges(0);
      
      toast.success("All changes synced successfully");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Some items failed to sync");
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  // Download data for offline use
  const downloadOfflineData = useCallback(async () => {
    toast.info("Downloading data for offline use...");
    
    try {
      // In a real app, this would fetch from API
      // For demo, we'll simulate downloading some data
      const mockPatients = [
        { id: "p1", name: "John Doe", age: 45 },
        { id: "p2", name: "Jane Smith", age: 32 },
      ];
      
      for (const patient of mockPatients) {
        await saveToIndexedDB("patients", patient);
      }

      // Save metadata
      await saveToIndexedDB("offlineData", {
        key: "lastDownload",
        timestamp: new Date(),
        patientCount: mockPatients.length,
      });

      // Estimate storage size (simplified)
      const estimatedSize = JSON.stringify(mockPatients).length;
      setOfflineDataSize(estimatedSize);
      
      toast.success("Data downloaded for offline use");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download data");
    }
  }, []);

  // Clear offline data
  const clearOfflineData = useCallback(async () => {
    try {
      const db = await openDatabase();
      const stores = ["patients", "consultations", "voiceNotes", "syncQueue"];
      
      for (const store of stores) {
        const transaction = db.transaction(store, "readwrite");
        const objectStore = transaction.objectStore(store);
        objectStore.clear();
      }

      setSyncQueue([]);
      setPendingChanges(0);
      setOfflineDataSize(0);
      
      toast.success("Offline data cleared");
    } catch (error) {
      console.error("Clear error:", error);
      toast.error("Failed to clear data");
    }
  }, []);

  // Get signal strength icon
  const getSignalIcon = () => {
    if (!isOnline) return <WifiOff className="h-5 w-5 text-rose-500" />;
    if (pendingChanges > 0) return <Signal className="h-5 w-5 text-amber-500" />;
    return <SignalHigh className="h-5 w-5 text-emerald-500" />;
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Connection Status Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Alert className="bg-amber-50 border-amber-200">
              <WifiOff className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700">You're Offline</AlertTitle>
              <AlertDescription className="text-amber-600">
                Changes will be saved locally and synced when you're back online.
                {pendingChanges > 0 && ` ${pendingChanges} changes pending.`}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Connection</div>
                <div className={`text-lg font-semibold ${isOnline ? "text-emerald-600" : "text-rose-600"}`}>
                  {isOnline ? "Online" : "Offline"}
                </div>
              </div>
              {getSignalIcon()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Pending Sync</div>
                <div className="text-lg font-semibold text-amber-600">{pendingChanges}</div>
              </div>
              <RefreshCw className={`h-5 w-5 ${isSyncing ? "animate-spin text-amber-500" : "text-slate-400"}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Last Sync</div>
                <div className="text-lg font-semibold text-slate-700">
                  {lastSync ? lastSync.toLocaleTimeString() : "Never"}
                </div>
              </div>
              <Clock className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Offline Data</div>
                <div className="text-lg font-semibold text-slate-700">{formatBytes(offlineDataSize)}</div>
              </div>
              <HardDrive className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-500" />
            Offline Mode Management
          </CardTitle>
          <CardDescription>Manage offline data and sync settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={syncPendingChanges}
              disabled={!isOnline || isSyncing || pendingChanges === 0}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Sync Now ({pendingChanges})
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={downloadOfflineData}
              disabled={!isOnline}
            >
              <Download className="h-4 w-4 mr-2" />
              Download for Offline
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowSyncDialog(true)}
            >
              <Info className="h-4 w-4 mr-2" />
              View Queue
            </Button>

            <Button
              variant="outline"
              onClick={clearOfflineData}
              className="text-rose-600 hover:text-rose-700"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Offline Data
            </Button>
          </div>

          {/* Sync Queue Preview */}
          {syncQueue.length > 0 && (
            <div className="mt-4">
              <Separator className="mb-4" />
              <h4 className="text-sm font-medium text-slate-600 mb-2">Pending Changes</h4>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {syncQueue.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.type}</Badge>
                        <Badge variant="outline">{item.action}</Badge>
                      </div>
                      <span className="text-xs text-slate-400">
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  {syncQueue.length > 5 && (
                    <p className="text-xs text-slate-500 text-center">
                      +{syncQueue.length - 5} more items
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Queue Dialog */}
      <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sync Queue</DialogTitle>
            <DialogDescription>
              Items waiting to be synchronized with the server
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {syncQueue.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {syncQueue.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 border rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{item.type}</Badge>
                          <Badge variant="outline">{item.action}</Badge>
                        </div>
                        <span className="text-xs text-slate-400">
                          {item.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(item.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-64 flex items-center justify-center text-center">
                <div>
                  <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-slate-500">No pending changes</p>
                  <p className="text-sm text-slate-400">All data is synchronized</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-700">Offline Mode</AlertTitle>
        <AlertDescription className="text-blue-600">
          When offline, your changes are saved locally and will be automatically synchronized
          when you reconnect to the internet. Download data beforehand for full offline functionality.
        </AlertDescription>
      </Alert>
    </div>
  );
}

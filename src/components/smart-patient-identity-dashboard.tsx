"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  Plus,
  Shield,
  AlertTriangle,
  QrCode,
  Users,
  Activity,
  Brain,
  Heart,
  Printer,
  Download,
  Eye,
  Filter,
  SortAsc,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  AlertOctagon,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  CreditCard,
  Building,
  Stethoscope,
  Pill,
  Wifi,
  Fingerprint,
  Accessibility,
  Languages,
  Zap,
  FileText
} from 'lucide-react';
import SmartPatientIdentityCard, { SmartPatientIdentityData } from './smart-patient-identity-card';
import { PatientRegistrationCard } from './patient-registration-card';
import { useToast } from '@/hooks/use-toast';
import { patientFormToApi, apiToPatientForm, type PatientFormData, type EmergencyContact } from '@/types/patient';

// Extended patient type matching the database schema
interface PatientRecord {
  id: string;
  mrn?: string;
  nationalHealthId?: string;
  patientDigitalId?: string;
  smartCardSerialNumber?: string;
  biometricId?: string;
  
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  dateOfBirth: Date | string;
  gender: string;
  bloodType?: string;
  rhFactor?: string;
  maritalStatus?: string;
  ethnicity?: string;
  race?: string;
  
  phone?: string;
  phoneType?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  emergencyContact2Name?: string;
  emergencyContact2Phone?: string;
  emergencyContact2Relation?: string;
  
  allergies?: any[];
  allergyCritical?: boolean;
  organDonorStatus?: string;
  pregnancyStatus?: string;
  estimatedDueDate?: Date | string;
  chronicConditions?: any[];
  implantedDevices?: any[];
  
  fallRisk?: boolean;
  fallRiskLevel?: string;
  infectiousDiseaseStatus?: string;
  infectionIsolationType?: string;
  dnrOrder?: boolean;
  dnrOrderDate?: Date | string;
  dnrOrderPhysician?: string;
  highRiskMedications?: any[];
  suicideRisk?: boolean;
  elopementRisk?: boolean;
  
  languagePrimary?: string;
  languageSecondary?: string;
  interpreterNeeded?: boolean;
  religion?: string;
  religiousConsiderations?: string;
  disabilityStatus?: any[];
  mobilityStatus?: string;
  mobilityAid?: string;
  caregiverName?: string;
  caregiverPhone?: string;
  caregiverRelation?: string;
  advanceDirective?: boolean;
  healthcareProxyName?: string;
  healthcareProxyPhone?: string;
  
  lastHospitalVisit?: Date | string;
  primaryCarePhysician?: string;
  primaryCareFacility?: string;
  triagePriority?: string;
  totalAdmissions?: number;
  totalEdVisits?: number;
  
  insurancePrimary?: string;
  insurancePrimaryId?: string;
  insurancePrimaryGroup?: string;
  insuranceSecondary?: string;
  insuranceSecondaryId?: string;
  insuranceVerified?: boolean;
  
  aiRiskScore?: number;
  aiRiskLevel?: string;
  aiRiskFactors?: any[];
  aiReadmissionRisk?: number;
  aiTriagePrediction?: string;
  aiEmergencyAlerts?: any[];
  
  qrCodeData?: string;
  nfcEnabled?: boolean;
  rfidTagId?: string;
  digitalAccessEnabled?: boolean;
  patientPortalAccess?: boolean;
  
  fingerprintRegistered?: boolean;
  irisScanRegistered?: boolean;
  voicePrintRegistered?: boolean;
  
  patientPhoto?: string;
  updatedAt?: Date | string;
  createdAt?: Date | string;
}

// Form state for new patient
interface NewPatientForm {
  // Personal Information
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  bloodType: string;
  rhFactor: string;
  ethnicity: string;
  race: string;
  
  // National Identity
  nationalHealthId: string;
  nationalIdType: string;
  
  // Contact Information
  phone: string;
  phoneType: string;
  alternatePhone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  
  // Emergency Contact 1
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  
  // Emergency Contact 2
  emergencyContact2Name: string;
  emergencyContact2Phone: string;
  emergencyContact2Relation: string;
  
  // Medical Information
  organDonorStatus: string;
  pregnancyStatus: string;
  estimatedDueDate: string;
  
  // Safety Information
  fallRisk: boolean;
  fallRiskLevel: string;
  infectiousDiseaseStatus: string;
  infectionIsolationType: string;
  dnrOrder: boolean;
  suicideRisk: boolean;
  elopementRisk: boolean;
  
  // Social Information
  languagePrimary: string;
  languageSecondary: string;
  interpreterNeeded: boolean;
  religion: string;
  mobilityStatus: string;
  mobilityAid: string;
  caregiverName: string;
  caregiverPhone: string;
  caregiverRelation: string;
  advanceDirective: boolean;
  healthcareProxyName: string;
  healthcareProxyPhone: string;
  
  // Insurance
  insurancePrimary: string;
  insurancePrimaryId: string;
  insurancePrimaryGroup: string;
  insuranceSecondary: string;
  insuranceSecondaryId: string;
  
  // Digital Access
  nfcEnabled: boolean;
  patientPortalAccess: boolean;
  digitalAccessEnabled: boolean;
  
  // Biometric
  fingerprintRegistered: boolean;
  irisScanRegistered: boolean;
  voicePrintRegistered: boolean;
  
  // Allergies & Conditions (text for now)
  allergiesText: string;
  chronicConditionsText: string;
}

const initialFormState: NewPatientForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  preferredName: '',
  dateOfBirth: '',
  gender: '',
  maritalStatus: '',
  bloodType: '',
  rhFactor: '',
  ethnicity: '',
  race: '',
  nationalHealthId: '',
  nationalIdType: '',
  phone: '',
  phoneType: '',
  alternatePhone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  emergencyContact2Name: '',
  emergencyContact2Phone: '',
  emergencyContact2Relation: '',
  organDonorStatus: '',
  pregnancyStatus: '',
  estimatedDueDate: '',
  fallRisk: false,
  fallRiskLevel: '',
  infectiousDiseaseStatus: '',
  infectionIsolationType: '',
  dnrOrder: false,
  suicideRisk: false,
  elopementRisk: false,
  languagePrimary: '',
  languageSecondary: '',
  interpreterNeeded: false,
  religion: '',
  mobilityStatus: '',
  mobilityAid: '',
  caregiverName: '',
  caregiverPhone: '',
  caregiverRelation: '',
  advanceDirective: false,
  healthcareProxyName: '',
  healthcareProxyPhone: '',
  insurancePrimary: '',
  insurancePrimaryId: '',
  insurancePrimaryGroup: '',
  insuranceSecondary: '',
  insuranceSecondaryId: '',
  nfcEnabled: false,
  patientPortalAccess: false,
  digitalAccessEnabled: false,
  fingerprintRegistered: false,
  irisScanRegistered: false,
  voicePrintRegistered: false,
  allergiesText: '',
  chronicConditionsText: ''
};

// Blood type options
const bloodTypes = ['A', 'B', 'AB', 'O'];
const rhFactors = ['positive', 'negative'];

// Gender options
const genderOptions = ['male', 'female', 'other', 'unknown'];

// Marital status options
const maritalStatusOptions = ['single', 'married', 'divorced', 'widowed', 'separated'];

// Relationship options
const relationshipOptions = [
  'spouse', 'parent', 'child', 'sibling', 'grandparent', 
  'grandchild', 'uncle_aunt', 'cousin', 'friend', 'guardian', 'caregiver', 'other'
];

// Language options
const languageOptions = ['English', 'Amharic', 'Oromo', 'Tigrinya', 'Somali', 'Arabic', 'Other'];

// Mobility status options
const mobilityOptions = ['independent', 'assisted', 'wheelchair', 'bedbound'];

// Mobility aid options
const mobilityAidOptions = ['none', 'cane', 'walker', 'wheelchair', 'prosthetic', 'other'];

// Religion options
const religionOptions = ['Christianity', 'Islam', 'Judaism', 'Hinduism', 'Buddhism', 'Other', 'None', 'Prefer not to say'];

// Fall risk levels
const fallRiskLevels = ['low', 'medium', 'high'];

// Isolation types
const isolationTypes = ['contact', 'droplet', 'airborne', 'standard'];

// Pregnancy status
const pregnancyStatusOptions = ['pregnant', 'not-pregnant', 'unknown', 'not-applicable'];

// Organ donor status
const organDonorOptions = ['yes', 'no', 'not-specified'];

export function SmartPatientIdentityDashboard() {
  const [patients, setPatients] = useState<SmartPatientIdentityData[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<SmartPatientIdentityData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAlerts, setFilterAlerts] = useState(false);
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPatient, setNewPatient] = useState<NewPatientForm>(initialFormState);
  const [activeFormTab, setActiveFormTab] = useState('personal');
  const { toast } = useToast();

  // Fetch patients from API
  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filterAlerts) params.append('hasAlerts', 'true');
      if (filterRisk !== 'all') params.append('riskLevel', filterRisk);
      params.append('limit', '50');

      const response = await fetch(`/api/smart-patient-identity?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setPatients(data.data || []);
      } else {
        console.error('Failed to fetch patients:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch patients:', error);
      toast({
        title: 'Error',
        description: 'Failed to load patient data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterAlerts, filterRisk, toast]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Filter patients (client-side additional filtering)
  const filteredPatients = patients.filter(patient => {
    // Additional client-side filtering if needed
    return true;
  });

  // Calculate statistics
  const stats = {
    total: patients.length,
    criticalAlerts: patients.filter(p => 
      p.allergyCritical || p.fallRisk || p.infectiousDiseaseStatus || p.dnrOrder || p.suicideRisk
    ).length,
    highRisk: patients.filter(p => p.aiRiskLevel === 'high' || p.aiRiskLevel === 'critical').length,
    activeNFC: patients.filter(p => p.nfcEnabled).length,
    biometricEnrolled: patients.filter(p => p.fingerprintRegistered || p.irisScanRegistered || p.voicePrintRegistered).length
  };

  const handleRefresh = () => {
    fetchPatients();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(patients, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patient-identities.json';
    a.click();
  };

  // Create new patient
  const handleCreatePatient = async () => {
    // Validate required fields
    if (!newPatient.firstName || !newPatient.lastName || !newPatient.dateOfBirth || !newPatient.gender) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields (First Name, Last Name, Date of Birth, Gender)',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSaving(true);
      
      // Parse allergies and chronic conditions from text
      const allergies = newPatient.allergiesText
        .split(',')
        .map(a => a.trim())
        .filter(Boolean)
        .map(name => ({
          name,
          severity: 'moderate' as const,
          reaction: ''
        }));
      
      const chronicConditions = newPatient.chronicConditionsText
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      const response = await fetch('/api/smart-patient-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPatient,
          allergies: allergies.length > 0 ? JSON.stringify(allergies) : null,
          chronicConditions: chronicConditions.length > 0 ? JSON.stringify(chronicConditions) : null,
          allergyCritical: allergies.some(a => a.severity === 'life-threatening' || a.severity === 'severe'),
          dateOfBirth: new Date(newPatient.dateOfBirth).toISOString(),
          estimatedDueDate: newPatient.estimatedDueDate ? new Date(newPatient.estimatedDueDate).toISOString() : null
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Patient registered successfully'
        });
        setIsAddDialogOpen(false);
        setNewPatient(initialFormState);
        setActiveFormTab('personal');
        fetchPatients();
      } else {
        throw new Error(data.error || 'Failed to create patient');
      }
    } catch (error: any) {
      console.error('Failed to create patient:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to register patient',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setNewPatient(initialFormState);
    setActiveFormTab('personal');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-7 w-7" />
              Smart Patient Identity System
            </h2>
            <p className="text-emerald-100 mt-1">
              Modern digital health identity with AI-ready data, biometric authentication, and emergency alerts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Patient
                </Button>
              </DialogTrigger>
            </Dialog>
            <PatientRegistrationCard
              open={isAddDialogOpen}
              onOpenChange={setIsAddDialogOpen}
              onSubmit={async (formData: PatientFormData) => {
                try {
                  setIsSaving(true);
                  
                  const response = await fetch('/api/smart-patient-identity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patientFormToApi(formData))
                  });

                  const data = await response.json();
                  
                  if (data.success) {
                    toast({
                      title: 'Success',
                      description: 'Patient registered successfully'
                    });
                    fetchPatients();
                  } else {
                    throw new Error(data.error || 'Failed to create patient');
                  }
                } catch (error: any) {
                  console.error('Failed to create patient:', error);
                  toast({
                    title: 'Error',
                    description: error.message || 'Failed to register patient',
                    variant: 'destructive'
                  });
                } finally {
                  setIsSaving(false);
                }
              }}
              mode="create"
            />
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Patients</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-700">{stats.criticalAlerts}</p>
              </div>
              <AlertOctagon className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">High Risk</p>
                <p className="text-2xl font-bold text-orange-700">{stats.highRisk}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">NFC Active</p>
                <p className="text-2xl font-bold text-purple-700">{stats.activeNFC}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Biometric</p>
                <p className="text-2xl font-bold text-green-700">{stats.biometricEnrolled}</p>
              </div>
              <Fingerprint className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      {/* Search and Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, MRN, or National ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filterAlerts ? "destructive" : "outline"}
                size="sm"
                onClick={() => setFilterAlerts(!filterAlerts)}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Critical Alerts
              </Button>
              <Select value={filterRisk} onValueChange={setFilterRisk}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 border-l pl-4">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-md h-[600px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Patient Registry</span>
                <Badge variant="secondary">{filteredPatients.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[520px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <Users className="h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="font-medium text-gray-600">No Patients Found</h3>
                    <p className="text-sm text-gray-400">Register a new patient to get started</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    <AnimatePresence>
                      {filteredPatients.map((patient) => (
                        <motion.div
                          key={patient.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            selectedPatient?.id === patient.id
                              ? 'bg-emerald-100 border-2 border-emerald-500'
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                          onClick={() => setSelectedPatient(patient)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-12 rounded-full ${
                              patient.aiRiskLevel === 'critical' ? 'bg-red-500' :
                              patient.aiRiskLevel === 'high' ? 'bg-orange-500' :
                              patient.aiRiskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                                {(patient.allergyCritical || patient.fallRisk || patient.infectiousDiseaseStatus) && (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                              <div className="text-sm text-gray-500">{patient.mrn}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {patient.bloodType && (
                                  <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                                    {patient.bloodType}{patient.rhFactor === 'positive' ? '+' : patient.rhFactor === 'negative' ? '-' : ''}
                                  </Badge>
                                )}
                                {patient.aiRiskLevel && (
                                  <Badge className={`text-xs ${
                                    patient.aiRiskLevel === 'critical' ? 'bg-red-600' :
                                    patient.aiRiskLevel === 'high' ? 'bg-orange-500' :
                                    patient.aiRiskLevel === 'medium' ? 'bg-yellow-500 text-black' : 'bg-green-500'
                                  }`}>
                                    {patient.aiRiskLevel}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Smart Card Display */}
        <div className="lg:col-span-2">
          {selectedPatient ? (
            <SmartPatientIdentityCard
              patient={selectedPatient}
              onPrint={handlePrint}
              onScan={() => console.log('Scan triggered')}
            />
          ) : (
            <Card className="border-0 shadow-md h-[600px] flex items-center justify-center">
              <CardContent className="text-center">
                <Shield className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-500">Select a Patient</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Choose a patient from the registry to view their Smart Identity Card
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* System Architecture Info */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-slate-50 to-slate-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Smart Patient Identity Architecture
          </CardTitle>
          <CardDescription>
            Modern digital healthcare identity system with AI integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { title: 'Patient Identity', icon: Users, desc: 'National Health ID, Biometric ID, Digital ID', color: 'blue' },
              { title: 'Emergency Data', icon: AlertTriangle, desc: 'Allergies, Blood Type, Critical Alerts', color: 'red' },
              { title: 'AI-Ready Fields', icon: Brain, desc: 'Risk scoring, Triage prediction, Alerts', color: 'purple' },
              { title: 'Digital Access', icon: QrCode, desc: 'QR codes, NFC, RFID, Biometric auth', color: 'green' }
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="p-4 bg-white rounded-lg shadow-sm">
                  <div className={`w-10 h-10 rounded-lg bg-${feature.color}-100 flex items-center justify-center mb-3`}>
                    <Icon className={`h-5 w-5 text-${feature.color}-600`} />
                  </div>
                  <h4 className="font-semibold text-gray-800">{feature.title}</h4>
                  <p className="text-sm text-gray-500 mt-1">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SmartPatientIdentityDashboard;

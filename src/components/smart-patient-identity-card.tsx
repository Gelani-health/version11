"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertTriangle,
  AlertCircle,
  Heart,
  Droplet,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  Shield,
  QrCode,
  Fingerprint,
  CreditCard,
  Building,
  Stethoscope,
  Pill,
  Activity,
  Brain,
  Wifi,
  Eye,
  Clock,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Printer,
  Download,
  ScanLine,
  Languages,
  Accessibility,
  UserCheck,
  FileText,
  Zap,
  Ruler
} from 'lucide-react';

// Types for the Smart Patient Identity Card
export interface Allergy {
  name: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction?: string;
}

interface ImplantedDevice {
  device: string;
  location: string;
  date?: string;
}

interface HighRiskMedication {
  medication: string;
  reason: string;
}

interface SafetyAlert {
  type: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
}

export interface SmartPatientIdentityData {
  // Identity
  id: string;
  mrn?: string;
  nationalHealthId?: string;
  patientDigitalId?: string;
  smartCardSerialNumber?: string;

  // Demographics
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
  
  // Contact
  phone?: string;
  phoneType?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  
  // Emergency Contacts
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  emergencyContact2Name?: string;
  emergencyContact2Phone?: string;
  emergencyContact2Relation?: string;
  
  // Emergency Medical Information
  allergies?: Allergy[];
  allergyCritical?: boolean;
  organDonorStatus?: string;
  pregnancyStatus?: string;
  estimatedDueDate?: Date | string;
  chronicConditions?: string[];
  implantedDevices?: ImplantedDevice[];
  
  // Safety Alerts
  fallRisk?: boolean;
  fallRiskLevel?: string;
  infectiousDiseaseStatus?: string;
  infectionIsolationType?: string;
  dnrOrder?: boolean;
  dnrOrderDate?: Date | string;
  dnrOrderPhysician?: string;
  highRiskMedications?: HighRiskMedication[];
  suicideRisk?: boolean;
  elopementRisk?: boolean;
  
  // Social & Care
  languagePrimary?: string;
  languageSecondary?: string;
  interpreterNeeded?: boolean;
  religion?: string;
  religiousConsiderations?: string;
  disabilityStatus?: string[];
  mobilityStatus?: string;
  mobilityAid?: string;
  caregiverName?: string;
  caregiverPhone?: string;
  caregiverRelation?: string;
  advanceDirective?: boolean;
  advanceDirectiveLocation?: string;
  healthcareProxyName?: string;
  healthcareProxyPhone?: string;
  
  // Clinical Metadata
  lastHospitalVisit?: Date | string;
  lastPhysicianName?: string;
  primaryCarePhysician?: string;
  primaryCareFacility?: string;
  triagePriority?: string;
  totalAdmissions?: number;
  totalEdVisits?: number;
  
  // Insurance
  insurancePrimary?: string;
  insurancePrimaryId?: string;
  insurancePrimaryGroup?: string;
  insuranceSecondary?: string;
  insuranceSecondaryId?: string;
  insuranceVerified?: boolean;
  
  // AI-Ready Fields
  aiRiskScore?: number;
  aiRiskLevel?: string;
  aiRiskFactors?: string[];
  aiReadmissionRisk?: number;
  aiTriagePrediction?: string;
  aiEmergencyAlerts?: string[];
  
  // Digital Health
  qrCodeData?: string;
  nfcEnabled?: boolean;
  rfidTagId?: string;
  digitalAccessEnabled?: boolean;
  patientPortalAccess?: boolean;
  
  // Biometric
  fingerprintRegistered?: boolean;
  irisScanRegistered?: boolean;
  voicePrintRegistered?: boolean;
  
  // Metadata
  patientPhoto?: string;
  cardPrintDate?: Date | string;
  cardExpiryDate?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Helper functions
const formatDate = (date: Date | string | undefined): string => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const calculateAge = (dob: Date | string): number => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'life-threatening':
    case 'critical':
      return 'bg-red-600 text-white';
    case 'severe':
    case 'high':
      return 'bg-red-500 text-white';
    case 'moderate':
    case 'medium':
      return 'bg-orange-500 text-white';
    case 'mild':
    case 'low':
      return 'bg-yellow-500 text-black';
    default:
      return 'bg-gray-500 text-white';
  }
};

const getTriageColor = (priority: string): string => {
  switch (priority) {
    case 'emergent':
      return 'bg-red-600 text-white animate-pulse';
    case 'urgent':
      return 'bg-orange-500 text-white';
    case 'less-urgent':
      return 'bg-yellow-500 text-black';
    case 'non-urgent':
      return 'bg-green-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

const getBloodTypeColor = (bloodType: string): string => {
  if (!bloodType) return 'bg-gray-200 text-gray-700';
  return 'bg-red-100 text-red-700 border-2 border-red-500';
};

// Props interface
interface SmartPatientIdentityCardProps {
  patient: SmartPatientIdentityData;
  compact?: boolean;
  showQRCode?: boolean;
  onPrint?: () => void;
  onScan?: () => void;
  className?: string;
}

// Main Component
export function SmartPatientIdentityCard({
  patient,
  compact = false,
  showQRCode = true,
  onPrint,
  onScan,
  className = ''
}: SmartPatientIdentityCardProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    allergies: true,
    safety: true,
    medical: false,
    social: false,
    digital: false,
    ai: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Calculate critical alerts count
  const criticalAlertsCount = [
    patient.allergyCritical,
    patient.fallRisk,
    patient.infectiousDiseaseStatus,
    patient.dnrOrder,
    patient.suicideRisk,
    patient.elopementRisk,
    patient.highRiskMedications && patient.highRiskMedications.length > 0
  ].filter(Boolean).length;

  // Get all safety alerts
  const safetyAlerts: SafetyAlert[] = [];
  if (patient.fallRisk) safetyAlerts.push({ type: 'Fall Risk', level: patient.fallRiskLevel as any || 'medium', details: `Level: ${patient.fallRiskLevel || 'Not specified'}` });
  if (patient.infectiousDiseaseStatus) safetyAlerts.push({ type: 'Infectious Disease', level: 'critical', details: patient.infectiousDiseaseStatus });
  if (patient.dnrOrder) safetyAlerts.push({ type: 'DNR Order', level: 'high', details: `Ordered by: ${patient.dnrOrderPhysician || 'N/A'}` });
  if (patient.suicideRisk) safetyAlerts.push({ type: 'Suicide Risk', level: 'critical' });
  if (patient.elopementRisk) safetyAlerts.push({ type: 'Elopement Risk', level: 'high' });

  // Generate QR Code data (simulated)
  const qrCodeData = patient.qrCodeData || `PATIENT:${patient.id}|MRN:${patient.mrn}|DOB:${formatDate(patient.dateOfBirth)}`;

  if (compact) {
    return (
      <CompactPatientCard patient={patient} criticalAlertsCount={criticalAlertsCount} />
    );
  }

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      {/* Header Section with Hospital Branding */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-t-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">PATIENT IDENTITY CARD</h1>
              <p className="text-emerald-100 text-sm">Healthcare Excellence Network</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onScan && (
              <Button variant="secondary" size="sm" onClick={onScan} className="bg-white/20 hover:bg-white/30">
                <ScanLine className="h-4 w-4 mr-1" />
                Scan
              </Button>
            )}
            {onPrint && (
              <Button variant="secondary" size="sm" onClick={onPrint} className="bg-white/20 hover:bg-white/30">
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Critical Alert Banner - Always Visible */}
      {criticalAlertsCount > 0 && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2 animate-pulse">
          <AlertOctagon className="h-5 w-5" />
          <span className="font-bold">⚠️ CRITICAL ALERTS: {criticalAlertsCount} safety concern{criticalAlertsCount > 1 ? 's' : ''} identified</span>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white border border-gray-200 rounded-b-xl shadow-lg">
        {/* Patient Identification Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start gap-6">
            {/* Patient Photo */}
            <div className="flex-shrink-0">
              <Avatar className="h-28 w-28 border-4 border-emerald-600 shadow-lg">
                <AvatarImage src={patient.patientPhoto} alt={`${patient.firstName} ${patient.lastName}`} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl font-bold">
                  {patient.firstName[0]}{patient.lastName[0]}
                </AvatarFallback>
              </Avatar>
              {patient.organDonorStatus === 'yes' && (
                <Badge className="mt-2 bg-green-600 text-white w-full justify-center">
                  <Heart className="h-3 w-3 mr-1" />
                  ORGAN DONOR
                </Badge>
              )}
            </div>

            {/* Patient Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {patient.firstName} {patient.middleName} {patient.lastName}
                    {patient.preferredName && (
                      <span className="text-gray-500 font-normal text-lg ml-2">
                        ({patient.preferredName})
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-4 mt-2 text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      DOB: {formatDate(patient.dateOfBirth)} ({calculateAge(patient.dateOfBirth)} yrs)
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                    </span>
                    {patient.maritalStatus && (
                      <span>{patient.maritalStatus}</span>
                    )}
                  </div>
                </div>

                {/* Blood Type - Emergency Critical */}
                <div className={`px-6 py-3 rounded-lg ${getBloodTypeColor(patient.bloodType || '')} text-center`}>
                  <Droplet className="h-6 w-6 mx-auto mb-1" />
                  <div className="text-2xl font-bold">
                    {patient.bloodType || '?'}
                    {patient.rhFactor === 'positive' ? '+' : patient.rhFactor === 'negative' ? '-' : ''}
                  </div>
                  <div className="text-xs font-medium">BLOOD TYPE</div>
                </div>
              </div>

              {/* ID Numbers Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {patient.mrn && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-xs text-gray-500">Medical Record No.</div>
                    <div className="font-mono font-bold text-gray-900">{patient.mrn}</div>
                  </div>
                )}
                {patient.nationalHealthId && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-xs text-gray-500">National Health ID</div>
                    <div className="font-mono font-bold text-gray-900">{patient.nationalHealthId}</div>
                  </div>
                )}
                {patient.patientDigitalId && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-xs text-gray-500">Digital Patient ID</div>
                    <div className="font-mono font-bold text-gray-900">{patient.patientDigitalId}</div>
                  </div>
                )}
                {patient.smartCardSerialNumber && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-xs text-gray-500">Smart Card Serial</div>
                    <div className="font-mono font-bold text-gray-900">{patient.smartCardSerialNumber}</div>
                  </div>
                )}
              </div>
            </div>

            {/* QR Code */}
            {showQRCode && (
              <div className="flex-shrink-0 text-center">
                <div className="bg-white border-2 border-gray-300 rounded-lg p-3 shadow-sm">
                  <div className="w-24 h-24 bg-gray-100 flex items-center justify-center rounded">
                    <QrCode className="h-16 w-16 text-gray-800" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Scan for EHR</p>
              </div>
            )}
          </div>
        </div>

        {/* EMERGENCY MEDICAL DATA - Always Visible, Red Background */}
        {patient.allergies && patient.allergies.length > 0 && (
          <div className="bg-red-50 border-y-2 border-red-300 p-4">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('allergies')}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-bold text-red-700">
                  ALLERGIES ({patient.allergies.length})
                </h3>
                {patient.allergyCritical && (
                  <Badge className="bg-red-600 text-white animate-pulse">LIFE-THREATENING</Badge>
                )}
              </div>
              {expandedSections.allergies ? <ChevronUp /> : <ChevronDown />}
            </div>
            {expandedSections.allergies && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {patient.allergies.map((allergy, index) => (
                  <div
                    key={index}
                    className={`px-3 py-2 rounded-lg flex items-center gap-2 ${getSeverityColor(allergy.severity)}`}
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <div>
                      <div className="font-bold">{allergy.name}</div>
                      {allergy.reaction && <div className="text-sm opacity-90">{allergy.reaction}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SAFETY ALERTS SECTION */}
        {safetyAlerts.length > 0 && (
          <div className="bg-orange-50 border-b border-orange-200 p-4">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('safety')}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-orange-600" />
                <h3 className="text-lg font-bold text-orange-700">
                  SAFETY ALERTS ({safetyAlerts.length})
                </h3>
              </div>
              {expandedSections.safety ? <ChevronUp /> : <ChevronDown />}
            </div>
            {expandedSections.safety && (
              <div className="mt-3 flex flex-wrap gap-2">
                {safetyAlerts.map((alert, index) => (
                  <Badge
                    key={index}
                    className={`${getSeverityColor(alert.level)} px-3 py-1 text-sm`}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {alert.type}
                    {alert.details && ` - ${alert.details}`}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pregnancy Status - Special Alert */}
        {patient.pregnancyStatus === 'pregnant' && (
          <div className="bg-pink-50 border-b border-pink-200 p-4">
            <div className="flex items-center gap-2">
              <Heart className="h-6 w-6 text-pink-600" />
              <h3 className="text-lg font-bold text-pink-700">PREGNANT</h3>
              {patient.estimatedDueDate && (
                <Badge className="bg-pink-600 text-white">
                  EDD: {formatDate(patient.estimatedDueDate)}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Infectious Disease Isolation - Critical */}
        {patient.infectiousDiseaseStatus && (
          <div className="bg-yellow-50 border-b-2 border-yellow-400 p-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-400 rounded-full p-2">
                <AlertOctagon className="h-6 w-6 text-yellow-900" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-yellow-800">INFECTION CONTROL REQUIRED</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-yellow-600 text-white">{patient.infectiousDiseaseStatus}</Badge>
                  {patient.infectionIsolationType && (
                    <Badge className="bg-yellow-700 text-white uppercase">
                      {patient.infectionIsolationType} PRECAUTIONS
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs for Detailed Information */}
        <div className="p-4">
          <Tabs defaultValue="medical" className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="medical" className="flex items-center gap-1">
                <Stethoscope className="h-4 w-4" />
                Medical
              </TabsTrigger>
              <TabsTrigger value="social" className="flex items-center gap-1">
                <UserCheck className="h-4 w-4" />
                Social
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                Contact
              </TabsTrigger>
              <TabsTrigger value="insurance" className="flex items-center gap-1">
                <CreditCard className="h-4 w-4" />
                Insurance
              </TabsTrigger>
              <TabsTrigger value="digital" className="flex items-center gap-1">
                <Wifi className="h-4 w-4" />
                Digital
              </TabsTrigger>
            </TabsList>

            {/* Medical Tab */}
            <TabsContent value="medical" className="mt-4 space-y-4">
              {/* Chronic Conditions */}
              {patient.chronicConditions && patient.chronicConditions.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Chronic Conditions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {patient.chronicConditions.map((condition, index) => (
                      <Badge key={index} variant="outline" className="bg-white">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Implanted Devices */}
              {patient.implantedDevices && patient.implantedDevices.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Implanted Medical Devices
                  </h4>
                  <div className="space-y-2">
                    {patient.implantedDevices.map((device, index) => (
                      <div key={index} className="bg-white rounded p-2 flex items-center justify-between">
                        <div>
                          <span className="font-medium">{device.device}</span>
                          <span className="text-gray-500 text-sm ml-2">({device.location})</span>
                        </div>
                        {device.date && (
                          <span className="text-xs text-gray-500">{device.date}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* High-Risk Medications */}
              {patient.highRiskMedications && patient.highRiskMedications.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <Pill className="h-4 w-4" />
                    High-Risk Medications
                  </h4>
                  <div className="space-y-2">
                    {patient.highRiskMedications.map((med, index) => (
                      <div key={index} className="bg-white rounded p-2 border border-red-100">
                        <span className="font-medium text-red-700">{med.medication}</span>
                        <span className="text-gray-600 text-sm ml-2">- {med.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clinical Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Last Hospital Visit</div>
                  <div className="font-semibold">{formatDate(patient.lastHospitalVisit)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Primary Care Physician</div>
                  <div className="font-semibold">{patient.primaryCarePhysician || 'Not assigned'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Primary Care Facility</div>
                  <div className="font-semibold">{patient.primaryCareFacility || 'Not assigned'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Total Admissions</div>
                  <div className="font-semibold">{patient.totalAdmissions || 0}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">ED Visits</div>
                  <div className="font-semibold">{patient.totalEdVisits || 0}</div>
                </div>
                {patient.triagePriority && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Triage Priority</div>
                    <Badge className={`${getTriageColor(patient.triagePriority)} mt-1`}>
                      {patient.triagePriority.toUpperCase()}
                    </Badge>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Social Tab */}
            <TabsContent value="social" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Language */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    Language & Communication
                  </h4>
                  <div className="space-y-2">
                    {patient.languagePrimary && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Primary:</span>
                        <span className="font-medium">{patient.languagePrimary}</span>
                      </div>
                    )}
                    {patient.languageSecondary && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Secondary:</span>
                        <span className="font-medium">{patient.languageSecondary}</span>
                      </div>
                    )}
                    {patient.interpreterNeeded && (
                      <Badge className="bg-blue-600 text-white mt-2">
                        Interpreter Required
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Religion & Cultural */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Religion & Cultural Considerations
                  </h4>
                  <div className="space-y-2">
                    {patient.religion && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Religion:</span>
                        <span className="font-medium">{patient.religion}</span>
                      </div>
                    )}
                    {patient.religiousConsiderations && (
                      <div className="text-sm text-gray-600 mt-2 p-2 bg-white rounded">
                        {patient.religiousConsiderations}
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobility */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Accessibility className="h-4 w-4" />
                    Mobility Status
                  </h4>
                  <div className="space-y-2">
                    {patient.mobilityStatus && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Status:</span>
                        <Badge variant="outline">{patient.mobilityStatus}</Badge>
                      </div>
                    )}
                    {patient.mobilityAid && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Aid:</span>
                        <span className="font-medium">{patient.mobilityAid}</span>
                      </div>
                    )}
                    {patient.disabilityStatus && patient.disabilityStatus.length > 0 && (
                      <div className="mt-2">
                        <span className="text-gray-600 text-sm">Disabilities:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patient.disabilityStatus.map((d, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Caregiver */}
                {(patient.caregiverName || patient.healthcareProxyName) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Caregiver / Healthcare Proxy
                    </h4>
                    <div className="space-y-2">
                      {patient.caregiverName && (
                        <div>
                          <span className="text-gray-600 text-sm">Caregiver:</span>
                          <div className="font-medium">{patient.caregiverName}</div>
                          {patient.caregiverPhone && (
                            <div className="text-sm text-gray-500">{patient.caregiverPhone}</div>
                          )}
                          {patient.caregiverRelation && (
                            <div className="text-xs text-gray-400">({patient.caregiverRelation})</div>
                          )}
                        </div>
                      )}
                      {patient.healthcareProxyName && (
                        <div className="border-t pt-2 mt-2">
                          <span className="text-gray-600 text-sm">Healthcare Proxy:</span>
                          <div className="font-medium">{patient.healthcareProxyName}</div>
                          {patient.healthcareProxyPhone && (
                            <div className="text-sm text-gray-500">{patient.healthcareProxyPhone}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Advance Directive */}
                {patient.advanceDirective && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-700">Advance Directive on File</span>
                    </div>
                    {patient.advanceDirectiveLocation && (
                      <div className="text-sm text-green-600 mt-1">
                        Location: {patient.advanceDirectiveLocation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Patient Contact */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Patient Contact
                  </h4>
                  <div className="space-y-3">
                    {patient.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{patient.phone}</span>
                        {patient.phoneType && (
                          <Badge variant="outline" className="text-xs">{patient.phoneType}</Badge>
                        )}
                      </div>
                    )}
                    {patient.alternatePhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{patient.alternatePhone} (alt)</span>
                      </div>
                    )}
                    {patient.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{patient.email}</span>
                      </div>
                    )}
                    {patient.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                        <div>
                          <div>{patient.address}</div>
                          <div>{[patient.city, patient.state, patient.postalCode].filter(Boolean).join(', ')}</div>
                          {patient.country && <div>{patient.country}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Emergency Contacts */}
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Emergency Contacts
                  </h4>
                  <div className="space-y-3">
                    {patient.emergencyContactName && (
                      <div className="bg-white rounded p-3">
                        <div className="font-semibold">{patient.emergencyContactName}</div>
                        {patient.emergencyContactRelation && (
                          <div className="text-sm text-gray-500">{patient.emergencyContactRelation}</div>
                        )}
                        {patient.emergencyContactPhone && (
                          <div className="flex items-center gap-2 mt-1 text-red-600">
                            <Phone className="h-4 w-4" />
                            <span className="font-mono">{patient.emergencyContactPhone}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {patient.emergencyContact2Name && (
                      <div className="bg-white rounded p-3">
                        <div className="font-semibold">{patient.emergencyContact2Name}</div>
                        {patient.emergencyContact2Relation && (
                          <div className="text-sm text-gray-500">{patient.emergencyContact2Relation}</div>
                        )}
                        {patient.emergencyContact2Phone && (
                          <div className="flex items-center gap-2 mt-1 text-red-600">
                            <Phone className="h-4 w-4" />
                            <span className="font-mono">{patient.emergencyContact2Phone}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Insurance Tab */}
            <TabsContent value="insurance" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Insurance */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2">Primary Insurance</h4>
                  {patient.insurancePrimary ? (
                    <div className="space-y-2">
                      <div className="font-medium text-lg">{patient.insurancePrimary}</div>
                      {patient.insurancePrimaryId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Member ID:</span>
                          <span className="font-mono">{patient.insurancePrimaryId}</span>
                        </div>
                      )}
                      {patient.insurancePrimaryGroup && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Group:</span>
                          <span className="font-mono">{patient.insurancePrimaryGroup}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {patient.insuranceVerified ? (
                          <Badge className="bg-green-600 text-white">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Unverified
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">No primary insurance on file</div>
                  )}
                </div>

                {/* Secondary Insurance */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-2">Secondary Insurance</h4>
                  {patient.insuranceSecondary ? (
                    <div className="space-y-2">
                      <div className="font-medium text-lg">{patient.insuranceSecondary}</div>
                      {patient.insuranceSecondaryId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Member ID:</span>
                          <span className="font-mono">{patient.insuranceSecondaryId}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">No secondary insurance on file</div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Digital Tab */}
            <TabsContent value="digital" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI Risk Assessment */}
                {patient.aiRiskScore !== undefined && (
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                    <h4 className="font-semibold text-purple-700 mb-3 flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      AI Risk Assessment
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Overall Risk Score:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${patient.aiRiskLevel === 'critical' ? 'bg-red-600' :
                                patient.aiRiskLevel === 'high' ? 'bg-orange-500' :
                                patient.aiRiskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                              style={{ width: `${(patient.aiRiskScore || 0) * 100}%` }}
                            />
                          </div>
                          <span className="font-bold">
                            {Math.round((patient.aiRiskScore || 0) * 100)}%
                          </span>
                        </div>
                      </div>
                      {patient.aiRiskLevel && (
                        <Badge className={`${getSeverityColor(patient.aiRiskLevel)}`}>
                          {patient.aiRiskLevel.toUpperCase()} RISK
                        </Badge>
                      )}
                      {patient.aiReadmissionRisk !== undefined && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Readmission Risk:</span>
                          <span>{Math.round(patient.aiReadmissionRisk * 100)}%</span>
                        </div>
                      )}
                      {patient.aiTriagePrediction && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">AI Triage:</span>
                          <Badge className={getTriageColor(patient.aiTriagePrediction)}>
                            {patient.aiTriagePrediction.toUpperCase()}
                          </Badge>
                        </div>
                      )}
                      {patient.aiRiskFactors && patient.aiRiskFactors.length > 0 && (
                        <div className="mt-2">
                          <span className="text-gray-600 text-sm">Risk Factors:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {patient.aiRiskFactors.map((factor, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{factor}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Biometric Authentication */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Fingerprint className="h-4 w-4" />
                    Biometric Authentication
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Fingerprint:</span>
                      {patient.fingerprintRegistered ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Iris Scan:</span>
                      {patient.irisScanRegistered ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Voice Print:</span>
                      {patient.voicePrintRegistered ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Digital Access */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    Digital Access
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">NFC Enabled:</span>
                      {patient.nfcEnabled ? (
                        <Badge className="bg-blue-600 text-white">Active</Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Patient Portal:</span>
                      {patient.patientPortalAccess ? (
                        <Badge className="bg-green-600 text-white">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    {patient.rfidTagId && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">RFID Tag:</span>
                        <span className="font-mono text-sm">{patient.rfidTagId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Status */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Card Status
                  </h4>
                  <div className="space-y-2">
                    {patient.cardPrintDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Printed:</span>
                        <span>{formatDate(patient.cardPrintDate)}</span>
                      </div>
                    )}
                    {patient.cardExpiryDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Expires:</span>
                        <span className={new Date(patient.cardExpiryDate) < new Date() ? 'text-red-600 font-bold' : ''}>
                          {formatDate(patient.cardExpiryDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Emergency Alerts */}
              {patient.aiEmergencyAlerts && patient.aiEmergencyAlerts.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4" />
                    AI-Generated Emergency Alerts
                  </h4>
                  <div className="space-y-2">
                    {patient.aiEmergencyAlerts.map((alert, index) => (
                      <div key={index} className="bg-white rounded p-2 text-red-700 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {alert}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-3 flex items-center justify-between text-sm text-gray-500 border-t">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last Updated: {formatDate(patient.updatedAt)}
            </span>
            <span>Card ID: {patient.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>HIPAA Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact Card Component for List Views
function CompactPatientCard({
  patient,
  criticalAlertsCount
}: {
  patient: SmartPatientIdentityData;
  criticalAlertsCount: number;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex">
        {/* Status Indicator */}
        <div className={`w-2 ${criticalAlertsCount > 0 ? 'bg-red-500' : 'bg-green-500'}`} />

        <CardContent className="flex-1 p-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={patient.patientPhoto} />
              <AvatarFallback>{patient.firstName[0]}{patient.lastName[0]}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">
                  {patient.firstName} {patient.lastName}
                </h3>
                {criticalAlertsCount > 0 && (
                  <Badge className="bg-red-600 text-white text-xs">
                    {criticalAlertsCount} ALERT{criticalAlertsCount > 1 ? 'S' : ''}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>MRN: {patient.mrn}</span>
                <span>DOB: {formatDate(patient.dateOfBirth)}</span>
                {patient.bloodType && (
                  <Badge variant="outline" className="text-red-600 border-red-300">
                    <Droplet className="h-3 w-3 mr-1" />
                    {patient.bloodType}
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost">
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost">
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// Default export
export default SmartPatientIdentityCard;

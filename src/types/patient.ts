/**
 * Unified Patient Types
 * Single source of truth for all patient-related interfaces across the application
 */

// ============================================
// SUPPORTING TYPES
// ============================================

export interface Allergy {
  name: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction?: string;
}

export interface ImplantedDevice {
  device: string;
  location: string;
  date?: string;
}

export interface HighRiskMedication {
  medication: string;
  reason: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface AddressData {
  country: string;
  city: string;
  streetAddress: string;
  // Dynamic fields based on country
  region?: string;
  zone?: string;
  woreda?: string;
  kebele?: string;
  houseNumber?: string;
  state?: string;
  county?: string;
  zipCode?: string;
  province?: string;
  postalCode?: string;
  postcode?: string;
  district?: string;
  pinCode?: string;
  prefecture?: string;
  emirate?: string;
  lga?: string;
  governorate?: string;
  voivodeship?: string;
  [key: string]: string | undefined;
}

export interface FileAttachment {
  name: string;
  url: string;
  type: string;
  size?: number;
  uploadedAt?: string;
}

// ============================================
// MAIN PATIENT FORM DATA
// Used by PatientRegistrationCard
// ============================================

export interface PatientFormData {
  // Personal Information
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  
  // Nationality & Language
  nationalities: string[];
  languages: string[];
  religion: string;
  
  // Identification
  idType: string;  // Type of identification document (passport, national_id, residence_permit, etc.)
  idNumber: string;  // The identification document number

  // Contact Information
  phone: string;
  phoneType: string;
  alternatePhone: string;
  email: string;
  
  // Address
  address: AddressData;
  
  // Emergency Contacts
  emergencyContacts: EmergencyContact[];
  
  // Medical Information
  bloodType: string;
  rhFactor: string;
  allergies: string[];
  chronicConditions: string[];
  organDonor: string;
  
  // Notes & Attachments
  notes: string;
  attachments: File[];
  
  // Insurance
  insuranceProvider: string;
  insuranceId: string;
  insuranceGroup: string;
}

// ============================================
// PATIENT RECORD (Full Database Record)
// Used for display and data transfer
// ============================================

export interface PatientRecord {
  // Identity
  id: string;
  mrn?: string;
  nationalHealthId?: string;
  patientDigitalId?: string;
  smartCardSerialNumber?: string;
  biometricId?: string;

  // Demographics
  title?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  dateOfBirth: string | Date;
  gender: string;
  bloodType?: string;
  rhFactor?: string;
  maritalStatus?: string;
  ethnicity?: string;
  race?: string;
  
  // Nationality & Language
  nationalities?: string[];      // JSON array
  languages?: string[];          // JSON array
  languagePrimary?: string;
  languageSecondary?: string;
  interpreterNeeded?: boolean;
  
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
  emergencyContactEmail?: string;
  emergencyContact2Name?: string;
  emergencyContact2Phone?: string;
  emergencyContact2Relation?: string;
  emergencyContact2Email?: string;
  emergencyContacts?: EmergencyContact[];  // JSON array
  
  // Emergency Medical
  allergies?: Allergy[] | string;
  allergyCritical?: boolean;
  organDonorStatus?: string;
  pregnancyStatus?: string;
  estimatedDueDate?: string | Date;
  chronicConditions?: string[] | string;
  implantedDevices?: ImplantedDevice[];
  
  // Safety Alerts
  fallRisk?: boolean;
  fallRiskLevel?: 'low' | 'medium' | 'high';
  infectiousDiseaseStatus?: string;
  infectionIsolationType?: string;
  dnrOrder?: boolean;
  dnrOrderDate?: string | Date;
  dnrOrderPhysician?: string;
  highRiskMedications?: HighRiskMedication[];
  suicideRisk?: boolean;
  elopementRisk?: boolean;
  
  // Social & Care
  religion?: string;
  religiousConsiderations?: string;
  disabilityStatus?: string;
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
  lastHospitalVisit?: string | Date;
  lastPhysicianName?: string;
  primaryCarePhysician?: string;
  primaryCareFacility?: string;
  triagePriority?: string;
  
  // Insurance
  insurancePrimary?: string;
  insurancePrimaryId?: string;
  insurancePrimaryGroup?: string;
  insuranceSecondary?: string;
  insuranceSecondaryId?: string;
  insuranceVerified?: boolean;
  
  // AI Fields
  aiRiskScore?: number;
  aiRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
  aiRiskFactors?: string[];
  aiReadmissionRisk?: number;
  aiEmergencyAlerts?: string[];
  
  // Digital Health
  qrCodeData?: string;
  nfcEnabled?: boolean;
  digitalAccessEnabled?: boolean;
  patientPortalAccess?: boolean;
  
  // Biometric
  fingerprintRegistered?: boolean;
  irisScanRegistered?: boolean;
  voicePrintRegistered?: boolean;
  
  // Metadata
  patientPhoto?: string;
  cardPrintDate?: string | Date;
  cardExpiryDate?: string | Date;
  isActive?: boolean;
  notes?: string;
  attachments?: FileAttachment[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  
  // Relations
  consultations?: ConsultationSummary[];
  medications?: MedicationSummary[];
}

// ============================================
// SUMMARY TYPES FOR LISTS
// ============================================

export interface ConsultationSummary {
  id: string;
  consultationDate: string | Date;
  chiefComplaint?: string;
  status: string;
}

export interface MedicationSummary {
  id: string;
  medicationName: string;
  dosage?: string;
  status: string;
}

// ============================================
// PATIENT LIST ITEM (Minimal for lists)
// ============================================

export interface PatientListItem {
  id: string;
  mrn?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string | Date;
  gender: string;
  bloodType?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  allergies?: string;
  chronicConditions?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  emergencyContactEmail?: string;
  createdAt?: string | Date;
  
  // Computed/Optional
  patientPhoto?: string;
  aiRiskLevel?: string;
  isActive?: boolean;
}

// ============================================
// FORM CONVERSION UTILITIES
// ============================================

/**
 * Convert PatientFormData to API format for creating/updating patients
 */
export function patientFormToApi(data: PatientFormData): Record<string, unknown> {
  return {
    title: data.title || null,
    firstName: data.firstName,
    middleName: data.middleName || null,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    maritalStatus: data.maritalStatus || null,
    
    // Nationality & Language
    nationalities: JSON.stringify(data.nationalities),
    languages: JSON.stringify(data.languages),
    religion: data.religion || null,
    
    // Identification - use idType and idNumber
    nationalIdType: data.idType || "national_id",
    nationalHealthId: data.idNumber || null,
    
    // Contact
    phone: data.phone || null,
    phoneType: data.phoneType || 'Mobile',
    alternatePhone: data.alternatePhone || null,
    email: data.email || null,
    
    // Address
    country: data.address.country || null,
    city: data.address.city || null,
    address: data.address.streetAddress || null,
    state: data.address.state || data.address.region || null,
    postalCode: data.address.postalCode || data.address.zipCode || data.address.postcode || null,
    
    // Dynamic address fields
    region: data.address.region || null,
    zone: data.address.zone || null,
    woreda: data.address.woreda || null,
    kebele: data.address.kebele || null,
    houseNumber: data.address.houseNumber || null,
    county: data.address.county || null,
    province: data.address.province || null,
    district: data.address.district || null,
    
    // Emergency Contacts
    emergencyContactName: data.emergencyContacts[0]?.name || null,
    emergencyContactPhone: data.emergencyContacts[0]?.phone || null,
    emergencyContactRelation: data.emergencyContacts[0]?.relationship || null,
    emergencyContactEmail: data.emergencyContacts[0]?.email || null,
    emergencyContact2Name: data.emergencyContacts[1]?.name || null,
    emergencyContact2Phone: data.emergencyContacts[1]?.phone || null,
    emergencyContact2Relation: data.emergencyContacts[1]?.relationship || null,
    emergencyContact2Email: data.emergencyContacts[1]?.email || null,
    emergencyContacts: JSON.stringify(data.emergencyContacts),
    
    // Medical
    bloodType: data.bloodType || null,
    rhFactor: data.rhFactor || null,
    allergies: JSON.stringify(data.allergies),
    chronicConditions: JSON.stringify(data.chronicConditions),
    organDonorStatus: data.organDonor || 'not-specified',
    
    // Notes
    notes: data.notes || null,
    
    // Insurance
    insurancePrimary: data.insuranceProvider || null,
    insurancePrimaryId: data.insuranceId || null,
    insurancePrimaryGroup: data.insuranceGroup || null,
  };
}

/**
 * Convert API patient record to PatientFormData for editing
 */
export function apiToPatientForm(patient: PatientRecord): PatientFormData {
  // Parse JSON fields
  let nationalities: string[] = [];
  let languages: string[] = [];
  let allergies: string[] = [];
  let chronicConditions: string[] = [];
  let emergencyContacts: EmergencyContact[] = [];
  
  try {
    nationalities = typeof patient.nationalities === 'string' 
      ? JSON.parse(patient.nationalities) 
      : (patient.nationalities || []);
  } catch { nationalities = []; }
  
  try {
    languages = typeof patient.languages === 'string'
      ? JSON.parse(patient.languages)
      : (patient.languages || []);
  } catch { languages = []; }
  
  try {
    const allergyData = typeof patient.allergies === 'string'
      ? JSON.parse(patient.allergies)
      : patient.allergies;
    allergies = Array.isArray(allergyData) 
      ? allergyData.map(a => typeof a === 'string' ? a : a.name)
      : [];
  } catch { allergies = []; }
  
  try {
    const conditionData = typeof patient.chronicConditions === 'string'
      ? JSON.parse(patient.chronicConditions)
      : patient.chronicConditions;
    chronicConditions = Array.isArray(conditionData) 
      ? conditionData.map(c => typeof c === 'string' ? c : c)
      : [];
  } catch { chronicConditions = []; }
  
  try {
    emergencyContacts = typeof patient.emergencyContacts === 'string'
      ? JSON.parse(patient.emergencyContacts)
      : (patient.emergencyContacts || []);
  } catch { emergencyContacts = []; }
  
  // Build emergency contacts from individual fields if not in JSON
  if (emergencyContacts.length === 0 && patient.emergencyContactName) {
    emergencyContacts.push({
      id: '1',
      name: patient.emergencyContactName,
      relationship: patient.emergencyContactRelation || '',
      phone: patient.emergencyContactPhone || '',
      email: patient.emergencyContactEmail || '',
    });
    if (patient.emergencyContact2Name) {
      emergencyContacts.push({
        id: '2',
        name: patient.emergencyContact2Name,
        relationship: patient.emergencyContact2Relation || '',
        phone: patient.emergencyContact2Phone || '',
        email: patient.emergencyContact2Email || '',
      });
    }
  }
  
  return {
    title: patient.title || '',
    firstName: patient.firstName,
    middleName: patient.middleName || '',
    lastName: patient.lastName,
    dateOfBirth: typeof patient.dateOfBirth === 'string' 
      ? patient.dateOfBirth 
      : new Date(patient.dateOfBirth).toISOString().split('T')[0],
    gender: patient.gender,
    maritalStatus: patient.maritalStatus || '',
    
    nationalities,
    languages,
    religion: patient.religion || '',
    
    // Identification - use idType and idNumber
    idType: (patient as any).nationalIdType || 'national_id',
    idNumber: patient.nationalHealthId || '',

    phone: patient.phone || '',
    phoneType: patient.phoneType || 'Mobile',
    alternatePhone: patient.alternatePhone || '',
    email: patient.email || '',
    
    address: {
      country: patient.country || '',
      city: patient.city || '',
      streetAddress: patient.address || '',
      state: patient.state || '',
      region: patient.state || '',
      postalCode: patient.postalCode || '',
    },
    
    emergencyContacts,
    
    bloodType: patient.bloodType || '',
    rhFactor: patient.rhFactor || '',
    allergies,
    chronicConditions,
    organDonor: patient.organDonorStatus || 'not-specified',
    
    notes: patient.notes || '',
    attachments: [],
    
    insuranceProvider: patient.insurancePrimary || '',
    insuranceId: patient.insurancePrimaryId || '',
    insuranceGroup: patient.insurancePrimaryGroup || '',
  };
}

// ============================================
// DISPLAY HELPERS
// ============================================

export function getPatientFullName(patient: Pick<PatientRecord, 'title' | 'firstName' | 'middleName' | 'lastName'>): string {
  const parts: string[] = [];
  if (patient.title) parts.push(patient.title);
  if (patient.firstName) parts.push(patient.firstName);
  if (patient.middleName) parts.push(patient.middleName);
  if (patient.lastName) parts.push(patient.lastName);
  return parts.join(' ');
}

export function getPatientInitials(patient: Pick<PatientRecord, 'firstName' | 'lastName'>): string {
  return `${patient.firstName?.[0] || ''}${patient.lastName?.[0] || ''}`.toUpperCase();
}

export function calculateAge(dateOfBirth: string | Date): string {
  if (!dateOfBirth) return '';
  
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const today = new Date();
  
  if (isNaN(dob.getTime()) || dob > today) return '';
  
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  let days = today.getDate() - dob.getDate();
  
  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  if (years === 0) {
    if (months === 0) {
      return `${days} day${days !== 1 ? 's' : ''} old`;
    }
    return `${months} month${months !== 1 ? 's' : ''} old`;
  }
  
  if (years < 3 && months > 0) {
    return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''} old`;
  }
  
  return `${years} year${years !== 1 ? 's' : ''} old`;
}

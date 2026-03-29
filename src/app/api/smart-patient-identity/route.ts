import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/auth-middleware';

// Schema for creating/updating smart patient identity
const SmartPatientIdentitySchema = z.object({
  // Identity
  nationalHealthId: z.string().optional().nullable(),
  nationalIdType: z.string().optional().nullable(),
  biometricId: z.string().optional().nullable(),
  facialRecognitionId: z.string().optional().nullable(),
  patientDigitalId: z.string().optional().nullable(),
  smartCardSerialNumber: z.string().optional().nullable(),
  mrn: z.string().optional().nullable(),
  
  // Demographics
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional().nullable(),
  preferredName: z.string().optional().nullable(),
  dateOfBirth: z.string().or(z.date()),
  gender: z.string(),
  bloodType: z.string().optional().nullable(),
  rhFactor: z.string().optional().nullable(),
  maritalStatus: z.string().optional().nullable(),
  ethnicity: z.string().optional().nullable(),
  race: z.string().optional().nullable(),
  
  // Contact
  phone: z.string().optional().nullable(),
  phoneType: z.string().optional().nullable(),
  alternatePhone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  
  // Emergency Contacts
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  emergencyContact2Name: z.string().optional().nullable(),
  emergencyContact2Phone: z.string().optional().nullable(),
  emergencyContact2Relation: z.string().optional().nullable(),
  
  // Emergency Medical Info
  allergies: z.string().optional().nullable(), // JSON string
  allergyCritical: z.boolean().optional().default(false),
  organDonorStatus: z.string().optional().nullable(),
  pregnancyStatus: z.string().optional().nullable(),
  estimatedDueDate: z.string().or(z.date()).optional().nullable(),
  chronicConditions: z.string().optional().nullable(), // JSON string
  implantedDevices: z.string().optional().nullable(), // JSON string
  
  // Safety Alerts
  fallRisk: z.boolean().optional().default(false),
  fallRiskLevel: z.string().optional().nullable(),
  infectiousDiseaseStatus: z.string().optional().nullable(),
  infectionIsolationType: z.string().optional().nullable(),
  dnrOrder: z.boolean().optional().default(false),
  dnrOrderDate: z.string().or(z.date()).optional().nullable(),
  dnrOrderPhysician: z.string().optional().nullable(),
  isolationPrecautions: z.string().optional().nullable(),
  highRiskMedications: z.string().optional().nullable(), // JSON string
  suicideRisk: z.boolean().optional().default(false),
  elopementRisk: z.boolean().optional().default(false),
  
  // Social & Care
  languagePrimary: z.string().optional().nullable(),
  languageSecondary: z.string().optional().nullable(),
  interpreterNeeded: z.boolean().optional().default(false),
  religion: z.string().optional().nullable(),
  religiousConsiderations: z.string().optional().nullable(),
  disabilityStatus: z.string().optional().nullable(), // JSON string
  mobilityStatus: z.string().optional().nullable(),
  mobilityAid: z.string().optional().nullable(),
  caregiverName: z.string().optional().nullable(),
  caregiverPhone: z.string().optional().nullable(),
  caregiverRelation: z.string().optional().nullable(),
  advanceDirective: z.boolean().optional().default(false),
  advanceDirectiveLocation: z.string().optional().nullable(),
  healthcareProxyName: z.string().optional().nullable(),
  healthcareProxyPhone: z.string().optional().nullable(),
  
  // Clinical Metadata
  lastHospitalVisit: z.string().or(z.date()).optional().nullable(),
  lastPhysicianName: z.string().optional().nullable(),
  lastPhysicianSpecialty: z.string().optional().nullable(),
  primaryCarePhysician: z.string().optional().nullable(),
  primaryCareFacility: z.string().optional().nullable(),
  triagePriority: z.string().optional().nullable(),
  totalAdmissions: z.number().optional().default(0),
  totalEdVisits: z.number().optional().default(0),
  
  // Insurance
  insurancePrimary: z.string().optional().nullable(),
  insurancePrimaryId: z.string().optional().nullable(),
  insurancePrimaryGroup: z.string().optional().nullable(),
  insuranceSecondary: z.string().optional().nullable(),
  insuranceSecondaryId: z.string().optional().nullable(),
  insuranceVerified: z.boolean().optional().default(false),
  insuranceVerifiedDate: z.string().or(z.date()).optional().nullable(),
  
  // AI-Ready Fields
  aiRiskScore: z.number().optional().nullable(),
  aiRiskLevel: z.string().optional().nullable(),
  aiRiskFactors: z.string().optional().nullable(), // JSON string
  aiReadmissionRisk: z.number().optional().nullable(),
  aiMortalityRisk: z.number().optional().nullable(),
  aiTriagePrediction: z.string().optional().nullable(),
  aiEmergencyAlerts: z.string().optional().nullable(), // JSON string
  aiLastAssessment: z.string().or(z.date()).optional().nullable(),
  aiPopulationHealthTag: z.string().optional().nullable(),
  
  // Digital Health
  qrCodeData: z.string().optional().nullable(),
  nfcEnabled: z.boolean().optional().default(false),
  rfidTagId: z.string().optional().nullable(),
  digitalAccessEnabled: z.boolean().optional().default(false),
  patientPortalAccess: z.boolean().optional().default(false),
  patientPortalLastAccess: z.string().or(z.date()).optional().nullable(),
  
  // Biometric
  fingerprintRegistered: z.boolean().optional().default(false),
  fingerprintTemplateId: z.string().optional().nullable(),
  irisScanRegistered: z.boolean().optional().default(false),
  irisScanTemplateId: z.string().optional().nullable(),
  voicePrintRegistered: z.boolean().optional().default(false),
  voicePrintTemplateId: z.string().optional().nullable(),
  
  // Metadata
  patientPhoto: z.string().optional().nullable(),
  cardPrintDate: z.string().or(z.date()).optional().nullable(),
  cardExpiryDate: z.string().or(z.date()).optional().nullable(),
  isActive: z.boolean().optional().default(true)
});

// GET /api/smart-patient-identity - List all patients with smart identity
export async function GET(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;
  if (!user.permissions.includes('patient:read')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const hasAlerts = searchParams.get('hasAlerts') === 'true';
    const riskLevel = searchParams.get('riskLevel');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isActive: true
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { mrn: { contains: search, mode: 'insensitive' } },
        { nationalHealthId: { contains: search, mode: 'insensitive' } },
        { patientDigitalId: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (hasAlerts) {
      where.OR = [
        { allergyCritical: true },
        { fallRisk: true },
        { infectiousDiseaseStatus: { not: null } },
        { dnrOrder: true },
        { suicideRisk: true },
        { elopementRisk: true }
      ];
    }

    if (riskLevel) {
      where.aiRiskLevel = riskLevel;
    }

    const [patients, total] = await Promise.all([
      db.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              consultations: true,
              medications: true,
              vitals: true
            }
          }
        }
      }),
      db.patient.count({ where })
    ]);

    // Parse JSON fields for each patient
    const parsedPatients = patients.map(patient => ({
      ...patient,
      allergies: patient.allergies ? JSON.parse(patient.allergies) : [],
      chronicConditions: patient.chronicConditions ? JSON.parse(patient.chronicConditions) : [],
      implantedDevices: patient.implantedDevices ? JSON.parse(patient.implantedDevices) : [],
      highRiskMedications: patient.highRiskMedications ? JSON.parse(patient.highRiskMedications) : [],
      aiRiskFactors: patient.aiRiskFactors ? JSON.parse(patient.aiRiskFactors) : [],
      aiEmergencyAlerts: patient.aiEmergencyAlerts ? JSON.parse(patient.aiEmergencyAlerts) : [],
      disabilityStatus: patient.disabilityStatus ? JSON.parse(patient.disabilityStatus) : []
    }));

    return NextResponse.json({
      success: true,
      data: parsedPatients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching smart patient identities:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch patient identities' },
      { status: 500 }
    );
  }
}

// POST /api/smart-patient-identity - Create new smart patient identity
export async function POST(request: NextRequest) {
  // Authentication check
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }
  const user = authResult.user!;
  if (!user.permissions.includes('patient:read')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validatedData = SmartPatientIdentitySchema.parse(body);

    // Generate MRN if not provided
    const mrn = validatedData.mrn || `MRN-${Date.now().toString(36).toUpperCase()}`;
    
    // Generate digital patient ID
    const patientDigitalId = validatedData.patientDigitalId || 
      `PID-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Generate QR code data
    const qrCodeData = `PATIENT:${patientDigitalId}|MRN:${mrn}`;

    // Create patient with smart identity
    const patient = await db.patient.create({
      data: {
        // Explicitly set required fields
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        gender: validatedData.gender,
        // Spread the rest of the validated data
        ...validatedData,
        // Override with generated/computed values
        mrn,
        patientDigitalId,
        qrCodeData,
        estimatedDueDate: validatedData.estimatedDueDate ? new Date(validatedData.estimatedDueDate) : null,
        dnrOrderDate: validatedData.dnrOrderDate ? new Date(validatedData.dnrOrderDate) : null,
        lastHospitalVisit: validatedData.lastHospitalVisit ? new Date(validatedData.lastHospitalVisit) : null,
        insuranceVerifiedDate: validatedData.insuranceVerifiedDate ? new Date(validatedData.insuranceVerifiedDate) : null,
        aiLastAssessment: validatedData.aiLastAssessment ? new Date(validatedData.aiLastAssessment) : null,
        patientPortalLastAccess: validatedData.patientPortalLastAccess ? new Date(validatedData.patientPortalLastAccess) : null,
        cardPrintDate: validatedData.cardPrintDate ? new Date(validatedData.cardPrintDate) : null,
        cardExpiryDate: validatedData.cardExpiryDate ? new Date(validatedData.cardExpiryDate) : null,
        qrCodeGenerated: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: patient,
      message: 'Smart patient identity created successfully'
    });
  } catch (error) {
    console.error('Error creating smart patient identity:', error);
    if (error instanceof z.ZodError) {
      const zodError = error as unknown as { errors: Array<{ message: string; path: (string | number)[] }> };
      return NextResponse.json(
        { success: false, error: 'Validation error', details: zodError.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create patient identity' },
      { status: 500 }
    );
  }
}

/**
 * Voice Notes API - HIPAA Compliant
 * 
 * Voice notes for clinical documentation with ASR transcription
 * 
 * All operations require authentication and appropriate permissions:
 * - GET: soap_note:write
 * - POST: soap_note:write
 * - PATCH: soap_note:write
 * - DELETE: soap_note:write
 * 
 * Audit trail is maintained for all operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { withAuth, AuthenticatedUser } from "@/lib/auth-middleware";
import { createAuditLog } from "@/lib/audit-service";

/**
 * GET /api/voice-notes - Get voice notes for a patient or consultation
 * Permission: soap_note:write
 */
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const consultationId = searchParams.get("consultationId");

    const where: {
      patientId?: string;
      consultationId?: string;
    } = {};

    if (patientId) where.patientId = patientId;
    if (consultationId) where.consultationId = consultationId;

    const voiceNotes = await db.voiceNote.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      take: 50,
    });

    // Log access
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'read',
      resourceType: 'soap_note',
      resourceId: patientId || consultationId || undefined,
    });

    return NextResponse.json({
      success: true,
      data: { voiceNotes },
      meta: {
        accessedBy: user.employeeId,
        accessedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching voice notes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch voice notes" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['soap_note:write'] });

/**
 * POST /api/voice-notes - Transcribe audio and save voice note
 * Permission: soap_note:write
 */
export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const {
      audioBase64,
      patientId,
      consultationId,
      noteType,
      targetField,
      audioDuration,
      audioFormat,
    } = body;

    if (!audioBase64) {
      return NextResponse.json(
        { success: false, error: "Audio data is required" },
        { status: 400 }
      );
    }

    let transcription = "";
    let tags: string[] = [];

    try {
      // Use ASR to transcribe audio (reads from .z-ai-config file)
      const zai = await ZAI.create();
      const response = await zai.audio.asr.create({
        file_base64: audioBase64,
      });
      transcription = response.text || "";
    } catch (asrError) {
      console.error("ASR transcription failed:", asrError);
      // Return error - do not create fake data
      return NextResponse.json(
        {
          success: false,
          error: "Speech recognition failed. Please ensure audio is clear and try again.",
        },
        { status: 500 }
      );
    }

    if (!transcription.trim()) {
      return NextResponse.json(
        { success: false, error: "No speech detected in audio" },
        { status: 400 }
      );
    }

    // Extract medical tags from transcription
    tags = extractMedicalTags(transcription);

    // Save voice note to database
    const voiceNote = await db.voiceNote.create({
      data: {
        patientId: patientId || null,
        consultationId: consultationId || null,
        transcription,
        tags: JSON.stringify(tags),
        noteType: noteType || "general",
        targetField: targetField || null,
        audioDuration: audioDuration || null,
        audioFormat: audioFormat || "webm",
        status: "draft",
      },
    });

    // Log creation
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'create',
      resourceType: 'soap_note',
      resourceId: voiceNote.id,
      newValue: JSON.stringify({
        patientId,
        consultationId,
        noteType,
        transcriptionLength: transcription.length,
      }),
    });

    return NextResponse.json({
      success: true,
      data: {
        voiceNote,
        transcription,
        tags,
      },
      meta: {
        createdBy: user.employeeId,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error processing voice note:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process voice note" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['soap_note:write'] });

/**
 * PATCH /api/voice-notes - Update voice note
 * Permission: soap_note:write
 */
export const PATCH = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { id, transcription, tags, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Voice note ID is required" },
        { status: 400 }
      );
    }

    const updateData: {
      transcription?: string;
      tags?: string;
      status?: string;
    } = {};

    if (transcription !== undefined) {
      updateData.transcription = transcription;
      // Re-extract tags if transcription changes
      updateData.tags = JSON.stringify(extractMedicalTags(transcription));
    }
    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (status !== undefined) updateData.status = status;

    const voiceNote = await db.voiceNote.update({
      where: { id },
      data: updateData,
    });

    // Log update
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'update',
      resourceType: 'soap_note',
      resourceId: id,
      fieldChanged: Object.keys(updateData).join(', '),
    });

    return NextResponse.json({
      success: true,
      data: { voiceNote },
      meta: {
        updatedBy: user.employeeId,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating voice note:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update voice note" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['soap_note:write'] });

/**
 * DELETE /api/voice-notes - Delete voice note
 * Permission: soap_note:write
 */
export const DELETE = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Voice note ID is required" },
        { status: 400 }
      );
    }

    // Get voice note before deletion for audit log
    const voiceNote = await db.voiceNote.findUnique({
      where: { id },
      select: { id: true, patientId: true, noteType: true },
    });

    await db.voiceNote.delete({
      where: { id },
    });

    // Log deletion
    await createAuditLog({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      actionType: 'delete',
      resourceType: 'soap_note',
      resourceId: id,
      oldValue: JSON.stringify({
        patientId: voiceNote?.patientId,
        noteType: voiceNote?.noteType,
      }),
    });

    return NextResponse.json({
      success: true,
      message: "Voice note deleted successfully",
      meta: {
        deletedBy: user.employeeId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error deleting voice note:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete voice note" },
      { status: 500 }
    );
  }
}, { requiredPermissions: ['soap_note:write'] });

// Extract medical tags from transcription text
function extractMedicalTags(text: string): string[] {
  const medicalTerms = [
    // Symptoms
    "pain", "headache", "fever", "cough", "nausea", "vomiting", "dizziness",
    "fatigue", "weakness", "numbness", "tingling", "swelling", "rash",
    "shortness of breath", "chest pain", "abdominal pain", "back pain",
    
    // Conditions
    "diabetes", "hypertension", "hypotension", "asthma", "copd", "pneumonia",
    "bronchitis", "infection", "inflammation", "allergy", "anemia",
    "arthritis", "fracture", "trauma", "injury", "wound",
    
    // Vital signs
    "blood pressure", "heart rate", "temperature", "pulse", "respiratory rate",
    "oxygen saturation", "weight", "height", "bmi",
    
    // Medications
    "antibiotic", "antiviral", "analgesic", "antihypertensive", "insulin",
    "aspirin", "ibuprofen", "acetaminophen", "metformin", "lisinopril",
    "amlodipine", "omeprazole", "prednisone", "albuterol",
    
    // Body parts
    "heart", "lung", "liver", "kidney", "brain", "stomach", "intestine",
    "spine", "joint", "muscle", "bone", "skin", "eye", "ear", "nose", "throat",
    
    // Clinical terms
    "diagnosis", "prognosis", "treatment", "medication", "dosage", "frequency",
    "chronic", "acute", "mild", "moderate", "severe", "normal", "abnormal",
    "positive", "negative", "elevated", "decreased", "stable", "unstable",
    
    // Actions
    "examination", "assessment", "follow-up", "referral", "admission",
    "discharge", "surgery", "procedure", "test", "laboratory", "imaging",
  ];

  const lowerText = text.toLowerCase();
  const foundTags: string[] = [];

  for (const term of medicalTerms) {
    if (lowerText.includes(term)) {
      foundTags.push(term);
    }
  }

  // Also extract any words that look like medical codes (ICD, CPT)
  const codePattern = /[A-Z]\d{2}(\.\d+)?/g;
  const codes = text.match(codePattern) || [];
  foundTags.push(...codes);

  // Remove duplicates and return
  return [...new Set(foundTags)];
}

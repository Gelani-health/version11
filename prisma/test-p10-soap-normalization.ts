/**
 * PROMPT 10 Verification Tests - SOAP Note Schema Normalization
 * 
 * Tests for SoapNoteVersion, SoapNoteAssessmentItem, and SoapNotePlanItem models
 * 
 * Evidence Sources:
 * - HIPAA Privacy Rule: 45 CFR § 164.312(b) - Audit controls
 * - ICD-10-CM Official Guidelines for Coding and Reporting
 * - HL7 FHIR R4 Composition Resource
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test data
const testEmployeeId = 'TEST_EMP_001';
const testPatientId = 'TEST_PATIENT_001';
const testEncounterId = 'TEST_ENCOUNTER_001';

// Helper to create test employee
async function createTestEmployee() {
  return prisma.employee.create({
    data: {
      employeeId: testEmployeeId,
      firstName: 'Test',
      lastName: 'Doctor',
      email: 'test.doctor@gelani.health',
      role: 'physician',
      department: 'Internal Medicine',
    },
  });
}

// Helper to create test patient
async function createTestPatient() {
  return prisma.patient.create({
    data: {
      id: testPatientId,
      firstName: 'Test',
      lastName: 'Patient',
      dateOfBirth: new Date('1980-01-15'),
      gender: 'male',
    },
  });
}

// Helper to clean up test data
async function cleanup() {
  try {
    await prisma.soapNoteVersion.deleteMany({
      where: { soapNote: { encounterId: testEncounterId } },
    });
    await prisma.soapNoteAssessmentItem.deleteMany({
      where: { soapNote: { encounterId: testEncounterId } },
    });
    await prisma.soapNotePlanItem.deleteMany({
      where: { soapNote: { encounterId: testEncounterId } },
    });
    await prisma.differentialDiagnosis.deleteMany({
      where: { soapNote: { encounterId: testEncounterId } },
    });
    await prisma.soapNote.deleteMany({
      where: { encounterId: testEncounterId },
    });
    await prisma.patient.deleteMany({
      where: { id: testPatientId },
    });
    await prisma.employee.deleteMany({
      where: { employeeId: testEmployeeId },
    });
  } catch (error) {
    console.log('Cleanup note:', error);
  }
}

/**
 * TEST 1: Create SoapNote with AssessmentItems and PlanItems
 * Verifies that we can create a SOAP note with structured assessment and plan items
 */
async function testCreateSoapNoteWithItems() {
  console.log('\n=== TEST 1: Create SOAP Note with Assessment and Plan Items ===\n');
  
  await cleanup();
  await createTestEmployee();
  await createTestPatient();

  // Create SOAP note with 2 AssessmentItems and 3 PlanItems
  const soapNote = await prisma.soapNote.create({
    data: {
      encounterId: testEncounterId,
      patientId: testPatientId,
      chiefComplaint: 'Chest pain and shortness of breath',
      createdBy: testEmployeeId,
      status: 'draft',
      // Create 2 Assessment Items
      assessmentItems: {
        create: [
          {
            diagnosis: 'Acute myocardial infarction',
            icdCode: 'I21.9',
            icdVersion: 'ICD-10',
            rank: 1,
            confidence: 0.85,
            status: 'active',
            isPrimary: true,
            notes: 'Primary working diagnosis based on presentation',
          },
          {
            diagnosis: 'Unstable angina',
            icdCode: 'I20.0',
            icdVersion: 'ICD-10',
            rank: 2,
            confidence: 0.65,
            status: 'considering',
            isPrimary: false,
          },
        ],
      },
      // Create 3 Plan Items
      planItems: {
        create: [
          {
            category: 'lab',
            description: 'Troponin I, CK-MB, BNP levels',
            status: 'pending',
            priority: 'stat',
          },
          {
            category: 'imaging',
            description: '12-lead ECG and Chest X-ray',
            status: 'pending',
            priority: 'urgent',
          },
          {
            category: 'medication',
            description: 'Aspirin 325mg chewable, Nitroglycerin SL PRN',
            status: 'pending',
            priority: 'stat',
          },
        ],
      },
    },
    include: {
      assessmentItems: true,
      planItems: true,
    },
  });

  // Assertions
  console.log('Created SOAP Note ID:', soapNote.id);
  console.log('Assessment Items Count:', soapNote.assessmentItems.length);
  console.log('Plan Items Count:', soapNote.planItems.length);

  if (soapNote.assessmentItems.length !== 2) {
    throw new Error(`Expected 2 assessment items, got ${soapNote.assessmentItems.length}`);
  }
  if (soapNote.planItems.length !== 3) {
    throw new Error(`Expected 3 plan items, got ${soapNote.planItems.length}`);
  }

  // Verify primary diagnosis is marked correctly
  const primaryAssessment = soapNote.assessmentItems.find(a => a.isPrimary);
  if (!primaryAssessment || primaryAssessment.icdCode !== 'I21.9') {
    throw new Error('Primary assessment item not correctly marked');
  }

  console.log('✓ TEST 1 PASSED: SOAP Note created with structured items');
  return soapNote;
}

/**
 * TEST 2: Read SOAP Note with relations
 * Verifies that we can read back a SOAP note with all relations
 */
async function testReadSoapNoteWithRelations() {
  console.log('\n=== TEST 2: Read SOAP Note with All Relations ===\n');

  const soapNote = await prisma.soapNote.findFirst({
    where: { encounterId: testEncounterId },
    include: {
      assessmentItems: {
        orderBy: { rank: 'asc' },
      },
      planItems: {
        orderBy: { createdAt: 'asc' },
      },
      patient: true,
      author: true,
    },
  });

  if (!soapNote) {
    throw new Error('SOAP Note not found');
  }

  console.log('SOAP Note ID:', soapNote.id);
  console.log('Patient Name:', `${soapNote.patient.firstName} ${soapNote.patient.lastName}`);
  console.log('Author:', `${soapNote.author.firstName} ${soapNote.author.lastName}`);
  console.log('Assessment Items:');
  soapNote.assessmentItems.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.diagnosis} (${item.icdCode}) - Primary: ${item.isPrimary}`);
  });
  console.log('Plan Items:');
  soapNote.planItems.forEach((item, i) => {
    console.log(`  ${i + 1}. [${item.category.toUpperCase()}] ${item.description} (${item.priority})`);
  });

  if (soapNote.assessmentItems.length !== 2) {
    throw new Error(`Expected 2 assessment items, got ${soapNote.assessmentItems.length}`);
  }
  if (soapNote.planItems.length !== 3) {
    throw new Error(`Expected 3 plan items, got ${soapNote.planItems.length}`);
  }

  console.log('✓ TEST 2 PASSED: SOAP Note read with all relations');
  return soapNote;
}

/**
 * TEST 3: Create SoapNoteVersion for amendment trail
 * Verifies version history creation and linking
 */
async function testCreateVersionHistory() {
  console.log('\n=== TEST 3: Create Version History ===\n');

  const soapNote = await prisma.soapNote.findFirst({
    where: { encounterId: testEncounterId },
  });

  if (!soapNote) {
    throw new Error('SOAP Note not found');
  }

  // Create a version snapshot
  const version = await prisma.soapNoteVersion.create({
    data: {
      soapNoteId: soapNote.id,
      versionNumber: 1,
      snapshotJson: JSON.stringify({
        chiefComplaint: soapNote.chiefComplaint,
        status: soapNote.status,
        timestamp: new Date().toISOString(),
      }),
      amendedBy: testEmployeeId,
      amendmentReason: 'Initial documentation',
      changeSummary: 'Initial SOAP note creation',
    },
  });

  console.log('Created Version ID:', version.id);
  console.log('Version Number:', version.versionNumber);
  console.log('Amended By:', version.amendedBy);

  // Verify the version links correctly
  const soapNoteWithVersions = await prisma.soapNote.findUnique({
    where: { id: soapNote.id },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  });

  if (!soapNoteWithVersions || soapNoteWithVersions.versions.length !== 1) {
    throw new Error(`Expected 1 version, got ${soapNoteWithVersions?.versions.length || 0}`);
  }

  console.log('✓ TEST 3 PASSED: Version history created and linked correctly');
  return version;
}

/**
 * TEST 4: Update assessment items and plan items
 * Verifies that items can be updated (delete and recreate)
 */
async function testUpdateItems() {
  console.log('\n=== TEST 4: Update Assessment and Plan Items ===\n');

  const soapNote = await prisma.soapNote.findFirst({
    where: { encounterId: testEncounterId },
  });

  if (!soapNote) {
    throw new Error('SOAP Note not found');
  }

  // Delete existing items and create new ones
  await prisma.$transaction(async (tx) => {
    await tx.soapNoteAssessmentItem.deleteMany({
      where: { soapNoteId: soapNote.id },
    });
    await tx.soapNotePlanItem.deleteMany({
      where: { soapNoteId: soapNote.id },
    });

    // Create updated items
    await tx.soapNoteAssessmentItem.createMany({
      data: [
        {
          soapNoteId: soapNote.id,
          diagnosis: 'Acute ST-elevation myocardial infarction',
          icdCode: 'I21.0',
          rank: 1,
          isPrimary: true,
          status: 'confirmed',
        },
        {
          soapNoteId: soapNote.id,
          diagnosis: 'Heart failure',
          icdCode: 'I50.9',
          rank: 2,
          status: 'considering',
        },
        {
          soapNoteId: soapNote.id,
          diagnosis: 'Atrial fibrillation',
          icdCode: 'I48',
          rank: 3,
          status: 'considering',
        },
      ],
    });

    await tx.soapNotePlanItem.createMany({
      data: [
        {
          soapNoteId: soapNote.id,
          category: 'procedure',
          description: 'Primary PCI',
          status: 'scheduled',
          priority: 'stat',
        },
        {
          soapNoteId: soapNote.id,
          category: 'medication',
          description: 'Heparin infusion, Clopidogrel 600mg loading',
          status: 'pending',
          priority: 'stat',
        },
      ],
    });
  });

  // Verify updates
  const updatedNote = await prisma.soapNote.findUnique({
    where: { id: soapNote.id },
    include: {
      assessmentItems: { orderBy: { rank: 'asc' } },
      planItems: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!updatedNote) {
    throw new Error('Updated SOAP Note not found');
  }

  console.log('Updated Assessment Items:', updatedNote.assessmentItems.length);
  console.log('Updated Plan Items:', updatedNote.planItems.length);

  if (updatedNote.assessmentItems.length !== 3) {
    throw new Error(`Expected 3 assessment items, got ${updatedNote.assessmentItems.length}`);
  }
  if (updatedNote.planItems.length !== 2) {
    throw new Error(`Expected 2 plan items, got ${updatedNote.planItems.length}`);
  }

  // Verify primary assessment is confirmed
  const primaryItem = updatedNote.assessmentItems.find(a => a.isPrimary);
  if (!primaryItem || primaryItem.status !== 'confirmed') {
    throw new Error('Primary assessment not correctly updated');
  }

  console.log('✓ TEST 4 PASSED: Items updated successfully');
}

/**
 * TEST 5: Verify cascade delete
 * Verifies that when a SOAP note is deleted, all related items are also deleted
 */
async function testCascadeDelete() {
  console.log('\n=== TEST 5: Verify Cascade Delete ===\n');

  const soapNote = await prisma.soapNote.findFirst({
    where: { encounterId: testEncounterId },
    include: {
      assessmentItems: true,
      planItems: true,
      versions: true,
    },
  });

  if (!soapNote) {
    throw new Error('SOAP Note not found');
  }

  const assessmentItemIds = soapNote.assessmentItems.map(a => a.id);
  const planItemIds = soapNote.planItems.map(p => p.id);
  const versionIds = soapNote.versions.map(v => v.id);

  console.log('Assessment Item IDs to delete:', assessmentItemIds);
  console.log('Plan Item IDs to delete:', planItemIds);
  console.log('Version IDs to delete:', versionIds);

  // Delete the SOAP note
  await prisma.soapNote.delete({
    where: { id: soapNote.id },
  });

  // Verify all related items are deleted
  const remainingAssessmentItems = await prisma.soapNoteAssessmentItem.findMany({
    where: { id: { in: assessmentItemIds } },
  });
  const remainingPlanItems = await prisma.soapNotePlanItem.findMany({
    where: { id: { in: planItemIds } },
  });
  const remainingVersions = await prisma.soapNoteVersion.findMany({
    where: { id: { in: versionIds } },
  });

  if (remainingAssessmentItems.length > 0) {
    throw new Error('Assessment items not cascade deleted');
  }
  if (remainingPlanItems.length > 0) {
    throw new Error('Plan items not cascade deleted');
  }
  if (remainingVersions.length > 0) {
    throw new Error('Versions not cascade deleted');
  }

  console.log('✓ TEST 5 PASSED: Cascade delete verified');

  // Cleanup
  await cleanup();
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   PROMPT 10: SOAP Note Schema Normalization Verification       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    await testCreateSoapNoteWithItems();
    await testReadSoapNoteWithRelations();
    await testCreateVersionHistory();
    await testUpdateItems();
    await testCascadeDelete();

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              ALL TESTS PASSED SUCCESSFULLY ✓                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    await cleanup();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
runAllTests();

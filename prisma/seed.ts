import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create sample patients
  const patients = await Promise.all([
    prisma.patient.upsert({
      where: { mrn: 'MRN-2024-001' },
      update: {},
      create: {
        mrn: 'MRN-2024-001',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1985-06-15'),
        gender: 'male',
        phone: '+1 555-0123',
        email: 'john.doe@email.com',
        bloodType: 'O+',
        allergies: JSON.stringify(['Penicillin', 'Peanuts']),
        chronicConditions: JSON.stringify(['Hypertension', 'Type 2 Diabetes']),
      },
    }),
    prisma.patient.upsert({
      where: { mrn: 'MRN-2024-002' },
      update: {},
      create: {
        mrn: 'MRN-2024-002',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: new Date('1990-03-22'),
        gender: 'female',
        phone: '+1 555-0456',
        email: 'jane.smith@email.com',
        bloodType: 'A+',
        allergies: JSON.stringify([]),
        chronicConditions: JSON.stringify(['Asthma']),
      },
    }),
    prisma.patient.upsert({
      where: { mrn: 'MRN-2024-003' },
      update: {},
      create: {
        mrn: 'MRN-2024-003',
        firstName: 'Michael',
        lastName: 'Johnson',
        dateOfBirth: new Date('1978-11-08'),
        gender: 'male',
        phone: '+1 555-0789',
        email: 'michael.j@email.com',
        bloodType: 'B-',
        allergies: JSON.stringify(['Sulfa drugs']),
        chronicConditions: JSON.stringify([]),
      },
    }),
    prisma.patient.upsert({
      where: { mrn: 'MRN-2024-004' },
      update: {},
      create: {
        mrn: 'MRN-2024-004',
        firstName: 'Sarah',
        lastName: 'Wilson',
        dateOfBirth: new Date('1995-08-30'),
        gender: 'female',
        phone: '+1 555-0321',
        email: 'sarah.w@email.com',
        bloodType: 'AB+',
        allergies: JSON.stringify(['Latex']),
        chronicConditions: JSON.stringify(['Hypothyroidism']),
      },
    }),
    prisma.patient.upsert({
      where: { mrn: 'MRN-2024-005' },
      update: {},
      create: {
        mrn: 'MRN-2024-005',
        firstName: 'Robert',
        lastName: 'Brown',
        dateOfBirth: new Date('1965-04-12'),
        gender: 'male',
        phone: '+1 555-0654',
        email: 'robert.b@email.com',
        bloodType: 'O-',
        allergies: JSON.stringify(['Aspirin', 'Shellfish']),
        chronicConditions: JSON.stringify(['Coronary Artery Disease', 'Hyperlipidemia']),
      },
    }),
  ]);

  console.log(`Created ${patients.length} patients`);

  // Create consultations
  const existingConsultations = await prisma.consultation.count();
  
  if (existingConsultations === 0) {
    await prisma.consultation.createMany({
      data: [
        {
          patientId: patients[0].id,
          consultationDate: new Date(),
          consultationType: 'outpatient',
          chiefComplaint: 'Routine follow-up for diabetes management',
          subjectiveNotes: 'Patient reports good compliance with medications. Blood sugar levels have been stable. No episodes of hypoglycemia reported. Diet and exercise compliance is moderate.',
          objectiveNotes: 'VITAL SIGNS:\n- Blood Pressure: 128/78 mmHg\n- Heart Rate: 72 bpm, regular\n- Respiratory Rate: 16 breaths/min\n- Temperature: 36.8°C (oral)\n- Oxygen Saturation: 98% on room air\n- Weight: 82 kg\n\nPHYSICAL EXAMINATION:\n- General: Alert, oriented, in no acute distress\n- HEENT: Normocephalic, PERRLA, mucous membranes moist\n- Cardiovascular: Regular rate and rhythm, no murmurs/gallops/rubs\n- Respiratory: Clear to auscultation bilaterally\n- Extremities: No edema',
          assessment: '1. Type 2 Diabetes Mellitus (E11.9) - Well controlled on current regimen\n2. Essential Hypertension (I10) - Blood pressure at goal\n3. Obesity (E66.9) - BMI 26.8',
          plan: '1. Continue current antihyperglycemic regimen (Metformin 500mg BID)\n2. Continue antihypertensive therapy (Lisinopril 10mg daily)\n3. Lifestyle modifications: DASH diet, regular exercise 150 min/week\n4. Repeat HbA1c, BMP, lipid panel in 3 months\n5. Annual eye exam recommended\n6. Follow-up in 3 months',
          status: 'completed',
          providerName: 'Dr. Sarah Johnson',
          department: 'Internal Medicine',
        },
        {
          patientId: patients[1].id,
          consultationDate: new Date(Date.now() - 86400000), // Yesterday
          consultationType: 'outpatient',
          chiefComplaint: 'Recurrent cough and wheezing for 1 week',
          subjectiveNotes: 'Patient presents with worsening cough and wheezing for the past week. Reports increased shortness of breath with exertion. Using rescue inhaler 4-5 times daily. No fever, chest pain, or hemoptysis. History of asthma since childhood.',
          objectiveNotes: 'VITAL SIGNS:\n- Blood Pressure: 118/72 mmHg\n- Heart Rate: 88 bpm\n- Respiratory Rate: 20 breaths/min\n- Temperature: 37.0°C\n- Oxygen Saturation: 96% on room air\n\nPHYSICAL EXAMINATION:\n- General: Mild respiratory distress\n- Respiratory: Bilateral expiratory wheezes, prolonged expiratory phase\n- Cardiovascular: Regular rate and rhythm',
          assessment: '1. Acute Asthma Exacerbation (J45.901) - Moderate severity\n2. Allergic Rhinitis (J30.9) - Contributing factor',
          plan: '1. Prednisone 40mg daily x 5 days for acute exacerbation\n2. Continue Albuterol inhaler PRN\n3. Start inhaled corticosteroid (Fluticasone 110mcg BID)\n4. Peak flow monitoring at home\n5. Follow-up in 1 week\n6. Return sooner if symptoms worsen',
          status: 'in-progress',
          providerName: 'Dr. Michael Chen',
          department: 'Pulmonology',
        },
        {
          patientId: patients[2].id,
          consultationDate: new Date(Date.now() - 172800000), // 2 days ago
          consultationType: 'outpatient',
          chiefComplaint: 'Annual physical examination',
          subjectiveNotes: 'Patient presents for routine annual physical examination. No current complaints. Reports feeling well overall. Exercises regularly 3-4 times per week. No tobacco use, social alcohol consumption.',
          objectiveNotes: 'VITAL SIGNS:\n- Blood Pressure: 122/76 mmHg\n- Heart Rate: 64 bpm\n- Respiratory Rate: 14 breaths/min\n- Temperature: 36.6°C\n- Oxygen Saturation: 99%\n- Weight: 78 kg\n- Height: 180 cm\n- BMI: 24.1\n\nPHYSICAL EXAMINATION:\n- General: Well-developed, well-nourished, in no acute distress\n- Complete physical exam: Within normal limits',
          assessment: '1. Adult health examination (Z00.00)\n2. No acute findings',
          plan: '1. Routine health maintenance ordered:\n   - Complete blood count\n   - Comprehensive metabolic panel\n   - Lipid panel\n   - TSH\n2. Age-appropriate cancer screening discussed\n3. Continue current healthy lifestyle\n4. Follow-up in 1 year or PRN',
          status: 'completed',
          providerName: 'Dr. Sarah Johnson',
          department: 'Family Medicine',
        },
      ],
    });
    console.log('Created 3 consultations');
  } else {
    console.log(`Consultations already exist: ${existingConsultations}`);
  }

  // Create vital signs for first patient
  const existingVitals = await prisma.vitalSigns.count();
  if (existingVitals === 0) {
    await prisma.vitalSigns.create({
      data: {
        patientId: patients[0].id,
        temperature: 36.8,
        bloodPressureSystolic: 128,
        bloodPressureDiastolic: 78,
        heartRate: 72,
        respiratoryRate: 16,
        oxygenSaturation: 98,
        weight: 82,
        height: 175,
        bmi: 26.8,
      },
    });
    console.log('Created vital signs record');
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

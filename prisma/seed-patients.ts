// Seed script to populate database with sample patients
// Run with: bunx tsx prisma/seed-patients.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const samplePatients = [
  {
    mrn: "MRN-001",
    firstName: "Abebe",
    lastName: "Kebede",
    middleName: "Tadesse",
    dateOfBirth: new Date("1985-03-15"),
    gender: "male",
    bloodType: "O+",
    phone: "+251911123456",
    email: "abebe.kebede@email.com",
    address: "Bole Sub-city, Woreda 03",
    city: "Addis Ababa",
    state: "Addis Ababa",
    country: "Ethiopia",
    emergencyContactName: "Tigist Kebede",
    emergencyContactPhone: "+251922123456",
    emergencyContactRelation: "Spouse",
    allergies: JSON.stringify(["Penicillin", "Sulfa drugs"]),
    chronicConditions: JSON.stringify(["Hypertension", "Type 2 Diabetes Mellitus"]),
  },
  {
    mrn: "MRN-002",
    firstName: "Tigist",
    lastName: "Haile",
    middleName: "Mekonnen",
    dateOfBirth: new Date("1990-07-22"),
    gender: "female",
    bloodType: "A+",
    phone: "+251933123456",
    email: "tigist.haile@email.com",
    address: "Mercato Area",
    city: "Addis Ababa",
    state: "Addis Ababa",
    country: "Ethiopia",
    emergencyContactName: "Haile Mekonnen",
    emergencyContactPhone: "+251944123456",
    emergencyContactRelation: "Father",
    allergies: JSON.stringify([]),
    chronicConditions: JSON.stringify([]),
  },
  {
    mrn: "MRN-003",
    firstName: "Dawit",
    lastName: "Amare",
    dateOfBirth: new Date("1978-11-08"),
    gender: "male",
    bloodType: "B+",
    phone: "+251955123456",
    email: "dawit.amare@email.com",
    address: "Piazza Area",
    city: "Gondar",
    state: "Amhara",
    country: "Ethiopia",
    emergencyContactName: "Sara Amare",
    emergencyContactPhone: "+251966123456",
    emergencyContactRelation: "Sister",
    allergies: JSON.stringify(["Aspirin"]),
    chronicConditions: JSON.stringify(["Asthma"]),
  },
  {
    mrn: "MRN-004",
    firstName: "Meron",
    lastName: "Tesfaye",
    middleName: "Alemu",
    dateOfBirth: new Date("1995-02-28"),
    gender: "female",
    bloodType: "AB+",
    phone: "+251977123456",
    email: "meron.tesfaye@email.com",
    address: "Mekelle University Campus",
    city: "Mekelle",
    state: "Tigray",
    country: "Ethiopia",
    emergencyContactName: "Tesfaye Alemu",
    emergencyContactPhone: "+251988123456",
    emergencyContactRelation: "Father",
    allergies: JSON.stringify([]),
    chronicConditions: JSON.stringify([]),
  },
  {
    mrn: "MRN-005",
    firstName: "Yohannes",
    lastName: "Girmay",
    dateOfBirth: new Date("1965-09-10"),
    gender: "male",
    bloodType: "O-",
    phone: "+251999123456",
    email: "yohannes.girmay@email.com",
    address: "Main Street",
    city: "Bahir Dar",
    state: "Amhara",
    country: "Ethiopia",
    emergencyContactName: "Almaz Girmay",
    emergencyContactPhone: "+251900123456",
    emergencyContactRelation: "Wife",
    allergies: JSON.stringify(["Ibuprofen", "Codeine"]),
    chronicConditions: JSON.stringify(["Chronic Kidney Disease", "Hypertension", "Gout"]),
  },
  {
    mrn: "MRN-006",
    firstName: "Selam",
    lastName: "Tadesse",
    middleName: "Bekele",
    dateOfBirth: new Date("1988-04-05"),
    gender: "female",
    bloodType: "A-",
    phone: "+251912345678",
    email: "selam.tadesse@email.com",
    address: "Kazanchis Area",
    city: "Addis Ababa",
    state: "Addis Ababa",
    country: "Ethiopia",
    emergencyContactName: "Bekele Tadesse",
    emergencyContactPhone: "+251923456789",
    emergencyContactRelation: "Brother",
    allergies: JSON.stringify(["Latex"]),
    chronicConditions: JSON.stringify(["Hypothyroidism"]),
  },
  {
    mrn: "MRN-007",
    firstName: "Berhanu",
    lastName: "Alemayehu",
    dateOfBirth: new Date("1972-12-20"),
    gender: "male",
    bloodType: "B-",
    phone: "+251934567890",
    email: "berhanu.alemayehu@email.com",
    address: "Piassa Area",
    city: "Dire Dawa",
    state: "Dire Dawa",
    country: "Ethiopia",
    emergencyContactName: "Alemnesh Alemayehu",
    emergencyContactPhone: "+251945678901",
    emergencyContactRelation: "Wife",
    allergies: JSON.stringify([]),
    chronicConditions: JSON.stringify(["Congestive Heart Failure", "Atrial Fibrillation"]),
  },
  {
    mrn: "MRN-008",
    firstName: "Hiwot",
    lastName: "Mengistu",
    middleName: "Girma",
    dateOfBirth: new Date("2000-06-15"),
    gender: "female",
    bloodType: "O+",
    phone: "+251956789012",
    email: "hiwot.mengistu@email.com",
    address: "University Campus",
    city: "Jimma",
    state: "Oromia",
    country: "Ethiopia",
    emergencyContactName: "Mengistu Girma",
    emergencyContactPhone: "+251967890123",
    emergencyContactRelation: "Father",
    allergies: JSON.stringify(["Peanuts", "Shellfish"]),
    chronicConditions: JSON.stringify([]),
  },
  {
    mrn: "MRN-009",
    firstName: "Tewodros",
    lastName: "Assefa",
    dateOfBirth: new Date("1958-01-30"),
    gender: "male",
    bloodType: "AB-",
    phone: "+251978901234",
    email: "tewodros.assefa@email.com",
    address: "Old Airport Area",
    city: "Addis Ababa",
    state: "Addis Ababa",
    country: "Ethiopia",
    emergencyContactName: "Assefa Tewodros",
    emergencyContactPhone: "+251989012345",
    emergencyContactRelation: "Son",
    allergies: JSON.stringify(["Penicillin", "Contrast Dye"]),
    chronicConditions: JSON.stringify(["Prostate Cancer", "Diabetes Mellitus"]),
  },
  {
    mrn: "MRN-010",
    firstName: "Frehiwot",
    lastName: "Bezabih",
    middleName: "Haile",
    dateOfBirth: new Date("1992-08-12"),
    gender: "female",
    bloodType: "A+",
    phone: "+251990123456",
    email: "frehiwot.bezabih@email.com",
    address: "Megenagna Area",
    city: "Addis Ababa",
    state: "Addis Ababa",
    country: "Ethiopia",
    emergencyContactName: "Bezabih Haile",
    emergencyContactPhone: "+251901234567",
    emergencyContactRelation: "Mother",
    allergies: JSON.stringify([]),
    chronicConditions: JSON.stringify(["Rheumatoid Arthritis"]),
  },
];

async function main() {
  console.log("Starting to seed patient data...");

  // Check if patients already exist
  const existingPatients = await prisma.patient.count();
  if (existingPatients > 0) {
    console.log(`Database already has ${existingPatients} patients. Skipping seed.`);
    return;
  }

  // Create patients
  for (const patientData of samplePatients) {
    const patient = await prisma.patient.create({
      data: patientData,
    });
    console.log(`Created patient: ${patient.firstName} ${patient.lastName} (${patient.mrn})`);
  }

  console.log(`\nSuccessfully seeded ${samplePatients.length} patients!`);
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

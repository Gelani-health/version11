import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const knowledge = await prisma.healthcareKnowledge.count();
  const drugInteractions = await prisma.drugInteractionKnowledge.count();
  const symptomMappings = await prisma.symptomConditionMapping.count();
  const clinicalGuidelines = await prisma.clinicalGuidelineKnowledge.count();
  
  console.log('Knowledge Base Status:');
  console.log(`  HealthcareKnowledge: ${knowledge} entries`);
  console.log(`  DrugInteractionKnowledge: ${drugInteractions} entries`);
  console.log(`  SymptomConditionMapping: ${symptomMappings} entries`);
  console.log(`  ClinicalGuidelineKnowledge: ${clinicalGuidelines} entries`);
  
  // Check if any have embeddings/vector data
  const sample = await prisma.healthcareKnowledge.findFirst();
  if (sample) {
    console.log('\nSample entry fields:', Object.keys(sample));
    console.log('Has embedding field:', 'embedding' in sample);
    console.log('Has vector field:', 'vector' in sample);
  }
}

main().finally(() => prisma.$disconnect());

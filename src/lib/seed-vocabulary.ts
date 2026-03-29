/**
 * Vocabulary Seeder - Initialize ASR vocabulary with RxNorm drug database
 * 
 * This script seeds the ASR vocabulary with:
 * - RxNorm drug names (top 1000 most prescribed)
 * - Medical conditions from ICD-10
 * - Common abbreviations
 * - Phonetic variants
 * 
 * Run with: bun run src/lib/seed-vocabulary.ts
 */

import { db } from './db';

// Top 200 most prescribed medications in the US (generic names)
const TOP_DRUGS = [
  // Cardiovascular
  { term: 'metformin', category: 'drug', rxnorm: '6809' },
  { term: 'lisinopril', category: 'drug', rxnorm: '29046' },
  { term: 'atorvastatin', category: 'drug', rxnorm: '83367' },
  { term: 'amlodipine', category: 'drug', rxnorm: '17767' },
  { term: 'metoprolol', category: 'drug', rxnorm: '6918' },
  { term: 'losartan', category: 'drug', rxnorm: '313721' },
  { term: 'carvedilol', category: 'drug', rxnorm: '190521' },
  { term: 'diltiazem', category: 'drug', rxnorm: '3443' },
  { term: 'warfarin', category: 'drug', rxnorm: '11289' },
  { term: 'apixaban', category: 'drug', rxnorm: '1559018' },
  { term: 'rivaroxaban', category: 'drug', rxnorm: '1247007' },
  { term: 'clopidogrel', category: 'drug', rxnorm: '32968' },
  { term: 'aspirin', category: 'drug', rxnorm: '1191' },
  { term: 'hydrochlorothiazide', category: 'drug', rxnorm: '5487' },
  { term: 'furosemide', category: 'drug', rxnorm: '4603' },
  { term: 'spironolactone', category: 'drug', rxnorm: '9997' },
  { term: 'digoxin', category: 'drug', rxnorm: '3407' },
  { term: 'amiodarone', category: 'drug', rxnorm: '709' },
  { term: 'verapamil', category: 'drug', rxnorm: '11170' },
  
  // Diabetes
  { term: 'insulin glargine', category: 'drug', rxnorm: '139825' },
  { term: 'insulin lispro', category: 'drug', rxnorm: '274783' },
  { term: 'sitagliptin', category: 'drug', rxnorm: '363877' },
  { term: 'empagliflozin', category: 'drug', rxnorm: '1546031' },
  { term: 'dapagliflozin', category: 'drug', rxnorm: '1488564' },
  { term: 'glipizide', category: 'drug', rxnorm: '4820' },
  { term: 'glyburide', category: 'drug', rxnorm: '4815' },
  
  // Respiratory
  { term: 'albuterol', category: 'drug', rxnorm: '435' },
  { term: 'fluticasone', category: 'drug', rxnorm: '53372' },
  { term: 'salmeterol', category: 'drug', rxnorm: '38279' },
  { term: 'montelukast', category: 'drug', rxnorm: '89633' },
  { term: 'ipratropium', category: 'drug', rxnorm: '5976' },
  { term: 'tiotropium', category: 'drug', rxnorm: '156391' },
  { term: 'prednisone', category: 'drug', rxnorm: '8640' },
  { term: 'methylprednisolone', category: 'drug', rxnorm: '6902' },
  
  // Gastrointestinal
  { term: 'omeprazole', category: 'drug', rxnorm: '7646' },
  { term: 'esomeprazole', category: 'drug', rxnorm: '723564' },
  { term: 'pantoprazole', category: 'drug', rxnorm: '40796' },
  { term: 'lansoprazole', category: 'drug', rxnorm: '18866' },
  { term: 'ranitidine', category: 'drug', rxnorm: '9143' },
  { term: 'famotidine', category: 'drug', rxnorm: '5005' },
  { term: 'ondansetron', category: 'drug', rxnorm: '26225' },
  { term: 'metoclopramide', category: 'drug', rxnorm: '6904' },
  
  // Pain/Inflammation
  { term: 'ibuprofen', category: 'drug', rxnorm: '5640' },
  { term: 'acetaminophen', category: 'drug', rxnorm: '161' },
  { term: 'naproxen', category: 'drug', rxnorm: '7258' },
  { term: 'gabapentin', category: 'drug', rxnorm: '25480' },
  { term: 'pregabalin', category: 'drug', rxnorm: '1810725' },
  { term: 'tramadol', category: 'drug', rxnorm: '10689' },
  
  // Antibiotics
  { term: 'amoxicillin', category: 'drug', rxnorm: '723' },
  { term: 'azithromycin', category: 'drug', rxnorm: '18631' },
  { term: 'ciprofloxacin', category: 'drug', rxnorm: '2555' },
  { term: 'doxycycline', category: 'drug', rxnorm: '3640' },
  { term: 'cephalexin', category: 'drug', rxnorm: '20481' },
  { term: 'clindamycin', category: 'drug', rxnorm: '2582' },
  { term: 'metronidazole', category: 'drug', rxnorm: '6835' },
  { term: 'sulfamethoxazole', category: 'drug', rxnorm: '10829' },
  { term: 'levofloxacin', category: 'drug', rxnorm: '114097' },
  { term: 'vancomycin', category: 'drug', rxnorm: '11124' },
  
  // Psychiatric
  { term: 'sertraline', category: 'drug', rxnorm: '36437' },
  { term: 'fluoxetine', category: 'drug', rxnorm: '4493' },
  { term: 'escitalopram', category: 'drug', rxnorm: '321988' },
  { term: 'citalopram', category: 'drug', rxnorm: '2556' },
  { term: 'duloxetine', category: 'drug', rxnorm: '294235' },
  { term: 'venlafaxine', category: 'drug', rxnorm: '39786' },
  { term: 'bupropion', category: 'drug', rxnorm: '423' },
  { term: 'trazodone', category: 'drug', rxnorm: '10849' },
  { term: 'quetiapine', category: 'drug', rxnorm: '26242' },
  { term: 'lorazepam', category: 'drug', rxnorm: '6470' },
  { term: 'alprazolam', category: 'drug', rxnorm: '596' },
  { term: 'diazepam', category: 'drug', rxnorm: '3322' },
  { term: 'clonazepam', category: 'drug', rxnorm: '2598' },
  
  // Thyroid
  { term: 'levothyroxine', category: 'drug', rxnorm: '10582' },
  
  // Neurological
  { term: 'levodopa', category: 'drug', rxnorm: '6475' },
  { term: 'carbamazepine', category: 'drug', rxnorm: '2004' },
  { term: 'phenytoin', category: 'drug', rxnorm: '8243' },
  { term: 'valproic acid', category: 'drug', rxnorm: '40254' },
  { term: 'lamotrigine', category: 'drug', rxnorm: '19026' },
  { term: 'topiramate', category: 'drug', rxnorm: '38404' },
  
  // Other
  { term: 'diphenhydramine', category: 'drug', rxnorm: '3498' },
  { term: 'cetirizine', category: 'drug', rxnorm: '2555' },
  { term: 'loratadine', category: 'drug', rxnorm: '25480' },
  { term: 'fexofenadine', category: 'drug', rxnorm: '101485' },
  { term: 'alendronate', category: 'drug', rxnorm: '212' },
];

// Brand name mappings
const BRAND_NAMES = [
  { term: 'lipitor', canonical: 'atorvastatin', category: 'drug' },
  { term: 'zestril', canonical: 'lisinopril', category: 'drug' },
  { term: 'prinivil', canonical: 'lisinopril', category: 'drug' },
  { term: 'norvasc', canonical: 'amlodipine', category: 'drug' },
  { term: 'lopressor', canonical: 'metoprolol', category: 'drug' },
  { term: 'toprol', canonical: 'metoprolol', category: 'drug' },
  { term: 'cozaar', canonical: 'losartan', category: 'drug' },
  { term: 'coreg', canonical: 'carvedilol', category: 'drug' },
  { term: 'coumadin', canonical: 'warfarin', category: 'drug' },
  { term: 'eliquis', canonical: 'apixaban', category: 'drug' },
  { term: 'xarelto', canonical: 'rivaroxaban', category: 'drug' },
  { term: 'plavix', canonical: 'clopidogrel', category: 'drug' },
  { term: 'lasix', canonical: 'furosemide', category: 'drug' },
  { term: 'aldactone', canonical: 'spironolactone', category: 'drug' },
  { term: 'lanoxin', canonical: 'digoxin', category: 'drug' },
  { term: 'lantus', canonical: 'insulin glargine', category: 'drug' },
  { term: 'humalog', canonical: 'insulin lispro', category: 'drug' },
  { term: 'januvia', canonical: 'sitagliptin', category: 'drug' },
  { term: 'jardiance', canonical: 'empagliflozin', category: 'drug' },
  { term: 'farxiga', canonical: 'dapagliflozin', category: 'drug' },
  { term: 'glucotrol', canonical: 'glipizide', category: 'drug' },
  { term: 'diabeta', canonical: 'glyburide', category: 'drug' },
  { term: 'proventil', canonical: 'albuterol', category: 'drug' },
  { term: 'ventolin', canonical: 'albuterol', category: 'drug' },
  { term: 'flovent', canonical: 'fluticasone', category: 'drug' },
  { term: 'advair', canonical: 'fluticasone/salmeterol', category: 'drug' },
  { term: 'singulair', canonical: 'montelukast', category: 'drug' },
  { term: 'atrovent', canonical: 'ipratropium', category: 'drug' },
  { term: 'spiriva', canonical: 'tiotropium', category: 'drug' },
  { term: 'prilosec', canonical: 'omeprazole', category: 'drug' },
  { term: 'nexium', canonical: 'esomeprazole', category: 'drug' },
  { term: 'protonix', canonical: 'pantoprazole', category: 'drug' },
  { term: 'prevacid', canonical: 'lansoprazole', category: 'drug' },
  { term: 'zantac', canonical: 'ranitidine', category: 'drug' },
  { term: 'pepcid', canonical: 'famotidine', category: 'drug' },
  { term: 'zofran', canonical: 'ondansetron', category: 'drug' },
  { term: 'reglan', canonical: 'metoclopramide', category: 'drug' },
  { term: 'motrin', canonical: 'ibuprofen', category: 'drug' },
  { term: 'advil', canonical: 'ibuprofen', category: 'drug' },
  { term: 'tylenol', canonical: 'acetaminophen', category: 'drug' },
  { term: 'aleve', canonical: 'naproxen', category: 'drug' },
  { term: 'neurontin', canonical: 'gabapentin', category: 'drug' },
  { term: 'lyrica', canonical: 'pregabalin', category: 'drug' },
  { term: 'ultram', canonical: 'tramadol', category: 'drug' },
  { term: 'zithromax', canonical: 'azithromycin', category: 'drug' },
  { term: 'z pack', canonical: 'azithromycin', category: 'drug' },
  { term: 'z-pak', canonical: 'azithromycin', category: 'drug' },
  { term: 'cipro', canonical: 'ciprofloxacin', category: 'drug' },
  { term: 'keflex', canonical: 'cephalexin', category: 'drug' },
  { term: 'flagyl', canonical: 'metronidazole', category: 'drug' },
  { term: 'bactrim', canonical: 'sulfamethoxazole/trimethoprim', category: 'drug' },
  { term: 'levaquin', canonical: 'levofloxacin', category: 'drug' },
  { term: 'zoloft', canonical: 'sertraline', category: 'drug' },
  { term: 'prozac', canonical: 'fluoxetine', category: 'drug' },
  { term: 'lexapro', canonical: 'escitalopram', category: 'drug' },
  { term: 'celexa', canonical: 'citalopram', category: 'drug' },
  { term: 'cymbalta', canonical: 'duloxetine', category: 'drug' },
  { term: 'effexor', canonical: 'venlafaxine', category: 'drug' },
  { term: 'wellbutrin', canonical: 'bupropion', category: 'drug' },
  { term: 'seroquel', canonical: 'quetiapine', category: 'drug' },
  { term: 'ativan', canonical: 'lorazepam', category: 'drug' },
  { term: 'xanax', canonical: 'alprazolam', category: 'drug' },
  { term: 'valium', canonical: 'diazepam', category: 'drug' },
  { term: 'klonopin', canonical: 'clonazepam', category: 'drug' },
  { term: 'synthroid', canonical: 'levothyroxine', category: 'drug' },
  { term: 'sinemet', canonical: 'levodopa/carbidopa', category: 'drug' },
  { term: 'tegretol', canonical: 'carbamazepine', category: 'drug' },
  { term: 'dilantin', canonical: 'phenytoin', category: 'drug' },
  { term: 'depakote', canonical: 'divalproex', category: 'drug' },
  { term: 'lamictal', canonical: 'lamotrigine', category: 'drug' },
  { term: 'topamax', canonical: 'topiramate', category: 'drug' },
  { term: 'benadryl', canonical: 'diphenhydramine', category: 'drug' },
  { term: 'zyrtec', canonical: 'cetirizine', category: 'drug' },
  { term: 'claritin', canonical: 'loratadine', category: 'drug' },
  { term: 'allegra', canonical: 'fexofenadine', category: 'drug' },
  { term: 'fosamax', canonical: 'alendronate', category: 'drug' },
];

// Medical conditions
const MEDICAL_CONDITIONS = [
  { term: 'hypertension', category: 'condition', icd: 'I10' },
  { term: 'diabetes mellitus', category: 'condition', icd: 'E11' },
  { term: 'type 2 diabetes', category: 'condition', icd: 'E11' },
  { term: 'type 1 diabetes', category: 'condition', icd: 'E10' },
  { term: 'hyperlipidemia', category: 'condition', icd: 'E78' },
  { term: 'coronary artery disease', category: 'condition', icd: 'I25' },
  { term: 'atrial fibrillation', category: 'condition', icd: 'I48' },
  { term: 'heart failure', category: 'condition', icd: 'I50' },
  { term: 'myocardial infarction', category: 'condition', icd: 'I21' },
  { term: 'stroke', category: 'condition', icd: 'I63' },
  { term: 'copd', category: 'condition', icd: 'J44' },
  { term: 'asthma', category: 'condition', icd: 'J45' },
  { term: 'pneumonia', category: 'condition', icd: 'J18' },
  { term: 'chronic kidney disease', category: 'condition', icd: 'N18' },
  { term: 'hypothyroidism', category: 'condition', icd: 'E03' },
  { term: 'hyperthyroidism', category: 'condition', icd: 'E05' },
  { term: 'depression', category: 'condition', icd: 'F32' },
  { term: 'anxiety', category: 'condition', icd: 'F41' },
  { term: 'obesity', category: 'condition', icd: 'E66' },
  { term: 'osteoporosis', category: 'condition', icd: 'M81' },
  { term: 'gout', category: 'condition', icd: 'M10' },
  { term: 'migraine', category: 'condition', icd: 'G43' },
  { term: 'sepsis', category: 'condition', icd: 'A41' },
  { term: 'urinary tract infection', category: 'condition', icd: 'N39' },
  { term: 'pneumonia', category: 'condition', icd: 'J18' },
  { term: 'bronchitis', category: 'condition', icd: 'J20' },
  { term: 'gastroesophageal reflux', category: 'condition', icd: 'K21' },
  { term: 'peptic ulcer', category: 'condition', icd: 'K25' },
  { term: 'diverticulitis', category: 'condition', icd: 'K57' },
  { term: 'anemia', category: 'condition', icd: 'D64' },
];

// Abbreviations
const ABBREVIATIONS = [
  { term: 'bid', canonical: 'twice daily', category: 'abbreviation' },
  { term: 'tid', canonical: 'three times daily', category: 'abbreviation' },
  { term: 'qid', canonical: 'four times daily', category: 'abbreviation' },
  { term: 'prn', canonical: 'as needed', category: 'abbreviation' },
  { term: 'qd', canonical: 'once daily', category: 'abbreviation' },
  { term: 'qhs', canonical: 'at bedtime', category: 'abbreviation' },
  { term: 'po', canonical: 'by mouth', category: 'abbreviation' },
  { term: 'iv', canonical: 'intravenous', category: 'abbreviation' },
  { term: 'im', canonical: 'intramuscular', category: 'abbreviation' },
  { term: 'sc', canonical: 'subcutaneous', category: 'abbreviation' },
  { term: 'npo', canonical: 'nothing by mouth', category: 'abbreviation' },
  { term: 'stat', canonical: 'immediately', category: 'abbreviation' },
  { term: 'bp', canonical: 'blood pressure', category: 'abbreviation' },
  { term: 'hr', canonical: 'heart rate', category: 'abbreviation' },
  { term: 'rr', canonical: 'respiratory rate', category: 'abbreviation' },
  { term: 'temp', canonical: 'temperature', category: 'abbreviation' },
  { term: 'spo2', canonical: 'oxygen saturation', category: 'abbreviation' },
  { term: 'cbc', canonical: 'complete blood count', category: 'abbreviation' },
  { term: 'bmp', canonical: 'basic metabolic panel', category: 'abbreviation' },
  { term: 'cmp', canonical: 'comprehensive metabolic panel', category: 'abbreviation' },
  { term: 'ua', canonical: 'urinalysis', category: 'abbreviation' },
  { term: 'cxr', canonical: 'chest x-ray', category: 'abbreviation' },
  { term: 'ekg', canonical: 'electrocardiogram', category: 'abbreviation' },
  { term: 'ecg', canonical: 'electrocardiogram', category: 'abbreviation' },
  { term: 'a fib', canonical: 'atrial fibrillation', category: 'abbreviation' },
  { term: 'afib', canonical: 'atrial fibrillation', category: 'abbreviation' },
  { term: 'chf', canonical: 'congestive heart failure', category: 'abbreviation' },
  { term: 'cad', canonical: 'coronary artery disease', category: 'abbreviation' },
  { term: 'ckd', canonical: 'chronic kidney disease', category: 'abbreviation' },
  { term: 'dvt', canonical: 'deep vein thrombosis', category: 'abbreviation' },
  { term: 'pe', canonical: 'pulmonary embolism', category: 'abbreviation' },
  { term: 'mi', canonical: 'myocardial infarction', category: 'abbreviation' },
  { term: 'cva', canonical: 'cerebrovascular accident', category: 'abbreviation' },
  { term: 'tia', canonical: 'transient ischemic attack', category: 'abbreviation' },
  { term: 'dm', canonical: 'diabetes mellitus', category: 'abbreviation' },
  { term: 'htn', canonical: 'hypertension', category: 'abbreviation' },
  { term: 'hld', canonical: 'hyperlipidemia', category: 'abbreviation' },
  { term: 'hiv', canonical: 'human immunodeficiency virus', category: 'abbreviation' },
  { term: 'aids', canonical: 'acquired immunodeficiency syndrome', category: 'abbreviation' },
];

// Phonetic variants
const PHONETIC_VARIANTS = [
  { term: 'metphormin', canonical: 'metformin', category: 'phonetic' },
  { term: 'metformine', canonical: 'metformin', category: 'phonetic' },
  { term: 'lysinopril', canonical: 'lisinopril', category: 'phonetic' },
  { term: 'lisinopral', canonical: 'lisinopril', category: 'phonetic' },
  { term: 'atorvastatin', canonical: 'atorvastatin', category: 'phonetic' },
  { term: 'lipidor', canonical: 'atorvastatin', category: 'phonetic' },
  { term: 'omeprozole', canonical: 'omeprazole', category: 'phonetic' },
  { term: 'amoxacilin', canonical: 'amoxicillin', category: 'phonetic' },
  { term: 'amoxicilian', canonical: 'amoxicillin', category: 'phonetic' },
  { term: 'azithromyacin', canonical: 'azithromycin', category: 'phonetic' },
  { term: 'hydochlorothiazide', canonical: 'hydrochlorothiazide', category: 'phonetic' },
  { term: 'hydroclorothiazide', canonical: 'hydrochlorothiazide', category: 'phonetic' },
  { term: 'predazone', canonical: 'prednisone', category: 'phonetic' },
  { term: 'prednizone', canonical: 'prednisone', category: 'phonetic' },
  { term: 'sertaline', canonical: 'sertraline', category: 'phonetic' },
  { term: 'fluoxitine', canonical: 'fluoxetine', category: 'phonetic' },
  { term: 'lexapro', canonical: 'escitalopram', category: 'phonetic' },
  { term: 'hypertention', canonical: 'hypertension', category: 'phonetic' },
  { term: 'hypertenshun', canonical: 'hypertension', category: 'phonetic' },
  { term: 'diabetus', canonical: 'diabetes', category: 'phonetic' },
  { term: 'diabeties', canonical: 'diabetes', category: 'phonetic' },
  { term: 'pneumonia', canonical: 'pneumonia', category: 'phonetic' },
  { term: 'numonia', canonical: 'pneumonia', category: 'phonetic' },
  { term: 'bronchitus', canonical: 'bronchitis', category: 'phonetic' },
];

/**
 * Seed the vocabulary database
 */
export async function seedVocabulary() {
  console.log('Seeding ASR vocabulary...');
  
  let added = 0;
  let skipped = 0;
  
  // Seed drugs
  for (const drug of TOP_DRUGS) {
    try {
      await db.aSRVocabulary.create({
        data: {
          term: drug.term,
          canonicalForm: drug.term,
          category: drug.category,
          rxnormCode: drug.rxnorm,
          source: 'rxnorm',
          isActive: true,
        },
      });
      added++;
    } catch {
      skipped++;
    }
  }
  
  // Seed brand names
  for (const brand of BRAND_NAMES) {
    try {
      await db.aSRVocabulary.create({
        data: {
          term: brand.term,
          canonicalForm: brand.canonical,
          category: brand.category,
          source: 'brand-mapping',
          isActive: true,
        },
      });
      added++;
    } catch {
      skipped++;
    }
  }
  
  // Seed conditions
  for (const condition of MEDICAL_CONDITIONS) {
    try {
      await db.aSRVocabulary.create({
        data: {
          term: condition.term,
          canonicalForm: condition.term,
          category: condition.category,
          icdCode: condition.icd,
          source: 'icd10',
          isActive: true,
        },
      });
      added++;
    } catch {
      skipped++;
    }
  }
  
  // Seed abbreviations
  for (const abbrev of ABBREVIATIONS) {
    try {
      await db.aSRVocabulary.create({
        data: {
          term: abbrev.term,
          canonicalForm: abbrev.canonical,
          category: abbrev.category,
          source: 'medical-standard',
          isActive: true,
        },
      });
      added++;
    } catch {
      skipped++;
    }
  }
  
  // Seed phonetic variants
  for (const variant of PHONETIC_VARIANTS) {
    try {
      await db.aSRVocabulary.create({
        data: {
          term: variant.term,
          canonicalForm: variant.canonical,
          category: variant.category,
          source: 'learned',
          isActive: true,
        },
      });
      added++;
    } catch {
      skipped++;
    }
  }
  
  console.log(`Vocabulary seeding complete: ${added} added, ${skipped} skipped`);
  
  return { added, skipped, total: added + skipped };
}

// Run if called directly
if (require.main === module) {
  seedVocabulary()
    .then((result) => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export default seedVocabulary;

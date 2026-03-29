/**
 * Comprehensive Medical Terms Dictionary for ASR Post-Processing
 * Used by the Gelani Healthcare Clinical Decision Support System
 * 
 * Categories:
 * - Drug names (brand and generic)
 * - Medical conditions
 * - Medical abbreviations
 * - Anatomical terms
 * - Clinical procedures
 * - Laboratory tests
 * - Medical specialties
 */

// ============================================
// DRUG NAMES - Generic and Brand
// ============================================

export const DRUG_NAMES: Record<string, string> = {
  // Cardiovascular
  "metformin": "metformin",
  "glucophage": "metformin",
  "lisinopril": "lisinopril",
  "zestril": "lisinopril",
  "prinivil": "lisinopril",
  "atorvastatin": "atorvastatin",
  "lipitor": "atorvastatin",
  "amlodipine": "amlodipine",
  "norvasc": "amlodipine",
  "metoprolol": "metoprolol",
  "lopressor": "metoprolol",
  "toprol": "metoprolol XL",
  "losartan": "losartan",
  "cozaar": "losartan",
  "carvedilol": "carvedilol",
  "coreg": "carvedilol",
  "diltiazem": "diltiazem",
  "cardizem": "diltiazem",
  "verapamil": "verapamil",
  "calan": "verapamil",
  "warfarin": "warfarin",
  "coumadin": "warfarin",
  "apixaban": "apixaban",
  "eliquis": "apixaban",
  "rivaroxaban": "rivaroxaban",
  "xarelto": "rivaroxaban",
  "dabigatran": "dabigatran",
  "pradaxa": "dabigatran",
  "clopidogrel": "clopidogrel",
  "plavix": "clopidogrel",
  "aspirin": "aspirin",
  "asa": "aspirin",
  "hydrochlorothiazide": "hydrochlorothiazide",
  "hctz": "hydrochlorothiazide",
  "furosemide": "furosemide",
  "lasix": "furosemide",
  "spironolactone": "spironolactone",
  "aldactone": "spironolactone",
  "digoxin": "digoxin",
  "lanoxin": "digoxin",
  "amiodarone": "amiodarone",
  "cordarone": "amiodarone",
  
  // Diabetes
  "insulin glargine": "insulin glargine",
  "lantus": "insulin glargine",
  "insulin lispro": "insulin lispro",
  "humalog": "insulin lispro",
  "insulin aspart": "insulin aspart",
  "novolog": "insulin aspart",
  "sitagliptin": "sitagliptin",
  "januvia": "sitagliptin",
  "empagliflozin": "empagliflozin",
  "jardiance": "empagliflozin",
  "dapagliflozin": "dapagliflozin",
  "farxiga": "dapagliflozin",
  "glipizide": "glipizide",
  "glucotrol": "glipizide",
  "glyburide": "glyburide",
  "diabeta": "glyburide",
  
  // Respiratory
  "albuterol": "albuterol",
  "proventil": "albuterol",
  "ventolin": "albuterol",
  "fluticasone": "fluticasone",
  "flovent": "fluticasone",
  "advair": "fluticasone/salmeterol",
  "salmeterol": "salmeterol",
  "serevent": "salmeterol",
  "montelukast": "montelukast",
  "singulair": "montelukast",
  "ipratropium": "ipratropium",
  "atrovent": "ipratropium",
  "tiotropium": "tiotropium",
  "spiriva": "tiotropium",
  "prednisone": "prednisone",
  "methylprednisolone": "methylprednisolone",
  "medrol": "methylprednisolone",
  
  // Gastrointestinal
  "omeprazole": "omeprazole",
  "prilosec": "omeprazole",
  "esomeprazole": "esomeprazole",
  "nexium": "esomeprazole",
  "pantoprazole": "pantoprazole",
  "protonix": "pantoprazole",
  "lansoprazole": "lansoprazole",
  "prevacid": "lansoprazole",
  "ranitidine": "ranitidine",
  "zantac": "ranitidine",
  "famotidine": "famotidine",
  "pepcid": "famotidine",
  "metoclopramide": "metoclopramide",
  "reglan": "metoclopramide",
  "ondansetron": "ondansetron",
  "zofran": "ondansetron",
  
  // Pain/Inflammation
  "ibuprofen": "ibuprofen",
  "motrin": "ibuprofen",
  "advil": "ibuprofen",
  "acetaminophen": "acetaminophen",
  "tylenol": "acetaminophen",
  "paracetamol": "acetaminophen",
  "naproxen": "naproxen",
  "aleve": "naproxen",
  "naprosyn": "naproxen",
  "gabapentin": "gabapentin",
  "neurontin": "gabapentin",
  "pregabalin": "pregabalin",
  "lyrica": "pregabalin",
  "tramadol": "tramadol",
  "ultram": "tramadol",
  "morphine": "morphine",
  "oxycodone": "oxycodone",
  "oxycontin": "oxycodone ER",
  "hydrocodone": "hydrocodone",
  "norco": "hydrocodone/acetaminophen",
  
  // Antibiotics
  "amoxicillin": "amoxicillin",
  "augmentin": "amoxicillin/clavulanate",
  "azithromycin": "azithromycin",
  "zithromax": "azithromycin",
  "z pack": "azithromycin",
  "z-pak": "azithromycin",
  "ciprofloxacin": "ciprofloxacin",
  "cipro": "ciprofloxacin",
  "doxycycline": "doxycycline",
  "cephalexin": "cephalexin",
  "keflex": "cephalexin",
  "clindamycin": "clindamycin",
  "metronidazole": "metronidazole",
  "flagyl": "metronidazole",
  "sulfamethoxazole": "sulfamethoxazole/trimethoprim",
  "bactrim": "sulfamethoxazole/trimethoprim",
  "levofloxacin": "levofloxacin",
  "levaquin": "levofloxacin",
  "vancomycin": "vancomycin",
  
  // Psychiatric
  "sertraline": "sertraline",
  "zoloft": "sertraline",
  "fluoxetine": "fluoxetine",
  "prozac": "fluoxetine",
  "escitalopram": "escitalopram",
  "lexapro": "escitalopram",
  "citalopram": "citalopram",
  "celexa": "citalopram",
  "duloxetine": "duloxetine",
  "cymbalta": "duloxetine",
  "venlafaxine": "venlafaxine",
  "effexor": "venlafaxine",
  "bupropion": "bupropion",
  "wellbutrin": "bupropion",
  "trazodone": "trazodone",
  "quetiapine": "quetiapine",
  "seroquel": "quetiapine",
  "lorazepam": "lorazepam",
  "ativan": "lorazepam",
  "alprazolam": "alprazolam",
  "xanax": "alprazolam",
  "diazepam": "diazepam",
  "valium": "diazepam",
  "clonazepam": "clonazepam",
  "klonopin": "clonazepam",
  
  // Thyroid
  "levothyroxine": "levothyroxine",
  "synthroid": "levothyroxine",
  "levoxyl": "levothyroxine",
  
  // Neurological
  "levodopa": "levodopa/carbidopa",
  "sinemet": "levodopa/carbidopa",
  "carbamazepine": "carbamazepine",
  "tegretol": "carbamazepine",
  "phenytoin": "phenytoin",
  "dilantin": "phenytoin",
  "valproic acid": "valproic acid",
  "depakote": "divalproex",
  "lamotrigine": "lamotrigine",
  "lamictal": "lamotrigine",
  "topiramate": "topiramate",
  "topamax": "topiramate",
  
  // Other
  "diphenhydramine": "diphenhydramine",
  "benadryl": "diphenhydramine",
  "cetirizine": "cetirizine",
  "zyrtec": "cetirizine",
  "loratadine": "loratadine",
  "claritin": "loratadine",
  "fexofenadine": "fexofenadine",
  "allegra": "fexofenadine",
  "alendronate": "alendronate",
  "fosamax": "alendronate",
  "vitamin d": "vitamin D",
  "vitamin b12": "vitamin B12",
  "cyanocobalamin": "vitamin B12",
  "folic acid": "folic acid",
  "ferrous sulfate": "ferrous sulfate",
  "iron": "ferrous sulfate",
};

// ============================================
// MEDICAL CONDITIONS
// ============================================

export const MEDICAL_CONDITIONS: Record<string, string> = {
  // Cardiovascular
  "hypertension": "hypertension",
  "high blood pressure": "hypertension",
  "htn": "hypertension",
  "hyperlipidemia": "hyperlipidemia",
  "high cholesterol": "hyperlipidemia",
  "coronary artery disease": "coronary artery disease",
  "cad": "CAD",
  "myocardial infarction": "myocardial infarction",
  "heart attack": "myocardial infarction",
  "mi": "MI",
  "atrial fibrillation": "atrial fibrillation",
  "a fib": "atrial fibrillation",
  "afib": "atrial fibrillation",
  "congestive heart failure": "congestive heart failure",
  "chf": "CHF",
  "heart failure": "heart failure",
  "deep vein thrombosis": "deep vein thrombosis",
  "dvt": "DVT",
  "pulmonary embolism": "pulmonary embolism",
  "pe": "PE",
  "peripheral vascular disease": "peripheral vascular disease",
  "pvd": "PVD",
  "cardiomyopathy": "cardiomyopathy",
  "endocarditis": "endocarditis",
  "pericarditis": "pericarditis",
  
  // Respiratory
  "chronic obstructive pulmonary disease": "chronic obstructive pulmonary disease",
  "copd": "COPD",
  "asthma": "asthma",
  "pneumonia": "pneumonia",
  "bronchitis": "bronchitis",
  "pulmonary fibrosis": "pulmonary fibrosis",
  "sleep apnea": "sleep apnea",
  "osa": "obstructive sleep apnea",
  "tb": "tuberculosis",
  "tuberculosis": "tuberculosis",
  "pleural effusion": "pleural effusion",
  
  // Endocrine
  "diabetes mellitus": "diabetes mellitus",
  "diabetes": "diabetes mellitus",
  "dm": "diabetes mellitus",
  "type 2 diabetes": "type 2 diabetes mellitus",
  "type 1 diabetes": "type 1 diabetes mellitus",
  "hypothyroidism": "hypothyroidism",
  "hyperthyroidism": "hyperthyroidism",
  "thyroid disorder": "thyroid disorder",
  "hyperglycemia": "hyperglycemia",
  "hypoglycemia": "hypoglycemia",
  
  // Neurological
  "stroke": "stroke",
  "cerebrovascular accident": "cerebrovascular accident",
  "cva": "CVA",
  "seizure": "seizure",
  "epilepsy": "epilepsy",
  "migraine": "migraine",
  "parkinson disease": "Parkinson's disease",
  "parkinsons": "Parkinson's disease",
  "multiple sclerosis": "multiple sclerosis",
  "ms": "multiple sclerosis",
  "alzheimers": "Alzheimer's disease",
  "dementia": "dementia",
  "neuropathy": "neuropathy",
  "peripheral neuropathy": "peripheral neuropathy",
  
  // Psychiatric
  "depression": "depression",
  "major depressive disorder": "major depressive disorder",
  "mdd": "MDD",
  "anxiety": "anxiety",
  "generalized anxiety disorder": "generalized anxiety disorder",
  "gad": "GAD",
  "bipolar": "bipolar disorder",
  "schizophrenia": "schizophrenia",
  "ptsd": "PTSD",
  "post traumatic stress disorder": "PTSD",
  "adhd": "ADHD",
  
  // Gastrointestinal
  "gastroesophageal reflux disease": "gastroesophageal reflux disease",
  "gerd": "GERD",
  "acid reflux": "GERD",
  "peptic ulcer disease": "peptic ulcer disease",
  "pud": "PUD",
  "gastritis": "gastritis",
  "crohns disease": "Crohn's disease",
  "crohns": "Crohn's disease",
  "ulcerative colitis": "ulcerative colitis",
  "uc": "ulcerative colitis",
  "irritable bowel syndrome": "irritable bowel syndrome",
  "ibs": "IBS",
  "diverticulitis": "diverticulitis",
  "cirrhosis": "cirrhosis",
  "hepatitis": "hepatitis",
  "pancreatitis": "pancreatitis",
  
  // Renal
  "chronic kidney disease": "chronic kidney disease",
  "ckd": "CKD",
  "acute kidney injury": "acute kidney injury",
  "aki": "AKI",
  "end stage renal disease": "end-stage renal disease",
  "esrd": "ESRD",
  "nephrolithiasis": "nephrolithiasis",
  "kidney stones": "nephrolithiasis",
  
  // Infectious
  "sepsis": "sepsis",
  "uti": "UTI",
  "urinary tract infection": "urinary tract infection",
  "cellulitis": "cellulitis",
  "abscess": "abscess",
  "hiv": "HIV",
  "aids": "AIDS",
  "hepatitis c": "hepatitis C",
  "hcv": "hepatitis C",
  "covid": "COVID-19",
  "covid 19": "COVID-19",
  "influenza": "influenza",
  "flu": "influenza",
  
  // Musculoskeletal
  "osteoarthritis": "osteoarthritis",
  "oa": "osteoarthritis",
  "rheumatoid arthritis": "rheumatoid arthritis",
  "ra": "rheumatoid arthritis",
  "gout": "gout",
  "osteoporosis": "osteoporosis",
  "fibromyalgia": "fibromyalgia",
  "low back pain": "low back pain",
  "lbp": "low back pain",
  
  // Oncology
  "cancer": "cancer",
  "malignancy": "malignancy",
  "neoplasm": "neoplasm",
  "tumor": "tumor",
  "carcinoma": "carcinoma",
  "lymphoma": "lymphoma",
  "leukemia": "leukemia",
  "melanoma": "melanoma",
  
  // Other
  "anemia": "anemia",
  "obesity": "obesity",
  "allergies": "allergies",
  "allergic rhinitis": "allergic rhinitis",
  "eczema": "eczema",
  "psoriasis": "psoriasis",
};

// ============================================
// MEDICAL ABBREVIATIONS
// ============================================

export const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  // Dosing frequencies
  "b i d": "BID",
  "b.i.d": "BID",
  "twice daily": "BID",
  "twice a day": "BID",
  "t i d": "TID",
  "t.i.d": "TID",
  "three times daily": "TID",
  "three times a day": "TID",
  "q i d": "QID",
  "q.i.d": "QID",
  "four times daily": "QID",
  "four times a day": "QID",
  "p r n": "PRN",
  "p.r.n": "PRN",
  "as needed": "PRN",
  "q d": "QD",
  "q.d": "QD",
  "once daily": "QD",
  "daily": "QD",
  "q h s": "QHS",
  "q.h.s": "QHS",
  "at bedtime": "QHS",
  "h s": "HS",
  "h.s": "HS",
  "a c": "AC",
  "a.c": "AC",
  "before meals": "AC",
  "p c": "PC",
  "p.c": "PC",
  "after meals": "PC",
  
  // Routes of administration
  "p o": "PO",
  "p.o": "PO",
  "by mouth": "PO",
  "orally": "PO",
  "oral": "PO",
  "i v": "IV",
  "i.v": "IV",
  "intravenous": "IV",
  "i m": "IM",
  "i.m": "IM",
  "intramuscular": "IM",
  "s c": "SC",
  "s.c": "SC",
  "subcutaneous": "SC",
  "s q": "SC",
  "s l": "SL",
  "s.l": "SL",
  "sublingual": "SL",
  "p r": "PR",
  "p.r": "PR",
  "per rectum": "PR",
  "rectally": "PR",
  "topically": "topical",
  "inh": "inhalation",
  "inhalation": "inhalation",
  
  // Other abbreviations
  "n p o": "NPO",
  "n.p.o": "NPO",
  "nothing by mouth": "NPO",
  "nothing oral": "NPO",
  "s t a t": "STAT",
  "stat": "STAT",
  "immediately": "STAT",
  "now": "STAT",
  "o t c": "OTC",
  "over the counter": "OTC",
  "p r n": "PRN",
  "q 4 h": "q4h",
  "q 6 h": "q6h",
  "q 8 h": "q8h",
  "q 12 h": "q12h",
  "every 4 hours": "q4h",
  "every 6 hours": "q6h",
  "every 8 hours": "q8h",
  "every 12 hours": "q12h",
  
  // Clinical
  "h o": "H/O",
  "history of": "H/O",
  "s p": "S/P",
  "status post": "S/P",
  "f u": "F/U",
  "follow up": "F/U",
  "followup": "F/U",
  "r o": "R/O",
  "rule out": "R/O",
  "w n l": "WNL",
  "within normal limits": "WNL",
  "n a d": "NAD",
  "no acute distress": "NAD",
  "n v": "N/V",
  "nausea and vomiting": "N/V",
  "s o b": "SOB",
  "shortness of breath": "SOB",
  "dyspnea": "dyspnea",
  "c p": "CP",
  "chest pain": "chest pain",
  "f u o": "FUO",
  "fever of unknown origin": "FUO",
  "d o b": "DOB",
  "date of birth": "DOB",
  "d o d": "DOD",
  "date of death": "DOD",
};

// ============================================
// ANATOMICAL TERMS
// ============================================

export const ANATOMICAL_TERMS: Record<string, string> = {
  // Positional
  "bilateral": "bilateral",
  "unilateral": "unilateral",
  "anterior": "anterior",
  "posterior": "posterior",
  "superior": "superior",
  "inferior": "inferior",
  "lateral": "lateral",
  "medial": "medial",
  "distal": "distal",
  "proximal": "proximal",
  "dorsal": "dorsal",
  "ventral": "ventral",
  "cranial": "cranial",
  "caudal": "caudal",
  "ipsilateral": "ipsilateral",
  "contralateral": "contralateral",
  
  // Body regions
  "thoracic": "thoracic",
  "lumbar": "lumbar",
  "cervical": "cervical",
  "abdominal": "abdominal",
  "pelvic": "pelvic",
  "cranial": "cranial",
  "facial": "facial",
  
  // Organs
  "cardiac": "cardiac",
  "pulmonary": "pulmonary",
  "hepatic": "hepatic",
  "renal": "renal",
  "gastric": "gastric",
  "intestinal": "intestinal",
  "pancreatic": "pancreatic",
  "splenic": "splenic",
  "neurologic": "neurologic",
  "neurological": "neurological",
};

// ============================================
// CLINICAL SYMPTOMS AND SIGNS
// ============================================

export const CLINICAL_SYMPTOMS: Record<string, string> = {
  // Vital signs related
  "febrile": "febrile",
  "afebrile": "afebrile",
  "tachycardic": "tachycardic",
  "bradycardic": "bradycardic",
  "hypertensive": "hypertensive",
  "hypotensive": "hypotensive",
  "tachypneic": "tachypneic",
  "hypoxic": "hypoxic",
  
  // Symptoms
  "fever": "fever",
  "chills": "chills",
  "cough": "cough",
  "headache": "headache",
  "nausea": "nausea",
  "vomiting": "vomiting",
  "diarrhea": "diarrhea",
  "constipation": "constipation",
  "fatigue": "fatigue",
  "malaise": "malaise",
  "dyspnea": "dyspnea",
  "orthopnea": "orthopnea",
  "edema": "edema",
  "cyanosis": "cyanosis",
  "jaundice": "jaundice",
  "pallor": "pallor",
  "diaphoresis": "diaphoresis",
  "sweating": "diaphoresis",
  
  // Pain descriptors
  "sharp": "sharp",
  "dull": "dull",
  "aching": "aching",
  "throbbing": "throbbing",
  "burning": "burning",
  "cramping": "cramping",
  "radiating": "radiating",
  "intermittent": "intermittent",
  "constant": "constant",
};

// ============================================
// LABORATORY TESTS
// ============================================

export const LABORATORY_TESTS: Record<string, string> = {
  // Common labs
  "c b c": "CBC",
  "complete blood count": "CBC",
  "cmp": "CMP",
  "comprehensive metabolic panel": "CMP",
  "bmp": "BMP",
  "basic metabolic panel": "BMP",
  "hba1c": "HbA1c",
  "hemoglobin a1c": "HbA1c",
  "a1c": "HbA1c",
  "lipid panel": "lipid panel",
  "tsh": "TSH",
  "thyroid stimulating hormone": "TSH",
  "pt": "PT",
  "prothrombin time": "PT",
  "inr": "INR",
  "ptt": "PTT",
  "partial thromboplastin time": "PTT",
  "bun": "BUN",
  "creatinine": "creatinine",
  "cr": "creatinine",
  "egfr": "eGFR",
  "gfr": "GFR",
  "liver function test": "liver function tests",
  "lfts": "LFTs",
  "ast": "AST",
  "alt": "ALT",
  "alkaline phosphatase": "alkaline phosphatase",
  "alk phos": "alkaline phosphatase",
  "bilirubin": "bilirubin",
  "albumin": "albumin",
  "urinalysis": "urinalysis",
  "ua": "urinalysis",
  "blood culture": "blood culture",
  "urine culture": "urine culture",
  "troponin": "troponin",
  "bnp": "BNP",
  "b type natriuretic peptide": "BNP",
  "d dimer": "D-dimer",
  "lactate": "lactate",
  "c reactive protein": "C-reactive protein",
  "crp": "CRP",
  "esr": "ESR",
  "sedimentation rate": "ESR",
};

// ============================================
// COMBINED DICTIONARY
// ============================================

export const ALL_MEDICAL_TERMS: Record<string, string> = {
  ...DRUG_NAMES,
  ...MEDICAL_CONDITIONS,
  ...MEDICAL_ABBREVIATIONS,
  ...ANATOMICAL_TERMS,
  ...CLINICAL_SYMPTOMS,
  ...LABORATORY_TESTS,
};

// ============================================
// PROCESSING FUNCTION
// ============================================

export interface MedicalTermProcessResult {
  text: string;
  detectedTerms: string[];
  correctionsCount: number;
}

/**
 * Process transcription text for medical term correction
 * Handles multi-word phrases and preserves sentence structure
 */
export function processMedicalTerms(text: string): MedicalTermProcessResult {
  if (!text || typeof text !== 'string') {
    return { text: '', detectedTerms: [], correctionsCount: 0 };
  }

  const detectedTerms: string[] = [];
  let processedText = text;
  
  // Sort terms by length (longest first) to handle multi-word matches correctly
  const sortedTerms = Object.keys(ALL_MEDICAL_TERMS).sort((a, b) => b.length - a.length);
  
  for (const term of sortedTerms) {
    const correction = ALL_MEDICAL_TERMS[term];
    
    // Case-insensitive matching with word boundaries
    const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
    
    if (regex.test(processedText)) {
      // Reset regex lastIndex
      regex.lastIndex = 0;
      
      processedText = processedText.replace(regex, (match) => {
        const originalLower = match.toLowerCase();
        if (originalLower !== correction.toLowerCase()) {
          detectedTerms.push(`${match} → ${correction}`);
        }
        return correction;
      });
    }
  }
  
  // Limit detected terms to avoid overwhelming UI
  const limitedTerms = detectedTerms.slice(0, 15);
  
  return {
    text: processedText,
    detectedTerms: limitedTerms,
    correctionsCount: limitedTerms.length,
  };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a word is a medical term
 */
export function isMedicalTerm(word: string): boolean {
  const lowerWord = word.toLowerCase();
  return lowerWord in ALL_MEDICAL_TERMS;
}

/**
 * Get all terms in a category
 */
export function getTermsByCategory(category: 'drugs' | 'conditions' | 'abbreviations' | 'anatomy' | 'symptoms' | 'labs'): Record<string, string> {
  switch (category) {
    case 'drugs':
      return DRUG_NAMES;
    case 'conditions':
      return MEDICAL_CONDITIONS;
    case 'abbreviations':
      return MEDICAL_ABBREVIATIONS;
    case 'anatomy':
      return ANATOMICAL_TERMS;
    case 'symptoms':
      return CLINICAL_SYMPTOMS;
    case 'labs':
      return LABORATORY_TESTS;
    default:
      return {};
  }
}

/**
 * Get statistics about the medical dictionary
 */
export function getDictionaryStats() {
  return {
    totalTerms: Object.keys(ALL_MEDICAL_TERMS).length,
    categories: {
      drugs: Object.keys(DRUG_NAMES).length,
      conditions: Object.keys(MEDICAL_CONDITIONS).length,
      abbreviations: Object.keys(MEDICAL_ABBREVIATIONS).length,
      anatomy: Object.keys(ANATOMICAL_TERMS).length,
      symptoms: Object.keys(CLINICAL_SYMPTOMS).length,
      labs: Object.keys(LABORATORY_TESTS).length,
    },
  };
}

/**
 * Embedded Medical Knowledge Base
 * =================================
 * 
 * Comprehensive medical knowledge for Clinical Decision Support System.
 * This data is embedded directly in the application to ensure availability
 * in serverless environments (Vercel) without database dependency.
 * 
 * Categories:
 * - Clinical Guidelines (evidence-based protocols)
 * - Drug Interactions (critical safety data)
 * - ICD-10 Codes (diagnostic coding)
 * - Lab Reference Ranges (interpretation)
 * - Symptom-Condition Mappings (differential diagnosis)
 * - Drug Database (medication information)
 * 
 * Evidence Levels:
 * - A: High-quality evidence (RCTs, meta-analyses)
 * - B: Moderate evidence (cohort studies, case-control)
 * - C: Limited evidence (case series, expert opinion)
 */

// ============================================================================
// CLINICAL GUIDELINES
// ============================================================================

export interface ClinicalGuideline {
  id: string;
  title: string;
  category: 'cardiovascular' | 'endocrine' | 'respiratory' | 'infectious' | 'neurological' | 'gastrointestinal' | 'renal' | 'emergency';
  content: string;
  summary: string;
  icdCodes: string[];
  keywords: string[];
  drugNames: string[];
  evidenceLevel: 'A' | 'B' | 'C';
  source: string;
  lastUpdated: string;
}

export const CLINICAL_GUIDELINES: ClinicalGuideline[] = [
  {
    id: 'guideline-htn-001',
    title: 'Hypertension Management Protocol',
    category: 'cardiovascular',
    content: `HYPERTENSION MANAGEMENT GUIDELINES

1. BLOOD PRESSURE CLASSIFICATION:
   - Normal: <120/80 mmHg
   - Elevated: 120-129/<80 mmHg
   - Stage 1 Hypertension: 130-139/80-89 mmHg
   - Stage 2 Hypertension: ≥140/≥90 mmHg
   - Hypertensive Crisis: >180/>120 mmHg

2. INITIAL EVALUATION:
   - Confirm elevated BP on 2+ visits
   - Assess cardiovascular risk factors
   - Screen for secondary causes
   - Evaluate for target organ damage

3. FIRST-LINE MEDICATIONS:
   - Thiazide diuretics (HCTZ 12.5-25mg daily)
   - ACE inhibitors (lisinopril 10-40mg daily)
   - ARBs (losartan 50-100mg daily)
   - Calcium channel blockers (amlodipine 5-10mg daily)

4. LIFESTYLE MODIFICATIONS:
   - DASH diet (Dietary Approaches to Stop Hypertension)
   - Sodium restriction (<2300mg/day, ideally <1500mg/day)
   - Regular aerobic exercise (150 min/week)
   - Weight reduction if BMI >25
   - Limit alcohol (<2 drinks/day men, <1 drink/day women)

5. TREATMENT TARGETS:
   - General population: <140/90 mmHg
   - Diabetes/CKD: <130/80 mmHg
   - Elderly (>65): <150/90 mmHg (consider <140/90 if tolerated)

6. FOLLOW-UP:
   - Monthly until controlled
   - Then every 3-6 months
   - Annual labs: BMP, lipid panel`,
    summary: 'Guidelines for diagnosis and management of hypertension including BP classification, medications, lifestyle modifications, and targets.',
    icdCodes: ['I10', 'I11', 'I12', 'I13', 'I15'],
    keywords: ['hypertension', 'blood pressure', 'ACE inhibitor', 'antihypertensive', 'DASH diet', 'cardiovascular'],
    drugNames: ['lisinopril', 'amlodipine', 'losartan', 'hydrochlorothiazide', 'metoprolol'],
    evidenceLevel: 'A',
    source: 'ACC/AHA 2017 Hypertension Guidelines',
    lastUpdated: '2024-01-01'
  },
  {
    id: 'guideline-dm-001',
    title: 'Type 2 Diabetes Management Protocol',
    category: 'endocrine',
    content: `TYPE 2 DIABETES MELLITUS MANAGEMENT

1. DIAGNOSTIC CRITERIA:
   - Fasting glucose ≥126 mg/dL (7.0 mmol/L)
   - 2-hour glucose ≥200 mg/dL during OGTT
   - HbA1c ≥6.5%
   - Random glucose ≥200 mg/dL with symptoms

2. GLYCEMIC TARGETS:
   - HbA1c: <7% for most adults
   - Fasting glucose: 80-130 mg/dL
   - Postprandial: <180 mg/dL
   - Individualize based on age, comorbidities, life expectancy

3. FIRST-LINE THERAPY:
   - Metformin 500-2000mg daily (start 500mg with meals)
   - Lifestyle modifications (diet, exercise, weight loss)

4. SECOND-LINE AGENTS (add to metformin):
   - SGLT2 inhibitors (empagliflozin, dapagliflozin) - preferred for CV benefit
   - GLP-1 receptor agonists (semaglutide, liraglutide) - preferred for weight loss
   - DPP-4 inhibitors (sitagliptin, linagliptin)
   - Sulfonylureas (glimepiride, glipizide) - caution hypoglycemia
   - Insulin therapy when needed

5. MONITORING:
   - HbA1c every 3 months until controlled, then every 6 months
   - Annual comprehensive metabolic panel
   - Annual lipid panel
   - Annual urine albumin-creatinine ratio
   - Annual dilated eye exam
   - Annual foot exam

6. CARDIOVASCULAR RISK MANAGEMENT:
   - Statin therapy for most patients (atorvastatin 20-80mg)
   - BP target <130/80 mmHg
   - Aspirin 81mg for high-risk patients

7. SPECIAL CONSIDERATIONS:
   - eGFR 30-45: Reduce metformin dose, avoid contrast
   - eGFR <30: Discontinue metformin, use insulin
   - Heart failure: Prefer SGLT2 inhibitors`,
    summary: 'Comprehensive type 2 diabetes management including medications, monitoring, and cardiovascular risk management.',
    icdCodes: ['E11', 'E11.9', 'E11.65', 'E11.69'],
    keywords: ['diabetes', 'metformin', 'HbA1c', 'glucose', 'SGLT2', 'GLP-1', 'insulin'],
    drugNames: ['metformin', 'empagliflozin', 'dapagliflozin', 'semaglutide', 'liraglutide', 'sitagliptin', 'glimepiride', 'insulin glargine', 'atorvastatin'],
    evidenceLevel: 'A',
    source: 'ADA Standards of Care 2024',
    lastUpdated: '2024-01-01'
  },
  {
    id: 'guideline-cap-001',
    title: 'Community-Acquired Pneumonia Treatment',
    category: 'respiratory',
    content: `COMMUNITY-ACQUIRED PNEUMONIA (CAP) TREATMENT

1. DIAGNOSIS:
   - Clinical: fever, cough, dyspnea, chest pain
   - Chest X-ray: new infiltrate
   - CURB-65 severity assessment

2. CURB-65 SCORING:
   - Confusion (new onset): 1 point
   - Urea >7 mmol/L: 1 point
   - Respiratory rate ≥30/min: 1 point
   - Blood pressure <90/60 mmHg: 1 point
   - Age ≥65 years: 1 point
   
   DISPOSITION:
   - Score 0-1: Outpatient treatment
   - Score 2: Consider hospitalization
   - Score 3-5: Hospitalize, consider ICU for 4-5

3. OUTPATIENT TREATMENT (Healthy, no comorbidities):
   - Amoxicillin 1g PO TID x5 days OR
   - Doxycycline 100mg PO BID x5 days OR
   - Azithromycin 500mg day 1, then 250mg daily x4 days

4. OUTPATIENT TREATMENT (Comorbidities*):
   - Amoxicillin-clavulanate 875mg PO BID + macrolide OR
   - Respiratory fluoroquinolone (levofloxacin 750mg daily x5 days)
   *Comorbidities: COPD, diabetes, CKD, heart failure, malignancy

5. INPATIENT TREATMENT (Non-ICU):
   - Ceftriaxone 1g IV daily + azithromycin 500mg IV/PO daily
   - Alternative: Levofloxacin 750mg IV daily
   - Duration: Minimum 5 days, afebrile 48-72h before stopping

6. ICU TREATMENT:
   - Ceftriaxone 2g IV daily + azithromycin 500mg IV daily
   - Consider adding vancomycin for MRSA risk
   - Consider piperacillin-tazobactam for Pseudomonas risk

7. FOLLOW-UP:
   - Repeat chest X-ray in 6-8 weeks for age >50 or smokers
   - Smoking cessation counseling`,
    summary: 'CAP treatment with CURB-65 scoring, antibiotic selection, and disposition criteria.',
    icdCodes: ['J18.1', 'J18.9'],
    keywords: ['pneumonia', 'CAP', 'CURB-65', 'antibiotic', 'chest X-ray', 'respiratory'],
    drugNames: ['amoxicillin', 'doxycycline', 'azithromycin', 'amoxicillin-clavulanate', 'levofloxacin', 'ceftriaxone', 'vancomycin', 'piperacillin-tazobactam'],
    evidenceLevel: 'A',
    source: 'IDSA/ATS Guidelines 2019',
    lastUpdated: '2024-01-01'
  },
  {
    id: 'guideline-afib-001',
    title: 'Atrial Fibrillation Management',
    category: 'cardiovascular',
    content: `ATRIAL FIBRILLATION MANAGEMENT

1. DIAGNOSIS:
   - Irregularly irregular pulse
   - ECG confirmation (absent P waves, irregular RR intervals)
   - Rhythm monitoring if paroxysmal suspected

2. RATE CONTROL (First-line for most patients):
   - Target: HR <110 bpm at rest
   
   MEDICATIONS:
   - Beta blockers: Metoprolol 25-200mg BID, Bisoprolol 2.5-10mg daily
   - Non-DHP CCB: Diltiazem 120-360mg daily, Verapamil 120-360mg daily
   - Digoxin 0.125-0.25mg daily (add-on, especially with HF)

3. RHYTHM CONTROL (Consider if):
   - Symptomatic despite rate control
   - New-onset AF (<48 hours)
   - Patient preference
   - First episode in young patient
   
   OPTIONS:
   - Electrical cardioversion (with anticoagulation plan)
   - Pharmacologic: Amiodarone, Flecainide, Propafenone
   - Catheter ablation (symptomatic paroxysmal AF)

4. ANTICOAGULATION (CHA₂DS₂-VASc Score):
   Score 0 (men) or 1 (women): No anticoagulation
   Score 1 (men): Consider anticoagulation
   Score ≥2: Anticoagulation recommended
   
   CHA₂DS₂-VASc:
   - CHF/LV dysfunction: 1 point
   - Hypertension: 1 point
   - Age ≥75: 2 points
   - Diabetes: 1 point
   - Stroke/TIA/thromboembolism: 2 points
   - Vascular disease: 1 point
   - Age 65-74: 1 point
   - Sex (female): 1 point

5. ANTICOAGULANT OPTIONS:
   - DOACs (preferred):
     * Apixaban 5mg BID (2.5mg BID if criteria met)
     * Rivaroxaban 20mg daily with food
     * Dabigatran 150mg BID
     * Edoxaban 60mg daily
   - Warfarin (INR 2-3) for mechanical valves or moderate-severe MS

6. HAS-BLED Bleeding Risk:
   Score ≥3: High bleeding risk, address modifiable factors`,
    summary: 'AFib management with rate/rhythm control strategies and anticoagulation based on CHA₂DS₂-VASc.',
    icdCodes: ['I48.91', 'I48.0', 'I48.1', 'I48.2'],
    keywords: ['atrial fibrillation', 'AFib', 'anticoagulation', 'CHA2DS2-VASc', 'rate control', 'rhythm control'],
    drugNames: ['metoprolol', 'diltiazem', 'digoxin', 'amiodarone', 'flecainide', 'apixaban', 'rivaroxaban', 'dabigatran', 'warfarin'],
    evidenceLevel: 'A',
    source: 'AHA/ACC/HRS Guidelines 2014, ESC 2020',
    lastUpdated: '2024-01-01'
  },
  {
    id: 'guideline-sepsis-001',
    title: 'Sepsis Recognition and Management',
    category: 'emergency',
    content: `SEPSIS RECOGNITION AND MANAGEMENT (Hour-1 Bundle)

1. SEPSIS SCREENING (qSOFA ≥2 suggests sepsis):
   - Respiratory rate ≥22/min
   - Altered mental status (GCS <15)
   - Systolic BP ≤100 mmHg
   
   PLUS suspected/confirmed infection

2. SEPTIC SHOCK:
   Sepsis PLUS:
   - Vasopressor requirement to maintain MAP ≥65 mmHg
   - Lactate >2 mmol/L despite adequate fluid resuscitation

3. HOUR-1 BUNDLE (Start immediately):
   
   A. MEASURE LACTATE LEVEL
   - If >2 mmol/L: Repeat within 2-4 hours
   
   B. BLOOD CULTURES
   - At least 2 sets before antibiotics
   - Don't delay antibiotics for cultures
   
   C. BROAD-SPECTRUM ANTIBIOTICS
   - Administer within 1 hour of recognition
   - Empiric coverage for likely source:
     * Pneumonia: Ceftriaxone + azithromycin ± vancomycin
     * UTI: Ceftriaxone ± vancomycin
     * Intra-abdominal: Piperacillin-tazobactam ± vancomycin
     * Skin/soft tissue: Vancomycin + piperacillin-tazobactam
     * Unknown source: Vancomycin + piperacillin-tazobactam
   
   D. FLUID RESUSCITATION
   - 30 mL/kg crystalloid for hypotension or lactate ≥4
   - Reassess after each bolus
   - Target MAP ≥65 mmHg
   
   E. VASOPRESSORS
   - Norepinephrine first-line (target MAP ≥65)
   - Add vasopressin (0.03-0.04 units/min) if refractory
   - Consider hydrocortisone 200mg/day if refractory shock

4. MONITORING:
   - Continuous vital signs
   - Urine output (target >0.5 mL/kg/hr)
   - Serial lactate
   - Central venous pressure and ScvO2 (if central line)

5. SOURCE CONTROL:
   - Identify and address within 6-12 hours
   - Drain abscesses, remove infected devices

6. ICU ADMISSION CRITERIA:
   - Septic shock
   - Need for vasopressors
   - Mechanical ventilation
   - Lactate >4 mmol/L
   - Multiple organ dysfunction`,
    summary: 'Sepsis Hour-1 Bundle with recognition criteria, antibiotics, fluids, and vasopressor management.',
    icdCodes: ['A41.9', 'R65.20', 'R65.21'],
    keywords: ['sepsis', 'septic shock', 'qSOFA', 'lactate', 'vasopressor', 'antibiotics', 'fluid resuscitation'],
    drugNames: ['norepinephrine', 'vasopressin', 'ceftriaxone', 'azithromycin', 'vancomycin', 'piperacillin-tazobactam', 'hydrocortisone'],
    evidenceLevel: 'A',
    source: 'Surviving Sepsis Campaign 2021',
    lastUpdated: '2024-01-01'
  }
];

// ============================================================================
// DRUG INTERACTIONS DATABASE
// ============================================================================

export interface DrugInteraction {
  id: string;
  drug1: string;
  drug2: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  mechanism: string;
  effects: string[];
  management: string;
  evidenceLevel: 'A' | 'B' | 'C';
}

export const DRUG_INTERACTIONS: DrugInteraction[] = [
  {
    id: 'interaction-001',
    drug1: 'Warfarin',
    drug2: 'Amoxicillin',
    severity: 'major',
    mechanism: 'Altered gut flora reducing vitamin K synthesis; possible direct effect on clotting factors',
    effects: ['Increased INR', 'Bleeding risk', 'Bruising', 'Hematuria'],
    management: 'Monitor INR 3-5 days after starting/stopping amoxicillin. Reduce warfarin dose 25-50% if needed. Watch for bleeding signs.',
    evidenceLevel: 'A'
  },
  {
    id: 'interaction-002',
    drug1: 'Warfarin',
    drug2: 'Azithromycin',
    severity: 'major',
    mechanism: 'CYP450 inhibition; altered gut flora',
    effects: ['Increased INR', 'Bleeding', 'Hemorrhage'],
    management: 'Check INR before and 3-5 days after starting azithromycin. Reduce warfarin dose if needed.',
    evidenceLevel: 'B'
  },
  {
    id: 'interaction-003',
    drug1: 'Lisinopril',
    drug2: 'Spironolactone',
    severity: 'major',
    mechanism: 'Additive effect on potassium retention',
    effects: ['Hyperkalemia', 'Cardiac arrhythmias', 'Muscle weakness'],
    management: 'Monitor potassium frequently. Avoid in renal impairment (eGFR <30). Educate on high-K foods.',
    evidenceLevel: 'A'
  },
  {
    id: 'interaction-004',
    drug1: 'Simvastatin',
    drug2: 'Clarithromycin',
    severity: 'contraindicated',
    mechanism: 'Strong CYP3A4 inhibition dramatically increases simvastatin levels',
    effects: ['Rhabdomyolysis', 'Myopathy', 'Acute kidney injury', 'Severe muscle pain'],
    management: 'CONTRAINDICATED. Stop simvastatin during clarithromycin. Use pravastatin or rosuvastatin if needed.',
    evidenceLevel: 'A'
  },
  {
    id: 'interaction-005',
    drug1: 'Methotrexate',
    drug2: 'Ibuprofen',
    severity: 'major',
    mechanism: 'Reduced renal clearance of methotrexate via prostaglandin inhibition',
    effects: ['Methotrexate toxicity', 'Bone marrow suppression', 'Hepatotoxicity', 'Renal failure'],
    management: 'Avoid if possible. Use lowest NSAID dose. Monitor CBC, renal function, LFTs. Consider acetaminophen.',
    evidenceLevel: 'A'
  },
  {
    id: 'interaction-006',
    drug1: 'Metformin',
    drug2: 'Cephalexin',
    severity: 'moderate',
    mechanism: 'Decreased renal clearance via OCT/MATE transporter inhibition',
    effects: ['Lactic acidosis risk', 'GI side effects'],
    management: 'Monitor renal function. Watch for lactic acidosis symptoms (muscle pain, weakness, trouble breathing).',
    evidenceLevel: 'C'
  },
  {
    id: 'interaction-007',
    drug1: 'Metformin',
    drug2: 'Furosemide',
    severity: 'moderate',
    mechanism: 'Competitive renal secretion; altered renal function',
    effects: ['Increased metformin levels', 'Lactic acidosis risk'],
    management: 'Monitor renal function. Adjust metformin dose if needed. Watch for lactic acidosis symptoms.',
    evidenceLevel: 'B'
  },
  {
    id: 'interaction-008',
    drug1: 'Digoxin',
    drug2: 'Amiodarone',
    severity: 'major',
    mechanism: 'P-glycoprotein inhibition; reduced renal clearance',
    effects: ['Digoxin toxicity', 'Nausea', 'Visual disturbances', 'Arrhythmias'],
    management: 'Reduce digoxin dose 50% when starting amiodarone. Monitor digoxin levels closely.',
    evidenceLevel: 'A'
  },
  {
    id: 'interaction-009',
    drug1: 'Clopidogrel',
    drug2: 'Omeprazole',
    severity: 'major',
    mechanism: 'CYP2C19 inhibition reduces clopidogrel activation',
    effects: ['Reduced antiplatelet effect', 'Increased cardiovascular events'],
    management: 'Avoid combination. Use pantoprazole or H2 blocker instead. Separate dosing by 12+ hours if PPI essential.',
    evidenceLevel: 'A'
  },
  {
    id: 'interaction-010',
    drug1: 'Sertraline',
    drug2: 'Warfarin',
    severity: 'moderate',
    mechanism: 'CYP2C9 inhibition; altered protein binding',
    effects: ['Increased INR', 'Bleeding risk'],
    management: 'Monitor INR more frequently when starting/stopping SSRI. Patient education on bleeding signs.',
    evidenceLevel: 'B'
  },
  {
    id: 'interaction-011',
    drug1: 'Allopurinol',
    drug2: 'Ampicillin',
    severity: 'moderate',
    mechanism: 'Increased incidence of drug rash',
    effects: ['Severe skin rash', 'Hypersensitivity reaction'],
    management: 'Monitor for rash. Discontinue if skin reaction occurs. Consider alternative antibiotic.',
    evidenceLevel: 'B'
  },
  {
    id: 'interaction-012',
    drug1: 'Theophylline',
    drug2: 'Ciprofloxacin',
    severity: 'major',
    mechanism: 'CYP1A2 inhibition reduces theophylline clearance',
    effects: ['Theophylline toxicity', 'Seizures', 'Arrhythmias', 'Nausea'],
    management: 'Reduce theophylline dose 50%. Monitor levels. Watch for toxicity symptoms.',
    evidenceLevel: 'A'
  }
];

// ============================================================================
// ICD-10 CODES DATABASE
// ============================================================================

export interface ICD10Code {
  code: string;
  description: string;
  category: string;
  subcategory?: string;
  isCommon: boolean;
}

export const ICD10_CODES: ICD10Code[] = [
  // Cardiovascular
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Cardiovascular', isCommon: true },
  { code: 'I11.9', description: 'Hypertensive heart disease without heart failure', category: 'Cardiovascular', isCommon: true },
  { code: 'I20.9', description: 'Angina pectoris, unspecified', category: 'Cardiovascular', isCommon: true },
  { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', category: 'Cardiovascular', isCommon: true },
  { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery', category: 'Cardiovascular', isCommon: true },
  { code: 'I48.91', description: 'Unspecified atrial fibrillation', category: 'Cardiovascular', isCommon: true },
  { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Cardiovascular', isCommon: true },
  { code: 'I63.9', description: 'Cerebral infarction, unspecified', category: 'Cardiovascular', isCommon: true },
  
  // Endocrine
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine', isCommon: true },
  { code: 'E11.65', description: 'Type 2 diabetes with hyperglycemia', category: 'Endocrine', isCommon: true },
  { code: 'E11.21', description: 'Type 2 diabetes with diabetic nephropathy', category: 'Endocrine', isCommon: true },
  { code: 'E11.40', description: 'Type 2 diabetes with diabetic neuropathy', category: 'Endocrine', isCommon: true },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified', category: 'Endocrine', isCommon: true },
  { code: 'E05.90', description: 'Thyrotoxicosis, unspecified', category: 'Endocrine', isCommon: true },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Endocrine', isCommon: true },
  { code: 'E66.9', description: 'Obesity, unspecified', category: 'Endocrine', isCommon: true },
  
  // Respiratory
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory', isCommon: true },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism', category: 'Respiratory', isCommon: true },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', category: 'Respiratory', isCommon: true },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated', category: 'Respiratory', isCommon: true },
  { code: 'J44.1', description: 'Chronic obstructive pulmonary disease with acute exacerbation', category: 'Respiratory', isCommon: true },
  
  // Gastrointestinal
  { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis', category: 'Gastrointestinal', isCommon: true },
  { code: 'K29.70', description: 'Gastritis, unspecified, without bleeding', category: 'Gastrointestinal', isCommon: true },
  { code: 'K35.80', description: 'Acute appendicitis, unspecified', category: 'Gastrointestinal', isCommon: true },
  { code: 'K59.1', description: 'Functional diarrhea', category: 'Gastrointestinal', isCommon: true },
  
  // Renal
  { code: 'N18.9', description: 'Chronic kidney disease, unspecified', category: 'Renal', isCommon: true },
  { code: 'N17.9', description: 'Acute kidney failure, unspecified', category: 'Renal', isCommon: true },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', category: 'Renal', isCommon: true },
  
  // Musculoskeletal
  { code: 'M19.90', description: 'Unspecified osteoarthritis, unspecified site', category: 'Musculoskeletal', isCommon: true },
  { code: 'M06.9', description: 'Rheumatoid arthritis, unspecified', category: 'Musculoskeletal', isCommon: true },
  { code: 'M54.5', description: 'Low back pain', category: 'Musculoskeletal', isCommon: true },
  { code: 'M10.9', description: 'Gout, unspecified', category: 'Musculoskeletal', isCommon: true },
  
  // Neurological
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable', category: 'Neurological', isCommon: true },
  { code: 'G44.209', description: 'Tension-type headache, unspecified, not intractable', category: 'Neurological', isCommon: true },
  { code: 'G40.909', description: 'Epilepsy, unspecified, not intractable', category: 'Neurological', isCommon: true },
  
  // Psychiatric
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', category: 'Psychiatric', isCommon: true },
  { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'Psychiatric', isCommon: true },
  { code: 'F41.0', description: 'Panic disorder [episodic paroxysmal anxiety]', category: 'Psychiatric', isCommon: true },
  
  // Infectious
  { code: 'A41.9', description: 'Sepsis, unspecified organism', category: 'Infectious', isCommon: true },
  { code: 'L03.90', description: 'Cellulitis, unspecified', category: 'Infectious', isCommon: true }
];

// ============================================================================
// LAB REFERENCE RANGES
// ============================================================================

export interface LabReference {
  name: string;
  abbreviation: string;
  unit: string;
  lowRange: number;
  highRange: number;
  criticalLow?: number;
  criticalHigh?: number;
  category: string;
  interpretation: {
    low: string;
    high: string;
    critical?: string;
  };
}

export const LAB_REFERENCES: LabReference[] = [
  // Complete Blood Count
  {
    name: 'Hemoglobin',
    abbreviation: 'Hgb',
    unit: 'g/dL',
    lowRange: 12.0,
    highRange: 16.0,
    criticalLow: 7.0,
    criticalHigh: 20.0,
    category: 'CBC',
    interpretation: {
      low: 'Anemia - consider iron studies, B12, folate, chronic disease',
      high: 'Polycythemia - dehydration, smoking, altitude, polycythemia vera',
      critical: 'Transfusion consideration, oxygen delivery compromised'
    }
  },
  {
    name: 'Hematocrit',
    abbreviation: 'Hct',
    unit: '%',
    lowRange: 36,
    highRange: 44,
    criticalLow: 21,
    criticalHigh: 60,
    category: 'CBC',
    interpretation: {
      low: 'Anemia - correlate with hemoglobin',
      high: 'Polycythemia - evaluate cause'
    }
  },
  {
    name: 'White Blood Cell Count',
    abbreviation: 'WBC',
    unit: '/μL',
    lowRange: 4500,
    highRange: 11000,
    criticalLow: 1500,
    criticalHigh: 30000,
    category: 'CBC',
    interpretation: {
      low: 'Leukopenia - viral infection, bone marrow suppression, autoimmune',
      high: 'Leukocytosis - infection, inflammation, leukemia, steroids',
      critical: 'Neutropenia risk, immunosuppression'
    }
  },
  {
    name: 'Platelet Count',
    abbreviation: 'Plt',
    unit: '/μL',
    lowRange: 150000,
    highRange: 400000,
    criticalLow: 20000,
    criticalHigh: 1000000,
    category: 'CBC',
    interpretation: {
      low: 'Thrombocytopenia - ITP, drugs, infection, marrow disorders',
      high: 'Thrombocytosis - reactive, essential thrombocythemia',
      critical: 'Spontaneous bleeding risk'
    }
  },
  {
    name: 'Mean Corpuscular Volume',
    abbreviation: 'MCV',
    unit: 'fL',
    lowRange: 80,
    highRange: 100,
    category: 'CBC',
    interpretation: {
      low: 'Microcytic - iron deficiency, thalassemia, anemia of chronic disease',
      high: 'Macrocytic - B12/folate deficiency, alcohol, hypothyroidism'
    }
  },
  
  // Electrolytes
  {
    name: 'Sodium',
    abbreviation: 'Na',
    unit: 'mEq/L',
    lowRange: 136,
    highRange: 145,
    criticalLow: 125,
    criticalHigh: 155,
    category: 'Electrolytes',
    interpretation: {
      low: 'Hyponatremia - assess volume status, SIADH, diuretics',
      high: 'Hypernatremia - dehydration, diabetes insipidus',
      critical: 'Neurological symptoms, seizures'
    }
  },
  {
    name: 'Potassium',
    abbreviation: 'K',
    unit: 'mEq/L',
    lowRange: 3.5,
    highRange: 5.0,
    criticalLow: 2.5,
    criticalHigh: 6.5,
    category: 'Electrolytes',
    interpretation: {
      low: 'Hypokalemia - diuretics, GI losses, insulin',
      high: 'Hyperkalemia - renal failure, ACE-I, K+ supplements',
      critical: 'Cardiac arrhythmias - ECG changes'
    }
  },
  {
    name: 'Chloride',
    abbreviation: 'Cl',
    unit: 'mEq/L',
    lowRange: 98,
    highRange: 106,
    category: 'Electrolytes',
    interpretation: {
      low: 'Hypochloremia - vomiting, diuretics',
      high: 'Hyperchloremia - dehydration, renal tubular acidosis'
    }
  },
  {
    name: 'Bicarbonate',
    abbreviation: 'HCO3',
    unit: 'mEq/L',
    lowRange: 22,
    highRange: 28,
    category: 'Electrolytes',
    interpretation: {
      low: 'Metabolic acidosis or respiratory alkalosis',
      high: 'Metabolic alkalosis or respiratory acidosis'
    }
  },
  
  // Renal Function
  {
    name: 'Blood Urea Nitrogen',
    abbreviation: 'BUN',
    unit: 'mg/dL',
    lowRange: 7,
    highRange: 20,
    criticalHigh: 100,
    category: 'Renal',
    interpretation: {
      low: 'Liver disease, malnutrition, pregnancy',
      high: 'Renal impairment, dehydration, GI bleeding, high protein'
    }
  },
  {
    name: 'Creatinine',
    abbreviation: 'Cr',
    unit: 'mg/dL',
    lowRange: 0.7,
    highRange: 1.3,
    criticalHigh: 4.0,
    category: 'Renal',
    interpretation: {
      low: 'Low muscle mass, pregnancy',
      high: 'Renal impairment - calculate eGFR for staging',
      critical: 'AKI/CKD - nephrology consult'
    }
  },
  
  // Glucose
  {
    name: 'Glucose (Fasting)',
    abbreviation: 'Glu',
    unit: 'mg/dL',
    lowRange: 70,
    highRange: 100,
    criticalLow: 50,
    criticalHigh: 400,
    category: 'Metabolic',
    interpretation: {
      low: 'Hypoglycemia - insulin excess, starvation, adrenal insufficiency',
      high: 'Hyperglycemia - diabetes, stress, medications',
      critical: 'Hypoglycemic crisis or DKA/HHS risk'
    }
  },
  {
    name: 'HbA1c',
    abbreviation: 'HbA1c',
    unit: '%',
    lowRange: 4.0,
    highRange: 5.6,
    criticalHigh: 10.0,
    category: 'Metabolic',
    interpretation: {
      low: 'Hypoglycemic episodes, anemia, hemoglobinopathy',
      high: 'Poor glucose control - adjust diabetes regimen',
      critical: 'Severely uncontrolled diabetes'
    }
  },
  
  // Liver Function
  {
    name: 'AST',
    abbreviation: 'AST',
    unit: 'U/L',
    lowRange: 10,
    highRange: 40,
    criticalHigh: 1000,
    category: 'Liver',
    interpretation: {
      low: 'Usually not clinically significant',
      high: 'Hepatocellular injury - hepatitis, alcohol, medications'
    }
  },
  {
    name: 'ALT',
    abbreviation: 'ALT',
    unit: 'U/L',
    lowRange: 7,
    highRange: 56,
    criticalHigh: 1000,
    category: 'Liver',
    interpretation: {
      low: 'Usually not clinically significant',
      high: 'Hepatocellular injury - more specific to liver than AST'
    }
  },
  {
    name: 'Total Bilirubin',
    abbreviation: 'Tbil',
    unit: 'mg/dL',
    lowRange: 0.1,
    highRange: 1.2,
    criticalHigh: 10.0,
    category: 'Liver',
    interpretation: {
      low: 'Usually not clinically significant',
      high: 'Hyperbilirubinemia - hemolysis, liver disease, obstruction'
    }
  }
];

// ============================================================================
// SYMPTOM-CONDITION MAPPINGS
// ============================================================================

export interface SymptomMapping {
  symptom: string;
  category: string;
  possibleConditions: Array<{
    condition: string;
    icdCode: string;
    probability: number; // 0-1
    urgency: 'critical' | 'high' | 'moderate' | 'low';
    keyFeatures: string[];
  }>;
  redFlags: string[];
  recommendedWorkup: string[];
}

export const SYMPTOM_MAPPINGS: SymptomMapping[] = [
  {
    symptom: 'Chest Pain',
    category: 'Cardiovascular',
    possibleConditions: [
      {
        condition: 'Acute Coronary Syndrome',
        icdCode: 'I21',
        probability: 0.25,
        urgency: 'critical',
        keyFeatures: ['Pressure/squeezing', 'Radiation to arm/jaw', 'Diaphoresis', 'Dyspnea']
      },
      {
        condition: 'Gastroesophageal Reflux',
        icdCode: 'K21',
        probability: 0.30,
        urgency: 'low',
        keyFeatures: ['Burning quality', 'Worse after meals', 'Relief with antacids']
      },
      {
        condition: 'Musculoskeletal Pain',
        icdCode: 'M54.6',
        probability: 0.20,
        urgency: 'low',
        keyFeatures: ['Sharp', 'Reproducible with palpation', 'Movement-related']
      },
      {
        condition: 'Pulmonary Embolism',
        icdCode: 'I26',
        probability: 0.10,
        urgency: 'critical',
        keyFeatures: ['Pleuritic', 'Sudden onset', 'Dyspnea', 'Risk factors for VTE']
      },
      {
        condition: 'Pericarditis',
        icdCode: 'I30',
        probability: 0.08,
        urgency: 'moderate',
        keyFeatures: ['Sharp', 'Worse lying flat', 'Relief sitting forward', 'Friction rub']
      },
      {
        condition: 'Aortic Dissection',
        icdCode: 'I71',
        probability: 0.02,
        urgency: 'critical',
        keyFeatures: ['Tearing sensation', 'Radiates to back', 'BP differential between arms']
      }
    ],
    redFlags: [
      'New onset at rest in high-risk patient',
      'Radiation to arm/jaw/neck',
      'Associated dyspnea, diaphoresis',
      'Hypotension',
      'Syncope',
      'Known CAD, diabetes'
    ],
    recommendedWorkup: [
      'ECG within 10 minutes',
      'Troponin I/T serial',
      'Chest X-ray',
      'Consider CT-PA if PE suspected',
      'Consider echocardiogram'
    ]
  },
  {
    symptom: 'Headache',
    category: 'Neurological',
    possibleConditions: [
      {
        condition: 'Tension Headache',
        icdCode: 'G44.2',
        probability: 0.40,
        urgency: 'low',
        keyFeatures: ['Bilateral', 'Pressing/tightening', 'Mild-moderate intensity', 'No nausea']
      },
      {
        condition: 'Migraine',
        icdCode: 'G43',
        probability: 0.25,
        urgency: 'moderate',
        keyFeatures: ['Unilateral', 'Pulsating', 'Nausea/vomiting', 'Photophobia', 'Aura possible']
      },
      {
        condition: 'Sinusitis',
        icdCode: 'J01',
        probability: 0.15,
        urgency: 'low',
        keyFeatures: ['Facial pressure', 'Nasal congestion', 'Purulent discharge']
      },
      {
        condition: 'Subarachnoid Hemorrhage',
        icdCode: 'I60',
        probability: 0.02,
        urgency: 'critical',
        keyFeatures: ['Thunderclap onset', 'Worst headache of life', 'Neck stiffness', 'Altered consciousness']
      },
      {
        condition: 'Giant Cell Arteritis',
        icdCode: 'M31.5',
        probability: 0.01,
        urgency: 'high',
        keyFeatures: ['Age >50', 'Temporal artery tenderness', 'Jaw claudication', 'Visual changes']
      }
    ],
    redFlags: [
      'Thunderclap onset (seconds to peak)',
      'Worst headache of life',
      'Fever with neck stiffness',
      'Focal neurological deficits',
      'Papilledema',
      'Age >50 with new onset',
      'Immunocompromised'
    ],
    recommendedWorkup: [
      'Detailed history and neurological exam',
      'CT head if red flags',
      'LP if SAH suspected with negative CT',
      'ESR/CRP if GCA suspected',
      'Consider MRI if chronic progressive'
    ]
  },
  {
    symptom: 'Shortness of Breath',
    category: 'Respiratory',
    possibleConditions: [
      {
        condition: 'Asthma Exacerbation',
        icdCode: 'J45',
        probability: 0.25,
        urgency: 'moderate',
        keyFeatures: ['Wheezing', 'History of asthma', 'Trigger exposure', 'Cough']
      },
      {
        condition: 'COPD Exacerbation',
        icdCode: 'J44',
        probability: 0.20,
        urgency: 'moderate',
        keyFeatures: ['Smoking history', 'Chronic cough', 'Sputum change', 'Known COPD']
      },
      {
        condition: 'Heart Failure',
        icdCode: 'I50',
        probability: 0.15,
        urgency: 'high',
        keyFeatures: ['Orthopnea', 'PND', 'Edema', 'Fatigue', 'History of cardiac disease']
      },
      {
        condition: 'Pneumonia',
        icdCode: 'J18',
        probability: 0.15,
        urgency: 'moderate',
        keyFeatures: ['Fever', 'Productive cough', 'Pleuritic chest pain', 'Crackles']
      },
      {
        condition: 'Pulmonary Embolism',
        icdCode: 'I26',
        probability: 0.10,
        urgency: 'critical',
        keyFeatures: ['Sudden onset', 'Pleuritic pain', 'Risk factors', 'Tachycardia']
      },
      {
        condition: 'Anxiety/Panic Attack',
        icdCode: 'F41',
        probability: 0.10,
        urgency: 'low',
        keyFeatures: ['Paresthesias', 'Chest tightness', 'Fear', 'History of anxiety']
      }
    ],
    redFlags: [
      'SpO2 <90%',
      'Respiratory rate >30',
      'Inability to speak in sentences',
      'Altered consciousness',
      'Cyanosis',
      'Silent chest in asthmatic',
      'Hypotension'
    ],
    recommendedWorkup: [
      'Pulse oximetry',
      'Chest X-ray',
      'ECG',
      'BNP if HF suspected',
      'D-dimer if low/moderate PE suspicion',
      'CT-PA if high PE suspicion',
      'ABG if severe'
    ]
  }
];

// ============================================================================
// DRUG DATABASE
// ============================================================================

export interface DrugInfo {
  name: string;
  genericName: string;
  drugClass: string;
  indication: string[];
  dosing: {
    adult: string;
    renalAdjustment?: string;
    hepaticAdjustment?: string;
  };
  contraindications: string[];
  majorInteractions: string[];
  commonSideEffects: string[];
  monitoring: string[];
  pregnancyCategory: string;
  blackBoxWarning?: string;
}

export const DRUG_DATABASE: DrugInfo[] = [
  {
    name: 'Lisinopril',
    genericName: 'lisinopril',
    drugClass: 'ACE Inhibitor',
    indication: ['Hypertension', 'Heart Failure', 'Post-MI', 'Diabetic Nephropathy'],
    dosing: {
      adult: 'Hypertension: 10-40mg daily; HF: 5-40mg daily; Post-MI: 5-10mg daily',
      renalAdjustment: 'eGFR 10-30: Start 2.5-5mg; eGFR <10: Avoid if possible'
    },
    contraindications: ['Pregnancy', 'History of angioedema', 'Bilateral renal artery stenosis'],
    majorInteractions: ['Potassium-sparing diuretics', 'NSAIDs', 'Lithium', 'Allopurinol'],
    commonSideEffects: ['Dry cough', 'Hyperkalemia', 'Dizziness', 'Renal impairment'],
    monitoring: ['Serum potassium', 'Serum creatinine', 'BP'],
    pregnancyCategory: 'D',
    blackBoxWarning: 'Do not use in pregnancy - can cause fetal harm'
  },
  {
    name: 'Metformin',
    genericName: 'metformin',
    drugClass: 'Biguanide',
    indication: ['Type 2 Diabetes Mellitus'],
    dosing: {
      adult: 'Start 500mg BID with meals; max 2000mg/day (2550mg extended release)',
      renalAdjustment: 'eGFR 30-45: Reduce dose; eGFR <30: Contraindicated'
    },
    contraindications: ['eGFR <30', 'Acute/decompensated HF', 'Hepatic impairment', 'Alcoholism', 'Metabolic acidosis'],
    majorInteractions: ['Contrast media', 'Cephalexin', 'Cimetidine', 'Furosemide'],
    commonSideEffects: ['GI upset', 'Diarrhea', 'Nausea', 'Lactic acidosis (rare)'],
    monitoring: ['Serum creatinine/eGFR annually', 'HbA1c', 'Vitamin B12 (long-term use)'],
    pregnancyCategory: 'B',
    blackBoxWarning: 'Lactic acidosis risk - discontinue if eGFR <30, acute HF, hypoxia'
  },
  {
    name: 'Atorvastatin',
    genericName: 'atorvastatin',
    drugClass: 'HMG-CoA Reductase Inhibitor (Statin)',
    indication: ['Hyperlipidemia', 'Cardiovascular disease prevention'],
    dosing: {
      adult: '10-80mg daily',
      renalAdjustment: 'No adjustment needed; use caution in severe renal impairment'
    },
    contraindications: ['Active liver disease', 'Pregnancy', 'Breastfeeding'],
    majorInteractions: ['Clarithromycin', 'Itraconazole', 'Cyclosporine', 'Gemfibrozil', 'Grapefruit juice'],
    commonSideEffects: ['Myalgia', 'Elevated LFTs', 'Headache', 'GI upset'],
    monitoring: ['Lipid panel', 'LFTs at baseline and if symptoms', 'CK if muscle symptoms'],
    pregnancyCategory: 'X',
    blackBoxWarning: 'Contraindicated in pregnancy - may cause fetal harm'
  },
  {
    name: 'Amoxicillin',
    genericName: 'amoxicillin',
    drugClass: 'Penicillin Antibiotic',
    indication: ['Bacterial infections', 'Otitis media', 'Sinusitis', 'Pneumonia', 'UTI', 'H. pylori'],
    dosing: {
      adult: '250-500mg TID; Severe: 875mg BID or 1g TID',
      renalAdjustment: 'eGFR 10-30: Extend dosing interval to q12-24h'
    },
    contraindications: ['Penicillin allergy', 'Mononucleosis (risk of rash)'],
    majorInteractions: ['Warfarin', 'Allopurinol', 'Methotrexate', 'Oral contraceptives'],
    commonSideEffects: ['GI upset', 'Diarrhea', 'Rash', 'Allergic reactions'],
    monitoring: ['Renal function', 'Signs of allergic reaction'],
    pregnancyCategory: 'B'
  },
  {
    name: 'Omeprazole',
    genericName: 'omeprazole',
    drugClass: 'Proton Pump Inhibitor',
    indication: ['GERD', 'Peptic ulcer disease', 'H. pylori eradication', 'Zollinger-Ellison'],
    dosing: {
      adult: '20-40mg daily before breakfast',
      hepaticAdjustment: 'Severe liver disease: Consider dose reduction'
    },
    contraindications: ['Hypersensitivity to PPIs'],
    majorInteractions: ['Clopidogrel', 'Methotrexate', 'Digoxin', 'Warfarin', 'Ketoconazole'],
    commonSideEffects: ['Headache', 'GI upset', 'Vitamin B12 deficiency (long-term)', 'Magnesium deficiency'],
    monitoring: ['Magnesium (long-term)', 'Vitamin B12 (long-term)', 'Consider bone density >1 year use'],
    pregnancyCategory: 'C'
  }
];

// ============================================================================
// EXPORT ALL
// ============================================================================

export const MedicalKnowledgeBase = {
  clinicalGuidelines: CLINICAL_GUIDELINES,
  drugInteractions: DRUG_INTERACTIONS,
  icd10Codes: ICD10_CODES,
  labReferences: LAB_REFERENCES,
  symptomMappings: SYMPTOM_MAPPINGS,
  drugDatabase: DRUG_DATABASE,
};

export default MedicalKnowledgeBase;

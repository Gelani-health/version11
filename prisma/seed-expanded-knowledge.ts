import { PrismaClient } from '@prisma/client';
import { db } from '../src/lib/db';

async function main() {
  console.log('Seeding Expanded Medical Knowledge Base for Vector RAG...');

  // ============================================
  // CLINICAL GUIDELINES
  // ============================================
  
  const clinicalGuidelines = [
    {
      title: 'Acute Myocardial Infarction (Heart Attack) Protocol',
      content: `Acute Myocardial Infarction (AMI) Management Protocol:

1. RECOGNITION & DIAGNOSIS:
   - Symptoms: Chest pain (>20 min), diaphoresis, nausea, dyspnea
   - ECG: ST elevation ≥1mm in 2+ contiguous leads OR new LBBB
   - Troponin: Elevated (high-sensitivity preferred)
   - Time is muscle: Door-to-balloon <90 minutes for PCI

2. IMMEDIATE MANAGEMENT (MONA):
   - Morphine: 2-4mg IV for pain (use cautiously)
   - Oxygen: Only if SpO2 <90%
   - Nitroglycerin: 0.4mg SL q5min x3, then IV if needed
   - Aspirin: 162-325mg chewed immediately

3. REPERFUSION THERAPY:
   - Primary PCI: Preferred if available within 120 minutes
   - Fibrinolysis: If PCI not available within 120 minutes
     * Alteplase: 15mg bolus, then 0.75mg/kg over 30min, then 0.5mg/kg over 60min
     * Tenecteplase: Weight-based single bolus
   - Contraindications to fibrinolysis: Prior hemorrhagic stroke, active bleeding, severe hypertension

4. ADJUNCTIVE THERAPY:
   - P2Y12 inhibitor: Ticagrelor 180mg LD, then 90mg BID OR Clopidogrel 600mg LD, then 75mg daily
   - Anticoagulation: Heparin or Bivalirudin during PCI
   - Beta-blocker: Metoprolol 5mg IV q5min x3, then 25-50mg PO q6h
   - ACE inhibitor: Start within 24 hours if no contraindication
   - High-intensity statin: Atorvastatin 80mg daily

5. POST-MI MONITORING:
   - Telemetry for 24-48 hours
   - Daily ECGs
   - Monitor for complications: arrhythmias, heart failure, mechanical complications

6. DISCHARGE MEDICATIONS:
   - Dual antiplatelet therapy (DAPT) for 12 months
   - High-intensity statin lifelong
   - Beta-blocker (3 years minimum)
   - ACE-I/ARB (especially if EF ≤40%)
   - Cardiac rehabilitation referral`,
      summary: 'Comprehensive AMI protocol including recognition criteria, MONA therapy, reperfusion strategies (PCI vs fibrinolysis), adjunctive medications, and discharge planning.',
      category: 'clinical-guideline',
      subcategory: 'cardiovascular',
      specialty: 'cardiology',
      keywords: JSON.stringify(['MI', 'STEMI', 'heart attack', 'PCI', 'fibrinolysis', 'troponin', 'ECG', 'aspirin', 'acute coronary']),
      icdCodes: JSON.stringify(['I21', 'I21.0', 'I21.1', 'I21.2', 'I21.3']),
      drugNames: JSON.stringify(['aspirin', 'morphine', 'nitroglycerin', 'ticagrelor', 'clopidogrel', 'heparin', 'alteplase', 'metoprolol', 'atorvastatin']),
      source: 'AHA/ACC Guidelines',
      evidenceLevel: 'A',
    },
    {
      title: 'Sepsis and Septic Shock Management',
      content: `Sepsis Management Protocol (Sepsis-3):

1. DIAGNOSIS (SOFA Score ≥2):
   - Respiratory: PaO2/FiO2 <400
   - Coagulation: Platelets <150
   - Liver: Bilirubin >2 mg/dL
   - Cardiovascular: MAP <70 or vasopressors
   - CNS: GCS <15
   - Renal: Creatinine >1.2 or UO <500mL/day

2. HOUR-1 BUNDLE (Start Immediately):
   - Measure lactate level
   - Obtain blood cultures BEFORE antibiotics
   - Administer broad-spectrum antibiotics
   - Begin rapid fluid resuscitation (30mL/kg crystalloid for hypotension or lactate ≥4)
   - Apply vasopressors if fluid-refractory hypotension

3. ANTIBIOTIC SELECTION:
   Community-Onset:
   - Ceftriaxone 2g IV q24h + Azithromycin 500mg IV q24h
   - OR Piperacillin-tazobactam 4.5g IV q6h
   
   Hospital-Acquired/High Risk:
   - Vancomycin 25-30mg/kg load, then 15-20mg/kg q8-12h
   - PLUS Piperacillin-tazobactam 4.5g IV q6h
   - OR Meropenem 1g IV q8h
   
   Add antifungal if high risk:
   - Fluconazole 800mg load, then 400mg daily

4. VASOPRESSOR SUPPORT:
   - First line: Norepinephrine (target MAP ≥65)
   - Add Vasopressin 0.03-0.04 units/min if refractory
   - Consider Epinephrine if cardiac dysfunction
   - Avoid dopamine (except selected patients)

5. FLUID MANAGEMENT:
   - Initial: 30mL/kg crystalloid within 3 hours
   - Reassess: CVP, ScvO2, lactate clearance, skin perfusion
   - Dynamic indices: Passive leg raise, stroke volume variation
   - Avoid excessive fluids (associated with harm)

6. SOURCE CONTROL:
   - Identify and control source within 6-12 hours
   - Abscess drainage, infected catheter removal, etc.

7. SUPPORTIVE CARE:
   - Corticosteroids: Hydrocortisone 200mg/day if refractory shock
   - Blood transfusion: Target Hgb >7 g/dL (or >8 if active bleeding)
   - DVT prophylaxis: Heparin 5000 units SC q8-12h
   - Stress ulcer prophylaxis: PPI
   - Glucose control: Target 144-180 mg/dL

8. MONITORING:
   - Lactate clearance (target >10%/hour)
   - ScvO2 ≥70%
   - Urine output >0.5mL/kg/hr
   - Serial SOFA scores`,
      summary: 'Sepsis-3 guidelines including SOFA score diagnosis, Hour-1 bundle, antibiotic selection, vasopressor support, fluid management, source control, and supportive care.',
      category: 'clinical-guideline',
      subcategory: 'critical-care',
      specialty: 'critical-care',
      keywords: JSON.stringify(['sepsis', 'septic shock', 'SOFA', 'lactate', 'vasopressor', 'antibiotic', 'ICU', 'infection', 'hypotension']),
      icdCodes: JSON.stringify(['A41', 'A41.9', 'R65.2', 'R65.21']),
      drugNames: JSON.stringify(['norepinephrine', 'vasopressin', 'ceftriaxone', 'azithromycin', 'piperacillin-tazobactam', 'vancomycin', 'meropenem', 'hydrocortisone']),
      source: 'Surviving Sepsis Campaign',
      evidenceLevel: 'A',
    },
    {
      title: 'Stroke Management Protocol',
      content: `Acute Stroke Management Protocol:

1. STROKE RECOGNITION (FAST):
   - Face drooping
   - Arm weakness
   - Speech difficulty
   - Time to call emergency services
   - NIH Stroke Scale assessment

2. INITIAL ASSESSMENT (<10 min):
   - Airway, breathing, circulation
   - Vital signs, glucose, O2 sat
   - Establish IV access
   - Point-of-care glucose (treat if <60 mg/dL)
   - Stroke onset time (critical for thrombolysis)

3. IMAGING (<25 min):
   - Non-contrast CT head immediately
   - CT angiography if candidate for thrombectomy
   - CT perfusion if extended window consideration

4. ACUTE TREATMENT:

   ISCHEMIC STROKE:
   
   IV Thrombolysis (Alteplase):
   - Window: 0-4.5 hours from onset
   - Dose: 0.9mg/kg (max 90mg)
     * 10% as bolus
     * 90% over 60 minutes
   - Contraindications:
     * Prior intracranial hemorrhage
     * Recent major surgery/trauma (<14 days)
     * Active bleeding
     * BP >185/110 despite treatment
     * Platelets <100,000
     * INR >1.7 or on anticoagulant
     * Glucose <50 or >400 mg/dL
   
   Mechanical Thrombectomy:
   - Window: 0-24 hours in select patients
   - Large vessel occlusion (ICA, MCA M1)
   - ASPECTS score ≥6
   - Favorable perfusion profile
   
   Antiplatelet Therapy:
   - Aspirin 162-325mg within 24-48 hours
   - Dual antiplatelet for minor stroke/TIA: Aspirin + Clopidogrel for 21-90 days

   HEMORRHAGIC STROKE:
   
   Intracerebral Hemorrhage:
   - BP control: Target <140 systolic
   - Reverse anticoagulation:
     * Warfarin: Vitamin K 10mg IV + PCC
     * DOAC: Idarucizumab (dabigatran) or Andexanet alfa (Xa inhibitors)
   - Surgical evacuation if indicated
   
   Subarachnoid Hemorrhage:
   - Secure aneurysm (coiling or clipping)
   - Nimodipine 60mg q4h for 21 days
   - Monitor for vasospasm

5. POST-ACUTE CARE:
   - Stroke unit admission
   - DVT prophylaxis
   - Dysphagia screening before oral intake
   - Early mobilization
   - Rehabilitation assessment
   - Secondary prevention:
     * Antiplatelet/anticoagulation
     * Statin therapy
     * BP control
     * Glucose control`,
      summary: 'Acute stroke protocol including FAST recognition, thrombolysis criteria (alteplase), mechanical thrombectomy windows, hemorrhagic stroke management, and post-acute care.',
      category: 'clinical-guideline',
      subcategory: 'neurological',
      specialty: 'neurology',
      keywords: JSON.stringify(['stroke', 'ischemic', 'hemorrhagic', 'thrombolysis', 'alteplase', 'thrombectomy', 'NIHSS', 'aneurysm', 'FAST']),
      icdCodes: JSON.stringify(['I63', 'I61', 'I60', 'G45']),
      drugNames: JSON.stringify(['alteplase', 'aspirin', 'clopidogrel', 'nimodipine', 'vitamin K', 'warfarin']),
      source: 'AHA/ASA Guidelines',
      evidenceLevel: 'A',
    },
    {
      title: 'Chronic Kidney Disease Management',
      content: `Chronic Kidney Disease (CKD) Management Protocol:

1. CKD STAGING (Based on eGFR):
   - G1: eGFR ≥90 (normal or high) with kidney damage
   - G2: eGFR 60-89 (mildly decreased)
   - G3a: eGFR 45-59 (mild to moderate)
   - G3b: eGFR 30-44 (moderate to severe)
   - G4: eGFR 15-29 (severely decreased)
   - G5: eGFR <15 (kidney failure)

2. MONITORING:
   - Serum creatinine and eGFR every 6-12 months
   - Urine albumin-creatinine ratio annually
   - Blood pressure at each visit
   - Electrolytes (K+, Ca, Phos) every 3-6 months
   - HbA1c if diabetic every 3 months
   - Lipid panel annually

3. BLOOD PRESSURE MANAGEMENT:
   - Target: <130/80 mmHg
   - First line: ACE inhibitor or ARB
     * Lisinopril 10-40mg daily
     * Losartan 50-100mg daily
   - Add: Calcium channel blocker (Amlodipine)
   - Add: Diuretic (Furosemide, not HCTZ if eGFR <30)
   - Avoid: NSAIDs, potassium-sparing diuretics

4. DIABETES MANAGEMENT:
   - Target HbA1c: <7% (individualize)
   - Preferred agents: SGLT2 inhibitors
     * Empagliflozin 10-25mg daily
     * Dapagliflozin 5-10mg daily
     * Benefits: Renoprotection, cardioprotection
   - GLP-1 agonists: Secondary option
   - Avoid: Metformin if eGFR <30

5. HYPERKALEMIA MANAGEMENT:
   - Dietary potassium restriction
   - Discontinue RAAS if K+ >5.5 (or use carefully)
   - Potassium binders:
     * Patiromer 8.4-25.2g daily
     * Sodium zirconium cyclosilicate 10g TID x48h, then maintenance
   - Emergent: Insulin + glucose, albuterol nebulizer, calcium gluconate

6. METABOLIC BONE DISEASE:
   - Target Calcium: Normal range
   - Target Phosphorus: Normal range
   - Target PTH: Stage 3: 35-70 pg/mL, Stage 4: 70-110, Stage 5: 150-300
   - Phosphate binders if needed:
     * Sevelamer 800-1600mg TID with meals
     * Calcium acetate 667mg TID with meals
   - Vitamin D: Ergocalciferol or cholecalciferol
   - Calcitriol if PTH elevated and Ca low-normal

7. ANEMIA MANAGEMENT:
   - Check iron studies, ferritin, TSAT
   - Iron supplementation if TSAT <30% or ferritin <500
   - Erythropoiesis-stimulating agents:
     * Epoetin alfa 50-100 units/kg SC 3x/week
     * Darbepoetin 0.45 mcg/kg SC weekly
   - Target Hgb: 10-12 g/dL

8. DIALYSIS PREPARATION:
   - Referral to nephrology when eGFR <30
   - Vascular access planning when eGFR <20
   - Modality education (HD vs PD)
   - Transplant evaluation when appropriate`,
      summary: 'CKD staging and management including BP targets, RAAS blockade, SGLT2 inhibitors, hyperkalemia treatment, metabolic bone disease, anemia management, and dialysis preparation.',
      category: 'clinical-guideline',
      subcategory: 'nephrology',
      specialty: 'nephrology',
      keywords: JSON.stringify(['CKD', 'kidney disease', 'eGFR', 'dialysis', 'ACE inhibitor', 'SGLT2', 'anemia', 'hyperkalemia', 'nephrology']),
      icdCodes: JSON.stringify(['N18', 'N18.3', 'N18.4', 'N18.5', 'N18.6']),
      drugNames: JSON.stringify(['lisinopril', 'losartan', 'amlodipine', 'empagliflozin', 'dapagliflozin', 'epoetin', 'darbepoetin', 'sevelamer', 'patiromer']),
      source: 'KDIGO Guidelines',
      evidenceLevel: 'A',
    },
    {
      title: 'COPD Exacerbation Management',
      content: `COPD Exacerbation Management Protocol:

1. EXACERBATION SEVERITY ASSESSMENT:
   Mild:
   - Increased dyspnea, sputum, or cough
   - No change in baseline activity
   
   Moderate:
   - Increased symptoms affecting ADLs
   - May need additional treatment
   
   Severe:
   - Significant respiratory distress
   - Changes in mental status
   - Need for ICU care
   - SpO2 <90% on room air

2. OUTPATIENT MANAGEMENT (Mild-Moderate):
   
   Bronchodilators:
   - Short-acting beta-agonist (SABA):
     * Albuterol 2.5mg nebulized q4-6h
     * OR MDI 4-8 puffs q4-6h with spacer
   - Short-acting anticholinergic:
     * Ipratropium 0.5mg nebulized q6-8h
   
   Corticosteroids:
   - Prednisone 40mg PO daily x5 days
   - OR Dexamethasone 6mg PO daily x5 days
   (Shorter courses now recommended)
   
   Antibiotics (if purulent sputum):
   - Amoxicillin 500mg TID x5 days
   - OR Doxycycline 100mg BID x5 days
   - OR Azithromycin 500mg day 1, then 250mg x4 days

3. INPATIENT MANAGEMENT (Moderate-Severe):
   
   Oxygen Therapy:
   - Target SpO2 88-92% (avoid hyperoxia)
   - High-flow nasal cannula if needed
   - NIV for respiratory acidosis
   
   Bronchodilators:
   - Albuterol 2.5-5mg nebulized q1-4h
   - Ipratropium 0.5mg nebulized q4-6h
   - Combination nebulizer treatments
   
   Systemic Corticosteroids:
   - Methylprednisolone 40-60mg IV q12h
   - OR Prednisone 40-60mg PO daily
   - Duration: 5-7 days
   
   Antibiotics:
   - Ampicillin-sulbactam 3g IV q6h
   - OR Ceftriaxone 1g IV daily
   - OR Moxifloxacin 400mg PO/IV daily
   - Add coverage for Pseudomonas if risk factors:
     * Piperacillin-tazobactam 4.5g IV q6h
     * OR Cefepime 2g IV q8h
   
   Non-Invasive Ventilation:
   - Indications: pH <7.35, pCO2 >45, respiratory distress
   - Settings: IPAP 10-20, EPAP 4-6
   - Contraindications: Altered mental status, inability to protect airway

4. ICU MANAGEMENT:
   - Mechanical ventilation if NIV fails
   - Lung-protective ventilation strategy
   - Daily spontaneous breathing trials
   - Early mobilization

5. DISCHARGE CRITERIA:
   - SpO2 stable on room air or baseline O2
   - Ability to ambulate and perform ADLs
   - Tolerating oral intake
   - Stable respiratory status for 12-24h

6. FOLLOW-UP:
   - Smoking cessation counseling
   - Pulmonary rehabilitation referral
   - Medication reconciliation
   - Inhaler technique review
   - Follow-up appointment 7-14 days`,
      summary: 'COPD exacerbation management including severity assessment, outpatient and inpatient treatment, bronchodilators, corticosteroids, antibiotics, NIV criteria, and discharge planning.',
      category: 'clinical-guideline',
      subcategory: 'respiratory',
      specialty: 'pulmonology',
      keywords: JSON.stringify(['COPD', 'exacerbation', 'bronchodilator', 'steroid', 'antibiotic', 'NIV', 'biPAP', 'respiratory', 'dyspnea']),
      icdCodes: JSON.stringify(['J44', 'J44.1', 'J44.0']),
      drugNames: JSON.stringify(['albuterol', 'ipratropium', 'prednisone', 'dexamethasone', 'amoxicillin', 'doxycycline', 'azithromycin', 'ceftriaxone', 'moxifloxacin']),
      source: 'GOLD Guidelines',
      evidenceLevel: 'A',
    },
  ];

  // ============================================
  // LAB INTERPRETATION GUIDES
  // ============================================
  
  const labInterpretation = [
    {
      title: 'Liver Function Tests (LFTs) Interpretation',
      content: `Liver Function Tests Interpretation Guide:

1. HEPATOCELLULAR PATTERN (AST/ALT Predominant):
   - AST/ALT elevated > ALT (ratio >2:1):
     * Alcoholic liver disease
     * Cirrhosis
   - ALT > AST:
     * Viral hepatitis
     * Non-alcoholic fatty liver disease (NAFLD)
   - Marked elevation (>1000):
     * Acute viral hepatitis
     * Ischemic hepatitis ("shock liver")
     * Drug-induced liver injury (acetaminophen)

2. CHOLESTATIC PATTERN (Bilirubin/ALP Predominant):
   - Elevated ALP + GGT:
     * Biliary obstruction
     * Primary biliary cholangitis
     * Primary sclerosing cholangitis
   - Elevated ALP with normal GGT:
     * Bone disease
     * Pregnancy

3. BILIRUBIN:
   - Unconjugated (indirect) elevated:
     * Hemolysis
     * Gilbert syndrome
     * Crigler-Najjar syndrome
   - Conjugated (direct) elevated:
     * Biliary obstruction
     * Hepatocellular damage
     * Dubin-Johnson syndrome

4. ALBUMIN & PT/INR:
   - Low albumin: Chronic liver disease, malnutrition
   - Prolonged PT/INR: Synthetic function impairment
   - Not corrected by vitamin K = liver failure

5. SPECIFIC CONDITIONS:
   
   Acute Hepatitis:
   - AST/ALT: 500-5000 U/L
   - Bilirubin: Variable
   - ALP: Mild elevation
   
   Alcoholic Hepatitis:
   - AST: 100-300 U/L
   - ALT: Normal to mildly elevated
   - AST/ALT ratio >2:1
   - GGT elevated
   
   NAFLD:
   - AST/ALT: 2-5x normal
   - ALT > AST
   - Normal or mildly elevated ALP
   
   Cirrhosis:
   - AST/ALT: Normal to mildly elevated
   - Low albumin, prolonged PT
   - Thrombocytopenia
   
   Biliary Obstruction:
   - ALP: 3-10x normal
   - Bilirubin: Elevated, predominantly direct
   - GGT elevated

6. WORKUP APPROACH:
   - Hepatocellular: Viral serologies, autoimmune markers, ultrasound
   - Cholestatic: Imaging (US, MRCP), AMA/ANA
   - Mixed: Comprehensive evaluation`,
      summary: 'LFT interpretation guide covering hepatocellular vs cholestatic patterns, bilirubin analysis, specific conditions (hepatitis, cirrhosis, NAFLD), and diagnostic approach.',
      category: 'lab-interpretation',
      subcategory: 'hepatology',
      specialty: 'gastroenterology',
      keywords: JSON.stringify(['LFT', 'liver', 'AST', 'ALT', 'bilirubin', 'ALP', 'hepatitis', 'cirrhosis', 'cholestasis', 'GGT']),
      icdCodes: JSON.stringify(['R74', 'K76', 'K71', 'K74']),
      source: 'Clinical Chemistry',
      evidenceLevel: 'B',
    },
    {
      title: 'Thyroid Function Tests Interpretation',
      content: `Thyroid Function Tests Interpretation Guide:

1. TEST INTERPRETATION:
   
   TSH (Thyroid Stimulating Hormone):
   - Normal: 0.4-4.0 mIU/L
   - Elevated: Primary hypothyroidism
   - Low: Hyperthyroidism or secondary hypothyroidism
   
   Free T4:
   - Normal: 0.8-1.8 ng/dL
   - Reflects active thyroid hormone
   
   Free T3:
   - Normal: 2.0-4.4 pg/mL
   - Useful in hyperthyroidism

2. CLINICAL PATTERNS:
   
   PRIMARY HYPOTHYROIDISM:
   - TSH: High (>10 mIU/L)
   - Free T4: Low
   - Causes: Hashimoto's, post-thyroidectomy, medications
   - Treatment: Levothyroxine (dose by weight ~1.6 mcg/kg)
   
   SUBCLINICAL HYPOTHYROIDISM:
   - TSH: Elevated (5-10 mIU/L)
   - Free T4: Normal
   - Treat if TSH >10, symptomatic, or pregnant
   
   PRIMARY HYPERTHYROIDISM:
   - TSH: Low/Suppressed (<0.1 mIU/L)
   - Free T4: High
   - Free T3: Often high
   - Causes: Graves disease, toxic nodule, thyroiditis
   
   SUBCLINICAL HYPERTHYROIDISM:
   - TSH: Low (0.1-0.4 mIU/L)
   - Free T4: Normal
   - Monitor, treat if persistent or risk factors
   
   SECONDARY HYPOTHYROIDISM:
   - TSH: Low or inappropriately normal
   - Free T4: Low
   - Causes: Pituitary disease
   - Requires pituitary workup
   
   SICK EUTHYROID SYNDROME:
   - TSH: Variable (often low)
   - Free T4: Normal or low
   - Free T3: Low
   - Reverse T3: Elevated
   - Treat underlying illness, not thyroid

3. SPECIFIC CONDITIONS:
   
   GRAVES DISEASE:
   - TSH receptor antibody (TRAb): Positive
   - TSI: Positive
   - Diffuse goiter, ophthalmopathy
   
   HASHIMOTO THYROIDITIS:
   - Anti-TPO antibody: Positive
   - Anti-thyroglobulin: Often positive
   - Gradual progression to hypothyroidism
   
   THYROID NODULE:
   - Check TSH first
   - If abnormal, do thyroid scan
   - If normal, do ultrasound-guided FNA
   
   PREGNANCY:
   - TSH reference different by trimester
   - First trimester: 0.1-2.5 mIU/L
   - Second trimester: 0.2-3.0 mIU/L
   - Third trimester: 0.3-3.5 mIU/L

4. MEDICATIONS AFFECTING THYROID:
   - Amiodarone: Can cause hypo or hyper
   - Lithium: Hypothyroidism
   - Levothyroxine: Inappropriate dosing
   - PTU/Methimazole: Hypothyroidism`,
      summary: 'Thyroid function test interpretation including TSH, Free T4, Free T3 patterns, clinical conditions (hypothyroidism, hyperthyroidism, Graves, Hashimoto), pregnancy considerations, and medication effects.',
      category: 'lab-interpretation',
      subcategory: 'endocrine',
      specialty: 'endocrinology',
      keywords: JSON.stringify(['thyroid', 'TSH', 'T4', 'T3', 'hypothyroidism', 'hyperthyroidism', 'Graves', 'Hashimoto', 'levothyroxine']),
      icdCodes: JSON.stringify(['E03', 'E05', 'E06', 'E07']),
      drugNames: JSON.stringify(['levothyroxine', 'methimazole', 'PTU', 'amiodarone', 'lithium']),
      source: 'ATA Guidelines',
      evidenceLevel: 'A',
    },
  ];

  // ============================================
  // ADDITIONAL DRUG INTERACTIONS
  // ============================================
  
  const additionalDrugInteractions = [
    {
      drug1Name: 'Metformin',
      drug1Generic: 'metformin',
      drug2Name: 'Iodinated Contrast',
      drug2Generic: 'iodinated contrast',
      severity: 'major',
      mechanism: 'pharmacokinetic',
      description: 'Iodinated contrast media can cause acute kidney injury, which increases the risk of lactic acidosis in patients taking metformin.',
      clinicalEffects: JSON.stringify(['Lactic acidosis', 'Acute kidney injury', 'Metabolic acidosis']),
      management: 'Hold metformin at the time of or prior to contrast administration. Restart metformin after 48 hours if renal function is stable. Check creatinine before restarting.',
      evidenceLevel: 'B',
      onset: 'rapid',
    },
    {
      drug1Name: 'Sildenafil',
      drug1Generic: 'sildenafil',
      drug2Name: 'Nitroglycerin',
      drug2Generic: 'nitroglycerin',
      severity: 'contraindicated',
      mechanism: 'pharmacodynamic',
      description: 'Concurrent use of PDE5 inhibitors (sildenafil) with nitrates causes severe potentiation of vasodilation leading to profound hypotension, myocardial infarction, and potential death.',
      clinicalEffects: JSON.stringify(['Severe hypotension', 'Myocardial infarction', 'Syncope', 'Death']),
      management: 'CONTRAINDICATED. Do not use together. Wait at least 24 hours after sildenafil before using nitrates. For patients needing nitrates, do not prescribe PDE5 inhibitors.',
      evidenceLevel: 'A',
      onset: 'rapid',
    },
    {
      drug1Name: 'Fluoroquinolone',
      drug1Generic: 'ciprofloxacin',
      drug2Name: 'QT-Prolonging Agents',
      drug2Generic: 'ondansetron',
      severity: 'major',
      mechanism: 'pharmacodynamic',
      description: 'Fluoroquinolones can prolong the QT interval. Concurrent use with other QT-prolonging drugs increases the risk of torsades de pointes.',
      clinicalEffects: JSON.stringify(['QT prolongation', 'Torsades de pointes', 'Sudden cardiac death', 'Arrhythmias']),
      management: 'Avoid combination if possible. If used together, obtain baseline ECG and monitor for QT prolongation. Correct electrolyte abnormalities (K+, Mg2+). Consider alternative antibiotics.',
      evidenceLevel: 'A',
      onset: 'rapid',
    },
    {
      drug1Name: 'SSRI',
      drug1Generic: 'sertraline',
      drug2Name: 'MAOI',
      drug2Generic: 'phenelzine',
      severity: 'contraindicated',
      mechanism: 'pharmacodynamic',
      description: 'Combining SSRIs with MAOIs can cause serotonin syndrome, a potentially life-threatening condition due to excessive serotonergic activity.',
      clinicalEffects: JSON.stringify(['Serotonin syndrome', 'Hyperthermia', 'Rigidity', 'Altered mental status', 'Autonomic instability']),
      management: 'CONTRAINDICATED. Wait at least 14 days after stopping an MAOI before starting an SSRI. Wait at least 5 weeks after stopping fluoxetine (long half-life) before starting an MAOI.',
      evidenceLevel: 'A',
      onset: 'rapid',
    },
    {
      drug1Name: 'Potassium',
      drug1Generic: 'potassium chloride',
      drug2Name: 'ACE Inhibitor',
      drug2Generic: 'lisinopril',
      severity: 'major',
      mechanism: 'pharmacodynamic',
      description: 'ACE inhibitors reduce aldosterone secretion, decreasing potassium excretion. Adding potassium supplements can cause dangerous hyperkalemia.',
      clinicalEffects: JSON.stringify(['Hyperkalemia', 'Cardiac arrhythmias', 'Muscle weakness', 'ECG changes']),
      management: 'Monitor serum potassium closely. Avoid routine potassium supplementation with ACE inhibitors. If needed, use low doses and monitor frequently. Consider potassium binders if persistent hyperkalemia.',
      evidenceLevel: 'A',
      onset: 'delayed',
    },
  ];

  // ============================================
  // SYMPTOM-CONDITION MAPPINGS
  // ============================================
  
  const additionalSymptomMappings = [
    {
      symptomName: 'Dyspnea',
      symptomCategory: 'respiratory',
      conditions: JSON.stringify([
        { condition: 'Congestive Heart Failure', icdCode: 'I50', probability: 0.20, urgency: 'high' },
        { condition: 'COPD Exacerbation', icdCode: 'J44', probability: 0.18, urgency: 'moderate' },
        { condition: 'Pneumonia', icdCode: 'J18', probability: 0.15, urgency: 'moderate' },
        { condition: 'Asthma Exacerbation', icdCode: 'J45', probability: 0.12, urgency: 'moderate' },
        { condition: 'Pulmonary Embolism', icdCode: 'I26', probability: 0.10, urgency: 'critical' },
        { condition: 'Anxiety/Panic Attack', icdCode: 'F41', probability: 0.10, urgency: 'low' },
        { condition: 'Cardiac Tamponade', icdCode: 'I31', probability: 0.03, urgency: 'critical' },
        { condition: 'Pneumothorax', icdCode: 'J93', probability: 0.05, urgency: 'high' },
        { condition: 'Anemia', icdCode: 'D50', probability: 0.07, urgency: 'low' },
      ]),
      riskFactors: JSON.stringify(['smoking', 'heart disease', 'COPD', 'immobilization', 'malignancy', 'recent surgery', 'obesity']),
    },
    {
      symptomName: 'Syncope',
      symptomCategory: 'neurological',
      conditions: JSON.stringify([
        { condition: 'Vasovagal Syncope', icdCode: 'R55', probability: 0.30, urgency: 'low' },
        { condition: 'Cardiac Arrhythmia', icdCode: 'I47', probability: 0.15, urgency: 'high' },
        { condition: 'Orthostatic Hypotension', icdCode: 'I95', probability: 0.15, urgency: 'low' },
        { condition: 'Aortic Stenosis', icdCode: 'I35', probability: 0.08, urgency: 'moderate' },
        { condition: 'Pulmonary Embolism', icdCode: 'I26', probability: 0.05, urgency: 'critical' },
        { condition: 'Seizure', icdCode: 'G40', probability: 0.10, urgency: 'moderate' },
        { condition: 'Stroke/TIA', icdCode: 'I63', probability: 0.05, urgency: 'critical' },
        { condition: 'Hypoglycemia', icdCode: 'E16', probability: 0.07, urgency: 'moderate' },
        { condition: 'Cardiomyopathy', icdCode: 'I42', probability: 0.05, urgency: 'high' },
      ]),
      riskFactors: JSON.stringify(['cardiac history', 'family history sudden death', 'medications', 'dehydration', 'elderly', 'diabetes']),
    },
    {
      symptomName: 'Fatigue',
      symptomCategory: 'constitutional',
      conditions: JSON.stringify([
        { condition: 'Depression', icdCode: 'F32', probability: 0.20, urgency: 'low' },
        { condition: 'Anemia', icdCode: 'D50', probability: 0.15, urgency: 'low' },
        { condition: 'Hypothyroidism', icdCode: 'E03', probability: 0.10, urgency: 'low' },
        { condition: 'Diabetes Mellitus', icdCode: 'E11', probability: 0.10, urgency: 'low' },
        { condition: 'Chronic Fatigue Syndrome', icdCode: 'G93', probability: 0.08, urgency: 'low' },
        { condition: 'Heart Failure', icdCode: 'I50', probability: 0.08, urgency: 'moderate' },
        { condition: 'Sleep Apnea', icdCode: 'G47', probability: 0.10, urgency: 'low' },
        { condition: 'Malignancy', icdCode: 'C80', probability: 0.05, urgency: 'high' },
        { condition: 'Chronic Kidney Disease', icdCode: 'N18', probability: 0.07, urgency: 'moderate' },
        { condition: 'Infection', icdCode: 'A41', probability: 0.07, urgency: 'moderate' },
      ]),
      riskFactors: JSON.stringify(['female gender', 'elderly', 'chronic illness', 'medications', 'poor sleep', 'psychiatric history']),
    },
  ];

  // Insert all data
  console.log('Creating HealthcareKnowledge entries...');
  for (const knowledge of clinicalGuidelines) {
    await db.healthcareKnowledge.create({ data: knowledge });
  }
  
  console.log('Creating Lab Interpretation entries...');
  for (const lab of labInterpretation) {
    await db.healthcareKnowledge.create({ data: lab });
  }
  
  console.log('Creating additional Drug Interactions...');
  for (const interaction of additionalDrugInteractions) {
    await db.drugInteractionKnowledge.create({ data: interaction });
  }
  
  console.log('Creating additional Symptom Mappings...');
  for (const mapping of additionalSymptomMappings) {
    await db.symptomConditionMapping.create({ data: mapping });
  }

  console.log('Expanded Medical Knowledge Base seeded successfully!');
  console.log(`- ${clinicalGuidelines.length + labInterpretation.length} HealthcareKnowledge entries`);
  console.log(`- ${additionalDrugInteractions.length} additional DrugInteractionKnowledge entries`);
  console.log(`- ${additionalSymptomMappings.length} additional SymptomConditionMapping entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Connection is managed by db module
  });

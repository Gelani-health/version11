import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding RAG Healthcare Knowledge Base...');

  // Seed Healthcare Knowledge
  const knowledgeData = [
    // Clinical Guidelines
    {
      title: 'Hypertension Management Guidelines',
      content: `Hypertension Management Protocol:

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
   - Thiazide diuretics (e.g., hydrochlorothiazide 12.5-25mg daily)
   - ACE inhibitors (e.g., lisinopril 10-40mg daily)
   - ARBs (e.g., losartan 50-100mg daily)
   - Calcium channel blockers (e.g., amlodipine 5-10mg daily)

4. LIFESTYLE MODIFICATIONS:
   - DASH diet (Dietary Approaches to Stop Hypertension)
   - Sodium restriction (<2300mg/day, ideally <1500mg/day)
   - Regular aerobic exercise (150 min/week)
   - Weight reduction if BMI >25
   - Limit alcohol (<2 drinks/day men, <1 drink/day women)

5. TARGETS:
   - General population: <140/90 mmHg
   - Diabetes/CKD: <130/80 mmHg
   - Elderly (>65): <150/90 mmHg (consider <140/90 if tolerated)`,
      summary: 'Guidelines for diagnosis and management of hypertension including BP classification, first-line medications, lifestyle modifications, and treatment targets.',
      category: 'clinical-guideline',
      subcategory: 'cardiovascular',
      specialty: 'cardiology',
      keywords: JSON.stringify(['hypertension', 'blood pressure', 'ACE inhibitor', 'antihypertensive', 'DASH diet', 'cardiovascular']),
      icdCodes: JSON.stringify(['I10', 'I11', 'I12', 'I13', 'I15']),
      source: 'WHO/ISH Guidelines',
      evidenceLevel: 'A',
    },
    {
      title: 'Type 2 Diabetes Management Protocol',
      content: `Type 2 Diabetes Mellitus Management:

1. DIAGNOSTIC CRITERIA:
   - Fasting glucose ≥126 mg/dL (7.0 mmol/L)
   - 2-hour glucose ≥200 mg/dL (11.1 mmol/L) during OGTT
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
   - SGLT2 inhibitors (empagliflozin, dapagliflozin)
   - GLP-1 receptor agonists (semaglutide, liraglutide)
   - DPP-4 inhibitors (sitagliptin, linagliptin)
   - Sulfonylureas (glimepiride, glipizide)
   - Insulin therapy when needed

5. MONITORING:
   - HbA1c every 3 months (quarterly)
   - Annual comprehensive metabolic panel
   - Annual lipid panel
   - Annual urine albumin-creatinine ratio
   - Annual dilated eye exam
   - Annual foot exam

6. CARDIOVASCULAR RISK MANAGEMENT:
   - Statin therapy for most patients
   - BP target <130/80 mmHg
   - Aspirin for high-risk patients`,
      summary: 'Comprehensive type 2 diabetes management including diagnostic criteria, glycemic targets, medication therapy, monitoring schedule, and cardiovascular risk management.',
      category: 'clinical-guideline',
      subcategory: 'endocrine',
      specialty: 'endocrinology',
      keywords: JSON.stringify(['diabetes', 'metformin', 'HbA1c', 'glucose', 'SGLT2', 'GLP-1', 'insulin', 'glycemic']),
      icdCodes: JSON.stringify(['E11', 'E11.9', 'E11.65', 'E11.69']),
      drugNames: JSON.stringify(['metformin', 'empagliflozin', 'dapagliflozin', 'semaglutide', 'liraglutide', 'sitagliptin', 'glimepiride', 'insulin']),
      source: 'ADA Standards of Care',
      evidenceLevel: 'A',
    },
    {
      title: 'Community-Acquired Pneumonia Treatment',
      content: `Community-Acquired Pneumonia (CAP) Treatment Guidelines:

1. DIAGNOSIS:
   - Clinical: fever, cough, dyspnea, chest pain
   - Chest X-ray: new infiltrate
   - CURB-65 severity assessment

2. CURB-65 SCORING:
   - Confusion (new onset)
   - Urea >7 mmol/L
   - Respiratory rate ≥30/min
   - Blood pressure <90/60 mmHg
   - Age ≥65 years
   - Score 0-1: outpatient, 2: hospitalize, 3-5: ICU consider

3. OUTPATIENT TREATMENT (Healthy):
   - Amoxicillin 1g TID OR
   - Doxycycline 100mg BID OR
   - Macrolide (azithromycin 500mg day 1, then 250mg daily x4 days)

4. OUTPATIENT TREATMENT (Comorbidities):
   - Amoxicillin-clavulanate + macrolide OR
   - Respiratory fluoroquinolone (levofloxacin 750mg daily)
   - Consider: cefpodoxime + macrolide

5. INPATIENT TREATMENT (Non-ICU):
   - Ceftriaxone 1g IV daily + azithromycin OR
   - Respiratory fluoroquinolone
   - Ampicillin-sulbactam + macrolide

6. DURATION:
   - Minimum 5 days
   - Afebrile for 48-72 hours before stopping
   - Longer courses for complications

7. FOLLOW-UP:
   - Repeat chest X-ray in 6-8 weeks for age >50 or smokers`,
      summary: 'CAP treatment guidelines including CURB-65 severity scoring, antibiotic selection for outpatient and inpatient settings, treatment duration, and follow-up recommendations.',
      category: 'clinical-guideline',
      subcategory: 'respiratory',
      specialty: 'pulmonology',
      keywords: JSON.stringify(['pneumonia', 'CAP', 'CURB-65', 'antibiotic', 'chest X-ray', 'respiratory', 'amoxicillin', 'azithromycin']),
      icdCodes: JSON.stringify(['J18.1', 'J18.9']),
      drugNames: JSON.stringify(['amoxicillin', 'doxycycline', 'azithromycin', 'amoxicillin-clavulanate', 'levofloxacin', 'ceftriaxone']),
      source: 'IDSA/ATS Guidelines',
      evidenceLevel: 'A',
    },
    // Drug Interactions
    {
      title: 'Warfarin Drug Interactions',
      content: `Warfarin Drug Interactions - Critical Knowledge:

MAJOR INTERACTIONS (AVOID or CLOSE MONITORING):

1. ANTIBIOTICS:
   - Fluoroquinolones (ciprofloxacin, levofloxacin): ↑ INR significantly
   - Macrolides (azithromycin, clarithromycin): ↑ INR
   - Metronidazole: Potent inhibitor, ↑ INR
   - Trimethoprim-sulfamethoxazole: ↑ INR
   - Action: Check INR in 3-5 days, reduce warfarin dose 25-50%

2. ANTIFUNGALS:
   - Fluconazole: ↑ INR up to 2-fold
   - Itraconazole, ketoconazole: ↑ INR
   - Action: Avoid combination or reduce warfarin 50%

3. NSAIDs:
   - All NSAIDs increase bleeding risk
   - Selective COX-2 inhibitors safer but still risky
   - Action: Avoid if possible, use acetaminophen

4. SSRIs/SNRIs:
   - Fluoxetine, fluvoxamine, paroxetine: ↑ bleeding risk
   - Sertraline, citalopram: moderate risk
   - Action: Monitor for bleeding, consider INR check

5. AMIODARONE:
   - Potent inhibitor, effect lasts months
   - Action: Reduce warfarin 30-50%, monitor closely

6. HERBAL PRODUCTS:
   - Garlic, ginkgo, ginseng: ↑ bleeding
   - St. John's Wort: ↓ INR (reduced effect)
   - Action: Avoid all herbal supplements

MONITORING:
- Check INR 3-5 days after starting/stopping interacting drug
- More frequent monitoring during therapy
- Patient education on bleeding signs`,
      summary: 'Critical warfarin drug interactions including antibiotics, antifungals, NSAIDs, SSRIs, and monitoring recommendations.',
      category: 'drug-interaction',
      subcategory: 'anticoagulant',
      specialty: 'pharmacology',
      keywords: JSON.stringify(['warfarin', 'INR', 'bleeding', 'antibiotic', 'NSAID', 'interaction', 'anticoagulant']),
      drugNames: JSON.stringify(['warfarin', 'ciprofloxacin', 'azithromycin', 'metronidazole', 'fluconazole', 'amiodarone', 'fluoxetine']),
      source: 'Clinical Pharmacology Database',
      evidenceLevel: 'A',
    },
    {
      title: 'ACE Inhibitor Drug Interactions and Contraindications',
      content: `ACE Inhibitor Interactions and Precautions:

CONTRAINDICATIONS:
1. Pregnancy - teratogenic (Category D)
2. History of angioedema
3. Bilateral renal artery stenosis
4. Hyperkalemia (>5.5 mEq/L)

MAJOR DRUG INTERACTIONS:

1. POTASSIUM-SPARING AGENTS:
   - Spironolactone, eplerenone, triamterene
   - Risk: Hyperkalemia
   - Action: Monitor potassium closely

2. POTASSIUM SUPPLEMENTS:
   - Risk: Severe hyperkalemia
   - Action: Avoid or monitor K+ weekly

3. NSAIDs:
   - Reduced antihypertensive effect
   - Risk of acute kidney injury
   - Action: Use lowest dose, monitor BP and renal function

4. DIURETICS:
   - First-dose hypotension risk
   - Action: Hold diuretic 24-48 hours before starting ACE-I

5. LITHIUM:
   - Increased lithium levels (toxicity risk)
   - Action: Monitor lithium levels, reduce dose

6. ALLOPURINOL:
   - Increased risk of hypersensitivity
   - Action: Monitor for rash, discontinue if occurs

SIDE EFFECTS TO MONITOR:
- Dry cough (10-20%) - consider ARB switch
- Hyperkalemia - check K+ in 1-2 weeks
- Angioedema - rare but life-threatening
- Renal impairment - check creatinine baseline and 1-2 weeks

DOSING NOTES:
- Start low (e.g., lisinopril 5-10mg)
- Titrate to target dose over 2-4 weeks
- Check renal function and K+ 1-2 weeks after dose changes`,
      summary: 'ACE inhibitor contraindications, major drug interactions including potassium-sparing agents and NSAIDs, and monitoring parameters.',
      category: 'drug-interaction',
      subcategory: 'cardiovascular',
      specialty: 'cardiology',
      keywords: JSON.stringify(['ACE inhibitor', 'lisinopril', 'hyperkalemia', 'potassium', 'NSAID', 'pregnancy', 'angioedema']),
      drugNames: JSON.stringify(['lisinopril', 'enalapril', 'ramipril', 'captopril', 'spironolactone', 'lithium', 'allopurinol']),
      icdCodes: JSON.stringify(['I10', 'I25']),
      source: 'Drug Information Database',
      evidenceLevel: 'A',
    },
    // Symptom-Condition Mappings
    {
      title: 'Chest Pain Differential Diagnosis',
      content: `Chest Pain Differential Diagnosis Guide:

CARDIAC CAUSES (URGENT):
1. Acute Coronary Syndrome (ACS)
   - Symptoms: Pressure, squeezing, radiation to arm/jaw
   - Associated: Diaphoresis, dyspnea, nausea
   - ECG: ST changes, T-wave inversions
   - Urgency: EMERGENT

2. Stable Angina
   - Symptoms: Exertional, relieved by rest/nitroglycerin
   - Duration: 2-10 minutes
   - Urgency: Urgent evaluation

3. Pericarditis
   - Symptoms: Sharp, pleuritic, worse lying flat
   - Relief: Sitting forward
   - ECG: Diffuse ST elevation, PR depression

RESPIRATORY CAUSES:
1. Pulmonary Embolism
   - Risk factors: DVT, immobility, surgery, cancer
   - Symptoms: Sudden dyspnea, pleuritic pain
   - Workup: D-dimer, CT-PA, Wells score

2. Pneumothorax
   - Symptoms: Sudden sharp pain, dyspnea
   - Signs: Decreased breath sounds, hyperresonance

3. Pneumonia
   - Symptoms: Fever, productive cough, pleuritic pain
   - Signs: Crackles, egophony

GASTROINTESTINAL:
1. GERD/Esophageal Spasm
   - Symptoms: Burning, retrosternal
   - Relief: Antacids, nitrates (can mimic cardiac)

2. Peptic Ulcer Disease
   - Epigastric, related to meals

MUSCULOSKELETAL:
1. Costochondritis
   - Reproducible with palpation
   - Sharp, localized

2. Muscle Strain
   - History of exertion/coughing

RED FLAGS - EMERGENT:
- New central chest pain at rest
- Pain with exertion in high-risk patient
- Associated dyspnea, diaphoresis
- Syncope or near-syncope
- Known CAD, diabetes, or high risk`,
      summary: 'Comprehensive differential diagnosis for chest pain including cardiac, respiratory, GI, and musculoskeletal causes with red flags for emergent evaluation.',
      category: 'symptom',
      subcategory: 'cardiovascular',
      specialty: 'emergency',
      keywords: JSON.stringify(['chest pain', 'ACS', 'MI', 'pulmonary embolism', 'angina', 'pericarditis', 'GERD', 'costochondritis']),
      icdCodes: JSON.stringify(['R07.9', 'I21', 'I20', 'I26', 'K21']),
      source: 'Emergency Medicine Guidelines',
      evidenceLevel: 'B',
    },
    {
      title: 'Headache Differential Diagnosis',
      content: `Headache Differential Diagnosis:

PRIMARY HEADACHES:
1. Migraine
   - Unilateral, pulsating, 4-72 hours
   - Associated: Nausea, photophobia, phonophobia
   - Aura in 25% (visual, sensory)
   - ICHD-3 criteria for diagnosis

2. Tension-Type Headache
   - Bilateral, pressing/tightening
   - Mild to moderate intensity
   - No nausea, no more than one of photophobia/phonophobia
   - Duration: 30 min to 7 days

3. Cluster Headache
   - Severe unilateral orbital/temporal
   - Duration: 15-180 minutes
   - Associated: Lacrimation, nasal congestion, ptosis
   - Pattern: Clusters, same time daily

SECONDARY HEADACHES (RED FLAGS):
1. Subarachnoid Hemorrhage
   - "Thunderclap" onset (seconds to max)
   - Worst headache of life
   - Associated: Neck stiffness, altered consciousness
   - URGENT: CT head, LP if CT negative

2. Meningitis
   - Fever, neck stiffness, photophobia
   - Altered mental status
   - URGENT: LP after CT if signs of increased ICP

3. Increased Intracranial Pressure
   - Worse with Valsalva, lying flat
   - Morning headaches
   - Papilledema on exam

4. Giant Cell Arteritis (Temporal Arteritis)
   - Age >50
   - Temporal artery tenderness
   - Jaw claudication, visual symptoms
   - ESR/CRP elevated
   - URGENT: High-dose steroids, biopsy

5. Carbon Monoxide Poisoning
   - Multiple household members affected
   - Winter months, faulty heating

SNOOP4 RED FLAGS:
- Systemic symptoms (fever, weight loss)
- Neurologic symptoms (weakness, confusion)
- Onset sudden (thunderclap)
- Older age (>50 new onset)
- Pattern change (new/worse)
- Positional, precipitated by Valsalva
- Papilledema
- Previous history (change from baseline)`,
      summary: 'Headache differential including primary (migraine, tension, cluster) and secondary causes with SNOOP4 red flags for emergent evaluation.',
      category: 'symptom',
      subcategory: 'neurological',
      specialty: 'neurology',
      keywords: JSON.stringify(['headache', 'migraine', 'tension', 'cluster', 'subarachnoid', 'meningitis', 'thunderclap', 'SNOOP4']),
      icdCodes: JSON.stringify(['R51', 'G43', 'G44', 'I60', 'G00']),
      source: 'Neurology Guidelines',
      evidenceLevel: 'B',
    },
    // Lab Interpretation
    {
      title: 'Complete Blood Count (CBC) Interpretation',
      content: `CBC Interpretation Guide:

RED BLOOD CELLS:
1. Hemoglobin (Hgb)
   - Male: 13.5-17.5 g/dL
   - Female: 12.0-16.0 g/dL
   - Low: Anemia workup (iron studies, B12, folate, reticulocyte count)
   - High: Polycythemia (dehydration, smoking, altitude, polycythemia vera)

2. Hematocrit (Hct)
   - Male: 38-50%
   - Female: 36-44%

3. MCV (Mean Corpuscular Volume)
   - Normal: 80-100 fL
   - Low (<80): Microcytic - iron deficiency, thalassemia, anemia of chronic disease
   - High (>100): Macrocytic - B12/folate deficiency, alcohol, hypothyroidism, medications

4. RDW (Red Cell Distribution Width)
   - High in iron deficiency, normal in thalassemia

WHITE BLOOD CELLS:
1. Total WBC: 4,500-11,000/μL
   - High: Infection, inflammation, leukemia, steroids, stress
   - Low: Viral infection, bone marrow suppression, autoimmune

2. Differential:
   - Neutrophils (55-70%): Bacterial infection (left shift), stress
   - Lymphocytes (20-40%): Viral infection, chronic infections
   - Monocytes (2-8%): Chronic inflammation, TB, malaria
   - Eosinophils (1-4%): Allergies, parasites, drug reactions
   - Basophils (0-1%): Myeloproliferative disorders

PLATELETS:
- Normal: 150,000-400,000/μL
- Low (<150K): ITP, drugs, infection, bone marrow disorders
- High (>450K): Reactive (inflammation, iron def), essential thrombocythemia

CRITICAL VALUES:
- Hgb <7 g/dL
- WBC <1,500 or >30,000/μL
- Platelets <20,000 or >1,000,000/μL
- Requires immediate clinical correlation`,
      summary: 'CBC interpretation guide including normal ranges for RBCs, WBCs, platelets, differential significance, and critical values.',
      category: 'lab-interpretation',
      subcategory: 'hematology',
      specialty: 'pathology',
      keywords: JSON.stringify(['CBC', 'hemoglobin', 'hematocrit', 'MCV', 'WBC', 'platelets', 'anemia', 'leukocytosis']),
      icdCodes: JSON.stringify(['D50', 'D51', 'D52', 'D64', 'D70', 'D72']),
      source: 'Laboratory Medicine',
      evidenceLevel: 'B',
    },
    {
      title: 'Basic Metabolic Panel (BMP) Interpretation',
      content: `Basic Metabolic Panel Interpretation:

SODIUM (Na+):
- Normal: 136-145 mEq/L
- Low (<135): Hyponatremia
  - Hypovolemic: Diuretics, vomiting, diarrhea
  - Euvolemic: SIADH, hypothyroidism, adrenal insufficiency
  - Hypervolemic: Heart failure, cirrhosis, nephrotic syndrome
- High (>145): Hypernatremia
  - Dehydration, diabetes insipidus, excess sodium intake

POTASSIUM (K+):
- Normal: 3.5-5.0 mEq/L
- Low (<3.5): Hypokalemia
  - Diuretics, GI losses, insulin, alkalosis
  - ECG: U waves, flattened T waves
- High (>5.5): Hyperkalemia
  - Renal failure, ACE-I/ARBs, K+ supplements, acidosis
  - ECG: Peaked T waves, wide QRS
  - CRITICAL >6.5: Cardiac arrhythmias

CHLORIDE (Cl-):
- Normal: 98-106 mEq/L
- Follows sodium generally
- Important for anion gap calculation

BICARBONATE (HCO3-):
- Normal: 22-28 mEq/L
- Low: Metabolic acidosis or respiratory alkalosis
- High: Metabolic alkalosis or respiratory acidosis

BUN (Blood Urea Nitrogen):
- Normal: 7-20 mg/dL
- High: Renal failure, dehydration, GI bleeding, high protein
- Low: Liver disease, malnutrition, pregnancy

CREATININE:
- Normal: 0.7-1.3 mg/dL
- High: Renal impairment
- Calculate eGFR for CKD staging

GLUCOSE:
- Normal fasting: 70-100 mg/dL
- Pre-diabetes: 100-125 mg/dL
- Diabetes: ≥126 mg/dL fasting

ANION GAP:
- Formula: Na+ - (Cl- + HCO3-)
- Normal: 8-12 mEq/L
- High gap: MUDPILES (Methanol, Uremia, DKA, Propylene glycol, Isoniazid, Lactic acidosis, Ethylene glycol, Salicylates)`,
      summary: 'BMP interpretation including sodium, potassium, chloride, bicarbonate, BUN, creatinine, glucose with causes of abnormalities and anion gap.',
      category: 'lab-interpretation',
      subcategory: 'chemistry',
      specialty: 'nephrology',
      keywords: JSON.stringify(['BMP', 'sodium', 'potassium', 'creatinine', 'BUN', 'glucose', 'anion gap', 'electrolytes']),
      icdCodes: JSON.stringify(['E87', 'N17', 'N18', 'E11']),
      source: 'Laboratory Medicine',
      evidenceLevel: 'B',
    },
    // Treatment Protocols
    {
      title: 'Acute Asthma Exacerbation Treatment',
      content: `Acute Asthma Exacerbation Management:

SEVERITY ASSESSMENT:
1. Mild:
   - Peak flow >70% predicted
   - Speaks in sentences
   - RR <25, HR <100
   - O2 sat >95%

2. Moderate:
   - Peak flow 40-70%
   - Speaks in phrases
   - RR 25-30, HR 100-120
   - O2 sat 90-95%

3. Severe/Life-threatening:
   - Peak flow <40%
   - Single words
   - RR >30, HR >120
   - O2 sat <90%
   - Silent chest, cyanosis, confusion

TREATMENT PROTOCOL:

1. OXYGEN:
   - Target O2 sat 93-95%
   - High-flow if severe

2. BRONCHODILATORS:
   - Albuterol (salbutamol):
     * Mild/Moderate: 2.5-5mg nebulized q20min x3
     * Severe: Continuous nebulization 10-15mg/hr
   - Ipratropium:
     * Add for moderate-severe: 0.5mg nebulized
     * Can repeat q20min x3

3. CORTICOSTEROIDS:
   - Oral preferred if can tolerate:
     * Prednisone 40-60mg PO
     * Dexamethasone 16mg PO
   - IV if unable to take PO:
     * Methylprednisolone 80-125mg IV

4. MAGNESIUM SULFATE:
   - For severe exacerbations: 2g IV over 20 min
   - Can repeat once

5. ADDITIONAL THERAPIES:
   - Epinephrine 0.3mg IM for anaphylaxis
   - Consider BiPAP for severe respiratory distress
   - Prepare for intubation if deteriorating

DISPOSITION:
- Discharge: Improvement sustained 60 min post-treatment, PEF >70%
- Admit: Poor response after 4 hours, severe presentation
- ICU: Persistent severe symptoms, need for ventilation`,
      summary: 'Acute asthma exacerbation management including severity assessment, bronchodilator protocols, steroid dosing, magnesium for severe cases, and disposition criteria.',
      category: 'treatment',
      subcategory: 'respiratory',
      specialty: 'pulmonology',
      keywords: JSON.stringify(['asthma', 'albuterol', 'bronchodilator', 'exacerbation', 'ipratropium', 'prednisone', 'magnesium']),
      icdCodes: JSON.stringify(['J45', 'J45.901', 'J45.909']),
      drugNames: JSON.stringify(['albuterol', 'ipratropium', 'prednisone', 'methylprednisolone', 'magnesium sulfate', 'epinephrine']),
      source: 'GINA Guidelines',
      evidenceLevel: 'A',
    },
  ];

  console.log('Creating HealthcareKnowledge entries...');
  for (const knowledge of knowledgeData) {
    await prisma.healthcareKnowledge.create({ data: knowledge });
  }

  // Seed Drug Interaction Knowledge
  const drugInteractions = [
    {
      drug1Name: 'Warfarin',
      drug1Generic: 'warfarin',
      drug2Name: 'Amoxicillin',
      drug2Generic: 'amoxicillin',
      severity: 'major',
      mechanism: 'pharmacokinetic',
      description: 'Amoxicillin may enhance the anticoagulant effect of warfarin by altering intestinal flora that synthesize vitamin K, and possibly by direct hypoprothrombinemic effects.',
      clinicalEffects: JSON.stringify(['Increased INR', 'Bleeding risk', 'Bruising']),
      management: 'Monitor INR closely (every 3-5 days) during and after amoxicillin therapy. Warfarin dose reduction of 25-50% may be needed. Monitor for signs of bleeding.',
      evidenceLevel: 'B',
      onset: 'delayed',
    },
    {
      drug1Name: 'Metformin',
      drug1Generic: 'metformin',
      drug2Name: 'Cephalexin',
      drug2Generic: 'cephalexin',
      severity: 'moderate',
      mechanism: 'pharmacokinetic',
      description: 'Cephalexin may increase the serum concentration of metformin by decreasing its renal clearance via inhibition of renal OCT and MATE transporters.',
      clinicalEffects: JSON.stringify(['Lactic acidosis risk', 'GI side effects', 'Hypoglycemia rare']),
      management: 'Monitor renal function. Watch for symptoms of lactic acidosis (muscle pain, weakness, trouble breathing). Consider temporary metformin dose reduction.',
      evidenceLevel: 'C',
      onset: 'rapid',
    },
    {
      drug1Name: 'Lisinopril',
      drug1Generic: 'lisinopril',
      drug2Name: 'Spironolactone',
      drug2Generic: 'spironolactone',
      severity: 'major',
      mechanism: 'pharmacodynamic',
      description: 'Concurrent use of ACE inhibitors with potassium-sparing diuretics increases risk of hyperkalemia, especially in patients with renal impairment.',
      clinicalEffects: JSON.stringify(['Hyperkalemia', 'Cardiac arrhythmias', 'Muscle weakness']),
      management: 'Monitor serum potassium frequently. Avoid in patients with renal impairment (eGFR <30). Consider reducing spironolactone dose. Patient education on high-potassium foods to avoid.',
      evidenceLevel: 'A',
      onset: 'delayed',
    },
    {
      drug1Name: 'Azithromycin',
      drug1Generic: 'azithromycin',
      drug2Name: 'Warfarin',
      drug2Generic: 'warfarin',
      severity: 'major',
      mechanism: 'pharmacokinetic',
      description: 'Azithromycin may enhance the anticoagulant effect of warfarin through CYP450 inhibition and alteration of gut flora.',
      clinicalEffects: JSON.stringify(['Increased INR', 'Bleeding', 'Hemorrhage']),
      management: 'Check INR before starting azithromycin and 3-5 days after. Reduce warfarin dose if needed. Monitor for bleeding signs. Patient should report unusual bruising or bleeding.',
      evidenceLevel: 'B',
      onset: 'delayed',
    },
    {
      drug1Name: 'Simvastatin',
      drug1Generic: 'simvastatin',
      drug2Name: 'Clarithromycin',
      drug2Generic: 'clarithromycin',
      severity: 'contraindicated',
      mechanism: 'pharmacokinetic',
      description: 'Clarithromycin is a strong CYP3A4 inhibitor that can dramatically increase simvastatin levels, leading to increased risk of myopathy and rhabdomyolysis.',
      clinicalEffects: JSON.stringify(['Rhabdomyolysis', 'Myopathy', 'Acute kidney injury', 'Muscle pain']),
      management: 'CONTRAINDICATED. Suspend simvastatin during clarithromycin therapy. If lipid therapy needed, use pravastatin or rosuvastatin (not CYP3A4 substrates). Resume simvastatin 48+ hours after clarithromycin completed.',
      evidenceLevel: 'A',
      onset: 'rapid',
    },
    {
      drug1Name: 'Methotrexate',
      drug1Generic: 'methotrexate',
      drug2Name: 'Ibuprofen',
      drug2Generic: 'ibuprofen',
      severity: 'major',
      mechanism: 'pharmacokinetic',
      description: 'NSAIDs reduce renal clearance of methotrexate by inhibiting renal prostaglandin synthesis, leading to potentially toxic methotrexate levels.',
      clinicalEffects: JSON.stringify(['Methotrexate toxicity', 'Bone marrow suppression', 'Hepatotoxicity', 'Renal failure']),
      management: 'Avoid combination if possible. If needed, use lowest NSAID dose, monitor CBC, renal function, and liver enzymes. Patient should report mouth sores, unusual bleeding, or fatigue. Consider acetaminophen for pain.',
      evidenceLevel: 'A',
      onset: 'delayed',
    },
  ];

  console.log('Creating DrugInteractionKnowledge entries...');
  for (const interaction of drugInteractions) {
    await prisma.drugInteractionKnowledge.create({ data: interaction });
  }

  // Seed Symptom-Condition Mappings
  const symptomMappings = [
    {
      symptomName: 'Chest pain',
      symptomCategory: 'pain',
      conditions: JSON.stringify([
        { condition: 'Acute Coronary Syndrome', icdCode: 'I21', probability: 0.25, urgency: 'critical' },
        { condition: 'Gastroesophageal Reflux Disease', icdCode: 'K21', probability: 0.30, urgency: 'low' },
        { condition: 'Musculoskeletal Pain', icdCode: 'M54.6', probability: 0.20, urgency: 'low' },
        { condition: 'Pulmonary Embolism', icdCode: 'I26', probability: 0.10, urgency: 'critical' },
        { condition: 'Pericarditis', icdCode: 'I30', probability: 0.08, urgency: 'moderate' },
        { condition: 'Pneumothorax', icdCode: 'J93', probability: 0.05, urgency: 'high' },
        { condition: 'Aortic Dissection', icdCode: 'I71', probability: 0.02, urgency: 'critical' },
      ]),
      riskFactors: JSON.stringify(['smoking', 'hypertension', 'diabetes', 'family history CAD', 'hyperlipidemia', 'obesity', 'sedentary lifestyle']),
    },
    {
      symptomName: 'Headache',
      symptomCategory: 'neurological',
      conditions: JSON.stringify([
        { condition: 'Tension Headache', icdCode: 'G44.2', probability: 0.40, urgency: 'low' },
        { condition: 'Migraine', icdCode: 'G43', probability: 0.25, urgency: 'moderate' },
        { condition: 'Sinusitis', icdCode: 'J01', probability: 0.15, urgency: 'low' },
        { condition: 'Medication Overuse Headache', icdCode: 'G44.4', probability: 0.08, urgency: 'low' },
        { condition: 'Subarachnoid Hemorrhage', icdCode: 'I60', probability: 0.02, urgency: 'critical' },
        { condition: 'Brain Tumor', icdCode: 'C71', probability: 0.01, urgency: 'high' },
        { condition: 'Meningitis', icdCode: 'G00', probability: 0.02, urgency: 'critical' },
        { condition: 'Giant Cell Arteritis', icdCode: 'M31.5', probability: 0.01, urgency: 'high' },
      ]),
      riskFactors: JSON.stringify(['stress', 'sleep deprivation', 'family history migraine', 'analgesic overuse', 'age >50', 'hypertension']),
    },
    {
      symptomName: 'Abdominal pain',
      symptomCategory: 'pain',
      conditions: JSON.stringify([
        { condition: 'Acute Appendicitis', icdCode: 'K35', probability: 0.15, urgency: 'high' },
        { condition: 'Gastroenteritis', icdCode: 'A09', probability: 0.25, urgency: 'low' },
        { condition: 'Gallbladder Disease', icdCode: 'K80', probability: 0.20, urgency: 'moderate' },
        { condition: 'Peptic Ulcer Disease', icdCode: 'K25', probability: 0.12, urgency: 'moderate' },
        { condition: 'Irritable Bowel Syndrome', icdCode: 'K58', probability: 0.15, urgency: 'low' },
        { condition: 'Diverticulitis', icdCode: 'K57', probability: 0.08, urgency: 'moderate' },
        { condition: 'Ovarian Pathology', icdCode: 'N83', probability: 0.05, urgency: 'moderate' },
      ]),
      riskFactors: JSON.stringify(['previous abdominal surgery', 'gallstones', 'NSAID use', 'alcohol use', 'female gender', 'family history']),
    },
    {
      symptomName: 'Fever',
      symptomCategory: 'constitutional',
      conditions: JSON.stringify([
        { condition: 'Viral Upper Respiratory Infection', icdCode: 'J06', probability: 0.35, urgency: 'low' },
        { condition: 'Bacterial Pneumonia', icdCode: 'J18', probability: 0.15, urgency: 'moderate' },
        { condition: 'Urinary Tract Infection', icdCode: 'N39', probability: 0.15, urgency: 'moderate' },
        { condition: 'Gastroenteritis', icdCode: 'A09', probability: 0.15, urgency: 'low' },
        { condition: 'Skin/Soft Tissue Infection', icdCode: 'L03', probability: 0.08, urgency: 'moderate' },
        { condition: 'Sepsis', icdCode: 'A41', probability: 0.05, urgency: 'critical' },
        { condition: 'Malaria', icdCode: 'B54', probability: 0.02, urgency: 'high' },
      ]),
      riskFactors: JSON.stringify(['immunocompromised', 'recent travel', 'indwelling catheters', 'recent hospitalization', 'chronic illness']),
    },
    {
      symptomName: 'Shortness of breath',
      symptomCategory: 'respiratory',
      conditions: JSON.stringify([
        { condition: 'Asthma Exacerbation', icdCode: 'J45', probability: 0.25, urgency: 'moderate' },
        { condition: 'COPD Exacerbation', icdCode: 'J44', probability: 0.20, urgency: 'moderate' },
        { condition: 'Heart Failure', icdCode: 'I50', probability: 0.15, urgency: 'high' },
        { condition: 'Pneumonia', icdCode: 'J18', probability: 0.15, urgency: 'moderate' },
        { condition: 'Pulmonary Embolism', icdCode: 'I26', probability: 0.10, urgency: 'critical' },
        { condition: 'Anxiety/Panic Attack', icdCode: 'F41', probability: 0.10, urgency: 'low' },
        { condition: 'Anemia', icdCode: 'D50', probability: 0.05, urgency: 'low' },
      ]),
      riskFactors: JSON.stringify(['smoking', 'COPD history', 'heart disease', 'recent surgery', 'immobilization', 'malignancy', 'asthma history']),
    },
  ];

  console.log('Creating SymptomConditionMapping entries...');
  for (const mapping of symptomMappings) {
    await prisma.symptomConditionMapping.create({ data: mapping });
  }

  console.log('RAG Healthcare Knowledge Base seeded successfully!');
  console.log(`- ${knowledgeData.length} HealthcareKnowledge entries`);
  console.log(`- ${drugInteractions.length} DrugInteractionKnowledge entries`);
  console.log(`- ${symptomMappings.length} SymptomConditionMapping entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

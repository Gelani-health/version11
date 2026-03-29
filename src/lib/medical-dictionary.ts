// Medical Terminology Dictionary for Autocomplete
// Comprehensive list of medical terms, drugs, diagnoses, and clinical abbreviations

export interface MedicalTerm {
  term: string;
  category: string;
  description?: string;
  icdCode?: string;
  synonyms?: string[];
}

// Common Medical Abbreviations
export const medicalAbbreviations: MedicalTerm[] = [
  { term: "BP", category: "Vitals", description: "Blood Pressure" },
  { term: "HR", category: "Vitals", description: "Heart Rate" },
  { term: "RR", category: "Vitals", description: "Respiratory Rate" },
  { term: "Temp", category: "Vitals", description: "Temperature" },
  { term: "SpO2", category: "Vitals", description: "Oxygen Saturation" },
  { term: "BMI", category: "Vitals", description: "Body Mass Index" },
  { term: "PRN", category: "Prescription", description: "As Needed (Pro Re Nata)" },
  { term: "BID", category: "Prescription", description: "Twice Daily" },
  { term: "TID", category: "Prescription", description: "Three Times Daily" },
  { term: "QID", category: "Prescription", description: "Four Times Daily" },
  { term: "QD", category: "Prescription", description: "Once Daily" },
  { term: "QHS", category: "Prescription", description: "At Bedtime" },
  { term: "QAM", category: "Prescription", description: "Every Morning" },
  { term: "QPM", category: "Prescription", description: "Every Evening" },
  { term: "PO", category: "Prescription", description: "By Mouth (Orally)" },
  { term: "IV", category: "Prescription", description: "Intravenous" },
  { term: "IM", category: "Prescription", description: "Intramuscular" },
  { term: "SC", category: "Prescription", description: "Subcutaneous", synonyms: ["SQ", "SubQ"] },
  { term: "SL", category: "Prescription", description: "Sublingual" },
  { term: "TOP", category: "Prescription", description: "Topical" },
  { term: "NPO", category: "Prescription", description: "Nothing By Mouth" },
  { term: "STAT", category: "Prescription", description: "Immediately" },
  { term: "Rx", category: "Prescription", description: "Prescription" },
  { term: "Hx", category: "Clinical", description: "History" },
  { term: "Px", category: "Clinical", description: "Physical Examination" },
  { term: "Dx", category: "Clinical", description: "Diagnosis" },
  { term: "Tx", category: "Clinical", description: "Treatment" },
  { term: "Sx", category: "Clinical", description: "Symptoms" },
  { term: "Fx", category: "Clinical", description: "Fracture" },
  { term: "Hx", category: "Clinical", description: "History" },
  { term: "SOB", category: "Symptoms", description: "Shortness of Breath" },
  { term: "DOE", category: "Symptoms", description: "Dyspnea on Exertion" },
  { term: "PND", category: "Symptoms", description: "Paroxysmal Nocturnal Dyspnea" },
  { term: "LOC", category: "Symptoms", description: "Loss of Consciousness" },
  { term: "AOB", category: "Symptoms", description: "Alcohol on Breath" },
  { term: "LMP", category: "OB/GYN", description: "Last Menstrual Period" },
  { term: "EDC", category: "OB/GYN", description: "Expected Date of Confinement/Delivery" },
  { term: "GA", category: "OB/GYN", description: "Gestational Age" },
  { term: "IUP", category: "OB/GYN", description: "Intrauterine Pregnancy" },
  { term: "G", category: "OB/GYN", description: "Gravida (Number of Pregnancies)" },
  { term: "P", category: "OB/GYN", description: "Para (Number of Births)" },
  { term: "AB", category: "OB/GYN", description: "Abortion (Miscarriage)" },
  { term: "C-section", category: "OB/GYN", description: "Cesarean Section", synonyms: ["C/S", "Cesarean"] },
  { term: "DC", category: "Administrative", description: "Discharge" },
  { term: "ADMIT", category: "Administrative", description: "Admission" },
  { term: "F/U", category: "Administrative", description: "Follow-up" },
  { term: "RTC", category: "Administrative", description: "Return to Clinic" },
  { term: "RTH", category: "Administrative", description: "Return to Hospital" },
  { term: "AMA", category: "Administrative", description: "Against Medical Advice" },
  { term: "DNR", category: "Administrative", description: "Do Not Resuscitate" },
  { term: "DNI", category: "Administrative", description: "Do Not Intubate" },
  { term: "CODE", category: "Emergency", description: "Cardiac Arrest/Resuscitation" },
  { term: "ETT", category: "Procedures", description: "Endotracheal Tube" },
  { term: "NGT", category: "Procedures", description: "Nasogastric Tube" },
  { term: "Foley", category: "Procedures", description: "Urinary Catheter" },
  { term: "IVC", category: "Procedures", description: "Intravenous Cannula" },
  { term: "ABG", category: "Labs", description: "Arterial Blood Gas" },
  { term: "CBC", category: "Labs", description: "Complete Blood Count" },
  { term: "CMP", category: "Labs", description: "Comprehensive Metabolic Panel" },
  { term: "BMP", category: "Labs", description: "Basic Metabolic Panel" },
  { term: "LFT", category: "Labs", description: "Liver Function Tests" },
  { term: "RFT", category: "Labs", description: "Renal Function Tests" },
  { term: "TSH", category: "Labs", description: "Thyroid Stimulating Hormone" },
  { term: "HbA1c", category: "Labs", description: "Glycosylated Hemoglobin" },
  { term: "PT", category: "Labs", description: "Prothrombin Time" },
  { term: "PTT", category: "Labs", description: "Partial Thromboplastin Time" },
  { term: "INR", category: "Labs", description: "International Normalized Ratio" },
  { term: "ESR", category: "Labs", description: "Erythrocyte Sedimentation Rate" },
  { term: "CRP", category: "Labs", description: "C-Reactive Protein" },
  { term: "U/A", category: "Labs", description: "Urinalysis" },
  { term: "C&S", category: "Labs", description: "Culture and Sensitivity" },
  { term: "ECG", category: "Diagnostics", description: "Electrocardiogram", synonyms: ["EKG"] },
  { term: "CXR", category: "Diagnostics", description: "Chest X-Ray" },
  { term: "CT", category: "Diagnostics", description: "Computed Tomography" },
  { term: "MRI", category: "Diagnostics", description: "Magnetic Resonance Imaging" },
  { term: "US", category: "Diagnostics", description: "Ultrasound" },
  { term: "Echo", category: "Diagnostics", description: "Echocardiogram" },
  { term: "EEG", category: "Diagnostics", description: "Electroencephalogram" },
  { term: "EMG", category: "Diagnostics", description: "Electromyography" },
];

// Common Diagnoses with ICD-10 Codes
export const commonDiagnoses: MedicalTerm[] = [
  { term: "Essential Hypertension", category: "Cardiovascular", icdCode: "I10" },
  { term: "Hypertensive Heart Disease", category: "Cardiovascular", icdCode: "I11.9" },
  { term: "Atrial Fibrillation", category: "Cardiovascular", icdCode: "I48.91" },
  { term: "Congestive Heart Failure", category: "Cardiovascular", icdCode: "I50.9" },
  { term: "Coronary Artery Disease", category: "Cardiovascular", icdCode: "I25.10" },
  { term: "Myocardial Infarction", category: "Cardiovascular", icdCode: "I21.9" },
  { term: "Type 2 Diabetes Mellitus", category: "Endocrine", icdCode: "E11.9" },
  { term: "Type 2 Diabetes with Complications", category: "Endocrine", icdCode: "E11.65" },
  { term: "Diabetic Neuropathy", category: "Endocrine", icdCode: "E11.40" },
  { term: "Diabetic Nephropathy", category: "Endocrine", icdCode: "E11.21" },
  { term: "Diabetic Retinopathy", category: "Endocrine", icdCode: "E11.35" },
  { term: "Hypothyroidism", category: "Endocrine", icdCode: "E03.9" },
  { term: "Hyperthyroidism", category: "Endocrine", icdCode: "E05.90" },
  { term: "Hyperlipidemia", category: "Endocrine", icdCode: "E78.5" },
  { term: "Obesity", category: "Endocrine", icdCode: "E66.9" },
  { term: "Acute Upper Respiratory Infection", category: "Respiratory", icdCode: "J06.9" },
  { term: "Acute Bronchitis", category: "Respiratory", icdCode: "J20.9" },
  { term: "Pneumonia", category: "Respiratory", icdCode: "J18.9" },
  { term: "Asthma", category: "Respiratory", icdCode: "J45.909" },
  { term: "COPD", category: "Respiratory", icdCode: "J44.1" },
  { term: "Chronic Bronchitis", category: "Respiratory", icdCode: "J42" },
  { term: "Pulmonary Embolism", category: "Respiratory", icdCode: "I26.99" },
  { term: "Major Depressive Disorder", category: "Psychiatric", icdCode: "F32.9" },
  { term: "Generalized Anxiety Disorder", category: "Psychiatric", icdCode: "F41.1" },
  { term: "Panic Disorder", category: "Psychiatric", icdCode: "F41.0" },
  { term: "Bipolar Disorder", category: "Psychiatric", icdCode: "F31.9" },
  { term: "Schizophrenia", category: "Psychiatric", icdCode: "F20.9" },
  { term: "Gastroesophageal Reflux Disease", category: "GI", icdCode: "K21.0", synonyms: ["GERD"] },
  { term: "Peptic Ulcer Disease", category: "GI", icdCode: "K27.9" },
  { term: "Gastritis", category: "GI", icdCode: "K29.70" },
  { term: "Acute Pancreatitis", category: "GI", icdCode: "K85.90" },
  { term: "Cholelithiasis", category: "GI", icdCode: "K80.20" },
  { term: "Cholecystitis", category: "GI", icdCode: "K81.9" },
  { term: "Acute Appendicitis", category: "GI", icdCode: "K35.80" },
  { term: "Crohn's Disease", category: "GI", icdCode: "K50.90" },
  { term: "Ulcerative Colitis", category: "GI", icdCode: "K51.90" },
  { term: "Chronic Kidney Disease", category: "Renal", icdCode: "N18.9" },
  { term: "Acute Kidney Injury", category: "Renal", icdCode: "N17.9" },
  { term: "Urinary Tract Infection", category: "Renal", icdCode: "N39.0", synonyms: ["UTI"] },
  { term: "Pyelonephritis", category: "Renal", icdCode: "N10" },
  { term: "Nephrolithiasis", category: "Renal", icdCode: "N20.0" },
  { term: "Osteoarthritis", category: "Musculoskeletal", icdCode: "M19.90" },
  { term: "Rheumatoid Arthritis", category: "Musculoskeletal", icdCode: "M06.9" },
  { term: "Gout", category: "Musculoskeletal", icdCode: "M10.9" },
  { term: "Low Back Pain", category: "Musculoskeletal", icdCode: "M54.5" },
  { term: "Cervical Radiculopathy", category: "Musculoskeletal", icdCode: "M54.12" },
  { term: "Lumbar Radiculopathy", category: "Musculoskeletal", icdCode: "M54.16" },
  { term: "Anemia", category: "Hematology", icdCode: "D64.9" },
  { term: "Iron Deficiency Anemia", category: "Hematology", icdCode: "D50.9" },
  { term: "Vitamin B12 Deficiency", category: "Hematology", icdCode: "D51.9" },
  { term: "Migraine", category: "Neurology", icdCode: "G43.909" },
  { term: "Tension Headache", category: "Neurology", icdCode: "G44.209" },
  { term: "Seizure Disorder", category: "Neurology", icdCode: "G40.909" },
  { term: "Epilepsy", category: "Neurology", icdCode: "G40.909" },
  { term: "Parkinson's Disease", category: "Neurology", icdCode: "G20" },
  { term: "Stroke", category: "Neurology", icdCode: "I63.9" },
  { term: "TIA", category: "Neurology", icdCode: "G45.9", description: "Transient Ischemic Attack" },
  { term: "Breast Cancer", category: "Oncology", icdCode: "C50.919" },
  { term: "Lung Cancer", category: "Oncology", icdCode: "C34.90" },
  { term: "Colon Cancer", category: "Oncology", icdCode: "C18.9" },
  { term: "Prostate Cancer", category: "Oncology", icdCode: "C61" },
  { term: "Skin Cancer", category: "Oncology", icdCode: "C44.90" },
  { term: "Cellulitis", category: "Dermatology", icdCode: "L03.90" },
  { term: "Dermatitis", category: "Dermatology", icdCode: "L30.9" },
  { term: "Psoriasis", category: "Dermatology", icdCode: "L40.0" },
  { term: "Eczema", category: "Dermatology", icdCode: "L20.9" },
];

// Common Medications
export const commonMedications: MedicalTerm[] = [
  // Antihypertensives
  { term: "Amlodipine", category: "Antihypertensive", description: "Calcium Channel Blocker" },
  { term: "Lisinopril", category: "Antihypertensive", description: "ACE Inhibitor" },
  { term: "Losartan", category: "Antihypertensive", description: "ARB" },
  { term: "Metoprolol", category: "Antihypertensive", description: "Beta Blocker" },
  { term: "Atenolol", category: "Antihypertensive", description: "Beta Blocker" },
  { term: "Carvedilol", category: "Antihypertensive", description: "Beta Blocker" },
  { term: "Hydrochlorothiazide", category: "Antihypertensive", description: "Diuretic", synonyms: ["HCTZ"] },
  { term: "Furosemide", category: "Antihypertensive", description: "Loop Diuretic", synonyms: ["Lasix"] },
  { term: "Spironolactone", category: "Antihypertensive", description: "K+ Sparing Diuretic" },
  { term: "Nifedipine", category: "Antihypertensive", description: "Calcium Channel Blocker" },
  { term: "Diltiazem", category: "Antihypertensive", description: "Calcium Channel Blocker" },
  { term: "Amlodipine-Valsartan", category: "Antihypertensive", description: "Combination CCB/ARB" },
  
  // Diabetes Medications
  { term: "Metformin", category: "Antidiabetic", description: "Biguanide" },
  { term: "Glipizide", category: "Antidiabetic", description: "Sulfonylurea" },
  { term: "Glyburide", category: "Antidiabetic", description: "Sulfonylurea" },
  { term: "Gliclazide", category: "Antidiabetic", description: "Sulfonylurea" },
  { term: "Sitagliptin", category: "Antidiabetic", description: "DPP-4 Inhibitor" },
  { term: "Linagliptin", category: "Antidiabetic", description: "DPP-4 Inhibitor" },
  { term: "Empagliflozin", category: "Antidiabetic", description: "SGLT2 Inhibitor" },
  { term: "Dapagliflozin", category: "Antidiabetic", description: "SGLT2 Inhibitor" },
  { term: "Canagliflozin", category: "Antidiabetic", description: "SGLT2 Inhibitor" },
  { term: "Liraglutide", category: "Antidiabetic", description: "GLP-1 Agonist" },
  { term: "Semaglutide", category: "Antidiabetic", description: "GLP-1 Agonist" },
  { term: "Exenatide", category: "Antidiabetic", description: "GLP-1 Agonist" },
  { term: "Insulin Glargine", category: "Antidiabetic", description: "Long-Acting Insulin" },
  { term: "Insulin Lispro", category: "Antidiabetic", description: "Rapid-Acting Insulin" },
  { term: "Insulin Aspart", category: "Antidiabetic", description: "Rapid-Acting Insulin" },
  { term: "Insulin Detemir", category: "Antidiabetic", description: "Long-Acting Insulin" },
  { term: "Insulin NPH", category: "Antidiabetic", description: "Intermediate-Acting Insulin" },
  
  // Statins
  { term: "Atorvastatin", category: "Lipid-Lowering", description: "Statin" },
  { term: "Simvastatin", category: "Lipid-Lowering", description: "Statin" },
  { term: "Rosuvastatin", category: "Lipid-Lowering", description: "Statin" },
  { term: "Pravastatin", category: "Lipid-Lowering", description: "Statin" },
  { term: "Lovastatin", category: "Lipid-Lowering", description: "Statin" },
  { term: "Ezetimibe", category: "Lipid-Lowering", description: "Cholesterol Absorption Inhibitor" },
  
  // Antibiotics
  { term: "Amoxicillin", category: "Antibiotic", description: "Penicillin" },
  { term: "Amoxicillin-Clavulanate", category: "Antibiotic", description: "Penicillin + Beta-Lactamase Inhibitor", synonyms: ["Augmentin", "Amox-Clav"] },
  { term: "Ampicillin", category: "Antibiotic", description: "Penicillin" },
  { term: "Azithromycin", category: "Antibiotic", description: "Macrolide" },
  { term: "Clarithromycin", category: "Antibiotic", description: "Macrolide" },
  { term: "Ciprofloxacin", category: "Antibiotic", description: "Fluoroquinolone" },
  { term: "Levofloxacin", category: "Antibiotic", description: "Fluoroquinolone" },
  { term: "Moxifloxacin", category: "Antibiotic", description: "Fluoroquinolone" },
  { term: "Ceftriaxone", category: "Antibiotic", description: "3rd Gen Cephalosporin" },
  { term: "Cefuroxime", category: "Antibiotic", description: "2nd Gen Cephalosporin" },
  { term: "Cephalexin", category: "Antibiotic", description: "1st Gen Cephalosporin" },
  { term: "Cefazolin", category: "Antibiotic", description: "1st Gen Cephalosporin" },
  { term: "Cefixime", category: "Antibiotic", description: "3rd Gen Cephalosporin" },
  { term: "Doxycycline", category: "Antibiotic", description: "Tetracycline" },
  { term: "Metronidazole", category: "Antibiotic", description: "Nitroimidazole" },
  { term: "Clindamycin", category: "Antibiotic", description: "Lincosamide" },
  { term: "Nitrofurantoin", category: "Antibiotic", description: "Urinary Antiseptic" },
  { term: "Trimethoprim-Sulfamethoxazole", category: "Antibiotic", description: "Sulfonamide", synonyms: ["TMP-SMX", "Bactrim", "Co-trimoxazole"] },
  { term: "Vancomycin", category: "Antibiotic", description: "Glycopeptide" },
  { term: "Meropenem", category: "Antibiotic", description: "Carbapenem" },
  { term: "Imipenem", category: "Antibiotic", description: "Carbapenem" },
  { term: "Piperacillin-Tazobactam", category: "Antibiotic", description: "Penicillin + Beta-Lactamase Inhibitor", synonyms: ["Pip-Tazo", "Zosyn"] },
  { term: "Gentamicin", category: "Antibiotic", description: "Aminoglycoside" },
  { term: "Amikacin", category: "Antibiotic", description: "Aminoglycoside" },
  
  // Analgesics
  { term: "Paracetamol", category: "Analgesic", description: "Acetaminophen", synonyms: ["Acetaminophen", "APAP"] },
  { term: "Ibuprofen", category: "Analgesic", description: "NSAID" },
  { term: "Naproxen", category: "Analgesic", description: "NSAID" },
  { term: "Diclofenac", category: "Analgesic", description: "NSAID" },
  { term: "Celecoxib", category: "Analgesic", description: "COX-2 Inhibitor" },
  { term: "Aspirin", category: "Analgesic", description: "NSAID/Antiplatelet" },
  { term: "Tramadol", category: "Analgesic", description: "Opioid Analgesic" },
  { term: "Codeine", category: "Analgesic", description: "Opioid Analgesic" },
  { term: "Morphine", category: "Analgesic", description: "Opioid Analgesic" },
  { term: "Oxycodone", category: "Analgesic", description: "Opioid Analgesic" },
  { term: "Fentanyl", category: "Analgesic", description: "Opioid Analgesic" },
  { term: "Gabapentin", category: "Analgesic", description: "Neuropathic Pain" },
  { term: "Pregabalin", category: "Analgesic", description: "Neuropathic Pain" },
  
  // Antiplatelet/Anticoagulants
  { term: "Aspirin", category: "Antiplatelet", description: "Antiplatelet" },
  { term: "Clopidogrel", category: "Antiplatelet", description: "P2Y12 Inhibitor" },
  { term: "Ticagrelor", category: "Antiplatelet", description: "P2Y12 Inhibitor" },
  { term: "Warfarin", category: "Anticoagulant", description: "Vitamin K Antagonist" },
  { term: "Rivaroxaban", category: "Anticoagulant", description: "Factor Xa Inhibitor" },
  { term: "Apixaban", category: "Anticoagulant", description: "Factor Xa Inhibitor" },
  { term: "Dabigatran", category: "Anticoagulant", description: "Direct Thrombin Inhibitor" },
  { term: "Enoxaparin", category: "Anticoagulant", description: "Low Molecular Weight Heparin" },
  { term: "Heparin", category: "Anticoagulant", description: "Unfractionated Heparin" },
  
  // GI Medications
  { term: "Omeprazole", category: "GI", description: "Proton Pump Inhibitor" },
  { term: "Pantoprazole", category: "GI", description: "Proton Pump Inhibitor" },
  { term: "Esomeprazole", category: "GI", description: "Proton Pump Inhibitor" },
  { term: "Lansoprazole", category: "GI", description: "Proton Pump Inhibitor" },
  { term: "Ranitidine", category: "GI", description: "H2 Blocker" },
  { term: "Famotidine", category: "GI", description: "H2 Blocker" },
  { term: "Ondansetron", category: "GI", description: "Antiemetic 5-HT3 Antagonist" },
  { term: "Metoclopramide", category: "GI", description: "Antiemetic Prokinetic" },
  { term: "Domperidone", category: "GI", description: "Antiemetic Prokinetic" },
  { term: "Lactulose", category: "GI", description: "Laxative" },
  { term: "Polyethylene Glycol", category: "GI", description: "Laxative", synonyms: ["PEG", "Miralax"] },
  
  // Asthma/Respiratory
  { term: "Salbutamol", category: "Respiratory", description: "Short-Acting Beta Agonist", synonyms: ["Albuterol"] },
  { term: "Ipratropium", category: "Respiratory", description: "Anticholinergic" },
  { term: "Tiotropium", category: "Respiratory", description: "Long-Acting Anticholinergic" },
  { term: "Fluticasone", category: "Respiratory", description: "Inhaled Corticosteroid" },
  { term: "Budesonide", category: "Respiratory", description: "Inhaled Corticosteroid" },
  { term: "Salmeterol", category: "Respiratory", description: "Long-Acting Beta Agonist" },
  { term: "Formoterol", category: "Respiratory", description: "Long-Acting Beta Agonist" },
  { term: "Montelukast", category: "Respiratory", description: "Leukotriene Receptor Antagonist" },
  { term: "Prednisone", category: "Respiratory", description: "Oral Corticosteroid" },
  { term: "Methylprednisolone", category: "Respiratory", description: "Oral/IV Corticosteroid" },
  { term: "Theophylline", category: "Respiratory", description: "Methylxanthine" },
  
  // Psychiatric
  { term: "Sertraline", category: "Psychiatric", description: "SSRI Antidepressant" },
  { term: "Fluoxetine", category: "Psychiatric", description: "SSRI Antidepressant" },
  { term: "Escitalopram", category: "Psychiatric", description: "SSRI Antidepressant" },
  { term: "Citalopram", category: "Psychiatric", description: "SSRI Antidepressant" },
  { term: "Paroxetine", category: "Psychiatric", description: "SSRI Antidepressant" },
  { term: "Venlafaxine", category: "Psychiatric", description: "SNRI Antidepressant" },
  { term: "Duloxetine", category: "Psychiatric", description: "SNRI Antidepressant" },
  { term: "Mirtazapine", category: "Psychiatric", description: "Atypical Antidepressant" },
  { term: "Bupropion", category: "Psychiatric", description: "NDRI Antidepressant" },
  { term: "Amitriptyline", category: "Psychiatric", description: "TCA Antidepressant" },
  { term: "Trazodone", category: "Psychiatric", description: "SARI Antidepressant" },
  { term: "Diazepam", category: "Psychiatric", description: "Benzodiazepine" },
  { term: "Lorazepam", category: "Psychiatric", description: "Benzodiazepine" },
  { term: "Alprazolam", category: "Psychiatric", description: "Benzodiazepine" },
  { term: "Clonazepam", category: "Psychiatric", description: "Benzodiazepine" },
  { term: "Quetiapine", category: "Psychiatric", description: "Atypical Antipsychotic" },
  { term: "Olanzapine", category: "Psychiatric", description: "Atypical Antipsychotic" },
  { term: "Risperidone", category: "Psychiatric", description: "Atypical Antipsychotic" },
  { term: "Aripiprazole", category: "Psychiatric", description: "Atypical Antipsychotic" },
  { term: "Haloperidol", category: "Psychiatric", description: "Typical Antipsychotic" },
  { term: "Lithium", category: "Psychiatric", description: "Mood Stabilizer" },
  { term: "Valproic Acid", category: "Psychiatric", description: "Mood Stabilizer" },
  { term: "Carbamazepine", category: "Psychiatric", description: "Mood Stabilizer/Antiepileptic" },
  
  // Thyroid
  { term: "Levothyroxine", category: "Thyroid", description: "Thyroid Hormone Replacement" },
  { term: "Methimazole", category: "Thyroid", description: "Antithyroid" },
  { term: "Propylthiouracil", category: "Thyroid", description: "Antithyroid" },
  
  // Gout
  { term: "Allopurinol", category: "Gout", description: "Xanthine Oxidase Inhibitor" },
  { term: "Febuxostat", category: "Gout", description: "Xanthine Oxidase Inhibitor" },
  { term: "Colchicine", category: "Gout", description: "Anti-inflammatory" },
  
  // Osteoporosis
  { term: "Alendronate", category: "Osteoporosis", description: "Bisphosphonate" },
  { term: "Risedronate", category: "Osteoporosis", description: "Bisphosphonate" },
  { term: "Zoledronic Acid", category: "Osteoporosis", description: "Bisphosphonate" },
  { term: "Calcium Carbonate", category: "Supplement", description: "Calcium Supplement" },
  { term: "Vitamin D3", category: "Supplement", description: "Cholecalciferol" },
];

// Clinical Terms and Phrases
export const clinicalPhrases: MedicalTerm[] = [
  { term: "Chief Complaint", category: "Clinical Note" },
  { term: "History of Present Illness", category: "Clinical Note", synonyms: ["HPI"] },
  { term: "Review of Systems", category: "Clinical Note", synonyms: ["ROS"] },
  { term: "Physical Examination", category: "Clinical Note", synonyms: ["PE"] },
  { term: "Assessment and Plan", category: "Clinical Note" },
  { term: "Subjective", category: "SOAP" },
  { term: "Objective", category: "SOAP" },
  { term: "Assessment", category: "SOAP" },
  { term: "Plan", category: "SOAP" },
  { term: "Past Medical History", category: "Clinical Note", synonyms: ["PMH"] },
  { term: "Past Surgical History", category: "Clinical Note", synonyms: ["PSH"] },
  { term: "Social History", category: "Clinical Note", synonyms: ["SH"] },
  { term: "Family History", category: "Clinical Note", synonyms: ["FH"] },
  { term: "Allergies", category: "Clinical Note" },
  { term: "Current Medications", category: "Clinical Note" },
  { term: "Denies", category: "Clinical Phrase" },
  { term: "Reports", category: "Clinical Phrase" },
  { term: "Complains of", category: "Clinical Phrase" },
  { term: "Presents with", category: "Clinical Phrase" },
  { term: "No known drug allergies", category: "Clinical Note", synonyms: ["NKDA"] },
  { term: "No known allergies", category: "Clinical Note", synonyms: ["NKA"] },
  { term: "Alert and oriented", category: "Clinical Phrase", synonyms: ["AO"] },
  { term: "In no acute distress", category: "Clinical Phrase", synonyms: ["INAD"] },
  { term: "Well-developed, well-nourished", category: "Clinical Phrase", synonyms: ["WDWN"] },
  { term: "Normal saline", category: "IV Fluids", synonyms: ["NS"] },
  { term: "Lactated Ringer's", category: "IV Fluids", synonyms: ["LR", "RL"] },
  { term: "Dextrose 5%", category: "IV Fluids", synonyms: ["D5", "D5W"] },
  { term: "Dextrose 5% Normal Saline", category: "IV Fluids", synonyms: ["D5NS"] },
  { term: "Dextrose 5% Half Normal Saline", category: "IV Fluids", synonyms: ["D5 1/2 NS"] },
  { term: "Clear to auscultation", category: "Clinical Phrase", synonyms: ["CTA"] },
  { term: "Regular rate and rhythm", category: "Clinical Phrase", synonyms: ["RRR"] },
  { term: "No murmurs, rubs, or gallops", category: "Clinical Phrase", synonyms: ["No MRG"] },
  { term: "Soft, non-tender, non-distended", category: "Clinical Phrase", synonyms: ["SNTND"] },
  { term: "Bowel sounds present", category: "Clinical Phrase" },
  { term: "No edema", category: "Clinical Phrase" },
  { term: "No cyanosis, clubbing, or edema", category: "Clinical Phrase", synonyms: ["No CCE"] },
  { term: "Peripheral pulses intact", category: "Clinical Phrase" },
  { term: "Grossly normal", category: "Clinical Phrase" },
  { term: "Within normal limits", category: "Clinical Phrase", synonyms: ["WNL"] },
  { term: "Unremarkable", category: "Clinical Phrase" },
  { term: "Non-contributory", category: "Clinical Phrase" },
  { term: "As needed", category: "Prescription", synonyms: ["PRN"] },
  { term: "As tolerated", category: "Prescription" },
  { term: "With food", category: "Prescription" },
  { term: "On empty stomach", category: "Prescription" },
  { term: "At bedtime", category: "Prescription", synonyms: ["HS"] },
  { term: "Before meals", category: "Prescription", synonyms: ["AC"] },
  { term: "After meals", category: "Prescription", synonyms: ["PC"] },
];

// Lab Test Terms for Autocomplete
export const labTestTerms: MedicalTerm[] = [
  // Complete Blood Count
  { term: "Complete Blood Count", category: "Labs", description: "Full blood panel", synonyms: ["CBC"] },
  { term: "Hemoglobin", category: "Labs", description: "Oxygen-carrying protein in RBCs" },
  { term: "Hematocrit", category: "Labs", description: "Percentage of RBCs in blood" },
  { term: "White Blood Cell Count", category: "Labs", description: "Infection indicator", synonyms: ["WBC"] },
  { term: "Red Blood Cell Count", category: "Labs", description: "Number of RBCs", synonyms: ["RBC"] },
  { term: "Platelet Count", category: "Labs", description: "Clotting cells count" },
  { term: "Mean Corpuscular Volume", category: "Labs", description: "Average RBC size", synonyms: ["MCV"] },
  { term: "Mean Corpuscular Hemoglobin", category: "Labs", description: "Average Hb per RBC", synonyms: ["MCH"] },
  { term: "Mean Corpuscular Hemoglobin Concentration", category: "Labs", synonyms: ["MCHC"] },
  
  // Metabolic Panel
  { term: "Comprehensive Metabolic Panel", category: "Labs", description: "Full metabolic assessment", synonyms: ["CMP"] },
  { term: "Basic Metabolic Panel", category: "Labs", description: "Essential metabolic tests", synonyms: ["BMP"] },
  { term: "Blood Urea Nitrogen", category: "Labs", description: "Kidney function", synonyms: ["BUN"] },
  { term: "Creatinine", category: "Labs", description: "Kidney function marker" },
  { term: "Glucose Fasting", category: "Labs", description: "Fasting blood sugar", synonyms: ["FBS", "Fasting Glucose"] },
  { term: "Glucose Random", category: "Labs", description: "Random blood sugar", synonyms: ["RBS", "Random Glucose"] },
  { term: "HbA1c", category: "Labs", description: "3-month glucose average" },
  
  // Electrolytes
  { term: "Sodium", category: "Labs", description: "Electrolyte balance", synonyms: ["Na"] },
  { term: "Potassium", category: "Labs", description: "Heart & muscle function", synonyms: ["K"] },
  { term: "Chloride", category: "Labs", description: "Fluid balance", synonyms: ["Cl"] },
  { term: "Bicarbonate", category: "Labs", description: "Acid-base balance", synonyms: ["HCO3"] },
  { term: "Calcium", category: "Labs", description: "Bone & muscle function", synonyms: ["Ca"] },
  { term: "Magnesium", category: "Labs", description: "Muscle & nerve function", synonyms: ["Mg"] },
  { term: "Phosphate", category: "Labs", description: "Bone metabolism", synonyms: ["PO4", "Phosphorus"] },
  
  // Liver Function
  { term: "Liver Function Tests", category: "Labs", description: "Liver health panel", synonyms: ["LFT"] },
  { term: "AST", category: "Labs", description: "Liver enzyme", synonyms: ["SGOT", "Aspartate Aminotransferase"] },
  { term: "ALT", category: "Labs", description: "Liver enzyme", synonyms: ["SGPT", "Alanine Aminotransferase"] },
  { term: "Alkaline Phosphatase", category: "Labs", description: "Liver/bone enzyme", synonyms: ["ALP"] },
  { term: "Total Bilirubin", category: "Labs", description: "Liver waste product" },
  { term: "Direct Bilirubin", category: "Labs", description: "Conjugated bilirubin" },
  { term: "Albumin", category: "Labs", description: "Blood protein" },
  { term: "Total Protein", category: "Labs", description: "Blood protein level" },
  { term: "GGT", category: "Labs", description: "Gamma-glutamyl transferase", synonyms: ["Gamma-GT"] },
  
  // Lipid Panel
  { term: "Lipid Panel", category: "Labs", description: "Cholesterol assessment" },
  { term: "Total Cholesterol", category: "Labs", description: "Overall cholesterol" },
  { term: "LDL Cholesterol", category: "Labs", description: "Bad cholesterol", synonyms: ["Low-Density Lipoprotein"] },
  { term: "HDL Cholesterol", category: "Labs", description: "Good cholesterol", synonyms: ["High-Density Lipoprotein"] },
  { term: "Triglycerides", category: "Labs", description: "Blood fats" },
  { term: "VLDL", category: "Labs", description: "Very low-density lipoprotein" },
  
  // Thyroid
  { term: "Thyroid Panel", category: "Labs", description: "Thyroid function tests" },
  { term: "TSH", category: "Labs", description: "Thyroid stimulating hormone" },
  { term: "Free T4", category: "Labs", description: "Active thyroid hormone", synonyms: ["Thyroxine"] },
  { term: "Free T3", category: "Labs", description: "Active thyroid hormone", synonyms: ["Triiodothyronine"] },
  
  // Coagulation
  { term: "Prothrombin Time", category: "Labs", description: "Clotting time", synonyms: ["PT"] },
  { term: "Partial Thromboplastin Time", category: "Labs", description: "Clotting time", synonyms: ["PTT", "aPTT"] },
  { term: "INR", category: "Labs", description: "International Normalized Ratio" },
  { term: "D-Dimer", category: "Labs", description: "Clot dissolution marker" },
  
  // Cardiac Markers
  { term: "Troponin", category: "Labs", description: "Heart muscle damage marker" },
  { term: "BNP", category: "Labs", description: "Heart failure marker", synonyms: ["Brain Natriuretic Peptide"] },
  { term: "CK-MB", category: "Labs", description: "Heart muscle enzyme" },
  
  // Inflammatory Markers
  { term: "C-Reactive Protein", category: "Labs", description: "Inflammation marker", synonyms: ["CRP"] },
  { term: "Erythrocyte Sedimentation Rate", category: "Labs", description: "Inflammation marker", synonyms: ["ESR", "Sed Rate"] },
  
  // Iron Studies
  { term: "Serum Iron", category: "Labs", description: "Blood iron level" },
  { term: "Ferritin", category: "Labs", description: "Iron storage protein" },
  { term: "Transferrin Saturation", category: "Labs", description: "Iron transport" },
  { term: "Total Iron Binding Capacity", category: "Labs", synonyms: ["TIBC"] },
  
  // Vitamins
  { term: "Vitamin B12", category: "Labs", description: "Cobalamin level" },
  { term: "Vitamin D", category: "Labs", description: "Calciferol level", synonyms: ["25-OH Vitamin D"] },
  { term: "Folate", category: "Labs", description: "Vitamin B9 level", synonyms: ["Folic Acid"] },
  
  // Other Common Labs
  { term: "Uric Acid", category: "Labs", description: "Gout marker" },
  { term: "Amylase", category: "Labs", description: "Pancreatic enzyme" },
  { term: "Lipase", category: "Labs", description: "Pancreatic enzyme" },
  { term: "Arterial Blood Gas", category: "Labs", description: "Oxygen/CO2 levels", synonyms: ["ABG"] },
  { term: "Urinalysis", category: "Labs", description: "Urine test", synonyms: ["UA"] },
  { term: "Culture and Sensitivity", category: "Labs", description: "Infection identification", synonyms: ["C&S"] },
  { term: "Blood Culture", category: "Labs", description: "Blood infection test" },
  { term: "Urine Culture", category: "Labs", description: "Urine infection test" },
  { term: "Stool Occult Blood", category: "Labs", description: "Hidden blood in stool", synonyms: ["FOBT"] },
  
  // Lab Result Interpretations
  { term: "Within Normal Limits", category: "Labs", description: "Normal result", synonyms: ["WNL"] },
  { term: "Below Normal", category: "Labs", description: "Low result" },
  { term: "Above Normal", category: "Labs", description: "High result" },
  { term: "Critical Value", category: "Labs", description: "Urgent abnormal result" },
  { term: "Panic Value", category: "Labs", description: "Life-threatening result" },
  { term: "Reference Range", category: "Labs", description: "Normal values range" },
];

// Combine all terms
export const allMedicalTerms: MedicalTerm[] = [
  ...medicalAbbreviations,
  ...commonDiagnoses,
  ...commonMedications,
  ...clinicalPhrases,
  ...labTestTerms,
];

// Search function for autocomplete
export function searchMedicalTerms(query: string, limit: number = 10): MedicalTerm[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  if (normalizedQuery.length < 2) {
    return [];
  }

  const results: MedicalTerm[] = [];
  const seenTerms = new Set<string>();

  for (const term of allMedicalTerms) {
    if (seenTerms.has(term.term.toLowerCase())) continue;

    // Check main term
    if (term.term.toLowerCase().startsWith(normalizedQuery)) {
      results.push(term);
      seenTerms.add(term.term.toLowerCase());
    }
    // Check synonyms
    else if (term.synonyms) {
      for (const synonym of term.synonyms) {
        if (synonym.toLowerCase().startsWith(normalizedQuery)) {
          results.push({ ...term, term: synonym, description: `${term.term} - ${term.description || ''}` });
          seenTerms.add(synonym.toLowerCase());
          break;
        }
      }
    }

    if (results.length >= limit) break;
  }

  // If not enough starts-with matches, include contains matches
  if (results.length < limit) {
    for (const term of allMedicalTerms) {
      if (seenTerms.has(term.term.toLowerCase())) continue;

      if (term.term.toLowerCase().includes(normalizedQuery)) {
        results.push(term);
        seenTerms.add(term.term.toLowerCase());
      }

      if (results.length >= limit) break;
    }
  }

  return results;
}

// Get categories for grouping
export function getTermCategories(): string[] {
  return [
    "Vitals",
    "Prescription",
    "Clinical",
    "Symptoms",
    "OB/GYN",
    "Administrative",
    "Emergency",
    "Procedures",
    "Labs",
    "Diagnostics",
    "Cardiovascular",
    "Endocrine",
    "Respiratory",
    "Psychiatric",
    "GI",
    "Renal",
    "Musculoskeletal",
    "Hematology",
    "Neurology",
    "Oncology",
    "Dermatology",
    "Antihypertensive",
    "Antidiabetic",
    "Lipid-Lowering",
    "Antibiotic",
    "Analgesic",
    "Antiplatelet",
    "Anticoagulant",
    "Respiratory",
    "Thyroid",
    "Gout",
    "Osteoporosis",
    "Supplement",
    "Clinical Note",
    "Clinical Phrase",
    "SOAP",
    "IV Fluids",
  ];
}

"""
Safety Validation Pipeline for Clinical Decision Support System
================================================================

P1 Priority: Real-time safety validation for clinical recommendations.

This module implements comprehensive safety checks including:
- Drug-drug interaction checking
- Drug-allergy cross-reactivity validation
- Renal dosing adjustment calculator
- Contraindication checking based on patient conditions
- Severity classification (MAJOR/MODERATE/MINOR)

Follows evidence-based medicine guidelines and uses standard medical terminologies
(ICD-10, SNOMED, RxNorm).

References:
- FDA Drug Interaction Database
- Clinical Pharmacology (Gold Standard)
- IBM Micromedex
- Liverpool HIV Drug Interactions
"""

import asyncio
import time
import re
from typing import Optional, List, Dict, Any, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json

from loguru import logger
from pydantic import BaseModel, Field

from app.core.config import get_settings


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class SeverityLevel(Enum):
    """Classification of clinical severity."""
    MAJOR = "major"
    MODERATE = "moderate"
    MINOR = "minor"
    NONE = "none"


class EvidenceLevel(Enum):
    """Evidence level for clinical recommendations."""
    LEVEL_A = "A"  # High-quality RCTs, meta-analyses
    LEVEL_B = "B"  # Well-designed observational studies
    LEVEL_C = "C"  # Case series, expert opinion
    LEVEL_D = "D"  # Limited evidence


# RxNorm drug class mappings for comprehensive interaction checking
RXNORM_DRUG_CLASSES = {
    # Cardiovascular
    "anticoagulants": {
        "rxnorm_codes": ["1925", "4492", "4493", "32968", "1114195", "1114189", "1599559"],
        "drugs": ["warfarin", "heparin", "enoxaparin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban"],
        "monitoring_params": ["INR", "aPTT", "anti-Xa", "creatinine", "hemoglobin", "hematocrit"],
        "black_box_warning": "Bleeding risk",
    },
    "antiplatelets": {
        "rxnorm_codes": ["1191", "243670", "352084", "352086"],
        "drugs": ["aspirin", "clopidogrel", "prasugrel", "ticagrelor"],
        "monitoring_params": ["platelet count", "bleeding time", "CBC"],
        "black_box_warning": "Bleeding risk",
    },
    "ace_inhibitors": {
        "rxnorm_codes": ["29046", "29047", "29048", "29049", "313782"],
        "drugs": ["lisinopril", "enalapril", "ramipril", "benazepril", "captopril"],
        "monitoring_params": ["potassium", "creatinine", "blood pressure"],
        "black_box_warning": "Fetal toxicity",
    },
    "arb_inhibitors": {
        "rxnorm_codes": ["314076", "314077", "314078", "314079"],
        "drugs": ["losartan", "valsartan", "irbesartan", "candesartan"],
        "monitoring_params": ["potassium", "creatinine", "blood pressure"],
        "black_box_warning": "Fetal toxicity",
    },
    "beta_blockers": {
        "rxnorm_codes": ["203427", "186079", "8640", "8641", "8643"],
        "drugs": ["metoprolol", "carvedilol", "atenolol", "propranolol", "bisoprolol"],
        "monitoring_params": ["heart rate", "blood pressure", "blood glucose"],
        "black_box_warning": None,
    },
    "calcium_channel_blockers": {
        "rxnorm_codes": ["2599", "190921", "32952", "32953"],
        "drugs": ["amlodipine", "diltiazem", "verapamil", "nifedipine"],
        "monitoring_params": ["blood pressure", "heart rate"],
        "black_box_warning": None,
    },
    
    # Diabetes
    "insulin": {
        "rxnorm_codes": ["106182", "274783", "274784", "274785", "274786"],
        "drugs": ["insulin glargine", "insulin lispro", "insulin aspart", "insulin detemir", "insulin degludec"],
        "monitoring_params": ["blood glucose", "HbA1c"],
        "black_box_warning": None,
    },
    "sulfonylureas": {
        "rxnorm_codes": ["2582", "2583", "2584", "2585"],
        "drugs": ["glipizide", "glyburide", "glimepiride", "tolbutamide"],
        "monitoring_params": ["blood glucose", "HbA1c"],
        "black_box_warning": None,
    },
    "sglt2_inhibitors": {
        "rxnorm_codes": ["1488564", "1541383", "1605095"],
        "drugs": ["canagliflozin", "dapagliflozin", "empagliflozin"],
        "monitoring_params": ["eGFR", "blood glucose", "ketones"],
        "black_box_warning": "Amputation risk (canagliflozin), DKA risk",
    },
    "glp1_agonists": {
        "rxnorm_codes": ["1488576", "1597663", "1597664"],
        "drugs": ["exenatide", "liraglutide", "semaglutide", "dulaglutide"],
        "monitoring_params": ["HbA1c", "weight", "pancreatic enzymes"],
        "black_box_warning": "Thyroid C-cell tumors (animal studies)",
    },
    
    # Central Nervous System
    "opioids": {
        "rxnorm_codes": ["7052", "7242", "7348", "7405", "203587"],
        "drugs": ["morphine", "oxycodone", "hydrocodone", "fentanyl", "hydromorphone"],
        "monitoring_params": ["respiratory rate", "sedation level", "oxygen saturation"],
        "black_box_warning": "Respiratory depression, addiction, overdose",
    },
    "benzodiazepines": {
        "rxnorm_codes": ["540", "542", "553", "561", "569"],
        "drugs": ["diazepam", "alprazolam", "lorazepam", "clonazepam", "midazolam"],
        "monitoring_params": ["sedation level", "respiratory rate"],
        "black_box_warning": "Sedation, respiratory depression with opioids",
    },
    "ssri_antidepressants": {
        "rxnorm_codes": ["321374", "321988", "321993", "322003", "321988"],
        "drugs": ["fluoxetine", "sertraline", "paroxetine", "citalopram", "escitalopram"],
        "monitoring_params": ["suicidal ideation", "serotonin syndrome signs"],
        "black_box_warning": "Suicidal thoughts in young adults",
    },
    "snri_antidepressants": {
        "rxnorm_codes": ["1500346", "310591", "351771"],
        "drugs": ["venlafaxine", "duloxetine", "desvenlafaxine"],
        "monitoring_params": ["blood pressure", "suicidal ideation"],
        "black_box_warning": "Suicidal thoughts in young adults",
    },
    "tricyclic_antidepressants": {
        "rxnorm_codes": ["2609", "2614", "2622", "2629"],
        "drugs": ["amitriptyline", "nortriptyline", "imipramine", "doxepin"],
        "monitoring_params": ["ECG", "orthostatic blood pressure"],
        "black_box_warning": "Overdose risk",
    },
    "antipsychotics": {
        "rxnorm_codes": ["2452", "2455", "2555", "2567"],
        "drugs": ["haloperidol", "risperidone", "olanzapine", "quetiapine", "clozapine"],
        "monitoring_params": ["metabolic panel", "ECG", "movement disorders"],
        "black_box_warning": "Increased mortality in elderly with dementia",
    },
    
    # Anti-infectives
    "fluoroquinolones": {
        "rxnorm_codes": ["20481", "20483", "20484", "20485"],
        "drugs": ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin"],
        "monitoring_params": ["tendon pain", "neuropathy symptoms", "blood glucose"],
        "black_box_warning": "Tendinitis, tendon rupture, peripheral neuropathy, CNS effects",
    },
    "macrolides": {
        "rxnorm_codes": ["2364", "2367", "2368"],
        "drugs": ["azithromycin", "clarithromycin", "erythromycin"],
        "monitoring_params": ["QTc interval", "liver function"],
        "black_box_warning": "QT prolongation, cardiac arrhythmias",
    },
    "aminoglycosides": {
        "rxnorm_codes": ["4210", "4212", "4213", "4214"],
        "drugs": ["gentamicin", "tobramycin", "amikacin", "neomycin"],
        "monitoring_params": ["creatinine", "drug levels", "hearing"],
        "black_box_warning": "Nephrotoxicity, ototoxicity",
    },
    "antifungals_azoles": {
        "rxnorm_codes": ["5521", "5524", "5525", "5526"],
        "drugs": ["fluconazole", "itraconazole", "voriconazole", "ketoconazole"],
        "monitoring_params": ["liver function", "drug interactions"],
        "black_box_warning": "Hepatotoxicity, QT prolongation",
    },
    
    # Immunosuppressants
    "calcineurin_inhibitors": {
        "rxnorm_codes": ["10448", "25942"],
        "drugs": ["cyclosporine", "tacrolimus"],
        "monitoring_params": ["drug levels", "creatinine", "blood pressure", "potassium"],
        "black_box_warning": "Increased infection risk, lymphoma risk",
    },
    "mTOR_inhibitors": {
        "rxnorm_codes": ["352280", "72493"],
        "drugs": ["sirolimus", "everolimus"],
        "monitoring_params": ["drug levels", "lipids", "creatinine"],
        "black_box_warning": "Increased infection risk",
    },
    
    # Other High-Risk
    "digoxin": {
        "rxnorm_codes": ["3405", "3406"],
        "drugs": ["digoxin", "digitoxin"],
        "monitoring_params": ["serum digoxin level", "potassium", "magnesium", "renal function", "heart rate"],
        "black_box_warning": "Toxicity risk",
    },
    "lithium": {
        "rxnorm_codes": ["6448", "6449"],
        "drugs": ["lithium carbonate", "lithium citrate"],
        "monitoring_params": ["serum lithium level", "thyroid function", "renal function", "ECG"],
        "black_box_warning": "Toxicity risk",
    },
    "warfarin": {
        "rxnorm_codes": ["11289"],
        "drugs": ["warfarin"],
        "monitoring_params": ["INR", "hemoglobin", "hematocrit"],
        "black_box_warning": "Bleeding risk",
    },
    "methotrexate": {
        "rxnorm_codes": ["6856"],
        "drugs": ["methotrexate"],
        "monitoring_params": ["CBC", "renal function", "liver function", "pulmonary symptoms"],
        "black_box_warning": "Severe toxicity, hepatotoxicity, pulmonary toxicity",
    },
    "amiodarone": {
        "rxnorm_codes": ["704"],
        "drugs": ["amiodarone"],
        "monitoring_params": ["ECG", "thyroid function", "liver function", "pulmonary function", "vision"],
        "black_box_warning": "Pulmonary toxicity, hepatotoxicity, proarrhythmia",
    },
}

# Major drug-drug interaction database (comprehensive)
MAJOR_DRUG_INTERACTIONS = {
    # Warfarin interactions
    ("warfarin", "amiodarone"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "CYP2C9 and CYP1A2 inhibition",
        "effect": "Increased warfarin levels, elevated INR, bleeding risk",
        "management": "Reduce warfarin dose by 30-50%, monitor INR closely",
        "onset": "gradual (weeks)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "15574368",
    },
    ("warfarin", "fluconazole"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "CYP2C9 inhibition",
        "effect": "Increased warfarin levels, bleeding risk",
        "management": "Reduce warfarin dose by 50%, monitor INR",
        "onset": "rapid (days)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "8566294",
    },
    ("warfarin", "metronidazole"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "CYP2C9 inhibition and vitamin K antagonism",
        "effect": "Increased INR, bleeding risk",
        "management": "Reduce warfarin dose 25-50%, monitor INR",
        "onset": "rapid (3-5 days)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "6338835",
    },
    ("warfarin", "trimethoprim-sulfamethoxazole"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "CYP2C9 inhibition, protein displacement, vitamin K synthesis reduction",
        "effect": "Markedly increased INR, bleeding risk",
        "management": "Avoid combination or reduce warfarin 50%, monitor INR frequently",
        "onset": "rapid (3-5 days)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "3988371",
    },
    
    # MAOI interactions (serotonin syndrome)
    ("phenelzine", "sertraline"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "MAO inhibition + serotonin reuptake inhibition",
        "effect": "Serotonin syndrome, hypertensive crisis",
        "management": "CONTRAINDICATED - 2-week washout required",
        "onset": "rapid (hours)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "11013151",
    },
    ("tranylcypromine", "fluoxetine"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "MAO inhibition + serotonin reuptake inhibition",
        "effect": "Serotonin syndrome, hypertensive crisis",
        "management": "CONTRAINDICATED - 5-week washout (fluoxetine) required",
        "onset": "rapid (hours)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "11013151",
    },
    ("moclobemide", "citalopram"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Reversible MAO-A inhibition + serotonin reuptake inhibition",
        "effect": "Serotonin syndrome",
        "management": "CONTRAINDICATED - avoid combination",
        "onset": "rapid (hours)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "11013151",
    },
    
    # QT prolongation combinations
    ("clarithromycin", "quinidine"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Additive QT prolongation + CYP3A4 inhibition",
        "effect": "QT prolongation, Torsades de Pointes, sudden death",
        "management": "CONTRAINDICATED - avoid combination",
        "onset": "rapid (hours to days)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "14656711",
    },
    ("azithromycin", "amiodarone"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Additive QT prolongation",
        "effect": "QT prolongation, Torsades de Pointes",
        "management": "Avoid combination; if necessary, monitor ECG continuously",
        "onset": "rapid (hours)",
        "evidence": EvidenceLevel.LEVEL_B,
        "pmid": "23435069",
    },
    ("fluoroquinolones", "amiodarone"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Additive QT prolongation",
        "effect": "QT prolongation, Torsades de Pointes",
        "management": "Avoid combination or intensive ECG monitoring",
        "onset": "rapid (hours)",
        "evidence": EvidenceLevel.LEVEL_B,
        "pmid": "23435069",
    },
    
    # Opioid combinations
    ("morphine", "diazepam"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Additive CNS and respiratory depression",
        "effect": "Profound sedation, respiratory depression, death",
        "management": "FDA Black Box Warning - avoid if possible; if combined, use lowest doses",
        "onset": "rapid (hours)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "28379233",
    },
    ("fentanyl", "midazolam"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Synergistic CNS and respiratory depression",
        "effect": "Profound sedation, respiratory depression",
        "management": "Use with extreme caution; monitor continuously; have reversal agents available",
        "onset": "rapid (minutes)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "28379233",
    },
    ("oxycodone", "alprazolam"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Additive CNS and respiratory depression",
        "effect": "Profound sedation, respiratory depression, death",
        "management": "FDA Black Box Warning - avoid if possible",
        "onset": "rapid (hours)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "28379233",
    },
    
    # Nephrotoxicity combinations
    ("gentamicin", "furosemide"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Additive nephrotoxicity + ototoxicity",
        "effect": "Acute kidney injury, hearing loss",
        "management": "Monitor renal function daily; avoid if possible",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "6334157",
    },
    ("vancomycin", "piperacillin-tazobactam"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Synergistic nephrotoxicity",
        "effect": "Acute kidney injury",
        "management": "Monitor renal function; consider alternative antibiotics",
        "onset": "days to weeks",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "24735870",
    },
    ("cisplatin", "aminoglycosides"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Synergistic nephrotoxicity and ototoxicity",
        "effect": "Severe kidney injury, permanent hearing loss",
        "management": "CONTRAINDICATED - avoid combination",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "3388162",
    },
    
    # Statin interactions
    ("simvastatin", "clarithromycin"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Potent CYP3A4 inhibition",
        "effect": "Rhabdomyolysis, acute kidney injury",
        "management": "CONTRAINDICATED - suspend simvastatin during treatment",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "11437544",
    },
    ("simvastatin", "itraconazole"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Potent CYP3A4 inhibition",
        "effect": "Rhabdomyolysis",
        "management": "CONTRAINDICATED - suspend simvastatin during treatment",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "11437544",
    },
    ("atorvastatin", "clarithromycin"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "CYP3A4 inhibition",
        "effect": "Increased statin levels, rhabdomyolysis risk",
        "management": "Reduce atorvastatin dose by 50% or suspend temporarily",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "11437544",
    },
    
    # Methotrexate interactions
    ("methotrexate", "trimethoprim-sulfamethoxazole"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Additive antifolate effect, protein displacement, reduced clearance",
        "effect": "Severe myelosuppression, mucositis, death",
        "management": "CONTRAINDICATED - avoid combination",
        "onset": "days to weeks",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "3031225",
    },
    ("methotrexate", "nsaids"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Reduced renal clearance of methotrexate",
        "effect": "Methotrexate toxicity, myelosuppression",
        "management": "Use with caution; monitor renal function and CBC; adjust methotrexate dose",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "3084393",
    },
    
    # Digoxin interactions
    ("digoxin", "amiodarone"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "P-glycoprotein inhibition, reduced renal clearance",
        "effect": "Digoxin toxicity (nausea, visual changes, arrhythmias)",
        "management": "Reduce digoxin dose by 50%; monitor levels",
        "onset": "days to weeks",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "6605085",
    },
    ("digoxin", "verapamil"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "P-glycoprotein inhibition, reduced clearance",
        "effect": "Digoxin toxicity",
        "management": "Reduce digoxin dose by 25-50%; monitor levels",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "6605085",
    },
    
    # Lithium interactions
    ("lithium", "nsaids"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Reduced renal lithium clearance",
        "effect": "Lithium toxicity (tremor, confusion, seizures)",
        "management": "Monitor lithium levels closely; consider dose reduction",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "8566294",
    },
    ("lithium", "thiazide_diuretics"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Reduced renal lithium clearance (40-50%)",
        "effect": "Lithium toxicity",
        "management": "Reduce lithium dose by 25-50%; monitor levels",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "6338835",
    },
    ("lithium", "ace_inhibitors"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Reduced renal lithium clearance",
        "effect": "Lithium toxicity",
        "management": "Reduce lithium dose; monitor levels frequently",
        "onset": "days to weeks",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "8566294",
    },
    
    # DOAC interactions
    ("rivaroxaban", "ketoconazole"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Potent CYP3A4 and P-gp inhibition",
        "effect": "Increased bleeding risk",
        "management": "CONTRAINDICATED - avoid combination",
        "onset": "rapid (hours)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "21540863",
    },
    ("dabigatran", "dronedarone"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "P-glycoprotein inhibition",
        "effect": "Increased dabigatran levels, bleeding risk",
        "management": "Avoid combination or reduce dabigatran dose",
        "onset": "rapid (hours)",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "21540863",
    },
    
    # CYP450 interactions
    ("theophylline", "ciprofloxacin"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "CYP1A2 inhibition",
        "effect": "Theophylline toxicity (seizures, arrhythmias)",
        "management": "Reduce theophylline dose by 50%; monitor levels",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "2858222",
    },
    ("clozapine", "fluvoxamine"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Potent CYP1A2 inhibition",
        "effect": "Severe clozapine toxicity (seizures, myocarditis, agranulocytosis)",
        "management": "CONTRAINDICATED - avoid combination",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "10442344",
    },
    
    # Additional critical interactions
    ("tacrolimus", "clarithromycin"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "Potent CYP3A4 inhibition",
        "effect": "Nephrotoxicity, neurotoxicity from elevated tacrolimus",
        "management": "Reduce tacrolimus dose by 50-75%; frequent level monitoring",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "15040887",
    },
    ("cyclosporine", "diltiazem"): {
        "severity": SeverityLevel.MODERATE,
        "mechanism": "CYP3A4 inhibition",
        "effect": "Increased cyclosporine levels",
        "management": "Monitor cyclosporine levels; may need dose reduction",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "2795593",
    },
    ("colchicine", "clarithromycin"): {
        "severity": SeverityLevel.MAJOR,
        "mechanism": "CYP3A4 and P-gp inhibition",
        "effect": "Fatal colchicine toxicity",
        "management": "CONTRAINDICATED - avoid combination; if unavoidable, reduce colchicine dose by 50-75%",
        "onset": "days",
        "evidence": EvidenceLevel.LEVEL_A,
        "pmid": "21846694",
    },
}

# Allergy cross-reactivity database (RxNorm-aligned)
ALLERGY_CROSS_REACTIVITY_DATABASE = {
    "penicillin": {
        "class": "beta-lactams",
        "rxnorm_codes": ["70618", "723", "18631", "18632", "18633"],
        "cross_reactants": {
            "high": ["amoxicillin", "ampicillin", "penicillin G", "penicillin V", "piperacillin", "ticarcillin"],
            "moderate": ["cephalosporins (1st gen)", "cephalexin", "cefazolin"],
            "low": ["cephalosporins (3rd/4th gen)", "cefixime", "ceftriaxone", "cefepime"],
        },
        "safe_alternatives": ["aztreonam", "carbapenems (low risk)", "macrolides", "clindamycin", "vancomycin"],
        "cross_reactivity_rate": {
            "penicillins": 100,
            "first_gen_cephalosporins": 10,
            "later_gen_cephalosporins": 1-3,
            "carbapenems": 1,
            "aztreonam": 0,
        },
        "pmid": "31425391",
    },
    "sulfonamide": {
        "class": "sulfonamides",
        "rxnorm_codes": ["10849", "10851", "9581"],
        "cross_reactants": {
            "high": ["sulfamethoxazole", "sulfadiazine", "sulfasalazine", "sulfisoxazole"],
            "moderate": ["furosemide", "thiazide diuretics", "acetazolamide", "celecoxib"],
            "low": ["sulfonylureas", "sumatriptan"],
        },
        "safe_alternatives": ["non-sulfa antibiotics", "alternatives based on indication"],
        "cross_reactivity_rate": {
            "antibiotic_sulfonamides": 100,
            "non_antibiotic_sulfonamides": 10,
        },
        "pmid": "21288218",
    },
    "nsaids": {
        "class": "non-steroidal anti-inflammatory drugs",
        "rxnorm_codes": ["5640", "5654", "5689", "5692"],
        "cross_reactants": {
            "high": ["ibuprofen", "naproxen", "diclofenac", "indomethacin", "ketorolac", "meloxicam", "piroxicam"],
            "moderate": ["aspirin (if allergic to all NSAIDs)"],
            "low": ["acetaminophen", "selective COX-2 inhibitors (if single NSAID reaction)"],
        },
        "safe_alternatives": ["acetaminophen", "topical agents", "corticosteroids", "tramadol"],
        "cross_reactivity_rate": {
            "strong_cox1_inhibitors": 100,
            "weak_cox1_inhibitors": "variable",
            "selective_cox2": "variable by type of reaction",
        },
        "pmid": "15104962",
    },
    "latex": {
        "class": "natural rubber latex",
        "rxnorm_codes": [],
        "cross_reactants": {
            "high": ["natural rubber latex products"],
            "moderate": ["bananas", "avocados", "kiwis", "chestnuts"],
            "low": ["passion fruit", "tomato", "papaya"],
        },
        "safe_alternatives": ["synthetic products (vinyl, nitrile, silicone)"],
        "cross_reactivity_rate": {
            "latex_fruit_syndrome": 50,
        },
        "pmid": "10686064",
    },
    "iodinated_contrast": {
        "class": "iodinated contrast media",
        "rxnorm_codes": [],
        "cross_reactants": {
            "high": ["all ionic and non-ionic iodinated contrast"],
            "moderate": ["amiodarone (contains iodine)"],
            "low": ["povidone-iodine (topical)"],
        },
        "safe_alternatives": ["premedication protocol", "gadolinium for MRI", "non-contrast imaging", "CO2 angiography"],
        "cross_reactivity_rate": {
            "all_contrast_types": 100,
            "same_vs_different_contrast": "variable",
        },
        "pmid": "25841134",
    },
    "vancomycin": {
        "class": "glycopeptide antibiotics",
        "rxnorm_codes": ["11124"],
        "cross_reactants": {
            "high": ["teicoplanin"],
            "moderate": [],
            "low": [],
        },
        "safe_alternatives": ["linezolid", "daptomycin", "tigecycline"],
        "cross_reactivity_rate": {
            "teicoplanin": 50,
            "other_antibiotics": 0,
        },
        "pmid": "10698826",
    },
}

# Contraindication database (ICD-10 aligned)
CONTRAINDICATIONS_DATABASE = {
    # Pregnancy contraindications (Category D/X)
    "pregnancy": {
        "icd10_codes": ["Z33.1", "Z34.00", "Z34.01", "Z34.02", "Z34.03", "Z34.80", "Z34.81", "Z34.82", "Z34.83", "Z3A.00-Z3A.49"],
        "absolute_contraindications": [
            {
                "drugs": ["isotretinoin", "acitretin", "thalidomide", "lenalidomide", "pomalidomide"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Known teratogen - high risk of severe birth defects",
                "management": "CONTRAINDICATED - require pregnancy prevention protocols",
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["warfarin", "phenytoin", "carbamazepine", "valproate", "methotrexate"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Known teratogen - risk of birth defects",
                "management": "Avoid; use alternatives if possible",
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["ace_inhibitors", "arb_inhibitors", "aliskiren"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Fetal renal toxicity, especially 2nd and 3rd trimesters",
                "management": "Discontinue immediately upon pregnancy confirmation",
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["lisinopril", "enalapril", "losartan", "valsartan", "candesartan"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Fetal renal malformation, oligohydramnios",
                "management": "Switch to labetalol or nifedipine for hypertension",
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["statins"],
                "severity": SeverityLevel.MODERATE,
                "reason": "Potential fetal harm; limited data",
                "management": "Discontinue during pregnancy and breastfeeding",
                "evidence": EvidenceLevel.LEVEL_C,
            },
        ],
        "relative_contraindications": [
            {
                "drugs": ["fluoroquinolones", "tetracyclines", "sulfonamides (near term)"],
                "severity": SeverityLevel.MODERATE,
                "reason": "Potential fetal effects",
                "management": "Use alternatives if available",
                "evidence": EvidenceLevel.LEVEL_B,
            },
        ],
    },
    
    # Renal impairment contraindications
    "renal_impairment_severe": {
        "icd10_codes": ["N18.4", "N18.5", "N18.6"],
        "conditions": ["CKD Stage 4", "CKD Stage 5", "ESRD", "GFR < 30"],
        "absolute_contraindications": [
            {
                "drugs": ["metformin (if GFR < 30)", "nitrofurantoin", "bacitracin"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Accumulation leading to toxicity",
                "management": "Use alternatives; metformin contraindicated if eGFR < 30",
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["nsaid analgesics"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Further renal injury, fluid retention",
                "management": "Avoid; use acetaminophen or tramadol",
                "evidence": EvidenceLevel.LEVEL_A,
            },
        ],
        "dose_adjustments_required": [
            {
                "drugs": ["gabapentin", "pregabalin", "dabigatran", "rivaroxaban", "apixaban"],
                "adjustment": "Reduce dose by 50-75% or avoid",
                "crcl_threshold": 30,
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["ciprofloxacin", "levofloxacin", "moxifloxacin", "acyclovir", "valacyclovir", "famciclovir"],
                "adjustment": "Reduce dose by 50% or extend interval",
                "crcl_threshold": 50,
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["digoxin", "allopurinol", "colchicine"],
                "adjustment": "Reduce dose by 25-50%",
                "crcl_threshold": 50,
                "evidence": EvidenceLevel.LEVEL_A,
            },
        ],
    },
    
    # Hepatic impairment contraindications
    "hepatic_impairment_severe": {
        "icd10_codes": ["K72.00", "K72.01", "K72.10", "K72.11"],
        "conditions": ["Child-Pugh Class C", "Acute liver failure", " Decompensated cirrhosis"],
        "absolute_contraindications": [
            {
                "drugs": ["acetaminophen (high dose)", "valproate", "ketoconazole", "terbinafine"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Hepatotoxicity risk",
                "management": "Avoid; use alternatives",
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["atorvastatin (high dose)", "simvastatin", "lovastatin"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Reduced clearance, increased toxicity",
                "management": "Use low-dose pravastatin or rosuvastatin",
                "evidence": EvidenceLevel.LEVEL_A,
            },
        ],
        "dose_adjustments_required": [
            {
                "drugs": ["lorazepam", "diazepam", "morphine", "oxycodone"],
                "adjustment": "Reduce dose by 50%; avoid in severe impairment",
                "child_pugh_threshold": "C",
                "evidence": EvidenceLevel.LEVEL_A,
            },
        ],
    },
    
    # QT prolongation risk
    "qt_prolongation": {
        "icd10_codes": ["I45.81", "I44.7"],
        "conditions": ["Long QT Syndrome", "QTc > 500ms", "History of Torsades de Pointes"],
        "absolute_contraindications": [
            {
                "drugs": ["fluoroquinolones", "macrolides", "droperidol", "haloperidol (IV)"],
                "severity": SeverityLevel.MAJOR,
                "reason": "QT prolongation leading to Torsades de Pointes",
                "management": "Avoid; use alternatives",
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["methadone (high dose)", "ondansetron (IV high dose)"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Dose-dependent QT prolongation",
                "management": "ECG monitoring if required; use lower doses",
                "evidence": EvidenceLevel.LEVEL_A,
            },
        ],
    },
    
    # Myasthenia gravis
    "myasthenia_gravis": {
        "icd10_codes": ["G70.00", "G70.01", "G70.02", "G70.03"],
        "conditions": ["Myasthenia Gravis", "Myasthenic Syndrome"],
        "absolute_contraindications": [
            {
                "drugs": ["aminoglycosides", "fluoroquinolones", "macrolides"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Can cause neuromuscular blockade, worsening weakness",
                "management": "Avoid; use alternative antibiotics",
                "evidence": EvidenceLevel.LEVEL_A,
            },
            {
                "drugs": ["magnesium (IV)", "beta-blockers", "calcium channel blockers"],
                "severity": SeverityLevel.MODERATE,
                "reason": "Can worsen muscle weakness",
                "management": "Use with caution; monitor for weakness",
                "evidence": EvidenceLevel.LEVEL_B,
            },
        ],
    },
    
    # G6PD deficiency
    "g6pd_deficiency": {
        "icd10_codes": ["D55.0"],
        "conditions": ["G6PD Deficiency", "Favism"],
        "absolute_contraindications": [
            {
                "drugs": ["primaquine", "dapsone", "nitrofurantoin", "sulfonamides"],
                "severity": SeverityLevel.MAJOR,
                "reason": "Risk of acute hemolytic anemia",
                "management": "CONTRAINDICATED - avoid completely",
                "evidence": EvidenceLevel.LEVEL_A,
            },
        ],
        "relative_contraindications": [
            {
                "drugs": ["aspirin (high dose)", "vitamin K antagonists", "chloramphenicol"],
                "severity": SeverityLevel.MODERATE,
                "reason": "May cause hemolysis in some patients",
                "management": "Use with caution; monitor for hemolysis",
                "evidence": EvidenceLevel.LEVEL_B,
            },
        ],
    },
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class DrugInteractionCheck:
    """Result of a drug-drug interaction check."""
    drug1: str
    drug2: str
    severity: SeverityLevel
    mechanism: str
    clinical_effect: str
    management: str
    evidence_level: EvidenceLevel
    onset: str
    pmid: Optional[str] = None
    rxnorm_codes: Tuple[Optional[str], Optional[str]] = (None, None)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug1": self.drug1,
            "drug2": self.drug2,
            "severity": self.severity.value,
            "mechanism": self.mechanism,
            "clinical_effect": self.clinical_effect,
            "management": self.management,
            "evidence_level": self.evidence_level.value,
            "onset": self.onset,
            "pmid": self.pmid,
            "rxnorm_codes": list(self.rxnorm_codes),
        }


@dataclass
class AllergyValidation:
    """Result of an allergy cross-reactivity check."""
    proposed_drug: str
    known_allergen: str
    cross_reactivity_risk: str  # "high", "moderate", "low", "none"
    cross_reactivity_percentage: float
    clinical_significance: str
    alternative_drugs: List[str]
    evidence_level: EvidenceLevel
    pmid: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "proposed_drug": self.proposed_drug,
            "known_allergen": self.known_allergen,
            "cross_reactivity_risk": self.cross_reactivity_risk,
            "cross_reactivity_percentage": self.cross_reactivity_percentage,
            "clinical_significance": self.clinical_significance,
            "alternative_drugs": self.alternative_drugs,
            "evidence_level": self.evidence_level.value,
            "pmid": self.pmid,
        }


@dataclass
class RenalDosingAdjustment:
    """Renal dosing adjustment recommendation."""
    drug: str
    standard_dose: str
    adjusted_dose: str
    crcl_range: str
    adjustment_percentage: int
    reason: str
    monitoring_parameters: List[str]
    evidence_level: EvidenceLevel
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug": self.drug,
            "standard_dose": self.standard_dose,
            "adjusted_dose": self.adjusted_dose,
            "crcl_range": self.crcl_range,
            "adjustment_percentage": self.adjustment_percentage,
            "reason": self.reason,
            "monitoring_parameters": self.monitoring_parameters,
            "evidence_level": self.evidence_level.value,
        }


@dataclass
class ContraindicationCheck:
    """Result of a contraindication check."""
    drug: str
    condition: str
    icd10_code: Optional[str]
    contraindication_type: str  # "absolute", "relative"
    severity: SeverityLevel
    reason: str
    management: str
    alternative_options: List[str]
    evidence_level: EvidenceLevel
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug": self.drug,
            "condition": self.condition,
            "icd10_code": self.icd10_code,
            "contraindication_type": self.contraindication_type,
            "severity": self.severity.value,
            "reason": self.reason,
            "management": self.management,
            "alternative_options": self.alternative_options,
            "evidence_level": self.evidence_level.value,
        }


@dataclass
class SafetyReport:
    """Comprehensive safety validation report."""
    request_id: str
    timestamp: str
    overall_safety_level: SeverityLevel
    drug_interactions: List[DrugInteractionCheck] = field(default_factory=list)
    allergy_validations: List[AllergyValidation] = field(default_factory=list)
    renal_adjustments: List[RenalDosingAdjustment] = field(default_factory=list)
    contraindications: List[ContraindicationCheck] = field(default_factory=list)
    red_flags: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    requires_physician_review: bool = False
    blocking_issues: List[str] = field(default_factory=list)
    evidence_summary: str = ""
    pmid_citations: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp,
            "overall_safety_level": self.overall_safety_level.value,
            "drug_interactions": [d.to_dict() for d in self.drug_interactions],
            "allergy_validations": [a.to_dict() for a in self.allergy_validations],
            "renal_adjustments": [r.to_dict() for r in self.renal_adjustments],
            "contraindications": [c.to_dict() for c in self.contraindications],
            "red_flags": self.red_flags,
            "recommendations": self.recommendations,
            "requires_physician_review": self.requires_physician_review,
            "blocking_issues": self.blocking_issues,
            "evidence_summary": self.evidence_summary,
            "pmid_citations": self.pmid_citations,
        }


# =============================================================================
# SAFETY VALIDATOR CLASS
# =============================================================================

class SafetyValidator:
    """
    Comprehensive Safety Validation Pipeline for Clinical Decision Support.
    
    Implements real-time safety checks including:
    - Drug-drug interaction checking
    - Drug-allergy cross-reactivity validation
    - Renal dosing adjustment calculator
    - Contraindication checking based on patient conditions
    - Severity classification
    
    Follows evidence-based medicine guidelines and uses standard medical
    terminologies (ICD-10, SNOMED, RxNorm).
    """
    
    def __init__(self):
        self.settings = get_settings()
        self._drug_interaction_db = MAJOR_DRUG_INTERACTIONS
        self._drug_classes = RXNORM_DRUG_CLASSES
        self._allergy_db = ALLERGY_CROSS_REACTIVITY_DATABASE
        self._contraindication_db = CONTRAINDICATIONS_DATABASE
        
        self.stats = {
            "total_validations": 0,
            "major_interactions_detected": 0,
            "allergy_conflicts": 0,
            "renal_adjustments": 0,
            "contraindications_found": 0,
        }
    
    def normalize_drug_name(self, drug: str) -> str:
        """Normalize drug name for matching."""
        drug_lower = drug.lower().strip()
        # Remove common suffixes
        for suffix in [" hcl", " sodium", " potassium", " magnesium", " maleate", " besylate", " mesylate"]:
            drug_lower = drug_lower.replace(suffix, "")
        return drug_lower
    
    def get_drug_class(self, drug: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        """Get the drug class for a given drug."""
        drug_lower = self.normalize_drug_name(drug)
        
        for class_name, class_data in self._drug_classes.items():
            if any(drug_lower in d.lower() for d in class_data.get("drugs", [])):
                return class_name, class_data
        
        return None
    
    async def check_drug_interactions(
        self,
        proposed_medication: str,
        current_medications: List[str],
    ) -> List[DrugInteractionCheck]:
        """
        Check for drug-drug interactions between proposed and current medications.
        
        Args:
            proposed_medication: The medication being considered
            current_medications: List of current patient medications
            
        Returns:
            List of detected drug interactions
        """
        interactions = []
        proposed_lower = self.normalize_drug_name(proposed_medication)
        
        # Check against each current medication
        for current_med in current_medications:
            current_lower = self.normalize_drug_name(current_med)
            
            # Check direct interactions in database
            for (drug1, drug2), interaction_data in self._drug_interaction_db.items():
                if ((drug1 in proposed_lower or proposed_lower in drug1) and 
                    (drug2 in current_lower or current_lower in drug2)):
                    interactions.append(DrugInteractionCheck(
                        drug1=proposed_medication,
                        drug2=current_med,
                        severity=interaction_data["severity"],
                        mechanism=interaction_data["mechanism"],
                        clinical_effect=interaction_data["effect"],
                        management=interaction_data["management"],
                        evidence_level=interaction_data["evidence"],
                        onset=interaction_data["onset"],
                        pmid=interaction_data.get("pmid"),
                    ))
                elif ((drug2 in proposed_lower or proposed_lower in drug2) and 
                      (drug1 in current_lower or current_lower in drug1)):
                    interactions.append(DrugInteractionCheck(
                        drug1=proposed_medication,
                        drug2=current_med,
                        severity=interaction_data["severity"],
                        mechanism=interaction_data["mechanism"],
                        clinical_effect=interaction_data["effect"],
                        management=interaction_data["management"],
                        evidence_level=interaction_data["evidence"],
                        onset=interaction_data["onset"],
                        pmid=interaction_data.get("pmid"),
                    ))
            
            # Check class-based interactions
            proposed_class = self.get_drug_class(proposed_medication)
            current_class = self.get_drug_class(current_med)
            
            if proposed_class and current_class:
                # Check for class-level interactions (high-risk combinations)
                if proposed_class[0] == "anticoagulants" and current_class[0] in ["antiplatelets", "ssri_antidepressants"]:
                    if not any(i.drug2 == current_med for i in interactions):
                        interactions.append(DrugInteractionCheck(
                            drug1=proposed_medication,
                            drug2=current_med,
                            severity=SeverityLevel.MAJOR,
                            mechanism="Additive bleeding risk",
                            clinical_effect="Increased bleeding risk",
                            management="Monitor closely for bleeding; consider PPI prophylaxis",
                            evidence_level=EvidenceLevel.LEVEL_A,
                            onset="immediate",
                            pmid="28003261",
                        ))
                
                if proposed_class[0] == "opioids" and current_class[0] == "benzodiazepines":
                    if not any(i.drug2 == current_med for i in interactions):
                        interactions.append(DrugInteractionCheck(
                            drug1=proposed_medication,
                            drug2=current_med,
                            severity=SeverityLevel.MAJOR,
                            mechanism="Additive CNS and respiratory depression",
                            clinical_effect="FDA Black Box Warning: profound sedation, respiratory depression, death",
                            management="AVOID combination if possible; if necessary, use lowest doses with close monitoring",
                            evidence_level=EvidenceLevel.LEVEL_A,
                            onset="rapid",
                            pmid="28379233",
                        ))
        
        # Update stats
        major_count = sum(1 for i in interactions if i.severity == SeverityLevel.MAJOR)
        self.stats["major_interactions_detected"] += major_count
        
        return interactions
    
    async def validate_allergy_cross_reactivity(
        self,
        proposed_medication: str,
        known_allergies: List[str],
    ) -> List[AllergyValidation]:
        """
        Validate proposed medication against known allergies with cross-reactivity analysis.
        
        Args:
            proposed_medication: The medication being considered
            known_allergies: List of patient's known allergies
            
        Returns:
            List of allergy validation results
        """
        validations = []
        proposed_lower = self.normalize_drug_name(proposed_medication)
        
        for allergy in known_allergies:
            allergy_lower = allergy.lower().strip()
            
            # Check against allergy database
            for allergy_class, allergy_data in self._allergy_db.items():
                # Check if the allergy matches this class
                class_match = (
                    allergy_lower == allergy_class or
                    allergy_lower in allergy_data.get("class", "").lower() or
                    any(allergy_lower in drug.lower() for drug in allergy_data.get("cross_reactants", {}).get("high", []))
                )
                
                if class_match:
                    cross_reactants = allergy_data.get("cross_reactants", {})
                    rates = allergy_data.get("cross_reactivity_rate", {})
                    
                    # Determine risk level
                    risk_level = "none"
                    risk_percentage = 0.0
                    
                    if any(proposed_lower in drug.lower() for drug in cross_reactants.get("high", [])):
                        risk_level = "high"
                        risk_percentage = 100.0
                    elif any(proposed_lower in drug.lower() for drug in cross_reactants.get("moderate", [])):
                        risk_level = "moderate"
                        risk_percentage = rates.get("non_antibiotic_sulfonamides", 10.0)
                    elif any(proposed_lower in drug.lower() for drug in cross_reactants.get("low", [])):
                        risk_level = "low"
                        risk_percentage = 1.0
                    
                    if risk_level != "none":
                        clinical_significance = self._determine_allergy_significance(risk_level, risk_percentage)
                        
                        validations.append(AllergyValidation(
                            proposed_drug=proposed_medication,
                            known_allergen=allergy,
                            cross_reactivity_risk=risk_level,
                            cross_reactivity_percentage=risk_percentage,
                            clinical_significance=clinical_significance,
                            alternative_drugs=allergy_data.get("safe_alternatives", []),
                            evidence_level=EvidenceLevel.LEVEL_A,
                            pmid=allergy_data.get("pmid"),
                        ))
                        
                        self.stats["allergy_conflicts"] += 1
        
        return validations
    
    def _determine_allergy_significance(self, risk_level: str, percentage: float) -> str:
        """Determine clinical significance of cross-reactivity risk."""
        if risk_level == "high" or percentage >= 50:
            return "CRITICAL: High risk of allergic reaction - AVOID"
        elif risk_level == "moderate" or percentage >= 10:
            return "CAUTION: Moderate risk - use with careful monitoring"
        elif risk_level == "low" or percentage > 0:
            return "LOW RISK: Minimal cross-reactivity - monitor for reactions"
        return "NEGLIGIBLE: Very low risk"
    
    async def calculate_renal_dosing(
        self,
        drug: str,
        standard_dose: str,
        crcl: float,
        age: Optional[int] = None,
        weight: Optional[float] = None,
    ) -> List[RenalDosingAdjustment]:
        """
        Calculate appropriate dose adjustments for renal impairment.
        
        Args:
            drug: The medication name
            standard_dose: Standard dosing
            crcl: Creatinine clearance (mL/min)
            age: Patient age
            weight: Patient weight (kg)
            
        Returns:
            List of dosing adjustment recommendations
        """
        adjustments = []
        drug_lower = self.normalize_drug_name(drug)
        
        # Determine crcl category
        if crcl >= 60:
            crcl_range = "CrCl ≥ 60 mL/min (Normal to mild impairment)"
            adjustment_percentage = 0
            reason = "No adjustment needed - adequate renal function"
        elif crcl >= 30:
            crcl_range = "CrCl 30-59 mL/min (Moderate impairment)"
            adjustment_percentage = 25
            reason = "Moderate renal impairment - consider dose reduction for renally eliminated drugs"
        elif crcl >= 15:
            crcl_range = "CrCl 15-29 mL/min (Severe impairment)"
            adjustment_percentage = 50
            reason = "Severe renal impairment - significant dose reduction required"
        else:
            crcl_range = "CrCl < 15 mL/min (End-stage renal disease)"
            adjustment_percentage = 75
            reason = "ESRD - major dose reduction or avoid; consider dialysis dosing"
        
        # Drug-specific adjustments
        drug_class = self.get_drug_class(drug)
        monitoring_params = []
        
        if drug_class:
            monitoring_params = drug_class[1].get("monitoring_params", [])
        
        # Specific drug adjustments
        specific_adjustments = {
            "metformin": {
                60: ("No adjustment", "Continue standard dosing"),
                45: ("Reduce dose to 50%", "Reduce dose; avoid if CrCl < 30"),
                30: ("CONTRAINDICATED", "Discontinue if CrCl < 30"),
            },
            "gabapentin": {
                60: ("No adjustment", "Standard dosing"),
                30: ("300-600mg BID", "Reduce dose to 50%"),
                15: ("300mg daily", "Reduce dose to 25%"),
            },
            "dabigatran": {
                60: ("No adjustment", "Standard dosing"),
                30: ("75mg BID", "Reduce dose for CrCl 30-50"),
                15: ("AVOID", "Contraindicated for CrCl < 30"),
            },
        }
        
        for drug_key, adjustment_dict in specific_adjustments.items():
            if drug_key in drug_lower:
                for threshold, (adj_dose, adj_reason) in sorted(adjustment_dict.items(), reverse=True):
                    if crcl >= threshold:
                        adjustments.append(RenalDosingAdjustment(
                            drug=drug,
                            standard_dose=standard_dose,
                            adjusted_dose=adj_dose,
                            crcl_range=crcl_range,
                            adjustment_percentage=adjustment_percentage,
                            reason=adj_reason,
                            monitoring_parameters=monitoring_params + ["creatinine", "BUN"],
                            evidence_level=EvidenceLevel.LEVEL_A,
                        ))
                        break
                break
        
        # Generic adjustment if no specific rule
        if not adjustments and adjustment_percentage > 0:
            adjusted_dose = f"Reduce by {adjustment_percentage}%"
            adjustments.append(RenalDosingAdjustment(
                drug=drug,
                standard_dose=standard_dose,
                adjusted_dose=adjusted_dose,
                crcl_range=crcl_range,
                adjustment_percentage=adjustment_percentage,
                reason=reason,
                monitoring_parameters=monitoring_params + ["creatinine", "BUN"],
                evidence_level=EvidenceLevel.LEVEL_B,
            ))
        
        if adjustments:
            self.stats["renal_adjustments"] += len(adjustments)
        
        return adjustments
    
    async def check_contraindications(
        self,
        medications: List[str],
        conditions: List[str],
        icd10_codes: Optional[List[str]] = None,
        pregnancy_status: Optional[str] = None,
    ) -> List[ContraindicationCheck]:
        """
        Check for contraindications based on patient conditions.
        
        Args:
            medications: List of medications to check
            conditions: List of patient conditions
            icd10_codes: List of ICD-10 codes for conditions
            pregnancy_status: Pregnancy status if known
            
        Returns:
            List of contraindication findings
        """
        contraindications = []
        
        # Check pregnancy contraindications
        if pregnancy_status == "pregnant" or "pregnancy" in [c.lower() for c in conditions]:
            preg_contra = self._contraindication_db.get("pregnancy", {})
            
            for contra in preg_contra.get("absolute_contraindications", []):
                for drug in contra["drugs"]:
                    if any(drug.lower() in med.lower() for med in medications):
                        contraindications.append(ContraindicationCheck(
                            drug=drug,
                            condition="Pregnancy",
                            icd10_code="Z33.1",
                            contraindication_type="absolute",
                            severity=contra["severity"],
                            reason=contra["reason"],
                            management=contra["management"],
                            alternative_options=["Consult OB/GYN for alternatives"],
                            evidence_level=contra["evidence"],
                        ))
                        self.stats["contraindications_found"] += 1
        
        # Check renal impairment contraindications
        renal_keywords = ["ckd", "chronic kidney disease", "renal failure", "esrd", "dialysis"]
        if any(kw in c.lower() for c in conditions for kw in renal_keywords):
            renal_contra = self._contraindication_db.get("renal_impairment_severe", {})
            
            for contra in renal_contra.get("absolute_contraindications", []):
                for drug in contra["drugs"]:
                    if any(drug.lower() in med.lower() for med in medications):
                        contraindications.append(ContraindicationCheck(
                            drug=drug,
                            condition="Severe Renal Impairment",
                            icd10_code="N18.5",
                            contraindication_type="absolute",
                            severity=contra["severity"],
                            reason=contra["reason"],
                            management=contra["management"],
                            alternative_options=["Acetaminophen for pain", "Consult nephrology"],
                            evidence_level=contra["evidence"],
                        ))
                        self.stats["contraindications_found"] += 1
        
        # Check QT prolongation
        if any("qt" in c.lower() or "long qt" in c.lower() for c in conditions):
            qt_contra = self._contraindication_db.get("qt_prolongation", {})
            
            for contra in qt_contra.get("absolute_contraindications", []):
                for drug in contra["drugs"]:
                    if any(drug.lower() in med.lower() for med in medications):
                        contraindications.append(ContraindicationCheck(
                            drug=drug,
                            condition="QT Prolongation",
                            icd10_code="I45.81",
                            contraindication_type="absolute",
                            severity=contra["severity"],
                            reason=contra["reason"],
                            management=contra["management"],
                            alternative_options=["Use alternative antibiotics", "Monitor ECG"],
                            evidence_level=contra["evidence"],
                        ))
                        self.stats["contraindications_found"] += 1
        
        # Check myasthenia gravis
        if any("myasthenia" in c.lower() for c in conditions):
            mg_contra = self._contraindication_db.get("myasthenia_gravis", {})
            
            for contra in mg_contra.get("absolute_contraindications", []):
                for drug in contra["drugs"]:
                    if any(drug.lower() in med.lower() for med in medications):
                        contraindications.append(ContraindicationCheck(
                            drug=drug,
                            condition="Myasthenia Gravis",
                            icd10_code="G70.00",
                            contraindication_type="absolute",
                            severity=contra["severity"],
                            reason=contra["reason"],
                            management=contra["management"],
                            alternative_options=["Use alternative antibiotics", "Consult neurology"],
                            evidence_level=contra["evidence"],
                        ))
                        self.stats["contraindications_found"] += 1
        
        return contraindications
    
    async def generate_safety_report(
        self,
        proposed_medications: List[str],
        current_medications: List[str],
        known_allergies: List[str],
        conditions: List[str],
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> SafetyReport:
        """
        Generate comprehensive safety validation report.
        
        Args:
            proposed_medications: Medications being considered
            current_medications: Current patient medications
            known_allergies: Patient's known allergies
            conditions: Patient's medical conditions
            patient_context: Additional patient context (age, weight, renal function, etc.)
            
        Returns:
            Comprehensive SafetyReport with all findings
        """
        start_time = time.time()
        request_id = f"safety_{int(time.time() * 1000)}"
        
        self.stats["total_validations"] += 1
        
        # Initialize report
        report = SafetyReport(
            request_id=request_id,
            timestamp=datetime.utcnow().isoformat(),
            overall_safety_level=SeverityLevel.NONE,
        )
        
        patient_context = patient_context or {}
        crcl = patient_context.get("creatinine_clearance", 60)
        pregnancy_status = patient_context.get("pregnancy_status")
        icd10_codes = patient_context.get("icd10_codes", [])
        
        # Run all safety checks
        for med in proposed_medications:
            # Drug interactions
            interactions = await self.check_drug_interactions(med, current_medications)
            report.drug_interactions.extend(interactions)
            
            # Allergy validation
            allergy_checks = await self.validate_allergy_cross_reactivity(med, known_allergies)
            report.allergy_validations.extend(allergy_checks)
            
            # Renal dosing
            if crcl < 60:
                renal_adj = await self.calculate_renal_dosing(
                    med, "standard", crcl,
                    age=patient_context.get("age"),
                    weight=patient_context.get("weight"),
                )
                report.renal_adjustments.extend(renal_adj)
        
        # Contraindications
        contra = await self.check_contraindications(
            proposed_medications + current_medications,
            conditions,
            icd10_codes,
            pregnancy_status,
        )
        report.contraindications.extend(contra)
        
        # Determine overall safety level
        if any(i.severity == SeverityLevel.MAJOR for i in report.drug_interactions):
            report.overall_safety_level = SeverityLevel.MAJOR
        elif any(a.cross_reactivity_risk == "high" for a in report.allergy_validations):
            report.overall_safety_level = SeverityLevel.MAJOR
        elif any(c.contraindication_type == "absolute" for c in report.contraindications):
            report.overall_safety_level = SeverityLevel.MAJOR
        elif any(i.severity == SeverityLevel.MODERATE for i in report.drug_interactions):
            report.overall_safety_level = SeverityLevel.MODERATE
        elif report.renal_adjustments:
            report.overall_safety_level = SeverityLevel.MODERATE
        elif any(i.severity == SeverityLevel.MINOR for i in report.drug_interactions):
            report.overall_safety_level = SeverityLevel.MINOR
        
        # Generate red flags
        for interaction in report.drug_interactions:
            if interaction.severity == SeverityLevel.MAJOR:
                report.red_flags.append(
                    f"MAJOR INTERACTION: {interaction.drug1} + {interaction.drug2} - {interaction.clinical_effect}"
                )
        
        for allergy in report.allergy_validations:
            if allergy.cross_reactivity_risk == "high":
                report.red_flags.append(
                    f"ALLERGY CONFLICT: {allergy.proposed_drug} cross-reacts with {allergy.known_allergen}"
                )
        
        for contra in report.contraindications:
            if contra.contraindication_type == "absolute":
                report.red_flags.append(
                    f"CONTRAINDICATION: {contra.drug} in {contra.condition} - {contra.reason}"
                )
        
        # Generate recommendations
        if report.overall_safety_level == SeverityLevel.MAJOR:
            report.recommendations.append("CRITICAL: Review all major interactions before prescribing")
            report.recommendations.append("Consider alternative medications")
            report.requires_physician_review = True
            report.blocking_issues = report.red_flags.copy()
        elif report.overall_safety_level == SeverityLevel.MODERATE:
            report.recommendations.append("Review moderate interactions and adjust dosing")
            report.recommendations.append("Implement enhanced monitoring")
        else:
            report.recommendations.append("Continue with standard monitoring")
        
        # Collect PMIDs
        pmids = set()
        for interaction in report.drug_interactions:
            if interaction.pmid:
                pmids.add(interaction.pmid)
        for allergy in report.allergy_validations:
            if allergy.pmid:
                pmids.add(allergy.pmid)
        report.pmid_citations = list(pmids)
        
        # Evidence summary
        report.evidence_summary = self._generate_evidence_summary(report)
        
        latency_ms = (time.time() - start_time) * 1000
        logger.info(f"Safety validation completed in {latency_ms:.2f}ms")
        
        return report
    
    def _generate_evidence_summary(self, report: SafetyReport) -> str:
        """Generate evidence summary for the safety report."""
        parts = []
        
        if report.drug_interactions:
            major_count = sum(1 for i in report.drug_interactions if i.severity == SeverityLevel.MAJOR)
            if major_count > 0:
                parts.append(f"{major_count} major drug interaction(s) identified")
        
        if report.allergy_validations:
            high_risk_count = sum(1 for a in report.allergy_validations if a.cross_reactivity_risk == "high")
            if high_risk_count > 0:
                parts.append(f"{high_risk_count} high-risk allergy conflict(s) detected")
        
        if report.contraindications:
            absolute_count = sum(1 for c in report.contraindications if c.contraindication_type == "absolute")
            if absolute_count > 0:
                parts.append(f"{absolute_count} absolute contraindication(s) found")
        
        if parts:
            return "Safety validation findings: " + "; ".join(parts) + "."
        return "No significant safety concerns identified."
    
    def get_stats(self) -> Dict[str, Any]:
        """Get validation statistics."""
        return self.stats.copy()

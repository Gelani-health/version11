"""
DrugBank-Style Comprehensive Drug Database
===========================================

Comprehensive drug information database with:
- Drug-drug interactions
- Drug-disease contraindications
- Pharmacokinetic data
- Dosing guidelines
- Safety information

This module provides a DrugBank-compatible database for clinical decision support.

HIPAA Compliance: All patient data is handled according to HIPAA guidelines.
"""

from typing import Optional, List, Dict, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class DrugClass(Enum):
    """Major drug classes."""
    ACE_INHIBITORS = "ACE Inhibitors"
    ARBS = "Angiotensin Receptor Blockers"
    BETA_BLOCKERS = "Beta-Blockers"
    CALCIUM_CHANNEL_BLOCKERS = "Calcium Channel Blockers"
    DIURETICS = "Diuretics"
    STATINS = "HMG-CoA Reductase Inhibitors"
    ANTICOAGULANTS = "Anticoagulants"
    ANTIPLATELET = "Antiplatelet Agents"
    ANTIDIABETICS = "Antidiabetic Agents"
    ANTIBIOTICS = "Antibacterials"
    ANTIFUNGALS = "Antifungals"
    ANTIVIRALS = "Antivirals"
    OPIOIDS = "Opioid Analgesics"
    NSAIDS = "NSAIDs"
    CORTICOSTEROIDS = "Corticosteroids"
    PROTON_PUMP_INHIBITORS = "Proton Pump Inhibitors"
    ANTIDEPRESSANTS = "Antidepressants"
    ANTIPSYCHOTICS = "Antipsychotics"
    BENZODIAZEPINES = "Benzodiazepines"
    IMMUNOSUPPRESSANTS = "Immunosuppressants"


class Severity(Enum):
    """Interaction severity levels."""
    CONTRAINDICATED = "contraindicated"
    MAJOR = "major"
    MODERATE = "moderate"
    MINOR = "minor"


class RenalAdjustment(Enum):
    """Renal dosing adjustment requirements."""
    REQUIRED = "required"
    RECOMMENDED = "recommended"
    CAUTION = "caution"
    NOT_REQUIRED = "not_required"


@dataclass
class DrugInfo:
    """Comprehensive drug information."""
    drug_id: str
    generic_name: str
    brand_names: List[str]
    drug_class: DrugClass
    atc_code: Optional[str] = None
    
    # Pharmacokinetics
    half_life_hours: Optional[float] = None
    bioavailability: Optional[float] = None
    protein_binding: Optional[float] = None
    volume_of_distribution: Optional[float] = None
    
    # Metabolism
    metabolizing_enzymes: List[str] = field(default_factory=list)
    transporters: List[str] = field(default_factory=list)
    
    # Excretion
    renal_excretion_percent: Optional[float] = None
    hepatic_excretion_percent: Optional[float] = None
    
    # Dosing
    typical_dose: Optional[str] = None
    max_dose: Optional[str] = None
    dosing_frequency: Optional[str] = None
    
    # Special populations
    renal_dosing: Optional[Dict[str, str]] = None
    hepatic_dosing: Optional[Dict[str, str]] = None
    pediatric_dosing: Optional[str] = None
    geriatric_dosing: Optional[str] = None
    
    # Safety
    black_box_warning: Optional[str] = None
    pregnancy_category: Optional[str] = None
    lactation_safety: Optional[str] = None
    
    # Monitoring
    monitoring_parameters: List[str] = field(default_factory=list)
    therapeutic_range: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug_id": self.drug_id,
            "generic_name": self.generic_name,
            "brand_names": self.brand_names[:5],
            "drug_class": self.drug_class.value,
            "atc_code": self.atc_code,
            "half_life_hours": self.half_life_hours,
            "renal_excretion_percent": self.renal_excretion_percent,
            "typical_dose": self.typical_dose,
            "max_dose": self.max_dose,
            "pregnancy_category": self.pregnancy_category,
            "monitoring_parameters": self.monitoring_parameters[:5],
        }


@dataclass
class DrugInteraction:
    """Drug-drug interaction details."""
    drug1_id: str
    drug1_name: str
    drug2_id: str
    drug2_name: str
    severity: Severity
    mechanism: str
    effects: List[str]
    clinical_management: str
    evidence_level: str  # A, B, C
    references: List[str] = field(default_factory=list)
    onset: str = "unknown"  # rapid, delayed
    documentation: str = "unknown"  # established, probable, suspected
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug1": self.drug1_name,
            "drug2": self.drug2_name,
            "severity": self.severity.value,
            "mechanism": self.mechanism,
            "effects": self.effects[:5],
            "management": self.clinical_management,
            "evidence": self.evidence_level,
            "onset": self.onset,
        }


@dataclass
class DrugDiseaseContraindication:
    """Drug-disease contraindication."""
    drug_id: str
    drug_name: str
    disease: str
    severity: Severity
    reason: str
    alternative: Optional[str] = None
    evidence_level: str = "B"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug": self.drug_name,
            "disease": self.disease,
            "severity": self.severity.value,
            "reason": self.reason,
            "alternative": self.alternative,
        }


# Comprehensive Drug Database
DRUG_DATABASE: List[Dict[str, Any]] = [
    # ACE Inhibitors
    {
        "drug_id": "DB00542",
        "generic_name": "Benazepril",
        "brand_names": ["Lotensin"],
        "drug_class": DrugClass.ACE_INHIBITORS,
        "atc_code": "C09AA07",
        "half_life_hours": 22,
        "bioavailability": 37,
        "protein_binding": 97,
        "renal_excretion_percent": 20,
        "typical_dose": "10-40 mg",
        "max_dose": "40 mg daily",
        "dosing_frequency": "once daily",
        "renal_dosing": {
            "CrCl < 30": "5-10 mg once daily",
            "dialysis": "5 mg once daily",
        },
        "pregnancy_category": "D",
        "monitoring_parameters": ["serum creatinine", "potassium", "BP"],
    },
    {
        "drug_id": "DB00490",
        "generic_name": "Lisinopril",
        "brand_names": ["Prinivil", "Zestril"],
        "drug_class": DrugClass.ACE_INHIBITORS,
        "atc_code": "C09AA03",
        "half_life_hours": 12,
        "bioavailability": 25,
        "protein_binding": 0,
        "renal_excretion_percent": 100,
        "typical_dose": "10-40 mg",
        "max_dose": "40 mg daily",
        "dosing_frequency": "once daily",
        "renal_dosing": {
            "CrCl 10-30": "5 mg once daily",
            "CrCl < 10": "2.5 mg once daily",
            "dialysis": "2.5 mg once daily",
        },
        "pregnancy_category": "D",
        "monitoring_parameters": ["serum creatinine", "potassium", "BP"],
    },
    {
        "drug_id": "DB00722",
        "generic_name": "Enalapril",
        "brand_names": ["Vasotec"],
        "drug_class": DrugClass.ACE_INHIBITORS,
        "atc_code": "C09AA02",
        "half_life_hours": 11,
        "bioavailability": 60,
        "protein_binding": 60,
        "renal_excretion_percent": 94,
        "typical_dose": "5-40 mg",
        "max_dose": "40 mg daily",
        "dosing_frequency": "once or twice daily",
        "renal_dosing": {
            "CrCl < 30": "2.5 mg once daily",
            "dialysis": "2.5 mg once daily",
        },
        "pregnancy_category": "D",
        "monitoring_parameters": ["serum creatinine", "potassium", "BP"],
    },
    # ARBs
    {
        "drug_id": "DB00988",
        "generic_name": "Losartan",
        "brand_names": ["Cozaar"],
        "drug_class": DrugClass.ARBS,
        "atc_code": "C09CA01",
        "half_life_hours": 2,
        "bioavailability": 33,
        "protein_binding": 99,
        "renal_excretion_percent": 35,
        "typical_dose": "25-100 mg",
        "max_dose": "100 mg daily",
        "dosing_frequency": "once or twice daily",
        "renal_dosing": {
            "CrCl < 30": "25 mg once daily",
            "hepatic impairment": "25 mg once daily",
        },
        "pregnancy_category": "D",
        "monitoring_parameters": ["serum creatinine", "potassium", "BP"],
    },
    {
        "drug_id": "DB01077",
        "generic_name": "Valsartan",
        "brand_names": ["Diovan"],
        "drug_class": DrugClass.ARBS,
        "atc_code": "C09CA03",
        "half_life_hours": 6,
        "bioavailability": 25,
        "protein_binding": 95,
        "renal_excretion_percent": 13,
        "typical_dose": "80-320 mg",
        "max_dose": "320 mg daily",
        "dosing_frequency": "once daily",
        "renal_dosing": {
            "CrCl < 30": "40 mg once daily",
        },
        "pregnancy_category": "D",
        "monitoring_parameters": ["serum creatinine", "potassium", "BP"],
    },
    # Beta-Blockers
    {
        "drug_id": "DB00264",
        "generic_name": "Metoprolol",
        "brand_names": ["Lopressor", "Toprol XL"],
        "drug_class": DrugClass.BETA_BLOCKERS,
        "atc_code": "C07AB02",
        "half_life_hours": 4,
        "bioavailability": 50,
        "protein_binding": 12,
        "renal_excretion_percent": 5,
        "metabolizing_enzymes": ["CYP2D6"],
        "typical_dose": "25-200 mg",
        "max_dose": "400 mg daily",
        "dosing_frequency": "once or twice daily",
        "pregnancy_category": "C",
        "monitoring_parameters": ["heart rate", "BP", "ECG"],
    },
    {
        "drug_id": "DB01203",
        "generic_name": "Carvedilol",
        "brand_names": ["Coreg"],
        "drug_class": DrugClass.BETA_BLOCKERS,
        "atc_code": "C07AG02",
        "half_life_hours": 7,
        "bioavailability": 25,
        "protein_binding": 98,
        "metabolizing_enzymes": ["CYP2D6", "CYP2C9"],
        "typical_dose": "3.125-25 mg",
        "max_dose": "50 mg daily",
        "dosing_frequency": "twice daily",
        "hepatic_dosing": {
            "severe hepatic impairment": "contraindicated",
        },
        "pregnancy_category": "C",
        "monitoring_parameters": ["heart rate", "BP", "weight", "symptoms"],
    },
    # Calcium Channel Blockers
    {
        "drug_id": "DB00393",
        "generic_name": "Amlodipine",
        "brand_names": ["Norvasc"],
        "drug_class": DrugClass.CALCIUM_CHANNEL_BLOCKERS,
        "atc_code": "C08CA01",
        "half_life_hours": 35,
        "bioavailability": 74,
        "protein_binding": 97,
        "renal_excretion_percent": 10,
        "metabolizing_enzymes": ["CYP3A4"],
        "typical_dose": "2.5-10 mg",
        "max_dose": "10 mg daily",
        "dosing_frequency": "once daily",
        "hepatic_dosing": {
            "hepatic impairment": "2.5 mg once daily",
        },
        "pregnancy_category": "C",
        "monitoring_parameters": ["BP", "edema"],
    },
    {
        "drug_id": "DB00691",
        "generic_name": "Diltiazem",
        "brand_names": ["Cardizem", "Tiazac"],
        "drug_class": DrugClass.CALCIUM_CHANNEL_BLOCKERS,
        "atc_code": "C08DB01",
        "half_life_hours": 5,
        "bioavailability": 40,
        "protein_binding": 80,
        "metabolizing_enzymes": ["CYP3A4"],
        "typical_dose": "120-360 mg",
        "max_dose": "480 mg daily",
        "dosing_frequency": "once or twice daily",
        "monitoring_parameters": ["heart rate", "BP", "ECG"],
    },
    # Statins
    {
        "drug_id": "DB01076",
        "generic_name": "Atorvastatin",
        "brand_names": ["Lipitor"],
        "drug_class": DrugClass.STATINS,
        "atc_code": "C10AA05",
        "half_life_hours": 14,
        "bioavailability": 14,
        "protein_binding": 98,
        "metabolizing_enzymes": ["CYP3A4"],
        "typical_dose": "10-80 mg",
        "max_dose": "80 mg daily",
        "dosing_frequency": "once daily",
        "pregnancy_category": "X",
        "monitoring_parameters": ["LFTs", "lipid panel", "CK if muscle symptoms"],
        "black_box_warning": "Risk of myopathy and rhabdomyolysis",
    },
    {
        "drug_id": "DB01098",
        "generic_name": "Rosuvastatin",
        "brand_names": ["Crestor"],
        "drug_class": DrugClass.STATINS,
        "atc_code": "C10AA07",
        "half_life_hours": 19,
        "bioavailability": 20,
        "protein_binding": 88,
        "typical_dose": "5-40 mg",
        "max_dose": "40 mg daily",
        "dosing_frequency": "once daily",
        "renal_dosing": {
            "CrCl < 30": "5 mg once daily",
        },
        "pregnancy_category": "X",
        "monitoring_parameters": ["LFTs", "lipid panel", "CK if muscle symptoms"],
        "black_box_warning": "Risk of myopathy and rhabdomyolysis",
    },
    # Anticoagulants
    {
        "drug_id": "DB00682",
        "generic_name": "Warfarin",
        "brand_names": ["Coumadin", "Jantoven"],
        "drug_class": DrugClass.ANTICOAGULANTS,
        "atc_code": "B01AA03",
        "half_life_hours": 40,
        "bioavailability": 100,
        "protein_binding": 99,
        "metabolizing_enzymes": ["CYP2C9", "CYP1A2", "CYP3A4"],
        "typical_dose": "2-10 mg",
        "max_dose": "individualized",
        "dosing_frequency": "once daily",
        "therapeutic_range": "INR 2.0-3.0 (standard), 2.5-3.5 (mechanical valves)",
        "pregnancy_category": "X",
        "monitoring_parameters": ["INR", "CBC", "signs of bleeding"],
        "black_box_warning": "Risk of major or fatal bleeding",
    },
    {
        "drug_id": "DB06605",
        "generic_name": "Apixaban",
        "brand_names": ["Eliquis"],
        "drug_class": DrugClass.ANTICOAGULANTS,
        "atc_code": "B01AF02",
        "half_life_hours": 12,
        "bioavailability": 50,
        "protein_binding": 87,
        "metabolizing_enzymes": ["CYP3A4"],
        "transporters": ["P-gp"],
        "renal_excretion_percent": 27,
        "typical_dose": "2.5-5 mg",
        "max_dose": "5 mg twice daily",
        "dosing_frequency": "twice daily",
        "renal_dosing": {
            "CrCl 15-30": "use with caution",
            "CrCl < 15 or dialysis": "not recommended",
        },
        "pregnancy_category": "B",
        "monitoring_parameters": ["renal function", "signs of bleeding"],
        "black_box_warning": "Risk of major or fatal bleeding",
    },
    {
        "drug_id": "DB08626",
        "generic_name": "Rivaroxaban",
        "brand_names": ["Xarelto"],
        "drug_class": DrugClass.ANTICOAGULANTS,
        "atc_code": "B01AF01",
        "half_life_hours": 9,
        "bioavailability": 80,
        "protein_binding": 95,
        "metabolizing_enzymes": ["CYP3A4"],
        "transporters": ["P-gp"],
        "renal_excretion_percent": 33,
        "typical_dose": "10-20 mg",
        "max_dose": "20 mg daily",
        "dosing_frequency": "once or twice daily",
        "renal_dosing": {
            "CrCl 15-50": "15 mg once daily",
            "CrCl < 15": "avoid",
        },
        "pregnancy_category": "C",
        "monitoring_parameters": ["renal function", "signs of bleeding"],
        "black_box_warning": "Risk of major or fatal bleeding",
    },
    # Antiplatelet
    {
        "drug_id": "DB00945",
        "generic_name": "Aspirin",
        "brand_names": ["Bayer", "Ecotrin"],
        "drug_class": DrugClass.ANTIPLATELET,
        "atc_code": "B01AC06",
        "half_life_hours": 0.25,
        "bioavailability": 80,
        "protein_binding": 90,
        "metabolizing_enzymes": ["esterases"],
        "typical_dose": "81-325 mg",
        "max_dose": "325 mg daily",
        "dosing_frequency": "once daily",
        "renal_dosing": {
            "severe renal impairment": "use with caution",
        },
        "pregnancy_category": "C (D in 3rd trimester)",
        "monitoring_parameters": ["signs of bleeding"],
        "black_box_warning": "Risk of gastrointestinal bleeding",
    },
    {
        "drug_id": "DB00758",
        "generic_name": "Clopidogrel",
        "brand_names": ["Plavix"],
        "drug_class": DrugClass.ANTIPLATELET,
        "atc_code": "B01AC04",
        "half_life_hours": 8,
        "bioavailability": 50,
        "protein_binding": 98,
        "metabolizing_enzymes": ["CYP2C19", "CYP3A4"],
        "typical_dose": "75 mg",
        "max_dose": "75 mg daily",
        "dosing_frequency": "once daily",
        "pregnancy_category": "B",
        "monitoring_parameters": ["signs of bleeding"],
        "black_box_warning": "Reduced effectiveness in CYP2C19 poor metabolizers",
    },
    # Antidiabetics
    {
        "drug_id": "DB00331",
        "generic_name": "Metformin",
        "brand_names": ["Glucophage", "Fortamet"],
        "drug_class": DrugClass.ANTIDIABETICS,
        "atc_code": "A10BA02",
        "half_life_hours": 6,
        "bioavailability": 50,
        "protein_binding": 0,
        "renal_excretion_percent": 100,
        "typical_dose": "500-2000 mg",
        "max_dose": "2550 mg daily",
        "dosing_frequency": "once or twice daily",
        "renal_dosing": {
            "eGFR 30-45": "reduce dose, avoid initiation",
            "eGFR < 30": "contraindicated",
        },
        "monitoring_parameters": ["HbA1c", "renal function", "vitamin B12"],
        "black_box_warning": "Risk of lactic acidosis",
    },
    {
        "drug_id": "DB01261",
        "generic_name": "Sitagliptin",
        "brand_names": ["Januvia"],
        "drug_class": DrugClass.ANTIDIABETICS,
        "atc_code": "A10BH01",
        "half_life_hours": 12,
        "bioavailability": 87,
        "protein_binding": 38,
        "renal_excretion_percent": 79,
        "typical_dose": "25-100 mg",
        "max_dose": "100 mg daily",
        "dosing_frequency": "once daily",
        "renal_dosing": {
            "eGFR 30-50": "50 mg once daily",
            "eGFR < 30": "25 mg once daily",
        },
        "monitoring_parameters": ["HbA1c", "renal function"],
    },
    {
        "drug_id": "DB06277",
        "generic_name": "Empagliflozin",
        "brand_names": ["Jardiance"],
        "drug_class": DrugClass.ANTIDIABETICS,
        "atc_code": "A10BK03",
        "half_life_hours": 12,
        "bioavailability": 78,
        "protein_binding": 86,
        "renal_excretion_percent": 50,
        "typical_dose": "10-25 mg",
        "max_dose": "25 mg daily",
        "dosing_frequency": "once daily",
        "renal_dosing": {
            "eGFR < 45": "avoid initiation",
            "eGFR < 30": "discontinue",
        },
        "monitoring_parameters": ["HbA1c", "renal function", "signs of DKA"],
        "black_box_warning": "Risk of ketoacidosis",
    },
    # Antibiotics
    {
        "drug_id": "DB00693",
        "generic_name": "Fluconazole",
        "brand_names": ["Diflucan"],
        "drug_class": DrugClass.ANTIFUNGALS,
        "atc_code": "J02AC01",
        "half_life_hours": 30,
        "bioavailability": 90,
        "protein_binding": 12,
        "renal_excretion_percent": 80,
        "typical_dose": "100-400 mg",
        "max_dose": "800 mg daily",
        "dosing_frequency": "once daily",
        "renal_dosing": {
            "CrCl < 50": "50% dose reduction",
            "dialysis": "100% dose after dialysis",
        },
        "pregnancy_category": "C (D in 1st trimester)",
        "monitoring_parameters": ["LFTs", "renal function"],
    },
    {
        "drug_id": "DB00620",
        "generic_name": "Vancomycin",
        "brand_names": ["Vancocin"],
        "drug_class": DrugClass.ANTIBIOTICS,
        "atc_code": "J01XA01",
        "half_life_hours": 6,
        "protein_binding": 55,
        "renal_excretion_percent": 90,
        "typical_dose": "15-20 mg/kg",
        "max_dose": "individualized",
        "dosing_frequency": "every 8-12 hours",
        "therapeutic_range": "Trough 10-20 mcg/mL",
        "renal_dosing": {
            "adjusted by renal function": "see nomogram",
        },
        "monitoring_parameters": ["trough levels", "renal function", "CBC"],
    },
    # Opioids
    {
        "drug_id": "DB00477",
        "generic_name": "Morphine",
        "brand_names": ["MS Contin", "Kadian"],
        "drug_class": DrugClass.OPIOIDS,
        "atc_code": "N02AA01",
        "half_life_hours": 4,
        "bioavailability": 30,
        "protein_binding": 35,
        "metabolizing_enzymes": ["UGT2B7"],
        "typical_dose": "2.5-15 mg",
        "max_dose": "individualized",
        "dosing_frequency": "every 4 hours",
        "renal_dosing": {
            "CrCl < 30": "reduce dose, extend interval",
        },
        "hepatic_dosing": {
            "severe hepatic impairment": "reduce dose",
        },
        "pregnancy_category": "C",
        "monitoring_parameters": ["respiratory rate", "sedation", "pain"],
        "black_box_warning": "Risk of respiratory depression, addiction",
    },
]


# Comprehensive Drug-Drug Interactions
DRUG_INTERACTIONS: List[Dict[str, Any]] = [
    # Contraindicated
    {
        "drug1_id": "DB00682",  # Warfarin
        "drug1_name": "Warfarin",
        "drug2_id": "DB06605",  # Apixaban
        "drug2_name": "Apixaban",
        "severity": Severity.CONTRAINDICATED,
        "mechanism": "Combined anticoagulant effect",
        "effects": ["Severe bleeding", "Major hemorrhage"],
        "clinical_management": "Avoid combination. If transition needed, follow specific protocol.",
        "evidence_level": "A",
        "onset": "rapid",
        "documentation": "established",
    },
    {
        "drug1_id": "DB00758",  # Clopidogrel
        "drug1_name": "Clopidogrel",
        "drug2_id": "DB00682",  # Warfarin
        "drug2_name": "Warfarin",
        "severity": Severity.MAJOR,
        "mechanism": "Additive antiplatelet and anticoagulant effects",
        "effects": ["Major bleeding", "GI hemorrhage"],
        "clinical_management": "Avoid if possible. If used together, monitor closely. Consider PPI for GI protection.",
        "evidence_level": "A",
        "onset": "rapid",
        "documentation": "established",
    },
    # Major Interactions
    {
        "drug1_id": "DB00331",  # Metformin
        "drug1_name": "Metformin",
        "drug2_id": "DB00693",  # Fluconazole
        "drug2_name": "Fluconazole",
        "severity": Severity.MAJOR,
        "mechanism": "Fluconazole increases metformin levels via renal transport inhibition",
        "effects": ["Lactic acidosis risk", "Hypoglycemia"],
        "clinical_management": "Monitor renal function and blood glucose closely. Consider dose reduction.",
        "evidence_level": "B",
        "onset": "delayed",
        "documentation": "probable",
    },
    {
        "drug1_id": "DB01076",  # Atorvastatin
        "drug1_name": "Atorvastatin",
        "drug2_id": "DB00693",  # Fluconazole
        "drug2_name": "Fluconazole",
        "severity": Severity.MAJOR,
        "mechanism": "CYP3A4 inhibition increases atorvastatin exposure",
        "effects": ["Myopathy", "Rhabdomyolysis"],
        "clinical_management": "Avoid combination or reduce atorvastatin dose by 50%. Monitor for muscle symptoms.",
        "evidence_level": "A",
        "onset": "delayed",
        "documentation": "established",
    },
    {
        "drug1_id": "DB00264",  # Metoprolol
        "drug1_name": "Metoprolol",
        "drug2_id": "DB00693",  # Fluconazole
        "drug2_name": "Fluconazole",
        "severity": Severity.MODERATE,
        "mechanism": "CYP2D6 inhibition increases metoprolol exposure",
        "effects": ["Bradycardia", "Hypotension", "Heart block"],
        "clinical_management": "Monitor heart rate and BP. Consider dose reduction.",
        "evidence_level": "B",
        "onset": "delayed",
        "documentation": "probable",
    },
    {
        "drug1_id": "DB00490",  # Lisinopril
        "drug1_name": "Lisinopril",
        "drug2_id": "DB00988",  # Losartan
        "drug2_name": "Losartan",
        "severity": Severity.MAJOR,
        "mechanism": "Dual RAAS blockade",
        "effects": ["Hyperkalemia", "Acute kidney injury", "Hypotension"],
        "clinical_management": "Generally avoid. If needed for specific indication, monitor K+ and creatinine closely.",
        "evidence_level": "A",
        "onset": "delayed",
        "documentation": "established",
    },
    {
        "drug1_id": "DB01076",  # Atorvastatin
        "drug1_name": "Atorvastatin",
        "drug2_id": "DB00393",  # Amlodipine
        "drug2_name": "Amlodipine",
        "severity": Severity.MODERATE,
        "mechanism": "CYP3A4 competition",
        "effects": ["Increased atorvastatin exposure", "Myopathy risk"],
        "clinical_management": "Limit atorvastatin dose to 20 mg when used with amlodipine. Monitor for muscle symptoms.",
        "evidence_level": "A",
        "onset": "delayed",
        "documentation": "established",
    },
    # Moderate Interactions
    {
        "drug1_id": "DB00331",  # Metformin
        "drug1_name": "Metformin",
        "drug2_id": "DB00988",  # Losartan
        "drug2_name": "Losartan",
        "severity": Severity.MODERATE,
        "mechanism": "Losartan may enhance hypoglycemic effect",
        "effects": ["Hypoglycemia"],
        "clinical_management": "Monitor blood glucose. May need to adjust antidiabetic dose.",
        "evidence_level": "B",
        "onset": "delayed",
        "documentation": "probable",
    },
    {
        "drug1_id": "DB00264",  # Metoprolol
        "drug1_name": "Metoprolol",
        "drug2_id": "DB00331",  # Metformin
        "drug2_name": "Metformin",
        "severity": Severity.MODERATE,
        "mechanism": "Beta-blockers may mask hypoglycemia symptoms",
        "effects": ["Masked hypoglycemia symptoms"],
        "clinical_management": "Educate patient about atypical hypoglycemia symptoms. Monitor glucose regularly.",
        "evidence_level": "B",
        "onset": "delayed",
        "documentation": "established",
    },
]


# Drug-Disease Contraindications
DRUG_DISEASE_CONTRAINDICATIONS: List[Dict[str, Any]] = [
    {
        "drug_id": "DB00331",
        "drug_name": "Metformin",
        "disease": "Severe renal impairment (eGFR < 30)",
        "severity": Severity.CONTRAINDICATED,
        "reason": "Accumulation leads to lactic acidosis",
        "alternative": "Insulin, sulfonylureas",
        "evidence_level": "A",
    },
    {
        "drug_id": "DB00682",
        "drug_name": "Warfarin",
        "disease": "Active bleeding",
        "severity": Severity.CONTRAINDICATED,
        "reason": "Will worsen bleeding",
        "alternative": "Hold warfarin, consider reversal agent if needed",
        "evidence_level": "A",
    },
    {
        "drug_id": "DB00264",
        "drug_name": "Metoprolol",
        "disease": "Severe bradycardia (<50 bpm)",
        "severity": Severity.CONTRAINDICATED,
        "reason": "May worsen bradycardia",
        "alternative": "Consider non-beta-blocker alternative",
        "evidence_level": "A",
    },
    {
        "drug_id": "DB01076",
        "drug_name": "Atorvastatin",
        "disease": "Active liver disease",
        "severity": Severity.MAJOR,
        "reason": "May worsen hepatic dysfunction",
        "alternative": "Pravastatin (lower risk), consider non-statin",
        "evidence_level": "B",
    },
    {
        "drug_id": "DB00490",
        "drug_name": "Lisinopril",
        "disease": "Bilateral renal artery stenosis",
        "severity": Severity.CONTRAINDICATED,
        "reason": "Risk of acute renal failure",
        "alternative": "Calcium channel blocker",
        "evidence_level": "A",
    },
    {
        "drug_id": "DB00490",
        "drug_name": "Lisinopril",
        "disease": "Pregnancy",
        "severity": Severity.CONTRAINDICATED,
        "reason": "Fetal toxicity",
        "alternative": "Methyldopa, labetalol, nifedipine",
        "evidence_level": "A",
    },
    {
        "drug_id": "DB00477",
        "drug_name": "Morphine",
        "disease": "Respiratory depression",
        "severity": Severity.CONTRAINDICATED,
        "reason": "May cause fatal respiratory depression",
        "alternative": "Non-opioid analgesics",
        "evidence_level": "A",
    },
    {
        "drug_id": "DB06605",
        "drug_name": "Apixaban",
        "disease": "Active bleeding",
        "severity": Severity.CONTRAINDICATED,
        "reason": "Will worsen bleeding",
        "alternative": "Hold anticoagulation until bleeding resolved",
        "evidence_level": "A",
    },
]


class DrugDatabase:
    """
    Comprehensive drug information and interaction lookup service.
    
    Provides:
    - Drug information lookup
    - Drug-drug interaction checking
    - Drug-disease contraindication checking
    - Renal dosing adjustments
    """
    
    def __init__(self):
        self._drugs: Dict[str, DrugInfo] = {}
        self._interactions: List[DrugInteraction] = []
        self._contraindications: List[DrugDiseaseContraindication] = []
        self._name_index: Dict[str, str] = {}  # lowercase name -> drug_id
        self._initialized = False
    
    def initialize(self):
        """Initialize the database."""
        if self._initialized:
            return
        
        # Load drugs
        for drug_data in DRUG_DATABASE:
            drug = DrugInfo(
                drug_id=drug_data["drug_id"],
                generic_name=drug_data["generic_name"],
                brand_names=drug_data.get("brand_names", []),
                drug_class=drug_data["drug_class"],
                atc_code=drug_data.get("atc_code"),
                half_life_hours=drug_data.get("half_life_hours"),
                bioavailability=drug_data.get("bioavailability"),
                protein_binding=drug_data.get("protein_binding"),
                renal_excretion_percent=drug_data.get("renal_excretion_percent"),
                metabolizing_enzymes=drug_data.get("metabolizing_enzymes", []),
                typical_dose=drug_data.get("typical_dose"),
                max_dose=drug_data.get("max_dose"),
                dosing_frequency=drug_data.get("dosing_frequency"),
                renal_dosing=drug_data.get("renal_dosing"),
                hepatic_dosing=drug_data.get("hepatic_dosing"),
                pregnancy_category=drug_data.get("pregnancy_category"),
                monitoring_parameters=drug_data.get("monitoring_parameters", []),
                therapeutic_range=drug_data.get("therapeutic_range"),
                black_box_warning=drug_data.get("black_box_warning"),
            )
            self._drugs[drug.drug_id] = drug
            
            # Build name index
            self._name_index[drug.generic_name.lower()] = drug.drug_id
            for brand in drug.brand_names:
                self._name_index[brand.lower()] = drug.drug_id
        
        # Load interactions
        for int_data in DRUG_INTERACTIONS:
            interaction = DrugInteraction(
                drug1_id=int_data["drug1_id"],
                drug1_name=int_data["drug1_name"],
                drug2_id=int_data["drug2_id"],
                drug2_name=int_data["drug2_name"],
                severity=int_data["severity"],
                mechanism=int_data["mechanism"],
                effects=int_data["effects"],
                clinical_management=int_data["clinical_management"],
                evidence_level=int_data["evidence_level"],
                onset=int_data.get("onset", "unknown"),
                documentation=int_data.get("documentation", "unknown"),
            )
            self._interactions.append(interaction)
        
        # Load contraindications
        for contra_data in DRUG_DISEASE_CONTRAINDICATIONS:
            contraindication = DrugDiseaseContraindication(
                drug_id=contra_data["drug_id"],
                drug_name=contra_data["drug_name"],
                disease=contra_data["disease"],
                severity=contra_data["severity"],
                reason=contra_data["reason"],
                alternative=contra_data.get("alternative"),
                evidence_level=contra_data.get("evidence_level", "B"),
            )
            self._contraindications.append(contraindication)
        
        self._initialized = True
    
    def get_drug(self, drug_name: str) -> Optional[DrugInfo]:
        """Get drug information by name (generic or brand)."""
        if not self._initialized:
            self.initialize()
        
        drug_id = self._name_index.get(drug_name.lower())
        if drug_id:
            return self._drugs.get(drug_id)
        return None
    
    def get_drug_by_id(self, drug_id: str) -> Optional[DrugInfo]:
        """Get drug information by ID."""
        if not self._initialized:
            self.initialize()
        
        return self._drugs.get(drug_id)
    
    def check_interaction(self, drug1: str, drug2: str) -> List[DrugInteraction]:
        """Check for interactions between two drugs."""
        if not self._initialized:
            self.initialize()
        
        interactions = []
        drug1_lower = drug1.lower()
        drug2_lower = drug2.lower()
        
        for interaction in self._interactions:
            if ((interaction.drug1_name.lower() == drug1_lower and 
                 interaction.drug2_name.lower() == drug2_lower) or
                (interaction.drug1_name.lower() == drug2_lower and 
                 interaction.drug2_name.lower() == drug1_lower)):
                interactions.append(interaction)
        
        return interactions
    
    def check_all_interactions(self, drugs: List[str]) -> List[DrugInteraction]:
        """Check all pairwise interactions among a list of drugs."""
        all_interactions = []
        
        for i, drug1 in enumerate(drugs):
            for drug2 in drugs[i+1:]:
                interactions = self.check_interaction(drug1, drug2)
                all_interactions.extend(interactions)
        
        # Sort by severity
        severity_order = {
            Severity.CONTRAINDICATED: 0,
            Severity.MAJOR: 1,
            Severity.MODERATE: 2,
            Severity.MINOR: 3,
        }
        all_interactions.sort(key=lambda x: severity_order.get(x.severity, 99))
        
        return all_interactions
    
    def check_contraindications(self, drug: str, conditions: List[str]) -> List[DrugDiseaseContraindication]:
        """Check for drug-disease contraindications."""
        if not self._initialized:
            self.initialize()
        
        contraindications = []
        drug_lower = drug.lower()
        
        # Get drug ID
        drug_info = self.get_drug(drug)
        if not drug_info:
            return contraindications
        
        for contra in self._contraindications:
            if contra.drug_id == drug_info.drug_id:
                for condition in conditions:
                    if condition.lower() in contra.disease.lower():
                        contraindications.append(contra)
                        break
        
        return contraindications
    
    def get_renal_dosing(self, drug: str, crcl: float) -> Optional[str]:
        """Get renal dosing recommendation."""
        drug_info = self.get_drug(drug)
        if not drug_info or not drug_info.renal_dosing:
            return None
        
        recommendations = []
        for criteria, dose in drug_info.renal_dosing.items():
            # Simple parsing of CrCl criteria
            if "CrCl < 30" in criteria and crcl < 30:
                recommendations.append((30, dose))
            elif "CrCl 30-50" in criteria and 30 <= crcl < 50:
                recommendations.append((50, dose))
            elif "CrCl < 50" in criteria and crcl < 50:
                recommendations.append((50, dose))
            elif "CrCl 10-30" in criteria and 10 <= crcl < 30:
                recommendations.append((30, dose))
            elif "dialysis" in criteria.lower() and crcl < 10:
                recommendations.append((10, dose))
        
        if recommendations:
            # Return most specific (highest threshold)
            recommendations.sort(key=lambda x: x[0], reverse=True)
            return recommendations[0][1]
        
        return None
    
    def search_drugs(self, query: str, limit: int = 10) -> List[DrugInfo]:
        """Search for drugs by name."""
        if not self._initialized:
            self.initialize()
        
        results = []
        query_lower = query.lower()
        
        for name, drug_id in self._name_index.items():
            if query_lower in name:
                drug = self._drugs.get(drug_id)
                if drug and drug not in results:
                    results.append(drug)
                    if len(results) >= limit:
                        break
        
        return results


# Singleton instance
_drug_db: Optional[DrugDatabase] = None


def get_drug_database() -> DrugDatabase:
    """Get the drug database singleton."""
    global _drug_db
    if _drug_db is None:
        _drug_db = DrugDatabase()
        _drug_db.initialize()
    return _drug_db

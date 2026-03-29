"""
P3: Lab Result Interpretation Engine
=====================================

Implements comprehensive laboratory result interpretation:
- Reference range normalization (age, gender, ethnicity)
- Critical value detection and escalation
- Trend analysis with delta checks
- Lab panel interpretation (CBC, CMP, liver panel, etc.)
- Drug-induced lab abnormality detection
- eGFR interpretation
- Clinical significance assessment

Reference: Tietz Textbook of Clinical Chemistry, 7th Edition
"""

import asyncio
import time
import math
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

from loguru import logger


class AbnormalityLevel(Enum):
    """Lab abnormality severity."""
    CRITICAL_LOW = "critical_low"
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL_HIGH = "critical_high"


class LabCategory(Enum):
    """Laboratory test categories."""
    HEMATOLOGY = "hematology"
    CHEMISTRY = "chemistry"
    LIVER = "liver"
    RENAL = "renal"
    CARDIAC = "cardiac"
    THYROID = "thyroid"
    COAGULATION = "coagulation"
    URINALYSIS = "urinalysis"
    INFLAMMATORY = "inflammatory"
    METABOLIC = "metabolic"


@dataclass
class ReferenceRange:
    """Age and gender-specific reference range."""
    test_name: str
    test_code: str
    low_normal: float
    high_normal: float
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None
    unit: str = ""
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    gender: Optional[str] = None  # "male", "female", or None for all
    pregnancy: Optional[bool] = None
    source: str = "standard"
    
    def is_applicable(self, age: int, gender: str, is_pregnant: bool = False) -> bool:
        """Check if reference range applies to patient."""
        if self.age_min is not None and age < self.age_min:
            return False
        if self.age_max is not None and age > self.age_max:
            return False
        if self.gender is not None and gender.lower() != self.gender.lower():
            return False
        if self.pregnancy is not None and is_pregnant != self.pregnancy:
            return False
        return True


@dataclass
class LabInterpretation:
    """Interpreted laboratory result."""
    test_name: str
    test_code: str
    value: float
    unit: str
    reference_range: ReferenceRange
    abnormality: AbnormalityLevel
    is_critical: bool
    percent_deviation: float
    clinical_significance: str
    possible_causes: List[str] = field(default_factory=list)
    follow_up_tests: List[str] = field(default_factory=list)
    clinical_notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_name": self.test_name,
            "test_code": self.test_code,
            "value": self.value,
            "unit": self.unit,
            "reference_range": {
                "low": self.reference_range.low_normal,
                "high": self.reference_range.high_normal,
                "critical_low": self.reference_range.critical_low,
                "critical_high": self.reference_range.critical_high,
            },
            "abnormality": self.abnormality.value,
            "is_critical": self.is_critical,
            "percent_deviation": round(self.percent_deviation, 1),
            "clinical_significance": self.clinical_significance,
            "possible_causes": self.possible_causes,
            "follow_up_tests": self.follow_up_tests,
            "clinical_notes": self.clinical_notes,
        }


@dataclass
class TrendAnalysis:
    """Trend analysis for a lab test."""
    test_name: str
    values: List[Tuple[datetime, float]]
    trend_direction: str  # "increasing", "decreasing", "stable"
    percent_change: float
    significant_delta: bool
    delta_threshold: float
    interpretation: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_name": self.test_name,
            "data_points": len(self.values),
            "trend_direction": self.trend_direction,
            "percent_change": round(self.percent_change, 1),
            "significant_delta": self.significant_delta,
            "interpretation": self.interpretation,
        }


# =============================================================================
# REFERENCE RANGE DATABASE
# =============================================================================

REFERENCE_RANGES: Dict[str, List[ReferenceRange]] = {
    # Hematology
    "HGB": [
        ReferenceRange("Hemoglobin", "HGB", 12.0, 16.0, 7.0, 20.0, "g/dL", gender="female", source="WHO"),
        ReferenceRange("Hemoglobin", "HGB", 14.0, 18.0, 7.0, 20.0, "g/dL", gender="male", source="WHO"),
        ReferenceRange("Hemoglobin", "HGB", 11.0, 16.5, 7.0, 20.0, "g/dL", age_min=0, age_max=2, source="Pediatric"),
        ReferenceRange("Hemoglobin", "HGB", 11.5, 15.5, 7.0, 20.0, "g/dL", age_min=2, age_max=12, source="Pediatric"),
    ],
    "HCT": [
        ReferenceRange("Hematocrit", "HCT", 36.0, 48.0, 21.0, 60.0, "%", gender="female"),
        ReferenceRange("Hematocrit", "HCT", 40.0, 54.0, 21.0, 60.0, "%", gender="male"),
    ],
    "WBC": [
        ReferenceRange("White Blood Cell Count", "WBC", 4.5, 11.0, 1.5, 30.0, "K/uL"),
        ReferenceRange("White Blood Cell Count", "WBC", 6.0, 17.5, 1.5, 30.0, "K/uL", age_min=0, age_max=2, source="Pediatric"),
    ],
    "PLT": [
        ReferenceRange("Platelet Count", "PLT", 150.0, 400.0, 50.0, 1000.0, "K/uL"),
    ],
    "MCV": [
        ReferenceRange("Mean Corpuscular Volume", "MCV", 80.0, 100.0, 60.0, 120.0, "fL"),
    ],
    "MCH": [
        ReferenceRange("Mean Corpuscular Hgb", "MCH", 27.0, 33.0, 20.0, 40.0, "pg"),
    ],
    "MCHC": [
        ReferenceRange("Mean Corpuscular Hgb Conc", "MCHC", 32.0, 36.0, 25.0, 40.0, "g/dL"),
    ],
    "RDW": [
        ReferenceRange("RBC Distribution Width", "RDW", 11.5, 14.5, None, 20.0, "%"),
    ],
    
    # Chemistry
    "NA": [
        ReferenceRange("Sodium", "NA", 136.0, 145.0, 120.0, 160.0, "mmol/L"),
    ],
    "K": [
        ReferenceRange("Potassium", "K", 3.5, 5.1, 2.5, 6.5, "mmol/L"),
    ],
    "CL": [
        ReferenceRange("Chloride", "CL", 98.0, 107.0, 80.0, 120.0, "mmol/L"),
    ],
    "CO2": [
        ReferenceRange("Carbon Dioxide", "CO2", 21.0, 31.0, 10.0, 45.0, "mmol/L"),
    ],
    "BUN": [
        ReferenceRange("Blood Urea Nitrogen", "BUN", 7.0, 20.0, 2.0, 100.0, "mg/dL"),
        ReferenceRange("Blood Urea Nitrogen", "BUN", 8.0, 23.0, 2.0, 100.0, "mg/dL", age_min=60),
    ],
    "CREATININE": [
        ReferenceRange("Creatinine", "CREATININE", 0.6, 1.1, 0.3, 5.0, "mg/dL", gender="female"),
        ReferenceRange("Creatinine", "CREATININE", 0.7, 1.3, 0.3, 5.0, "mg/dL", gender="male"),
    ],
    "GLUCOSE": [
        ReferenceRange("Glucose, Fasting", "GLUCOSE", 70.0, 100.0, 40.0, 500.0, "mg/dL"),
        ReferenceRange("Glucose, Random", "GLUCOSE", 70.0, 140.0, 40.0, 500.0, "mg/dL"),
    ],
    "HBA1C": [
        ReferenceRange("Hemoglobin A1c", "HBA1C", 4.0, 5.6, None, 14.0, "%"),
    ],
    
    # Liver Panel
    "ALT": [
        ReferenceRange("Alanine Aminotransferase", "ALT", 7.0, 56.0, None, 1000.0, "U/L", gender="male"),
        ReferenceRange("Alanine Aminotransferase", "ALT", 7.0, 40.0, None, 1000.0, "U/L", gender="female"),
    ],
    "AST": [
        ReferenceRange("Aspartate Aminotransferase", "AST", 10.0, 40.0, None, 1000.0, "U/L"),
    ],
    "ALP": [
        ReferenceRange("Alkaline Phosphatase", "ALP", 44.0, 147.0, None, 500.0, "U/L"),
        ReferenceRange("Alkaline Phosphatase", "ALP", 100.0, 350.0, None, 500.0, "U/L", age_min=0, age_max=12, source="Pediatric"),
    ],
    "BILIRUBIN_TOTAL": [
        ReferenceRange("Total Bilirubin", "BILIRUBIN_TOTAL", 0.1, 1.2, None, 15.0, "mg/dL"),
    ],
    "BILIRUBIN_DIRECT": [
        ReferenceRange("Direct Bilirubin", "BILIRUBIN_DIRECT", 0.0, 0.3, None, 5.0, "mg/dL"),
    ],
    "ALBUMIN": [
        ReferenceRange("Albumin", "ALBUMIN", 3.5, 5.5, 1.5, 7.0, "g/dL"),
    ],
    "PROTEIN_TOTAL": [
        ReferenceRange("Total Protein", "PROTEIN_TOTAL", 6.0, 8.3, 4.0, 10.0, "g/dL"),
    ],
    
    # Renal
    "EGFR": [
        ReferenceRange("eGFR", "EGFR", 60.0, 120.0, None, None, "mL/min/1.73m2"),
        ReferenceRange("eGFR", "EGFR", 90.0, 120.0, None, None, "mL/min/1.73m2", age_min=0, age_max=40),
    ],
    
    # Cardiac
    "TROPONIN_I": [
        ReferenceRange("Troponin I", "TROPONIN_I", 0.0, 0.04, None, 50.0, "ng/mL"),
    ],
    "TROPONIN_T": [
        ReferenceRange("Troponin T", "TROPONIN_T", 0.0, 0.01, None, 10.0, "ng/mL"),
    ],
    "BNP": [
        ReferenceRange("B-type Natriuretic Peptide", "BNP", 0.0, 100.0, None, 5000.0, "pg/mL"),
    ],
    "NT_PROBNP": [
        ReferenceRange("NT-proBNP", "NT_PROBNP", 0.0, 125.0, None, 35000.0, "pg/mL", age_max=75),
        ReferenceRange("NT-proBNP", "NT_PROBNP", 0.0, 450.0, None, 35000.0, "pg/mL", age_min=75),
    ],
    "CRP": [
        ReferenceRange("C-Reactive Protein", "CRP", 0.0, 10.0, None, 500.0, "mg/L"),
    ],
    "HS_CRP": [
        ReferenceRange("High-Sensitivity CRP", "HS_CRP", 0.0, 3.0, None, 50.0, "mg/L"),
    ],
    
    # Thyroid
    "TSH": [
        ReferenceRange("Thyroid Stimulating Hormone", "TSH", 0.4, 4.0, 0.01, 100.0, "mIU/L"),
        ReferenceRange("Thyroid Stimulating Hormone", "TSH", 0.5, 7.0, 0.01, 100.0, "mIU/L", age_min=60),
    ],
    "T4_FREE": [
        ReferenceRange("Free T4", "T4_FREE", 0.8, 1.8, 0.1, 5.0, "ng/dL"),
    ],
    "T3_FREE": [
        ReferenceRange("Free T3", "T3_FREE", 2.3, 4.2, 0.5, 10.0, "pg/mL"),
    ],
    
    # Coagulation
    "INR": [
        ReferenceRange("International Normalized Ratio", "INR", 0.9, 1.1, None, 6.0, "ratio"),
    ],
    "PT": [
        ReferenceRange("Prothrombin Time", "PT", 11.0, 13.5, None, 50.0, "seconds"),
    ],
    "PTT": [
        ReferenceRange("Partial Thromboplastin Time", "PTT", 25.0, 35.0, None, 150.0, "seconds"),
    ],
    "D_DIMER": [
        ReferenceRange("D-Dimer", "D_DIMER", 0.0, 500.0, None, 10000.0, "ng/mL FEU"),
    ],
    
    # Inflammatory
    "ESR": [
        ReferenceRange("Erythrocyte Sedimentation Rate", "ESR", 0.0, 20.0, None, 100.0, "mm/hr", gender="male"),
        ReferenceRange("Erythrocyte Sedimentation Rate", "ESR", 0.0, 30.0, None, 100.0, "mm/hr", gender="female"),
    ],
    
    # Lipid Panel
    "CHOLESTEROL_TOTAL": [
        ReferenceRange("Total Cholesterol", "CHOLESTEROL_TOTAL", 0.0, 200.0, None, 500.0, "mg/dL"),
    ],
    "LDL": [
        ReferenceRange("LDL Cholesterol", "LDL", 0.0, 100.0, None, 300.0, "mg/dL"),
    ],
    "HDL": [
        ReferenceRange("HDL Cholesterol", "HDL", 40.0, 999.0, None, None, "mg/dL", gender="male"),
        ReferenceRange("HDL Cholesterol", "HDL", 50.0, 999.0, None, None, "mg/dL", gender="female"),
    ],
    "TRIGLYCERIDES": [
        ReferenceRange("Triglycerides", "TRIGLYCERIDES", 0.0, 150.0, None, 1000.0, "mg/dL"),
    ],
    
    # Iron Studies
    "IRON": [
        ReferenceRange("Iron, Serum", "IRON", 60.0, 170.0, 20.0, 500.0, "ug/dL"),
    ],
    "FERRITIN": [
        ReferenceRange("Ferritin", "FERRITIN", 20.0, 300.0, 5.0, 10000.0, "ng/mL", gender="male"),
        ReferenceRange("Ferritin", "FERRITIN", 10.0, 150.0, 5.0, 10000.0, "ng/mL", gender="female"),
    ],
    "TIBC": [
        ReferenceRange("Total Iron Binding Capacity", "TIBC", 250.0, 370.0, 100.0, 500.0, "ug/dL"),
    ],
    
    # Vitamins
    "B12": [
        ReferenceRange("Vitamin B12", "B12", 200.0, 900.0, 100.0, 2000.0, "pg/mL"),
    ],
    "FOLATE": [
        ReferenceRange("Folate, Serum", "FOLATE", 3.0, 20.0, None, 50.0, "ng/mL"),
    ],
    "VITAMIN_D": [
        ReferenceRange("Vitamin D, 25-OH", "VITAMIN_D", 30.0, 100.0, None, 200.0, "ng/mL"),
    ],
}

# Drug-induced lab abnormality database
DRUG_INDUCED_ABNORMALITIES = {
    "HEPATOTOXICITY": {
        "tests": ["ALT", "AST", "ALP", "BILIRUBIN_TOTAL"],
        "drugs": [
            "acetaminophen", "amiodarone", "amoxicillin-clavulanate", "atorvastatin",
            "carbamazepine", "ciprofloxacin", "diclofenac", "erythromycin",
            "fluvastatin", "isoniazid", "ketoconazole", "lovastatin", "methotrexate",
            "minocycline", "nitrofurantoin", "phenytoin", "pravastatin", "rifampin",
            "simvastatin", "sulfonamides", "terbinafine", "valproic acid"
        ],
    },
    "NEPHROTOXICITY": {
        "tests": ["CREATININE", "BUN", "EGFR", "K"],
        "drugs": [
            "aminoglycosides", "amphotericin B", "cisplatin", "cyclosporine",
            "foscarnet", "ganciclovir", "indomethacin", "lithium", "methotrexate",
            "NSAIDs", "pentamidine", "tacrolimus", "vancomycin", "ACE inhibitors",
            "ARBs", "contrast agents"
        ],
    },
    "HYPERKALEMIA": {
        "tests": ["K"],
        "drugs": [
            "ACE inhibitors", "ARBs", "spironolactone", "eplerenone",
            "triamterene", "amiloride", "NSAIDs", "heparin", "trimethoprim"
        ],
    },
    "HYPOKALEMIA": {
        "tests": ["K"],
        "drugs": [
            "furosemide", "bumetanide", "torsemide", "hydrochlorothiazide",
            "chlorothiazide", "prednisone", "methylprednisolone", "amphotericin B",
            "insulin", "albuterol", "terbutaline"
        ],
    },
    "HYPONATREMIA": {
        "tests": ["NA"],
        "drugs": [
            "thiazide diuretics", "SSRIs", "SNRIs", "carbamazepine",
            "oxcarbazepine", "desmopressin", "vincristine", "cyclophosphamide"
        ],
    },
    "MYELOSUPPRESSION": {
        "tests": ["WBC", "HGB", "PLT"],
        "drugs": [
            "chemotherapy agents", "clozapine", "carbamazepine", "valproic acid",
            "sulfonamides", "chloramphenicol", "methimazole", "propylthiouracil"
        ],
    },
    "THYROID_DYSFUNCTION": {
        "tests": ["TSH", "T4_FREE", "T3_FREE"],
        "drugs": [
            "amiodarone", "lithium", "interferon-alpha", "iodine contrast",
            "sunitinib", "sorafenib", "levothyroxine (excess)"
        ],
    },
}


class LabInterpretationEngine:
    """
    P3: Comprehensive Laboratory Result Interpretation Engine.
    
    Features:
    - Age/gender-specific reference ranges
    - Critical value detection
    - Trend analysis with delta checks
    - Drug-induced abnormality detection
    - Clinical significance assessment
    """
    
    def __init__(self):
        self.reference_ranges = REFERENCE_RANGES
        self.drug_abnormalities = DRUG_INDUCED_ABNORMALITIES
        
        # Delta check thresholds (percent change)
        self.delta_thresholds = {
            "HGB": 10.0,
            "HCT": 10.0,
            "WBC": 20.0,
            "PLT": 20.0,
            "NA": 5.0,
            "K": 15.0,
            "CREATININE": 20.0,
            "GLUCOSE": 25.0,
            "ALT": 50.0,
            "AST": 50.0,
        }
        
        self.stats = {
            "total_interpretations": 0,
            "abnormal_results": 0,
            "critical_values": 0,
        }
    
    def get_reference_range(
        self,
        test_code: str,
        age: int,
        gender: str,
        is_pregnant: bool = False,
    ) -> Optional[ReferenceRange]:
        """Get the applicable reference range for a test and patient."""
        test_code_upper = test_code.upper()
        
        if test_code_upper not in self.reference_ranges:
            return None
        
        ranges = self.reference_ranges[test_code_upper]
        applicable = [r for r in ranges if r.is_applicable(age, gender, is_pregnant)]
        
        if not applicable:
            # Fall back to first range if no specific match
            return ranges[0] if ranges else None
        
        # Return most specific match (highest priority)
        return applicable[0]
    
    def interpret_result(
        self,
        test_code: str,
        value: float,
        age: int,
        gender: str,
        is_pregnant: bool = False,
        current_medications: Optional[List[str]] = None,
    ) -> LabInterpretation:
        """Interpret a single laboratory result."""
        test_code_upper = test_code.upper()
        
        # Get reference range
        ref_range = self.get_reference_range(test_code_upper, age, gender, is_pregnant)
        
        if ref_range is None:
            # Create generic reference range
            ref_range = ReferenceRange(
                test_name=test_code,
                test_code=test_code_upper,
                low_normal=0,
                high_normal=100,
                unit="unknown",
            )
        
        # Determine abnormality level
        abnormality = self._classify_abnormality(value, ref_range)
        is_critical = abnormality in [AbnormalityLevel.CRITICAL_LOW, AbnormalityLevel.CRITICAL_HIGH]
        
        # Calculate percent deviation
        if abnormality == AbnormalityLevel.NORMAL:
            percent_deviation = 0
        elif value < ref_range.low_normal:
            percent_deviation = ((ref_range.low_normal - value) / ref_range.low_normal) * 100
        else:
            percent_deviation = ((value - ref_range.high_normal) / ref_range.high_normal) * 100
        
        # Determine clinical significance
        clinical_significance = self._assess_clinical_significance(test_code_upper, abnormality, percent_deviation)
        
        # Get possible causes
        possible_causes = self._get_possible_causes(test_code_upper, abnormality, current_medications)
        
        # Get follow-up recommendations
        follow_up = self._get_follow_up_tests(test_code_upper, abnormality, value)
        
        # Generate clinical notes
        clinical_notes = self._generate_clinical_notes(test_code_upper, abnormality, value, ref_range)
        
        # Update stats
        self.stats["total_interpretations"] += 1
        if abnormality != AbnormalityLevel.NORMAL:
            self.stats["abnormal_results"] += 1
        if is_critical:
            self.stats["critical_values"] += 1
        
        return LabInterpretation(
            test_name=ref_range.test_name,
            test_code=test_code_upper,
            value=value,
            unit=ref_range.unit,
            reference_range=ref_range,
            abnormality=abnormality,
            is_critical=is_critical,
            percent_deviation=percent_deviation,
            clinical_significance=clinical_significance,
            possible_causes=possible_causes,
            follow_up_tests=follow_up,
            clinical_notes=clinical_notes,
        )
    
    def _classify_abnormality(self, value: float, ref_range: ReferenceRange) -> AbnormalityLevel:
        """Classify the abnormality level of a result."""
        # Check critical values first
        if ref_range.critical_low is not None and value <= ref_range.critical_low:
            return AbnormalityLevel.CRITICAL_LOW
        if ref_range.critical_high is not None and value >= ref_range.critical_high:
            return AbnormalityLevel.CRITICAL_HIGH
        
        # Check normal range
        if ref_range.low_normal <= value <= ref_range.high_normal:
            return AbnormalityLevel.NORMAL
        
        # Check high/low
        if value < ref_range.low_normal:
            return AbnormalityLevel.LOW
        return AbnormalityLevel.HIGH
    
    def _assess_clinical_significance(
        self,
        test_code: str,
        abnormality: AbnormalityLevel,
        percent_deviation: float,
    ) -> str:
        """Assess clinical significance of the result."""
        if abnormality == AbnormalityLevel.NORMAL:
            return "Within normal limits - no immediate action required"
        
        if abnormality in [AbnormalityLevel.CRITICAL_LOW, AbnormalityLevel.CRITICAL_HIGH]:
            return "CRITICAL VALUE - Immediate clinical attention required"
        
        if percent_deviation < 10:
            return "Mild abnormality - Consider rechecking or monitoring"
        elif percent_deviation < 25:
            return "Moderate abnormality - Clinical correlation recommended"
        else:
            return "Significant abnormality - Further evaluation recommended"
    
    def _get_possible_causes(
        self,
        test_code: str,
        abnormality: AbnormalityLevel,
        medications: Optional[List[str]] = None,
    ) -> List[str]:
        """Get possible causes for abnormal result."""
        causes = []
        
        # Common causes by test
        common_causes = {
            "HGB": {
                "low": ["Iron deficiency anemia", "Vitamin B12 deficiency", "Chronic disease", "Blood loss", "Hemolysis", "Bone marrow disorder"],
                "high": ["Dehydration", "Polycythemia vera", "Chronic hypoxia", "High altitude", "Smoking"],
            },
            "WBC": {
                "low": ["Viral infection", "Bone marrow suppression", "Autoimmune disorder", "Drug effect", "Severe sepsis"],
                "high": ["Bacterial infection", "Inflammation", "Leukemia", "Stress response", "Corticosteroid use"],
            },
            "PLT": {
                "low": ["ITP", "Drug effect", "Sepsis", "Splenic sequestration", "Bone marrow disorder", "DIC"],
                "high": ["Reactive thrombocytosis", "Inflammation", "Iron deficiency", "Essential thrombocythemia"],
            },
            "NA": {
                "low": ["SIADH", "Diuretics", "Heart failure", "Cirrhosis", "Adrenal insufficiency", "Vomiting/diarrhea"],
                "high": ["Dehydration", "Diabetes insipidus", "Excess sodium intake", "Hyperaldosteronism"],
            },
            "K": {
                "low": ["Diuretics", "Vomiting/diarrhea", "Hyperaldosteronism", "Insulin therapy", "Alkalosis"],
                "high": ["Renal failure", "ACE inhibitors", "K-sparing diuretics", "Acidosis", "Hemolysis"],
            },
            "CREATININE": {
                "low": ["Low muscle mass", "Pregnancy", "Malnutrition"],
                "high": ["Acute kidney injury", "Chronic kidney disease", "Dehydration", "Medication effect", "Obstruction"],
            },
            "GLUCOSE": {
                "low": ["Insulin excess", "Sulfonylureas", "Fasting", "Insulinoma", "Adrenal insufficiency"],
                "high": ["Diabetes mellitus", "Stress", "Corticosteroids", "Pancreatitis", "Cushing syndrome"],
            },
            "ALT": {
                "low": ["Vitamin B6 deficiency", "Low muscle mass"],
                "high": ["Hepatitis", "Drug-induced liver injury", "NAFLD", "Alcoholic liver disease", "Autoimmune hepatitis"],
            },
            "TSH": {
                "low": ["Hyperthyroidism", "Pituitary dysfunction", "Excess thyroid hormone therapy"],
                "high": ["Hypothyroidism", "Hashimoto thyroiditis", "Recovery from illness"],
            },
            "TROPONIN_I": {
                "low": [],
                "high": ["Myocardial infarction", "Myocarditis", "Pulmonary embolism", "Sepsis", "Kidney disease"],
            },
            "D_DIMER": {
                "low": [],
                "high": ["Venous thromboembolism", "DIC", "Pulmonary embolism", "Recent surgery", "Malignancy", "Pregnancy"],
            },
            "BNP": {
                "low": [],
                "high": ["Heart failure", "ACS", "Pulmonary hypertension", "Renal failure", "Atrial fibrillation"],
            },
        }
        
        if test_code in common_causes:
            key = "low" if abnormality in [AbnormalityLevel.LOW, AbnormalityLevel.CRITICAL_LOW] else "high"
            causes.extend(common_causes[test_code].get(key, []))
        
        # Check drug-induced causes
        if medications:
            for category, data in self.drug_abnormalities.items():
                if test_code in data["tests"]:
                    for drug in data["drugs"]:
                        for med in medications:
                            if drug.lower() in med.lower() or med.lower() in drug.lower():
                                cause = f"Drug-induced ({med})"
                                if cause not in causes:
                                    causes.append(cause)
                                break
        
        return causes[:10]  # Limit to top 10
    
    def _get_follow_up_tests(
        self,
        test_code: str,
        abnormality: AbnormalityLevel,
        value: float,
    ) -> List[str]:
        """Get recommended follow-up tests."""
        if abnormality == AbnormalityLevel.NORMAL:
            return []
        
        follow_up_map = {
            "HGB": ["Iron studies (ferritin, TIBC)", "Vitamin B12", "Folate", "Reticulocyte count", "Peripheral smear"],
            "WBC": ["Differential count", "Blood smear", "CRP", "ESR", "Culture if infection suspected"],
            "PLT": ["Peripheral smear", "Coagulation studies", "LDH", "Haptoglobin"],
            "NA": ["Serum osmolality", "Urine osmolality", "Urine sodium", "TSH", "Cortisol"],
            "K": ["ECG", "Magnesium", "Calcium", "ABG", "Renal function"],
            "CREATININE": ["eGFR calculation", "Urinalysis", "Urine protein", "Renal ultrasound"],
            "GLUCOSE": ["HbA1c", "Fasting glucose", "OGTT", "C-peptide"],
            "ALT": ["AST", "ALP", "Bilirubin", "Hepatitis panel", "Liver ultrasound"],
            "TSH": ["Free T4", "Free T3", "Thyroid antibodies"],
            "TROPONIN_I": ["Repeat troponin in 3-6 hours", "ECG", "Echocardiogram", "BNP"],
            "D_DIMER": ["Doppler ultrasound if DVT suspected", "CT-PA if PE suspected", "Clinical probability scoring"],
            "BNP": ["Echocardiogram", "Chest X-ray", "ECG", "Renal function"],
            "INR": ["PT/PTT", "Liver function tests", "Review anticoagulant dosing"],
        }
        
        return follow_up_map.get(test_code, [])
    
    def _generate_clinical_notes(
        self,
        test_code: str,
        abnormality: AbnormalityLevel,
        value: float,
        ref_range: ReferenceRange,
    ) -> str:
        """Generate clinical notes for the result."""
        if abnormality == AbnormalityLevel.NORMAL:
            return f"Result within normal reference range ({ref_range.low_normal}-{ref_range.high_normal} {ref_range.unit})."
        
        if abnormality in [AbnormalityLevel.CRITICAL_LOW, AbnormalityLevel.CRITICAL_HIGH]:
            return f"⚠️ CRITICAL VALUE: {value} {ref_range.unit}. Immediate clinical evaluation required. Reference: {ref_range.low_normal}-{ref_range.high_normal}."
        
        direction = "below" if abnormality in [AbnormalityLevel.LOW] else "above"
        return f"Result is {direction} normal range ({ref_range.low_normal}-{ref_range.high_normal} {ref_range.unit}). Clinical correlation recommended."
    
    def analyze_trend(
        self,
        test_code: str,
        historical_values: List[Tuple[datetime, float]],
    ) -> Optional[TrendAnalysis]:
        """Analyze trend in lab values over time."""
        if len(historical_values) < 2:
            return None
        
        # Sort by date
        sorted_values = sorted(historical_values, key=lambda x: x[0])
        
        # Calculate trend
        first_value = sorted_values[0][1]
        last_value = sorted_values[-1][1]
        
        if first_value == 0:
            percent_change = 100 if last_value > 0 else 0
        else:
            percent_change = ((last_value - first_value) / abs(first_value)) * 100
        
        if percent_change > 10:
            direction = "increasing"
        elif percent_change < -10:
            direction = "decreasing"
        else:
            direction = "stable"
        
        # Check for significant delta
        threshold = self.delta_thresholds.get(test_code.upper(), 20.0)
        significant = abs(percent_change) >= threshold
        
        # Generate interpretation
        if significant:
            interpretation = f"Significant {direction} trend ({abs(percent_change):.1f}% change). Requires clinical attention."
        else:
            interpretation = f"Stable trend with minor variations ({abs(percent_change):.1f}% change)."
        
        return TrendAnalysis(
            test_name=test_code.upper(),
            values=sorted_values,
            trend_direction=direction,
            percent_change=percent_change,
            significant_delta=significant,
            delta_threshold=threshold,
            interpretation=interpretation,
        )
    
    def interpret_panel(
        self,
        results: Dict[str, float],
        age: int,
        gender: str,
        is_pregnant: bool = False,
        current_medications: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Interpret a panel of lab results with cross-analysis."""
        interpretations = {}
        
        for test_code, value in results.items():
            interpretations[test_code] = self.interpret_result(
                test_code, value, age, gender, is_pregnant, current_medications
            ).to_dict()
        
        # Cross-analysis for patterns
        patterns = self._detect_patterns(results, interpretations)
        
        # Calculate eGFR if creatinine present
        eGFR = None
        if "CREATININE" in results and "creatinine" not in results:
            eGFR = self._calculate_egfr(results["CREATININE"], age, gender)
            if eGFR:
                interpretations["eGFR_calculated"] = {
                    "test_name": "eGFR (Calculated)",
                    "value": round(eGFR, 1),
                    "unit": "mL/min/1.73m²",
                    "interpretation": self._interpret_egfr(eGFR),
                }
        
        return {
            "interpretations": interpretations,
            "patterns_detected": patterns,
            "critical_values": [
                {"test": k, "value": v["value"], "abnormality": v["abnormality"]}
                for k, v in interpretations.items()
                if v.get("is_critical", False)
            ],
            "abnormal_count": sum(1 for v in interpretations.values() if v.get("abnormality") != "normal"),
        }
    
    def _detect_patterns(
        self,
        results: Dict[str, float],
        interpretations: Dict[str, Dict],
    ) -> List[Dict[str, Any]]:
        """Detect clinically significant patterns across results."""
        patterns = []
        
        # Liver injury pattern
        if "ALT" in results and "AST" in results:
            alt = results["ALT"]
            ast = results["AST"]
            if alt > 0 and ast > 0:
                ratio = ast / alt
                if ratio > 2 and ast > 100:
                    patterns.append({
                        "pattern": "AST/ALT ratio > 2",
                        "significance": "Suggests alcoholic liver disease or cirrhosis",
                        "tests": ["AST", "ALT"],
                    })
                elif ratio < 1 and alt > ast:
                    patterns.append({
                        "pattern": "ALT > AST",
                        "significance": "Suggests viral hepatitis or NAFLD",
                        "tests": ["AST", "ALT"],
                    })
        
        # Renal dysfunction pattern
        if "CREATININE" in results and "BUN" in results:
            bun = results["BUN"]
            cr = results["CREATININE"]
            if cr > 0:
                bun_cr_ratio = bun / cr
                if bun_cr_ratio > 20:
                    patterns.append({
                        "pattern": "BUN/Cr ratio > 20",
                        "significance": "Suggests prerenal azotemia (dehydration, GI bleed, etc.)",
                        "tests": ["BUN", "Creatinine"],
                    })
                elif bun_cr_ratio < 10:
                    patterns.append({
                        "pattern": "BUN/Cr ratio < 10",
                        "significance": "Suggests intrinsic renal disease or malnutrition",
                        "tests": ["BUN", "Creatinine"],
                    })
        
        # Anemia classification
        if "HGB" in results and "MCV" in results:
            hgb = results["HGB"]
            mcv = results["MCV"]
            if hgb < 12 and mcv < 80:
                patterns.append({
                    "pattern": "Microcytic anemia",
                    "significance": "Consider iron deficiency, thalassemia, or anemia of chronic disease",
                    "tests": ["Hemoglobin", "MCV"],
                })
            elif hgb < 12 and mcv > 100:
                patterns.append({
                    "pattern": "Macrocytic anemia",
                    "significance": "Consider B12/folate deficiency, hypothyroidism, or medications",
                    "tests": ["Hemoglobin", "MCV"],
                })
        
        # Metabolic pattern
        if "NA" in results and "K" in results:
            na = results["NA"]
            k = results["K"]
            if na < 135 and k > 5.0:
                patterns.append({
                    "pattern": "Hyponatremia with hyperkalemia",
                    "significance": "Consider adrenal insufficiency or renal dysfunction",
                    "tests": ["Sodium", "Potassium"],
                })
        
        # Cardiac injury pattern
        if "TROPONIN_I" in results or "TROPONIN_T" in results:
            troponin = results.get("TROPONIN_I", results.get("TROPONIN_T", 0))
            bnp = results.get("BNP", results.get("NT_PROBNP", 0))
            if troponin > 0.04 and bnp > 100:
                patterns.append({
                    "pattern": "Elevated troponin and BNP",
                    "significance": "Cardiac injury with heart failure - high risk",
                    "tests": ["Troponin", "BNP"],
                })
        
        return patterns
    
    def _calculate_egfr(self, creatinine: float, age: int, gender: str) -> float:
        """Calculate eGFR using CKD-EPI equation."""
        if creatinine <= 0:
            return 0
        
        # CKD-EPI 2021 equation (without race)
        if gender.lower() == "female":
            kappa = 0.7
            alpha = -0.241
            gender_factor = 1.012
        else:
            kappa = 0.9
            alpha = -0.302
            gender_factor = 1
        
        if creatinine <= kappa:
            egfr = 142 * (creatinine / kappa) ** alpha * (0.9938 ** age) * gender_factor
        else:
            egfr = 142 * (creatinine / kappa) ** (-1.200) * (0.9938 ** age) * gender_factor
        
        return min(egfr, 150)  # Cap at 150
    
    def _interpret_egfr(self, egfr: float) -> str:
        """Interpret eGFR value according to CKD staging."""
        if egfr >= 90:
            return "Normal or high (G1) - No CKD if no other markers"
        elif egfr >= 60:
            return "Mildly decreased (G2) - Monitor if persistent"
        elif egfr >= 45:
            return "Mild to moderately decreased (G3a) - CKD Stage 3a"
        elif egfr >= 30:
            return "Moderately to severely decreased (G3b) - CKD Stage 3b"
        elif egfr >= 15:
            return "Severely decreased (G4) - CKD Stage 4, prepare for RRT"
        else:
            return "Kidney failure (G5) - CKD Stage 5, renal replacement therapy indicated"
    
    def get_stats(self) -> Dict[str, Any]:
        """Get interpretation statistics."""
        return self.stats


# Singleton instance
_lab_engine: Optional[LabInterpretationEngine] = None


def get_lab_engine() -> LabInterpretationEngine:
    """Get or create lab interpretation engine singleton."""
    global _lab_engine
    
    if _lab_engine is None:
        _lab_engine = LabInterpretationEngine()
    
    return _lab_engine

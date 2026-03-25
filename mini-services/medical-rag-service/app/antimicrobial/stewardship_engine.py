"""
P3: Antimicrobial Stewardship Engine
=====================================

Implements comprehensive antibiotic stewardship:
- Empiric antibiotic recommendations by syndrome
- Local antibiogram integration
- Culture-directed therapy recommendations
- Duration optimization
- IV-to-PO conversion criteria
- Renal dosing adjustments for antimicrobials
- Drug-bug matching database

Reference: IDSA Antimicrobial Stewardship Guidelines 2024
"""

import asyncio
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

from loguru import logger

# Import evidence-based allergy conflict checking
from app.antimicrobial.allergy_conflict import (
    check_allergy_conflict,
    build_allergy_types_dict,
    AllergyConflictResult,
    AllergyType,
    ConflictSeverity,
    is_cephalosporin,
    is_penicillin,
    is_sulfa_drug,
)


class InfectionSite(Enum):
    """Common infection sites/sites of infection."""
    RESPIRATORY = "respiratory"
    URINARY = "urinary"
    SKIN_SOFT_TISSUE = "skin_soft_tissue"
    INTRAABDOMINAL = "intraabdominal"
    BLOODSTREAM = "bloodstream"
    CNS = "cns"
    BONE_JOINT = "bone_joint"
    CARDIAC = "cardiac"
    ENT = "ent"
    GYNECOLOGIC = "gynecologic"


class Severity(Enum):
    """Infection severity classification."""
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


class AllergySeverity(Enum):
    """Allergy severity levels."""
    NONE = "none"
    MILD = "mild"          # Rash, itching
    MODERATE = "moderate"  # Hives, angioedema
    SEVERE = "severe"      # Anaphylaxis, Stevens-Johnson


@dataclass
class AntimicrobialRecommendation:
    """Antimicrobial therapy recommendation."""
    drug_name: str
    dose: str
    frequency: str
    route: str
    duration_days: int
    indications: List[str] = field(default_factory=list)
    contraindications: List[str] = field(default_factory=list)
    renal_adjustment: bool = False
    hepatic_adjustment: bool = False
    drug_interactions: List[str] = field(default_factory=list)
    monitoring: List[str] = field(default_factory=list)
    cost_tier: str = "standard"  # low, standard, high
    is_alternative: bool = False
    rationale: str = ""
    additional_notes: str = ""  # For combination therapy notes
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug_name": self.drug_name,
            "dose": self.dose,
            "frequency": self.frequency,
            "route": self.route,
            "duration_days": self.duration_days,
            "indications": self.indications,
            "contraindications": self.contraindications,
            "renal_adjustment": self.renal_adjustment,
            "hepatic_adjustment": self.hepatic_adjustment,
            "drug_interactions": self.drug_interactions,
            "monitoring": self.monitoring,
            "cost_tier": self.cost_tier,
            "is_alternative": self.is_alternative,
            "rationale": self.rationale,
            "additional_notes": self.additional_notes,
        }


@dataclass
class AntibiogramData:
    """Local antibiogram susceptibility data."""
    organism: str
    antibiotics: Dict[str, float]  # antibiotic -> % susceptible
    sample_size: int
    year: int
    institution: str = "default"


# =============================================================================
# EMPIRIC THERAPY DATABASE
# =============================================================================

EMPIRIC_THERAPY: Dict[str, Dict[str, Any]] = {
    # COMMUNITY-ACQUIRED PNEUMONIA
    "CAP_OUTPATIENT_HEALTHY": {
        "diagnosis": "Community-Acquired Pneumonia (Outpatient, Healthy)",
        "site": InfectionSite.RESPIRATORY,
        "first_line": [
            AntimicrobialRecommendation(
                drug_name="Amoxicillin",
                dose="1 g",
                frequency="every 8 hours",
                route="PO",
                duration_days=5,
                indications=["CAP in healthy patient without comorbidities"],
                monitoring=["Clinical response in 48-72 hours"],
                cost_tier="low",
                rationale="Covers S. pneumoniae, most common CAP pathogen",
            )
        ],
        "alternatives": [
            AntimicrobialRecommendation(
                drug_name="Doxycycline",
                dose="100 mg",
                frequency="every 12 hours",
                route="PO",
                duration_days=5,
                indications=["Penicillin allergy", "Atypical coverage needed"],
                monitoring=["Photosensitivity", "GI upset"],
                cost_tier="low",
                is_alternative=True,
            ),
            AntimicrobialRecommendation(
                drug_name="Azithromycin",
                dose="500 mg day 1, then 250 mg",
                frequency="daily",
                route="PO",
                duration_days=5,
                indications=["Penicillin allergy", "Atypical coverage"],
                monitoring=["QT prolongation", "GI upset"],
                cost_tier="standard",
                is_alternative=True,
            ),
        ],
    },
    
    "CAP_OUTPATIENT_COMORBID": {
        "diagnosis": "Community-Acquired Pneumonia (Outpatient, Comorbidities)",
        "site": InfectionSite.RESPIRATORY,
        "first_line": [
            AntimicrobialRecommendation(
                drug_name="Amoxicillin-Clavulanate",
                dose="875/125 mg",
                frequency="every 12 hours",
                route="PO",
                duration_days=5,
                indications=["CAP with comorbidities (COPD, diabetes, heart failure, etc.)"],
                renal_adjustment=True,
                monitoring=["Clinical response in 48-72 hours"],
                cost_tier="standard",
                rationale="Broader coverage for comorbid patients",
            ),
            AntimicrobialRecommendation(
                drug_name="PLUS Doxycycline OR Azithromycin",
                dose="See individual drugs",
                frequency="See individual drugs",
                route="PO",
                duration_days=5,
                indications=["For atypical coverage"],
                rationale="Combination therapy for atypical pathogens",
            ),
        ],
        "alternatives": [
            AntimicrobialRecommendation(
                drug_name="Levofloxacin",
                dose="750 mg",
                frequency="daily",
                route="PO",
                duration_days=5,
                indications=["Penicillin allergy", "Failed first-line therapy"],
                renal_adjustment=True,
                drug_interactions=["QT prolongation", "Antacids", "NSAIDs"],
                monitoring=["Tendon pain", "CNS effects"],
                cost_tier="standard",
                is_alternative=True,
            ),
        ],
    },
    
    "CAP_INPATIENT": {
        "diagnosis": "Community-Acquired Pneumonia (Inpatient, Non-severe)",
        "site": InfectionSite.RESPIRATORY,
        "first_line": [
            AntimicrobialRecommendation(
                drug_name="Ceftriaxone",
                dose="1 g",
                frequency="daily",
                route="IV",
                duration_days=5,
                indications=["CAP requiring hospitalization"],
                monitoring=["Clinical response", "Renal function"],
                cost_tier="low",
            ),
            AntimicrobialRecommendation(
                drug_name="PLUS Azithromycin",
                dose="500 mg",
                frequency="daily",
                route="IV/PO",
                duration_days=5,
                indications=["For atypical coverage"],
                monitoring=["QT interval"],
            ),
        ],
        "alternatives": [
            AntimicrobialRecommendation(
                drug_name="Levofloxacin",
                dose="750 mg",
                frequency="daily",
                route="IV/PO",
                duration_days=5,
                indications=["Penicillin allergy (non-severe)"],
                renal_adjustment=True,
                is_alternative=True,
            ),
        ],
    },
    
    # URINARY TRACT INFECTIONS
    "UTI_UNCOMPLICATED": {
        "diagnosis": "Uncomplicated UTI (Cystitis)",
        "site": InfectionSite.URINARY,
        "first_line": [
            AntimicrobialRecommendation(
                drug_name="Nitrofurantoin",
                dose="100 mg",
                frequency="every 12 hours",
                route="PO",
                duration_days=5,
                indications=["Uncomplicated cystitis in women"],
                contraindications=["CrCl < 30 mL/min", "Pregnancy (at term)"],
                monitoring=["GI tolerance"],
                cost_tier="low",
                rationale="First-line per IDSA guidelines, low resistance",
            ),
        ],
        "alternatives": [
            AntimicrobialRecommendation(
                drug_name="TMP-SMX DS",
                dose="1 tablet",
                frequency="every 12 hours",
                route="PO",
                duration_days=3,
                indications=["Alternative first-line if local resistance < 20%"],
                contraindications=["Pregnancy", "Sulfa allergy"],
                monitoring=["Rash", "GI upset"],
                cost_tier="low",
                is_alternative=True,
            ),
            AntimicrobialRecommendation(
                drug_name="Fosfomycin",
                dose="3 g",
                frequency="single dose",
                route="PO",
                duration_days=1,
                indications=["Single-dose option", "Compliance concerns"],
                monitoring=["GI upset"],
                cost_tier="standard",
                is_alternative=True,
            ),
        ],
    },
    
    "PYELONEPHRITIS_OUTPATIENT": {
        "diagnosis": "Acute Pyelonephritis (Outpatient)",
        "site": InfectionSite.URINARY,
        "first_line": [
            AntimicrobialRecommendation(
                drug_name="Ciprofloxacin",
                dose="500 mg",
                frequency="every 12 hours",
                route="PO",
                duration_days=7,
                indications=["Uncomplicated pyelonephritis"],
                renal_adjustment=True,
                drug_interactions=["QT prolongation", "Antacids"],
                monitoring=["Tendon pain", "CNS effects"],
                cost_tier="low",
            ),
        ],
        "alternatives": [
            AntimicrobialRecommendation(
                drug_name="Levofloxacin",
                dose="750 mg",
                frequency="daily",
                route="PO",
                duration_days=5,
                indications=["Alternative fluoroquinolone"],
                renal_adjustment=True,
                is_alternative=True,
            ),
            AntimicrobialRecommendation(
                drug_name="TMP-SMX DS",
                dose="1 tablet",
                frequency="every 12 hours",
                route="PO",
                duration_days=14,
                indications=["If susceptible organism known"],
                contraindications=["Sulfa allergy"],
                is_alternative=True,
            ),
        ],
    },
    
    # SKIN AND SOFT TISSUE INFECTIONS
    "CELLULITIS_NONPURULENT": {
        "diagnosis": "Cellulitis (Non-purulent)",
        "site": InfectionSite.SKIN_SOFT_TISSUE,
        "first_line": [
            AntimicrobialRecommendation(
                drug_name="Cephalexin",
                dose="500 mg",
                frequency="every 6 hours",
                route="PO",
                duration_days=5,
                indications=["Non-purulent cellulitis", "No MRSA risk factors"],
                contraindications=["Severe penicillin allergy"],
                renal_adjustment=True,
                monitoring=["Clinical response in 48-72 hours"],
                cost_tier="low",
                rationale="Covers streptococci, most common cause",
            ),
        ],
        "alternatives": [
            AntimicrobialRecommendation(
                drug_name="Dicloxacillin",
                dose="500 mg",
                frequency="every 6 hours",
                route="PO",
                duration_days=5,
                indications=["Alternative anti-staphylococcal penicillin"],
                contraindications=["Penicillin allergy"],
                monitoring=["GI upset"],
                cost_tier="low",
                is_alternative=True,
            ),
        ],
    },
    
    "CELLULITIS_MRSA": {
        "diagnosis": "Cellulitis (MRSA suspected)",
        "site": InfectionSite.SKIN_SOFT_TISSUE,
        "first_line": [
            AntimicrobialRecommendation(
                drug_name="TMP-SMX DS",
                dose="1-2 tablets",
                frequency="every 12 hours",
                route="PO",
                duration_days=5,
                indications=["Purulent cellulitis", "MRSA risk factors", "Failed beta-lactam"],
                contraindications=["Sulfa allergy", "Pregnancy"],
                monitoring=["Rash", "Hyperkalemia"],
                cost_tier="low",
            ),
        ],
        "alternatives": [
            AntimicrobialRecommendation(
                drug_name="Doxycycline",
                dose="100 mg",
                frequency="every 12 hours",
                route="PO",
                duration_days=5,
                indications=["MRSA coverage"],
                contraindications=["Pregnancy", "Children < 8 years"],
                monitoring=["Photosensitivity", "GI upset"],
                cost_tier="low",
                is_alternative=True,
            ),
            AntimicrobialRecommendation(
                drug_name="Clindamycin",
                dose="300-450 mg",
                frequency="every 6-8 hours",
                route="PO",
                duration_days=5,
                indications=["MRSA coverage (check local susceptibility)"],
                monitoring=["Diarrhea", "C. difficile risk"],
                cost_tier="low",
                is_alternative=True,
            ),
        ],
    },
    
    # INTRAABDOMINAL INFECTIONS
    "INTRAABDOMINAL_MILD_MODERATE": {
        "diagnosis": "Intraabdominal Infection (Mild-Moderate)",
        "site": InfectionSite.INTRAABDOMINAL,
        "first_line": [
            AntimicrobialRecommendation(
                drug_name="Cefazolin",
                dose="1-2 g",
                frequency="every 8 hours",
                route="IV",
                duration_days=4,
                indications=["Community-acquired intraabdominal infection"],
                additional_notes="Use WITH Metronidazole for anaerobic coverage",
                monitoring=["Renal function"],
                cost_tier="low",
            ),
            AntimicrobialRecommendation(
                drug_name="Metronidazole",
                dose="500 mg",
                frequency="every 8 hours",
                route="IV/PO",
                duration_days=4,
                indications=["Anaerobic coverage for intraabdominal infections"],
                monitoring=["GI upset", "Disulfiram reaction"],
            ),
        ],
        "alternatives": [
            AntimicrobialRecommendation(
                drug_name="Ampicillin-Sulbactam",
                dose="3 g",
                frequency="every 6 hours",
                route="IV",
                duration_days=4,
                indications=["Alternative for mild-moderate infections"],
                renal_adjustment=True,
                is_alternative=True,
            ),
        ],
    },
    
    # BLOODSTREAM INFECTIONS
    "SEPSIS_UNKNOWN_SOURCE": {
        "diagnosis": "Sepsis (Unknown Source)",
        "site": InfectionSite.BLOODSTREAM,
        "first_line": [
            AntimicrobialRecommendation(
                drug_name="Vancomycin",
                dose="15-20 mg/kg",
                frequency="every 8-12 hours",
                route="IV",
                duration_days="Variable",
                indications=["Sepsis, unknown source", "MRSA coverage"],
                renal_adjustment=True,
                monitoring=["Trough levels", "Renal function", "Red man syndrome"],
                cost_tier="standard",
                rationale="Covers MRSA, recommended for sepsis of unknown source",
            ),
            AntimicrobialRecommendation(
                drug_name="PLUS Piperacillin-Tazobactam",
                dose="4.5 g",
                frequency="every 6 hours",
                route="IV",
                duration_days="Variable",
                indications=["Broad gram-negative and anaerobic coverage"],
                renal_adjustment=True,
                monitoring=["Renal function", "CNS effects (high doses)"],
            ),
        ],
        "alternatives": [
            AntimicrobialRecommendation(
                drug_name="Meropenem",
                dose="1 g",
                frequency="every 8 hours",
                route="IV",
                duration_days="Variable",
                indications=["Severe sepsis", "ESBL risk", "Penicillin allergy (mild)"],
                renal_adjustment=True,
                monitoring=["Seizure risk"],
                cost_tier="high",
                is_alternative=True,
            ),
        ],
    },
}

# =============================================================================
# IV-TO-PO CONVERSION CRITERIA
# =============================================================================

IV_TO_PO_ELIGIBLE = {
    "FLUOROQUINOLONES": {
        "drugs": ["ciprofloxacin", "levofloxacin", "moxifloxacin"],
        "criteria": [
            "Hemodynamically stable",
            "Able to tolerate oral intake",
            "No GI malabsorption",
            "No ileus or bowel obstruction",
        ],
        "bioequivalence": ">90%",
    },
    "AZITHROMYCIN": {
        "drugs": ["azithromycin"],
        "criteria": [
            "Able to tolerate oral intake",
            "No severe GI disease",
        ],
        "bioequivalence": "High",
    },
    "LINEZOLID": {
        "drugs": ["linezolid"],
        "criteria": [
            "Able to tolerate oral intake",
            "No GI malabsorption",
        ],
        "bioequivalence": "100%",
    },
    "CLINDAMYCIN": {
        "drugs": ["clindamycin"],
        "criteria": [
            "Able to tolerate oral intake",
            "Hemodynamically stable",
        ],
        "bioequivalence": "High",
    },
    "METRONIDAZOLE": {
        "drugs": ["metronidazole"],
        "criteria": [
            "Able to tolerate oral intake",
            "No severe GI disease",
        ],
        "bioequivalence": "100%",
    },
    "FLUCONAZOLE": {
        "drugs": ["fluconazole"],
        "criteria": [
            "Able to tolerate oral intake",
            "Not critical illness",
        ],
        "bioequivalence": ">90%",
    },
}

# =============================================================================
# RENAL DOSING ADJUSTMENTS
# =============================================================================

RENAL_DOSING = {
    "VANCOMYCIN": {
        "normal": {"dose": "15-20 mg/kg", "interval": "every 8-12 hours"},
        "mild_50": {"dose": "15-20 mg/kg", "interval": "every 12 hours"},
        "moderate_30": {"dose": "15-20 mg/kg", "interval": "every 24 hours"},
        "severe_15": {"dose": "15-20 mg/kg", "interval": "every 48 hours or by levels"},
        "dialysis": {"dose": "15-20 mg/kg", "interval": "post-dialysis", "notes": "Check trough pre-dialysis"},
        "monitoring": "Trough levels 15-20 mcg/mL for serious infections",
    },
    "PIPERACILLIN_TAZOBACTAM": {
        "normal": {"dose": "4.5 g", "interval": "every 6 hours"},
        "mild_40": {"dose": "4.5 g", "interval": "every 6 hours"},
        "moderate_20": {"dose": "3.375 g", "interval": "every 8 hours"},
        "severe_10": {"dose": "2.25 g", "interval": "every 8 hours"},
        "dialysis": {"dose": "2.25 g", "interval": "every 8 hours", "notes": "Dose after dialysis"},
    },
    "CEFTRIAXONE": {
        "normal": {"dose": "1-2 g", "interval": "daily"},
        "any_crcl": {"dose": "No adjustment needed", "interval": "daily"},
        "dialysis": {"dose": "1-2 g", "interval": "daily", "notes": "Dose after dialysis on dialysis days"},
    },
    "LEVOFLOXACIN": {
        "normal": {"dose": "750 mg", "interval": "daily"},
        "mild_50": {"dose": "750 mg", "interval": "daily"},
        "moderate_30": {"dose": "750 mg", "interval": "every 48 hours"},
        "severe_10": {"dose": "500 mg", "interval": "every 48 hours"},
        "dialysis": {"dose": "500 mg", "interval": "after dialysis"},
    },
    "CIPROFLOXACIN": {
        "normal": {"dose": "400 mg IV / 500-750 mg PO", "interval": "every 12 hours"},
        "mild_50": {"dose": "400 mg IV / 500-750 mg PO", "interval": "every 12 hours"},
        "moderate_30": {"dose": "400 mg IV / 500 mg PO", "interval": "every 18 hours"},
        "severe_10": {"dose": "400 mg IV / 500 mg PO", "interval": "every 24 hours"},
        "dialysis": {"dose": "400 mg IV / 500 mg PO", "interval": "after dialysis"},
    },
}

# =============================================================================
# DRUG-BUG MATCHING DATABASE
# =============================================================================

DRUG_BUG_MATCHING = {
    "STAPHYLOCOCCUS_AUREUS_MSSA": {
        "preferred": ["nafcillin", "oxacillin", "cefazolin"],
        "alternative": ["vancomycin", "daptomycin", "linezolid"],
        "notes": "Beta-lactams preferred if susceptible. Vancomycin for MRSA or severe allergy.",
    },
    "STAPHYLOCOCCUS_AUREUS_MRSA": {
        "preferred": ["vancomycin", "daptomycin"],
        "alternative": ["linezolid", "ceftaroline", "TMP-SMX", "clindamycin (if susceptible)"],
        "notes": "Check MIC values. Daptomycin preferred for bacteremia. Linezolid for MRSA pneumonia.",
    },
    "STREPTOCOCCUS_PNEUMONIAE": {
        "preferred": ["penicillin G", "amoxicillin", "ceftriaxone"],
        "alternative": ["levofloxacin", "moxifloxacin", "vancomycin"],
        "notes": "Check local penicillin resistance rates. High-dose amoxicillin for resistant strains.",
    },
    "ESCHERICHIA_COLI": {
        "preferred": ["ceftriaxone", "ertapenem", "piperacillin-tazobactam"],
        "alternative": ["ciprofloxacin", "levofloxacin", "meropenem"],
        "notes": "Check ESBL status. Fluoroquinolone resistance increasing. Carbapenems for ESBL.",
    },
    "KLEBSIELLA_PNEUMONIAE": {
        "preferred": ["ceftriaxone", "ertapenem"],
        "alternative": ["levofloxacin", "meropenem", "piperacillin-tazobactam"],
        "notes": "High ESBL prevalence. Check carbapenemase production in endemic areas.",
    },
    "PSEUDOMONAS_AERUGINOSA": {
        "preferred": ["piperacillin-tazobactam", "cefepime", "meropenem"],
        "alternative": ["ciprofloxacin", "ceftazidime", "aztreonam"],
        "notes": "Use combination therapy for severe infections. Check local susceptibility patterns.",
    },
    "ENTEROCOCCUS_FAECALIS": {
        "preferred": ["ampicillin", "vancomycin"],
        "alternative": ["linezolid", "daptomycin"],
        "notes": "Check ampicillin susceptibility. VRE requires alternative agents.",
    },
    "BACTEROIDES_FRAGILIS": {
        "preferred": ["metronidazole", "piperacillin-tazobactam"],
        "alternative": ["meropenem", "clindamycin"],
        "notes": "Metronidazole excellent anaerobic coverage. Beta-lactam/beta-lactamase inhibitors also effective.",
    },
}


class AntimicrobialStewardshipEngine:
    """
    P3: Comprehensive Antimicrobial Stewardship Engine.
    
    Features:
    - Empiric therapy recommendations
    - Culture-directed therapy
    - Duration optimization
    - IV-to-PO conversion
    - Renal dosing
    - Drug-bug matching
    """
    
    def __init__(self):
        self.empiric_therapy = EMPIRIC_THERAPY
        self.iv_to_po_criteria = IV_TO_PO_ELIGIBLE
        self.renal_dosing = RENAL_DOSING
        self.drug_bug_matching = DRUG_BUG_MATCHING
        
        self.stats = {
            "total_recommendations": 0,
            "iv_to_po_conversions": 0,
            "renal_dosing_adjustments": 0,
            "duration_optimizations": 0,
        }
    
    async def get_empiric_recommendation(
        self,
        infection_type: str,
        severity: Severity = Severity.MODERATE,
        allergies: Optional[List[str]] = None,
        allergy_types: Optional[Dict[str, str]] = None,
        renal_function: Optional[float] = None,  # CrCl in mL/min
        current_medications: Optional[List[str]] = None,
        pregnancy: bool = False,
    ) -> Dict[str, Any]:
        """
        Get empiric antimicrobial recommendations with evidence-based allergy checking.
        
        Args:
            infection_type: Key from EMPIRIC_THERAPY database
            severity: Infection severity
            allergies: List of drug allergies (can include type: "penicillin:rash")
            allergy_types: Dict mapping allergy name to type ("intolerance", "rash", "anaphylaxis", "unknown")
            renal_function: Creatinine clearance
            current_medications: Current medications for interaction check
            pregnancy: Is patient pregnant
        
        Returns:
            Dictionary with recommendations including allergy warnings
            
        Evidence-Based Allergy Checking:
            - Cephalosporin cross-reactivity per Macy E et al. JAMA Intern Med 2014
            - 1st gen: ~2% cross-reactivity with penicillin
            - 2nd gen: ~1% cross-reactivity
            - 3rd/4th/5th gen: <1% cross-reactivity (generally safe)
        """
        self.stats["total_recommendations"] += 1
        
        # Get base recommendation
        key = infection_type.upper()
        if key not in self.empiric_therapy:
            return {
                "error": f"Unknown infection type: {infection_type}",
                "available_types": list(self.empiric_therapy.keys()),
            }
        
        therapy = self.empiric_therapy[key]
        
        # Process allergies - build allergy types dict first
        allergies = allergies or []
        
        # Build allergy types dict from input or parse from allergy strings
        if allergy_types is None:
            allergy_types = build_allergy_types_dict(allergies)
        
        # Get clean allergen names (without type suffix) for matching
        # e.g., "penicillin:anaphylaxis" -> "penicillin"
        clean_allergies = list(allergy_types.keys())
        
        # Collect all allergy warnings (even for non-blocked drugs)
        all_allergy_warnings: List[Dict[str, Any]] = []
        
        # Check first-line recommendations
        first_line = []
        for rec in therapy.get("first_line", []):
            rec_dict = rec.to_dict()
            
            # Check for allergy conflicts using evidence-based logic
            conflict = check_allergy_conflict(
                drug_name=rec.drug_name,
                allergies=clean_allergies,
                allergy_types=allergy_types,
            )
            
            # If blocked, skip this drug
            if conflict.blocked:
                all_allergy_warnings.append({
                    "drug": rec.drug_name,
                    "blocked": True,
                    "reason": conflict.warning,
                    "severity": conflict.severity.value,
                })
                continue
            
            # Add warning even if not blocked (for clinician awareness)
            if conflict.warning:
                rec_dict["allergy_warning"] = conflict.warning
                rec_dict["allergy_severity"] = conflict.severity.value
                rec_dict["cross_reactivity_risk"] = conflict.cross_reactivity_risk
                all_allergy_warnings.append({
                    "drug": rec.drug_name,
                    "blocked": False,
                    "warning": conflict.warning,
                    "severity": conflict.severity.value,
                    "cross_reactivity_risk": conflict.cross_reactivity_risk,
                })
            
            # Apply renal dosing if needed
            if renal_function is not None and rec.renal_adjustment:
                rec_dict["renal_dose"] = self._get_renal_dose(rec.drug_name, renal_function)
                self.stats["renal_dosing_adjustments"] += 1
            
            # Check pregnancy safety
            if pregnancy:
                rec_dict["pregnancy_warning"] = self._check_pregnancy_safety(rec.drug_name)
            
            # Check interactions
            if current_medications:
                interactions = self._check_interactions(rec.drug_name, current_medications)
                if interactions:
                    rec_dict["potential_interactions"] = interactions
            
            first_line.append(rec_dict)
        
        # Process alternatives
        alternatives = []
        for rec in therapy.get("alternatives", []):
            rec_dict = rec.to_dict()
            
            # Check for allergy conflicts using evidence-based logic
            conflict = check_allergy_conflict(
                drug_name=rec.drug_name,
                allergies=clean_allergies,
                allergy_types=allergy_types,
            )
            
            if conflict.blocked:
                continue
            
            # Add warning even if not blocked
            if conflict.warning:
                rec_dict["allergy_warning"] = conflict.warning
                rec_dict["allergy_severity"] = conflict.severity.value
            
            if renal_function is not None and rec.renal_adjustment:
                rec_dict["renal_dose"] = self._get_renal_dose(rec.drug_name, renal_function)
            
            alternatives.append(rec_dict)
        
        return {
            "diagnosis": therapy["diagnosis"],
            "severity": severity.value,
            "first_line": first_line,
            "alternatives": alternatives,
            "allergy_warnings": all_allergy_warnings,
            "recommendation_notes": self._generate_recommendation_notes(
                infection_type, severity, allergies, renal_function
            ),
            "duration_guidance": self._get_duration_guidance(infection_type, severity),
        }
    
    def _check_allergy_conflict_legacy(self, drug_name: str, allergies: List[str]) -> bool:
        """
        DEPRECATED: Legacy allergy conflict check.
        
        This method is kept for backward compatibility but should not be used.
        Use check_allergy_conflict() from allergy_conflict module instead.
        
        The legacy implementation incorrectly blocked ALL cephalosporins for ANY
        penicillin allergy, which is not evidence-based.
        """
        drug_lower = drug_name.lower()
        
        # Direct match
        for allergy in allergies:
            if allergy in drug_lower or drug_lower in allergy:
                return True
        
        # Class-based cross-reactivity
        beta_lactam_allergies = ["penicillin", "amoxicillin", "ampicillin", "cephalosporin", "cefazolin"]
        if any(a in drug_lower for a in ["penicillin", "amoxicillin", "ampicillin", "nafcillin", "oxacillin"]):
            if any(a in allergies for a in beta_lactam_allergies):
                return True
        
        # Sulfonamide
        if "sulfa" in allergies or "sulfonamide" in allergies:
            if "sulfa" in drug_lower or "tmp-smx" in drug_lower or "bactrim" in drug_lower:
                return True
        
        return False
    
    def _get_renal_dose(self, drug_name: str, crcl: float) -> Dict[str, str]:
        """
        Get renal-adjusted dosing based on creatinine clearance.
        
        Args:
            drug_name: Name of the antimicrobial drug
            crcl: Creatinine clearance in mL/min
            
        Returns:
            Dictionary with dosing recommendations for the given CrCl
            
        Reference: IDSA Antimicrobial Stewardship Guidelines 2024
        """
        drug_key = drug_name.upper().replace("-", "_").replace(" ", "_")
        
        if drug_key not in self.renal_dosing:
            return {"note": "No specific renal dosing guidance available"}
        
        dosing = self.renal_dosing[drug_key]
        
        if crcl >= 50:
            return dosing.get("normal", dosing.get("mild_50", {}))
        elif crcl >= 30:
            return dosing.get("moderate_30", dosing.get("mild_50", dosing.get("normal", {})))
        elif crcl >= 10:
            return dosing.get("severe_15", dosing.get("moderate_30", {}))
        else:
            return dosing.get("dialysis", dosing.get("severe_15", {}))
    
    def calculate_renal_function(
        self,
        age: int,
        weight_kg: float,
        serum_creatinine: float,
        gender: str,
        height_cm: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Calculate creatinine clearance using proper Cockcroft-Gault equation.
        
        CRITICAL: This method uses the correct weight selection algorithm
        for accurate CrCl estimation in all patient populations, including:
        - Underweight patients
        - Normal weight patients
        - Overweight patients
        - Obese patients (>130% IBW)
        
        Reference: Cockcroft DW, Gault MH. Nephron 1976;16:31-41
        
        Args:
            age: Patient age in years
            weight_kg: Actual body weight in kilograms (REQUIRED)
            serum_creatinine: Serum creatinine in mg/dL
            gender: 'male' or 'female'
            height_cm: Height in centimeters (recommended for obesity assessment)
            
        Returns:
            Dictionary containing:
            - crcl_ml_min: Creatinine clearance in mL/min
            - weight_used: Weight used in calculation
            - weight_type: 'actual', 'ideal', or 'adjusted'
            - warnings: Clinical warnings
            - dosing_category: Renal impairment category
            
        Example:
            >>> engine.calculate_renal_function(80, 45, 1.8, 'female', 155)
            {'crcl_ml_min': 18.5, 'weight_used': 45.0, ...}
        """
        from app.calculators.renal_calculations import (
            calculate_creatinine_clearance,
            get_renal_dosing_category,
        )
        
        result = calculate_creatinine_clearance(
            age_years=age,
            weight_kg=weight_kg,
            serum_creatinine=serum_creatinine,
            gender=gender,
            height_cm=height_cm,
        )
        
        severity, considerations = get_renal_dosing_category(result.creatinine_clearance)
        
        return {
            "crcl_ml_min": result.creatinine_clearance,
            "weight_used_kg": result.weight_used,
            "weight_type": result.weight_type.value,
            "ideal_body_weight_kg": result.ideal_body_weight,
            "adjusted_body_weight_kg": result.adjusted_body_weight,
            "is_obese": result.is_obese,
            "obesity_ratio": result.obesity_ratio,
            "warnings": result.warnings,
            "calculation_notes": result.calculation_notes,
            "dosing_category": severity,
            "dosing_considerations": considerations,
            "evidence_sources": result.evidence_sources,
        }
    
    async def get_empiric_recommendation_with_renal_calc(
        self,
        infection_type: str,
        patient_data: Dict[str, Any],
        severity: Severity = Severity.MODERATE,
        allergies: Optional[List[str]] = None,
        current_medications: Optional[List[str]] = None,
        pregnancy: bool = False,
    ) -> Dict[str, Any]:
        """
        Get empiric antimicrobial recommendations with automatic CrCl calculation.
        
        This method calculates creatinine clearance from patient parameters
        and applies appropriate renal dosing adjustments.
        
        Args:
            infection_type: Key from EMPIRIC_THERAPY database
            patient_data: Dictionary containing:
                - age: Patient age in years (REQUIRED for CrCl)
                - weight_kg: Actual body weight in kg (REQUIRED for CrCl)
                - creatinine: Serum creatinine in mg/dL (REQUIRED for CrCl)
                - gender: 'male' or 'female' (REQUIRED for CrCl)
                - height_cm: Height in cm (recommended for obese patients)
            severity: Infection severity
            allergies: List of drug allergies
            current_medications: Current medications for interaction check
            pregnancy: Is patient pregnant
            
        Returns:
            Dictionary with recommendations and renal function details
        """
        # Calculate CrCl if all required parameters are provided
        crcl = None
        renal_details = None
        
        required_for_crcl = ['age', 'weight_kg', 'creatinine', 'gender']
        has_crcl_params = all(k in patient_data for k in required_for_crcl)
        
        if has_crcl_params:
            renal_details = self.calculate_renal_function(
                age=patient_data['age'],
                weight_kg=patient_data['weight_kg'],
                serum_creatinine=patient_data['creatinine'],
                gender=patient_data['gender'],
                height_cm=patient_data.get('height_cm'),
            )
            crcl = renal_details['crcl_ml_min']
        
        # Get standard recommendation
        result = await self.get_empiric_recommendation(
            infection_type=infection_type,
            severity=severity,
            allergies=allergies,
            renal_function=crcl,
            current_medications=current_medications,
            pregnancy=pregnancy,
        )
        
        # Add renal calculation details
        if renal_details:
            result["renal_function"] = renal_details
        elif has_crcl_params is False and 'creatinine' in patient_data:
            result["warnings"] = result.get("warnings", [])
            result["warnings"].append(
                "⚠️ Missing parameters for CrCl calculation. "
                "Required: age, weight_kg, creatinine, gender. "
                "Renal dosing adjustments may be inaccurate."
            )
        
        return result
    
    def _check_pregnancy_safety(self, drug_name: str) -> Optional[str]:
        """Check pregnancy safety category."""
        pregnancy_unsafe = {
            "tetracycline": "Avoid - risk of fetal bone/teeth abnormalities",
            "doxycycline": "Avoid - risk of fetal bone/teeth abnormalities",
            "fluoroquinolone": "Avoid if possible - risk of cartilage damage",
            "ciprofloxacin": "Avoid if possible - risk of cartilage damage",
            "levofloxacin": "Avoid if possible - risk of cartilage damage",
            "clarithromycin": "Avoid - teratogenic risk",
            "trimethoprim": "Avoid in 1st trimester - folate antagonist",
            "tmp-smx": "Avoid in 1st trimester - folate antagonist",
            "nitrofurantoin": "Avoid at term - risk of hemolytic anemia",
        }
        
        drug_lower = drug_name.lower()
        for unsafe_drug, warning in pregnancy_unsafe.items():
            if unsafe_drug in drug_lower:
                return f"⚠️ {warning}"
        
        return None
    
    def _check_interactions(self, drug_name: str, medications: List[str]) -> List[Dict[str, str]]:
        """Check for drug-drug interactions."""
        interactions = []
        drug_lower = drug_name.lower()
        
        # Fluoroquinolone interactions
        if any(d in drug_lower for d in ["floxacin", "quinolone"]):
            for med in medications:
                if "antacid" in med.lower() or "sucralfate" in med.lower():
                    interactions.append({
                        "interacting_drug": med,
                        "interaction": "Reduced absorption - separate by 2-4 hours",
                    })
                if "warfarin" in med.lower():
                    interactions.append({
                        "interacting_drug": med,
                        "interaction": "Increased INR - monitor closely",
                    })
        
        # Vancomycin interactions
        if "vancomycin" in drug_lower:
            for med in medications:
                if any(a in med.lower() for a in ["aminoglycoside", "gentamicin", "tobramycin", "amikacin"]):
                    interactions.append({
                        "interacting_drug": med,
                        "interaction": "Increased nephrotoxicity risk",
                    })
        
        return interactions
    
    def _generate_recommendation_notes(
        self,
        infection_type: str,
        severity: Severity,
        allergies: List[str],
        renal_function: Optional[float],
    ) -> List[str]:
        """Generate clinical notes for recommendation."""
        notes = []
        
        if severity == Severity.SEVERE or severity == Severity.CRITICAL:
            notes.append("⚠️ Severe infection - consider broad-spectrum coverage and ID consult")
        
        if allergies:
            notes.append(f"Patient allergies noted: {', '.join(allergies)}")
        
        if renal_function is not None and renal_function < 30:
            notes.append("⚠️ Renal dosing adjustments required")
        
        # Add infection-specific notes
        if "CAP" in infection_type:
            notes.append("Ensure coverage for S. pneumoniae and atypical pathogens")
        
        if "MRSA" in infection_type:
            notes.append("Consider decolonization if recurrent MRSA infections")
        
        return notes
    
    def _get_duration_guidance(self, infection_type: str, severity: Severity) -> Dict[str, Any]:
        """Get treatment duration guidance."""
        # Simplified duration recommendations
        durations = {
            "CAP_OUTPATIENT": {"days": 5, "notes": "Shorter courses are as effective and safer"},
            "CAP_INPATIENT": {"days": 5, "notes": "Consider IV-to-PO switch when clinically stable"},
            "UTI_UNCOMPLICATED": {"days": 5, "notes": "3-5 days depending on agent"},
            "PYELONEPHRITIS": {"days": 7, "notes": "5-7 days for fluoroquinolones, 10-14 for others"},
            "CELLULITIS": {"days": 5, "notes": "Extend if slow response"},
            "SEPSIS": {"days": 7, "notes": "Reassess daily; longer for certain sources"},
        }
        
        for key, duration in durations.items():
            if key in infection_type.upper():
                return duration
        
        return {"days": "7-14", "notes": "Reassess clinical response and culture results"}
    
    async def check_iv_to_po_conversion(
        self,
        drug_name: str,
        patient_status: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Check if IV-to-PO conversion is appropriate."""
        drug_lower = drug_name.lower()
        
        # Find matching criteria
        criteria = None
        for category, data in self.iv_to_po_criteria.items():
            if any(d in drug_lower for d in data["drugs"]):
                criteria = data
                break
        
        if not criteria:
            return {
                "eligible": False,
                "reason": f"No IV-to-PO conversion criteria found for {drug_name}",
            }
        
        # Check eligibility criteria
        failed_criteria = []
        for criterion in criteria["criteria"]:
            # Simplified check - in practice would assess patient-specific data
            criterion_lower = criterion.lower()
            if "stable" in criterion_lower:
                if not patient_status.get("hemodynamically_stable", True):
                    failed_criteria.append(criterion)
            elif "oral" in criterion_lower or "tolerate" in criterion_lower:
                if not patient_status.get("tolerating_oral", True):
                    failed_criteria.append(criterion)
            elif "ileus" in criterion_lower or "obstruction" in criterion_lower:
                if patient_status.get("gi_obstruction", False):
                    failed_criteria.append(criterion)
        
        if failed_criteria:
            return {
                "eligible": False,
                "reason": f"Failed criteria: {'; '.join(failed_criteria)}",
                "bioequivalence": criteria["bioequivalence"],
            }
        
        self.stats["iv_to_po_conversions"] += 1
        
        return {
            "eligible": True,
            "reason": "All criteria met for IV-to-PO conversion",
            "bioequivalence": criteria["bioequivalence"],
            "recommendation": f"Consider switching {drug_name} from IV to PO",
            "cost_savings": "Significant cost savings with equivalent efficacy",
        }
    
    async def get_organism_directed_therapy(
        self,
        organism: str,
        susceptibilities: Dict[str, str],  # antibiotic -> S/I/R
        infection_site: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get culture-directed therapy recommendations."""
        organism_key = organism.upper().replace(" ", "_")
        
        if organism_key not in self.drug_bug_matching:
            return {
                "error": f"Unknown organism: {organism}",
                "recommendation": "Use susceptibilities to guide therapy",
            }
        
        matching = self.drug_bug_matching[organism_key]
        
        # Filter by susceptibility
        susceptible_drugs = []
        for drug in susceptibilities:
            if susceptibilities[drug].upper() == "S":
                susceptible_drugs.append(drug)
        
        # Match with preferred/alternative
        preferred_available = []
        alternative_available = []
        
        for drug in matching["preferred"]:
            if any(drug.lower() in s.lower() or s.lower() in drug.lower() for s in susceptible_drugs):
                preferred_available.append(drug)
        
        for drug in matching["alternative"]:
            if any(drug.lower() in s.lower() or s.lower() in drug.lower() for s in susceptible_drugs):
                alternative_available.append(drug)
        
        return {
            "organism": organism,
            "preferred_therapy": preferred_available or matching["preferred"],
            "alternative_therapy": alternative_available or matching["alternative"],
            "susceptible_drugs": susceptible_drugs,
            "clinical_notes": matching["notes"],
            "recommendation": f"Use susceptibility results to guide definitive therapy",
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get stewardship engine statistics."""
        return self.stats


# Singleton instance
_stewardship_engine: Optional[AntimicrobialStewardshipEngine] = None


def get_stewardship_engine() -> AntimicrobialStewardshipEngine:
    """Get or create stewardship engine singleton."""
    global _stewardship_engine
    
    if _stewardship_engine is None:
        _stewardship_engine = AntimicrobialStewardshipEngine()
    
    return _stewardship_engine

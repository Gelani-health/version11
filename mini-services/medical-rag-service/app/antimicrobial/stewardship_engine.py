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


# =============================================================================
# ANTIBIOGRAM DATABASE - CDC/NHSN 2022 National Benchmarks
# =============================================================================
# Evidence-Based Local Antibiogram Integration for Gelani Healthcare
# 
# References:
# - CDC/NHSN Antimicrobial Resistance Report 2022
# - IDSA Antimicrobial Stewardship Guidelines 2024
# - Clinical and Laboratory Standards Institute (CLSI) Breakpoints

class SusceptibilityAlert(Enum):
    """Alert levels for susceptibility rates."""
    OK = "OK"           # >= 80% susceptibility - preferred agent
    WARN = "WARN"       # 60-80% susceptibility - use with caution
    DEMOTE = "DEMOTE"   # < 60% susceptibility - not recommended


class AntibiogramDatabase:
    """
    Local antibiogram database with CDC/NHSN 2022 national benchmarks.
    
    Provides susceptibility data for organism-drug combinations with:
    - National benchmark data from CDC/NHSN 2022
    - Local institution override capability
    - Alert generation for low susceptibility rates
    
    Reference: CDC/NHSN Antimicrobial Resistance Report 2022
    """
    
    # CDC/NHSN 2022 National Benchmarks
    # Format: organism -> drug -> susceptibility data
    LOCAL_SUSCEPTIBILITIES: Dict[str, Dict[str, Dict[str, Any]]] = {
        # =====================================================================
        # ESCHERICHIA COLI
        # =====================================================================
        "ESCHERICHIA_COLI": {
            "ceftriaxone": {
                "susceptibility_rate": 0.75,
                "n_tested": 50000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "ciprofloxacin": {
                "susceptibility_rate": 0.68,
                "n_tested": 52000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "tmp-smx": {
                "susceptibility_rate": 0.70,
                "n_tested": 48000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "piperacillin-tazobactam": {
                "susceptibility_rate": 0.85,
                "n_tested": 45000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "meropenem": {
                "susceptibility_rate": 0.99,
                "n_tested": 47000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "ertapenem": {
                "susceptibility_rate": 0.99,
                "n_tested": 42000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "levofloxacin": {
                "susceptibility_rate": 0.66,
                "n_tested": 49000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "amoxicillin-clavulanate": {
                "susceptibility_rate": 0.78,
                "n_tested": 38000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "nitrofurantoin": {
                "susceptibility_rate": 0.95,
                "n_tested": 35000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
        },
        
        # =====================================================================
        # KLEBSIELLA PNEUMONIAE
        # =====================================================================
        "KLEBSIELLA_PNEUMONIAE": {
            "ceftriaxone": {
                "susceptibility_rate": 0.70,
                "n_tested": 38000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "ciprofloxacin": {
                "susceptibility_rate": 0.65,
                "n_tested": 40000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "tmp-smx": {
                "susceptibility_rate": 0.68,
                "n_tested": 37000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "piperacillin-tazobactam": {
                "susceptibility_rate": 0.80,
                "n_tested": 36000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "meropenem": {
                "susceptibility_rate": 0.98,
                "n_tested": 38000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "ertapenem": {
                "susceptibility_rate": 0.97,
                "n_tested": 32000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "levofloxacin": {
                "susceptibility_rate": 0.62,
                "n_tested": 39000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "ceftazidime": {
                "susceptibility_rate": 0.72,
                "n_tested": 30000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
        },
        
        # =====================================================================
        # PSEUDOMONAS AERUGINOSA
        # =====================================================================
        "PSEUDOMONAS_AERUGINOSA": {
            "piperacillin-tazobactam": {
                "susceptibility_rate": 0.75,
                "n_tested": 32000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "cefepime": {
                "susceptibility_rate": 0.78,
                "n_tested": 34000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "meropenem": {
                "susceptibility_rate": 0.72,
                "n_tested": 33000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "ciprofloxacin": {
                "susceptibility_rate": 0.65,
                "n_tested": 35000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "ceftazidime": {
                "susceptibility_rate": 0.76,
                "n_tested": 28000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "aztreonam": {
                "susceptibility_rate": 0.68,
                "n_tested": 22000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "amikacin": {
                "susceptibility_rate": 0.92,
                "n_tested": 25000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "tobramycin": {
                "susceptibility_rate": 0.85,
                "n_tested": 27000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
        },
        
        # =====================================================================
        # STAPHYLOCOCCUS AUREUS
        # =====================================================================
        "STAPHYLOCOCCUS_AUREUS": {
            # MRSA prevalence: ~33% of all S. aureus
            # Oxacillin/nafcillin for MSSA: ~67% (since 33% are MRSA)
            "oxacillin": {
                "susceptibility_rate": 0.67,
                "n_tested": 85000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark (MSSA ~67%)"
            },
            "nafcillin": {
                "susceptibility_rate": 0.67,
                "n_tested": 80000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark (MSSA ~67%)"
            },
            "cefazolin": {
                "susceptibility_rate": 0.67,
                "n_tested": 75000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark (MSSA ~67%)"
            },
            "vancomycin": {
                "susceptibility_rate": 0.99,
                "n_tested": 90000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "clindamycin": {
                "susceptibility_rate": 0.65,
                "n_tested": 70000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "tmp-smx": {
                "susceptibility_rate": 0.95,
                "n_tested": 45000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark (for MRSA)"
            },
            "doxycycline": {
                "susceptibility_rate": 0.92,
                "n_tested": 40000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "linezolid": {
                "susceptibility_rate": 0.999,
                "n_tested": 35000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "daptomycin": {
                "susceptibility_rate": 0.998,
                "n_tested": 30000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
        },
        
        # =====================================================================
        # STREPTOCOCCUS PNEUMONIAE
        # =====================================================================
        "STREPTOCOCCUS_PNEUMONIAE": {
            "penicillin": {
                "susceptibility_rate": 0.85,
                "n_tested": 25000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "amoxicillin": {
                "susceptibility_rate": 0.88,
                "n_tested": 22000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "ceftriaxone": {
                "susceptibility_rate": 0.92,
                "n_tested": 20000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "levofloxacin": {
                "susceptibility_rate": 0.98,
                "n_tested": 18000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "moxifloxacin": {
                "susceptibility_rate": 0.98,
                "n_tested": 15000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "vancomycin": {
                "susceptibility_rate": 0.999,
                "n_tested": 20000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "clindamycin": {
                "susceptibility_rate": 0.75,
                "n_tested": 19000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
        },
        
        # =====================================================================
        # ENTEROCOCCUS FAECALIS
        # =====================================================================
        "ENTEROCOCCUS_FAECALIS": {
            "ampicillin": {
                "susceptibility_rate": 0.85,
                "n_tested": 28000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "vancomycin": {
                "susceptibility_rate": 0.95,
                "n_tested": 30000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "linezolid": {
                "susceptibility_rate": 0.99,
                "n_tested": 22000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "daptomycin": {
                "susceptibility_rate": 0.98,
                "n_tested": 18000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
        },
        
        # =====================================================================
        # BACTEROIDES FRAGILIS
        # =====================================================================
        "BACTEROIDES_FRAGILIS": {
            "metronidazole": {
                "susceptibility_rate": 0.99,
                "n_tested": 15000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "piperacillin-tazobactam": {
                "susceptibility_rate": 0.95,
                "n_tested": 12000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "meropenem": {
                "susceptibility_rate": 0.98,
                "n_tested": 10000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
            "clindamycin": {
                "susceptibility_rate": 0.72,
                "n_tested": 14000,
                "year": 2022,
                "source": "CDC/NHSN 2022 National Benchmark"
            },
        },
    }
    
    def __init__(self):
        """Initialize the antibiogram database with national benchmarks."""
        # Create a copy to allow local modifications
        self._local_data: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # Deep copy of national benchmarks
        for org, drugs in self.LOCAL_SUSCEPTIBILITIES.items():
            self._local_data[org] = {}
            for drug, data in drugs.items():
                self._local_data[org][drug] = data.copy()
    
    def get_susceptibility(self, organism: str, drug: str) -> Optional[float]:
        """
        Get susceptibility rate for an organism-drug combination.
        
        Args:
            organism: Organism name (e.g., "E. coli", "ESCHERICHIA_COLI")
            drug: Drug name (e.g., "ciprofloxacin", "CIP")
            
        Returns:
            Susceptibility rate (0.0-1.0) or None if not found
        """
        # Normalize organism name
        org_key = self._normalize_organism_name(organism)
        if org_key not in self._local_data:
            return None
        
        # Normalize drug name and find match
        drug_key = self._normalize_drug_name(drug)
        
        # Direct match
        if drug_key in self._local_data[org_key]:
            return self._local_data[org_key][drug_key]["susceptibility_rate"]
        
        # Try to find drug in any form
        for d, data in self._local_data[org_key].items():
            if drug_key in d.lower() or d.lower() in drug_key:
                return data["susceptibility_rate"]
        
        return None
    
    def get_susceptibility_alert(self, organism: str, drug: str) -> Dict[str, Any]:
        """
        Get susceptibility rate and alert level for an organism-drug combination.
        
        Args:
            organism: Organism name
            drug: Drug name
            
        Returns:
            Dictionary with:
            - rate: float (0.0-1.0) or None
            - alert: "OK" (>=80%), "WARN" (60-80%), "DEMOTE" (<60%)
            - source: Data source string
        """
        rate = self.get_susceptibility(organism, drug)
        
        if rate is None:
            return {
                "rate": None,
                "alert": "UNKNOWN",
                "source": "No data available"
            }
        
        # Determine alert level
        if rate >= 0.80:
            alert = SusceptibilityAlert.OK.value
        elif rate >= 0.60:
            alert = SusceptibilityAlert.WARN.value
        else:
            alert = SusceptibilityAlert.DEMOTE.value
        
        # Get source
        org_key = self._normalize_organism_name(organism)
        drug_key = self._normalize_drug_name(drug)
        source = "Unknown"
        
        if org_key in self._local_data:
            for d, data in self._local_data[org_key].items():
                if drug_key in d.lower() or d.lower() in drug_key:
                    source = data.get("source", "Unknown")
                    break
        
        return {
            "rate": rate,
            "alert": alert,
            "source": source
        }
    
    def update_local_data(
        self,
        organism: str,
        drug: str,
        rate: float,
        n_tested: int,
        year: int,
        source: Optional[str] = None
    ) -> None:
        """
        Update local susceptibility data (overrides national benchmarks).
        
        Args:
            organism: Organism name
            drug: Drug name
            rate: Susceptibility rate (0.0-1.0)
            n_tested: Number of isolates tested
            year: Year of data
            source: Data source (default: "Local Institution Data")
        """
        org_key = self._normalize_organism_name(organism)
        drug_key = self._normalize_drug_name(drug)
        
        if org_key not in self._local_data:
            self._local_data[org_key] = {}
        
        self._local_data[org_key][drug_key] = {
            "susceptibility_rate": rate,
            "n_tested": n_tested,
            "year": year,
            "source": source or f"Local Institution Data {year}"
        }
        
        logger.info(
            f"Updated local antibiogram: {organism} - {drug} = {rate*100:.1f}% "
            f"(n={n_tested}, {year})"
        )
    
    def get_organism_drugs(self, organism: str) -> Dict[str, Dict[str, Any]]:
        """
        Get all drug susceptibility data for an organism.
        
        Args:
            organism: Organism name
            
        Returns:
            Dictionary of drug -> susceptibility data
        """
        org_key = self._normalize_organism_name(organism)
        return self._local_data.get(org_key, {})
    
    def _normalize_organism_name(self, organism: str) -> str:
        """Normalize organism name to standard key format."""
        # Remove common prefixes/suffixes and convert to uppercase
        normalized = organism.upper().strip()
        
        # Handle abbreviations like "E. coli" -> "E.COLI" before space conversion
        normalized = normalized.replace(". ", ".")
        
        # Replace spaces with underscores
        normalized = normalized.replace(" ", "_")
        
        # Remove any remaining dots for abbreviation matching
        normalized_no_dots = normalized.replace(".", "")
        
        # Handle common abbreviations
        abbreviations = {
            "E_COLI": "ESCHERICHIA_COLI",
            "ECOLI": "ESCHERICHIA_COLI",
            "K_PNEUMONIAE": "KLEBSIELLA_PNEUMONIAE",
            "KPNEUMONIAE": "KLEBSIELLA_PNEUMONIAE",
            "KLEBSIELLA": "KLEBSIELLA_PNEUMONIAE",
            "P_AERUGINOSA": "PSEUDOMONAS_AERUGINOSA",
            "PAERUGINOSA": "PSEUDOMONAS_AERUGINOSA",
            "PSEUDOMONAS": "PSEUDOMONAS_AERUGINOSA",
            "S_AUREUS": "STAPHYLOCOCCUS_AUREUS",
            "SAUREUS": "STAPHYLOCOCCUS_AUREUS",
            "S_PNEUMONIAE": "STREPTOCOCCUS_PNEUMONIAE",
            "SPNEUMONIAE": "STREPTOCOCCUS_PNEUMONIAE",
            "E_FAECALIS": "ENTEROCOCCUS_FAECALIS",
            "EFAECALIS": "ENTEROCOCCUS_FAECALIS",
            "B_FRAGILIS": "BACTEROIDES_FRAGILIS",
            "BFRAGILIS": "BACTEROIDES_FRAGILIS",
            "MSSA": "STAPHYLOCOCCUS_AUREUS",
            "MRSA": "STAPHYLOCOCCUS_AUREUS",
        }
        
        # Check both versions (with underscores and without dots)
        if normalized_no_dots in abbreviations:
            return abbreviations[normalized_no_dots]
        
        return abbreviations.get(normalized, normalized)
    
    def _normalize_drug_name(self, drug: str) -> str:
        """Normalize drug name to standard format."""
        return drug.lower().strip().replace("-", "-").replace(" ", "-")


# Singleton instance for global access
_antibiogram_db: Optional[AntibiogramDatabase] = None


def get_antibiogram_db() -> AntibiogramDatabase:
    """Get or create antibiogram database singleton."""
    global _antibiogram_db
    
    if _antibiogram_db is None:
        _antibiogram_db = AntibiogramDatabase()
    
    return _antibiogram_db


# =============================================================================
# DRUG-DRUG INTERACTION (DDI) DATABASE
# =============================================================================
# Evidence-Based Drug-Drug Interaction Database for Antimicrobial Stewardship
# Severity levels: CONTRAINDICATED, MAJOR, MODERATE
# 
# References:
# - FDA Drug Labels and Black Box Warnings
# - Hansten PD, Horn JR. Drug Interactions Analysis and Management
# - Lexicomp Drug Interactions Database
# - Clinical Pharmacology Drug Interaction Database
# - IDSA Antimicrobial Stewardship Guidelines 2024

class DDISeverity(Enum):
    """Severity levels for drug-drug interactions."""
    CONTRAINDICATED = "contraindicated"  # Avoid combination
    MAJOR = "major"                       # High risk, use only if no alternative
    MODERATE = "moderate"                 # Use with caution, monitor closely


@dataclass
class DrugDrugInteraction:
    """Represents a drug-drug interaction entry."""
    drug1_patterns: List[str]      # Patterns to match first drug
    drug2_patterns: List[str]      # Patterns to match second drug
    severity: DDISeverity
    mechanism: str
    clinical_effect: str
    monitoring: str
    evidence_source: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "severity": self.severity.value,
            "mechanism": self.mechanism,
            "clinical_effect": self.clinical_effect,
            "monitoring": self.monitoring,
            "evidence_source": self.evidence_source,
        }


# Comprehensive DDI Database for Antimicrobials
# Format: (drug1_patterns, drug2_patterns) -> interaction
# Both directions are checked automatically

DDI_DATABASE: List[DrugDrugInteraction] = [
    # ==========================================================================
    # CONTRAINDICATED INTERACTIONS - Avoid combination
    # ==========================================================================
    
    # Linezolid + serotonergic drugs (SSRIs/SNRIs) → Serotonin Syndrome
    # Reference: FDA Black Box Warning; Lawrence KR et al. Pharmacotherapy 2006
    DrugDrugInteraction(
        drug1_patterns=["linezolid", "zyvox"],
        drug2_patterns=[
            "ssri", "fluoxetine", "sertraline", "paroxetine", "citalopram",
            "escitalopram", "fluvoxamine", "snri", "venlafaxine", "duloxetine",
            "desvenlafaxine", "milnacipran", "levomilnacipran"
        ],
        severity=DDISeverity.CONTRAINDICATED,
        mechanism="MAO-A inhibition by linezolid + serotonin reuptake inhibition",
        clinical_effect="Serotonin syndrome: confusion, hyperthermia, rigidity, autonomic instability",
        monitoring="Avoid combination. If unavoidable, monitor for serotonin syndrome symptoms",
        evidence_source="FDA Black Box Warning; Lawrence KR et al. Pharmacotherapy 2006;26:1784"
    ),
    
    # Linezolid + MAOIs → Serotonin Syndrome
    # Reference: FDA Prescribing Information; Menon et al. J Clin Psychiatry 2012
    DrugDrugInteraction(
        drug1_patterns=["linezolid", "zyvox"],
        drug2_patterns=[
            "maoi", "phenelzine", "tranylcypromine", "isocarboxazid",
            "selegiline", "rasagiline", "safinamide", "moclobemide"
        ],
        severity=DDISeverity.CONTRAINDICATED,
        mechanism="Additive MAO-A inhibition → severe serotonin toxicity",
        clinical_effect="Severe serotonin syndrome: hyperthermia, rigidity, delirium, death",
        monitoring="CONTRAINDICATED. Washout period of 2 weeks required before linezolid",
        evidence_source="FDA Prescribing Information; Menon et al. J Clin Psychiatry 2012;73:e1078"
    ),
    
    # ==========================================================================
    # MAJOR INTERACTIONS - High risk, avoid if possible
    # ==========================================================================
    
    # Metronidazole + Warfarin → INR Elevation
    # Reference: Kazmierczak SC, Catrou PG. Clin Chem 1992;38:84
    DrugDrugInteraction(
        drug1_patterns=["metronidazole", "flagyl"],
        drug2_patterns=["warfarin", "coumadin", "jantoven"],
        severity=DDISeverity.MAJOR,
        mechanism="CYP2C9 inhibition by metronidazole reduces warfarin clearance",
        clinical_effect="INR elevation >2x, increased bleeding risk",
        monitoring="Reduce warfarin dose 25-50%. Check INR within 3 days. Monitor for bleeding",
        evidence_source="Kazmierczak SC et al. Clin Chem 1992;38:84; FDA Prescribing Information"
    ),
    
    # Metronidazole + Ethanol → Disulfiram-like Reaction
    # Reference: Visapaa JP et al. Ann Pharmacother 2002;36:971
    DrugDrugInteraction(
        drug1_patterns=["metronidazole", "flagyl"],
        drug2_patterns=["ethanol", "alcohol", "beer", "wine", "liquor", "alcohol-containing"],
        severity=DDISeverity.MAJOR,
        mechanism="Inhibition of aldehyde dehydrogenase → acetaldehyde accumulation",
        clinical_effect="Disulfiram-like reaction: flushing, nausea, vomiting, headache, tachycardia",
        monitoring="Avoid alcohol during and 48-72 hours after metronidazole therapy",
        evidence_source="Visapaa JP et al. Ann Pharmacother 2002;36:971"
    ),
    
    # Fluoroquinolones + QT-prolonging drugs → TdP Risk
    # Reference: Owens RC Jr, Ambrose PG. Clin Infect Dis 2005;40:1606
    DrugDrugInteraction(
        drug1_patterns=[
            "fluoroquinolone", "ciprofloxacin", "levofloxacin", "moxifloxacin",
            "gemifloxacin", "delafloxacin", "floxacin"
        ],
        drug2_patterns=[
            "amiodarone", "sotalol", "dofetilide", "dronedarone", "ibutilide",
            "haloperidol", "droperidol", "azithromycin", "clarithromycin",
            "quinidine", "procainamide", "disopyramide", "methadone",
            "ondansetron", "domperidone", "chlorpromazine", "thioridazine",
            "ziprasidone", "pimozide"
        ],
        severity=DDISeverity.MAJOR,
        mechanism="Additive QT prolongation via potassium channel blockade",
        clinical_effect="Torsades de pointes (TdP), ventricular arrhythmia, sudden death",
        monitoring="Avoid combination if possible. ECG monitoring required. Correct electrolytes",
        evidence_source="Owens RC Jr et al. Clin Infect Dis 2005;40:1606; FDA Drug Safety Communication"
    ),
    
    # Vancomycin + Aminoglycosides → Nephrotoxicity
    # Reference: Rybak MJ et al. Am J Health Syst Pharm 2009;66:682
    DrugDrugInteraction(
        drug1_patterns=["vancomycin", "vancocin"],
        drug2_patterns=["aminoglycoside", "gentamicin", "tobramycin", "amikacin", "neomycin"],
        severity=DDISeverity.MAJOR,
        mechanism="Additive proximal tubular toxicity",
        clinical_effect="Acute kidney injury, elevated creatinine, requiring dialysis in severe cases",
        monitoring="Use only if necessary. Monitor creatinine daily. Check vancomycin troughs. Therapeutic drug monitoring for aminoglycosides",
        evidence_source="Rybak MJ et al. Am J Health Syst Pharm 2009;66:682; IDSA Guidelines"
    ),
    
    # Rifampin + Warfarin → CYP450 Induction
    # Reference: Koch-Weser J, Sellers EM. N Engl J Med 1971;285:487
    DrugDrugInteraction(
        drug1_patterns=["rifampin", "rifampicin", "rifadin", "rimactane"],
        drug2_patterns=["warfarin", "coumadin", "jantoven"],
        severity=DDISeverity.MAJOR,
        mechanism="Potent CYP2C9 and CYP3A4 induction → increased warfarin clearance",
        clinical_effect="Decreased INR, loss of anticoagulant effect, thrombosis risk",
        monitoring="Increase warfarin dose by 50-100% when starting rifampin. Frequent INR monitoring",
        evidence_source="Koch-Weser J et al. N Engl J Med 1971;285:487; Athan ET et al. Chest 2003"
    ),
    
    # TMP-SMX + Warfarin → INR Increase
    # Reference: Greenblatt DJ, von Moltke LL. Clin Pharmacokinet 2005;44:901
    DrugDrugInteraction(
        drug1_patterns=["tmp-smx", "bactrim", "septra", "sulfamethoxazole", "trimethoprim-sulfamethoxazole", "co-trimoxazole"],
        drug2_patterns=["warfarin", "coumadin", "jantoven"],
        severity=DDISeverity.MAJOR,
        mechanism="CYP2C9 inhibition + displacement from protein binding sites",
        clinical_effect="Increased INR, elevated bleeding risk",
        monitoring="Reduce warfarin dose. Monitor INR within 3-5 days. Watch for bleeding signs",
        evidence_source="Greenblatt DJ et al. Clin Pharmacokinet 2005;44:901"
    ),
    
    # TMP-SMX + ACE Inhibitors/ARBs → Hyperkalemia
    # Reference: Antoniou T et al. CMAJ 2010;182:1659
    DrugDrugInteraction(
        drug1_patterns=["tmp-smx", "bactrim", "septra", "sulfamethoxazole", "trimethoprim-sulfamethoxazole", "co-trimoxazole"],
        drug2_patterns=[
            "ace inhibitor", "lisinopril", "enalapril", "ramipril", "benazepril",
            "fosinopril", "quinapril", "trandolapril", "captopril", "perindopril",
            "arb", "losartan", "valsartan", "candesartan", "irbesartan",
            "olmesartan", "telmisartan", "eprosartan", "azilsartan"
        ],
        severity=DDISeverity.MAJOR,
        mechanism="Trimethoprim blocks epithelial sodium channel (ENaC) + ACE/ARB reduce aldosterone",
        clinical_effect="Severe hyperkalemia, potentially life-threatening arrhythmias",
        monitoring="Avoid combination if possible. Monitor potassium closely if used. Consider alternative antibiotic",
        evidence_source="Antoniou T et al. CMAJ 2010;182:1659; Perazella MA. Am J Med 2000;109:183"
    ),
    
    # ==========================================================================
    # MODERATE INTERACTIONS - Use with caution
    # ==========================================================================
    
    # Vancomycin + Loop Diuretics → Ototoxicity
    # Reference: Rybak MJ et al. Am J Health Syst Pharm 2009;66:682
    DrugDrugInteraction(
        drug1_patterns=["vancomycin", "vancocin"],
        drug2_patterns=["furosemide", "lasix", "bumetanide", "torsemide", "ethacrynic acid", "loop diuretic"],
        severity=DDISeverity.MODERATE,
        mechanism="Additive ototoxicity via cochlear damage",
        clinical_effect="Hearing loss, tinnitus, vertigo (often irreversible)",
        monitoring="Use lowest effective dose. Monitor hearing in high-risk patients. Avoid high vancomycin troughs",
        evidence_source="Rybak MJ et al. Am J Health Syst Pharm 2009;66:682; Brummett RE. J Infect Dis 1981"
    ),
    
    # Daptomycin + Statins → Myopathy
    # Reference: FDA Prescribing Information; Phillips A et al. J Clin Pharm Ther 2017
    DrugDrugInteraction(
        drug1_patterns=["daptomycin", "cubicin"],
        drug2_patterns=[
            "statin", "simvastatin", "atorvastatin", "rosuvastatin", "pravastatin",
            "lovastatin", "fluvastatin", "pitavastatin"
        ],
        severity=DDISeverity.MODERATE,
        mechanism="Additive skeletal muscle toxicity (both agents can cause myopathy)",
        clinical_effect="Myopathy, myalgias, elevated CPK, potential rhabdomyolysis",
        monitoring="Consider holding statin during daptomycin therapy. Monitor CPK weekly. Watch for muscle symptoms",
        evidence_source="FDA Prescribing Information; Phillips A et al. J Clin Pharm Ther 2017;42:513"
    ),
]


def check_ddi(drug1: str, drug2: str) -> Optional[DrugDrugInteraction]:
    """
    Check for drug-drug interaction between two drugs.
    
    Args:
        drug1: First drug name
        drug2: Second drug name
        
    Returns:
        DrugDrugInteraction if interaction found, None otherwise
    """
    drug1_lower = drug1.lower()
    drug2_lower = drug2.lower()
    
    for ddi in DDI_DATABASE:
        # Check both directions: drug1 matches first pattern AND drug2 matches second pattern
        d1_matches_first = any(p in drug1_lower for p in ddi.drug1_patterns)
        d2_matches_second = any(p in drug2_lower for p in ddi.drug2_patterns)
        
        d1_matches_second = any(p in drug1_lower for p in ddi.drug2_patterns)
        d2_matches_first = any(p in drug2_lower for p in ddi.drug1_patterns)
        
        if (d1_matches_first and d2_matches_second) or (d1_matches_second and d2_matches_first):
            return ddi
    
    return None


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
        
        # Check for inter-recommendation DDIs (drug-drug interactions between recommended drugs)
        # This catches DDIs like vancomycin + gentamicin (nephrotoxicity) that would be
        # missed when only checking against the patient's existing medications
        all_recommended_drugs = [
            rec.get("drug_name", "") for rec in first_line + alternatives
            if rec.get("drug_name")
        ]
        # Filter out "PLUS" prefix drugs (they're combination notes, not actual drugs)
        all_recommended_drugs = [
            d for d in all_recommended_drugs 
            if not d.upper().startswith("PLUS")
        ]
        
        inter_recommendation_interactions = self._check_inter_recommendation_ddis(all_recommended_drugs)
        
        return {
            "diagnosis": therapy["diagnosis"],
            "severity": severity.value,
            "first_line": first_line,
            "alternatives": alternatives,
            "allergy_warnings": all_allergy_warnings,
            "inter_recommendation_interactions": inter_recommendation_interactions,
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
        """
        Check for drug-drug interactions between recommended drug and current medications.
        
        Uses the evidence-based DDI_DATABASE for clinically critical interactions.
        
        Args:
            drug_name: The antimicrobial being recommended
            medications: List of patient's current medications
            
        Returns:
            List of interaction dictionaries with severity, mechanism, clinical effect, monitoring
            
        Reference:
            All interactions in DDI_DATABASE are evidence-based with cited sources
        """
        interactions = []
        
        for med in medications:
            ddi = check_ddi(drug_name, med)
            if ddi:
                interaction_dict = {
                    "interacting_drug": med,
                    "recommended_drug": drug_name,
                    "interaction": ddi.clinical_effect,
                    "severity": ddi.severity.value,
                    "mechanism": ddi.mechanism,
                    "monitoring": ddi.monitoring,
                    "evidence_source": ddi.evidence_source,
                }
                interactions.append(interaction_dict)
                logger.warning(
                    f"DDI detected: {drug_name} + {med} -> {ddi.severity.value}: {ddi.clinical_effect}"
                )
        
        return interactions
    
    def _check_inter_recommendation_ddis(
        self, 
        recommended_drugs: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Check for drug-drug interactions between all pairs of recommended drugs.
        
        This method catches DDIs that would be missed when only checking against
        the patient's existing medications. For example, if the engine recommends
        vancomycin + gentamicin together, or linezolid when the patient is on citalopram,
        these inter-recommendation DDIs must be flagged.
        
        Args:
            recommended_drugs: List of drugs being recommended together
            
        Returns:
            List of interaction dictionaries for each pair with an interaction
            
        Example:
            >>> engine._check_inter_recommendation_ddis(["vancomycin", "gentamicin"])
            [{"drug1": "vancomycin", "drug2": "gentamicin", "severity": "major", ...}]
            
        References:
            - FDA Drug Safety Communications
            - IDSA Antimicrobial Stewardship Guidelines 2024
        """
        interactions = []
        
        # Generate all unique pairs of recommended drugs
        for i, drug1 in enumerate(recommended_drugs):
            for drug2 in recommended_drugs[i+1:]:
                ddi = check_ddi(drug1, drug2)
                if ddi:
                    interaction_dict = {
                        "drug1": drug1,
                        "drug2": drug2,
                        "severity": ddi.severity.value,
                        "mechanism": ddi.mechanism,
                        "clinical_effect": ddi.clinical_effect,
                        "monitoring": ddi.monitoring,
                        "evidence_source": ddi.evidence_source,
                    }
                    interactions.append(interaction_dict)
                    logger.warning(
                        f"Inter-recommendation DDI: {drug1} + {drug2} -> {ddi.severity.value}: {ddi.clinical_effect}"
                    )
        
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
        """
        Get culture-directed therapy recommendations with antibiogram awareness.
        
        This method integrates local antibiogram data to provide resistance-aware
        therapy recommendations. It:
        - Queries AntibiogramDatabase for each drug
        - Moves drugs with susceptibility <60% to not_recommended_locally
        - Adds warning notes for drugs with 60-80% susceptibility
        - Sorts preferred drugs by susceptibility rate (highest first)
        
        Args:
            organism: Organism name (e.g., "E. coli", "Klebsiella pneumoniae")
            susceptibilities: Dictionary of antibiotic -> S/I/R from culture
            infection_site: Optional infection site for context
            
        Returns:
            Dictionary with therapy recommendations including:
            - preferred_therapy: Drugs with >=80% susceptibility (sorted by rate)
            - alternative_therapy: Backup options with warnings
            - not_recommended_locally: Drugs with <60% susceptibility
            - warnings: Susceptibility alerts for marginally active drugs
        """
        # Get antibiogram database
        antibiogram = get_antibiogram_db()
        
        # Use AntibiogramDatabase's normalization for consistency
        organism_key = antibiogram._normalize_organism_name(organism)
        
        if organism_key not in self.drug_bug_matching:
            return {
                "error": f"Unknown organism: {organism}",
                "recommendation": "Use susceptibilities to guide therapy",
            }
        
        matching = self.drug_bug_matching[organism_key]
        
        # Filter by susceptibility from culture
        susceptible_drugs = []
        for drug in susceptibilities:
            if susceptibilities[drug].upper() == "S":
                susceptible_drugs.append(drug)
        
        # Query AntibiogramDatabase for each drug and categorize
        # with susceptibility awareness
        preferred_with_rates: List[Dict[str, Any]] = []
        alternative_with_rates: List[Dict[str, Any]] = []
        not_recommended_locally: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        
        # Process preferred drugs
        for drug in matching["preferred"]:
            alert_data = antibiogram.get_susceptibility_alert(organism, drug)
            rate = alert_data.get("rate")
            alert = alert_data.get("alert", "UNKNOWN")
            
            drug_info = {
                "drug": drug,
                "susceptibility_rate": rate,
                "alert": alert,
                "source": alert_data.get("source", "Unknown"),
                "culture_result": None
            }
            
            # Check if drug matches any susceptible culture results
            for s_drug in susceptible_drugs:
                if drug.lower() in s_drug.lower() or s_drug.lower() in drug.lower():
                    drug_info["culture_result"] = "S"
                    break
            
            if rate is not None:
                if rate >= 0.80:
                    preferred_with_rates.append(drug_info)
                elif rate >= 0.60:
                    drug_info["warning"] = f"Susceptibility rate ({rate*100:.0f}%) suggests caution"
                    alternative_with_rates.append(drug_info)
                    warnings.append({
                        "drug": drug,
                        "rate": rate,
                        "message": f"Moderate susceptibility ({rate*100:.0f}%). Consider alternative if available."
                    })
                else:
                    not_recommended_locally.append({
                        "drug": drug,
                        "susceptibility_rate": rate,
                        "reason": f"Local susceptibility ({rate*100:.0f}%) below 60% threshold",
                        "source": alert_data.get("source", "Unknown")
                    })
            else:
                # No antibiogram data - include in preferred with unknown rate
                drug_info["alert"] = "UNKNOWN"
                preferred_with_rates.append(drug_info)
        
        # Process alternative drugs
        for drug in matching["alternative"]:
            alert_data = antibiogram.get_susceptibility_alert(organism, drug)
            rate = alert_data.get("rate")
            alert = alert_data.get("alert", "UNKNOWN")
            
            drug_info = {
                "drug": drug,
                "susceptibility_rate": rate,
                "alert": alert,
                "source": alert_data.get("source", "Unknown"),
                "culture_result": None
            }
            
            # Check if drug matches any susceptible culture results
            for s_drug in susceptible_drugs:
                if drug.lower() in s_drug.lower() or s_drug.lower() in drug.lower():
                    drug_info["culture_result"] = "S"
                    break
            
            if rate is not None:
                if rate >= 0.80:
                    alternative_with_rates.append(drug_info)
                elif rate >= 0.60:
                    drug_info["warning"] = f"Susceptibility rate ({rate*100:.0f}%) suggests caution"
                    alternative_with_rates.append(drug_info)
                    warnings.append({
                        "drug": drug,
                        "rate": rate,
                        "message": f"Moderate susceptibility ({rate*100:.0f}%). Use with caution."
                    })
                else:
                    not_recommended_locally.append({
                        "drug": drug,
                        "susceptibility_rate": rate,
                        "reason": f"Local susceptibility ({rate*100:.0f}%) below 60% threshold",
                        "source": alert_data.get("source", "Unknown")
                    })
            else:
                # No antibiogram data - include in alternative with unknown rate
                drug_info["alert"] = "UNKNOWN"
                alternative_with_rates.append(drug_info)
        
        # Sort preferred drugs by susceptibility rate (highest first)
        preferred_with_rates.sort(
            key=lambda x: x.get("susceptibility_rate") or 0,
            reverse=True
        )
        
        # Sort alternative drugs by susceptibility rate (highest first)
        alternative_with_rates.sort(
            key=lambda x: x.get("susceptibility_rate") or 0,
            reverse=True
        )
        
        # Build clinical notes
        clinical_notes = matching["notes"]
        if not_recommended_locally:
            clinical_notes += f"\n\nWARNING: {len(not_recommended_locally)} drug(s) not recommended due to low local susceptibility."
        
        return {
            "organism": organism,
            "preferred_therapy": preferred_with_rates,
            "alternative_therapy": alternative_with_rates,
            "not_recommended_locally": not_recommended_locally,
            "susceptible_drugs": susceptible_drugs,
            "clinical_notes": clinical_notes,
            "warnings": warnings,
            "recommendation": "Use susceptibility results and local antibiogram data to guide definitive therapy",
            "antibiogram_source": "CDC/NHSN 2022 National Benchmark (or local override)",
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

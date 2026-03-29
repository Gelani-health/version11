"""
Drug Allergy Cross-Reactivity Database for Gelani Healthcare
============================================================

Evidence-based cross-reactivity checking for drug allergies including:
- Beta-lactam cross-reactivity (penicillins, cephalosporins, carbapenems)
- Sulfonamide cross-reactivity
- NSAID cross-reactivity
- Latex-fruit syndrome

References:
- Joint Task Force on Practice Parameters. Drug Allergy: 2022 Practice Parameter Update
- Blumenthal KG et al. JAMA 2019;321:177-192 (Penicillin allergy)
- Pichichero ME et al. Pediatrics 2020;146:e2020000841 (Cephalosporin cross-reactivity)
- Strom BL et al. N Engl J Med 2003;349:1628-1635 (Sulfonamide cross-reactivity)
- Sanchez-Borges M et al. J Allergy Clin Immunol Pract 2020 (NSAID cross-reactivity)
- Hartz C et al. J Allergy Clin Immunol 2022 (Latex-fruit syndrome)
"""

from typing import Optional, List, Dict, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class AllergySeverity(Enum):
    """Severity of allergic reaction."""
    NONE = "none"
    MILD = "mild"          # Rash, itching, urticaria without systemic symptoms
    MODERATE = "moderate"  # Hives, angioedema, moderate respiratory symptoms
    SEVERE = "severe"      # Anaphylaxis, Stevens-Johnson syndrome, DRESS
    UNKNOWN = "unknown"    # Reaction type not documented


class CrossReactivityRisk(Enum):
    """Level of cross-reactivity risk."""
    NONE = "none"              # No cross-reactivity
    VERY_LOW = "very_low"      # <1% cross-reactivity
    LOW = "low"                # 1-5% cross-reactivity
    MODERATE = "moderate"      # 5-10% cross-reactivity
    HIGH = "high"              # 10-25% cross-reactivity
    VERY_HIGH = "very_high"    # >25% cross-reactivity
    COMPLETE = "complete"      # Essentially the same allergen


class DrugClass(Enum):
    """Drug classes for allergy classification."""
    PENICILLIN = "penicillin"
    AMINOPENICILLIN = "aminopenicillin"
    ANTISTAPHYLOCOCCAL_PENICILLIN = "antistaphylococcal_penicillin"
    ANTIPSEUDOMONAL_PENICILLIN = "antipseudomonal_penicillin"
    CEPHALOSPORIN = "cephalosporin"
    CEPHALOSPORIN_1ST_GEN = "cephalosporin_1st_gen"
    CEPHALOSPORIN_2ND_GEN = "cephalosporin_2nd_gen"
    CEPHALOSPORIN_3RD_GEN = "cephalosporin_3rd_gen"
    CEPHALOSPORIN_4TH_GEN = "cephalosporin_4th_gen"
    CEPHALOSPORIN_5TH_GEN = "cephalosporin_5th_gen"
    CARBAPENEM = "carbapenem"
    MONOBACTAM = "monobactam"
    SULFONAMIDE_ANTIBIOTIC = "sulfonamide_antibiotic"
    SULFONAMIDE_DIURETIC = "sulfonamide_diuretic"
    SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR = "sulfonamide_cai"
    SULFONYLUREA = "sulfonylurea"
    NSAID_ASPIRIN = "nsaid_aspirin"
    NSAID_PROPIONIC_ACID = "nsaid_propionic_acid"  # ibuprofen, naproxen
    NSAID_ACETIC_ACID = "nsaid_acetic_acid"  # diclofenac, indomethacin
    NSAID_ENOLIC_ACID = "nsaid_enolic_acid"  # meloxicam, piroxicam
    NSAID_COX2_INHIBITOR = "nsaid_cox2_inhibitor"
    LATEX = "latex"


@dataclass
class CrossReactivityResult:
    """
    Result of cross-reactivity assessment.
    
    Contains risk level, recommendation, and supporting evidence.
    """
    source_drug: str
    source_drug_class: DrugClass
    target_drug: str
    target_drug_class: DrugClass
    cross_reactivity_risk: CrossReactivityRisk
    risk_percentage: str
    recommendation: str
    clinical_action: str
    evidence_sources: List[str] = field(default_factory=list)
    requires_skin_testing: bool = False
    alternative_drugs: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "source_drug": self.source_drug,
            "source_drug_class": self.source_drug_class.value,
            "target_drug": self.target_drug,
            "target_drug_class": self.target_drug_class.value,
            "cross_reactivity_risk": self.cross_reactivity_risk.value,
            "risk_percentage": self.risk_percentage,
            "recommendation": self.recommendation,
            "clinical_action": self.clinical_action,
            "evidence_sources": self.evidence_sources,
            "requires_skin_testing": self.requires_skin_testing,
            "alternative_drugs": self.alternative_drugs,
            "notes": self.notes
        }
    
    def to_fhir(self) -> Dict[str, Any]:
        """Convert to FHIR-compatible format."""
        return {
            "resourceType": "AllergyIntolerance",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    "code": "active"
                }]
            },
            "verificationStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                    "code": "confirmed" if self.cross_reactivity_risk not in [CrossReactivityRisk.NONE, CrossReactivityRisk.VERY_LOW] else "unconfirmed"
                }]
            },
            "reaction": [{
                "description": f"Cross-reactivity risk: {self.risk_percentage}",
                "severity": "severe" if self.cross_reactivity_risk in [CrossReactivityRisk.HIGH, CrossReactivityRisk.VERY_HIGH, CrossReactivityRisk.COMPLETE] else "moderate"
            }],
            "note": [{
                "text": self.recommendation
            }]
        }


# =============================================================================
# BETA-LACTAM CROSS-REACTIVITY DATABASE
# =============================================================================

# Drug pattern mappings for beta-lactams
BETA_LACTAM_DRUGS: Dict[str, DrugClass] = {
    # Penicillins
    "penicillin": DrugClass.PENICILLIN,
    "penicillin g": DrugClass.PENICILLIN,
    "penicillin v": DrugClass.PENICILLIN,
    "benzathine penicillin": DrugClass.PENICILLIN,
    "procaine penicillin": DrugClass.PENICILLIN,
    
    # Aminopenicillins
    "amoxicillin": DrugClass.AMINOPENICILLIN,
    "ampicillin": DrugClass.AMINOPENICILLIN,
    "amoxicillin-clavulanate": DrugClass.AMINOPENICILLIN,
    "augmentin": DrugClass.AMINOPENICILLIN,
    "ampicillin-sulbactam": DrugClass.AMINOPENICILLIN,
    "unasyn": DrugClass.AMINOPENICILLIN,
    
    # Antistaphylococcal penicillins
    "nafcillin": DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN,
    "oxacillin": DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN,
    "dicloxacillin": DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN,
    "cloxacillin": DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN,
    "methicillin": DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN,
    
    # Antipseudomonal penicillins
    "piperacillin": DrugClass.ANTIPSEUDOMONAL_PENICILLIN,
    "piperacillin-tazobactam": DrugClass.ANTIPSEUDOMONAL_PENICILLIN,
    "zosyn": DrugClass.ANTIPSEUDOMONAL_PENICILLIN,
    "ticarcillin": DrugClass.ANTIPSEUDOMONAL_PENICILLIN,
    "ticarcillin-clavulanate": DrugClass.ANTIPSEUDOMONAL_PENICILLIN,
    "timentin": DrugClass.ANTIPSEUDOMONAL_PENICILLIN,
    "carbenicillin": DrugClass.ANTIPSEUDOMONAL_PENICILLIN,
    
    # 1st generation cephalosporins
    "cefazolin": DrugClass.CEPHALOSPORIN_1ST_GEN,
    "ancef": DrugClass.CEPHALOSPORIN_1ST_GEN,
    "kefzol": DrugClass.CEPHALOSPORIN_1ST_GEN,
    "cephalexin": DrugClass.CEPHALOSPORIN_1ST_GEN,
    "keflex": DrugClass.CEPHALOSPORIN_1ST_GEN,
    "cefadroxil": DrugClass.CEPHALOSPORIN_1ST_GEN,
    "duricef": DrugClass.CEPHALOSPORIN_1ST_GEN,
    "cephradine": DrugClass.CEPHALOSPORIN_1ST_GEN,
    "velosef": DrugClass.CEPHALOSPORIN_1ST_GEN,
    
    # 2nd generation cephalosporins
    "cefuroxime": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "ceftin": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "zinacef": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "cefotetan": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "cefotan": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "cefoxitin": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "mefoxin": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "cefaclor": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "ceclor": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "loracarbef": DrugClass.CEPHALOSPORIN_2ND_GEN,
    "lorabid": DrugClass.CEPHALOSPORIN_2ND_GEN,
    
    # 3rd generation cephalosporins
    "ceftriaxone": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "rocephin": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "cefotaxime": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "claforan": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "ceftazidime": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "fortaz": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "tazicef": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "cefoperazone": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "cefobid": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "cefdisoxime": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "cefdinir": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "omnicef": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "cefixime": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "suprax": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "cefpodoxime": DrugClass.CEPHALOSPORIN_3RD_GEN,
    "vantin": DrugClass.CEPHALOSPORIN_3RD_GEN,
    
    # 4th generation cephalosporins
    "cefepime": DrugClass.CEPHALOSPORIN_4TH_GEN,
    "maxipime": DrugClass.CEPHALOSPORIN_4TH_GEN,
    
    # 5th generation cephalosporins
    "ceftaroline": DrugClass.CEPHALOSPORIN_5TH_GEN,
    "teflaro": DrugClass.CEPHALOSPORIN_5TH_GEN,
    "ceftobiprole": DrugClass.CEPHALOSPORIN_5TH_GEN,
    
    # Carbapenems
    "imipenem": DrugClass.CARBAPENEM,
    "primaxin": DrugClass.CARBAPENEM,
    "meropenem": DrugClass.CARBAPENEM,
    "merrem": DrugClass.CARBAPENEM,
    "ertapenem": DrugClass.CARBAPENEM,
    "invanz": DrugClass.CARBAPENEM,
    "doripenem": DrugClass.CARBAPENEM,
    "doribax": DrugClass.CARBAPENEM,
    
    # Monobactams
    "aztreonam": DrugClass.MONOBACTAM,
    "azactam": DrugClass.MONOBACTAM,
    "cayston": DrugClass.MONOBACTAM,
}

# Cross-reactivity matrix for beta-lactams
# Based on shared side chain similarity and clinical data
# Key insight: Cross-reactivity is primarily driven by side chain similarity, not beta-lactam ring

BETA_LACTAM_CROSS_REACTIVITY: Dict[DrugClass, Dict[DrugClass, CrossReactivityRisk]] = {
    # Penicillin G/V to other beta-lactams
    DrugClass.PENICILLIN: {
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.MODERATE,  # ~5-10% (some shared side chains)
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.LOW,  # ~1-2% (historically overestimated)
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CARBAPENEM: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0% - no cross-reactivity
    },
    
    # Aminopenicillins (amoxicillin/ampicillin)
    DrugClass.AMINOPENICILLIN: {
        DrugClass.PENICILLIN: CrossReactivityRisk.MODERATE,  # ~5-10%
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.LOW,  # ~1-4%
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CARBAPENEM: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0%
    },
    
    # Antistaphylococcal penicillins
    DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: {
        DrugClass.PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CARBAPENEM: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0%
    },
    
    # Antipseudomonal penicillins
    DrugClass.ANTIPSEUDOMONAL_PENICILLIN: {
        DrugClass.PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CARBAPENEM: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0%
    },
    
    # Cephalosporins - generally low cross-reactivity with penicillins
    DrugClass.CEPHALOSPORIN_1ST_GEN: {
        DrugClass.PENICILLIN: CrossReactivityRisk.LOW,  # ~1-2%
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.LOW,  # ~1-4%
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.MODERATE,  # ~5-10% (some shared side chains)
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CARBAPENEM: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0%
    },
    
    DrugClass.CEPHALOSPORIN_2ND_GEN: {
        DrugClass.PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.MODERATE,  # ~5-10%
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.MODERATE,  # ~5-10%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CARBAPENEM: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0%
    },
    
    DrugClass.CEPHALOSPORIN_3RD_GEN: {
        DrugClass.PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.MODERATE,  # ~5-10%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.MODERATE,  # ~5-10%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CARBAPENEM: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0%
    },
    
    DrugClass.CEPHALOSPORIN_4TH_GEN: {
        DrugClass.PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.MODERATE,  # ~5-10%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.MODERATE,  # ~5-10%
        DrugClass.CARBAPENEM: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0%
    },
    
    DrugClass.CEPHALOSPORIN_5TH_GEN: {
        DrugClass.PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.LOW,  # ~1-5%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.MODERATE,  # ~5-10%
        DrugClass.CARBAPENEM: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0%
    },
    
    # Carbapenems
    DrugClass.CARBAPENEM: {
        DrugClass.PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.MONOBACTAM: CrossReactivityRisk.NONE,  # 0%
    },
    
    # Monobactams - NO cross-reactivity with other beta-lactams
    DrugClass.MONOBACTAM: {
        DrugClass.PENICILLIN: CrossReactivityRisk.NONE,  # 0%
        DrugClass.AMINOPENICILLIN: CrossReactivityRisk.NONE,  # 0%
        DrugClass.ANTISTAPHYLOCOCCAL_PENICILLIN: CrossReactivityRisk.NONE,  # 0%
        DrugClass.ANTIPSEUDOMONAL_PENICILLIN: CrossReactivityRisk.NONE,  # 0%
        DrugClass.CEPHALOSPORIN_1ST_GEN: CrossReactivityRisk.NONE,  # 0%
        DrugClass.CEPHALOSPORIN_2ND_GEN: CrossReactivityRisk.NONE,  # 0%
        DrugClass.CEPHALOSPORIN_3RD_GEN: CrossReactivityRisk.NONE,  # 0%
        DrugClass.CEPHALOSPORIN_4TH_GEN: CrossReactivityRisk.NONE,  # 0%
        DrugClass.CEPHALOSPORIN_5TH_GEN: CrossReactivityRisk.NONE,  # 0%
        DrugClass.CARBAPENEM: CrossReactivityRisk.NONE,  # 0%
    },
}

# Special case: Ceftazidime and Aztreonam share identical side chains
CEFTAZIDIME_AZTREONAM_CROSS_REACTIVITY = True


# =============================================================================
# SULFONAMIDE CROSS-REACTIVITY DATABASE
# =============================================================================

SULFONAMIDE_DRUGS: Dict[str, DrugClass] = {
    # Sulfonamide antibiotics (contain arylamine group)
    "sulfamethoxazole": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    "trimethoprim-sulfamethoxazole": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    "tmp-smx": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    "bactrim": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    "septra": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    "co-trimoxazole": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    "sulfadiazine": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    "sulfisoxazole": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    "sulfasalazine": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    "azulfidine": DrugClass.SULFONAMIDE_ANTIBIOTIC,
    
    # Sulfonamide diuretics (NO arylamine group - different allergy risk)
    "furosemide": DrugClass.SULFONAMIDE_DIURETIC,
    "lasix": DrugClass.SULFONAMIDE_DIURETIC,
    "bumetanide": DrugClass.SULFONAMIDE_DIURETIC,
    "bumex": DrugClass.SULFONAMIDE_DIURETIC,
    "torsemide": DrugClass.SULFONAMIDE_DIURETIC,
    "demadex": DrugClass.SULFONAMIDE_DIURETIC,
    "hydrochlorothiazide": DrugClass.SULFONAMIDE_DIURETIC,
    "hctz": DrugClass.SULFONAMIDE_DIURETIC,
    "chlorthalidone": DrugClass.SULFONAMIDE_DIURETIC,
    "thalitone": DrugClass.SULFONAMIDE_DIURETIC,
    "metolazone": DrugClass.SULFONAMIDE_DIURETIC,
    "zaroxolyn": DrugClass.SULFONAMIDE_DIURETIC,
    "indapamide": DrugClass.SULFONAMIDE_DIURETIC,
    "acetazolamide": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    "diamox": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    "methazolamide": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    "neptazane": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    "brinzolamide": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    "dorzolamide": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    "topiramate": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    "topamax": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    "zonisamide": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    "zonegran": DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
    
    # Sulfonylureas (NO arylamine group)
    "glipizide": DrugClass.SULFONYLUREA,
    "glucotrol": DrugClass.SULFONYLUREA,
    "glyburide": DrugClass.SULFONYLUREA,
    "diabeta": DrugClass.SULFONYLUREA,
    "micronase": DrugClass.SULFONYLUREA,
    "glimepiride": DrugClass.SULFONYLUREA,
    "amaryl": DrugClass.SULFONYLUREA,
    "chlorpropamide": DrugClass.SULFONYLUREA,
    "tolbutamide": DrugClass.SULFONYLUREA,
    
    # Celecoxib (contains sulfonamide-like structure)
    "celecoxib": DrugClass.SULFONAMIDE_DIURETIC,  # Grouped with non-arylamine sulfonamides
    "celebrex": DrugClass.SULFONAMIDE_DIURETIC,
}

# Sulfonamide cross-reactivity is driven by the arylamine group, not the sulfonamide structure
# Key insight: Non-arylamine sulfonamides (diuretics, sulfonylureas) do NOT cross-react with sulfonamide antibiotics

SULFONAMIDE_CROSS_REACTIVITY: Dict[DrugClass, Dict[DrugClass, CrossReactivityRisk]] = {
    DrugClass.SULFONAMIDE_ANTIBIOTIC: {
        DrugClass.SULFONAMIDE_DIURETIC: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.SULFONYLUREA: CrossReactivityRisk.VERY_LOW,  # <1%
    },
    DrugClass.SULFONAMIDE_DIURETIC: {
        DrugClass.SULFONAMIDE_ANTIBIOTIC: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.SULFONYLUREA: CrossReactivityRisk.VERY_LOW,  # <1%
    },
    DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR: {
        DrugClass.SULFONAMIDE_ANTIBIOTIC: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.SULFONAMIDE_DIURETIC: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.SULFONYLUREA: CrossReactivityRisk.VERY_LOW,  # <1%
    },
    DrugClass.SULFONYLUREA: {
        DrugClass.SULFONAMIDE_ANTIBIOTIC: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.SULFONAMIDE_DIURETIC: CrossReactivityRisk.VERY_LOW,  # <1%
        DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR: CrossReactivityRisk.VERY_LOW,  # <1%
    },
}


# =============================================================================
# NSAID CROSS-REACTIVITY DATABASE
# =============================================================================

NSAID_DRUGS: Dict[str, DrugClass] = {
    # Aspirin
    "aspirin": DrugClass.NSAID_ASPIRIN,
    "asa": DrugClass.NSAID_ASPIRIN,
    "acetylsalicylic acid": DrugClass.NSAID_ASPIRIN,
    
    # Propionic acid derivatives
    "ibuprofen": DrugClass.NSAID_PROPIONIC_ACID,
    "motrin": DrugClass.NSAID_PROPIONIC_ACID,
    "advil": DrugClass.NSAID_PROPIONIC_ACID,
    "naproxen": DrugClass.NSAID_PROPIONIC_ACID,
    "aleve": DrugClass.NSAID_PROPIONIC_ACID,
    "naprosyn": DrugClass.NSAID_PROPIONIC_ACID,
    "ketoprofen": DrugClass.NSAID_PROPIONIC_ACID,
    "orudis": DrugClass.NSAID_PROPIONIC_ACID,
    "flurbiprofen": DrugClass.NSAID_PROPIONIC_ACID,
    "ansaid": DrugClass.NSAID_PROPIONIC_ACID,
    "oxaprozin": DrugClass.NSAID_PROPIONIC_ACID,
    "daypro": DrugClass.NSAID_PROPIONIC_ACID,
    
    # Acetic acid derivatives
    "diclofenac": DrugClass.NSAID_ACETIC_ACID,
    "voltaren": DrugClass.NSAID_ACETIC_ACID,
    "cataflam": DrugClass.NSAID_ACETIC_ACID,
    "indomethacin": DrugClass.NSAID_ACETIC_ACID,
    "indocin": DrugClass.NSAID_ACETIC_ACID,
    "etodolac": DrugClass.NSAID_ACETIC_ACID,
    "lodine": DrugClass.NSAID_ACETIC_ACID,
    "ketorolac": DrugClass.NSAID_ACETIC_ACID,
    "toradol": DrugClass.NSAID_ACETIC_ACID,
    "nabumetone": DrugClass.NSAID_ACETIC_ACID,
    "relafen": DrugClass.NSAID_ACETIC_ACID,
    "sulindac": DrugClass.NSAID_ACETIC_ACID,
    "clinoril": DrugClass.NSAID_ACETIC_ACID,
    
    # Enolic acid derivatives
    "meloxicam": DrugClass.NSAID_ENOLIC_ACID,
    "mobic": DrugClass.NSAID_ENOLIC_ACID,
    "piroxicam": DrugClass.NSAID_ENOLIC_ACID,
    "feldene": DrugClass.NSAID_ENOLIC_ACID,
    
    # COX-2 inhibitors
    "celecoxib": DrugClass.NSAID_COX2_INHIBITOR,
    "celebrex": DrugClass.NSAID_COX2_INHIBITOR,
    "etoricoxib": DrugClass.NSAID_COX2_INHIBITOR,
    "arcoxia": DrugClass.NSAID_COX2_INHIBITOR,
}

# NSAID cross-reactivity patterns
# Three clinical phenotypes:
# 1. NSAID-exacerbated respiratory disease (NERD) - cross-react with all NSAIDs
# 2. NSAID-exacerbated cutaneous disease (NECD) - cross-react with all NSAIDs  
# 3. Single-NSAID-induced urticaria/angioedema (SNIUAA) - NO cross-reactivity

NSAID_CROSS_REACTIVITY: Dict[DrugClass, Dict[DrugClass, CrossReactivityRisk]] = {
    # Strong cross-reactivity among all traditional NSAIDs (non-selective COX inhibitors)
    DrugClass.NSAID_ASPIRIN: {
        DrugClass.NSAID_PROPIONIC_ACID: CrossReactivityRisk.HIGH,  # ~20-40% in NERD/NECD
        DrugClass.NSAID_ACETIC_ACID: CrossReactivityRisk.HIGH,  # ~20-40% in NERD/NECD
        DrugClass.NSAID_ENOLIC_ACID: CrossReactivityRisk.HIGH,  # ~20-40% in NERD/NECD
        DrugClass.NSAID_COX2_INHIBITOR: CrossReactivityRisk.LOW,  # ~2-5% in NERD
    },
    DrugClass.NSAID_PROPIONIC_ACID: {
        DrugClass.NSAID_ASPIRIN: CrossReactivityRisk.HIGH,
        DrugClass.NSAID_ACETIC_ACID: CrossReactivityRisk.HIGH,
        DrugClass.NSAID_ENOLIC_ACID: CrossReactivityRisk.HIGH,
        DrugClass.NSAID_COX2_INHIBITOR: CrossReactivityRisk.LOW,
    },
    DrugClass.NSAID_ACETIC_ACID: {
        DrugClass.NSAID_ASPIRIN: CrossReactivityRisk.HIGH,
        DrugClass.NSAID_PROPIONIC_ACID: CrossReactivityRisk.HIGH,
        DrugClass.NSAID_ENOLIC_ACID: CrossReactivityRisk.HIGH,
        DrugClass.NSAID_COX2_INHIBITOR: CrossReactivityRisk.LOW,
    },
    DrugClass.NSAID_ENOLIC_ACID: {
        DrugClass.NSAID_ASPIRIN: CrossReactivityRisk.HIGH,
        DrugClass.NSAID_PROPIONIC_ACID: CrossReactivityRisk.HIGH,
        DrugClass.NSAID_ACETIC_ACID: CrossReactivityRisk.HIGH,
        DrugClass.NSAID_COX2_INHIBITOR: CrossReactivityRisk.LOW,
    },
    DrugClass.NSAID_COX2_INHIBITOR: {
        DrugClass.NSAID_ASPIRIN: CrossReactivityRisk.LOW,
        DrugClass.NSAID_PROPIONIC_ACID: CrossReactivityRisk.LOW,
        DrugClass.NSAID_ACETIC_ACID: CrossReactivityRisk.LOW,
        DrugClass.NSAID_ENOLIC_ACID: CrossReactivityRisk.LOW,
    },
}


# =============================================================================
# LATEX-FRUIT SYNDROME DATABASE
# =============================================================================

LATEX_FRUIT_CROSS_REACTIVITY: Dict[str, Dict[str, float]] = {
    # Food -> latex cross-reactivity percentage
    "avocado": {"latex": 0.50},
    "banana": {"latex": 0.40},
    "chestnut": {"latex": 0.50},
    "kiwi": {"latex": 0.30},
    "papaya": {"latex": 0.20},
    "fig": {"latex": 0.15},
    "tomato": {"latex": 0.10},
    "potato": {"latex": 0.10},
    "bell_pepper": {"latex": 0.10},
    "passion_fruit": {"latex": 0.15},
    "mango": {"latex": 0.05},
    "pineapple": {"latex": 0.05},
    "peach": {"latex": 0.05},
    "melon": {"latex": 0.10},
    "celery": {"latex": 0.05},
}


# =============================================================================
# ALLERGY CROSS-REACTIVITY ENGINE
# =============================================================================

class AllergyCrossReactivityEngine:
    """
    Comprehensive allergy cross-reactivity checking engine.
    
    Features:
    - Beta-lactam cross-reactivity (penicillins, cephalosporins, carbapenems)
    - Sulfonamide cross-reactivity
    - NSAID cross-reactivity
    - Latex-fruit syndrome
    - Evidence-based recommendations
    """
    
    def __init__(self):
        """Initialize the engine with all cross-reactivity databases."""
        self.beta_lactam_drugs = BETA_LACTAM_DRUGS
        self.beta_lactam_cross_reactivity = BETA_LACTAM_CROSS_REACTIVITY
        self.sulfonamide_drugs = SULFONAMIDE_DRUGS
        self.sulfonamide_cross_reactivity = SULFONAMIDE_CROSS_REACTIVITY
        self.nsaid_drugs = NSAID_DRUGS
        self.nsaid_cross_reactivity = NSAID_CROSS_REACTIVITY
        self.latex_fruit = LATEX_FRUIT_CROSS_REACTIVITY
    
    def get_drug_class(self, drug: str) -> Optional[DrugClass]:
        """
        Get the drug class for a given drug name.
        
        Args:
            drug: Drug name
            
        Returns:
            DrugClass if found, None otherwise
        """
        drug_lower = drug.lower().strip()
        
        # Check all drug databases
        for db in [self.beta_lactam_drugs, self.sulfonamide_drugs, self.nsaid_drugs]:
            if drug_lower in db:
                return db[drug_lower]
        
        return None
    
    def check_beta_lactam_cross_reactivity(
        self, 
        allergy_drug: str, 
        target_drug: str,
        allergy_severity: AllergySeverity = AllergySeverity.UNKNOWN
    ) -> Optional[CrossReactivityResult]:
        """
        Check for beta-lactam cross-reactivity.
        
        Args:
            allergy_drug: Drug the patient is allergic to
            target_drug: Drug being considered for use
            allergy_severity: Severity of the known allergy
            
        Returns:
            CrossReactivityResult if cross-reactivity exists, None otherwise
        """
        allergy_class = self.get_drug_class(allergy_drug)
        target_class = self.get_drug_class(target_drug)
        
        if allergy_class is None or target_class is None:
            return None
        
        # Check if both are beta-lactams
        if allergy_class not in self.beta_lactam_cross_reactivity:
            return None
        
        if target_class not in self.beta_lactam_cross_reactivity.get(allergy_class, {}):
            return None
        
        risk = self.beta_lactam_cross_reactivity[allergy_class][target_class]
        
        # Get risk percentage
        risk_percentages = {
            CrossReactivityRisk.NONE: "0%",
            CrossReactivityRisk.VERY_LOW: "<1%",
            CrossReactivityRisk.LOW: "1-5%",
            CrossReactivityRisk.MODERATE: "5-10%",
            CrossReactivityRisk.HIGH: "10-25%",
            CrossReactivityRisk.VERY_HIGH: "25-50%",
            CrossReactivityRisk.COMPLETE: ">50%",
        }
        
        # Build recommendation
        if risk == CrossReactivityRisk.NONE:
            recommendation = "No cross-reactivity expected. Drug can be used safely."
            clinical_action = "Proceed with standard dosing."
            requires_skin_testing = False
        elif risk == CrossReactivityRisk.VERY_LOW:
            recommendation = "Very low cross-reactivity risk. Generally safe to use."
            clinical_action = "Proceed with standard dosing. Observe for any reaction."
            requires_skin_testing = False
        elif risk == CrossReactivityRisk.LOW:
            recommendation = "Low cross-reactivity risk. Usually safe, but consider alternatives if high-risk."
            clinical_action = "Consider graded challenge if history of severe reaction. Otherwise proceed with monitoring."
            requires_skin_testing = allergy_severity in [AllergySeverity.SEVERE]
        elif risk == CrossReactivityRisk.MODERATE:
            recommendation = "Moderate cross-reactivity risk. Consider alternatives or skin testing."
            clinical_action = "Skin testing recommended if severe allergy history. Graded challenge if skin test unavailable."
            requires_skin_testing = True
        else:
            recommendation = "High cross-reactivity risk. Avoid or use with extreme caution."
            clinical_action = "Avoid if possible. If critical, consider desensitization protocol."
            requires_skin_testing = True
        
        # Get alternatives
        alternatives = self._get_beta_lactam_alternatives(allergy_class, target_class)
        
        return CrossReactivityResult(
            source_drug=allergy_drug,
            source_drug_class=allergy_class,
            target_drug=target_drug,
            target_drug_class=target_class,
            cross_reactivity_risk=risk,
            risk_percentage=risk_percentages[risk],
            recommendation=recommendation,
            clinical_action=clinical_action,
            evidence_sources=[
                "Blumenthal KG et al. JAMA 2019;321:177-192",
                "Pichichero ME et al. Pediatrics 2020;146:e2020000841",
                "Joint Task Force on Practice Parameters 2022"
            ],
            requires_skin_testing=requires_skin_testing,
            alternative_drugs=alternatives,
            notes=self._get_beta_lactam_notes(allergy_drug, target_drug, allergy_severity)
        )
    
    def check_sulfonamide_cross_reactivity(
        self, 
        allergy_drug: str, 
        target_drug: str
    ) -> Optional[CrossReactivityResult]:
        """
        Check for sulfonamide cross-reactivity.
        
        Key insight: Non-arylamine sulfonamides do NOT cross-react with sulfonamide antibiotics.
        """
        allergy_class = self.get_drug_class(allergy_drug)
        target_class = self.get_drug_class(target_drug)
        
        if allergy_class is None or target_class is None:
            return None
        
        # Check if both are sulfonamide types
        sulfonamide_classes = [
            DrugClass.SULFONAMIDE_ANTIBIOTIC,
            DrugClass.SULFONAMIDE_DIURETIC,
            DrugClass.SULFONAMIDE_CARBONIC_ANHYDRASE_INHIBITOR,
            DrugClass.SULFONYLUREA
        ]
        
        if allergy_class not in sulfonamide_classes or target_class not in sulfonamide_classes:
            return None
        
        if allergy_class == target_class:
            # Same class
            risk = CrossReactivityRisk.HIGH
            recommendation = "Same sulfonamide class. Avoid if allergic."
        else:
            # Different sulfonamide class - VERY LOW cross-reactivity
            risk = self.sulfonamide_cross_reactivity.get(allergy_class, {}).get(target_class, CrossReactivityRisk.VERY_LOW)
            recommendation = "Very low cross-reactivity risk between sulfonamide classes. Generally safe to use."
        
        risk_percentages = {
            CrossReactivityRisk.VERY_LOW: "<1%",
            CrossReactivityRisk.LOW: "1-5%",
            CrossReactivityRisk.MODERATE: "5-10%",
            CrossReactivityRisk.HIGH: "10-25%",
        }
        
        return CrossReactivityResult(
            source_drug=allergy_drug,
            source_drug_class=allergy_class,
            target_drug=target_drug,
            target_drug_class=target_class,
            cross_reactivity_risk=risk,
            risk_percentage=risk_percentages.get(risk, "<1%"),
            recommendation=recommendation,
            clinical_action="Proceed with monitoring. Non-arylamine sulfonamides do not cross-react with sulfonamide antibiotics.",
            evidence_sources=[
                "Strom BL et al. N Engl J Med 2003;349:1628-1635",
                "Joint Task Force on Practice Parameters 2022"
            ],
            requires_skin_testing=False,
            notes=["Cross-reactivity is NOT based on sulfonamide structure.", 
                   "Arylamine group in sulfonamide antibiotics is the true allergen."]
        )
    
    def check_nsaid_cross_reactivity(
        self, 
        allergy_drug: str, 
        target_drug: str,
        phenotype: str = "unknown"  # NERD, NECD, or SNIUAA
    ) -> Optional[CrossReactivityResult]:
        """
        Check for NSAID cross-reactivity.
        
        Args:
            allergy_drug: NSAID the patient reacted to
            target_drug: NSAID being considered
            phenotype: Clinical phenotype (NERD, NECD, SNIUAA, or unknown)
        """
        allergy_class = self.get_drug_class(allergy_drug)
        target_class = self.get_drug_class(target_drug)
        
        if allergy_class is None or target_class is None:
            return None
        
        nsaid_classes = [
            DrugClass.NSAID_ASPIRIN,
            DrugClass.NSAID_PROPIONIC_ACID,
            DrugClass.NSAID_ACETIC_ACID,
            DrugClass.NSAID_ENOLIC_ACID,
            DrugClass.NSAID_COX2_INHIBITOR
        ]
        
        if allergy_class not in nsaid_classes or target_class not in nsaid_classes:
            return None
        
        # Get base risk
        risk = self.nsaid_cross_reactivity.get(allergy_class, {}).get(
            target_class, CrossReactivityRisk.LOW
        )
        
        # Adjust based on phenotype
        if phenotype.upper() == "SNIUAA":
            # Single-NSAID-induced - NO cross-reactivity
            risk = CrossReactivityRisk.VERY_LOW
            recommendation = "Single-NSAID-induced urticaria. Low cross-reactivity risk."
            clinical_action = "Can try alternative NSAID with monitoring."
        elif phenotype.upper() in ["NERD", "NECD"]:
            # Respiratory or cutaneous disease - HIGH cross-reactivity
            if target_class != DrugClass.NSAID_COX2_INHIBITOR:
                risk = CrossReactivityRisk.HIGH
                recommendation = "NSAID-exacerbated disease. Avoid all non-selective NSAIDs."
                clinical_action = "Use COX-2 inhibitor (celecoxib) or avoid NSAIDs entirely."
            else:
                recommendation = "COX-2 inhibitor may be tolerated. Challenge recommended."
                clinical_action = "Graded challenge with celecoxib in monitored setting."
        else:
            recommendation = "Cross-reactivity risk depends on clinical phenotype."
            clinical_action = "If respiratory symptoms with NSAIDs, avoid all non-selective NSAIDs."
        
        risk_percentages = {
            CrossReactivityRisk.VERY_LOW: "<1%",
            CrossReactivityRisk.LOW: "1-5%",
            CrossReactivityRisk.MODERATE: "5-10%",
            CrossReactivityRisk.HIGH: "20-40%",
        }
        
        return CrossReactivityResult(
            source_drug=allergy_drug,
            source_drug_class=allergy_class,
            target_drug=target_drug,
            target_drug_class=target_class,
            cross_reactivity_risk=risk,
            risk_percentage=risk_percentages.get(risk, "Variable"),
            recommendation=recommendation,
            clinical_action=clinical_action,
            evidence_sources=[
                "Sanchez-Borges M et al. J Allergy Clin Immunol Pract 2020",
                "Kowalski ML et al. Allergy 2013;68:1219-1232"
            ],
            requires_skin_testing=False,
            notes=["Phenotype determines cross-reactivity risk.",
                   "NERD/NECD: Cross-reactivity with all traditional NSAIDs",
                   "SNIUAA: Single drug reaction, low cross-reactivity"]
        )
    
    def check_latex_fruit_syndrome(
        self, 
        latex_allergy: bool = False,
        food: str = None
    ) -> Optional[CrossReactivityResult]:
        """
        Check for latex-fruit syndrome cross-reactivity.
        
        Args:
            latex_allergy: Whether patient has latex allergy
            food: Food being checked for cross-reactivity
        """
        if latex_allergy and food:
            food_lower = food.lower().replace(" ", "_")
            if food_lower in self.latex_fruit:
                risk_pct = self.latex_fruit[food_lower]["latex"]
                risk = CrossReactivityRisk.HIGH if risk_pct > 0.3 else (
                    CrossReactivityRisk.MODERATE if risk_pct > 0.15 else CrossReactivityRisk.LOW
                )
                
                return CrossReactivityResult(
                    source_drug="latex",
                    source_drug_class=DrugClass.LATEX,
                    target_drug=food,
                    target_drug_class=DrugClass.LATEX,  # Repurposed
                    cross_reactivity_risk=risk,
                    risk_percentage=f"{risk_pct*100:.0f}%",
                    recommendation=f"Latex-fruit syndrome: {food} has ~{risk_pct*100:.0f}% cross-reactivity with latex.",
                    clinical_action="Avoid or use with caution. Consider allergy testing.",
                    evidence_sources=[
                        "Hartz C et al. J Allergy Clin Immunol 2022",
                        "Wagner S et al. Clin Exp Allergy 2000"
                    ],
                    requires_skin_testing=True,
                    alternative_drugs=[],
                    notes=["Cross-reactivity due to hevein-like proteins",
                           "High-risk foods: avocado, banana, chestnut, kiwi"]
                )
        
        return None
    
    def check_all_cross_reactivity(
        self, 
        allergy_drug: str, 
        target_drug: str,
        allergy_severity: AllergySeverity = AllergySeverity.UNKNOWN,
        nsaid_phenotype: str = "unknown",
        latex_allergy: bool = False
    ) -> Optional[CrossReactivityResult]:
        """
        Check all cross-reactivity types.
        
        Args:
            allergy_drug: Drug patient is allergic to
            target_drug: Drug being considered
            allergy_severity: Severity of known allergy
            nsaid_phenotype: NSAID reaction phenotype
            latex_allergy: Whether patient has latex allergy
        """
        # Check beta-lactam first
        result = self.check_beta_lactam_cross_reactivity(
            allergy_drug, target_drug, allergy_severity
        )
        if result:
            return result
        
        # Check sulfonamide
        result = self.check_sulfonamide_cross_reactivity(allergy_drug, target_drug)
        if result:
            return result
        
        # Check NSAID
        result = self.check_nsaid_cross_reactivity(
            allergy_drug, target_drug, nsaid_phenotype
        )
        if result:
            return result
        
        # Check latex-fruit
        if latex_allergy:
            result = self.check_latex_fruit_syndrome(latex_allergy, target_drug)
            if result:
                return result
        
        return None
    
    def _get_beta_lactam_alternatives(
        self, 
        allergy_class: DrugClass, 
        target_class: DrugClass
    ) -> List[str]:
        """Get alternative antibiotics based on allergy class."""
        alternatives = {
            DrugClass.PENICILLIN: {
                DrugClass.CEPHALOSPORIN_3RD_GEN: ["aztreonam", "vancomycin", "daptomycin"],
                DrugClass.CARBAPENEM: ["aztreonam", "vancomycin"],
            },
            DrugClass.AMINOPENICILLIN: {
                DrugClass.CEPHALOSPORIN_3RD_GEN: ["aztreonam", "vancomycin", "daptomycin"],
                DrugClass.CARBAPENEM: ["aztreonam", "vancomycin"],
            },
        }
        
        if allergy_class in alternatives and target_class in alternatives[allergy_class]:
            return alternatives[allergy_class][target_class]
        
        return ["vancomycin", "aztreonam", "daptomycin"]  # Safe defaults
    
    def _get_beta_lactam_notes(
        self, 
        allergy_drug: str, 
        target_drug: str,
        allergy_severity: AllergySeverity
    ) -> List[str]:
        """Get clinical notes for beta-lactam cross-reactivity."""
        notes = []
        
        if allergy_severity == AllergySeverity.SEVERE:
            notes.append("History of severe reaction - exercise extreme caution")
        
        # Special cases
        allergy_lower = allergy_drug.lower()
        target_lower = target_drug.lower()
        
        if "ceftazidime" in target_lower and "aztreonam" not in allergy_lower:
            notes.append("WARNING: Ceftazidime shares identical side chain with aztreonam")
        
        if "aztreonam" in target_lower:
            notes.append("Aztreonam has NO cross-reactivity with other beta-lactams except ceftazidime")
        
        notes.append("Cross-reactivity is primarily driven by side chain similarity, not beta-lactam ring")
        
        return notes


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def check_beta_lactam_cross_reactivity(
    allergy_drug: str, 
    target_drug: str,
    allergy_severity: str = "unknown"
) -> Optional[Dict[str, Any]]:
    """
    Check for beta-lactam cross-reactivity.
    
    Args:
        allergy_drug: Drug patient is allergic to
        target_drug: Drug being considered
        allergy_severity: Severity of known allergy (mild, moderate, severe, unknown)
        
    Returns:
        Cross-reactivity result dictionary if found, None otherwise
    """
    engine = AllergyCrossReactivityEngine()
    severity_map = {
        "mild": AllergySeverity.MILD,
        "moderate": AllergySeverity.MODERATE,
        "severe": AllergySeverity.SEVERE,
        "unknown": AllergySeverity.UNKNOWN
    }
    severity = severity_map.get(allergy_severity.lower(), AllergySeverity.UNKNOWN)
    result = engine.check_beta_lactam_cross_reactivity(allergy_drug, target_drug, severity)
    return result.to_dict() if result else None


def check_sulfonamide_cross_reactivity(
    allergy_drug: str, 
    target_drug: str
) -> Optional[Dict[str, Any]]:
    """
    Check for sulfonamide cross-reactivity.
    
    Key insight: Non-arylamine sulfonamides (diuretics, sulfonylureas) do NOT 
    cross-react with sulfonamide antibiotics.
    """
    engine = AllergyCrossReactivityEngine()
    result = engine.check_sulfonamide_cross_reactivity(allergy_drug, target_drug)
    return result.to_dict() if result else None


def check_nsaid_cross_reactivity(
    allergy_drug: str, 
    target_drug: str,
    phenotype: str = "unknown"
) -> Optional[Dict[str, Any]]:
    """
    Check for NSAID cross-reactivity.
    
    Args:
        allergy_drug: NSAID patient reacted to
        target_drug: NSAID being considered
        phenotype: Clinical phenotype (NERD, NECD, SNIUAA, or unknown)
    """
    engine = AllergyCrossReactivityEngine()
    result = engine.check_nsaid_cross_reactivity(allergy_drug, target_drug, phenotype)
    return result.to_dict() if result else None


def check_latex_fruit_syndrome(
    latex_allergy: bool = True,
    food: str = None
) -> Optional[Dict[str, Any]]:
    """
    Check for latex-fruit syndrome cross-reactivity.
    
    High-risk foods: avocado, banana, chestnut, kiwi, papaya
    """
    engine = AllergyCrossReactivityEngine()
    result = engine.check_latex_fruit_syndrome(latex_allergy, food)
    return result.to_dict() if result else None

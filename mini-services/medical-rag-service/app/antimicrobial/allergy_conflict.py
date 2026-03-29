"""
Allergy Conflict Checking Module for Antimicrobial Stewardship
==============================================================

Implements evidence-based drug allergy cross-reactivity checking with
proper risk stratification based on allergy type and drug class.

CRITICAL: This module fixes the dangerous practice of blocking ALL cephalosporins
for ANY penicillin allergy. Evidence shows:
- 1st gen cephalosporins: ~2% cross-reactivity (shared R1 side chain with penicillins)
- 2nd gen cephalosporins: ~1% cross-reactivity
- 3rd/4th/5th gen cephalosporins: <1% cross-reactivity (clinically equivalent to general population)

References:
- Macy E, et al. JAMA Intern Med 2014;174(10):1630-1638
- Romano A, et al. J Allergy Clin Immunol 2004;113(2):401-402
- Castells M, et al. N Engl J Med 2019;381:2338-2351
- Picard M, et al. J Allergy Clin Immunol Pract 2019;7(2):408-414

Clinical Impact:
Previously, a patient with penicillin rash who needed ceftriaxone for meningitis
would be incorrectly denied this life-saving antibiotic. Now they receive it with
appropriate caution warnings.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum


class AllergyType(Enum):
    """
    Classification of allergy reaction type.
    
    Critical for determining cross-reactivity risk:
    - Intolerance: GI upset, headache (not true allergy)
    - Rash: Maculopapular rash (delayed, T-cell mediated)
    - Anaphylaxis: IgE-mediated immediate reaction (highest risk)
    - Unknown: Unknown type (treat conservatively)
    """
    INTOLERANCE = "intolerance"     # Non-immunologic (GI upset, etc.)
    RASH = "rash"                   # Delayed hypersensitivity
    ANAPHYLAXIS = "anaphylaxis"     # IgE-mediated immediate reaction
    UNKNOWN = "unknown"             # Type unknown - treat conservatively


class ConflictSeverity(Enum):
    """
    Severity level of allergy conflict.
    
    - SAFE: No significant cross-reactivity risk
    - CAUTION: Low cross-reactivity risk, use with monitoring
    - CONTRAINDICATED: Significant risk, avoid use
    """
    SAFE = "safe"
    CAUTION = "caution"
    CONTRAINDICATED = "contraindicated"


@dataclass
class AllergyConflictResult:
    """
    Structured result of allergy conflict checking.
    
    PROMPT 3 FIX: Enhanced with R1 side chain homology fields.
    
    Provides detailed information about potential cross-reactivity
    including severity, warnings, and evidence-based recommendations.
    
    R1 Side Chain Model:
    Cross-reactivity between beta-lactams is primarily determined by shared
    R1 side chains, not the beta-lactam ring itself. This explains why:
    - Amoxicillin/ampicillin cross-react (shared aminobenzyl R1)
    - Ceftriaxone does NOT cross-react with penicillin (different R1)
    - Aztreonam crosses with ceftazidime (shared R1) but not other beta-lactams
    
    Reference: Macy E, Contreras R. JAMA Intern Med 2014;174(10):1630-1638
    """
    blocked: bool
    severity: ConflictSeverity
    warning: Optional[str] = None
    cross_reactivity_risk: Optional[str] = None
    alternative_recommendations: List[str] = field(default_factory=list)
    evidence_source: Optional[str] = None
    drug_class: Optional[str] = None
    allergy_detail: Optional[str] = None
    # PROMPT 3 FIX: New fields for R1 side chain model
    generation: Optional[str] = None  # "1st", "2nd", "3rd", "4th", "5th", "carbapenem", "monobactam"
    evidence: Optional[str] = None  # PMID citation
    can_use_with_premedication: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "blocked": self.blocked,
            "severity": self.severity.value,
            "warning": self.warning,
            "cross_reactivity_risk": self.cross_reactivity_risk,
            "alternative_recommendations": self.alternative_recommendations,
            "evidence_source": self.evidence_source,
            "drug_class": self.drug_class,
            "allergy_detail": self.allergy_detail,
            "generation": self.generation,
            "evidence": self.evidence,
            "can_use_with_premedication": self.can_use_with_premedication,
        }


# =============================================================================
# CEPHALOSPORIN GENERATION MAP
# =============================================================================

CEPHALOSPORIN_GENERATIONS = {
    # First generation: Highest cross-reactivity with penicillins (~2%)
    # Shared R1 side chain with some penicillins
    # Source: Macy E et al. JAMA Intern Med 2014
    "FIRST_GEN": {
        "drugs": ["cefazolin", "cephalexin", "cefadroxil", "cephradine", "cefalexin"],
        "cross_reactivity_with_penicillin": "~2%",
        "notes": "Shared R1 side chain with some penicillins increases cross-reactivity",
    },
    
    # Second generation: Moderate cross-reactivity (~1%)
    # Different side chain structure
    "SECOND_GEN": {
        "drugs": ["cefuroxime", "cefoxitin", "cefaclor", "cefprozil", "cefmetazole", "cefotetan"],
        "cross_reactivity_with_penicillin": "~1%",
        "notes": "Different side chain structure reduces cross-reactivity",
    },
    
    # Third generation: Low cross-reactivity (<1%)
    # Structurally different from penicillins
    "THIRD_GEN": {
        "drugs": [
            "ceftriaxone", "cefotaxime", "ceftazidime", "cefdinir", 
            "cefpodoxime", "cefexime", "cefotaxime", "ceftibuten",
            "cefoperazone", "ceftriaxone"
        ],
        "cross_reactivity_with_penicillin": "<1%",
        "notes": "Structurally different; cross-reactivity same as general population",
    },
    
    # Fourth generation: Very low cross-reactivity (<1%)
    "FOURTH_GEN": {
        "drugs": ["cefepime", "cefpirome"],
        "cross_reactivity_with_penicillin": "<1%",
        "notes": "Extended spectrum; minimal cross-reactivity",
    },
    
    # Fifth generation: Very low cross-reactivity (<1%)
    # Anti-MRSA activity
    "FIFTH_GEN": {
        "drugs": ["ceftaroline", "ceftobiprole"],
        "cross_reactivity_with_penicillin": "<1%",
        "notes": "Anti-MRSA cephalosporins; minimal cross-reactivity",
    },
}


def get_cephalosporin_generation(drug_name: str) -> Optional[str]:
    """
    Determine the generation of a cephalosporin drug.
    
    Args:
        drug_name: Name of the cephalosporin drug
        
    Returns:
        Generation string ("FIRST_GEN", "SECOND_GEN", etc.) or None if not a cephalosporin
        
    Reference: Drug classification per IDSA guidelines
    """
    drug_lower = drug_name.lower().replace("-", "").replace(" ", "")
    
    for generation, data in CEPHALOSPORIN_GENERATIONS.items():
        for drug in data["drugs"]:
            # Match drug name (allowing for partial matches like "ceftriaxone" in "ceftriaxone sodium")
            if drug in drug_lower or drug_lower in drug:
                return generation
    
    return None


def is_cephalosporin(drug_name: str) -> bool:
    """Check if a drug is a cephalosporin."""
    drug_lower = drug_name.lower()
    return (
        get_cephalosporin_generation(drug_name) is not None or
        any(prefix in drug_lower for prefix in ["cef", "ceph", "keflex", "ancef", "rocephin"])
    )


def is_penicillin(drug_name: str) -> bool:
    """Check if a drug is a penicillin."""
    drug_lower = drug_name.lower()
    penicillin_patterns = [
        "penicillin", "amoxicillin", "ampicillin", "nafcillin", "oxacillin",
        "dicloxacillin", "cloxacillin", "piperacillin", "ticarcillin",
        "penicillamine", "augmentin", "unasyn", "zosyn", "timentin"
    ]
    return any(pattern in drug_lower for pattern in penicillin_patterns)


def is_aminopenicillin(drug_name: str) -> bool:
    """
    Check if a drug is an aminopenicillin (amoxicillin, ampicillin).
    
    PROMPT 3 FIX: Aminopenicillins share the aminobenzyl R1 side chain.
    This is critical for cross-reactivity assessment.
    
    Reference: Pichichero ME. Pediatrics 2005;115(4):1048-1057
    """
    drug_lower = drug_name.lower()
    return any(p in drug_lower for p in ["amoxicillin", "ampicillin", "amoxil", "principen"])


def is_carbapenem(drug_name: str) -> bool:
    """
    Check if a drug is a carbapenem.
    
    PROMPT 3 FIX: Carbapenems have <1% cross-reactivity with penicillins.
    
    Reference: Romano A et al. J Allergy Clin Immunol 2004;113(2):401-402 (PMID 15282380)
    """
    drug_lower = drug_name.lower()
    return any(p in drug_lower for p in [
        "imipenem", "meropenem", "ertapenem", "doripenem", "panipenem", "biapenem"
    ])


def is_aztreonam(drug_name: str) -> bool:
    """
    Check if a drug is aztreonam (monobactam).
    
    PROMPT 3 FIX: Aztreonam has unique R1 side chain shared ONLY with ceftazidime.
    
    Reference: Macy E. JAMA Intern Med 2014;174(10):1630-1638
    """
    drug_lower = drug_name.lower()
    return "aztreonam" in drug_lower or "azactam" in drug_lower


def is_ceftazidime(drug_name: str) -> bool:
    """
    Check if a drug is ceftazidime.
    
    PROMPT 3 FIX: Ceftazidime shares R1 side chain with aztreonam.
    This is a unique cross-reactivity pair.
    
    Reference: Macy E. JAMA Intern Med 2014;174(10):1630-1638
    """
    drug_lower = drug_name.lower()
    return "ceftazidime" in drug_lower or "fortaz" in drug_lower or "tazicef" in drug_lower


def is_sulfa_drug(drug_name: str) -> bool:
    """Check if a drug is a sulfonamide antibiotic."""
    drug_lower = drug_name.lower()
    return (
        "sulfa" in drug_lower or 
        "sulfamethoxazole" in drug_lower or
        "tmp-smx" in drug_lower or
        "bactrim" in drug_lower or
        "septra" in drug_lower or
        "sulfonamide" in drug_lower
    )


# =============================================================================
# ALLERGY CONFLICT CHECKING
# =============================================================================

def check_allergy_conflict(
    drug_name: str,
    allergies: List[str],
    allergy_types: Optional[Dict[str, str]] = None,
) -> AllergyConflictResult:
    """
    Check for drug allergy conflicts with evidence-based cross-reactivity assessment.
    
    This function implements evidence-based cross-reactivity checking, particularly
    for beta-lactam antibiotics, avoiding the dangerous practice of automatically
    blocking all cephalosporins for any penicillin allergy.
    
    Args:
        drug_name: Name of the drug to check
        allergies: List of patient allergies (drug names)
        allergy_types: Optional dict mapping allergy name to allergy type
                      ("intolerance", "rash", "anaphylaxis", "unknown")
    
    Returns:
        AllergyConflictResult with detailed conflict information
        
    Example:
        >>> result = check_allergy_conflict("ceftriaxone", ["penicillin"], {"penicillin": "rash"})
        >>> result.blocked
        False
        >>> result.severity
        ConflictSeverity.SAFE
        >>> result.warning
        '<1% cross-reactivity; generally safe to use...'
    """
    drug_lower = drug_name.lower()
    allergy_types = allergy_types or {}
    
    # Normalize allergy names
    normalized_allergies = [a.lower().strip() for a in allergies]
    
    # ==========================================================================
    # DIRECT ALLERGY MATCH - Highest priority
    # ==========================================================================
    for allergy in normalized_allergies:
        if allergy in drug_lower or drug_lower in allergy:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning=f"⚠️ CONTRAINDICATED: Patient has documented allergy to {allergy}",
                cross_reactivity_risk="Direct allergen match (100%)",
                evidence_source="Direct allergy documentation",
                drug_class=_get_drug_class(drug_name),
                allergy_detail=allergy,
            )
    
    # ==========================================================================
    # PENICILLIN ALLERGY → CEPHALOSPORIN CROSS-REACTIVITY
    # ==========================================================================
    # Evidence: Macy E et al. JAMA Intern Med 2014; Romano A et al. JACI 2004
    # 
    # Key findings:
    # - True penicillin allergy prevalence: ~10% of reported cases
    # - Cross-reactivity with 1st gen cephalosporins: ~2%
    # - Cross-reactivity with 2nd gen cephalosporins: ~1%
    # - Cross-reactivity with 3rd/4th/5th gen: <1% (same as general population)
    # - Anaphylaxis history increases risk but still <1% for 3rd+ gen
    
    penicillin_allergies = [
        "penicillin", "amoxicillin", "ampicillin", "nafcillin", "oxacillin",
        "dicloxacillin", "piperacillin", "ticarcillin", "augmentin", "unasyn", "zosyn"
    ]
    
    has_penicillin_allergy = any(
        any(pen_allergy in allergy for pen_allergy in penicillin_allergies)
        for allergy in normalized_allergies
    )
    
    if has_penicillin_allergy and is_cephalosporin(drug_name):
        # Determine the specific penicillin allergy for type lookup
        specific_penicillin_allergy = None
        for allergy in normalized_allergies:
            for pen in penicillin_allergies:
                if pen in allergy:
                    specific_penicillin_allergy = allergy
                    break
            if specific_penicillin_allergy:
                break
        
        # Get allergy type (default to "unknown" if not specified)
        allergy_type_str = allergy_types.get(specific_penicillin_allergy, "unknown")
        allergy_type = AllergyType(allergy_type_str) if allergy_type_str in [e.value for e in AllergyType] else AllergyType.UNKNOWN
        
        generation = get_cephalosporin_generation(drug_name)
        gen_data = CEPHALOSPORIN_GENERATIONS.get(generation, {})
        
        return _evaluate_penicillin_cephalosporin_conflict(
            drug_name=drug_name,
            generation=generation,
            gen_data=gen_data,
            allergy_type=allergy_type,
        )
    
    # ==========================================================================
    # PENICILLIN ALLERGY → OTHER PENICILLINS
    # ==========================================================================
    if has_penicillin_allergy and is_penicillin(drug_name):
        # Determine allergy type
        specific_penicillin_allergy = None
        for allergy in normalized_allergies:
            for pen in penicillin_allergies:
                if pen in allergy:
                    specific_penicillin_allergy = allergy
                    break
            if specific_penicillin_allergy:
                break
        
        allergy_type_str = allergy_types.get(specific_penicillin_allergy, "unknown")
        allergy_type = AllergyType(allergy_type_str) if allergy_type_str in [e.value for e in AllergyType] else AllergyType.UNKNOWN
        
        if allergy_type == AllergyType.ANAPHYLAXIS:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning="⚠️ CONTRAINDICATED: History of anaphylaxis to penicillin - avoid all beta-lactams with similar structure",
                cross_reactivity_risk="High (class effect)",
                alternative_recommendations=["Aztreonam (no cross-reactivity)", "Vancomycin", "Carbapenems (low risk, ~1%)"],
                evidence_source="Castells M, et al. N Engl J Med 2019;381:2338-2351",
                drug_class="Penicillin",
                allergy_detail=f"Penicillin anaphylaxis",
            )
        else:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning=f"⚠️ CONTRAINDICATED: Patient has documented penicillin allergy ({allergy_type.value})",
                cross_reactivity_risk="Class effect - cross-reactivity within penicillins is high",
                alternative_recommendations=["Consider cephalosporin (3rd+ gen)", "Aztreonam", "Vancomycin", "Carbapenems"],
                evidence_source="Drug class cross-reactivity",
                drug_class="Penicillin",
                allergy_detail=f"Penicillin {allergy_type.value}",
            )
    
    # ==========================================================================
    # SULFA ALLERGY → SULFONAMIDE ANTIBIOTICS
    # ==========================================================================
    # Note: Non-antibiotic sulfonamides have very low cross-reactivity
    # Reference: Strom BL, et al. N Engl J Med 2003;349:1628-1635
    
    has_sulfa_allergy = any(
        "sulfa" in allergy or "sulfonamide" in allergy or "sulfamethoxazole" in allergy
        for allergy in normalized_allergies
    )
    
    if has_sulfa_allergy and is_sulfa_drug(drug_name):
        # Determine allergy type
        allergy_type_str = allergy_types.get("sulfa", allergy_types.get("sulfonamide", "unknown"))
        allergy_type = AllergyType(allergy_type_str) if allergy_type_str in [e.value for e in AllergyType] else AllergyType.UNKNOWN
        
        if allergy_type == AllergyType.ANAPHYLAXIS:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning="⚠️ CONTRAINDICATED: History of anaphylaxis to sulfonamide antibiotic",
                cross_reactivity_risk="High within antibiotic sulfonamides",
                alternative_recommendations=["Nitrofurantoin", "Fosfomycin", "Fluoroquinolones (if appropriate)"],
                evidence_source="Strom BL, et al. N Engl J Med 2003",
                drug_class="Sulfonamide antibiotic",
                allergy_detail="Sulfa anaphylaxis",
            )
        else:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning=f"⚠️ CONTRAINDICATED: Documented sulfonamide antibiotic allergy",
                cross_reactivity_risk="High within antibiotic sulfonamides (~100%)",
                alternative_recommendations=["Nitrofurantoin", "Fosfomycin", "Consider fluoroquinolones"],
                evidence_source="Strom BL, et al. N Engl J Med 2003",
                drug_class="Sulfonamide antibiotic",
                allergy_detail=f"Sulfa {allergy_type.value}",
            )
    
    # ==========================================================================
    # CEPHALOSPORIN ALLERGY → CEPHALOSPORIN
    # ==========================================================================
    # Check for any cephalosporin in the allergies list
    cephalosporin_allergy_info = None
    for allergy in normalized_allergies:
        if is_cephalosporin(allergy):
            cephalosporin_allergy_info = allergy
            break
    
    if cephalosporin_allergy_info and is_cephalosporin(drug_name):
        # Get allergy type for the specific cephalosporin allergy
        allergy_type_str = allergy_types.get(cephalosporin_allergy_info, "unknown")
        allergy_type = AllergyType(allergy_type_str) if allergy_type_str in [e.value for e in AllergyType] else AllergyType.UNKNOWN
        
        # Check if same generation
        allergy_gen = get_cephalosporin_generation(cephalosporin_allergy_info)
        drug_gen = get_cephalosporin_generation(drug_name)
        
        if allergy_gen and drug_gen and allergy_gen == drug_gen:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning=f"⚠️ CONTRAINDICATED: Same generation cephalosporin ({allergy_gen})",
                cross_reactivity_risk="High within same generation",
                alternative_recommendations=["Different generation cephalosporin", "Non-beta-lactam alternative"],
                evidence_source="Drug class cross-reactivity",
                drug_class=f"Cephalosporin {allergy_gen}",
                allergy_detail=cephalosporin_allergy_info,
            )
        
        # Different generation - use with caution (or block if anaphylaxis)
        if allergy_type == AllergyType.ANAPHYLAXIS:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning="⚠️ CONTRAINDICATED: History of anaphylaxis to cephalosporin - avoid all cephalosporins",
                cross_reactivity_risk="Unknown but potentially significant",
                alternative_recommendations=["Aztreonam", "Carbapenems", "Vancomycin", "Fluoroquinolones"],
                evidence_source="Conservative management of anaphylaxis history",
                drug_class="Cephalosporin",
                allergy_detail=f"{cephalosporin_allergy_info} anaphylaxis",
            )
        else:
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.CAUTION,
                warning="⚠️ CAUTION: Patient has cephalosporin allergy - different generation, use with monitoring",
                cross_reactivity_risk="Low between generations",
                alternative_recommendations=["Consider non-beta-lactam alternative if available"],
                evidence_source="Cephalosporin cross-reactivity data",
                drug_class="Cephalosporin",
                allergy_detail=f"{cephalosporin_allergy_info} {allergy_type.value}",
                generation=drug_gen.replace("_GEN", "th").lower() if drug_gen else None,
            )
    
    # ==========================================================================
    # PROMPT 3 FIX: AZTREONAM/CEFTAZIDIME SHARED R1 SIDE CHAIN
    # ==========================================================================
    # Aztreonam and ceftazidime share identical R1 side chains
    # Reference: Macy E. JAMA Intern Med 2014;174(10):1630-1638
    # This is the ONLY significant cross-reactivity for aztreonam
    
    # Check for ceftazidime allergy when prescribing aztreonam
    has_ceftazidime_allergy = any(is_ceftazidime(a) for a in normalized_allergies)
    if has_ceftazidime_allergy and is_aztreonam(drug_name):
        allergy_type_str = allergy_types.get("ceftazidime", "unknown")
        for a in normalized_allergies:
            if is_ceftazidime(a):
                allergy_type_str = allergy_types.get(a, "unknown")
                break
        allergy_type = AllergyType(allergy_type_str) if allergy_type_str in [e.value for e in AllergyType] else AllergyType.UNKNOWN
        
        if allergy_type == AllergyType.ANAPHYLAXIS:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning="⚠️ CONTRAINDICATED: Aztreonam shares R1 side chain with ceftazidime - history of ceftazidime anaphylaxis",
                cross_reactivity_risk=">50% (shared R1 side chain)",
                alternative_recommendations=[
                    "Carbapenems (no cross-reactivity)",
                    "Fluoroquinolones (if appropriate)",
                    "Vancomycin",
                ],
                evidence_source="Macy E. JAMA Intern Med 2014;174:1630-1638",
                evidence="PMID 25317731",
                drug_class="Monobactam",
                allergy_detail="Ceftazidime anaphylaxis (shared R1 with aztreonam)",
                generation="monobactam",
                can_use_with_premedication=False,
            )
        else:
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.CAUTION,
                warning="⚠️ CAUTION: Aztreonam shares R1 side chain with ceftazidime - patient has ceftazidime allergy. Use with caution.",
                cross_reactivity_risk="~30-50% (shared R1 side chain)",
                alternative_recommendations=["Carbapenems (no cross-reactivity)", "Consider alternative agent"],
                evidence_source="Macy E. JAMA Intern Med 2014;174:1630-1638",
                evidence="PMID 25317731",
                drug_class="Monobactam",
                allergy_detail=f"Ceftazidime {allergy_type.value} (shared R1)",
                generation="monobactam",
                can_use_with_premedication=True,
            )
    
    # Check for aztreonam allergy when prescribing ceftazidime (reverse direction)
    has_aztreonam_allergy = any(is_aztreonam(a) for a in normalized_allergies)
    if has_aztreonam_allergy and is_ceftazidime(drug_name):
        allergy_type_str = "unknown"
        for a in normalized_allergies:
            if is_aztreonam(a):
                allergy_type_str = allergy_types.get(a, "unknown")
                break
        allergy_type = AllergyType(allergy_type_str) if allergy_type_str in [e.value for e in AllergyType] else AllergyType.UNKNOWN
        
        if allergy_type == AllergyType.ANAPHYLAXIS:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning="⚠️ CONTRAINDICATED: Ceftazidime shares R1 side chain with aztreonam - history of aztreonam anaphylaxis",
                cross_reactivity_risk=">50% (shared R1 side chain)",
                alternative_recommendations=[
                    "Different 3rd gen cephalosporin (ceftriaxone, cefotaxime)",
                    "Carbapenems",
                    "Non-beta-lactam alternative",
                ],
                evidence_source="Macy E. JAMA Intern Med 2014;174:1630-1638",
                evidence="PMID 25317731",
                drug_class="Cephalosporin THIRD_GEN",
                allergy_detail="Aztreonam anaphylaxis (shared R1 with ceftazidime)",
                generation="3rd",
                can_use_with_premedication=False,
            )
        else:
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.CAUTION,
                warning="⚠️ CAUTION: Ceftazidime shares R1 side chain with aztreonam - patient has aztreonam allergy.",
                cross_reactivity_risk="~30-50% (shared R1 side chain)",
                alternative_recommendations=["Different 3rd gen cephalosporin", "Carbapenems"],
                evidence_source="Macy E. JAMA Intern Med 2014;174:1630-1638",
                evidence="PMID 25317731",
                drug_class="Cephalosporin THIRD_GEN",
                allergy_detail=f"Aztreonam {allergy_type.value} (shared R1)",
                generation="3rd",
                can_use_with_premedication=True,
            )
    
    # ==========================================================================
    # PROMPT 3 FIX: CARBAPENEM CROSS-REACTIVITY WITH PENICILLIN
    # ==========================================================================
    # Reference: Romano A et al. J Allergy Clin Immunol 2004;113(2):401-402
    # PMID 15282380 - Cross-reactivity is <1%, clinically negligible
    
    if has_penicillin_allergy and is_carbapenem(drug_name):
        # Determine allergy type
        specific_penicillin_allergy = None
        for allergy in normalized_allergies:
            for pen in penicillin_allergies:
                if pen in allergy:
                    specific_penicillin_allergy = allergy
                    break
            if specific_penicillin_allergy:
                break
        
        allergy_type_str = allergy_types.get(specific_penicillin_allergy, "unknown")
        allergy_type = AllergyType(allergy_type_str) if allergy_type_str in [e.value for e in AllergyType] else AllergyType.UNKNOWN
        
        # Even with anaphylaxis, carbapenems have <1% cross-reactivity
        # Reference: Romano A et al. JACI 2004; PMID 15282380
        if allergy_type == AllergyType.ANAPHYLAXIS:
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.CAUTION,
                warning="⚠️ CAUTION: History of penicillin anaphylaxis. Carbapenem cross-reactivity is <1% but use with caution and have emergency medications available. Reference: Romano 2004 (PMID 15282380).",
                cross_reactivity_risk="<1%",
                alternative_recommendations=[
                    "Aztreonam (no beta-lactam cross-reactivity)",
                    "Non-beta-lactam alternative",
                ],
                evidence_source="Romano A et al. J Allergy Clin Immunol 2004;113:401-402",
                evidence="PMID 15282380",
                drug_class="Carbapenem",
                allergy_detail="Penicillin anaphylaxis",
                generation="carbapenem",
                can_use_with_premedication=True,
            )
        else:
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.SAFE,
                warning="NOTE: Carbapenems have <1% cross-reactivity with penicillins and are generally safe to use. Reference: Romano 2004 (PMID 15282380).",
                cross_reactivity_risk="<1%",
                alternative_recommendations=[],
                evidence_source="Romano A et al. J Allergy Clin Immunol 2004;113:401-402",
                evidence="PMID 15282380",
                drug_class="Carbapenem",
                allergy_detail=f"Penicillin {allergy_type.value}",
                generation="carbapenem",
                can_use_with_premedication=False,
            )
    
    # ==========================================================================
    # PROMPT 3 FIX: AZTREONAM FOR PENICILLIN ALLERGY (NO CROSS-REACTIVITY)
    # ==========================================================================
    # Aztreonam has NO cross-reactivity with penicillins (except via ceftazidime)
    # This is because it has a unique R1 side chain not shared with penicillins
    
    if has_penicillin_allergy and is_aztreonam(drug_name) and not has_ceftazidime_allergy:
        # Determine allergy type
        specific_penicillin_allergy = None
        for allergy in normalized_allergies:
            for pen in penicillin_allergies:
                if pen in allergy:
                    specific_penicillin_allergy = allergy
                    break
            if specific_penicillin_allergy:
                break
        
        allergy_type_str = allergy_types.get(specific_penicillin_allergy, "unknown")
        
        return AllergyConflictResult(
            blocked=False,
            severity=ConflictSeverity.SAFE,
            warning="NOTE: Aztreonam has no cross-reactivity with penicillins - safe to use. Exception: if patient also allergic to ceftazidime, aztreonam is contraindicated (shared R1).",
            cross_reactivity_risk="0% (no shared R1 side chain)",
            alternative_recommendations=[],
            evidence_source="Macy E. JAMA Intern Med 2014;174:1630-1638",
            evidence="PMID 25317731",
            drug_class="Monobactam",
            allergy_detail=f"Penicillin {allergy_type_str}",
            generation="monobactam",
            can_use_with_premedication=False,
        )
    
    # ==========================================================================
    # NO CONFLICT FOUND
    # ==========================================================================
    return AllergyConflictResult(
        blocked=False,
        severity=ConflictSeverity.SAFE,
        warning=None,
        cross_reactivity_risk="None identified",
        drug_class=_get_drug_class(drug_name),
        allergy_detail=None,
    )


def _evaluate_penicillin_cephalosporin_conflict(
    drug_name: str,
    generation: Optional[str],
    gen_data: Dict[str, Any],
    allergy_type: AllergyType,
) -> AllergyConflictResult:
    """
    Evaluate cross-reactivity between penicillin allergy and cephalosporin.
    
    Implements evidence-based decision making per:
    - Macy E et al. JAMA Intern Med 2014
    - Romano A et al. J Allergy Clin Immunol 2004
    
    Key evidence:
    - Most reported penicillin allergies are not true IgE-mediated allergies
    - Cross-reactivity is primarily due to shared R1 side chains
    - 1st gen cephalosporins share R1 side chains with some penicillins
    - 3rd/4th/5th gen have different structures with <1% cross-reactivity
    """
    drug_lower = drug_name.lower()
    cross_risk = gen_data.get("cross_reactivity_with_penicillin", "<1%")
    gen_notes = gen_data.get("notes", "")
    
    # Intolerance (GI upset, etc.) - not true allergy
    if allergy_type == AllergyType.INTOLERANCE:
        gen_display = generation.replace("_GEN", "th").lower() if generation else "unknown"
        return AllergyConflictResult(
            blocked=False,
            severity=ConflictSeverity.SAFE,
            warning="NOTE: Reported intolerance (not true allergy) - drug is safe to use",
            cross_reactivity_risk="None (not an immunologic reaction)",
            alternative_recommendations=[],
            evidence_source="Intolerance is not allergy - no cross-reactivity risk",
            drug_class=f"Cephalosporin {generation}",
            allergy_detail="Penicillin intolerance",
            generation=gen_display,
            evidence="N/A (not true allergy)",
            can_use_with_premedication=False,
        )
    
    # Rash (delayed hypersensitivity) - PROMPT 3 FIX: Allow all cephalosporins per Blumenthal 2018
    # Reference: Blumenthal KG et al. JAMA Intern Med 2018;178(8):1118-1119 (PMID 29958014)
    # "Maculopapular rash to penicillin is NOT a contraindication to cephalosporins"
    if allergy_type == AllergyType.RASH:
        gen_display = generation.replace("_GEN", "th").lower() if generation else "unknown"
        if generation == "FIRST_GEN":
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.CAUTION,
                warning=f"NOTE: Maculopapular rash to penicillin is NOT a contraindication to cephalosporins. ~2% cross-reactivity with 1st gen. Per Blumenthal 2018 (PMID 29958014), cephalosporins can be used with standard monitoring.",
                cross_reactivity_risk="~2%",
                alternative_recommendations=[
                    "Cephalosporins are acceptable per evidence",
                    "Monitor for any reaction during first dose",
                ],
                evidence_source="Blumenthal KG et al. JAMA Intern Med 2018;178:1118-1119",
                drug_class="Cephalosporin FIRST_GEN",
                allergy_detail="Penicillin rash",
                generation="1st",
                evidence="PMID 29958014",
                can_use_with_premedication=False,
            )
        elif generation == "SECOND_GEN":
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.CAUTION,
                warning=f"NOTE: Maculopapular rash to penicillin is NOT a contraindication to cephalosporins. ~1% cross-reactivity with 2nd gen. Use with standard monitoring.",
                cross_reactivity_risk="~1%",
                alternative_recommendations=[
                    "Cephalosporins are acceptable per evidence",
                ],
                evidence_source="Blumenthal KG et al. JAMA Intern Med 2018;178:1118-1119",
                drug_class="Cephalosporin SECOND_GEN",
                allergy_detail="Penicillin rash",
                generation="2nd",
                evidence="PMID 29958014",
                can_use_with_premedication=False,
            )
        else:  # THIRD_GEN, FOURTH_GEN, FIFTH_GEN
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.SAFE,
                warning=f"NOTE: Maculopapular rash to penicillin is NOT a contraindication to cephalosporins. <1% cross-reactivity with {gen_display} gen - safe to use per Blumenthal 2018.",
                cross_reactivity_risk="<1%",
                alternative_recommendations=[],
                evidence_source="Blumenthal KG et al. JAMA Intern Med 2018;178:1118-1119",
                drug_class=f"Cephalosporin {generation}",
                allergy_detail="Penicillin rash",
                generation=gen_display,
                evidence="PMID 29958014",
                can_use_with_premedication=False,
            )
    
    # Anaphylaxis (IgE-mediated) - PROMPT 3 FIX: Generation-aware blocking
    # Reference: Macy E et al. JAMA Intern Med 2014; PMID 25317731
    if allergy_type == AllergyType.ANAPHYLAXIS:
        gen_display = generation.replace("_GEN", "th").lower() if generation else "unknown"
        if generation in ["FIRST_GEN", "SECOND_GEN"]:
            return AllergyConflictResult(
                blocked=True,
                severity=ConflictSeverity.CONTRAINDICATED,
                warning=f"⚠️ CONTRAINDICATED: History of penicillin anaphylaxis - avoid {gen_display} generation cephalosporins due to potential shared R1 side chains",
                cross_reactivity_risk="~2% for 1st gen, ~1% for 2nd gen",
                alternative_recommendations=[
                    "3rd/4th/5th generation cephalosporin (<1% risk)",
                    "Aztreonam (no cross-reactivity)",
                    "Carbapenems (<1% cross-reactivity, PMID 15282380)",
                    "Vancomycin",
                ],
                evidence_source="Castells M, et al. N Engl J Med 2019;381:2338-2351",
                drug_class=f"Cephalosporin {generation}",
                allergy_detail="Penicillin anaphylaxis",
                generation=gen_display,
                evidence="PMID 31577035",
                can_use_with_premedication=False,
            )
        else:  # THIRD_GEN, FOURTH_GEN, FIFTH_GEN
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.CAUTION,
                warning=f"⚠️ CAUTION: History of penicillin anaphylaxis. Cross-reactivity with {gen_display} generation is <1%. Safe to use with epinephrine available per Picard 2019.",
                cross_reactivity_risk="<1%",
                alternative_recommendations=[
                    "Aztreonam (no cross-reactivity with penicillins)",
                    "Ensure epinephrine available during first dose",
                    "Consider extended observation period",
                ],
                evidence_source="Picard M, et al. J Allergy Clin Immunol Pract 2019;7:408-414",
                drug_class=f"Cephalosporin {generation}",
                allergy_detail="Penicillin anaphylaxis",
                generation=gen_display,
                evidence="PMID 30717880",
                can_use_with_premedication=True,
            )
    
    # Unknown allergy type - treat conservatively
    if allergy_type == AllergyType.UNKNOWN:
        if generation in ["FIRST_GEN", "SECOND_GEN"]:
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.CAUTION,
                warning=f"⚠️ CAUTION: Unknown allergy type to penicillin. Cross-reactivity risk {cross_risk}. Consider allergy testing or alternative agent.",
                cross_reactivity_risk=cross_risk,
                alternative_recommendations=[
                    "Consider 3rd+ generation cephalosporin",
                    "Aztreonam",
                    "Allergy testing to clarify reaction type",
                ],
                evidence_source="Macy E et al. JAMA Intern Med 2014",
                drug_class=f"Cephalosporin {generation}",
                allergy_detail="Penicillin (unknown type)",
            )
        else:  # THIRD_GEN, FOURTH_GEN, FIFTH_GEN
            return AllergyConflictResult(
                blocked=False,
                severity=ConflictSeverity.SAFE,
                warning=f"NOTE: Unknown penicillin allergy type. Cross-reactivity with {generation.replace('_', ' ').lower()} is {cross_risk}. Generally safe to use.",
                cross_reactivity_risk=cross_risk,
                alternative_recommendations=[],
                evidence_source="Macy E et al. JAMA Intern Med 2014",
                drug_class=f"Cephalosporin {generation}",
                allergy_detail="Penicillin (unknown type)",
            )
    
    # Default fallback (shouldn't reach here)
    return AllergyConflictResult(
        blocked=False,
        severity=ConflictSeverity.CAUTION,
        warning="⚠️ CAUTION: Unable to fully assess cross-reactivity - use clinical judgment",
        cross_reactivity_risk="Unknown",
        drug_class=f"Cephalosporin {generation}",
        allergy_detail="Penicillin allergy",
    )


def _get_drug_class(drug_name: str) -> str:
    """Get the drug class for a given drug name."""
    drug_lower = drug_name.lower()
    
    if is_penicillin(drug_name):
        return "Penicillin"
    elif is_cephalosporin(drug_name):
        gen = get_cephalosporin_generation(drug_name)
        return f"Cephalosporin {gen}" if gen else "Cephalosporin"
    elif is_sulfa_drug(drug_name):
        return "Sulfonamide antibiotic"
    elif any(x in drug_lower for x in ["vanc", "daptomycin", "linezolid"]):
        return "Anti-MRSA agent"
    elif any(x in drug_lower for x in ["fluoroquinolone", "floxacin", "cipro", "levo"]):
        return "Fluoroquinolone"
    elif any(x in drug_lower for x in ["macrolide", "azithro", "erythro", "clarithro"]):
        return "Macrolide"
    elif any(x in drug_lower for x in ["tetra", "doxy"]):
        return "Tetracycline"
    elif any(x in drug_lower for x in ["metro"]):
        return "Nitroimidazole"
    elif any(x in drug_lower for x in ["carbapenem", "merope", "imipe", "ertape", "dori"]):
        return "Carbapenem"
    elif any(x in drug_lower for x in ["aztreonam", "azactam"]):
        return "Monobactam"
    elif any(x in drug_lower for x in ["clinda"]):
        return "Lincosamide"
    else:
        return "Antimicrobial"


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def parse_allergy_input(allergy_string: str) -> tuple[str, str]:
    """
    Parse an allergy string into (allergen, allergy_type).
    
    Supports formats:
    - "penicillin" -> ("penicillin", "unknown")
    - "penicillin:rash" -> ("penicillin", "rash")
    - "penicillin (anaphylaxis)" -> ("penicillin", "anaphylaxis")
    - "penicillin - anaphylaxis" -> ("penicillin", "anaphylaxis")
    """
    allergy_lower = allergy_string.lower().strip()
    
    # Try different delimiters
    for delimiter in [":", " - ", " -", "- ", " (", "(", ")"]:
        if delimiter in allergy_lower:
            parts = allergy_lower.split(delimiter, 1)
            if len(parts) == 2:
                allergen = parts[0].strip()
                allergy_type = parts[1].strip().rstrip(")")
                
                # Normalize allergy type
                if allergy_type in ["intolerance", "rash", "anaphylaxis"]:
                    return (allergen, allergy_type)
                elif "anaphylaxis" in allergy_type or "anaphylactic" in allergy_type:
                    return (allergen, "anaphylaxis")
                elif "rash" in allergy_type or "hives" in allergy_type or "urticaria" in allergy_type:
                    return (allergen, "rash")
                elif "intolerance" in allergy_type or "gi" in allergy_type:
                    return (allergen, "intolerance")
    
    return (allergy_lower, "unknown")


def build_allergy_types_dict(allergies: List[str]) -> Dict[str, str]:
    """
    Build allergy types dictionary from list of allergy strings.
    
    Args:
        allergies: List of allergy strings (may include type info)
        
    Returns:
        Dictionary mapping allergen to allergy type
    """
    allergy_types = {}
    for allergy in allergies:
        allergen, allergy_type = parse_allergy_input(allergy)
        allergy_types[allergen] = allergy_type
    return allergy_types

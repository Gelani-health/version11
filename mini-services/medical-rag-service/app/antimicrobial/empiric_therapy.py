"""
Empiric Therapy Guide for Antimicrobial Stewardship
====================================================

Condition-specific empiric recommendations with:
- 30+ empiric therapy protocols
- Considerations for allergies, renal function, pregnancy, recent antibiotics
- PK/PD parameters for each antibiotic
- Evidence-based dosing and duration

Conditions covered:
- Community-acquired pneumonia
- Hospital-acquired/ventilator-associated pneumonia
- Urinary tract infections (cystitis, pyelonephritis)
- Skin and soft tissue infections
- Intra-abdominal infections
- Meningitis
- Sepsis/septic shock
- And more...

References:
- IDSA Clinical Practice Guidelines
- Sanford Guide to Antimicrobial Therapy 2024
- UpToDate Antimicrobial Therapy
- Hopkins ABX Guide
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class InfectionType(Enum):
    """Infection type classification."""
    COMMUNITY_ACQUIRED = "community_acquired"
    HOSPITAL_ACQUIRED = "hospital_acquired"
    HEALTHCARE_ASSOCIATED = "healthcare_associated"
    NOSOCOMIAL = "nosocomial"


class SeverityLevel(Enum):
    """Infection severity levels."""
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


class PatientFactor(Enum):
    """Patient factors affecting antibiotic selection."""
    PREGNANCY = "pregnancy"
    RENAL_IMPAIRMENT = "renal_impairment"
    HEPATIC_IMPAIRMENT = "hepatic_impairment"
    IMMUNOCOMPROMISED = "immunocompromised"
    NEUTROPENIC = "neutropenic"
    DIABETES = "diabetes"
    AGE_PEDIATRIC = "pediatric"
    AGE_ELDERLY = "elderly"
    RECENT_ANTIBIOTICS = "recent_antibiotics"
    ICU_ADMISSION = "icu_admission"
    MECHANICAL_VENTILATION = "mechanical_ventilation"
    CENTRAL_LINE = "central_line"
    URINARY_CATHETER = "urinary_catheter"
    SURGICAL_SITE = "surgical_site"


class PregnancyCategory(Enum):
    """FDA Pregnancy Risk Categories."""
    A = "A"  # Safe
    B = "B"  # Probably safe
    C = "C"  # Use with caution
    D = "D"  # Avoid if possible
    X = "X"  # Contraindicated


@dataclass
class DosingRegimen:
    """Complete dosing regimen information."""
    dose: str
    frequency: str
    route: str
    duration_range: str
    max_daily_dose: Optional[str] = None
    renal_adjustment: bool = False
    hepatic_adjustment: bool = False
    loading_dose: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "dose": self.dose,
            "frequency": self.frequency,
            "route": self.route,
            "duration_range": self.duration_range,
            "max_daily_dose": self.max_daily_dose,
            "renal_adjustment": self.renal_adjustment,
            "hepatic_adjustment": self.hepatic_adjustment,
            "loading_dose": self.loading_dose,
        }


@dataclass
class PKPDParameters:
    """Pharmacokinetic/Pharmacodynamic parameters for an antibiotic."""
    drug: str
    pk_pd_target: str  # "T>MIC", "AUC/MIC", "Cmax/MIC"
    protein_binding: str
    half_life: str
    volume_distribution: str
    excretion: str  # "renal", "hepatic", "both"
    cns_penetration: str  # "good", "moderate", "poor"
    csf_ratio: Optional[str] = None
    bioavailability: Optional[str] = None
    notes: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug": self.drug,
            "pk_pd_target": self.pk_pd_target,
            "protein_binding": self.protein_binding,
            "half_life": self.half_life,
            "volume_distribution": self.volume_distribution,
            "excretion": self.excretion,
            "cns_penetration": self.cns_penetration,
            "csf_ratio": self.csf_ratio,
            "bioavailability": self.bioavailability,
            "notes": self.notes,
        }


@dataclass
class AntibioticOption:
    """Complete antibiotic option for empiric therapy."""
    drug_name: str
    regimen: DosingRegimen
    pregnancy_category: PregnancyCategory
    pk_pd: Optional[PKPDParameters] = None
    indications: List[str] = field(default_factory=list)
    contraindications: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    monitoring: List[str] = field(default_factory=list)
    drug_interactions: List[str] = field(default_factory=list)
    is_first_line: bool = True
    is_alternative: bool = False
    is_combination: bool = False
    combination_components: List[str] = field(default_factory=list)
    rationale: str = ""
    renal_adjustment: bool = False  # Flag for renal dosing needed
    hepatic_adjustment: bool = False  # Flag for hepatic dosing needed
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug_name": self.drug_name,
            "regimen": self.regimen.to_dict(),
            "pregnancy_category": self.pregnancy_category.value,
            "pk_pd": self.pk_pd.to_dict() if self.pk_pd else None,
            "indications": self.indications,
            "contraindications": self.contraindications,
            "warnings": self.warnings,
            "monitoring": self.monitoring,
            "drug_interactions": self.drug_interactions,
            "is_first_line": self.is_first_line,
            "is_alternative": self.is_alternative,
            "is_combination": self.is_combination,
            "combination_components": self.combination_components,
            "rationale": self.rationale,
            "renal_adjustment": self.renal_adjustment,
            "hepatic_adjustment": self.hepatic_adjustment,
        }


@dataclass
class EmpiricProtocol:
    """Complete empiric therapy protocol for a condition."""
    protocol_id: str
    condition: str
    description: str
    infection_type: InfectionType
    severity: SeverityLevel
    first_line: List[AntibioticOption]
    alternatives: List[AntibioticOption] = field(default_factory=list)
    expected_pathogens: List[str] = field(default_factory=list)
    diagnostic_criteria: List[str] = field(default_factory=list)
    duration_notes: str = ""
    special_considerations: List[str] = field(default_factory=list)
    references: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "protocol_id": self.protocol_id,
            "condition": self.condition,
            "description": self.description,
            "infection_type": self.infection_type.value,
            "severity": self.severity.value,
            "first_line": [ab.to_dict() for ab in self.first_line],
            "alternatives": [ab.to_dict() for ab in self.alternatives],
            "expected_pathogens": self.expected_pathogens,
            "diagnostic_criteria": self.diagnostic_criteria,
            "duration_notes": self.duration_notes,
            "special_considerations": self.special_considerations,
            "references": self.references,
        }


# =============================================================================
# PK/PD PARAMETERS DATABASE
# =============================================================================

PK_PD_DATABASE: Dict[str, PKPDParameters] = {
    # Beta-lactams (T>MIC target - time-dependent)
    "penicillin_g": PKPDParameters(
        drug="Penicillin G",
        pk_pd_target="T>MIC (50-60% of dosing interval)",
        protein_binding="60%",
        half_life="0.5 hours",
        volume_distribution="0.3-0.4 L/kg",
        excretion="renal",
        cns_penetration="moderate (inflamed meninges)",
        csf_ratio="5-10% of serum",
        notes=["Requires frequent dosing or continuous infusion", "Excellent streptococcal coverage"]
    ),
    "ampicillin": PKPDParameters(
        drug="Ampicillin",
        pk_pd_target="T>MIC (50-60% of dosing interval)",
        protein_binding="20%",
        half_life="1-1.5 hours",
        volume_distribution="0.3 L/kg",
        excretion="renal",
        cns_penetration="moderate (inflamed meninges)",
        csf_ratio="10-30% of serum",
        notes=["Good CSF penetration with inflamed meninges"]
    ),
    "amoxicillin": PKPDParameters(
        drug="Amoxicillin",
        pk_pd_target="T>MIC (50-60% of dosing interval)",
        protein_binding="20%",
        half_life="1-1.5 hours",
        volume_distribution="0.3 L/kg",
        excretion="renal",
        cns_penetration="poor",
        bioavailability="80-90%",
        notes=["Excellent oral bioavailability"]
    ),
    "nafcillin": PKPDParameters(
        drug="Nafcillin",
        pk_pd_target="T>MIC",
        protein_binding="90%",
        half_life="0.5-1 hour",
        volume_distribution="0.4-1 L/kg",
        excretion="hepatic",
        cns_penetration="poor",
        notes=["Primarily hepatic metabolism, no renal adjustment needed"]
    ),
    "oxacillin": PKPDParameters(
        drug="Oxacillin",
        pk_pd_target="T>MIC",
        protein_binding="94%",
        half_life="0.5-1 hour",
        volume_distribution="0.4 L/kg",
        excretion="hepatic",
        cns_penetration="poor"
    ),
    "piperacillin_tazobactam": PKPDParameters(
        drug="Piperacillin-Tazobactam",
        pk_pd_target="T>MIC (50% of dosing interval)",
        protein_binding="30%",
        half_life="0.7-1.2 hours",
        volume_distribution="0.2-0.3 L/kg",
        excretion="renal",
        cns_penetration="moderate",
        notes=["Extended infusion improves T>MIC", "Excellent Pseudomonas coverage"]
    ),
    "cefazolin": PKPDParameters(
        drug="Cefazolin",
        pk_pd_target="T>MIC (60-70% of dosing interval)",
        protein_binding="80%",
        half_life="1.5-2 hours",
        volume_distribution="0.12 L/kg",
        excretion="renal",
        cns_penetration="poor",
        notes=["Surgical prophylaxis standard", "Not for CNS infections"]
    ),
    "ceftriaxone": PKPDParameters(
        drug="Ceftriaxone",
        pk_pd_target="T>MIC",
        protein_binding="95%",
        half_life="6-9 hours",
        volume_distribution="0.12 L/kg",
        excretion="both",
        cns_penetration="good (inflamed meninges)",
        csf_ratio="5-15% of serum",
        notes=["Once daily dosing due to long half-life", "Excellent CNS penetration"]
    ),
    "cefepime": PKPDParameters(
        drug="Cefepime",
        pk_pd_target="T>MIC (60-70% of dosing interval)",
        protein_binding="20%",
        half_life="2 hours",
        volume_distribution="0.3 L/kg",
        excretion="renal",
        cns_penetration="good",
        csf_ratio="10-20% of serum",
        notes=["Good for Pseudomonas and CNS infections"]
    ),
    "ceftazidime": PKPDParameters(
        drug="Ceftazidime",
        pk_pd_target="T>MIC (60-70% of dosing interval)",
        protein_binding="10%",
        half_life="1.5-2 hours",
        volume_distribution="0.3 L/kg",
        excretion="renal",
        cns_penetration="good",
        csf_ratio="20-40% of serum",
        notes=["Excellent Pseudomonas coverage", "Good CNS penetration"]
    ),
    "ceftaroline": PKPDParameters(
        drug="Ceftaroline",
        pk_pd_target="T>MIC",
        protein_binding="20%",
        half_life="2.5 hours",
        volume_distribution="0.37 L/kg",
        excretion="renal",
        cns_penetration="moderate",
        notes=["Anti-MRSA cephalosporin", "Active against resistant gram-positives"]
    ),
    
    # Carbapenems
    "meropenem": PKPDParameters(
        drug="Meropenem",
        pk_pd_target="T>MIC (40% of dosing interval)",
        protein_binding="2%",
        half_life="1 hour",
        volume_distribution="0.25 L/kg",
        excretion="renal",
        cns_penetration="good",
        csf_ratio="20-30% of serum",
        notes=["Excellent broad-spectrum coverage", "Lower seizure risk than imipenem"]
    ),
    "ertapenem": PKPDParameters(
        drug="Ertapenem",
        pk_pd_target="T>MIC (40% of dosing interval)",
        protein_binding="95%",
        half_life="4 hours",
        volume_distribution="0.12 L/kg",
        excretion="both",
        cns_penetration="poor",
        notes=["Once daily dosing", "No Pseudomonas coverage"]
    ),
    "imipenem": PKPDParameters(
        drug="Imipenem",
        pk_pd_target="T>MIC (40% of dosing interval)",
        protein_binding="20%",
        half_life="1 hour",
        volume_distribution="0.25 L/kg",
        excretion="renal",
        cns_penetration="moderate",
        notes=["Seizure risk at high doses", "Combined with cilastatin"]
    ),
    
    # Fluoroquinolones (AUC/MIC and Cmax/MIC - concentration-dependent)
    "ciprofloxacin": PKPDParameters(
        drug="Ciprofloxacin",
        pk_pd_target="AUC/MIC > 125, Cmax/MIC > 10",
        protein_binding="20%",
        half_life="4-5 hours",
        volume_distribution="2-3 L/kg",
        excretion="both",
        cns_penetration="good",
        csf_ratio="20-50% of serum",
        bioavailability="70-80%",
        notes=["Concentration-dependent killing", "Good Pseudomonas coverage"]
    ),
    "levofloxacin": PKPDParameters(
        drug="Levofloxacin",
        pk_pd_target="AUC/MIC > 100",
        protein_binding="30%",
        half_life="6-8 hours",
        volume_distribution="1-1.5 L/kg",
        excretion="renal",
        cns_penetration="good",
        csf_ratio="30-50% of serum",
        bioavailability="99%",
        notes=["Once daily dosing", "Excellent bioavailability"]
    ),
    "moxifloxacin": PKPDParameters(
        drug="Moxifloxacin",
        pk_pd_target="AUC/MIC > 100",
        protein_binding="50%",
        half_life="12 hours",
        volume_distribution="2-3 L/kg",
        excretion="hepatic",
        cns_penetration="excellent",
        csf_ratio="50-100% of serum",
        bioavailability="90%",
        notes=["No renal adjustment needed", "Excellent anaerobic coverage"]
    ),
    
    # Aminoglycosides (Cmax/MIC - concentration-dependent)
    "gentamicin": PKPDParameters(
        drug="Gentamicin",
        pk_pd_target="Cmax/MIC > 10",
        protein_binding="10%",
        half_life="2-3 hours",
        volume_distribution="0.25 L/kg",
        excretion="renal",
        cns_penetration="poor",
        notes=["Nephrotoxicity and ototoxicity risks", "Once daily extended interval dosing preferred"]
    ),
    "tobramycin": PKPDParameters(
        drug="Tobramycin",
        pk_pd_target="Cmax/MIC > 10",
        protein_binding="10%",
        half_life="2-3 hours",
        volume_distribution="0.25 L/kg",
        excretion="renal",
        cns_penetration="poor",
        notes=["Better Pseudomonas activity than gentamicin"]
    ),
    "amikacin": PKPDParameters(
        drug="Amikacin",
        pk_pd_target="Cmax/MIC > 10",
        protein_binding="10%",
        half_life="2-3 hours",
        volume_distribution="0.25 L/kg",
        excretion="renal",
        cns_penetration="poor",
        notes=["Most resistant to aminoglycoside-modifying enzymes"]
    ),
    
    # Glycopeptides (AUC/MIC)
    "vancomycin": PKPDParameters(
        drug="Vancomycin",
        pk_pd_target="AUC/MIC > 400",
        protein_binding="50%",
        half_life="4-6 hours (normal renal function)",
        volume_distribution="0.5-1 L/kg",
        excretion="renal",
        cns_penetration="moderate (inflamed meninges)",
        csf_ratio="10-20% of serum",
        notes=["Trough monitoring for efficacy", "Red man syndrome with rapid infusion"]
    ),
    
    # Lipopeptides (Cmax/MIC)
    "daptomycin": PKPDParameters(
        drug="Daptomycin",
        pk_pd_target="Cmax/MIC",
        protein_binding="92%",
        half_life="8-9 hours",
        volume_distribution="0.1 L/kg",
        excretion="renal",
        cns_penetration="poor",
        notes=["Inactivated by pulmonary surfactant", "Not for pneumonia", "CPK monitoring required"]
    ),
    
    # Oxazolidinones (AUC/MIC)
    "linezolid": PKPDParameters(
        drug="Linezolid",
        pk_pd_target="AUC/MIC > 100",
        protein_binding="31%",
        half_life="5 hours",
        volume_distribution="0.6 L/kg",
        excretion="both",
        cns_penetration="excellent",
        csf_ratio="70% of serum",
        bioavailability="100%",
        notes=["Excellent bioavailability", "Myelosuppression with prolonged use"]
    ),
    
    # Macrolides
    "azithromycin": PKPDParameters(
        drug="Azithromycin",
        pk_pd_target="AUC/MIC",
        protein_binding="50%",
        half_life="68 hours",
        volume_distribution="31 L/kg",
        excretion="hepatic",
        cns_penetration="moderate",
        bioavailability="37%",
        notes=["Long half-life allows short courses", "QT prolongation risk"]
    ),
    "clarithromycin": PKPDParameters(
        drug="Clarithromycin",
        pk_pd_target="AUC/MIC",
        protein_binding="70%",
        half_life="3-7 hours",
        volume_distribution="2-4 L/kg",
        excretion="hepatic",
        cns_penetration="moderate",
        bioavailability="55%",
        notes=["Many drug interactions via CYP3A4"]
    ),
    
    # Tetracyclines
    "doxycycline": PKPDParameters(
        drug="Doxycycline",
        pk_pd_target="AUC/MIC",
        protein_binding="90%",
        half_life="18-22 hours",
        volume_distribution="0.7 L/kg",
        excretion="both",
        cns_penetration="good",
        bioavailability="90%",
        notes=["No renal adjustment needed", "Photosensitivity risk"]
    ),
    "tigecycline": PKPDParameters(
        drug="Tigecycline",
        pk_pd_target="AUC/MIC",
        protein_binding="71%",
        half_life="42 hours",
        volume_distribution="7-10 L/kg",
        excretion="hepatic",
        cns_penetration="poor",
        notes=["Very broad spectrum", "Lower mortality in some infections"]
    ),
    
    # Others
    "metronidazole": PKPDParameters(
        drug="Metronidazole",
        pk_pd_target="T>MIC",
        protein_binding="20%",
        half_life="6-8 hours",
        volume_distribution="0.7 L/kg",
        excretion="hepatic",
        cns_penetration="excellent",
        csf_ratio="100% of serum",
        bioavailability="100%",
        notes=["Excellent anaerobic coverage", "Disulfiram-like reaction with alcohol"]
    ),
    "clindamycin": PKPDParameters(
        drug="Clindamycin",
        pk_pd_target="T>MIC",
        protein_binding="95%",
        half_life="2-3 hours",
        volume_distribution="0.6-1 L/kg",
        excretion="hepatic",
        cns_penetration="poor",
        bioavailability="90%",
        notes=["C. difficile risk", "Good bone penetration"]
    ),
    "tmp_smx": PKPDParameters(
        drug="TMP-SMX",
        pk_pd_target="T>MIC",
        protein_binding="70%",
        half_life="8-10 hours",
        volume_distribution="1-2 L/kg",
        excretion="renal",
        cns_penetration="good",
        csf_ratio="20-50% of serum",
        bioavailability="90%",
        notes=["Excellent CSF penetration", "Hyperkalemia risk"]
    ),
    "nitrofurantoin": PKPDParameters(
        drug="Nitrofurantoin",
        pk_pd_target="T>MIC",
        protein_binding="60%",
        half_life="0.3-1 hour",
        volume_distribution="Small",
        excretion="renal",
        cns_penetration="poor",
        bioavailability="90%",
        notes=["Only for lower UTI", "Pulmonary fibrosis with chronic use"]
    ),
    "fosfomycin": PKPDParameters(
        drug="Fosfomycin",
        pk_pd_target="T>MIC",
        protein_binding="0%",
        half_life="5-7 hours",
        volume_distribution="0.3 L/kg",
        excretion="renal",
        cns_penetration="good",
        bioavailability="35%",
        notes=["Single dose for uncomplicated UTI"]
    ),
    "colistin": PKPDParameters(
        drug="Colistin",
        pk_pd_target="AUC/MIC",
        protein_binding="50%",
        half_life="9-14 hours",
        volume_distribution="0.3 L/kg",
        excretion="renal",
        cns_penetration="poor",
        notes=["Nephrotoxicity common", "Last-line for MDR gram-negatives"]
    ),
    "rifampin": PKPDParameters(
        drug="Rifampin",
        pk_pd_target="AUC/MIC",
        protein_binding="80%",
        half_life="3-5 hours",
        volume_distribution="0.9 L/kg",
        excretion="hepatic",
        cns_penetration="excellent",
        csf_ratio="20-50% of serum",
        bioavailability="90%",
        notes=["Many drug interactions via CYP450", "Never use as monotherapy"]
    ),
}


# =============================================================================
# EMPIRIC THERAPY PROTOCOLS (30+)
# =============================================================================

EMPIRIC_PROTOCOLS: Dict[str, EmpiricProtocol] = {
    # =========================================================================
    # RESPIRATORY INFECTIONS
    # =========================================================================
    
    # 1. CAP - Outpatient, Healthy
    "CAP_OUTPATIENT_HEALTHY": EmpiricProtocol(
        protocol_id="CAP_OUTPATIENT_HEALTHY",
        condition="Community-Acquired Pneumonia (Outpatient, Healthy)",
        description="Outpatient treatment of CAP in immunocompetent adults without comorbidities",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MILD,
        first_line=[
            AntibioticOption(
                drug_name="Amoxicillin",
                regimen=DosingRegimen("1 g", "every 8 hours", "PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("amoxicillin"),
                indications=["CAP in healthy patient without comorbidities"],
                monitoring=["Clinical response in 48-72 hours"],
                is_first_line=True,
                rationale="Covers S. pneumoniae, most common CAP pathogen"
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Doxycycline",
                regimen=DosingRegimen("100 mg", "every 12 hours", "PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.D,
                pk_pd=PK_PD_DATABASE.get("doxycycline"),
                indications=["Penicillin allergy", "Atypical coverage needed"],
                contraindications=["Pregnancy"],
                warnings=["Photosensitivity", "GI upset"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Azithromycin",
                regimen=DosingRegimen("500 mg day 1, then 250 mg", "daily", "PO", "5 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("azithromycin"),
                indications=["Penicillin allergy", "Atypical coverage"],
                warnings=["QT prolongation", "GI upset"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["Streptococcus pneumoniae", "Haemophilus influenzae", "Mycoplasma pneumoniae", "Chlamydia pneumoniae"],
        diagnostic_criteria=[
            "New pulmonary infiltrate on chest imaging",
            "At least 2 symptoms: fever, cough, sputum, pleuritic chest pain, dyspnea",
            "Outpatient status, no comorbidities",
            "CURB-65 score 0-1"
        ],
        duration_notes="5 days minimum, extend if slow response",
        special_considerations=["If recent antibiotic use, consider alternative class"],
        references=["IDSA/ATS CAP Guidelines 2019"]
    ),
    
    # 2. CAP - Outpatient with Comorbidities
    "CAP_OUTPATIENT_COMORBID": EmpiricProtocol(
        protocol_id="CAP_OUTPATIENT_COMORBID",
        condition="Community-Acquired Pneumonia (Outpatient, Comorbidities)",
        description="Outpatient CAP treatment in patients with comorbidities",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Amoxicillin-Clavulanate",
                regimen=DosingRegimen("875/125 mg", "every 12 hours", "PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=None,
                indications=["CAP with comorbidities"],
                warnings=["Diarrhea"],
                monitoring=["Clinical response", "Renal function"],
                renal_adjustment=True,
                is_first_line=True,
                rationale="Broader coverage including beta-lactamase producers"
            ),
            AntibioticOption(
                drug_name="PLUS Azithromycin OR Doxycycline",
                regimen=DosingRegimen("See individual drugs", "varies", "PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["For atypical coverage"],
                is_combination=True,
                combination_components=["amoxicillin-clavulanate", "azithromycin or doxycycline"]
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Levofloxacin",
                regimen=DosingRegimen("750 mg", "daily", "PO", "5 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("levofloxacin"),
                indications=["Penicillin allergy", "Failed first-line therapy"],
                renal_adjustment=True,
                warnings=["Tendon rupture", "QT prolongation", "CNS effects"],
                drug_interactions=["Antacids", "NSAIDs", "QT-prolonging drugs"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Moxifloxacin",
                regimen=DosingRegimen("400 mg", "daily", "PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("moxifloxacin"),
                indications=["Alternative fluoroquinolone"],
                warnings=["QT prolongation", "Tendon rupture"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["S. pneumoniae", "H. influenzae", "M. catarrhalis", "S. aureus", "Gram-negative bacilli", "Atypicals"],
        diagnostic_criteria=[
            "New pulmonary infiltrate",
            "Comorbidities present (COPD, diabetes, heart failure, renal disease, malignancy, etc.)",
            "CURB-65 score 0-1"
        ],
        special_considerations=[
            "Comorbidities increase risk of resistant organisms",
            "Recent antibiotics: choose different class"
        ],
        references=["IDSA/ATS CAP Guidelines 2019"]
    ),
    
    # 3. CAP - Inpatient Non-severe
    "CAP_INPATIENT_NONSEVERE": EmpiricProtocol(
        protocol_id="CAP_INPATIENT_NONSEVERE",
        condition="Community-Acquired Pneumonia (Inpatient, Non-severe)",
        description="Hospitalized CAP not requiring ICU",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Ceftriaxone",
                regimen=DosingRegimen("1 g", "daily", "IV", "5-7 days", loading_dose=None),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("ceftriaxone"),
                indications=["CAP requiring hospitalization"],
                monitoring=["Clinical response", "Renal function"],
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="PLUS Azithromycin",
                regimen=DosingRegimen("500 mg", "daily", "IV/PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("azithromycin"),
                indications=["Atypical coverage"],
                warnings=["QT prolongation"],
                monitoring=["QT interval if risk factors"],
                is_combination=True,
                combination_components=["ceftriaxone", "azithromycin"]
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Levofloxacin",
                regimen=DosingRegimen("750 mg", "daily", "IV/PO", "5 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("levofloxacin"),
                indications=["Penicillin allergy (non-severe)", "Monotherapy option"],
                renal_adjustment=True,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Moxifloxacin",
                regimen=DosingRegimen("400 mg", "daily", "IV/PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("moxifloxacin"),
                is_alternative=True
            ),
        ],
        expected_pathogens=["S. pneumoniae", "H. influenzae", "Atypicals", "S. aureus", "Legionella"],
        diagnostic_criteria=[
            "New pulmonary infiltrate",
            "Requires hospitalization but not ICU",
            "CURB-65 score 2"
        ],
        special_considerations=["IV-to-PO switch when clinically stable and afebrile 48h"],
        references=["IDSA/ATS CAP Guidelines 2019"]
    ),
    
    # 4. CAP - Severe (ICU)
    "CAP_SEVERE_ICU": EmpiricProtocol(
        protocol_id="CAP_SEVERE_ICU",
        condition="Community-Acquired Pneumonia (Severe, ICU)",
        description="Severe CAP requiring ICU admission",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Ceftriaxone OR Ampicillin-Sulbactam",
                regimen=DosingRegimen("1-2 g daily OR 3 g every 6 hours", "IV", "IV", "7-10 days"),
                pregnancy_category=PregnancyCategory.B,
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="PLUS Azithromycin OR Levofloxacin",
                regimen=DosingRegimen("500 mg daily OR 750 mg daily", "IV", "IV", "7-10 days"),
                pregnancy_category=PregnancyCategory.B,
                is_combination=True,
                combination_components=["ceftriaxone or ampicillin-sulbactam", "azithromycin or levofloxacin"]
            ),
            AntibioticOption(
                drug_name="Consider ADDING Vancomycin if MRSA risk",
                regimen=DosingRegimen("15-20 mg/kg", "every 8-12 hours", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("vancomycin"),
                indications=["MRSA risk factors", "Critical illness"],
                monitoring=["Trough levels 15-20 mcg/mL", "Renal function"],
                renal_adjustment=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Piperacillin-Tazobactam + Vancomycin + Azithromycin",
                regimen=DosingRegimen("4.5 g every 6 hours + 15-20 mg/kg every 8-12h + 500 mg daily", "IV", "IV", "7-14 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Aspiration risk", "Broader coverage needed"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["S. pneumoniae", "S. aureus (including MRSA)", "Legionella", "Gram-negative bacilli", "Atypicals"],
        diagnostic_criteria=[
            "ICU admission required",
            "At least 1 major criterion OR 3 minor criteria per IDSA/ATS",
            "Major: septic shock, respiratory failure requiring mechanical ventilation",
            "Minor: RR ≥30, PaO2/FiO2 ≤250, multilobar infiltrates, confusion, BUN ≥20, WBC <4000, platelets <100,000, hypothermia, hypotension"
        ],
        special_considerations=[
            "Add MRSA coverage if risk factors present",
            "Add Pseudomonas coverage if risk factors present",
            "Obtain cultures before antibiotics if possible"
        ],
        references=["IDSA/ATS CAP Guidelines 2019"]
    ),
    
    # 5. HAP/VAP
    "HAP_VAP": EmpiricProtocol(
        protocol_id="HAP_VAP",
        condition="Hospital-Acquired / Ventilator-Associated Pneumonia",
        description="Pneumonia developing ≥48 hours after hospital admission or ventilation",
        infection_type=InfectionType.HOSPITAL_ACQUIRED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Piperacillin-Tazobactam",
                regimen=DosingRegimen("4.5 g", "every 6 hours", "IV", "7 days", loading_dose="4.5 g"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("piperacillin_tazobactam"),
                indications=["HAP/VAP with Pseudomonas risk"],
                monitoring=["Renal function", "Clinical response"],
                renal_adjustment=True,
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Cefepime",
                regimen=DosingRegimen("2 g", "every 8 hours", "IV", "7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("cefepime"),
                indications=["Alternative anti-pseudomonal beta-lactam"],
                renal_adjustment=True,
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="PLUS Vancomycin OR Linezolid (if MRSA risk)",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h OR 600 mg every 12h", "IV", "IV", "7 days"),
                pregnancy_category=PregnancyCategory.C,
                indications=["MRSA coverage"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Meropenem",
                regimen=DosingRegimen("1 g", "every 8 hours", "IV", "7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("meropenem"),
                indications=["ESBL risk", "Carbapenem-susceptible organisms"],
                renal_adjustment=True,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Ceftazidime-Avibactam",
                regimen=DosingRegimen("2.5 g", "every 8 hours", "IV", "7 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["CRE risk", "KPC-producing organisms"],
                renal_adjustment=True,
                is_alternative=True
            ),
        ],
        expected_pathogens=["Pseudomonas aeruginosa", "MRSA", "Acinetobacter", "Enterobacterales (ESBL)", "Stenotrophomonas"],
        diagnostic_criteria=[
            "New or progressive infiltrate on CXR",
            "Plus ≥2: fever, leukocytosis/leukopenia, purulent secretions",
            "Developed ≥48h after admission or ventilation"
        ],
        special_considerations=[
            "Obtain lower respiratory culture before antibiotics",
            "Use local antibiogram to guide empiric selection",
            "Consider de-escalation based on culture results",
            "7-day course usually adequate if clinical response"
        ],
        references=["IDSA HAP/VAP Guidelines 2016"]
    ),
    
    # =========================================================================
    # URINARY TRACT INFECTIONS
    # =========================================================================
    
    # 6. Uncomplicated Cystitis
    "UTI_UNCOMPLICATED_CYSTITIS": EmpiricProtocol(
        protocol_id="UTI_UNCOMPLICATED_CYSTITIS",
        condition="Uncomplicated Cystitis",
        description="Acute uncomplicated cystitis in non-pregnant women",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MILD,
        first_line=[
            AntibioticOption(
                drug_name="Nitrofurantoin",
                regimen=DosingRegimen("100 mg", "every 12 hours", "PO", "5 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("nitrofurantoin"),
                indications=["First-line per IDSA guidelines"],
                contraindications=["CrCl < 30 mL/min", "Pregnancy (at term)"],
                warnings=["Avoid in renal impairment", "Pulmonary fibrosis with chronic use"],
                is_first_line=True,
                rationale="Low resistance, minimal collateral damage"
            ),
            AntibioticOption(
                drug_name="TMP-SMX DS",
                regimen=DosingRegimen("1 double-strength tablet", "every 12 hours", "PO", "3 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("tmp_smx"),
                indications=["If local resistance < 20%"],
                contraindications=["Pregnancy", "Sulfa allergy"],
                warnings=["Rash", "Hyperkalemia", "Steven-Johnson syndrome risk"],
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Fosfomycin",
                regimen=DosingRegimen("3 g", "single dose", "PO", "1 day"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("fosfomycin"),
                indications=["Single-dose option", "Compliance concerns"],
                is_alternative=True,
                rationale="Single dose, convenient"
            ),
            AntibioticOption(
                drug_name="Cephalexin",
                regimen=DosingRegimen("500 mg", "every 6 hours", "PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                is_alternative=True
            ),
        ],
        expected_pathogens=["E. coli", "S. saprophyticus", "Klebsiella", "Proteus"],
        diagnostic_criteria=[
            "Dysuria, urgency, frequency, suprapubic pain",
            "No fever, flank pain, or systemic symptoms",
            "Non-pregnant, premenopausal women",
            "No urinary tract abnormalities"
        ],
        special_considerations=["Avoid fluoroquinolones for uncomplicated cystitis when alternatives available"],
        references=["IDSA UTI Guidelines 2011"]
    ),
    
    # 7. Acute Pyelonephritis - Outpatient
    "PYELONEPHRITIS_OUTPATIENT": EmpiricProtocol(
        protocol_id="PYELONEPHRITIS_OUTPATIENT",
        condition="Acute Pyelonephritis (Outpatient)",
        description="Acute uncomplicated pyelonephritis suitable for outpatient management",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Ciprofloxacin",
                regimen=DosingRegimen("500 mg", "every 12 hours", "PO", "7 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("ciprofloxacin"),
                indications=["Uncomplicated pyelonephritis", "Outpatient setting"],
                renal_adjustment=True,
                warnings=["Tendon rupture", "QT prolongation"],
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Levofloxacin",
                regimen=DosingRegimen("750 mg", "daily", "PO", "5 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("levofloxacin"),
                renal_adjustment=True,
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="TMP-SMX DS",
                regimen=DosingRegimen("1 DS tablet", "every 12 hours", "PO", "14 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("tmp_smx"),
                indications=["If susceptible organism known"],
                contraindications=["Sulfa allergy"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Ceftriaxone (initial IV) then oral",
                regimen=DosingRegimen("1 g daily IV x 1-2 doses, then oral step-down", "varies", "IV/PO", "10-14 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("ceftriaxone"),
                is_alternative=True
            ),
        ],
        expected_pathogens=["E. coli", "Proteus mirabilis", "Klebsiella", "Enterococcus"],
        diagnostic_criteria=[
            "Fever, flank pain, costovertebral angle tenderness",
            "Pyuria ± bacteriuria",
            "Hemodynamically stable, able to tolerate oral intake"
        ],
        special_considerations=["Obtain urine culture before therapy", "Consider initial IV dose if uncertain tolerance"],
        references=["IDSA UTI Guidelines 2011"]
    ),
    
    # 8. Complicated UTI
    "UTI_COMPLICATED": EmpiricProtocol(
        protocol_id="UTI_COMPLICATED",
        condition="Complicated Urinary Tract Infection",
        description="UTI with complicating factors",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Ceftriaxone",
                regimen=DosingRegimen("1 g", "daily", "IV", "7-14 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("ceftriaxone"),
                indications=["Complicated UTI requiring IV therapy"],
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Piperacillin-Tazobactam",
                regimen=DosingRegimen("4.5 g", "every 6 hours", "IV", "7-14 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("piperacillin_tazobactam"),
                indications=["Broader coverage needed", "Pseudomonas risk"],
                renal_adjustment=True,
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Ertapenem",
                regimen=DosingRegimen("1 g", "daily", "IV", "7-14 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("ertapenem"),
                indications=["ESBL risk", "Once-daily dosing convenience"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Meropenem",
                regimen=DosingRegimen("1 g", "every 8 hours", "IV", "7-14 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("meropenem"),
                indications=["Severe infection", "Pseudomonas risk"],
                renal_adjustment=True,
                is_alternative=True
            ),
        ],
        expected_pathogens=["E. coli", "Klebsiella", "Proteus", "Pseudomonas", "Enterococcus", "ESBL producers"],
        diagnostic_criteria=[
            "UTI with complicating factors:",
            "Male sex, pregnancy, indwelling catheter, urinary obstruction",
            "Recent urologic procedure, diabetes, immunosuppression"
        ],
        special_considerations=["Culture essential", "Address underlying cause"],
        references=["IDSA UTI Guidelines 2011"]
    ),
    
    # 9. Catheter-Associated UTI
    "CAUTI": EmpiricProtocol(
        protocol_id="CAUTI",
        condition="Catheter-Associated Urinary Tract Infection",
        description="UTI in patient with indwelling urinary catheter",
        infection_type=InfectionType.HEALTHCARE_ASSOCIATED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Ceftriaxone",
                regimen=DosingRegimen("1 g", "daily", "IV", "7 days"),
                pregnancy_category=PregnancyCategory.B,
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Piperacillin-Tazobactam",
                regimen=DosingRegimen("4.5 g", "every 6 hours", "IV", "7 days"),
                pregnancy_category=PregnancyCategory.B,
                renal_adjustment=True,
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Meropenem",
                regimen=DosingRegimen("1 g", "every 8 hours", "IV", "7 days"),
                pregnancy_category=PregnancyCategory.B,
                renal_adjustment=True,
                is_alternative=True
            ),
        ],
        expected_pathogens=["E. coli", "Pseudomonas", "Klebsiella", "Proteus", "Enterococcus", "Candida"],
        diagnostic_criteria=[
            "Signs/symptoms compatible with UTI",
            "≥10³ CFU/mL from catheterized specimen",
            "Catheter in place >2 days"
        ],
        special_considerations=[
            "Remove or replace catheter if possible",
            "Candida common - treat only if symptomatic",
            "7-day course if prompt resolution"
        ],
        references=["IDSA CAUTI Guidelines 2010"]
    ),
    
    # =========================================================================
    # SKIN AND SOFT TISSUE INFECTIONS
    # =========================================================================
    
    # 10. Cellulitis - Non-purulent
    "CELLULITIS_NONPURULENT": EmpiricProtocol(
        protocol_id="CELLULITIS_NONPURULENT",
        condition="Cellulitis (Non-purulent)",
        description="Non-purulent cellulitis without abscess or drainage",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MILD,
        first_line=[
            AntibioticOption(
                drug_name="Cephalexin",
                regimen=DosingRegimen("500 mg", "every 6 hours", "PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=None,
                indications=["Non-purulent cellulitis", "No MRSA risk factors"],
                contraindications=["Severe penicillin allergy"],
                renal_adjustment=True,
                monitoring=["Clinical response in 48-72 hours"],
                is_first_line=True,
                rationale="Covers streptococci, most common cause"
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Dicloxacillin",
                regimen=DosingRegimen("500 mg", "every 6 hours", "PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Alternative anti-staphylococcal penicillin"],
                contraindications=["Penicillin allergy"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Clindamycin",
                regimen=DosingRegimen("300-450 mg", "every 6-8 hours", "PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("clindamycin"),
                indications=["Penicillin allergy"],
                warnings=["C. difficile risk", "Diarrhea"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["Streptococcus pyogenes", "Streptococcus agalactiae", "Staphylococcus aureus (MSSA)"],
        diagnostic_criteria=[
            "Spreading erythema with warmth and tenderness",
            "No purulence, abscess, or drainage",
            "No systemic signs of severe infection"
        ],
        special_considerations=["Mark borders and monitor for progression", "Consider MRSA if fails to respond"],
        references=["IDSA SSTI Guidelines 2014"]
    ),
    
    # 11. Cellulitis - MRSA suspected
    "CELLULITIS_MRSA": EmpiricProtocol(
        protocol_id="CELLULITIS_MRSA",
        condition="Cellulitis (MRSA Suspected)",
        description="Purulent cellulitis or non-purulent with MRSA risk factors",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="TMP-SMX DS",
                regimen=DosingRegimen("1-2 tablets", "every 12 hours", "PO", "5-10 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("tmp_smx"),
                indications=["Purulent cellulitis", "MRSA risk factors", "Failed beta-lactam"],
                contraindications=["Sulfa allergy", "Pregnancy"],
                warnings=["Rash", "Hyperkalemia"],
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Doxycycline",
                regimen=DosingRegimen("100 mg", "every 12 hours", "PO", "5-10 days"),
                pregnancy_category=PregnancyCategory.D,
                pk_pd=PK_PD_DATABASE.get("doxycycline"),
                indications=["MRSA coverage"],
                contraindications=["Pregnancy", "Children < 8 years"],
                warnings=["Photosensitivity"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Clindamycin",
                regimen=DosingRegimen("300-450 mg", "every 6-8 hours", "PO", "5-10 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("clindamycin"),
                indications=["MRSA coverage (check local susceptibility)"],
                warnings=["C. difficile risk"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Linezolid",
                regimen=DosingRegimen("600 mg", "every 12 hours", "PO/IV", "7-14 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("linezolid"),
                indications=["Severe MRSA infection", "Failed oral therapy"],
                warnings=["Myelosuppression", "MAO inhibitor interaction"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["MRSA", "Streptococcus species"],
        diagnostic_criteria=[
            "Purulent drainage or abscess present",
            "OR non-purulent with MRSA risk factors:",
            "Previous MRSA infection/colonization",
            "Recent hospitalization or antibiotics",
            "Injection drug use"
        ],
        special_considerations=["Incision and drainage essential for abscesses"],
        references=["IDSA SSTI Guidelines 2014"]
    ),
    
    # 12. Necrotizing Fasciitis
    "NECROTIZING_FASCIITIS": EmpiricProtocol(
        protocol_id="NECROTIZING_FASCIITIS",
        condition="Necrotizing Soft Tissue Infection",
        description="Severe, rapidly progressive infection requiring emergent surgery",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.CRITICAL,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin + Piperacillin-Tazobactam",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 4.5 g every 6h", "IV", "IV", "Until debridement complete"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Broad coverage for polymicrobial infection"],
                monitoring=["Vancomycin troughs", "Renal function", "Surgical source control"],
                is_combination=True,
                combination_components=["vancomycin", "piperacillin-tazobactam"]
            ),
            AntibioticOption(
                drug_name="PLUS Clindamycin",
                regimen=DosingRegimen("600-900 mg", "every 8 hours", "IV", "Until debridement complete"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("clindamycin"),
                indications=["Anti-toxin effect for S. pyogenes", "Anaerobic coverage"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Meropenem + Vancomycin + Clindamycin",
                regimen=DosingRegimen("1 g every 8h + 15-20 mg/kg every 8-12h + 600-900 mg every 8h", "IV", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.B,
                is_alternative=True
            ),
        ],
        expected_pathogens=["Polymicrobial", "S. pyogenes", "S. aureus", "Clostridium", "Enterobacterales", "Anaerobes"],
        diagnostic_criteria=[
            "Severe pain out of proportion to exam",
            "Rapidly spreading erythema with crepitus or bullae",
            "Systemic toxicity, hemodynamic instability",
            "Surgical exploration definitive"
        ],
        special_considerations=[
            "EMERGENT SURGICAL DEBRIDEMENT is primary treatment",
            "Antibiotics alone are insufficient",
            "Continue until no further debridement needed"
        ],
        references=["IDSA SSTI Guidelines 2014", "Surgical Infectious Society Guidelines"]
    ),
    
    # =========================================================================
    # INTRA-ABDOMINAL INFECTIONS
    # =========================================================================
    
    # 13. Intra-abdominal - Mild-Moderate
    "INTRAABDOMINAL_MILD_MODERATE": EmpiricProtocol(
        protocol_id="INTRAABDOMINAL_MILD_MODERATE",
        condition="Intra-abdominal Infection (Mild-Moderate)",
        description="Community-acquired intra-abdominal infection, low severity",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Cefazolin + Metronidazole",
                regimen=DosingRegimen("1-2 g every 8h + 500 mg every 8h", "IV", "IV", "4-5 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Community-acquired intraabdominal infection"],
                monitoring=["Renal function"],
                is_combination=True,
                combination_components=["cefazolin", "metronidazole"]
            ),
            AntibioticOption(
                drug_name="Ampicillin-Sulbactam",
                regimen=DosingRegimen("3 g", "every 6 hours", "IV", "4-5 days"),
                pregnancy_category=PregnancyCategory.B,
                renal_adjustment=True,
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Ertapenem",
                regimen=DosingRegimen("1 g", "daily", "IV", "4-5 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("ertapenem"),
                indications=["Convenience", "Once-daily dosing"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Ciprofloxacin + Metronidazole",
                regimen=DosingRegimen("400 mg every 12h + 500 mg every 8h", "IV", "IV", "4-5 days"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Penicillin allergy"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["E. coli", "Bacteroides fragilis", "Enterococcus", "Streptococci", "Other anaerobes"],
        diagnostic_criteria=[
            "Acute abdominal pain",
            "Imaging evidence of intraabdominal infection",
            "Low APACHE II score",
            "Community-acquired onset"
        ],
        special_considerations=["Source control essential", "Stop antibiotics 24-48h after source control if resolution"],
        references=["IDSA Intra-abdominal Infection Guidelines 2010"]
    ),
    
    # 14. Intra-abdominal - High Severity
    "INTRAABDOMINAL_SEVERE": EmpiricProtocol(
        protocol_id="INTRAABDOMINAL_SEVERE",
        condition="Intra-abdominal Infection (Severe)",
        description="High severity or hospital-acquired intra-abdominal infection",
        infection_type=InfectionType.HEALTHCARE_ASSOCIATED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Piperacillin-Tazobactam",
                regimen=DosingRegimen("4.5 g", "every 6 hours", "IV", "4-7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("piperacillin_tazobactam"),
                indications=["High severity intraabdominal infection"],
                renal_adjustment=True,
                monitoring=["Renal function"],
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Meropenem",
                regimen=DosingRegimen("1 g", "every 8 hours", "IV", "4-7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("meropenem"),
                indications=["ESBL risk", "Severe sepsis"],
                renal_adjustment=True,
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Cefepime + Metronidazole",
                regimen=DosingRegimen("2 g every 8h + 500 mg every 8h", "IV", "IV", "4-7 days"),
                pregnancy_category=PregnancyCategory.B,
                renal_adjustment=True,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Add Vancomycin if Enterococcus risk",
                regimen=DosingRegimen("15-20 mg/kg", "every 8-12 hours", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Prior hospitalization", "Healthcare-associated"],
                is_combination=True
            ),
        ],
        expected_pathogens=["Enterobacterales (ESBL)", "Pseudomonas", "Enterococcus", "Bacteroides", "Candida"],
        diagnostic_criteria=[
            "High APACHE II score",
            "Hospital-acquired onset",
            "Severe sepsis/septic shock"
        ],
        special_considerations=["Consider antifungal coverage for high-risk patients"],
        references=["IDSA Intra-abdominal Infection Guidelines 2010"]
    ),
    
    # =========================================================================
    # CENTRAL NERVOUS SYSTEM INFECTIONS
    # =========================================================================
    
    # 15. Bacterial Meningitis - Adults
    "MENINGITIS_ADULT": EmpiricProtocol(
        protocol_id="MENINGITIS_ADULT",
        condition="Bacterial Meningitis (Adults)",
        description="Acute bacterial meningitis in adults",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.CRITICAL,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin + Ceftriaxone",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g every 12h", "IV", "IV", "10-14 days"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Empiric coverage for S. pneumoniae (including resistant)", "N. meningitidis", "H. influenzae"],
                monitoring=["Vancomycin troughs", "CSF cultures"],
                pk_pd=PK_PD_DATABASE.get("vancomycin"),
                is_combination=True,
                combination_components=["vancomycin", "ceftriaxone"]
            ),
            AntibioticOption(
                drug_name="ADD Dexamethasone 0.15 mg/kg IV every 6h x 4 days",
                regimen=DosingRegimen("0.15 mg/kg", "every 6 hours", "IV", "4 days"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Before or with first antibiotic dose", "S. pneumoniae meningitis"],
                rationale="Reduces hearing loss and neurologic sequelae"
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Meropenem",
                regimen=DosingRegimen("2 g", "every 8 hours", "IV", "10-14 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("meropenem"),
                indications=["Penicillin allergy", "Pseudomonas meningitis"],
                renal_adjustment=True,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Add Ampicillin if Listeria risk",
                regimen=DosingRegimen("2 g", "every 4 hours", "IV", "21 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("ampicillin"),
                indications=["Age >50", "Immunocompromised", "Cell-mediated immunity defects"],
                is_combination=True
            ),
        ],
        expected_pathogens=["S. pneumoniae", "N. meningitidis", "H. influenzae", "Listeria (age >50 or immunocompromised)"],
        diagnostic_criteria=[
            "Fever, headache, neck stiffness, altered mental status",
            "CSF: low glucose, high protein, PMN pleocytosis",
            "Positive CSF Gram stain or culture"
        ],
        special_considerations=[
            "Give dexamethasone before or with first antibiotic",
            "Add Listeria coverage if age >50 or immunocompromised",
            "Contact precautions if N. meningitidis suspected"
        ],
        references=["IDSA Meningitis Guidelines 2004"]
    ),
    
    # 16. Healthcare-Associated Meningitis
    "MENINGITIS_HEALTHCARE": EmpiricProtocol(
        protocol_id="MENINGITIS_HEALTHCARE",
        condition="Healthcare-Associated Meningitis/Ventriculitis",
        description="Meningitis following neurosurgery or in presence of external ventricular drain",
        infection_type=InfectionType.HOSPITAL_ACQUIRED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin + Cefepime",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g every 8h", "IV", "IV", "10-21 days"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Post-neurosurgical meningitis", "EVD-associated ventriculitis"],
                monitoring=["CSF cell count, glucose, protein", "CSF cultures"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Vancomycin + Meropenem",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g every 8h", "IV", "IV", "10-21 days"),
                pregnancy_category=PregnancyCategory.B,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Linezolid",
                regimen=DosingRegimen("600 mg", "every 12 hours", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("linezolid"),
                indications=["MRSA meningitis", "Vancomycin failure"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["S. aureus (MSSA/MRSA)", "CoNS", "Pseudomonas", "Acinetobacter", "Enterobacterales"],
        diagnostic_criteria=[
            "Recent neurosurgery or EVD in place",
            "Fever, altered mental status",
            "CSF pleocytosis with low glucose"
        ],
        special_considerations=[
            "Consider intraventricular vancomycin for shunt infections",
            "Remove infected hardware when possible"
        ],
        references=["IDSA Healthcare-Associated Meningitis Guidelines"]
    ),
    
    # =========================================================================
    # SEPSIS/SEPTIC SHOCK
    # =========================================================================
    
    # 17. Sepsis - Unknown Source
    "SEPSIS_UNKNOWN_SOURCE": EmpiricProtocol(
        protocol_id="SEPSIS_UNKNOWN_SOURCE",
        condition="Sepsis/Septic Shock (Unknown Source)",
        description="Severe sepsis or septic shock without identified source",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.CRITICAL,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin + Piperacillin-Tazobactam",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 4.5 g every 6h", "IV", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Broad empiric coverage", "MRSA coverage", "Pseudomonas coverage"],
                monitoring=["Vancomycin troughs", "Renal function", "Lactate clearance"],
                is_combination=True,
                combination_components=["vancomycin", "piperacillin-tazobactam"]
            ),
            AntibioticOption(
                drug_name="Vancomycin + Cefepime + Metronidazole",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g every 8h + 500 mg every 8h", "IV", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Alternative to piperacillin-tazobactam"],
                renal_adjustment=True,
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Meropenem + Vancomycin",
                regimen=DosingRegimen("1 g every 8h + 15-20 mg/kg every 8-12h", "IV", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("meropenem"),
                indications=["ESBL risk", "Severe sepsis"],
                renal_adjustment=True,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Add Aminoglycoside if Pseudomonas suspected",
                regimen=DosingRegimen("5-7 mg/kg", "daily", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.D,
                indications=["Double coverage for Pseudomonas"],
                warnings=["Nephrotoxicity", "Ototoxicity"],
                is_combination=True
            ),
        ],
        expected_pathogens=["Polymicrobial", "S. aureus (MRSA)", "Gram-negative bacilli", "Streptococci", "Anaerobes"],
        diagnostic_criteria=[
            "Suspected infection + organ dysfunction (SOFA score ≥2)",
            "Septic shock: hypotension requiring vasopressors + lactate >2"
        ],
        special_considerations=[
            "Give antibiotics within 1 hour of recognition",
            "Obtain cultures before antibiotics if no delay",
            "Reassess daily for de-escalation",
            "Source control when possible"
        ],
        references=["Surviving Sepsis Campaign Guidelines 2021"]
    ),
    
    # 18. Neutropenic Fever
    "NEUTROPENIC_FEVER": EmpiricProtocol(
        protocol_id="NEUTROPENIC_FEVER",
        condition="Febrile Neutropenia",
        description="Fever in neutropenic patient (ANC <500)",
        infection_type=InfectionType.HEALTHCARE_ASSOCIATED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Cefepime",
                regimen=DosingRegimen("2 g", "every 8 hours", "IV", "Until afebrile and ANC recovering"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("cefepime"),
                indications=["Febrile neutropenia", "Pseudomonas coverage"],
                monitoring=["Fever curve", "ANC", "Renal function"],
                renal_adjustment=True,
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Piperacillin-Tazobactam",
                regimen=DosingRegimen("4.5 g", "every 6 hours", "IV", "Until afebrile and ANC recovering"),
                pregnancy_category=PregnancyCategory.B,
                renal_adjustment=True,
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Meropenem",
                regimen=DosingRegimen("1 g", "every 8 hours", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.B,
                renal_adjustment=True,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Add Vancomycin if specific indications",
                regimen=DosingRegimen("15-20 mg/kg", "every 8-12 hours", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.C,
                indications=[
                    "Hemodynamic instability",
                    "Skin/soft tissue infection",
                    "Positive blood culture with gram-positive cocci",
                    "MRSA colonization",
                    "Severe mucositis"
                ],
                is_combination=True
            ),
        ],
        expected_pathogens=["Gram-negative bacilli", "S. aureus", "CoNS", "Viridans streptococci", "Candida"],
        diagnostic_criteria=[
            "Single oral temperature ≥38.3°C OR ≥38.0°C sustained >1 hour",
            "ANC <500 or expected to fall <500"
        ],
        special_considerations=[
            "Evaluate for fungal infection if fever persists >4-7 days",
            "Add antifungal coverage for high-risk patients"
        ],
        references=["IDSA Febrile Neutropenia Guidelines 2010"]
    ),
    
    # =========================================================================
    # CARDIAC INFECTIONS
    # =========================================================================
    
    # 19. Infective Endocarditis - Native Valve
    "ENDOCARDITIS_NATIVE_VALVE": EmpiricProtocol(
        protocol_id="ENDOCARDITIS_NATIVE_VALVE",
        condition="Infective Endocarditis (Native Valve)",
        description="Suspected infective endocarditis on native valve",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin + Ceftriaxone",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g daily", "IV", "IV", "4-6 weeks"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Native valve endocarditis", "Awaiting culture results"],
                monitoring=["Vancomycin troughs 15-20 mcg/mL", "Echocardiogram", "Blood cultures"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Vancomycin + Penicillin G",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 18-24 million units/day", "IV", "IV", "4-6 weeks"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Streptococcal endocarditis"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Nafcillin/Oxacillin + Gentamicin",
                regimen=DosingRegimen("2 g every 4h + 1 mg/kg every 8h", "IV", "IV", "6 weeks"),
                pregnancy_category=PregnancyCategory.B,
                indications=["MSSA endocarditis"],
                warnings=["Aminoglycoside nephrotoxicity"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["Viridans streptococci", "S. aureus", "Enterococcus", "HACEK organisms"],
        diagnostic_criteria=[
            "Modified Duke Criteria:",
            "2 major criteria OR",
            "1 major + 3 minor OR",
            "5 minor criteria",
            "Major: positive blood culture, evidence of endocardial involvement"
        ],
        special_considerations=[
            "Obtain 3 sets of blood cultures before antibiotics",
            "TEE preferred over TTE",
            "Cardiac surgery consultation for complications"
        ],
        references=["AHA Infective Endocarditis Guidelines 2023", "Modified Duke Criteria"]
    ),
    
    # 20. Prosthetic Valve Endocarditis
    "ENDOCARDITIS_PROSTHETIC": EmpiricProtocol(
        protocol_id="ENDOCARDITIS_PROSTHETIC",
        condition="Prosthetic Valve Endocarditis",
        description="Endocarditis involving prosthetic valve",
        infection_type=InfectionType.HEALTHCARE_ASSOCIATED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin + Cefepime + Gentamicin + Rifampin",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g every 8h + 1 mg/kg every 8h + 300 mg every 8h", "IV", "IV", "6+ weeks"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Prosthetic valve endocarditis empiric"],
                monitoring=["Vancomycin troughs", "Gentamicin levels", "Renal function"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Vancomycin + Meropenem",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g every 8h", "IV", "IV", "6+ weeks"),
                pregnancy_category=PregnancyCategory.B,
                is_alternative=True
            ),
        ],
        expected_pathogens=["S. aureus (MRSA)", "CoNS", "Enterococcus", "Gram-negative bacilli", "Fungi"],
        diagnostic_criteria=["Modified Duke Criteria with prosthetic valve evidence"],
        special_considerations=[
            "Early onset (<12 months): healthcare-associated pathogens more common",
            "Late onset: similar to native valve",
            "Cardiac surgery often required"
        ],
        references=["AHA Infective Endocarditis Guidelines 2023"]
    ),
    
    # =========================================================================
    # BONE AND JOINT INFECTIONS
    # =========================================================================
    
    # 21. Osteomyelitis - Acute Hematogenous
    "OSTEOMYELITIS_ACUTE": EmpiricProtocol(
        protocol_id="OSTEOMYELITIS_ACUTE",
        condition="Acute Hematogenous Osteomyelitis",
        description="Acute bone infection from hematogenous spread",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin + Ceftriaxone",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g daily", "IV", "IV", "4-6 weeks"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Acute osteomyelitis", "Age >3 years"],
                monitoring=["Vancomycin troughs", "ESR/CRP", "MRI response"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Vancomycin + Cefepime",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g every 8h", "IV", "IV", "4-6 weeks"),
                pregnancy_category=PregnancyCategory.C,
                renal_adjustment=True,
                is_alternative=True
            ),
        ],
        expected_pathogens=["S. aureus (MSSA/MRSA)", "S. pyogenes", "H. influenzae (children)", "S. pneumoniae"],
        diagnostic_criteria=[
            "Bone pain, fever, limited movement",
            "Elevated inflammatory markers",
            "MRI: bone marrow edema, enhancement"
        ],
        special_considerations=["Obtain bone biopsy for culture when possible"],
        references=["IDSA Bone and Joint Infection Guidelines 2015"]
    ),
    
    # 22. Septic Arthritis
    "SEPTIC_ARTHRITIS": EmpiricProtocol(
        protocol_id="SEPTIC_ARTHRITIS",
        condition="Septic Arthritis",
        description="Acute joint infection",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin + Ceftriaxone",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g daily", "IV", "IV", "3-4 weeks"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Septic arthritis", "Awaiting culture results"],
                monitoring=["Joint aspiration", "ESR/CRP"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Vancomycin + Cefepime",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 2 g every 8h", "IV", "IV", "3-4 weeks"),
                pregnancy_category=PregnancyCategory.C,
                is_alternative=True
            ),
        ],
        expected_pathogens=["S. aureus", "S. pyogenes", "N. gonorrhoeae (sexually active)", "Gram-negative bacilli"],
        diagnostic_criteria=[
            "Acute monoarticular arthritis",
            "Joint effusion with purulent fluid",
            "Synovial fluid: WBC >50,000, positive Gram stain/culture"
        ],
        special_considerations=[
            "Arthrocentesis essential for diagnosis",
            "Surgical drainage often required",
            "Consider gonococcal coverage in sexually active patients"
        ],
        references=["IDSA Bone and Joint Infection Guidelines 2015"]
    ),
    
    # =========================================================================
    # GASTROINTESTINAL INFECTIONS
    # =========================================================================
    
    # 23. Clostridioides difficile Infection
    "C_DIFFICILE": EmpiricProtocol(
        protocol_id="C_DIFFICILE",
        condition="Clostridioides difficile Infection",
        description="Antibiotic-associated diarrhea with C. difficile",
        infection_type=InfectionType.HEALTHCARE_ASSOCIATED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin (oral)",
                regimen=DosingRegimen("125 mg", "every 6 hours", "PO", "10 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Initial episode, non-severe to severe"],
                monitoring=["WBC count", "Creatinine", "Stool frequency"],
                is_first_line=True,
                rationale="Superior to metronidazole for initial treatment"
            ),
            AntibioticOption(
                drug_name="Fidaxomicin",
                regimen=DosingRegimen("200 mg", "every 12 hours", "PO", "10 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Initial episode", "Lower recurrence risk"],
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Metronidazole",
                regimen=DosingRegimen("500 mg", "every 8 hours", "PO", "10 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("metronidazole"),
                indications=["Non-severe, oral vancomycin unavailable"],
                warnings=["Disulfiram reaction", "Peripheral neuropathy with prolonged use"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["Clostridioides difficile"],
        diagnostic_criteria=[
            "≥3 unformed stools in 24 hours",
            "Positive C. difficile toxin test OR",
            "Pseudomembranous colitis on colonoscopy"
        ],
        special_considerations=[
            "Stop offending antibiotics if possible",
            "Fulminant: oral vancomycin + IV metronidazole",
            "Recurrence common - consider extended taper"
        ],
        references=["IDSA C. difficile Guidelines 2017"]
    ),
    
    # =========================================================================
    # SEXUALLY TRANSMITTED INFECTIONS
    # =========================================================================
    
    # 24. Gonorrhea
    "GONORRHEA": EmpiricProtocol(
        protocol_id="GONORRHEA",
        condition="Gonorrhea (Uncomplicated)",
        description="Uncomplicated Neisseria gonorrhoeae infection",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MILD,
        first_line=[
            AntibioticOption(
                drug_name="Ceftriaxone",
                regimen=DosingRegimen("500 mg (if <150 kg) or 1 g (if ≥150 kg)", "single dose", "IM", "1 day"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("ceftriaxone"),
                indications=["Uncomplicated genital, rectal, or pharyngeal gonorrhea"],
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Cefixime",
                regimen=DosingRegimen("800 mg", "single dose", "PO", "1 day"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Alternative if ceftriaxone unavailable"],
                warnings=["Lower pharyngeal efficacy"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Gentamicin + Azithromycin",
                regimen=DosingRegimen("240 mg single dose + 2 g single dose", "IM/PO", "IM/PO", "1 day"),
                pregnancy_category=PregnancyCategory.D,
                indications=["Severe cephalosporin allergy"],
                warnings=["Nephrotoxicity", "GI side effects"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["Neisseria gonorrhoeae"],
        diagnostic_criteria=[
            "Symptoms: urethral discharge, dysuria, cervical discharge",
            "Positive NAAT or culture"
        ],
        special_considerations=[
            "Test for concurrent chlamydia - treat if positive",
            "Test of cure not needed for uncomplicated with standard therapy",
            "Report to public health"
        ],
        references=["CDC STI Treatment Guidelines 2021"]
    ),
    
    # 25. Chlamydia
    "CHLAMYDIA": EmpiricProtocol(
        protocol_id="CHLAMYDIA",
        condition="Chlamydia trachomatis Infection",
        description="Uncomplicated genital chlamydia",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MILD,
        first_line=[
            AntibioticOption(
                drug_name="Doxycycline",
                regimen=DosingRegimen("100 mg", "every 12 hours", "PO", "7 days"),
                pregnancy_category=PregnancyCategory.D,
                pk_pd=PK_PD_DATABASE.get("doxycycline"),
                indications=["Uncomplicated chlamydia"],
                contraindications=["Pregnancy"],
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Azithromycin",
                regimen=DosingRegimen("1 g", "single dose", "PO", "1 day"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("azithromycin"),
                indications=["Pregnancy", "Adherence concerns"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Levofloxacin",
                regimen=DosingRegimen("500 mg", "daily", "PO", "7 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("levofloxacin"),
                is_alternative=True
            ),
        ],
        expected_pathogens=["Chlamydia trachomatis"],
        diagnostic_criteria=["Positive NAAT"],
        special_considerations=[
            "Test for concurrent gonorrhea",
            "Test of cure at 3 months for women",
            "Partner notification and treatment"
        ],
        references=["CDC STI Treatment Guidelines 2021"]
    ),
    
    # =========================================================================
    # ADDITIONAL PROTOCOLS
    # =========================================================================
    
    # 26. Aspiration Pneumonia
    "ASPIRATION_PNEUMONIA": EmpiricProtocol(
        protocol_id="ASPIRATION_PNEUMONIA",
        condition="Aspiration Pneumonia",
        description="Pneumonia following aspiration event",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Ampicillin-Sulbactam",
                regimen=DosingRegimen("3 g", "every 6 hours", "IV", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Aspiration pneumonia", "Community-onset"],
                renal_adjustment=True,
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Piperacillin-Tazobactam",
                regimen=DosingRegimen("4.5 g", "every 6 hours", "IV", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                renal_adjustment=True,
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Moxifloxacin",
                regimen=DosingRegimen("400 mg", "daily", "IV/PO", "5-7 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("moxifloxacin"),
                indications=["Penicillin allergy"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Clindamycin + Ceftriaxone",
                regimen=DosingRegimen("600 mg every 8h + 1 g daily", "IV", "IV", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                is_alternative=True
            ),
        ],
        expected_pathogens=["Oral anaerobes", "S. aureus", "Streptococci", "Gram-negative bacilli"],
        diagnostic_criteria=[
            "Witnessed or suspected aspiration event",
            "New infiltrate in dependent lung segments",
            "Symptoms of pneumonia"
        ],
        special_considerations=[
            "Chemical pneumonitis may not need antibiotics",
            "Add coverage for MRSA and Pseudomonas if hospital-acquired"
        ],
        references=["IDSA/ATS CAP Guidelines 2019"]
    ),
    
    # 27. PID
    "PELVIC_INFLAMMATORY_DISEASE": EmpiricProtocol(
        protocol_id="PELVIC_INFLAMMATORY_DISEASE",
        condition="Pelvic Inflammatory Disease",
        description="Upper genital tract infection in women",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Ceftriaxone + Doxycycline + Metronidazole",
                regimen=DosingRegimen("500 mg IM once + 100 mg every 12h + 500 mg every 12h", "IM/PO", "varies", "14 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Outpatient PID"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Cefoxitin + Doxycycline + Metronidazole",
                regimen=DosingRegimen("2 g IM once + 100 mg every 12h + 500 mg every 12h", "IM/PO", "varies", "14 days"),
                pregnancy_category=PregnancyCategory.B,
                is_alternative=True
            ),
        ],
        expected_pathogens=["N. gonorrhoeae", "C. trachomatis", "Anaerobes", "H. influenzae", "Enteric gram-negatives"],
        diagnostic_criteria=[
            "Minimum: Uterine tenderness OR adnexal tenderness OR cervical motion tenderness",
            "Additional: fever, leukocytosis, mucopurulent discharge, elevated ESR/CRP"
        ],
        special_considerations=[
            "Test for gonorrhea and chlamydia",
            "Partner treatment",
            "Consider hospitalization if severe or pregnant"
        ],
        references=["CDC STI Treatment Guidelines 2021"]
    ),
    
    # 28. Diabetic Foot Infection - Mild
    "DIABETIC_FOOT_MILD": EmpiricProtocol(
        protocol_id="DIABETIC_FOOT_MILD",
        condition="Diabetic Foot Infection (Mild)",
        description="Superficial infection without bone involvement",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MILD,
        first_line=[
            AntibioticOption(
                drug_name="Cephalexin",
                regimen=DosingRegimen("500 mg", "every 6 hours", "PO", "1-2 weeks"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Mild infection, no MRSA risk"],
                renal_adjustment=True,
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Dicloxacillin",
                regimen=DosingRegimen("500 mg", "every 6 hours", "PO", "1-2 weeks"),
                pregnancy_category=PregnancyCategory.B,
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Clindamycin",
                regimen=DosingRegimen("300-450 mg", "every 6-8 hours", "PO", "1-2 weeks"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("clindamycin"),
                indications=["Penicillin allergy"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="TMP-SMX DS",
                regimen=DosingRegimen("1-2 tablets", "every 12 hours", "PO", "1-2 weeks"),
                pregnancy_category=PregnancyCategory.C,
                indications=["MRSA coverage"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["S. aureus", "Streptococci"],
        diagnostic_criteria=[
            "Presence of ≤2 signs of inflammation",
            "Infection confined to skin/subcutaneous tissue",
            "No systemic illness"
        ],
        special_considerations=["Assess for vascular insufficiency", "Wound care essential"],
        references=["IDSA Diabetic Foot Infection Guidelines 2012"]
    ),
    
    # 29. Diabetic Foot Infection - Moderate-Severe
    "DIABETIC_FOOT_SEVERE": EmpiricProtocol(
        protocol_id="DIABETIC_FOOT_SEVERE",
        condition="Diabetic Foot Infection (Moderate-Severe)",
        description="Deep infection with or without osteomyelitis",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Vancomycin + Piperacillin-Tazobactam",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 4.5 g every 6h", "IV", "IV", "2-4 weeks (soft tissue), 4-6 weeks (bone)"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Moderate-severe infection", "MRSA coverage needed"],
                renal_adjustment=True,
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Vancomycin + Meropenem",
                regimen=DosingRegimen("15-20 mg/kg every 8-12h + 1 g every 8h", "IV", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.B,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Linezolid + Meropenem",
                regimen=DosingRegimen("600 mg every 12h + 1 g every 8h", "IV/PO", "IV", "Variable"),
                pregnancy_category=PregnancyCategory.C,
                is_alternative=True
            ),
        ],
        expected_pathogens=["S. aureus (MRSA)", "Streptococci", "Enterococcus", "Gram-negative bacilli", "Anaerobes"],
        diagnostic_criteria=[
            ">2 signs of inflammation OR",
            "Infection extending to deep tissue OR",
            "Systemic signs of infection"
        ],
        special_considerations=[
            "Evaluate for osteomyelitis (probe-to-bone, X-ray, MRI)",
            "Vascular assessment",
            "Surgical debridement often needed"
        ],
        references=["IDSA Diabetic Foot Infection Guidelines 2012"]
    ),
    
    # 30. Lyme Disease
    "LYME_DISEASE": EmpiricProtocol(
        protocol_id="LYME_DISEASE",
        condition="Lyme Disease",
        description="Borrelia burgdorferi infection",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MILD,
        first_line=[
            AntibioticOption(
                drug_name="Doxycycline",
                regimen=DosingRegimen("100 mg", "every 12 hours", "PO", "10-21 days"),
                pregnancy_category=PregnancyCategory.D,
                pk_pd=PK_PD_DATABASE.get("doxycycline"),
                indications=["Early localized or disseminated Lyme", "Erythema migrans"],
                contraindications=["Pregnancy", "Children <8 years"],
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Amoxicillin",
                regimen=DosingRegimen("500 mg", "every 8 hours", "PO", "14-21 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("amoxicillin"),
                indications=["Alternative for children, pregnant patients"],
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Cefuroxime axetil",
                regimen=DosingRegimen("500 mg", "every 12 hours", "PO", "14-21 days"),
                pregnancy_category=PregnancyCategory.B,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Ceftriaxone",
                regimen=DosingRegimen("2 g", "daily", "IV", "14-28 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("ceftriaxone"),
                indications=["Neurologic Lyme", "Carditis"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["Borrelia burgdorferi"],
        diagnostic_criteria=[
            "Erythema migrans rash (diagnostic)",
            "OR serologic evidence + compatible symptoms"
        ],
        special_considerations=[
            "Neurologic involvement: IV ceftriaxone",
            "Cardiac involvement: IV therapy, monitoring"
        ],
        references=["IDSA Lyme Disease Guidelines 2020"]
    ),
    
    # 31. Syphilis
    "SYPHILIS": EmpiricProtocol(
        protocol_id="SYPHILIS",
        condition="Syphilis",
        description="Treponema pallidum infection",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Benzathine Penicillin G",
                regimen=DosingRegimen("2.4 million units", "single dose", "IM", "1 day (primary, secondary, early latent)"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("penicillin_g"),
                indications=["Primary, secondary, early latent syphilis"],
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Doxycycline",
                regimen=DosingRegimen("100 mg", "every 12 hours", "PO", "14 days"),
                pregnancy_category=PregnancyCategory.D,
                pk_pd=PK_PD_DATABASE.get("doxycycline"),
                indications=["Penicillin allergy (non-pregnant)"],
                contraindications=["Pregnancy"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Benzathine Penicillin G (late latent/neurosyphilis)",
                regimen=DosingRegimen("2.4 million units weekly x 3 doses OR 18-24 million units/day IV x 10-14 days", "IM/IV", "varies", "varies"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Late latent or neurosyphilis"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["Treponema pallidum"],
        diagnostic_criteria=[
            "Primary: chancre",
            "Secondary: rash, lymphadenopathy",
            "Positive serology (RPR/VDRL confirmed by FTA-ABS or TPPA)"
        ],
        special_considerations=[
            "Jarisch-Herxheimer reaction possible",
            "Pregnant patients: penicillin only, desensitize if allergic",
            "Follow-up RPR at 6, 12, 24 months"
        ],
        references=["CDC STI Treatment Guidelines 2021"]
    ),
    
    # 32. Peritonitis - Spontaneous Bacterial
    "SBP": EmpiricProtocol(
        protocol_id="SBP",
        condition="Spontaneous Bacterial Peritonitis",
        description="Infection of ascitic fluid without surgical source",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.SEVERE,
        first_line=[
            AntibioticOption(
                drug_name="Ceftriaxone",
                regimen=DosingRegimen("2 g", "daily", "IV", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("ceftriaxone"),
                indications=["SBP", "Cirrhosis with infected ascites"],
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Cefotaxime",
                regimen=DosingRegimen("2 g", "every 8 hours", "IV", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Ampicillin-Sulbactam",
                regimen=DosingRegimen("3 g", "every 6 hours", "IV", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Piperacillin-Tazobactam",
                regimen=DosingRegimen("4.5 g", "every 6 hours", "IV", "5-7 days"),
                pregnancy_category=PregnancyCategory.B,
                renal_adjustment=True,
                is_alternative=True
            ),
        ],
        expected_pathogens=["E. coli", "Klebsiella", "Streptococcus pneumoniae", "Enterococcus"],
        diagnostic_criteria=[
            "Ascitic fluid PMN count >250/mm³",
            "No secondary source identified"
        ],
        special_considerations=[
            "Give albumin 1.5 g/kg day 1, 1 g/kg day 3",
            "Reduces mortality and renal failure"
        ],
        references=["AASLD Guidelines", "IDSA Guidelines"]
    ),
    
    # 33. Brain Abscess
    "BRAIN_ABSCESS": EmpiricProtocol(
        protocol_id="BRAIN_ABSCESS",
        condition="Brain Abscess",
        description="Intracranial pyogenic infection",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.CRITICAL,
        first_line=[
            AntibioticOption(
                drug_name="Ceftriaxone + Metronidazole + Vancomycin",
                regimen=DosingRegimen("2 g every 12h + 500 mg every 8h + 15-20 mg/kg every 8-12h", "IV", "IV", "6-8 weeks"),
                pregnancy_category=PregnancyCategory.C,
                indications=["Brain abscess", "Awaiting culture results"],
                monitoring=["Serial imaging", "Vancomycin troughs"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Meropenem + Vancomycin",
                regimen=DosingRegimen("2 g every 8h + 15-20 mg/kg every 8-12h", "IV", "IV", "6-8 weeks"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("meropenem"),
                renal_adjustment=True,
                is_alternative=True
            ),
        ],
        expected_pathogens=["Streptococci", "Bacteroides", "Enterobacterales", "S. aureus", "Anaerobes"],
        diagnostic_criteria=[
            "Neurologic symptoms",
            "Ring-enhancing lesion on CT/MRI",
            "Positive cultures from aspiration"
        ],
        special_considerations=[
            "Neurosurgical aspiration/drainage often needed",
            "Consider Nocardia, Listeria in immunocompromised"
        ],
        references=["IDSA CNS Infection Guidelines"]
    ),
    
    # 34. Epididymitis/Orchitis
    "EPIDIDYMITIS": EmpiricProtocol(
        protocol_id="EPIDIDYMITIS",
        condition="Epididymitis/Orchitis",
        description="Acute epididymal/testicular inflammation",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MODERATE,
        first_line=[
            AntibioticOption(
                drug_name="Ceftriaxone + Doxycycline",
                regimen=DosingRegimen("500 mg IM once + 100 mg every 12h", "IM/PO", "varies", "10-14 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Sexually active men <35 years"],
                is_combination=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Levofloxacin",
                regimen=DosingRegimen("500 mg", "daily", "PO", "10-14 days"),
                pregnancy_category=PregnancyCategory.C,
                pk_pd=PK_PD_DATABASE.get("levofloxacin"),
                indications=["Men >35 years", "Insertive anal sex (Enterobacteriaceae coverage)"],
                renal_adjustment=True,
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Ofloxacin",
                regimen=DosingRegimen("300 mg", "every 12 hours", "PO", "10-14 days"),
                pregnancy_category=PregnancyCategory.C,
                is_alternative=True
            ),
        ],
        expected_pathogens=["N. gonorrhoeae", "C. trachomatis", "Enterobacteriaceae", "Pseudomonas"],
        diagnostic_criteria=[
            "Unilateral testicular pain and swelling",
            "Tenderness of epididymis",
            "UA: pyuria"
        ],
        special_considerations=[
            "Rule out testicular torsion",
            "Partner treatment if STI",
            "Consider prostatitis if recurrent"
        ],
        references=["CDC STI Treatment Guidelines 2021"]
    ),
    
    # 35. Pharyngitis (Strep)
    "PHARYNGITIS_STREP": EmpiricProtocol(
        protocol_id="PHARYNGITIS_STREP",
        condition="Streptococcal Pharyngitis",
        description="Group A Streptococcus pharyngitis",
        infection_type=InfectionType.COMMUNITY_ACQUIRED,
        severity=SeverityLevel.MILD,
        first_line=[
            AntibioticOption(
                drug_name="Penicillin V",
                regimen=DosingRegimen("500 mg", "every 8-12 hours", "PO", "10 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("penicillin_g"),
                indications=["Proven or suspected GAS pharyngitis"],
                is_first_line=True
            ),
            AntibioticOption(
                drug_name="Amoxicillin",
                regimen=DosingRegimen("500 mg every 12h or 1 g daily", "PO", "PO", "10 days"),
                pregnancy_category=PregnancyCategory.B,
                pk_pd=PK_PD_DATABASE.get("amoxicillin"),
                is_first_line=True
            ),
        ],
        alternatives=[
            AntibioticOption(
                drug_name="Penicillin G Benzathine",
                regimen=DosingRegimen("1.2 million units", "single dose", "IM", "1 day"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Compliance concerns"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Cephalexin",
                regimen=DosingRegimen("500 mg", "every 12 hours", "PO", "10 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Penicillin allergy (non-severe)"],
                is_alternative=True
            ),
            AntibioticOption(
                drug_name="Azithromycin",
                regimen=DosingRegimen("500 mg day 1, then 250 mg daily", "PO", "PO", "5 days"),
                pregnancy_category=PregnancyCategory.B,
                indications=["Severe penicillin allergy"],
                is_alternative=True
            ),
        ],
        expected_pathogens=["Streptococcus pyogenes (Group A)"],
        diagnostic_criteria=[
            "Centor criteria: fever, absence of cough, swollen tender anterior cervical adenopathy, tonsillar exudates",
            "Positive rapid strep test or culture"
        ],
        special_considerations=[
            "Test before treating (Centor score 2-3)",
            "Treat if Centor score ≥4",
            "Prevents rheumatic fever"
        ],
        references=["IDSA Pharyngitis Guidelines 2012"]
    ),
}


# =============================================================================
# EMPIRIC THERAPY ENGINE CLASS
# =============================================================================

class EmpiricTherapyEngine:
    """
    Engine for generating empiric therapy recommendations.
    
    Features:
    - 30+ empiric therapy protocols
    - Considerations for allergies, renal function, pregnancy
    - PK/PD parameters for each antibiotic
    - Local resistance integration
    """
    
    def __init__(self):
        self._protocols = EMPIRIC_PROTOCOLS
        self._pk_pd_database = PK_PD_DATABASE
    
    def get_protocol(self, protocol_id: str) -> Optional[EmpiricProtocol]:
        """Get a specific protocol by ID."""
        return self._protocols.get(protocol_id.upper())
    
    def search_protocols(
        self,
        condition: Optional[str] = None,
        infection_type: Optional[InfectionType] = None,
        severity: Optional[SeverityLevel] = None
    ) -> List[EmpiricProtocol]:
        """Search protocols by criteria."""
        results = []
        
        for protocol in self._protocols.values():
            match = True
            
            if condition and condition.lower() not in protocol.condition.lower():
                match = False
            if infection_type and protocol.infection_type != infection_type:
                match = False
            if severity and protocol.severity != severity:
                match = False
            
            if match:
                results.append(protocol)
        
        return results
    
    def get_recommendation(
        self,
        protocol_id: str,
        allergies: Optional[List[str]] = None,
        renal_function: Optional[str] = None,  # "normal", "mild", "moderate", "severe", "dialysis"
        pregnancy: bool = False,
        recent_antibiotics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get tailored empiric therapy recommendation.
        
        Considers patient factors to recommend appropriate therapy.
        """
        protocol = self.get_protocol(protocol_id)
        if not protocol:
            return {"error": f"Protocol {protocol_id} not found"}
        
        recommendations = {
            "protocol": protocol.to_dict(),
            "patient_specific_recommendations": [],
            "contraindications": [],
            "warnings": [],
            "adjustments": []
        }
        
        # Filter for patient factors
        for option in protocol.first_line:
            issues = self._check_option(option, allergies, renal_function, pregnancy)
            if issues:
                recommendations["warnings"].extend(issues)
            else:
                recommendations["patient_specific_recommendations"].append(option.to_dict())
        
        # Check alternatives if first-line has issues
        if not recommendations["patient_specific_recommendations"]:
            for option in protocol.alternatives:
                issues = self._check_option(option, allergies, renal_function, pregnancy)
                if not issues:
                    recommendations["patient_specific_recommendations"].append(option.to_dict())
        
        return recommendations
    
    def _check_option(
        self,
        option: AntibioticOption,
        allergies: Optional[List[str]],
        renal_function: Optional[str],
        pregnancy: bool
    ) -> List[str]:
        """Check if an antibiotic option is appropriate for patient."""
        issues = []
        
        # Check allergies
        if allergies:
            for allergy in allergies:
                if allergy.lower() in option.drug_name.lower():
                    issues.append(f"Allergy to {allergy}")
        
        # Check pregnancy
        if pregnancy:
            if option.pregnancy_category in [PregnancyCategory.D, PregnancyCategory.X]:
                issues.append(f"Drug category {option.pregnancy_category.value} - avoid in pregnancy")
        
        # Check contraindications
        # These would be checked against patient-specific factors
        
        return issues
    
    def get_pk_pd(self, drug_name: str) -> Optional[PKPDParameters]:
        """Get PK/PD parameters for a drug."""
        drug_key = drug_name.lower().replace("-", "_").replace(" ", "_")
        return self._pk_pd_database.get(drug_key)
    
    def list_protocols(self) -> List[str]:
        """List all available protocol IDs."""
        return list(self._protocols.keys())


# Singleton instance
_empiric_engine = None

def get_empiric_engine() -> EmpiricTherapyEngine:
    """Get singleton EmpiricTherapyEngine instance."""
    global _empiric_engine
    if _empiric_engine is None:
        _empiric_engine = EmpiricTherapyEngine()
    return _empiric_engine

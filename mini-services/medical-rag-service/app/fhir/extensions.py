"""
FHIR R4 Custom Extensions
=========================

Gelani-specific FHIR R4 extension definitions for clinical decision support.

These private extension URIs follow the format:
http://gelani.ai/fhir/StructureDefinition/{name}

Evidence Sources:
- HL7 FHIR R4 Extensions: https://hl7.org/fhir/R4/extensibility.html
- FHIR Extension Registry: https://hl7.org/fhir/extension-registry.html

PROMPT 12: FHIR R4 Export Implementation
"""

from typing import Any, Dict, Union


# =============================================================================
# GELANI CUSTOM EXTENSION URLs
# =============================================================================

# Evidence and Bayesian reasoning extensions
# Reference: Bayesian reasoning in clinical diagnosis (Gill et al., 2004)
EXT_EVIDENCE_PMID = "http://gelani.ai/fhir/StructureDefinition/evidence-pmid"
EXT_POSTERIOR_PROB = "http://gelani.ai/fhir/StructureDefinition/posterior-probability"
EXT_BAYESIAN_RANK = "http://gelani.ai/fhir/StructureDefinition/bayesian-rank"
EXT_FORCED_INCLUSION = "http://gelani.ai/fhir/StructureDefinition/forced-critical-inclusion"

# Antimicrobial and medication extensions
# Reference: IDSA Antimicrobial Dosing Guidelines (2024)
EXT_RENAL_BRACKET = "http://gelani.ai/fhir/StructureDefinition/renal-dose-bracket"
EXT_DDI_WARNING = "http://gelani.ai/fhir/StructureDefinition/ddi-warning"
EXT_ALLERGY_OVERRIDE = "http://gelani.ai/fhir/StructureDefinition/allergy-override-rationale"
EXT_ANTIBIOGRAM_SUSC = "http://gelani.ai/fhir/StructureDefinition/antibiogram-susceptibility-pct"

# RAG and audit extensions
EXT_RAG_NAMESPACE = "http://gelani.ai/fhir/StructureDefinition/rag-namespace"
EXT_AUDIT_SESSION = "http://gelani.ai/fhir/StructureDefinition/audit-session-hash"


# =============================================================================
# EXTENSION VALUE TYPES
# =============================================================================

VALID_VALUE_TYPES = {
    "valueString": str,
    "valueDecimal": (int, float),
    "valueBoolean": bool,
    "valueInteger": int,
    "valueCode": str,
    "valueUri": str,
    "valueDateTime": str,
    "valueQuantity": dict,
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def build_extension(
    url: str,
    value_type: str,
    value: Any
) -> Dict[str, Any]:
    """
    Build a FHIR R4 Extension object.
    
    FHIR R4 Extension format:
    {
        "url": "extension-url",
        "valueX": value
    }
    
    Where valueX is one of: valueString, valueDecimal, valueBoolean, 
    valueInteger, valueCode, valueUri, valueDateTime, valueQuantity
    
    Reference: https://hl7.org/fhir/R4/extensibility.html
    
    Args:
        url: The extension URL (must be a valid URI)
        value_type: One of the FHIR value types (e.g., "valueString")
        value: The extension value
        
    Returns:
        FHIR Extension object as dictionary
        
    Raises:
        ValueError: If value_type is not valid
    """
    if value_type not in VALID_VALUE_TYPES:
        raise ValueError(
            f"Invalid value_type '{value_type}'. "
            f"Must be one of: {list(VALID_VALUE_TYPES.keys())}"
        )
    
    extension = {"url": url}
    
    # Handle None values
    if value is None:
        return extension
    
    # Type-specific handling
    if value_type == "valueDecimal":
        # Ensure decimal values are properly formatted
        if isinstance(value, float):
            # Round to 4 decimal places for probabilities
            extension[value_type] = round(value, 4)
        else:
            extension[value_type] = float(value)
    elif value_type == "valueBoolean":
        extension[value_type] = bool(value)
    elif value_type == "valueInteger":
        extension[value_type] = int(value)
    elif value_type == "valueString":
        extension[value_type] = str(value)
    elif value_type == "valueCode":
        extension[value_type] = str(value)
    elif value_type == "valueUri":
        extension[value_type] = str(value)
    elif value_type == "valueDateTime":
        extension[value_type] = str(value)
    elif value_type == "valueQuantity":
        extension[value_type] = value
    
    return extension


def build_pmid_extension(pmid: str) -> Dict[str, Any]:
    """
    Build a PMID evidence extension.
    
    Format: "PMID:12345678"
    
    Args:
        pmid: PubMed ID (with or without PMID: prefix)
        
    Returns:
        FHIR Extension for evidence PMID
    """
    # Normalize PMID format
    if not pmid.upper().startswith("PMID:"):
        pmid = f"PMID:{pmid}"
    
    return build_extension(
        url=EXT_EVIDENCE_PMID,
        value_type="valueString",
        value=pmid
    )


def build_posterior_probability_extension(probability: float) -> Dict[str, Any]:
    """
    Build a Bayesian posterior probability extension.
    
    The posterior probability represents the updated probability
    of a diagnosis after considering clinical evidence using
    Bayesian reasoning.
    
    Evidence Source: Bayes' theorem in clinical diagnosis
    Reference: Gill CJ, et al. "Why clinicians are natural Bayesians"
    BMJ 2004;330:1080-1083
    
    Args:
        probability: Posterior probability (0.0 to 1.0)
        
    Returns:
        FHIR Extension with posterior probability
    """
    # Ensure probability is within valid range
    probability = max(0.0, min(1.0, float(probability)))
    
    return build_extension(
        url=EXT_POSTERIOR_PROB,
        value_type="valueDecimal",
        value=probability
    )


def build_bayesian_rank_extension(rank: int) -> Dict[str, Any]:
    """
    Build a Bayesian rank extension.
    
    The rank indicates the position in the differential diagnosis
    list after Bayesian analysis.
    
    Args:
        rank: Position in differential (1 = most likely)
        
    Returns:
        FHIR Extension with Bayesian rank
    """
    return build_extension(
        url=EXT_BAYESIAN_RANK,
        value_type="valueInteger",
        value=max(1, int(rank))
    )


def build_forced_inclusion_extension(is_forced: bool) -> Dict[str, Any]:
    """
    Build a forced critical inclusion extension.
    
    Indicates that a diagnosis was included in the differential
    due to critical clinical importance, even if Bayesian
    probability was below threshold.
    
    Example: Ruling out pulmonary embolism in dyspnea
    
    Args:
        is_forced: Whether this was a forced inclusion
        
    Returns:
        FHIR Extension for forced inclusion flag
    """
    return build_extension(
        url=EXT_FORCED_INCLUSION,
        value_type="valueBoolean",
        value=is_forced
    )


def build_renal_bracket_extension(bracket: str) -> Dict[str, Any]:
    """
    Build a renal dose bracket extension.
    
    Renal brackets are determined by Cockcroft-Gault equation:
    - Normal: CrCl >= 90 mL/min
    - Mild: CrCl 60-89 mL/min
    - Moderate: CrCl 30-59 mL/min
    - Severe: CrCl 15-29 mL/min
    - ESRD: CrCl < 15 mL/min
    
    Evidence Source: Cockcroft DW, Gault MH. "Prediction of creatinine 
    clearance from serum creatinine." Nephron 1976;16(1):31-41
    
    Args:
        bracket: Renal function bracket label
        
    Returns:
        FHIR Extension with renal bracket
    """
    return build_extension(
        url=EXT_RENAL_BRACKET,
        value_type="valueString",
        value=bracket.lower()
    )


def build_ddi_warning_extension(
    drug_a: str,
    drug_b: str,
    severity: str,
    mechanism: str
) -> Dict[str, Any]:
    """
    Build a drug-drug interaction (DDI) warning extension.
    
    Format: "{drug_a} + {drug_b}: {severity} — {mechanism}"
    
    Severity levels:
    - CONTRAINDICATED: Never co-administer
    - MAJOR: Avoid combination; high risk of harm
    - MODERATE: Monitor closely; potential harm
    - MINOR: Low risk; be aware
    
    Evidence Source: Drug Interaction Knowledge Base
    Reference: FDA Drug Interaction Tables
    
    Args:
        drug_a: First drug in interaction
        drug_b: Second drug in interaction
        severity: Interaction severity level
        mechanism: Mechanism of interaction
        
    Returns:
        FHIR Extension with DDI warning details
    """
    warning_text = f"{drug_a} + {drug_b}: {severity} - {mechanism}"
    
    return build_extension(
        url=EXT_DDI_WARNING,
        value_type="valueString",
        value=warning_text
    )


def build_allergy_override_extension(rationale: str) -> Dict[str, Any]:
    """
    Build an allergy override rationale extension.
    
    Documents why a medication was prescribed despite allergy
    history, including cross-reactivity risk assessment.
    
    Example: "3rd-gen cephalosporin permitted despite penicillin 
    anaphylaxis: distinct R1 side chain, <1% cross-reactivity 
    risk (Romano 2004 PMID 15282380)"
    
    Evidence Source: Clinical immunology literature on cross-reactivity
    
    Args:
        rationale: Clinical rationale for allergy override
        
    Returns:
        FHIR Extension with override rationale
    """
    return build_extension(
        url=EXT_ALLERGY_OVERRIDE,
        value_type="valueString",
        value=rationale
    )


def build_antibiogram_susceptibility_extension(
    susceptibility_pct: float
) -> Dict[str, Any]:
    """
    Build an antibiogram susceptibility percentage extension.
    
    Represents local/institutional susceptibility data for
    organism-antibiotic combinations.
    
    Evidence Source: CLSI M100 Performance Standards for Antimicrobial
    Susceptibility Testing
    
    Args:
        susceptibility_pct: Susceptibility percentage (0-100)
        
    Returns:
        FHIR Extension with susceptibility percentage
    """
    # Ensure percentage is valid
    susceptibility_pct = max(0.0, min(100.0, float(susceptibility_pct)))
    
    return build_extension(
        url=EXT_ANTIBIOGRAM_SUSC,
        value_type="valueDecimal",
        value=susceptibility_pct
    )


def build_rag_namespace_extension(namespace: str) -> Dict[str, Any]:
    """
    Build a RAG namespace extension.
    
    Documents which Pinecone namespace was queried to retrieve
    supporting evidence for the diagnosis.
    
    Args:
        namespace: Pinecone namespace identifier
        
    Returns:
        FHIR Extension with RAG namespace
    """
    return build_extension(
        url=EXT_RAG_NAMESPACE,
        value_type="valueString",
        value=namespace
    )


def build_audit_session_extension(session_hash: str) -> Dict[str, Any]:
    """
    Build an audit session hash extension.
    
    Links the FHIR export to the audit trail for medico-legal
    traceability.
    
    HIPAA Reference: 45 CFR 164.312(b) - Audit Controls
    
    Args:
        session_hash: Hashed session identifier from audit service
        
    Returns:
        FHIR Extension with audit session hash
    """
    return build_extension(
        url=EXT_AUDIT_SESSION,
        value_type="valueString",
        value=session_hash
    )


# =============================================================================
# EXTENSION GROUPING UTILITIES
# =============================================================================

def build_condition_extensions(
    hypothesis: dict
) -> list:
    """
    Build all extensions for a Condition resource from a Bayesian hypothesis.
    
    Args:
        hypothesis: Dictionary containing:
            - posterior_probability: float (0-1)
            - rank: int (position in differential)
            - evidence_pmids: list of str (PubMed IDs)
            - rag_namespace: str (Pinecone namespace)
            - forced_inclusion: bool (optional)
            
    Returns:
        List of FHIR Extension objects
    """
    extensions = []
    
    # Posterior probability
    if "posterior_probability" in hypothesis:
        extensions.append(
            build_posterior_probability_extension(
                hypothesis["posterior_probability"]
            )
        )
    
    # Bayesian rank
    if "rank" in hypothesis:
        extensions.append(
            build_bayesian_rank_extension(hypothesis["rank"])
        )
    
    # Evidence PMIDs (can be multiple)
    if "evidence_pmids" in hypothesis:
        for pmid in hypothesis["evidence_pmids"]:
            extensions.append(build_pmid_extension(pmid))
    
    # RAG namespace
    if "rag_namespace" in hypothesis:
        extensions.append(
            build_rag_namespace_extension(hypothesis["rag_namespace"])
        )
    
    # Forced inclusion flag
    if hypothesis.get("forced_inclusion"):
        extensions.append(
            build_forced_inclusion_extension(True)
        )
    
    return extensions


def build_medication_request_extensions(
    recommendation: dict
) -> list:
    """
    Build all extensions for a MedicationRequest from antimicrobial recommendation.
    
    Args:
        recommendation: Dictionary containing:
            - renal_adjustment: bool
            - renal_bracket: str (if renal_adjustment)
            - interaction_warnings: list of dicts
            - allergy_override_rationale: str (optional)
            - antibiogram_susceptibility: float (optional)
            
    Returns:
        List of FHIR Extension objects
    """
    extensions = []
    
    # Renal adjustment
    if recommendation.get("renal_adjustment"):
        if "renal_bracket" in recommendation:
            extensions.append(
                build_renal_bracket_extension(recommendation["renal_bracket"])
            )
    
    # DDI warnings (can be multiple)
    if "interaction_warnings" in recommendation:
        for warning in recommendation["interaction_warnings"]:
            extensions.append(
                build_ddi_warning_extension(
                    drug_a=warning.get("drug_a", "unknown"),
                    drug_b=warning.get("drug_b", "unknown"),
                    severity=warning.get("severity", "unknown"),
                    mechanism=warning.get("mechanism", "unknown mechanism")
                )
            )
    
    # Allergy override rationale
    if recommendation.get("allergy_override_rationale"):
        extensions.append(
            build_allergy_override_extension(
                recommendation["allergy_override_rationale"]
            )
        )
    
    # Antibiogram susceptibility
    if "antibiogram_susceptibility" in recommendation:
        extensions.append(
            build_antibiogram_susceptibility_extension(
                recommendation["antibiogram_susceptibility"]
            )
        )
    
    return extensions

"""
FHIR R4 Bundle Builder
======================

Comprehensive FHIR R4 Bundle builder for clinical encounter export.

Builds a FHIR Bundle of type "document" containing all resources
related to a clinical encounter, including:
- Composition (document root)
- Patient
- Condition entries (one per differential hypothesis)
- Observation entries (vitals and labs)
- MedicationRequest entries (antimicrobial recommendations)
- DocumentReference (optional, for SOAP note text)

Evidence Sources:
- HL7 FHIR R4 Bundle: https://hl7.org/fhir/R4/bundle.html
- FHIR Document Bundle: https://hl7.org/fhir/R4/documents.html
- US Core Document: https://www.hl7.org/fhir/us/core/

PROMPT 12: FHIR R4 Export Implementation
"""

import os
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import uuid4

from loguru import logger

from app.fhir.extensions import (
    build_audit_session_extension,
    build_condition_extensions,
    build_medication_request_extensions,
    EXT_EVIDENCE_PMID,
    EXT_POSTERIOR_PROB,
    EXT_BAYESIAN_RANK,
)


# =============================================================================
# VERSION INFO
# =============================================================================

GELANI_VERSION = os.environ.get("GELANI_VERSION", "1.0.0")


# =============================================================================
# PATIENT ID HASHING
# =============================================================================

def hash_patient_id(patient_id: str) -> str:
    """
    Generate a SHA-256 hash of the patient ID for FHIR export.
    
    This ensures raw database IDs are never exposed in FHIR exports,
    maintaining patient privacy while allowing deterministic reference
    resolution within the bundle.
    
    Evidence Source: HIPAA Safe Harbor provision (45 CFR 164.514)
    
    Args:
        patient_id: Raw patient identifier from database
        
    Returns:
        SHA-256 hash (first 32 characters) for use as FHIR resource ID
    """
    hash_obj = hashlib.sha256(str(patient_id).encode("utf-8"))
    return hash_obj.hexdigest()[:32]


# =============================================================================
# RESOURCE ID GENERATION
# =============================================================================

def generate_resource_id(*components: str) -> str:
    """
    Generate a deterministic resource ID from components.
    
    Uses SHA-256 hash to ensure consistent IDs for the same inputs,
    enabling proper reference resolution within bundles.
    
    Args:
        *components: String components to hash together
        
    Returns:
        16-character hex string for use as FHIR resource ID
    """
    combined = "|".join(str(c) for c in components)
    hash_obj = hashlib.sha256(combined.encode("utf-8"))
    return hash_obj.hexdigest()[:16]


# =============================================================================
# PATIENT MAPPER
# =============================================================================

def map_patient(patient_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map internal patient dict to a FHIR R4 Patient resource.
    
    Key features:
    - ID is SHA-256 hash of internal ID (never expose raw DB ID)
    - Gender mapped from M/F to male/female
    - birthDate derived from age if DOB not available
    - Name omitted if FHIR_INCLUDE_PHI=false (default)
    - US Core Patient profile applied
    
    Evidence Sources:
    - US Core Patient Profile: https://www.hl7.org/fhir/us/core/StructureDefinition-us-core-patient.html
    - FHIR R4 Patient: https://hl7.org/fhir/R4/patient.html
    
    Args:
        patient_dict: Dictionary containing patient data
        
    Returns:
        FHIR R4 Patient resource as dictionary
    """
    # Hash the patient ID for privacy
    internal_id = str(patient_dict.get("id", "unknown"))
    fhir_patient_id = hash_patient_id(internal_id)
    
    # Check if PHI should be included
    include_phi = os.environ.get("FHIR_INCLUDE_PHI", "false").lower() == "true"
    
    # Build base resource
    fhir_patient = {
        "resourceType": "Patient",
        "id": fhir_patient_id,
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
            "profile": [
                "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"
            ]
        },
    }
    
    # Map gender
    # FHIR requires: male | female | other | unknown
    raw_gender = patient_dict.get("gender", "unknown")
    if isinstance(raw_gender, str):
        gender_lower = raw_gender.lower()
        if gender_lower in ("m", "male"):
            fhir_patient["gender"] = "male"
        elif gender_lower in ("f", "female"):
            fhir_patient["gender"] = "female"
        elif gender_lower in ("other", "o"):
            fhir_patient["gender"] = "other"
        else:
            fhir_patient["gender"] = "unknown"
    else:
        fhir_patient["gender"] = "unknown"
    
    # Map birthDate
    if patient_dict.get("dateOfBirth"):
        dob = patient_dict["dateOfBirth"]
        if isinstance(dob, str):
            fhir_patient["birthDate"] = dob.split("T")[0]
        elif isinstance(dob, datetime):
            fhir_patient["birthDate"] = dob.strftime("%Y-%m-%d")
    elif patient_dict.get("age"):
        # Derive approximate birth year from age
        # Note: This is an approximation - real deployments must use actual DOB
        current_year = datetime.utcnow().year
        birth_year = current_year - int(patient_dict["age"])
        fhir_patient["birthDate"] = f"{birth_year}-01-01"
        logger.warning(
            f"Patient birthDate derived from age (approximation). "
            f"Real deployments should use actual date of birth."
        )
    
    # Include name only if PHI flag is set
    if include_phi:
        given_names = []
        if patient_dict.get("firstName"):
            given_names.append(patient_dict["firstName"])
        if patient_dict.get("middleName"):
            given_names.append(patient_dict["middleName"])
        
        if given_names or patient_dict.get("lastName"):
            fhir_patient["name"] = [{
                "use": "official",
                "family": patient_dict.get("lastName", "Unknown"),
                "given": given_names if given_names else ["Unknown"],
            }]
    
    # Identifier (MRN) - hashed for privacy
    if patient_dict.get("mrn"):
        fhir_patient["identifier"] = [{
            "use": "usual",
            "type": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                    "code": "MR",
                    "display": "Medical Record Number"
                }],
                "text": "Medical Record Number"
            },
            "system": "http://gelani.ai/fhir/identifier/mrn",
            "value": hash_patient_id(patient_dict["mrn"]),
        }]
    
    # DO NOT include address, telecom, or contact per P12 requirements
    # This is a CDSS export, not a registration system
    
    return fhir_patient


# =============================================================================
# CONDITION MAPPER
# =============================================================================

def map_condition(
    hypothesis: Dict[str, Any],
    patient_ref: str,
    encounter_ref: Optional[str] = None
) -> Dict[str, Any]:
    """
    Map a Bayesian differential hypothesis to a FHIR R4 Condition resource.
    
    Key features:
    - ID deterministically generated from patient_ref + icd10 + encounter_ref
    - Extensions for posterior probability, rank, PMIDs, RAG namespace
    - clinicalStatus always "active" for differential output
    - verificationStatus based on rank and confidence
    - Severity derived from is_critical flag
    
    Evidence Sources:
    - FHIR R4 Condition: https://hl7.org/fhir/R4/condition.html
    - SNOMED CT Clinical Findings: https://www.snomed.org/
    
    Args:
        hypothesis: Dictionary with hypothesis data
        patient_ref: Reference to Patient resource
        encounter_ref: Optional reference to Encounter
        
    Returns:
        FHIR R4 Condition resource as dictionary
    """
    icd10 = hypothesis.get("icd10", hypothesis.get("icdCode", "unknown"))
    
    # Generate deterministic ID
    condition_id = generate_resource_id(patient_ref, icd10, encounter_ref or "no-encounter")
    
    # Determine verification status
    # Reference: https://hl7.org/fhir/R4/valueset-condition-ver-status.html
    rank = hypothesis.get("rank", 999)
    is_forced = hypothesis.get("forced_inclusion", False)
    
    if rank == 1:
        verification_status = "provisional"
    else:
        verification_status = "differential"
    
    # Build base resource
    fhir_condition = {
        "resourceType": "Condition",
        "id": condition_id,
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
            "profile": [
                "http://hl7.org/fhir/StructureDefinition/Condition"
            ]
        },
        "clinicalStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                "code": "active",
                "display": "Active"
            }],
            "text": "Active"
        },
        "verificationStatus": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                "code": verification_status,
                "display": verification_status.capitalize()
            }],
            "text": verification_status.capitalize()
        },
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                "code": "encounter-diagnosis",
                "display": "Encounter Diagnosis"
            }],
            "text": "Encounter Diagnosis"
        }],
        "code": {
            "coding": [{
                "system": "http://hl7.org/fhir/sid/icd-10-cm",
                "code": icd10,
                "display": hypothesis.get("hypothesis", hypothesis.get("diagnosis", "Unknown condition"))
            }],
            "text": hypothesis.get("hypothesis", hypothesis.get("diagnosis", "Unknown condition"))
        },
        "subject": {
            "reference": f"Patient/{patient_ref}",
            "type": "Patient"
        },
    }
    
    # Add encounter reference if provided
    if encounter_ref:
        fhir_condition["encounter"] = {
            "reference": f"Encounter/{encounter_ref}",
            "type": "Encounter"
        }
    
    # Add severity based on is_critical flag
    # Reference: SNOMED CT Severity codes
    if hypothesis.get("is_critical"):
        fhir_condition["severity"] = {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "24484000",
                "display": "Severe"
            }],
            "text": "Severe"
        }
    
    # Build extensions
    extensions = build_condition_extensions(hypothesis)
    
    # Add forced inclusion extension if applicable
    if is_forced:
        extensions.append({
            "url": "http://gelani.ai/fhir/StructureDefinition/forced-critical-inclusion",
            "valueBoolean": True
        })
    
    if extensions:
        fhir_condition["extension"] = extensions
    
    # Build note with Bayesian summary
    posterior = hypothesis.get("posterior_probability", 0)
    rank = hypothesis.get("rank", 0)
    total = hypothesis.get("total_in_differential", rank)
    evidence_pmids = hypothesis.get("evidence_pmids", [])
    
    evidence_note = ", ".join([f"PMID:{p}" for p in evidence_pmids[:3]]) if evidence_pmids else "No direct evidence cited"
    
    fhir_condition["note"] = [{
        "text": f"Bayesian posterior: {posterior:.1%} (rank {rank} of {total}). Evidence: {evidence_note}"
    }]
    
    return fhir_condition


# =============================================================================
# OBSERVATION MAPPER
# =============================================================================

# LOINC codes for vital signs and clinical measurements
# Reference: LOINC Database (https://loinc.org/)
LOINC_CODES = {
    "heart_rate": {
        "code": "8867-4",
        "display": "Heart rate",
        "unit": "/min",
        "system": "http://loinc.org"
    },
    "systolic_bp": {
        "code": "8480-6",
        "display": "Systolic blood pressure",
        "unit": "mm[Hg]",
        "system": "http://loinc.org"
    },
    "diastolic_bp": {
        "code": "8462-4",
        "display": "Diastolic blood pressure",
        "unit": "mm[Hg]",
        "system": "http://loinc.org"
    },
    "temperature_c": {
        "code": "8310-5",
        "display": "Body temperature",
        "unit": "Cel",
        "system": "http://loinc.org"
    },
    "respiratory_rate": {
        "code": "9279-1",
        "display": "Respiratory rate",
        "unit": "/min",
        "system": "http://loinc.org"
    },
    "o2_saturation": {
        "code": "59408-5",
        "display": "Oxygen saturation in Arterial blood",
        "unit": "%",
        "system": "http://loinc.org"
    },
    "serum_creatinine": {
        "code": "2160-0",
        "display": "Creatinine [Mass/volume] in Serum or Plasma",
        "unit": "mg/dL",
        "system": "http://loinc.org"
    },
    "serum_glucose": {
        "code": "2345-7",
        "display": "Glucose [Mass/volume] in Serum or Plasma",
        "unit": "mg/dL",
        "system": "http://loinc.org"
    },
    "qtc_fridericia_ms": {
        "code": "8634-8",
        "display": "QT interval corrected - Fridericia",
        "unit": "ms",
        "system": "http://loinc.org"
    },
    "crcl_ml_min": {
        "code": "33914-3",
        "display": "Creatinine clearance",
        "unit": "mL/min",
        "system": "http://loinc.org"
    },
}


def map_observations(
    clinical_data: Dict[str, Any],
    patient_ref: str,
    encounter_datetime: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Map vitals and computed values to FHIR R4 Observation resources.
    
    Uses LOINC codes throughout for standardization.
    
    Key features:
    - QTc interpretation based on gender-specific thresholds
    - Renal bracket extension on creatinine clearance
    - US Core Vital Signs profile for vitals
    
    Evidence Sources:
    - LOINC Code System: https://loinc.org/
    - US Core Vital Signs: https://www.hl7.org/fhir/us/core/StructureDefinition-us-core-vital-signs.html
    - Fridericia QTc correction: Fridericia LS. "Die Systolendauer im Elektrokardiogramm"
    
    Args:
        clinical_data: Dictionary with clinical measurements
        patient_ref: Reference to Patient resource
        encounter_datetime: ISO8601 timestamp of encounter
        
    Returns:
        List of FHIR R4 Observation resources
    """
    observations = []
    effective_datetime = encounter_datetime or datetime.utcnow().isoformat() + "Z"
    
    # Gender for QTc interpretation thresholds
    gender = clinical_data.get("gender", "unknown").lower()
    
    for field_name, value in clinical_data.items():
        # Skip non-measurement fields
        if field_name not in LOINC_CODES:
            continue
        
        # Skip None/empty values
        if value is None:
            continue
        
        loinc_info = LOINC_CODES[field_name]
        
        # Generate deterministic ID
        obs_id = generate_resource_id(patient_ref, loinc_info["code"], field_name)
        
        # Build base observation
        observation = {
            "resourceType": "Observation",
            "id": obs_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.utcnow().isoformat() + "Z",
                "profile": [
                    "http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs"
                ]
            },
            "status": "final",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "vital-signs",
                    "display": "Vital Signs"
                }],
                "text": "Vital Signs"
            }],
            "code": {
                "coding": [{
                    "system": loinc_info["system"],
                    "code": loinc_info["code"],
                    "display": loinc_info["display"]
                }],
                "text": loinc_info["display"]
            },
            "subject": {
                "reference": f"Patient/{patient_ref}",
                "type": "Patient"
            },
            "effectiveDateTime": effective_datetime,
            "valueQuantity": {
                "value": float(value),
                "unit": loinc_info["unit"],
                "system": "http://unitsofmeasure.org",
                "code": loinc_info["unit"]
            }
        }
        
        # Special handling for QTc - add interpretation
        if field_name == "qtc_fridericia_ms":
            qtc_value = float(value)
            
            # QTc thresholds (gender-specific)
            # Evidence: Rautaharju PM, et al. "AHA/ACCF/HRS Recommendations"
            if gender in ("f", "female"):
                normal_threshold = 450
            else:
                normal_threshold = 440
            
            if qtc_value < normal_threshold:
                interpretation_code = "N"
                interpretation_display = "Normal"
            elif qtc_value <= 500:
                interpretation_code = "H"
                interpretation_display = "High"
            else:
                interpretation_code = "HH"
                interpretation_display = "Critical High"
                # Add warning note for QTc > 500ms
                observation["note"] = [{
                    "text": "QTc >500ms: high risk torsades de pointes. Review all QT-prolonging agents."
                }]
            
            observation["interpretation"] = [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                    "code": interpretation_code,
                    "display": interpretation_display
                }],
                "text": interpretation_display
            }]
        
        # Special handling for CrCl - add renal bracket extension
        if field_name == "crcl_ml_min":
            crcl_value = float(value)
            
            # Determine renal bracket using Cockcroft-Gault
            # Evidence: Cockcroft DW, Gault MH. Nephron 1976
            if crcl_value >= 90:
                bracket = "normal"
            elif crcl_value >= 60:
                bracket = "mild"
            elif crcl_value >= 30:
                bracket = "moderate"
            elif crcl_value >= 15:
                bracket = "severe"
            else:
                bracket = "esrd"
            
            observation["extension"] = [{
                "url": "http://gelani.ai/fhir/StructureDefinition/renal-dose-bracket",
                "valueString": bracket
            }]
        
        observations.append(observation)
    
    return observations


# =============================================================================
# MEDICATION REQUEST MAPPER
# =============================================================================

# SNOMED CT codes for route of administration
# Reference: SNOMED CT International Edition
ROUTE_SNOMED_CODES = {
    "IV": {"code": "47625008", "display": "Intravenous route"},
    "oral": {"code": "26643006", "display": "Oral route"},
    "PO": {"code": "26643006", "display": "Oral route"},
    "IM": {"code": "78421000", "display": "Intramuscular route"},
    "SC": {"code": "34206005", "display": "Subcutaneous route"},
    "SL": {"code": "37839007", "display": "Sublingual route"},
    "topical": {"code": "6064005", "display": "Topical route"},
    "inhaled": {"code": "186790110", "display": "Inhalation route"},
}


def map_medication_request(
    recommendation: Dict[str, Any],
    patient_ref: str,
    condition_refs: List[str],
    encounter_ref: Optional[str] = None
) -> Dict[str, Any]:
    """
    Map an antimicrobial recommendation to a FHIR R4 MedicationRequest.
    
    Key features:
    - status: "active" or "stopped" if CONTRAINDICATED DDI
    - intent: "proposal" (CDSS suggestion, not confirmed order)
    - Extensions for renal adjustment, DDI warnings, allergy override
    - RxNorm coding if available
    
    Evidence Sources:
    - FHIR R4 MedicationRequest: https://hl7.org/fhir/R4/medicationrequest.html
    - RxNorm: https://www.nlm.nih.gov/research/umls/rxnorm/
    - IDSA Antimicrobial Guidelines
    
    Args:
        recommendation: Dictionary with antimicrobial recommendation
        patient_ref: Reference to Patient resource
        condition_refs: List of Condition references for diagnoses
        encounter_ref: Optional Encounter reference
        
    Returns:
        FHIR R4 MedicationRequest resource as dictionary
    """
    drug_name = recommendation.get("drug_name", recommendation.get("name", "Unknown medication"))
    
    # Generate deterministic ID
    med_id = generate_resource_id(patient_ref, drug_name, encounter_ref or "no-encounter")
    
    # Determine status - check for contraindicated DDI
    status = "active"
    status_reason = None
    
    interaction_warnings = recommendation.get("interaction_warnings", [])
    for warning in interaction_warnings:
        if warning.get("severity") == "CONTRAINDICATED":
            status = "stopped"
            status_reason = {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/medicationrequest-status-reason",
                    "code": "contraindication",
                    "display": "Contraindication"
                }],
                "text": f"Contraindicated drug interaction: {warning.get('drug_a', '')} + {warning.get('drug_b', '')}"
            }
            break
    
    # Build base resource
    fhir_med_request = {
        "resourceType": "MedicationRequest",
        "id": med_id,
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
            "profile": [
                "http://hl7.org/fhir/StructureDefinition/MedicationRequest"
            ]
        },
        "status": status,
        "intent": "proposal",  # CDSS suggestion, not confirmed order
        "subject": {
            "reference": f"Patient/{patient_ref}",
            "type": "Patient"
        },
    }
    
    # Add status reason if stopped due to contraindication
    if status_reason:
        fhir_med_request["statusReason"] = status_reason
    
    # Add medication code
    medication_codeable = {"text": drug_name}
    
    # Add RxNorm coding if available
    if recommendation.get("rxnorm_code"):
        medication_codeable["coding"] = [{
            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
            "code": str(recommendation["rxnorm_code"]),
            "display": drug_name
        }]
    
    fhir_med_request["medicationCodeableConcept"] = medication_codeable
    
    # Add reason references (top diagnoses)
    if condition_refs:
        fhir_med_request["reasonReference"] = [
            {"reference": f"Condition/{ref}", "type": "Condition"}
            for ref in condition_refs[:3]  # Max 3 diagnoses
        ]
    
    # Build dosage instruction
    dose_string = recommendation.get("dose", recommendation.get("dose_string", ""))
    if dose_string:
        dosage = {"text": dose_string}
        
        # Parse route
        route_key = None
        dose_lower = dose_string.lower()
        if " iv " in dose_lower or dose_lower.startswith("iv "):
            route_key = "IV"
        elif " po " in dose_lower or " oral" in dose_lower:
            route_key = "oral"
        elif " im " in dose_lower:
            route_key = "IM"
        elif " sc " in dose_lower or " subcut" in dose_lower:
            route_key = "SC"
        elif " sl " in dose_lower or " sublingual" in dose_lower:
            route_key = "SL"
        
        if route_key and route_key in ROUTE_SNOMED_CODES:
            route_info = ROUTE_SNOMED_CODES[route_key]
            dosage["route"] = {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": route_info["code"],
                    "display": route_info["display"]
                }],
                "text": route_key
            }
        
        # Parse timing from dose string (e.g., "q8h", "q12h", "daily")
        import re
        timing_match = re.search(r'q(\d+)h', dose_lower)
        if timing_match:
            hours = int(timing_match.group(1))
            dosage["timing"] = {
                "repeat": {
                    "frequency": 1,
                    "period": hours,
                    "periodUnit": "h"
                }
            }
        elif "daily" in dose_lower or "once daily" in dose_lower:
            dosage["timing"] = {
                "repeat": {
                    "frequency": 1,
                    "period": 1,
                    "periodUnit": "d"
                }
            }
        
        fhir_med_request["dosageInstruction"] = [dosage]
    
    # Build extensions
    extensions = build_medication_request_extensions(recommendation)
    if extensions:
        fhir_med_request["extension"] = extensions
    
    # Add notes for renal adjustment
    if recommendation.get("renal_adjustment"):
        bracket = recommendation.get("renal_bracket", "unknown")
        standard_dose = recommendation.get("standard_dose", "unknown")
        adjusted_dose = recommendation.get("adjusted_dose", dose_string)
        
        note_text = (
            f"Dose adjusted for renal impairment. Bracket: {bracket}. "
            f"Standard dose: {standard_dose}. Adjusted dose: {adjusted_dose}. "
            f"Recommend therapeutic drug monitoring if applicable."
        )
        
        if "note" not in fhir_med_request:
            fhir_med_request["note"] = []
        fhir_med_request["note"].append({"text": note_text})
    
    return fhir_med_request


# =============================================================================
# BUNDLE BUILDER
# =============================================================================

def build_encounter_bundle(
    patient: Dict[str, Any],
    clinical_session: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Build a FHIR R4 Bundle of type "document" for a clinical encounter.
    
    Bundle contains:
    1. Composition (document root)
    2. Patient
    3. Condition entries (one per hypothesis)
    4. Observation entries (vitals and labs)
    5. MedicationRequest entries (recommendations)
    6. DocumentReference (optional, for SOAP note)
    
    Evidence Sources:
    - FHIR R4 Bundle: https://hl7.org/fhir/R4/bundle.html
    - FHIR Documents: https://hl7.org/fhir/R4/documents.html
    
    Args:
        patient: Patient data dictionary
        clinical_session: Dictionary containing:
            - encounter_id: str
            - chief_complaint: str
            - differential: list of hypothesis dicts
            - observations: clinical measurements dict
            - recommendations: list of antimicrobial recommendations
            - soap_note: SOAP note dict
            - rag_sources: list of retrieved chunks with PMIDs
            - audit_session_hash: hashed session token
            
    Returns:
        FHIR R4 Bundle resource as dictionary
    """
    # Generate bundle ID
    bundle_id = str(uuid4())
    
    # Hash patient ID
    patient_ref = hash_patient_id(str(patient.get("id", "unknown")))
    
    # Build resources list
    resources = []
    
    # 1. Build Patient resource
    fhir_patient = map_patient(patient)
    resources.append(fhir_patient)
    
    # 2. Build Condition resources from differential
    encounter_id = clinical_session.get("encounter_id", "unknown")
    differential = clinical_session.get("differential", [])
    condition_refs = []
    
    total_in_differential = len(differential)
    
    for hypothesis in differential:
        hypothesis["total_in_differential"] = total_in_differential
        fhir_condition = map_condition(
            hypothesis=hypothesis,
            patient_ref=patient_ref,
            encounter_ref=encounter_id
        )
        condition_refs.append(fhir_condition["id"])
        resources.append(fhir_condition)
    
    # 3. Build Observation resources
    observations_data = clinical_session.get("observations", {})
    if observations_data:
        # Add gender for QTc interpretation
        observations_data["gender"] = patient.get("gender", "unknown")
        fhir_observations = map_observations(
            clinical_data=observations_data,
            patient_ref=patient_ref
        )
        resources.extend(fhir_observations)
    
    # 4. Build MedicationRequest resources
    recommendations = clinical_session.get("recommendations", [])
    top_condition_refs = condition_refs[:3] if condition_refs else []
    
    for rec in recommendations:
        fhir_med = map_medication_request(
            recommendation=rec,
            patient_ref=patient_ref,
            condition_refs=top_condition_refs,
            encounter_ref=encounter_id
        )
        resources.append(fhir_med)
    
    # 5. Build Composition resource (document root)
    composition_id = generate_resource_id(patient_ref, "composition", encounter_id)
    
    composition = {
        "resourceType": "Composition",
        "id": composition_id,
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
            "profile": [
                "http://hl7.org/fhir/StructureDefinition/clinicaldocument"
            ]
        },
        "status": "preliminary",  # CDSS output, not finalized by clinician
        "type": {
            "coding": [{
                "system": "http://loinc.org",
                "code": "11488-4",
                "display": "Consult note"
            }],
            "text": "Consult Note"
        },
        "title": "Gelani CDSS Clinical Decision Support Report",
        "subject": {
            "reference": f"Patient/{patient_ref}",
            "type": "Patient"
        },
        "date": datetime.utcnow().isoformat() + "Z",
        "author": [{
            "display": f"Gelani Healthcare AI System v{GELANI_VERSION}"
            # NEVER impersonate a human clinician
        }],
        # attester omitted - attestation must come from real clinician
    }
    
    # Add audit session extension
    audit_hash = clinical_session.get("audit_session_hash")
    if audit_hash:
        composition["extension"] = [
            build_audit_session_extension(audit_hash)
        ]
    
    # Build Composition sections
    sections = []
    
    # Section: Chief Complaint
    chief_complaint = clinical_session.get("chief_complaint", "")
    if chief_complaint:
        sections.append({
            "title": "Chief Complaint",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "10154-3",
                    "display": "Chief complaint"
                }]
            },
            "text": {
                "status": "generated",
                "div": f'<div xmlns="http://www.w3.org/1999/xhtml">{chief_complaint}</div>'
            }
        })
    
    # Section: Assessment (referencing Conditions)
    if condition_refs:
        sections.append({
            "title": "Assessment",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "51848-0",
                    "display": "Assessment"
                }]
            },
            "entry": [
                {"reference": f"Condition/{ref}"}
                for ref in condition_refs
            ]
        })
    
    # Section: Plan (referencing MedicationRequests)
    med_refs = [r["id"] for r in resources if r["resourceType"] == "MedicationRequest"]
    if med_refs:
        sections.append({
            "title": "Plan",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "18776-5",
                    "display": "Plan of care"
                }]
            },
            "entry": [
                {"reference": f"MedicationRequest/{ref}"}
                for ref in med_refs
            ]
        })
    
    # Section: Observations
    obs_refs = [r["id"] for r in resources if r["resourceType"] == "Observation"]
    if obs_refs:
        sections.append({
            "title": "Observations",
            "code": {
                "coding": [{
                    "system": "http://loinc.org",
                    "code": "30954-2",
                    "display": "Relevant diagnostic tests/laboratory data"
                }]
            },
            "entry": [
                {"reference": f"Observation/{ref}"}
                for ref in obs_refs
            ]
        })
    
    # Section: Evidence Sources
    rag_sources = clinical_session.get("rag_sources", [])
    if rag_sources:
        evidence_lines = []
        for source in rag_sources[:10]:  # Limit to 10
            pmid = source.get("pmid", "")
            title = source.get("title", "Unknown title")
            year = source.get("year", "")
            evidence_lines.append(f"[PMID {pmid}] {title} ({year})")
        
        evidence_text = "<br/>".join(evidence_lines)
        sections.append({
            "title": "Evidence Sources",
            "text": {
                "status": "generated",
                "div": f'<div xmlns="http://www.w3.org/1999/xhtml">{evidence_text}</div>'
            }
        })
    
    composition["section"] = sections
    resources.insert(0, composition)  # Composition first
    
    # 6. Build Bundle
    bundle = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "meta": {
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
            "tag": [{
                "system": "http://gelani.ai/fhir/tags",
                "code": "cdss-generated",
                "display": "AI-generated clinical decision support - requires clinician review"
            }]
        },
        "identifier": {
            "system": "http://gelani.ai/fhir/bundle-id",
            "value": bundle_id
        },
        "type": "document",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "entry": []
    }
    
    # Add entries
    for resource in resources:
        bundle["entry"].append({
            "fullUrl": f"urn:uuid:{resource['id']}",
            "resource": resource
        })
    
    logger.info(
        f"Built FHIR Bundle with {len(bundle['entry'])} resources: "
        f"Composition=1, Patient=1, Conditions={len(condition_refs)}, "
        f"Observations={len(obs_refs)}, MedicationRequests={len(med_refs)}"
    )
    
    return bundle

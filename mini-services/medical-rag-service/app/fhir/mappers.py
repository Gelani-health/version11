"""
FHIR R4 Resource Mappers
========================

Pure Python functions that map internal data models to FHIR R4 compliant JSON.

FHIR R4 Specification Reference:
- https://hl7.org/fhir/R4/

This module implements mappers for:
1. Patient - Core patient demographics
2. Composition - Clinical consultation notes (SOAP)
3. ServiceRequest - Diagnostic requests
4. Condition - Clinical conditions/diagnoses

Evidence Sources:
- HL7 FHIR R4 Specification: https://hl7.org/fhir/R4/
- LOINC Code System: https://loinc.org/
- SNOMED CT: https://www.snomed.org/
- ICD-10: https://www.who.int/standards/classifications

Author: Gelani Healthcare Assistant
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import uuid4


# =============================================================================
# FHIR R4 CONSTANTS
# =============================================================================

# FHIR Resource Types
FHIR_RESOURCE_PATIENT = "Patient"
FHIR_RESOURCE_COMPOSITION = "Composition"
FHIR_RESOURCE_SERVICE_REQUEST = "ServiceRequest"
FHIR_RESOURCE_CONDITION = "Condition"
FHIR_RESOURCE_BUNDLE = "Bundle"

# LOINC Codes for Clinical Documents
# Reference: LOINC - Regents of the University of California
# https://loinc.org/11488-4/
LOINC_CONSULTATION_NOTE = "11488-4"
LOINC_CONSULTATION_NOTE_DISPLAY = "Consultation note"

# LOINC codes for SOAP sections
# Reference: LOINC Document Ontology
LOINC_HISTORY_OF_PRESENT_ILLNESS = "10164-2"  # HPI
LOINC_HISTORY_OF_PRESENT_ILLNESS_DISPLAY = "History of Present illness"

LOINC_PHYSICAL_EXAM = "29545-1"
LOINC_PHYSICAL_EXAM_DISPLAY = "Physical examination"

LOINC_ASSESSMENT = "51848-0"
LOINC_ASSESSMENT_DISPLAY = "Assessment"

LOINC_PLAN = "18776-5"
LOINC_PLAN_DISPLAY = "Plan of care"

# Default FHIR namespaces
FHIR_DEFAULT_NAMESPACE = "urn:uuid:"


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def generate_uuid() -> str:
    """Generate a UUID for FHIR resource IDs."""
    return str(uuid4())


def format_fhir_date(date_value: Any) -> str:
    """
    Format a date for FHIR compliance.
    
    FHIR date format: YYYY-MM-DD or YYYY-MM-DDThh:mm:ss+zz:zz
    
    Args:
        date_value: DateTime object or ISO string
        
    Returns:
        FHIR-compliant date string
    """
    if date_value is None:
        return datetime.utcnow().strftime("%Y-%m-%d")
    
    if isinstance(date_value, str):
        # Already a string, try to parse and reformat
        try:
            # Handle various ISO formats
            if "T" in date_value:
                parsed = datetime.fromisoformat(date_value.replace("Z", "+00:00"))
                return parsed.strftime("%Y-%m-%d")
            return date_value.split("T")[0].split(" ")[0]
        except (ValueError, AttributeError):
            return datetime.utcnow().strftime("%Y-%m-%d")
    
    if isinstance(date_value, datetime):
        return date_value.strftime("%Y-%m-%d")
    
    return datetime.utcnow().strftime("%Y-%m-%d")


def format_fhir_datetime(date_value: Any) -> str:
    """
    Format a datetime for FHIR compliance.
    
    FHIR dateTime format: YYYY-MM-DDThh:mm:ss+zz:zz
    
    Args:
        date_value: DateTime object or ISO string
        
    Returns:
        FHIR-compliant dateTime string
    """
    if date_value is None:
        return datetime.utcnow().isoformat() + "Z"
    
    if isinstance(date_value, str):
        # Already a string, normalize format
        try:
            if "T" in date_value:
                # Ensure proper timezone format
                if date_value.endswith("Z"):
                    return date_value
                elif "+" in date_value or date_value.count("-") > 2:
                    return date_value
                else:
                    return date_value + "Z"
            else:
                # Date only, add time
                parsed = datetime.fromisoformat(date_value)
                return parsed.isoformat() + "Z"
        except (ValueError, AttributeError):
            return datetime.utcnow().isoformat() + "Z"
    
    if isinstance(date_value, datetime):
        return date_value.isoformat() + "Z"
    
    return datetime.utcnow().isoformat() + "Z"


def create_coding(
    system: str,
    code: str,
    display: Optional[str] = None,
    version: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a FHIR Coding data type.
    
    Reference: https://hl7.org/fhir/R4/datatypes.html#Coding
    
    Args:
        system: Identity of the terminology system
        code: Symbol in syntax defined by the system
        display: Representation defined by the system
        version: Version of the system
        
    Returns:
        FHIR Coding object
    """
    coding = {
        "system": system,
        "code": code,
    }
    if display:
        coding["display"] = display
    if version:
        coding["version"] = version
    return coding


def create_codeable_concept(
    codings: List[Dict[str, Any]],
    text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a FHIR CodeableConcept data type.
    
    Reference: https://hl7.org/fhir/R4/datatypes.html#CodeableConcept
    
    Args:
        codings: List of Coding objects
        text: Plain text representation
        
    Returns:
        FHIR CodeableConcept object
    """
    concept = {"coding": codings}
    if text:
        concept["text"] = text
    return concept


def create_reference(
    reference: str,
    display: Optional[str] = None,
    type_: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a FHIR Reference data type.
    
    Reference: https://hl7.org/fhir/R4/references.html#Reference
    
    Args:
        reference: Literal reference (relative or absolute URL)
        display: Text alternative for the resource
        type_: Type the reference refers to
        
    Returns:
        FHIR Reference object
    """
    ref = {"reference": reference}
    if display:
        ref["display"] = display
    if type_:
        ref["type"] = type_
    return ref


def create_human_name(
    family: str,
    given: List[str],
    use: str = "official",
    text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a FHIR HumanName data type.
    
    Reference: https://hl7.org/fhir/R4/datatypes.html#HumanName
    
    Args:
        family: Family name (surname)
        given: Given names (first name, middle names)
        use: usual | official | temp | nickname | anonymous | old | maiden
        text: Text representation of full name
        
    Returns:
        FHIR HumanName object
    """
    name = {
        "use": use,
        "family": family,
        "given": given,
    }
    if text:
        name["text"] = text
    return name


def create_contact_point(
    system: str,
    value: str,
    use: str = "home"
) -> Dict[str, Any]:
    """
    Create a FHIR ContactPoint data type.
    
    Reference: https://hl7.org/fhir/R4/datatypes.html#ContactPoint
    
    Args:
        system: phone | fax | email | pager | url | sms | other
        value: The actual contact point details
        use: home | work | temp | old | mobile
        
    Returns:
        FHIR ContactPoint object
    """
    return {
        "system": system,
        "value": value,
        "use": use,
    }


# =============================================================================
# FHIR RESOURCE MAPPERS
# =============================================================================

def patient_to_fhir(patient_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map internal Patient model to FHIR R4 Patient resource.
    
    FHIR R4 Patient Resource:
    https://hl7.org/fhir/R4/patient.html
    
    Required Fields:
    - resourceType: "Patient"
    - id: Logical id of this artifact
    
    Mapped Fields:
    - identifier: MRN (Medical Record Number)
    - name: Patient name (given/family)
    - birthDate: Date of birth
    - gender: Administrative gender
    - telecom: Phone, email contacts
    
    Evidence Source:
    - HL7 FHIR R4 Patient Profile: https://hl7.org/fhir/R4/patient.html
    - US Core Patient Profile: https://www.hl7.org/fhir/us/core/StructureDefinition-us-core-patient.html
    
    Args:
        patient_dict: Dictionary containing patient data with fields:
            - id: Patient ID (required)
            - mrn: Medical Record Number
            - firstName: First name (required)
            - lastName: Last name (required)
            - middleName: Middle name (optional)
            - dateOfBirth: Date of birth (required)
            - gender: Gender (required: male, female, other, unknown)
            - phone: Phone number
            - email: Email address
            - nationalHealthId: National health ID
            
    Returns:
        FHIR R4 Patient resource as dictionary
    """
    # Generate or use existing ID
    patient_id = patient_dict.get("id", generate_uuid())
    
    # Build base resource
    fhir_patient = {
        "resourceType": FHIR_RESOURCE_PATIENT,
        "id": str(patient_id),
        "meta": {
            "versionId": "1",
            "lastUpdated": format_fhir_datetime(datetime.utcnow()),
            "profile": [
                "http://hl7.org/fhir/StructureDefinition/Patient"
            ]
        },
    }
    
    # Add identifiers (MRN, National Health ID)
    identifiers = []
    
    # MRN identifier
    if patient_dict.get("mrn"):
        identifiers.append({
            "use": "usual",
            "type": create_codeable_concept(
                codings=[create_coding(
                    system="http://terminology.hl7.org/CodeSystem/v2-0203",
                    code="MR",
                    display="Medical Record Number"
                )],
                text="Medical Record Number"
            ),
            "system": "urn:oid:2.16.840.1.113883.19.5",
            "value": patient_dict["mrn"],
        })
    
    # National Health ID
    if patient_dict.get("nationalHealthId"):
        identifiers.append({
            "use": "usual",
            "type": create_codeable_concept(
                codings=[create_coding(
                    system="http://terminology.hl7.org/CodeSystem/v2-0203",
                    code="NI",
                    display="National Identifier"
                )],
                text="National Health Identifier"
            ),
            "system": "urn:oid:2.16.840.1.113883.4.1",
            "value": patient_dict["nationalHealthId"],
        })
    
    if identifiers:
        fhir_patient["identifier"] = identifiers
    
    # Add name
    given_names = [patient_dict.get("firstName", "Unknown")]
    if patient_dict.get("middleName"):
        given_names.append(patient_dict["middleName"])
    
    family_name = patient_dict.get("lastName", "Unknown")
    full_name = f"{' '.join(given_names)} {family_name}".strip()
    
    fhir_patient["name"] = [
        create_human_name(
            family=family_name,
            given=given_names,
            use="official",
            text=full_name
        )
    ]
    
    # Add birthDate
    if patient_dict.get("dateOfBirth"):
        fhir_patient["birthDate"] = format_fhir_date(patient_dict["dateOfBirth"])
    
    # Add gender
    # FHIR requires: male | female | other | unknown
    gender_map = {
        "male": "male",
        "m": "male",
        "female": "female",
        "f": "female",
        "other": "other",
        "unknown": "unknown",
    }
    raw_gender = patient_dict.get("gender", "unknown").lower()
    fhir_patient["gender"] = gender_map.get(raw_gender, "unknown")
    
    # Add telecom (phone, email)
    telecom = []
    if patient_dict.get("phone"):
        telecom.append(create_contact_point(
            system="phone",
            value=patient_dict["phone"],
            use="home"
        ))
    if patient_dict.get("email"):
        telecom.append(create_contact_point(
            system="email",
            value=patient_dict["email"],
            use="home"
        ))
    if telecom:
        fhir_patient["telecom"] = telecom
    
    # Add address if available
    if patient_dict.get("address"):
        address = {
            "use": "home",
            "text": patient_dict["address"],
        }
        if patient_dict.get("city"):
            address["city"] = patient_dict["city"]
        if patient_dict.get("state"):
            address["state"] = patient_dict["state"]
        if patient_dict.get("postalCode"):
            address["postalCode"] = patient_dict["postalCode"]
        if patient_dict.get("country"):
            address["country"] = patient_dict["country"]
        fhir_patient["address"] = [address]
    
    # Add active status
    fhir_patient["active"] = patient_dict.get("isActive", True)
    
    return fhir_patient


def soap_note_to_fhir(
    note_dict: Dict[str, Any],
    patient_id: str
) -> Dict[str, Any]:
    """
    Map internal SOAP Note model to FHIR R4 Composition resource.
    
    FHIR R4 Composition Resource:
    https://hl7.org/fhir/R4/composition.html
    
    The SOAP note is mapped as a clinical consultation document with
    sections for each component of the SOAP format.
    
    Required Fields:
    - resourceType: "Composition"
    - id: Logical id
    - status: preliminary | final | amended | entered-in-error
    - type: Kind of composition (LOINC code)
    - subject: Who and/or what the composition is about
    - date: Composition editing time
    - author: Who and/or what authored the composition
    - title: Human Readable name/title
    
    Mapped Sections:
    - Subjective: History of Present Illness (LOINC 10164-2)
    - Objective: Physical Examination (LOINC 29545-1)
    - Assessment: Assessment (LOINC 51848-0)
    - Plan: Plan of Care (LOINC 18776-5)
    
    Evidence Source:
    - HL7 FHIR R4 Composition: https://hl7.org/fhir/R4/composition.html
    - LOINC Document Codes: https://loinc.org/document-ontology/
    - C-CDA Consultation Note: https://www.hl7.org/implement/standards/product_brief.cfm?product_id=492
    
    Args:
        note_dict: Dictionary containing SOAP note data
        patient_id: Reference to the patient
        
    Returns:
        FHIR R4 Composition resource as dictionary
    """
    # Generate or use existing ID
    note_id = note_dict.get("id", generate_uuid())
    
    # Map status
    # FHIR: preliminary | final | amended | entered-in-error
    status_map = {
        "draft": "preliminary",
        "pending_review": "preliminary",
        "signed": "final",
        "amended": "amended",
        "cancelled": "entered-in-error",
    }
    raw_status = note_dict.get("status", "draft").lower()
    fhir_status = status_map.get(raw_status, "preliminary")
    
    # Build base resource
    fhir_composition = {
        "resourceType": FHIR_RESOURCE_COMPOSITION,
        "id": str(note_id),
        "meta": {
            "versionId": str(note_dict.get("lockVersion", 1)),
            "lastUpdated": format_fhir_datetime(note_dict.get("updatedAt", datetime.utcnow())),
            "profile": [
                "http://hl7.org/fhir/StructureDefinition/clinicaldocument"
            ]
        },
        "identifier": {
            "system": "urn:ietf:rfc:3986",
            "value": f"urn:uuid:{note_id}",
        },
        "status": fhir_status,
        "type": create_codeable_concept(
            codings=[
                create_coding(
                    system="http://loinc.org",
                    code=LOINC_CONSULTATION_NOTE,
                    display=LOINC_CONSULTATION_NOTE_DISPLAY
                )
            ],
            text="Consultation Note"
        ),
        "subject": create_reference(
            reference=f"Patient/{patient_id}",
            type_="Patient"
        ),
        "date": format_fhir_datetime(note_dict.get("createdAt", datetime.utcnow())),
        "author": [
            create_reference(
                reference=f"Practitioner/{note_dict.get('createdBy', 'unknown')}",
                display=note_dict.get("authorName", "Unknown Provider")
            )
        ],
        "title": note_dict.get("chiefComplaint", "Clinical Consultation Note"),
        "confidentiality": "N",  # Normal confidentiality
    }
    
    # Build sections array (S/O/A/P)
    sections = []
    
    # Section: Subjective (History of Present Illness)
    subjective_content = []
    if note_dict.get("hpiNarrative"):
        subjective_content.append(note_dict["hpiNarrative"])
    
    # Add HPI components
    hpi_parts = []
    if note_dict.get("hpiOnset"):
        hpi_parts.append(f"Onset: {note_dict['hpiOnset']}")
    if note_dict.get("hpiLocation"):
        hpi_parts.append(f"Location: {note_dict['hpiLocation']}")
    if note_dict.get("hpiDuration"):
        hpi_parts.append(f"Duration: {note_dict['hpiDuration']}")
    if note_dict.get("hpiCharacter"):
        hpi_parts.append(f"Character: {note_dict['hpiCharacter']}")
    if note_dict.get("hpiSeverity"):
        hpi_parts.append(f"Severity: {note_dict['hpiSeverity']}/10")
    if hpi_parts:
        subjective_content.append(" | ".join(hpi_parts))
    
    # Add ROS if present
    ros_parts = []
    for ros_field in ["rosConstitutional", "rosHeent", "rosCardiovascular", 
                      "rosRespiratory", "rosGastrointestinal", "rosGenitourinary",
                      "rosMusculoskeletal", "rosNeurological", "rosPsychiatric"]:
        if note_dict.get(ros_field):
            ros_name = ros_field.replace("ros", "").replace("_", " ")
            ros_parts.append(f"{ros_name}: {note_dict[ros_field]}")
    if ros_parts:
        subjective_content.append("Review of Systems: " + "; ".join(ros_parts))
    
    if subjective_content:
        sections.append({
            "title": "Subjective",
            "code": create_codeable_concept(
                codings=[create_coding(
                    system="http://loinc.org",
                    code=LOINC_HISTORY_OF_PRESENT_ILLNESS,
                    display=LOINC_HISTORY_OF_PRESENT_ILLNESS_DISPLAY
                )],
                text="History of Present Illness and Review of Systems"
            ),
            "text": {
                "status": "generated",
                "div": f'<div xmlns="http://www.w3.org/1999/xhtml">{". ".join(subjective_content)}</div>'
            },
            "mode": "snapshot",
        })
    
    # Section: Objective (Physical Examination)
    objective_content = []
    
    # Add vitals if present
    if note_dict.get("vitals"):
        vitals = note_dict["vitals"]
        vitals_str = []
        if vitals.get("temperature"):
            vitals_str.append(f"T: {vitals['temperature']}")
        if vitals.get("bloodPressureSystolic") and vitals.get("bloodPressureDiastolic"):
            vitals_str.append(f"BP: {vitals['bloodPressureSystolic']}/{vitals['bloodPressureDiastolic']}")
        if vitals.get("heartRate"):
            vitals_str.append(f"HR: {vitals['heartRate']}")
        if vitals.get("respiratoryRate"):
            vitals_str.append(f"RR: {vitals['respiratoryRate']}")
        if vitals.get("oxygenSaturation"):
            vitals_str.append(f"SpO2: {vitals['oxygenSaturation']}%")
        if vitals_str:
            objective_content.append("Vital Signs: " + ", ".join(vitals_str))
    
    # Add physical exam findings
    pe_parts = []
    for pe_field in ["peConstitutional", "peHeent", "peCardiovascular",
                     "peRespiratory", "peGastrointestinal", "peGenitourinary",
                     "peMusculoskeletal", "peNeurological", "peSkin"]:
        if note_dict.get(pe_field):
            pe_name = pe_field.replace("pe", "").replace("_", " ")
            pe_parts.append(f"{pe_name}: {note_dict[pe_field]}")
    if pe_parts:
        objective_content.append("Physical Exam: " + "; ".join(pe_parts))
    
    # Add diagnostic results if present
    if note_dict.get("diagnosticResults"):
        objective_content.append(f"Diagnostic Results: {note_dict['diagnosticResults']}")
    
    if objective_content:
        sections.append({
            "title": "Objective",
            "code": create_codeable_concept(
                codings=[create_coding(
                    system="http://loinc.org",
                    code=LOINC_PHYSICAL_EXAM,
                    display=LOINC_PHYSICAL_EXAM_DISPLAY
                )],
                text="Physical Examination"
            ),
            "text": {
                "status": "generated",
                "div": f'<div xmlns="http://www.w3.org/1999/xhtml">{". ".join(objective_content)}</div>'
            },
            "mode": "snapshot",
        })
    
    # Section: Assessment
    assessment_content = []
    
    # Add primary diagnosis
    if note_dict.get("primaryDiagnosisDesc"):
        dx_code = note_dict.get("primaryDiagnosisCode", "")
        dx_desc = note_dict["primaryDiagnosisDesc"]
        if dx_code:
            assessment_content.append(f"Primary Diagnosis: {dx_desc} ({dx_code})")
        else:
            assessment_content.append(f"Primary Diagnosis: {dx_desc}")
    
    # Add clinical reasoning
    if note_dict.get("clinicalReasoning"):
        assessment_content.append(f"Clinical Reasoning: {note_dict['clinicalReasoning']}")
    
    # Add assessment items if present
    if note_dict.get("assessmentItems"):
        for item in note_dict["assessmentItems"]:
            item_text = item.get("diagnosis", "Unknown diagnosis")
            if item.get("icdCode"):
                item_text += f" ({item['icdCode']})"
            if item.get("isPrimary"):
                assessment_content.append(f"Primary: {item_text}")
            else:
                assessment_content.append(f"Differential: {item_text}")
    
    # Add differential diagnoses if present
    if note_dict.get("differentialDiagnoses"):
        for ddx in note_dict["differentialDiagnoses"]:
            ddx_text = ddx.get("description", "Unknown differential")
            if ddx.get("icdCode"):
                ddx_text += f" ({ddx['icdCode']})"
            confidence = ddx.get("confidence", 0)
            if confidence:
                ddx_text += f" - Confidence: {confidence:.0%}"
            assessment_content.append(f"DDx: {ddx_text}")
    
    # Add risk flags
    if note_dict.get("riskFlags"):
        assessment_content.append(f"Risk Flags: {note_dict['riskFlags']}")
    
    if assessment_content:
        sections.append({
            "title": "Assessment",
            "code": create_codeable_concept(
                codings=[create_coding(
                    system="http://loinc.org",
                    code=LOINC_ASSESSMENT,
                    display=LOINC_ASSESSMENT_DISPLAY
                )],
                text="Assessment"
            ),
            "text": {
                "status": "generated",
                "div": f'<div xmlns="http://www.w3.org/1999/xhtml">{". ".join(assessment_content)}</div>'
            },
            "mode": "snapshot",
        })
    
    # Section: Plan
    plan_content = []
    
    # Add investigations ordered
    if note_dict.get("investigationsOrdered"):
        plan_content.append(f"Investigations: {note_dict['investigationsOrdered']}")
    
    # Add medications prescribed
    if note_dict.get("medicationsPrescribed"):
        plan_content.append(f"Medications: {note_dict['medicationsPrescribed']}")
    
    # Add referrals
    if note_dict.get("referrals"):
        plan_content.append(f"Referrals: {note_dict['referrals']}")
    
    # Add patient education
    if note_dict.get("patientEducation"):
        plan_content.append(f"Patient Education: {note_dict['patientEducation']}")
    
    # Add follow-up
    if note_dict.get("followUpDate"):
        follow_up = format_fhir_date(note_dict["followUpDate"])
        follow_up_mode = note_dict.get("followUpMode", "clinic visit")
        plan_content.append(f"Follow-up: {follow_up} via {follow_up_mode}")
    
    # Add nursing instructions
    if note_dict.get("nursingInstructions"):
        plan_content.append(f"Nursing Instructions: {note_dict['nursingInstructions']}")
    
    # Add disposition
    if note_dict.get("disposition"):
        disposition = note_dict["disposition"]
        if note_dict.get("dispositionDestination"):
            disposition += f" to {note_dict['dispositionDestination']}"
        plan_content.append(f"Disposition: {disposition}")
    
    # Add plan items if present
    if note_dict.get("planItems"):
        for item in note_dict["planItems"]:
            category = item.get("category", "other")
            description = item.get("description", "")
            status = item.get("status", "pending")
            plan_content.append(f"{category.capitalize()}: {description} [{status}]")
    
    if plan_content:
        sections.append({
            "title": "Plan",
            "code": create_codeable_concept(
                codings=[create_coding(
                    system="http://loinc.org",
                    code=LOINC_PLAN,
                    display=LOINC_PLAN_DISPLAY
                )],
                text="Plan of Care"
            ),
            "text": {
                "status": "generated",
                "div": f'<div xmlns="http://www.w3.org/1999/xhtml">{". ".join(plan_content)}</div>'
            },
            "mode": "snapshot",
        })
    
    # Add sections to composition
    if sections:
        fhir_composition["section"] = sections
    
    return fhir_composition


def diagnostic_to_fhir(
    diagnostic_dict: Dict[str, Any],
    patient_id: str
) -> Dict[str, Any]:
    """
    Map internal diagnostic result to FHIR R4 ServiceRequest resource.
    
    FHIR R4 ServiceRequest Resource:
    https://hl7.org/fhir/R4/servicerequest.html
    
    This mapper represents a diagnostic workup or test order that was
    recommended based on the diagnostic analysis.
    
    Required Fields:
    - resourceType: "ServiceRequest"
    - id: Logical id
    - status: draft | active | suspended | completed | entered-in-error | cancelled
    - intent: proposal | plan | directive | order | original-order | reflex-order | filler-order | instance-order | option
    - subject: Individual or Entity the service is ordered for
    - code: What is being requested/ordered
    
    Evidence Source:
    - HL7 FHIR R4 ServiceRequest: https://hl7.org/fhir/R4/servicerequest.html
    - SNOMED CT Procedure Codes: https://www.snomed.org/
    
    Args:
        diagnostic_dict: Dictionary containing diagnostic data with fields:
            - id: Diagnostic ID
            - diagnosisName: Primary diagnosis/hypothesis
            - icdCode: ICD-10 code for the condition
            - snomedCode: SNOMED CT code for the procedure
            - status: Status of the diagnostic
            - recommendedTests: List of recommended tests
        patient_id: Reference to the patient
        
    Returns:
        FHIR R4 ServiceRequest resource as dictionary
    """
    # Generate or use existing ID
    diagnostic_id = diagnostic_dict.get("id", generate_uuid())
    
    # Map status
    status_map = {
        "pending": "active",
        "ordered": "active",
        "in-progress": "active",
        "completed": "completed",
        "cancelled": "cancelled",
        "draft": "draft",
    }
    raw_status = diagnostic_dict.get("status", "pending").lower()
    fhir_status = status_map.get(raw_status, "active")
    
    # Build code from diagnosis
    codings = []
    
    # Add SNOMED code if available
    if diagnostic_dict.get("snomedCode"):
        codings.append(create_coding(
            system="http://snomed.info/sct",
            code=diagnostic_dict["snomedCode"],
            display=diagnostic_dict.get("diagnosisName", "Diagnostic evaluation")
        ))
    
    # If no SNOMED, use a generic diagnostic evaluation code
    if not codings:
        codings.append(create_coding(
            system="http://snomed.info/sct",
            code="40100003",
            display="Diagnostic evaluation"
        ))
    
    # Build base resource
    fhir_service_request = {
        "resourceType": FHIR_RESOURCE_SERVICE_REQUEST,
        "id": str(diagnostic_id),
        "meta": {
            "versionId": "1",
            "lastUpdated": format_fhir_datetime(datetime.utcnow()),
            "profile": [
                "http://hl7.org/fhir/StructureDefinition/ServiceRequest"
            ]
        },
        "status": fhir_status,
        "intent": "order",
        "code": create_codeable_concept(
            codings=codings,
            text=diagnostic_dict.get("diagnosisName", "Diagnostic evaluation")
        ),
        "subject": create_reference(
            reference=f"Patient/{patient_id}",
            type_="Patient"
        ),
        "authoredOn": format_fhir_datetime(diagnostic_dict.get("createdAt", datetime.utcnow())),
    }
    
    # Add reasonCode (ICD-10 from top hypothesis)
    if diagnostic_dict.get("icdCode"):
        fhir_service_request["reasonCode"] = [
            create_codeable_concept(
                codings=[create_coding(
                    system="http://hl7.org/fhir/sid/icd-10",
                    code=diagnostic_dict["icdCode"],
                    display=diagnostic_dict.get("diagnosisName", "Condition")
                )],
                text=diagnostic_dict.get("diagnosisName", "Reason for order")
            )
        ]
    
    # Add order details if available
    if diagnostic_dict.get("orderedBy"):
        fhir_service_request["requester"] = create_reference(
            reference=f"Practitioner/{diagnostic_dict['orderedBy']}",
            type_="Practitioner"
        )
    
    # Add notes
    if diagnostic_dict.get("description") or diagnostic_dict.get("clinicalNotes"):
        fhir_service_request["note"] = [{
            "text": diagnostic_dict.get("description") or diagnostic_dict.get("clinicalNotes")
        }]
    
    # Add priority
    priority_map = {
        "routine": "routine",
        "urgent": "urgent",
        "stat": "stat",
        "asap": "asap",
    }
    if diagnostic_dict.get("priority"):
        fhir_service_request["priority"] = priority_map.get(
            diagnostic_dict["priority"].lower(), "routine"
        )
    
    return fhir_service_request


def assessment_item_to_fhir(
    item_dict: Dict[str, Any],
    patient_id: str
) -> Dict[str, Any]:
    """
    Map internal Assessment Item to FHIR R4 Condition resource.
    
    FHIR R4 Condition Resource:
    https://hl7.org/fhir/R4/condition.html
    
    This mapper represents a diagnosis or clinical condition as a FHIR Condition.
    
    Required Fields:
    - resourceType: "Condition"
    - id: Logical id
    - subject: Who has the condition
    - code: Identification of the condition
    
    Additional Fields:
    - clinicalStatus: active | recurrence | relapse | inactive | remission | resolved
    - verificationStatus: unconfirmed | provisional | differential | confirmed | refuted | entered-in-error
    
    Evidence Source:
    - HL7 FHIR R4 Condition: https://hl7.org/fhir/R4/condition.html
    - ICD-10 Coding: https://www.who.int/standards/classifications/classification-of-diseases
    - SNOMED CT Clinical Findings: https://www.snomed.org/
    
    Args:
        item_dict: Dictionary containing assessment item data with fields:
            - id: Assessment item ID
            - diagnosis: Diagnosis description
            - icdCode: ICD-10 code
            - snomedCode: SNOMED CT code
            - status: Status of the condition
            - isPrimary: Is this the primary diagnosis
            - confidence: AI confidence score
            - notes: Additional notes
        patient_id: Reference to the patient
        
    Returns:
        FHIR R4 Condition resource as dictionary
    """
    # Generate or use existing ID
    item_id = item_dict.get("id", generate_uuid())
    
    # Map clinical status
    # FHIR: active | recurrence | relapse | inactive | remission | resolved
    status_map = {
        "active": "active",
        "resolved": "resolved",
        "ruled-out": "inactive",
        "ruled_out": "inactive",
        "provisional": "active",
        "confirmed": "active",
        "considering": "active",
        "managed": "active",
        "remission": "remission",
    }
    raw_status = item_dict.get("status", "active").lower()
    clinical_status = status_map.get(raw_status, "active")
    
    # Map verification status based on confidence and state
    # FHIR: unconfirmed | provisional | differential | confirmed | refuted | entered-in-error
    if raw_status in ["ruled-out", "ruled_out", "refuted"]:
        verification_status = "refuted"
    elif item_dict.get("isPrimary") or raw_status == "confirmed":
        verification_status = "confirmed"
    elif item_dict.get("confidence", 0) >= 0.8:
        verification_status = "confirmed"
    elif item_dict.get("confidence", 0) >= 0.5:
        verification_status = "provisional"
    else:
        verification_status = "differential"
    
    # Build codings for the condition
    codings = []
    
    # Add ICD-10 code if available
    if item_dict.get("icdCode"):
        codings.append(create_coding(
            system="http://hl7.org/fhir/sid/icd-10",
            code=item_dict["icdCode"],
            display=item_dict.get("diagnosis", "Condition")
        ))
    
    # Add SNOMED CT code if available
    if item_dict.get("snomedCode"):
        codings.append(create_coding(
            system="http://snomed.info/sct",
            code=item_dict["snomedCode"],
            display=item_dict.get("diagnosis", "Condition")
        ))
    
    # If no coding available, use text-only code
    if not codings:
        codings.append(create_coding(
            system="http://terminology.hl7.org/CodeSystem/data-absent-reason",
            code="unknown",
            display="Unknown"
        ))
    
    # Build base resource
    fhir_condition = {
        "resourceType": FHIR_RESOURCE_CONDITION,
        "id": str(item_id),
        "meta": {
            "versionId": "1",
            "lastUpdated": format_fhir_datetime(datetime.utcnow()),
            "profile": [
                "http://hl7.org/fhir/StructureDefinition/Condition"
            ]
        },
        "clinicalStatus": create_codeable_concept(
            codings=[create_coding(
                system="http://terminology.hl7.org/CodeSystem/condition-clinical",
                code=clinical_status,
                display=clinical_status.capitalize()
            )]
        ),
        "verificationStatus": create_codeable_concept(
            codings=[create_coding(
                system="http://terminology.hl7.org/CodeSystem/condition-ver-status",
                code=verification_status,
                display=verification_status.capitalize()
            )]
        ),
        "code": create_codeable_concept(
            codings=codings,
            text=item_dict.get("diagnosis", "Unknown condition")
        ),
        "subject": create_reference(
            reference=f"Patient/{patient_id}",
            type_="Patient"
        ),
    }
    
    # Add onset date if available
    if item_dict.get("onsetDate"):
        fhir_condition["onsetDateTime"] = format_fhir_datetime(item_dict["onsetDate"])
    
    # Add recorded date
    if item_dict.get("createdAt"):
        fhir_condition["recordedDate"] = format_fhir_datetime(item_dict["createdAt"])
    
    # Add asserter if available
    if item_dict.get("assertedBy"):
        fhir_condition["asserter"] = create_reference(
            reference=f"Practitioner/{item_dict['assertedBy']}",
            type_="Practitioner"
        )
    
    # Add notes
    if item_dict.get("notes"):
        fhir_condition["note"] = [{
            "text": item_dict["notes"]
        }]
    
    # Add category (problem-list-item or encounter-diagnosis)
    if item_dict.get("isPrimary"):
        fhir_condition["category"] = [
            create_codeable_concept(
                codings=[create_coding(
                    system="http://terminology.hl7.org/CodeSystem/condition-category",
                    code="encounter-diagnosis",
                    display="Encounter Diagnosis"
                )],
                text="Primary Diagnosis"
            )
        ]
    else:
        fhir_condition["category"] = [
            create_codeable_concept(
                codings=[create_coding(
                    system="http://terminology.hl7.org/CodeSystem/condition-category",
                    code="problem-list-item",
                    display="Problem List Item"
                )],
                text="Differential Diagnosis"
            )
        ]
    
    return fhir_condition


# =============================================================================
# BUNDLE CREATION
# =============================================================================

def create_fhir_bundle(
    resources: List[Dict[str, Any]],
    bundle_type: str = "document",
    bundle_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a FHIR R4 Bundle containing multiple resources.
    
    FHIR R4 Bundle Resource:
    https://hl7.org/fhir/R4/bundle.html
    
    This is used for the $everything operation to return all resources
    for a patient in a single response.
    
    Bundle Types:
    - document: The bundle is a document
    - collection: The bundle is a collection of resources
    - message: The bundle is a message
    - transaction: The bundle is a transaction
    - searchset: The bundle is a search result set
    
    Args:
        resources: List of FHIR resources to include
        bundle_type: Type of bundle (default: document)
        bundle_id: Optional bundle ID
        
    Returns:
        FHIR R4 Bundle resource as dictionary
    """
    bundle_id = bundle_id or generate_uuid()
    
    # Build entries array
    entries = []
    for resource in resources:
        resource_type = resource.get("resourceType", "Unknown")
        resource_id = resource.get("id", generate_uuid())
        
        entry = {
            "fullUrl": f"{FHIR_DEFAULT_NAMESPACE}{resource_id}",
            "resource": resource,
        }
        
        # Add request for transaction bundles
        if bundle_type == "transaction":
            entry["request"] = {
                "method": "PUT",
                "url": f"{resource_type}/{resource_id}"
            }
        
        entries.append(entry)
    
    # Build bundle
    bundle = {
        "resourceType": FHIR_RESOURCE_BUNDLE,
        "id": bundle_id,
        "meta": {
            "lastUpdated": format_fhir_datetime(datetime.utcnow()),
        },
        "type": bundle_type,
        "timestamp": format_fhir_datetime(datetime.utcnow()),
        "entry": entries,
    }
    
    # Add total count for searchset bundles
    if bundle_type == "searchset":
        bundle["total"] = len(entries)
    
    return bundle


# =============================================================================
# VALIDATION
# =============================================================================

def validate_fhir_resource(resource: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Basic validation of a FHIR resource.
    
    This performs structural validation only. For full validation,
    use the FHIR Validator at https://validator.fhir.org/
    
    Args:
        resource: FHIR resource dictionary
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    # Check required resourceType
    if "resourceType" not in resource:
        errors.append("Missing required field: resourceType")
    
    resource_type = resource.get("resourceType")
    
    # Check required id
    if "id" not in resource:
        errors.append("Missing required field: id")
    
    # Type-specific validation
    if resource_type == FHIR_RESOURCE_PATIENT:
        if "gender" not in resource:
            errors.append("Patient requires gender field")
    
    elif resource_type == FHIR_RESOURCE_COMPOSITION:
        required_fields = ["status", "type", "subject", "date", "author", "title"]
        for field in required_fields:
            if field not in resource:
                errors.append(f"Composition requires {field} field")
    
    elif resource_type == FHIR_RESOURCE_SERVICE_REQUEST:
        required_fields = ["status", "intent", "subject", "code"]
        for field in required_fields:
            if field not in resource:
                errors.append(f"ServiceRequest requires {field} field")
    
    elif resource_type == FHIR_RESOURCE_CONDITION:
        required_fields = ["subject", "code"]
        for field in required_fields:
            if field not in resource:
                errors.append(f"Condition requires {field} field")
    
    elif resource_type == FHIR_RESOURCE_BUNDLE:
        if "type" not in resource:
            errors.append("Bundle requires type field")
        if "entry" not in resource:
            errors.append("Bundle requires entry field")
    
    return len(errors) == 0, errors

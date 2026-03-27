"""
FHIR R4 Resource Mappers Package
================================

This package provides FHIR R4 compliant resource mapping functions
for healthcare interoperability.

Modules:
- mappers: Pure Python functions to map internal data models to FHIR R4 resources
- extensions: Custom FHIR extension URLs and builders for Gelani-specific data
- bundle_builder: Comprehensive encounter bundle builder with Bayesian extensions

Supported FHIR R4 Resources:
- Patient: Core patient demographics
- Composition: Clinical consultation notes (SOAP)
- ServiceRequest: Diagnostic requests
- Condition: Clinical conditions/diagnoses
- Observation: Vital signs and lab results with LOINC codes
- MedicationRequest: Antimicrobial recommendations with DDI handling
- Bundle: Collections of resources

PROMPT 12: FHIR R4 Export Implementation
- SHA-256 hashing for patient IDs (never expose raw DB IDs)
- Bayesian posterior probability extensions
- Evidence PMID extensions
- LOINC-coded observations
- MedicationRequest with DDI and allergy handling

Usage:
    from app.fhir.mappers import (
        patient_to_fhir,
        soap_note_to_fhir,
        diagnostic_to_fhir,
        assessment_item_to_fhir,
        create_fhir_bundle,
    )
    
    from app.fhir.bundle_builder import (
        build_encounter_bundle,
        map_patient,
        map_condition,
        map_observations,
        map_medication_request,
    )
    
    from app.fhir.extensions import (
        build_extension,
        build_posterior_probability_extension,
        build_pmid_extension,
    )

    fhir_patient = patient_to_fhir(patient_dict)
    fhir_bundle = create_fhir_bundle([fhir_patient], bundle_type="document")
"""

from app.fhir.mappers import (
    patient_to_fhir,
    soap_note_to_fhir,
    diagnostic_to_fhir,
    assessment_item_to_fhir,
    create_fhir_bundle,
    validate_fhir_resource,
    generate_uuid,
    generate_resource_id,
    hash_patient_id,
    format_fhir_date,
    format_fhir_datetime,
    create_coding,
    create_codeable_concept,
    create_reference,
    create_human_name,
    create_contact_point,
)

from app.fhir.extensions import (
    # Extension URLs
    EXT_EVIDENCE_PMID,
    EXT_POSTERIOR_PROB,
    EXT_BAYESIAN_RANK,
    EXT_FORCED_INCLUSION,
    EXT_RENAL_BRACKET,
    EXT_DDI_WARNING,
    EXT_ALLERGY_OVERRIDE,
    EXT_ANTIBIOGRAM_SUSC,
    EXT_RAG_NAMESPACE,
    EXT_AUDIT_SESSION,
    # Extension builders
    build_extension,
    build_pmid_extension,
    build_posterior_probability_extension,
    build_bayesian_rank_extension,
    build_forced_inclusion_extension,
    build_renal_bracket_extension,
    build_ddi_warning_extension,
    build_allergy_override_extension,
    build_antibiogram_susceptibility_extension,
    build_rag_namespace_extension,
    build_audit_session_extension,
    build_condition_extensions,
    build_medication_request_extensions,
)

from app.fhir.bundle_builder import (
    build_encounter_bundle,
    map_patient as build_patient_resource,
    map_condition as build_condition_resource,
    map_observations as build_observation_resources,
    map_medication_request as build_medication_request_resource,
    hash_patient_id as bundle_hash_patient_id,
    generate_resource_id as bundle_generate_resource_id,
    LOINC_CODES,
    ROUTE_SNOMED_CODES,
)

__all__ = [
    # Mappers
    "patient_to_fhir",
    "soap_note_to_fhir",
    "diagnostic_to_fhir",
    "assessment_item_to_fhir",
    "create_fhir_bundle",
    "validate_fhir_resource",
    "generate_uuid",
    "generate_resource_id",
    "hash_patient_id",
    "format_fhir_date",
    "format_fhir_datetime",
    "create_coding",
    "create_codeable_concept",
    "create_reference",
    "create_human_name",
    "create_contact_point",
    # Extension URLs
    "EXT_EVIDENCE_PMID",
    "EXT_POSTERIOR_PROB",
    "EXT_BAYESIAN_RANK",
    "EXT_FORCED_INCLUSION",
    "EXT_RENAL_BRACKET",
    "EXT_DDI_WARNING",
    "EXT_ALLERGY_OVERRIDE",
    "EXT_ANTIBIOGRAM_SUSC",
    "EXT_RAG_NAMESPACE",
    "EXT_AUDIT_SESSION",
    # Extension builders
    "build_extension",
    "build_pmid_extension",
    "build_posterior_probability_extension",
    "build_bayesian_rank_extension",
    "build_forced_inclusion_extension",
    "build_renal_bracket_extension",
    "build_ddi_warning_extension",
    "build_allergy_override_extension",
    "build_antibiogram_susceptibility_extension",
    "build_rag_namespace_extension",
    "build_audit_session_extension",
    "build_condition_extensions",
    "build_medication_request_extensions",
    # Bundle builder
    "build_encounter_bundle",
    "build_patient_resource",
    "build_condition_resource",
    "build_observation_resources",
    "build_medication_request_resource",
    "bundle_hash_patient_id",
    "bundle_generate_resource_id",
    "LOINC_CODES",
    "ROUTE_SNOMED_CODES",
]

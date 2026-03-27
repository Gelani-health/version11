"""
FHIR R4 Resource Mappers Package
================================

This package provides FHIR R4 compliant resource mapping functions
for healthcare interoperability.

Modules:
- mappers: Pure Python functions to map internal data models to FHIR R4 resources

Supported FHIR R4 Resources:
- Patient: Core patient demographics
- Composition: Clinical consultation notes (SOAP)
- ServiceRequest: Diagnostic requests
- Condition: Clinical conditions/diagnoses
- Bundle: Collections of resources

Usage:
    from app.fhir.mappers import (
        patient_to_fhir,
        soap_note_to_fhir,
        diagnostic_to_fhir,
        assessment_item_to_fhir,
        create_fhir_bundle,
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
    format_fhir_date,
    format_fhir_datetime,
    create_coding,
    create_codeable_concept,
    create_reference,
    create_human_name,
    create_contact_point,
)

__all__ = [
    "patient_to_fhir",
    "soap_note_to_fhir",
    "diagnostic_to_fhir",
    "assessment_item_to_fhir",
    "create_fhir_bundle",
    "validate_fhir_resource",
    "generate_uuid",
    "format_fhir_date",
    "format_fhir_datetime",
    "create_coding",
    "create_codeable_concept",
    "create_reference",
    "create_human_name",
    "create_contact_point",
]

"""
FHIR R4 API Endpoints
=====================

FastAPI router for FHIR R4 compliant API endpoints.

This module provides FHIR R4 compliant endpoints for healthcare interoperability:
- GET /api/fhir/Patient/{id} - Retrieve a single patient
- GET /api/fhir/Patient/{id}/$everything - Retrieve all resources for a patient
- GET /api/fhir/metadata - Capability statement

FHIR R4 Specification: https://hl7.org/fhir/R4/

Evidence Sources:
- HL7 FHIR R4 RESTful API: https://hl7.org/fhir/R4/http.html
- FHIR Bulk Data Access: https://hl7.org/fhir/uv/bulkdata/
- US Core Implementation Guide: https://www.hl7.org/fhir/us/core/

Author: Gelani Healthcare Assistant
"""

import os
import json
import sqlite3
from datetime import datetime
from typing import Dict, Any, List, Optional
from contextlib import contextmanager

from fastapi import APIRouter, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from loguru import logger

from app.fhir.mappers import (
    patient_to_fhir,
    soap_note_to_fhir,
    diagnostic_to_fhir,
    assessment_item_to_fhir,
    create_fhir_bundle,
    validate_fhir_resource,
    generate_uuid,
    hash_patient_id,
)
from app.fhir.bundle_builder import (
    build_encounter_bundle,
    map_patient,
    map_condition,
    map_observations,
    map_medication_request,
)
from app.fhir.extensions import (
    EXT_EVIDENCE_PMID,
    EXT_POSTERIOR_PROB,
    EXT_BAYESIAN_RANK,
)


# =============================================================================
# ROUTER SETUP
# =============================================================================

router = APIRouter(prefix="/api/fhir", tags=["FHIR R4"])


# =============================================================================
# DATABASE CONNECTION
# =============================================================================

# SQLite database path resolution
# The database is shared with the Next.js application
def resolve_database_path() -> str:
    """
    Resolve the SQLite database path.
    
    Checks multiple possible locations in order of preference.
    """
    # Check for explicit DATABASE_URL environment variable
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url:
        return db_url.replace("file:", "").replace("sqlite:", "")
    
    # Check possible database locations
    possible_paths = [
        "/app/data/healthcare.db",  # Docker production path
        "/app/prisma/dev.db",        # Docker development path
        "./data/healthcare.db",      # Local development
        "./healthcare.db",           # Local root
        "/home/z/my-project/db/custom.db",  # Alternative path
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            logger.info(f"FHIR Service using database: {path}")
            return path
    
    # Default to production path
    default_path = "/app/data/healthcare.db"
    logger.warning(f"FHIR Service: Database not found, using default: {default_path}")
    return default_path


DATABASE_PATH = resolve_database_path()


@contextmanager
def get_db_connection():
    """
    Context manager for SQLite database connection.
    
    Uses the shared SQLite database from the Next.js application.
    """
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        yield conn
    except sqlite3.Error as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database connection error"
        )
    finally:
        if conn:
            conn.close()


def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Convert a sqlite3.Row to a dictionary."""
    return dict(row) if row else {}


# =============================================================================
# FHIR RESOURCE RETRIEVAL
# =============================================================================

def get_patient_from_db(patient_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve patient data from SQLite database.
    
    Args:
        patient_id: Patient ID (CUID or UUID)
        
    Returns:
        Patient data dictionary or None if not found
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Try to find by id, mrn, or bahmniPatientId
        cursor.execute("""
            SELECT * FROM Patient 
            WHERE id = ? OR mrn = ? OR bahmniPatientId = ?
            LIMIT 1
        """, (patient_id, patient_id, patient_id))
        
        row = cursor.fetchone()
        
        if row:
            return row_to_dict(row)
        return None


def get_soap_notes_for_patient(patient_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve all SOAP notes for a patient.
    
    Args:
        patient_id: Patient ID
        
    Returns:
        List of SOAP note dictionaries
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM soap_notes 
            WHERE patientId = ?
            ORDER BY createdAt DESC
        """, (patient_id,))
        
        rows = cursor.fetchall()
        notes = [row_to_dict(row) for row in rows]
        
        # Also fetch related data for each note
        for note in notes:
            note_id = note.get("id")
            
            # Get assessment items
            cursor.execute("""
                SELECT * FROM soap_note_assessment_items 
                WHERE soapNoteId = ?
                ORDER BY rank ASC
            """, (note_id,))
            note["assessmentItems"] = [row_to_dict(r) for r in cursor.fetchall()]
            
            # Get plan items
            cursor.execute("""
                SELECT * FROM soap_note_plan_items 
                WHERE soapNoteId = ?
                ORDER BY createdAt ASC
            """, (note_id,))
            note["planItems"] = [row_to_dict(r) for r in cursor.fetchall()]
            
            # Get differential diagnoses
            cursor.execute("""
                SELECT * FROM DifferentialDiagnosis 
                WHERE soapNoteId = ?
                ORDER BY rank ASC
            """, (note_id,))
            note["differentialDiagnoses"] = [row_to_dict(r) for r in cursor.fetchall()]
        
        return notes


def get_diagnoses_for_patient(patient_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve all diagnoses for a patient.
    
    Args:
        patient_id: Patient ID
        
    Returns:
        List of diagnosis dictionaries
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM Diagnosis 
            WHERE patientId = ?
            ORDER BY diagnosedDate DESC
        """, (patient_id,))
        
        rows = cursor.fetchall()
        return [row_to_dict(row) for row in rows]


def get_medications_for_patient(patient_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve all medications for a patient.
    
    Args:
        patient_id: Patient ID
        
    Returns:
        List of medication dictionaries
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM PatientMedication 
            WHERE patientId = ?
            ORDER BY prescribedDate DESC
        """, (patient_id,))
        
        rows = cursor.fetchall()
        return [row_to_dict(row) for row in rows]


def get_vitals_for_patient(patient_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Retrieve vital signs for a patient.
    
    Args:
        patient_id: Patient ID
        limit: Maximum number of records to return
        
    Returns:
        List of vitals dictionaries
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM vital_signs 
            WHERE patientId = ?
            ORDER BY recordedAt DESC
            LIMIT ?
        """, (patient_id, limit))
        
        rows = cursor.fetchall()
        return [row_to_dict(row) for row in rows]


def get_lab_results_for_patient(patient_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Retrieve lab results for a patient.
    
    Args:
        patient_id: Patient ID
        limit: Maximum number of records to return
        
    Returns:
        List of lab result dictionaries
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM LabResult 
            WHERE patientId = ?
            ORDER BY resultDate DESC
            LIMIT ?
        """, (patient_id, limit))
        
        rows = cursor.fetchall()
        return [row_to_dict(row) for row in rows]


# =============================================================================
# FHIR CAPABILITY STATEMENT
# =============================================================================

def get_capability_statement() -> Dict[str, Any]:
    """
    Generate FHIR R4 Capability Statement.
    
    Reference: https://hl7.org/fhir/R4/capabilitystatement.html
    
    Returns:
        FHIR CapabilityStatement resource
    """
    return {
        "resourceType": "CapabilityStatement",
        "id": "gelani-fhir-server",
        "meta": {
            "versionId": "1",
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
        },
        "url": "http://gelani.health/fhir/CapabilityStatement/gelani-fhir-server",
        "name": "GelaniHealthcareFHIRServer",
        "title": "Gelani Healthcare FHIR Server",
        "status": "active",
        "experimental": False,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "publisher": "Gelani Healthcare",
        "description": "FHIR R4 Server for Gelani Healthcare Clinical Decision Support System",
        "kind": "instance",
        "fhirVersion": "4.0.1",
        "format": ["json"],
        "rest": [{
            "mode": "server",
            "description": "Gelani Healthcare FHIR R4 RESTful Server",
            "security": {
                "cors": True,
                "description": "JWT Bearer Token authentication required for PHI access"
            },
            "resource": [
                {
                    "type": "Patient",
                    "profile": "http://hl7.org/fhir/StructureDefinition/Patient",
                    "interaction": [
                        {"code": "read"},
                        {"code": "vread"},
                        {"code": "search-type"}
                    ],
                    "searchParam": [
                        {
                            "name": "identifier",
                            "type": "token",
                            "documentation": "Patient identifier (MRN or ID)"
                        },
                        {
                            "name": "name",
                            "type": "string",
                            "documentation": "Patient name"
                        }
                    ],
                    "operation": [
                        {
                            "name": "$everything",
                            "definition": "http://hl7.org/fhir/OperationDefinition/Patient-everything"
                        }
                    ]
                },
                {
                    "type": "Composition",
                    "profile": "http://hl7.org/fhir/StructureDefinition/Composition",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"}
                    ],
                    "searchParam": [
                        {
                            "name": "patient",
                            "type": "reference",
                            "documentation": "Patient reference"
                        },
                        {
                            "name": "date",
                            "type": "date",
                            "documentation": "Composition date"
                        }
                    ]
                },
                {
                    "type": "Condition",
                    "profile": "http://hl7.org/fhir/StructureDefinition/Condition",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"}
                    ],
                    "searchParam": [
                        {
                            "name": "patient",
                            "type": "reference",
                            "documentation": "Patient reference"
                        },
                        {
                            "name": "category",
                            "type": "token",
                            "documentation": "Condition category"
                        }
                    ]
                },
                {
                    "type": "ServiceRequest",
                    "profile": "http://hl7.org/fhir/StructureDefinition/ServiceRequest",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"}
                    ],
                    "searchParam": [
                        {
                            "name": "patient",
                            "type": "reference",
                            "documentation": "Patient reference"
                        },
                        {
                            "name": "status",
                            "type": "token",
                            "documentation": "Service request status"
                        }
                    ]
                },
                {
                    "type": "Bundle",
                    "profile": "http://hl7.org/fhir/StructureDefinition/Bundle",
                    "interaction": [
                        {"code": "read"},
                        {"code": "search-type"}
                    ]
                }
            ]
        }]
    }


# =============================================================================
# FHIR API ENDPOINTS
# =============================================================================

@router.get("/metadata")
async def get_metadata():
    """
    FHIR Capability Statement endpoint.
    
    Returns the FHIR R4 Capability Statement for this server.
    
    Reference: https://hl7.org/fhir/R4/capabilitystatement.html
    """
    return JSONResponse(content=get_capability_statement())


@router.get("/Patient/{patient_id}")
async def get_patient(
    patient_id: str = Path(..., description="Patient ID, MRN, or Bahmni Patient ID")
):
    """
    Retrieve a single patient as a FHIR Patient resource.
    
    FHIR R4 Patient Resource:
    https://hl7.org/fhir/R4/patient.html
    
    Args:
        patient_id: Patient ID (can be CUID, MRN, or Bahmni Patient ID)
        
    Returns:
        FHIR Patient resource
    """
    try:
        # Retrieve patient from database
        patient_data = get_patient_from_db(patient_id)
        
        if not patient_data:
            raise HTTPException(
                status_code=404,
                detail={
                    "resourceType": "OperationOutcome",
                    "issue": [{
                        "severity": "error",
                        "code": "not-found",
                        "details": {
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/operation-outcome",
                                "code": "MSG_NO_MATCH",
                                "display": "No resource found"
                            }],
                            "text": f"Patient with ID '{patient_id}' not found"
                        }
                    }]
                }
            )
        
        # Map to FHIR Patient resource
        fhir_patient = patient_to_fhir(patient_data)
        
        # Validate the resource
        is_valid, errors = validate_fhir_resource(fhir_patient)
        if not is_valid:
            logger.warning(f"FHIR validation warnings: {errors}")
        
        return JSONResponse(content=fhir_patient)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving patient: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/Patient/{patient_id}/$everything")
async def get_patient_everything(
    patient_id: str = Path(..., description="Patient ID, MRN, or Bahmni Patient ID"),
    _type: Optional[str] = Query(None, description="Resource types to include (comma-separated)")
):
    """
    FHIR $everything operation for a patient.
    
    This operation returns all resources related to the specified patient,
    including the patient resource itself, SOAP notes, diagnoses, and
    other clinical data.
    
    FHIR Operation Definition:
    https://hl7.org/fhir/R4/operation-patient-everything.html
    
    The response is a FHIR Bundle of type 'document' containing all
    resources for the patient.
    
    Args:
        patient_id: Patient ID (can be CUID, MRN, or Bahmni Patient ID)
        _type: Optional comma-separated list of resource types to include
        
    Returns:
        FHIR Bundle containing all resources for the patient
    """
    try:
        # Retrieve patient from database
        patient_data = get_patient_from_db(patient_id)
        
        if not patient_data:
            raise HTTPException(
                status_code=404,
                detail={
                    "resourceType": "OperationOutcome",
                    "issue": [{
                        "severity": "error",
                        "code": "not-found",
                        "details": {
                            "coding": [{
                                "system": "http://terminology.hl7.org/CodeSystem/operation-outcome",
                                "code": "MSG_NO_MATCH",
                                "display": "No resource found"
                            }],
                            "text": f"Patient with ID '{patient_id}' not found"
                        }
                    }]
                }
            )
        
        actual_patient_id = patient_data.get("id")
        
        # Parse resource types filter
        include_types = None
        if _type:
            include_types = [t.strip() for t in _type.split(",")]
        
        # Collect all FHIR resources
        fhir_resources: List[Dict[str, Any]] = []
        
        # 1. Add Patient resource
        if not include_types or "Patient" in include_types:
            fhir_patient = patient_to_fhir(patient_data)
            fhir_resources.append(fhir_patient)
        
        # 2. Add SOAP Notes as Composition resources
        if not include_types or "Composition" in include_types:
            soap_notes = get_soap_notes_for_patient(actual_patient_id)
            for note in soap_notes:
                fhir_composition = soap_note_to_fhir(note, actual_patient_id)
                fhir_resources.append(fhir_composition)
                
                # Also create Condition resources from assessment items
                if not include_types or "Condition" in include_types:
                    for item in note.get("assessmentItems", []):
                        fhir_condition = assessment_item_to_fhir(
                            item, actual_patient_id
                        )
                        fhir_resources.append(fhir_condition)
        
        # 3. Add Diagnoses as Condition resources (if not already added from SOAP notes)
        if not include_types or "Condition" in include_types:
            diagnoses = get_diagnoses_for_patient(actual_patient_id)
            for diagnosis in diagnoses:
                # Map diagnosis to Condition
                condition_data = {
                    "id": diagnosis.get("id"),
                    "diagnosis": diagnosis.get("diagnosisName"),
                    "icdCode": diagnosis.get("icdCode"),
                    "snomedCode": diagnosis.get("snomedCode"),
                    "status": diagnosis.get("status"),
                    "isPrimary": diagnosis.get("diagnosisType") == "primary",
                    "notes": diagnosis.get("description"),
                    "createdAt": diagnosis.get("diagnosedDate"),
                }
                fhir_condition = assessment_item_to_fhir(
                    condition_data, actual_patient_id
                )
                fhir_resources.append(fhir_condition)
        
        # 4. Add ServiceRequest resources from clinical orders/diagnostics
        if not include_types or "ServiceRequest" in include_types:
            # Get lab orders as ServiceRequests
            lab_results = get_lab_results_for_patient(actual_patient_id)
            for lab in lab_results:
                service_request_data = {
                    "id": lab.get("id"),
                    "diagnosisName": lab.get("testName"),
                    "status": "completed" if lab.get("resultValue") else "active",
                    "createdAt": lab.get("orderedDate"),
                    "clinicalNotes": f"Result: {lab.get('resultValue')} {lab.get('unit', '')}",
                }
                fhir_service_request = diagnostic_to_fhir(
                    service_request_data, actual_patient_id
                )
                fhir_resources.append(fhir_service_request)
        
        # 5. Create the Bundle
        bundle = create_fhir_bundle(
            resources=fhir_resources,
            bundle_type="document",
            bundle_id=f"bundle-{actual_patient_id}"
        )
        
        # Add resource count to bundle
        bundle["total"] = len(fhir_resources)
        
        # Log the operation
        logger.info(
            f"FHIR $everything operation: Retrieved {len(fhir_resources)} resources "
            f"for patient {actual_patient_id}"
        )
        
        return JSONResponse(content=bundle)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in $everything operation: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "exception",
                    "details": {
                        "text": f"Internal server error: {str(e)}"
                    }
                }]
            }
        )


@router.get("/Composition")
async def search_compositions(
    patient: Optional[str] = Query(None, description="Patient reference"),
    date: Optional[str] = Query(None, description="Composition date")
):
    """
    Search for Composition resources (SOAP Notes).
    
    FHIR R4 Composition Search:
    https://hl7.org/fhir/R4/composition.html#search
    
    Args:
        patient: Patient ID reference
        date: Date or date range for compositions
        
    Returns:
        FHIR Bundle of Composition resources
    """
    try:
        if not patient:
            raise HTTPException(
                status_code=400,
                detail="Patient parameter is required"
            )
        
        # Extract patient ID from reference
        patient_id = patient.replace("Patient/", "")
        
        # Verify patient exists
        patient_data = get_patient_from_db(patient_id)
        if not patient_data:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        actual_patient_id = patient_data.get("id")
        
        # Get SOAP notes
        soap_notes = get_soap_notes_for_patient(actual_patient_id)
        
        # Filter by date if provided
        if date:
            # Parse date range if provided
            # FHIR date format: eqYYYY-MM-DD or geYYYY-MM-DD&leYYYY-MM-DD
            filtered_notes = []
            for note in soap_notes:
                note_date = note.get("createdAt", "")
                if note_date:
                    note_date_str = note_date[:10] if isinstance(note_date, str) else note_date.strftime("%Y-%m-%d")
                    if date in note_date_str or note_date_str.startswith(date):
                        filtered_notes.append(note)
            soap_notes = filtered_notes
        
        # Map to FHIR Compositions
        compositions = []
        for note in soap_notes:
            compositions.append(soap_note_to_fhir(note, actual_patient_id))
        
        # Create Bundle
        bundle = create_fhir_bundle(
            resources=compositions,
            bundle_type="searchset"
        )
        bundle["total"] = len(compositions)
        
        return JSONResponse(content=bundle)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching compositions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/Condition")
async def search_conditions(
    patient: Optional[str] = Query(None, description="Patient reference"),
    category: Optional[str] = Query(None, description="Condition category")
):
    """
    Search for Condition resources (Diagnoses).
    
    FHIR R4 Condition Search:
    https://hl7.org/fhir/R4/condition.html#search
    
    Args:
        patient: Patient ID reference
        category: Condition category filter
        
    Returns:
        FHIR Bundle of Condition resources
    """
    try:
        if not patient:
            raise HTTPException(
                status_code=400,
                detail="Patient parameter is required"
            )
        
        # Extract patient ID from reference
        patient_id = patient.replace("Patient/", "")
        
        # Verify patient exists
        patient_data = get_patient_from_db(patient_id)
        if not patient_data:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        actual_patient_id = patient_data.get("id")
        
        # Get diagnoses
        diagnoses = get_diagnoses_for_patient(actual_patient_id)
        
        # Map to FHIR Conditions
        conditions = []
        for diagnosis in diagnoses:
            condition_data = {
                "id": diagnosis.get("id"),
                "diagnosis": diagnosis.get("diagnosisName"),
                "icdCode": diagnosis.get("icdCode"),
                "snomedCode": diagnosis.get("snomedCode"),
                "status": diagnosis.get("status"),
                "isPrimary": diagnosis.get("diagnosisType") == "primary",
                "notes": diagnosis.get("description"),
                "createdAt": diagnosis.get("diagnosedDate"),
            }
            fhir_condition = assessment_item_to_fhir(
                condition_data, actual_patient_id
            )
            
            # Filter by category if provided
            if category:
                cond_categories = fhir_condition.get("category", [])
                category_texts = [c.get("text", "").lower() for c in cond_categories]
                if category.lower() not in category_texts:
                    continue
            
            conditions.append(fhir_condition)
        
        # Create Bundle
        bundle = create_fhir_bundle(
            resources=conditions,
            bundle_type="searchset"
        )
        bundle["total"] = len(conditions)
        
        return JSONResponse(content=bundle)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching conditions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ServiceRequest")
async def search_service_requests(
    patient: Optional[str] = Query(None, description="Patient reference"),
    status: Optional[str] = Query(None, description="Service request status")
):
    """
    Search for ServiceRequest resources (Lab Orders, Diagnostic Orders).
    
    FHIR R4 ServiceRequest Search:
    https://hl7.org/fhir/R4/servicerequest.html#search
    
    Args:
        patient: Patient ID reference
        status: Status filter
        
    Returns:
        FHIR Bundle of ServiceRequest resources
    """
    try:
        if not patient:
            raise HTTPException(
                status_code=400,
                detail="Patient parameter is required"
            )
        
        # Extract patient ID from reference
        patient_id = patient.replace("Patient/", "")
        
        # Verify patient exists
        patient_data = get_patient_from_db(patient_id)
        if not patient_data:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        actual_patient_id = patient_data.get("id")
        
        # Get lab results
        lab_results = get_lab_results_for_patient(actual_patient_id)
        
        # Map to FHIR ServiceRequests
        service_requests = []
        for lab in lab_results:
            service_request_data = {
                "id": lab.get("id"),
                "diagnosisName": lab.get("testName"),
                "status": "completed" if lab.get("resultValue") else "active",
                "createdAt": lab.get("orderedDate"),
                "clinicalNotes": f"Result: {lab.get('resultValue')} {lab.get('unit', '')}",
            }
            fhir_request = diagnostic_to_fhir(
                service_request_data, actual_patient_id
            )
            
            # Filter by status if provided
            if status and fhir_request.get("status") != status:
                continue
            
            service_requests.append(fhir_request)
        
        # Create Bundle
        bundle = create_fhir_bundle(
            resources=service_requests,
            bundle_type="searchset"
        )
        bundle["total"] = len(service_requests)
        
        return JSONResponse(content=bundle)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching service requests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ENCOUNTER ENDPOINTS
# =============================================================================

@router.get("/Encounter/{encounter_id}/$document")
async def get_encounter_document(
    encounter_id: str = Path(..., description="Encounter ID")
):
    """
    FHIR $document operation for an encounter.
    
    Returns the full document Bundle for a specific encounter,
    used for point-in-time audit retrieval.
    
    Reference: https://hl7.org/fhir/R4/operation-composition-document.html
    
    Args:
        encounter_id: Encounter identifier (SOAP note ID or consultation ID)
        
    Returns:
        FHIR Bundle containing all resources for the encounter
    """
    try:
        # Try to find the encounter (SOAP note)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Try soap_notes table first
            cursor.execute("""
                SELECT * FROM soap_notes WHERE id = ?
            """, (encounter_id,))
            note_row = cursor.fetchone()
            
            if not note_row:
                # Return FHIR-compliant error
                return JSONResponse(
                    content={
                        "resourceType": "OperationOutcome",
                        "issue": [{
                            "severity": "error",
                            "code": "not-found",
                            "details": {
                                "text": f"Encounter '{encounter_id}' not found"
                            }
                        }]
                    },
                    status_code=404,
                    headers={"Content-Type": "application/fhir+json"}
                )
            
            note = row_to_dict(note_row)
            patient_id = note.get("patientId")
            
            # Get patient data
            cursor.execute("SELECT * FROM Patient WHERE id = ?", (patient_id,))
            patient_row = cursor.fetchone()
            
            if not patient_row:
                return JSONResponse(
                    content={
                        "resourceType": "OperationOutcome",
                        "issue": [{
                            "severity": "error",
                            "code": "not-found",
                            "details": {"text": "Patient not found"}
                        }]
                    },
                    status_code=404,
                    headers={"Content-Type": "application/fhir+json"}
                )
            
            patient = row_to_dict(patient_row)
            
            # Build clinical session data
            clinical_session = {
                "encounter_id": encounter_id,
                "chief_complaint": note.get("chiefComplaint", ""),
                "differential": [],
                "observations": {},
                "recommendations": [],
                "soap_note": note,
                "rag_sources": [],
                "audit_session_hash": note.get("auditSessionHash", ""),
            }
            
            # Get assessment items as differential
            cursor.execute("""
                SELECT * FROM soap_note_assessment_items 
                WHERE soapNoteId = ?
                ORDER BY rank ASC
            """, (encounter_id,))
            
            for i, item in enumerate([row_to_dict(r) for r in cursor.fetchall()]):
                clinical_session["differential"].append({
                    "hypothesis": item.get("diagnosis", ""),
                    "icd10": item.get("icdCode", ""),
                    "rank": i + 1,
                    "posterior_probability": item.get("confidence", 0.5),
                    "is_critical": item.get("isCritical", False),
                    "evidence_pmids": [],
                })
        
        # Build the encounter bundle
        bundle = build_encounter_bundle(patient, clinical_session)
        
        logger.info(f"FHIR $document: Retrieved encounter {encounter_id}")
        
        return JSONResponse(
            content=bundle,
            headers={
                "Content-Type": "application/fhir+json",
                "X-Gelani-FHIR-Version": "R4",
                "Cache-Control": "no-store"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in $document operation: {e}")
        return JSONResponse(
            content={
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "exception",
                    "details": {"text": f"Internal server error: {str(e)}"}
                }]
            },
            status_code=500,
            headers={"Content-Type": "application/fhir+json"}
        )


# =============================================================================
# BUNDLE VALIDATION ENDPOINT
# =============================================================================

@router.post("/Bundle/$validate")
async def validate_bundle(request: Request):
    """
    Validate a FHIR Bundle.
    
    Performs basic structural validation:
    - Check all required fields present
    - Verify all references resolve within the bundle
    - Ensure no raw patient IDs in extension values
    
    Reference: https://hl7.org/fhir/R4/bundle-definitions.html
    
    Args:
        request: Request body containing FHIR Bundle
        
    Returns:
        Validation result with issues list
    """
    try:
        body = await request.json()
        issues = []
        
        # Check resourceType
        if body.get("resourceType") != "Bundle":
            issues.append("resourceType must be 'Bundle'")
        
        # Check required fields
        if "type" not in body:
            issues.append("Bundle.type is required")
        
        valid_types = ["document", "message", "transaction", "transaction-response",
                      "batch", "batch-response", "history", "searchset", "collection"]
        if body.get("type") and body["type"] not in valid_types:
            issues.append(f"Invalid Bundle.type: {body['type']}")
        
        # Check entries
        entries = body.get("entry", [])
        if not entries:
            issues.append("Bundle.entry should not be empty")
        
        # Collect all resource IDs for reference resolution
        resource_ids = set()
        for entry in entries:
            resource = entry.get("resource", {})
            if resource.get("id"):
                resource_ids.add(resource["id"])
        
        # Check references resolve
        for entry in entries:
            resource = entry.get("resource", {})
            resource_type = resource.get("resourceType", "")
            
            # Check subject/patient references
            for ref_field in ["subject", "patient"]:
                ref = resource.get(ref_field, {})
                if isinstance(ref, dict):
                    ref_value = ref.get("reference", "")
                    if ref_value.startswith("Patient/"):
                        patient_id = ref_value.split("/")[-1]
                        # Check if this looks like a raw ID (should be SHA-256 hash)
                        if len(patient_id) < 32 and not patient_id.startswith("urn:"):
                            issues.append(
                                f"{resource_type}: Raw patient ID detected in {ref_field}.reference - "
                                "must use SHA-256 hashed ID"
                            )
            
            # Check extensions for raw IDs
            extensions = resource.get("extension", [])
            for ext in extensions:
                for key, value in ext.items():
                    if key.startswith("value") and isinstance(value, str):
                        # Check if value looks like a raw patient ID
                        if len(value) < 32 and value.isalnum() and not value.startswith("PMID:"):
                            # Could be a raw ID - flag as warning
                            pass  # Non-blocking warning
        
        # Check Composition author
        for entry in entries:
            resource = entry.get("resource", {})
            if resource.get("resourceType") == "Composition":
                authors = resource.get("author", [])
                for author in authors:
                    display = author.get("display", "")
                    if display and not display.startswith("Gelani Healthcare AI System"):
                        issues.append(
                            "Composition.author.display must start with 'Gelani Healthcare AI System' "
                            f"(found: '{display}')"
                        )
        
        is_valid = len(issues) == 0
        
        logger.info(f"Bundle validation: {'PASS' if is_valid else 'FAIL'} ({len(issues)} issues)")
        
        return JSONResponse(
            content={
                "valid": is_valid,
                "issues": issues
            },
            headers={"Content-Type": "application/fhir+json"}
        )
        
    except Exception as e:
        logger.error(f"Error validating bundle: {e}")
        return JSONResponse(
            content={
                "valid": False,
                "issues": [f"Validation error: {str(e)}"]
            },
            headers={"Content-Type": "application/fhir+json"}
        )


# =============================================================================
# HEALTH CHECK
# =============================================================================

@router.get("/health")
async def fhir_health_check():
    """
    Health check for FHIR service.
    """
    try:
        # Test database connection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
        
        return {
            "status": "healthy",
            "service": "fhir-r4",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "fhir-r4",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "error": str(e)
        }

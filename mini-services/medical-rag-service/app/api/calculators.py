"""
P4: Clinical Calculator API Router
===================================

FastAPI router for clinical scoring calculators.
Provides endpoints for all 12 clinical calculators.

Endpoints:
- POST /api/calculators/{calculator_name} - Calculate a specific score
- GET /api/calculators - List all available calculators
- GET /api/calculators/{calculator_name}/info - Get calculator details

Supported Calculators:
1. cha2ds2vasc - Stroke risk in atrial fibrillation
2. hasbled - Bleeding risk with anticoagulation
3. curb65 - Pneumonia severity
4. perc - Pulmonary embolism rule-out
5. wells_pe - Pulmonary embolism probability
6. wells_dvt - Deep vein thrombosis probability
7. news2 - National Early Warning Score 2
8. sofa - Sequential Organ Failure Assessment
9. glasgow_blatchford - Upper GI bleeding risk
10. 4t_score - Heparin-induced thrombocytopenia
11. ascvd - ASCVD 10-year risk
12. child_pugh - Liver disease severity
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from datetime import datetime

from app.calculators.clinical_scores import (
    CALCULATOR_REGISTRY,
    get_calculator,
    list_calculators,
    calculate_cha2ds2_vasc,
    calculate_has_bled,
    calculate_curb65,
    calculate_perc,
    calculate_wells_pe,
    calculate_wells_dvt,
    calculate_news2,
    calculate_sofa,
    calculate_glasgow_blatchford,
    calculate_4t_score,
    calculate_ascvd_risk,
    calculate_child_pugh,
)


# Create router
router = APIRouter(prefix="/api/calculators", tags=["Clinical Calculators"])


# =============================================================================
# REQUEST MODELS
# =============================================================================

class CHA2DS2VAScRequest(BaseModel):
    """Request model for CHA2DS2-VASc calculator."""
    congestive_heart_failure: bool = Field(False, description="History of CHF or LVEF ≤40%")
    hypertension: bool = Field(False, description="History of hypertension")
    age: int = Field(0, ge=0, le=120, description="Patient age")
    diabetes: bool = Field(False, description="Diabetes mellitus")
    stroke_tia: bool = Field(False, description="Prior stroke, TIA, or thromboembolism")
    vascular_disease: bool = Field(False, description="MI, PAD, or aortic plaque")
    sex: str = Field("male", description="Biological sex (male/female)")


class HASBLEDRequest(BaseModel):
    """Request model for HAS-BLED calculator."""
    hypertension_uncontrolled: bool = Field(False, description="Uncontrolled hypertension")
    renal_disease: bool = Field(False, description="Renal disease (dialysis, transplant, Cr ≥2.26)")
    liver_disease: bool = Field(False, description="Liver disease (cirrhosis or bilirubin >2x normal)")
    stroke_history: bool = Field(False, description="Prior stroke")
    bleeding_history: bool = Field(False, description="Prior major bleeding")
    labile_inr: bool = Field(False, description="Labile INR (if on warfarin)")
    age: int = Field(0, ge=0, le=120, description="Patient age")
    drugs: bool = Field(False, description="Antiplatelet or NSAID use")
    alcohol: bool = Field(False, description="Alcohol ≥8 drinks/week")


class CURB65Request(BaseModel):
    """Request model for CURB-65 calculator."""
    confusion: bool = Field(False, description="New onset confusion")
    bun: float = Field(0, ge=0, description="BUN in mg/dL")
    rr: int = Field(0, ge=0, le=60, description="Respiratory rate")
    sbp: int = Field(0, ge=0, description="Systolic blood pressure")
    dbp: int = Field(0, ge=0, description="Diastolic blood pressure")
    age: int = Field(0, ge=0, le=120, description="Patient age")


class PERCRequest(BaseModel):
    """Request model for PERC calculator."""
    age: int = Field(0, ge=0, le=120, description="Patient age")
    hr: int = Field(0, ge=0, le=250, description="Heart rate")
    spo2: float = Field(0, ge=0, le=100, description="Pulse oximetry (%)")
    prior_dvt_pe: bool = Field(False, description="Prior DVT or PE")
    hemoptysis: bool = Field(False, description="Hemoptysis present")
    estrogen_use: bool = Field(False, description="Estrogen use (OCP or HRT)")
    leg_swelling: bool = Field(False, description="Unilateral leg swelling")
    surgery_trauma: bool = Field(False, description="Surgery or trauma within 4 weeks")


class WellsPERequest(BaseModel):
    """Request model for Wells PE calculator."""
    dvt_signs: bool = Field(False, description="Clinical signs of DVT")
    pe_most_likely: bool = Field(False, description="PE is most likely diagnosis")
    hr: int = Field(0, ge=0, le=250, description="Heart rate")
    immobilization_surgery: bool = Field(False, description="Immobilization or surgery within 4 weeks")
    prior_dvt_pe: bool = Field(False, description="Prior DVT or PE")
    hemoptysis: bool = Field(False, description="Hemoptysis present")
    malignancy: bool = Field(False, description="Active malignancy")


class WellsDVTRequest(BaseModel):
    """Request model for Wells DVT calculator."""
    active_cancer: bool = Field(False, description="Active cancer")
    paralysis_paresis: bool = Field(False, description="Paralysis or paresis")
    bedridden_surgery: bool = Field(False, description="Bedridden >3 days or major surgery <12 weeks")
    localized_tenderness: bool = Field(False, description="Localized tenderness along deep venous system")
    entire_leg_swollen: bool = Field(False, description="Entire leg swollen")
    calf_swelling: bool = Field(False, description="Calf swelling >3 cm compared to asymptomatic side")
    pitting_edema: bool = Field(False, description="Pitting edema confined to symptomatic leg")
    collateral_veins: bool = Field(False, description="Collateral superficial veins")
    alternative_diagnosis: bool = Field(False, description="Alternative diagnosis as likely or greater than DVT")


class NEWS2Request(BaseModel):
    """Request model for NEWS2 calculator."""
    rr: int = Field(0, ge=0, le=60, description="Respiratory rate")
    spo2: float = Field(0, ge=0, le=100, description="Pulse oximetry (%)")
    supplemental_o2: bool = Field(False, description="On supplemental oxygen")
    temperature: float = Field(36.5, ge=30, le=45, description="Temperature (Celsius)")
    sbp: int = Field(0, ge=0, le=300, description="Systolic blood pressure")
    hr: int = Field(0, ge=0, le=250, description="Heart rate")
    consciousness: str = Field("alert", description="Level of consciousness (alert/cvpu/new_confusion)")
    spo2_scale: int = Field(1, ge=1, le=2, description="SpO2 scale (1 or 2 for hypercapnic failure)")


class SOFARequest(BaseModel):
    """Request model for SOFA calculator."""
    pao2: float = Field(0, ge=0, description="PaO2 in mmHg")
    fio2: float = Field(0, ge=0, le=100, description="FiO2 (0-1 or 0-100)")
    platelets: float = Field(0, ge=0, description="Platelet count (×10³/µL)")
    bilirubin: float = Field(0, ge=0, description="Total bilirubin (mg/dL)")
    map_value: float = Field(0, ge=0, description="Mean arterial pressure (mmHg)")
    vasopressors: bool = Field(False, description="On vasopressors")
    gcs: int = Field(15, ge=3, le=15, description="Glasgow Coma Scale")
    creatinine: float = Field(0, ge=0, description="Serum creatinine (mg/dL)")


class GlasgowBlatchfordRequest(BaseModel):
    """Request model for Glasgow-Blatchford calculator."""
    bun: float = Field(0, ge=0, description="BUN in mg/dL")
    hemoglobin: float = Field(0, ge=0, le=25, description="Hemoglobin (g/dL)")
    sbp: int = Field(0, ge=0, le=300, description="Systolic blood pressure")
    hr: int = Field(0, ge=0, le=250, description="Heart rate")
    melena: bool = Field(False, description="Melena present")
    syncope: bool = Field(False, description="Syncope present")
    liver_disease: bool = Field(False, description="History of liver disease")
    cardiac_failure: bool = Field(False, description="History of cardiac failure")
    gender: str = Field("male", description="Gender (male/female)")


class FourTRequest(BaseModel):
    """Request model for 4T Score calculator."""
    thrombocytopenia: str = Field("none", description="Thrombocytopenia magnitude (none/mild/severe)")
    timing: str = Field("none", description="Timing of platelet fall (none/recent/typical/late)")
    thrombosis: str = Field("none", description="Thrombosis or sequelae (none/new thrombosis/skin necrosis/systemic reaction)")
    other_cause: str = Field("probable", description="Other cause for thrombocytopenia (definite/probable/possible/none)")


class ASCVDRequest(BaseModel):
    """Request model for ASCVD 10-year risk calculator."""
    age: int = Field(0, ge=20, le=95, description="Patient age")
    sex: str = Field("male", description="Biological sex (male/female)")
    race: str = Field("white", description="Race (white/african_american/other)")
    total_cholesterol: float = Field(0, ge=0, le=500, description="Total cholesterol (mg/dL)")
    hdl: float = Field(0, ge=0, le=150, description="HDL cholesterol (mg/dL)")
    sbp: int = Field(0, ge=0, le=300, description="Systolic blood pressure")
    htntx: bool = Field(False, description="On hypertension treatment")
    diabetes: bool = Field(False, description="Diabetes mellitus")
    smoker: bool = Field(False, description="Current smoker")


class ChildPughRequest(BaseModel):
    """Request model for Child-Pugh calculator."""
    total_bilirubin: float = Field(0, ge=0, description="Total bilirubin (mg/dL)")
    albumin: float = Field(0, ge=0, le=6, description="Albumin (g/dL)")
    pt_inr: float = Field(0, ge=0, le=10, description="PT/INR")
    ascites: str = Field("none", description="Ascites (none/mild/moderate/severe)")
    encephalopathy: str = Field("none", description="Encephalopathy (none/grade 1-2/grade 3-4)")


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("")
async def list_all_calculators():
    """List all available clinical calculators."""
    calculators = list_calculators()
    return {
        "calculators": calculators,
        "total": len(calculators),
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/{calculator_name}/info")
async def get_calculator_info(calculator_name: str):
    """Get detailed information about a specific calculator."""
    calculator = get_calculator(calculator_name)
    
    if calculator is None:
        raise HTTPException(
            status_code=404,
            detail=f"Calculator '{calculator_name}' not found. Available: {list(CALCULATOR_REGISTRY.keys())}"
        )
    
    return {
        "id": calculator_name.lower().replace("-", "_"),
        "name": calculator["name"],
        "description": calculator["description"],
        "parameters": calculator["parameters"],
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/{calculator_name}")
async def calculate_score(calculator_name: str, data: Dict[str, Any] = Body(...)):
    """
    Calculate a clinical score.
    
    Supported calculators:
    - cha2ds2vasc: Stroke risk in atrial fibrillation
    - hasbled: Bleeding risk with anticoagulation
    - curb65: Pneumonia severity
    - perc: Pulmonary embolism rule-out
    - wells_pe: Pulmonary embolism probability
    - wells_dvt: Deep vein thrombosis probability
    - news2: National Early Warning Score 2
    - sofa: Sequential Organ Failure Assessment
    - glasgow_blatchford: Upper GI bleeding risk
    - 4t_score: Heparin-induced thrombocytopenia
    - ascvd: ASCVD 10-year risk
    - child_pugh: Liver disease severity
    """
    calculator_info = get_calculator(calculator_name)
    
    if calculator_info is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": f"Calculator '{calculator_name}' not found",
                "available_calculators": list(CALCULATOR_REGISTRY.keys()),
            }
        )
    
    # Get the calculation function
    calc_function = calculator_info["function"]
    
    try:
        # Execute the calculation
        result = calc_function(**data)
        return result
    except TypeError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid parameters",
                "message": str(e),
                "expected_parameters": calculator_info["parameters"],
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Calculation failed",
                "message": str(e),
            }
        )


# =============================================================================
# TYPED ENDPOINTS FOR EACH CALCULATOR
# =============================================================================

@router.post("/cha2ds2vasc/typed")
async def calculate_cha2ds2vasc_typed(request: CHA2DS2VAScRequest):
    """Calculate CHA2DS2-VASc score with typed request."""
    return calculate_cha2ds2_vasc(**request.dict())


@router.post("/hasbled/typed")
async def calculate_hasbled_typed(request: HASBLEDRequest):
    """Calculate HAS-BLED score with typed request."""
    return calculate_has_bled(**request.dict())


@router.post("/curb65/typed")
async def calculate_curb65_typed(request: CURB65Request):
    """Calculate CURB-65 score with typed request."""
    return calculate_curb65(**request.dict())


@router.post("/perc/typed")
async def calculate_perc_typed(request: PERCRequest):
    """Calculate PERC rule with typed request."""
    return calculate_perc(**request.dict())


@router.post("/wells_pe/typed")
async def calculate_wells_pe_typed(request: WellsPERequest):
    """Calculate Wells PE score with typed request."""
    return calculate_wells_pe(**request.dict())


@router.post("/wells_dvt/typed")
async def calculate_wells_dvt_typed(request: WellsDVTRequest):
    """Calculate Wells DVT score with typed request."""
    return calculate_wells_dvt(**request.dict())


@router.post("/news2/typed")
async def calculate_news2_typed(request: NEWS2Request):
    """Calculate NEWS2 score with typed request."""
    return calculate_news2(**request.dict())


@router.post("/sofa/typed")
async def calculate_sofa_typed(request: SOFARequest):
    """Calculate SOFA score with typed request."""
    return calculate_sofa(**request.dict())


@router.post("/glasgow_blatchford/typed")
async def calculate_glasgow_blatchford_typed(request: GlasgowBlatchfordRequest):
    """Calculate Glasgow-Blatchford score with typed request."""
    return calculate_glasgow_blatchford(**request.dict())


@router.post("/4t_score/typed")
async def calculate_4t_typed(request: FourTRequest):
    """Calculate 4T Score with typed request."""
    return calculate_4t_score(**request.dict())


@router.post("/ascvd/typed")
async def calculate_ascvd_typed(request: ASCVDRequest):
    """Calculate ASCVD 10-year risk with typed request."""
    return calculate_ascvd_risk(**request.dict())


@router.post("/child_pugh/typed")
async def calculate_child_pugh_typed(request: ChildPughRequest):
    """Calculate Child-Pugh score with typed request."""
    return calculate_child_pugh(**request.dict())

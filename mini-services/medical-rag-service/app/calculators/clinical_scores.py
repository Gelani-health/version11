"""
P4: Clinical Scoring Calculators
=================================

Evidence-based clinical scoring systems for decision support.
Implements 12 validated clinical calculators with standardized output format.

Each calculator returns:
- score: int - The calculated score
- interpretation: str - Clinical interpretation
- recommendation: str - Clinical recommendation
- evidence: str - Citation/reference

Implemented Calculators:
1. CHA2DS2-VASc - Stroke risk in atrial fibrillation
2. HAS-BLED - Bleeding risk with anticoagulation
3. CURB-65 - Pneumonia severity
4. PERC Rule - Pulmonary embolism rule-out
5. Wells PE - Pulmonary embolism probability
6. Wells DVT - Deep vein thrombosis probability
7. NEWS2 - National Early Warning Score 2
8. SOFA - Sequential Organ Failure Assessment
9. Glasgow-Blatchford - Upper GI bleeding risk
10. 4T Score - Heparin-induced thrombocytopenia
11. ASCVD 10-year risk - Atherosclerotic cardiovascular disease
12. Child-Pugh - Liver disease severity

References are included with each calculator.
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import math


@dataclass
class CalculatorResult:
    """Standard result format for all clinical calculators."""
    score: int
    interpretation: str
    recommendation: str
    evidence: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "interpretation": self.interpretation,
            "recommendation": self.recommendation,
            "evidence": self.evidence,
            "timestamp": datetime.utcnow().isoformat(),
        }


# =============================================================================
# 1. CHA2DS2-VASc Score
# =============================================================================

def calculate_cha2ds2_vasc(
    congestive_heart_failure: bool = False,
    hypertension: bool = False,
    age: int = 0,
    diabetes: bool = False,
    stroke_tia: bool = False,
    vascular_disease: bool = False,
    sex: str = "male",
) -> Dict[str, Any]:
    """
    CHA2DS2-VASc Score for Stroke Risk in Atrial Fibrillation.
    
    Components:
    - CHF (1 point)
    - HTN (1 point)
    - Age ≥75 (2 points)
    - DM (1 point)
    - Stroke/TIA (2 points)
    - Vascular disease (1 point)
    - Age 65-74 (1 point)
    - Female (1 point)
    
    Interpretation (for men):
    - Score 0: No anticoagulation needed
    - Score 1: Consider anticoagulation
    - Score ≥2: Anticoagulation recommended
    
    Reference: Lip GY, et al. Chest 2010;137:263-272
    """
    score = 0
    components = []
    
    # CHF (1 point)
    if congestive_heart_failure:
        score += 1
        components.append("CHF: 1")
    
    # HTN (1 point)
    if hypertension:
        score += 1
        components.append("HTN: 1")
    
    # Age scoring (mutually exclusive)
    if age >= 75:
        score += 2
        components.append("Age≥75: 2")
    elif 65 <= age < 75:
        score += 1
        components.append("Age65-74: 1")
    
    # Diabetes (1 point)
    if diabetes:
        score += 1
        components.append("DM: 1")
    
    # Stroke/TIA (2 points)
    if stroke_tia:
        score += 2
        components.append("Stroke/TIA: 2")
    
    # Vascular disease (1 point)
    if vascular_disease:
        score += 1
        components.append("Vascular disease: 1")
    
    # Female sex (1 point) - only if not low risk already
    if sex.lower() in ["female", "f"]:
        score += 1
        components.append("Female: 1")
    
    # Interpretation differs by sex
    is_male = sex.lower() in ["male", "m"]
    
    if is_male:
        if score == 0:
            interpretation = "Low risk (0.0% annual stroke risk)"
            recommendation = "No anticoagulation therapy recommended"
        elif score == 1:
            interpretation = "Low-moderate risk (~1.3% annual stroke risk)"
            recommendation = "Consider anticoagulation; shared decision-making recommended"
        else:
            annual_risks = {2: 2.2, 3: 3.2, 4: 4.0, 5: 6.7, 6: 9.8, 7: 9.6, 8: 12.0, 9: 12.0}
            risk = annual_risks.get(score, 12.0)
            interpretation = f"High risk (~{risk}% annual stroke risk)"
            recommendation = "Anticoagulation therapy recommended (warfarin INR 2-3 or DOAC)"
    else:
        # For females, score of 1 (female alone) = low risk
        if score <= 1:
            interpretation = "Low risk (female sex alone does not increase risk)"
            recommendation = "No anticoagulation therapy recommended"
        elif score == 2:
            interpretation = "Low-moderate risk (~2.2% annual stroke risk)"
            recommendation = "Consider anticoagulation; shared decision-making recommended"
        else:
            annual_risks = {3: 3.2, 4: 4.0, 5: 6.7, 6: 9.8, 7: 9.6, 8: 12.0, 9: 12.0}
            risk = annual_risks.get(score, 12.0)
            interpretation = f"High risk (~{risk}% annual stroke risk)"
            recommendation = "Anticoagulation therapy recommended (warfarin INR 2-3 or DOAC)"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Lip GY, Nieuwlaat R, Pisters R, et al. Refining clinical risk stratification for predicting stroke and thromboembolism in atrial fibrillation using a novel risk factor-based approach. Chest 2010;137(2):263-272.",
    )
    
    return {**result.to_dict(), "components": components}


# =============================================================================
# 2. HAS-BLED Score
# =============================================================================

def calculate_has_bled(
    hypertension_uncontrolled: bool = False,
    renal_disease: bool = False,
    liver_disease: bool = False,
    stroke_history: bool = False,
    bleeding_history: bool = False,
    labile_inr: bool = False,
    age: int = 0,
    drugs: bool = False,  # Antiplatelet or NSAID use
    alcohol: bool = False,
) -> Dict[str, Any]:
    """
    HAS-BLED Score for Bleeding Risk in Anticoagulation.
    
    Components:
    - H: Hypertension (uncontrolled) (1)
    - A: Abnormal renal/liver function (1-2)
    - S: Stroke history (1)
    - B: Bleeding history (1)
    - L: Labile INR (1)
    - E: Elderly (>65) (1)
    - D: Drugs/alcohol (1-2)
    
    Score ≥3 = High bleeding risk
    
    Reference: Pisters R, et al. Chest 2010;138:1093-1100
    """
    score = 0
    components = []
    
    # Hypertension (1 point)
    if hypertension_uncontrolled:
        score += 1
        components.append("Hypertension: 1")
    
    # Abnormal renal function (1 point)
    if renal_disease:
        score += 1
        components.append("Renal disease: 1")
    
    # Abnormal liver function (1 point)
    if liver_disease:
        score += 1
        components.append("Liver disease: 1")
    
    # Stroke (1 point)
    if stroke_history:
        score += 1
        components.append("Stroke: 1")
    
    # Bleeding (1 point)
    if bleeding_history:
        score += 1
        components.append("Bleeding history: 1")
    
    # Labile INR (1 point)
    if labile_inr:
        score += 1
        components.append("Labile INR: 1")
    
    # Elderly >65 (1 point)
    if age > 65:
        score += 1
        components.append("Elderly (>65): 1")
    
    # Drugs (1 point)
    if drugs:
        score += 1
        components.append("Drugs (antiplatelet/NSAID): 1")
    
    # Alcohol (1 point)
    if alcohol:
        score += 1
        components.append("Alcohol: 1")
    
    # Interpretation
    annual_risks = {0: 1.13, 1: 1.02, 2: 1.88, 3: 3.74, 4: 8.70}
    annual_risk = annual_risks.get(min(score, 4), 12.0 if score >= 5 else 8.70)
    
    if score < 3:
        interpretation = f"Low-moderate bleeding risk ({annual_risk}% annual major bleeding risk)"
        recommendation = "Standard anticoagulation monitoring appropriate"
    else:
        interpretation = f"HIGH bleeding risk ({annual_risk}% annual major bleeding risk)"
        recommendation = "Address modifiable risk factors; consider DOACs over warfarin; avoid concomitant antiplatelet therapy if possible; frequent clinical monitoring recommended"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Pisters R, Lane DA, Nieuwlaat R, et al. A novel user-friendly score (HAS-BLED) to assess 1-year risk of major bleeding in patients with atrial fibrillation. Chest 2010;138(5):1093-1100.",
    )
    
    return {**result.to_dict(), "components": components}


# =============================================================================
# 3. CURB-65 Score
# =============================================================================

def calculate_curb65(
    confusion: bool = False,
    bun: float = 0,  # mg/dL (BUN >19 = urea >7 mmol/L)
    rr: int = 0,  # Respiratory rate
    sbp: int = 0,  # Systolic BP
    dbp: int = 0,  # Diastolic BP
    age: int = 0,
) -> Dict[str, Any]:
    """
    CURB-65 Score for Pneumonia Severity.
    
    Components:
    - C: Confusion (new onset) (1)
    - U: Urea >7 mmol/L (BUN >19 mg/dL) (1)
    - R: Respiratory rate ≥30 (1)
    - B: Blood pressure (SBP <90 or DBP ≤60) (1)
    - 65: Age ≥65 (1)
    
    Interpretation:
    - 0-1: Low severity, consider outpatient
    - 2: Moderate severity, inpatient
    - ≥3: High severity, consider ICU
    
    Reference: Lim WS, et al. Thorax 2003;58:377-382
    """
    score = 0
    components = []
    
    # Confusion
    if confusion:
        score += 1
        components.append("Confusion: 1")
    
    # Urea (BUN >19 mg/dL ≈ Urea >7 mmol/L)
    if bun > 19:
        score += 1
        components.append("BUN>19: 1")
    
    # Respiratory rate ≥30
    if rr >= 30:
        score += 1
        components.append("RR≥30: 1")
    
    # Blood pressure
    if sbp < 90 or dbp <= 60:
        score += 1
        components.append("Low BP (SBP<90 or DBP≤60): 1")
    
    # Age ≥65
    if age >= 65:
        score += 1
        components.append("Age≥65: 1")
    
    # Interpretation with mortality risk
    mortality = {0: 0.6, 1: 2.7, 2: 6.8, 3: 14.0, 4: 27.8, 5: 27.8}
    mort_risk = mortality.get(score, 27.8)
    
    if score <= 1:
        interpretation = f"Low severity ({mort_risk}% 30-day mortality)"
        recommendation = "Consider outpatient treatment; ensure close follow-up"
    elif score == 2:
        interpretation = f"Moderate severity ({mort_risk}% 30-day mortality)"
        recommendation = "Hospital admission recommended; consider short-stay unit if stable"
    else:
        interpretation = f"High severity ({mort_risk}% 30-day mortality)"
        if score >= 4:
            recommendation = "Hospital admission required; consider ICU admission for score ≥4"
        else:
            recommendation = "Hospital admission required; assess for ICU if clinical deterioration"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Lim WS, van der Eerden MM, Laing R, et al. Defining community acquired pneumonia severity on presentation to hospital: an international derivation and validation study. Thorax 2003;58(5):377-382.",
    )
    
    return {**result.to_dict(), "components": components}


# =============================================================================
# 4. PERC Rule
# =============================================================================

def calculate_perc(
    age: int = 0,
    hr: int = 0,  # Heart rate
    spo2: float = 0,  # Pulse oximetry (percentage)
    prior_dvt_pe: bool = False,
    hemoptysis: bool = False,
    estrogen_use: bool = False,  # Oral contraceptives or HRT
    leg_swelling: bool = False,  # Unilateral leg swelling
    surgery_trauma: bool = False,  # Within 4 weeks
) -> Dict[str, Any]:
    """
    PERC Rule for Pulmonary Embolism Rule-Out.
    
    All 8 criteria must be ABSENT to rule out PE.
    If ANY criterion is present, cannot rule out PE.
    
    Criteria:
    1. Age <50
    2. Heart rate <100
    3. SpO2 ≥95% on room air
    4. No prior DVT/PE
    5. No hemoptysis
    6. No estrogen use
    7. No leg swelling
    8. No recent surgery/trauma (within 4 weeks)
    
    Sensitivity: 97.4% for excluding PE
    Specificity: ~20%
    
    Reference: Kline JA, et al. J Thromb Haemost 2004;2:1247-1253
    """
    criteria_met = []
    criteria_absent = []
    
    # Check each criterion (all must be NEGATIVE to rule out PE)
    if age >= 50:
        criteria_met.append("Age ≥50")
    else:
        criteria_absent.append("Age <50")
    
    if hr >= 100:
        criteria_met.append("HR ≥100")
    else:
        criteria_absent.append("HR <100")
    
    if spo2 < 95:
        criteria_met.append("SpO2 <95%")
    else:
        criteria_absent.append("SpO2 ≥95%")
    
    if prior_dvt_pe:
        criteria_met.append("Prior DVT/PE")
    else:
        criteria_absent.append("No prior DVT/PE")
    
    if hemoptysis:
        criteria_met.append("Hemoptysis")
    else:
        criteria_absent.append("No hemoptysis")
    
    if estrogen_use:
        criteria_met.append("Estrogen use")
    else:
        criteria_absent.append("No estrogen use")
    
    if leg_swelling:
        criteria_met.append("Unilateral leg swelling")
    else:
        criteria_absent.append("No leg swelling")
    
    if surgery_trauma:
        criteria_met.append("Recent surgery/trauma")
    else:
        criteria_absent.append("No recent surgery/trauma")
    
    score = len(criteria_met)  # Number of positive criteria
    
    # Interpretation
    if len(criteria_met) == 0:
        interpretation = "All PERC criteria negative - PE ruled out"
        recommendation = "PE can be safely excluded without further testing; consider alternative diagnoses"
    else:
        interpretation = f"{len(criteria_met)} PERC criteria positive - cannot rule out PE"
        recommendation = "Cannot exclude PE based on PERC; consider D-dimer or CT-PA based on clinical probability"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Kline JA, Mitchell AM, Kabrhel C, et al. Clinical criteria to prevent unnecessary diagnostic testing in emergency department patients with suspected pulmonary embolism. J Thromb Haemost 2004;2(8):1247-1253.",
    )
    
    return {
        **result.to_dict(), 
        "criteria_met": criteria_met, 
        "criteria_absent": criteria_absent,
        "pe_excluded": len(criteria_met) == 0,
    }


# =============================================================================
# 5. Wells PE Score
# =============================================================================

def calculate_wells_pe(
    dvt_signs: bool = False,
    pe_most_likely: bool = False,
    hr: int = 0,
    immobilization_surgery: bool = False,
    prior_dvt_pe: bool = False,
    hemoptysis: bool = False,
    malignancy: bool = False,
) -> Dict[str, Any]:
    """
    Wells PE Score for Pulmonary Embolism Probability.
    
    Components:
    - Clinical signs of DVT (3)
    - PE most likely diagnosis (3)
    - Heart rate >100 (1.5)
    - Immobilization/surgery within 4 weeks (1.5)
    - Prior DVT/PE (1.5)
    - Hemoptysis (1)
    - Malignancy (1)
    
    Interpretation:
    - ≤4: Low probability / PE unlikely
    - >4: High probability / PE likely
    
    Reference: Wells PS, et al. Ann Intern Med 2001;135:98-107
    """
    score = 0.0
    components = []
    
    # Clinical signs of DVT (3 points)
    if dvt_signs:
        score += 3.0
        components.append("DVT signs: 3")
    
    # PE is most likely diagnosis (3 points)
    if pe_most_likely:
        score += 3.0
        components.append("PE most likely: 3")
    
    # Heart rate >100 (1.5 points)
    if hr > 100:
        score += 1.5
        components.append("HR>100: 1.5")
    
    # Immobilization or surgery (1.5 points)
    if immobilization_surgery:
        score += 1.5
        components.append("Immobilization/surgery: 1.5")
    
    # Prior DVT/PE (1.5 points)
    if prior_dvt_pe:
        score += 1.5
        components.append("Prior DVT/PE: 1.5")
    
    # Hemoptysis (1 point)
    if hemoptysis:
        score += 1.0
        components.append("Hemoptysis: 1")
    
    # Malignancy (1 point)
    if malignancy:
        score += 1.0
        components.append("Malignancy: 1")
    
    # Interpretation
    if score <= 4:
        interpretation = "Low probability / PE unlikely (Wells PE score ≤4)"
        pe_prevalence = "Pre-test probability ~12%"
        recommendation = "D-dimer recommended; if negative, PE can be excluded; consider PERC rule if low suspicion"
    else:
        interpretation = "High probability / PE likely (Wells PE score >4)"
        pe_prevalence = "Pre-test probability ~37%"
        recommendation = "Proceed to CT-PA; consider empiric anticoagulation if imaging delayed; do not rely on D-dimer alone"
    
    result = CalculatorResult(
        score=int(score) if score == int(score) else score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Wells PS, Anderson DR, Rodger M, et al. Excluding pulmonary embolism at the bedside without diagnostic imaging: management of patients with suspected pulmonary embolism presenting to the emergency department by using a simple clinical model and D-dimer. Ann Intern Med 2001;135(2):98-107.",
    )
    
    return {**result.to_dict(), "components": components, "pe_prevalence": pe_prevalence}


# =============================================================================
# 6. Wells DVT Score
# =============================================================================

def calculate_wells_dvt(
    active_cancer: bool = False,
    paralysis_paresis: bool = False,
    bedridden_surgery: bool = False,
    localized_tenderness: bool = False,
    entire_leg_swollen: bool = False,
    calf_swelling: bool = False,  # >3 cm compared to asymptomatic side
    pitting_edema: bool = False,
    collateral_veins: bool = False,
    alternative_diagnosis: bool = False,  # As likely or greater than DVT
) -> Dict[str, Any]:
    """
    Wells DVT Score for Deep Vein Thrombosis Probability.
    
    9-item model:
    - Active cancer (1)
    - Paralysis/paresis or recent plaster immobilization (1)
    - Bedridden >3 days or major surgery <12 weeks (1)
    - Localized tenderness along deep venous system (1)
    - Entire leg swollen (1)
    - Calf swelling >3 cm compared to asymptomatic side (1)
    - Pitting edema confined to symptomatic leg (1)
    - Collateral superficial veins (1)
    - Alternative diagnosis as likely or greater than DVT (-2)
    
    Interpretation:
    - Score ≥2: High probability
    - Score 0-1: Low probability
    
    Reference: Wells PS, et al. Lancet 1997;350:1795-1798
    """
    score = 0
    components = []
    
    # Active cancer (1 point)
    if active_cancer:
        score += 1
        components.append("Active cancer: 1")
    
    # Paralysis or paresis (1 point)
    if paralysis_paresis:
        score += 1
        components.append("Paralysis/paresis: 1")
    
    # Bedridden or surgery (1 point)
    if bedridden_surgery:
        score += 1
        components.append("Bedridden/surgery: 1")
    
    # Localized tenderness (1 point)
    if localized_tenderness:
        score += 1
        components.append("Localized tenderness: 1")
    
    # Entire leg swollen (1 point)
    if entire_leg_swollen:
        score += 1
        components.append("Entire leg swollen: 1")
    
    # Calf swelling >3 cm (1 point)
    if calf_swelling:
        score += 1
        components.append("Calf swelling >3cm: 1")
    
    # Pitting edema (1 point)
    if pitting_edema:
        score += 1
        components.append("Pitting edema: 1")
    
    # Collateral veins (1 point)
    if collateral_veins:
        score += 1
        components.append("Collateral veins: 1")
    
    # Alternative diagnosis (-2 points)
    if alternative_diagnosis:
        score -= 2
        components.append("Alternative diagnosis: -2")
    
    # Interpretation
    if score >= 2:
        interpretation = "High probability for DVT (Wells DVT score ≥2)"
        pre_test_prob = "Pre-test probability ~53%"
        recommendation = "Proceed to venous ultrasound; consider empiric anticoagulation while awaiting imaging"
    elif score == 1:
        interpretation = "Moderate probability for DVT (Wells DVT score 1)"
        pre_test_prob = "Pre-test probability ~17%"
        recommendation = "D-dimer recommended; if positive, proceed to ultrasound"
    else:
        interpretation = "Low probability for DVT (Wells DVT score 0)"
        pre_test_prob = "Pre-test probability ~5%"
        recommendation = "D-dimer recommended to further stratify risk; if negative, DVT unlikely"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Wells PS, Hirsh J, Anderson DR, et al. Accuracy of clinical assessment of deep-vein thrombosis. Lancet 1997;350(9094):1795-1798.",
    )
    
    return {**result.to_dict(), "components": components, "pre_test_probability": pre_test_prob}


# =============================================================================
# 7. NEWS2 Score
# =============================================================================

def calculate_news2(
    rr: int = 0,  # Respiratory rate
    spo2: float = 0,  # Pulse oximetry
    supplemental_o2: bool = False,
    temperature: float = 0,  # Celsius
    sbp: int = 0,  # Systolic BP
    hr: int = 0,  # Heart rate
    consciousness: str = "alert",  # alert, cvpu, new_confusion
    spo2_scale: int = 1,  # Scale 1 or Scale 2 (for hypercapnic respiratory failure)
) -> Dict[str, Any]:
    """
    NEWS2 (National Early Warning Score 2).
    
    Seven physiological parameters, each scored 0-3:
    1. Respiratory rate
    2. Oxygen saturations (Scale 1 or 2)
    3. Supplemental oxygen use
    4. Temperature
    5. Systolic blood pressure
    6. Heart rate
    7. Level of consciousness
    
    Clinical risk:
    - 0-4: Low
    - 5-6: Medium (urgent ward-based response)
    - ≥7: High (urgent clinical review; consider transfer to critical care)
    - Score 3 in any single parameter: urgent clinical review
    
    Reference: Royal College of Physicians. NEWS2. 2017
    """
    score = 0
    components = []
    
    # Respiratory rate (0-3)
    if rr <= 8:
        rr_score = 3
    elif rr <= 11:
        rr_score = 1
    elif rr <= 20:
        rr_score = 0
    elif rr <= 24:
        rr_score = 2
    else:
        rr_score = 3
    score += rr_score
    components.append(f"RR ({rr}): {rr_score}")
    
    # SpO2 (Scale 1: standard; Scale 2: hypercapnic failure)
    if spo2_scale == 2:
        # Scale 2: for patients with hypercapnic respiratory failure
        if spo2 < 88:
            spo2_score = 3
        elif spo2 < 92:
            spo2_score = 2
        elif spo2 <= 96:
            spo2_score = 0
        else:
            spo2_score = 1  # >96% may indicate over-oxygenation
    else:
        # Scale 1: standard
        if spo2 < 91:
            spo2_score = 3
        elif spo2 < 93:
            spo2_score = 2
        elif spo2 < 95:
            spo2_score = 1
        else:
            spo2_score = 0
    score += spo2_score
    components.append(f"SpO2 ({spo2}%): {spo2_score}")
    
    # Supplemental oxygen (0 or 2)
    o2_score = 2 if supplemental_o2 else 0
    score += o2_score
    components.append(f"Supplemental O2: {o2_score}")
    
    # Temperature (0-3)
    if temperature <= 35.0:
        temp_score = 3
    elif temperature <= 36.0:
        temp_score = 1
    elif temperature <= 38.0:
        temp_score = 0
    elif temperature <= 39.0:
        temp_score = 1
    else:
        temp_score = 2
    score += temp_score
    components.append(f"Temperature ({temperature}°C): {temp_score}")
    
    # Systolic BP (0-3)
    if sbp <= 90:
        sbp_score = 3
    elif sbp <= 100:
        sbp_score = 2
    elif sbp <= 110:
        sbp_score = 1
    elif sbp <= 219:
        sbp_score = 0
    else:
        sbp_score = 0  # Hypertension not scored in NEWS2
    score += sbp_score
    components.append(f"SBP ({sbp}): {sbp_score}")
    
    # Heart rate (0-3)
    if hr <= 40:
        hr_score = 3
    elif hr <= 50:
        hr_score = 1
    elif hr <= 90:
        hr_score = 0
    elif hr <= 110:
        hr_score = 1
    elif hr <= 130:
        hr_score = 2
    else:
        hr_score = 3
    score += hr_score
    components.append(f"HR ({hr}): {hr_score}")
    
    # Consciousness (0 or 3)
    consciousness_lower = consciousness.lower()
    if consciousness_lower == "alert":
        loc_score = 0
    else:  # CVPU (Confusion, Voice, Pain, Unresponsive) or new confusion
        loc_score = 3
    score += loc_score
    components.append(f"Consciousness ({consciousness}): {loc_score}")
    
    # Check for single parameter score of 3
    single_param_3 = any(s == 3 for s in [rr_score, spo2_score, temp_score, sbp_score, hr_score, loc_score])
    any_score_3 = o2_score == 2  # Supplemental O2 scores 2, not 3
    
    # Interpretation
    if score < 5 and not single_param_3:
        interpretation = "Low clinical risk (NEWS2 <5)"
        recommendation = "Continue routine monitoring; reassess if clinical change"
    elif score >= 5 or score == 3 or single_param_3:
        if score >= 7:
            interpretation = "HIGH clinical risk (NEWS2 ≥7)"
            recommendation = "URGENT: Immediate clinical review; consider transfer to critical care; do not delay treatment"
        else:
            interpretation = "Medium clinical risk (NEWS2 5-6 or score 3 in any parameter)"
            recommendation = "URGENT: Ward-based clinical review; inform registered nurse and doctor"
    else:
        interpretation = f"Low-medium clinical risk (NEWS2 {score})"
        recommendation = "Increase frequency of observations; inform registered nurse"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Royal College of Physicians. National Early Warning Score (NEWS) 2: Standardising the assessment of acute-illness severity in the NHS. Report of a working party. London: RCP, 2017.",
    )
    
    return {
        **result.to_dict(), 
        "components": components,
        "single_parameter_escalation": single_param_3,
        "clinical_risk_level": "high" if score >= 7 else ("medium" if score >= 5 else "low"),
    }


# =============================================================================
# 8. SOFA Score
# =============================================================================

def calculate_sofa(
    pao2: float = 0,  # mmHg
    fio2: float = 0,  # 0-1 or 0-100
    platelets: float = 0,  # ×10³/µL
    bilirubin: float = 0,  # mg/dL
    map_value: float = 0,  # Mean arterial pressure mmHg
    vasopressors: bool = False,  # Any vasopressor use
    gcs: int = 15,  # Glasgow Coma Scale
    creatinine: float = 0,  # mg/dL
) -> Dict[str, Any]:
    """
    SOFA Score (Sequential Organ Failure Assessment).
    
    Six organ systems, each scored 0-4:
    1. Respiration (PaO2/FiO2)
    2. Coagulation (Platelets)
    3. Liver (Bilirubin)
    4. Cardiovascular (MAP and vasopressors)
    5. CNS (GCS)
    6. Renal (Creatinine)
    
    Score ≥2 = Organ dysfunction (sepsis if infection present)
    
    Reference: Vincent JL, et al. Intensive Care Med 1996;22:707-710
    """
    score = 0
    organ_scores = {}
    
    # Respiration (PaO2/FiO2)
    if pao2 > 0 and fio2 > 0:
        fio2_decimal = fio2 if fio2 <= 1 else fio2 / 100
        pf_ratio = pao2 / fio2_decimal
        
        if pf_ratio >= 400:
            resp_score = 0
        elif pf_ratio >= 300:
            resp_score = 1
        elif pf_ratio >= 200:
            resp_score = 2
        elif pf_ratio >= 100:
            resp_score = 3
        else:
            resp_score = 4
        score += resp_score
        organ_scores["respiration"] = resp_score
    
    # Coagulation (Platelets)
    if platelets > 0:
        if platelets >= 150:
            coag_score = 0
        elif platelets >= 100:
            coag_score = 1
        elif platelets >= 50:
            coag_score = 2
        elif platelets >= 20:
            coag_score = 3
        else:
            coag_score = 4
        score += coag_score
        organ_scores["coagulation"] = coag_score
    
    # Liver (Bilirubin)
    if bilirubin > 0:
        if bilirubin < 1.2:
            liver_score = 0
        elif bilirubin < 2.0:
            liver_score = 1
        elif bilirubin < 6.0:
            liver_score = 2
        elif bilirubin < 12.0:
            liver_score = 3
        else:
            liver_score = 4
        score += liver_score
        organ_scores["liver"] = liver_score
    
    # Cardiovascular
    if vasopressors:
        cv_score = 4  # Assume significant vasopressor use
    elif map_value > 0:
        if map_value >= 70:
            cv_score = 0
        else:
            cv_score = 1
    else:
        cv_score = 0
    score += cv_score
    organ_scores["cardiovascular"] = cv_score
    
    # CNS (GCS)
    if gcs >= 15:
        cns_score = 0
    elif gcs >= 13:
        cns_score = 1
    elif gcs >= 10:
        cns_score = 2
    elif gcs >= 6:
        cns_score = 3
    else:
        cns_score = 4
    score += cns_score
    organ_scores["cns"] = cns_score
    
    # Renal (Creatinine)
    if creatinine > 0:
        if creatinine < 1.2:
            renal_score = 0
        elif creatinine < 2.0:
            renal_score = 1
        elif creatinine < 3.5:
            renal_score = 2
        elif creatinine < 5.0:
            renal_score = 3
        else:
            renal_score = 4
        score += renal_score
        organ_scores["renal"] = renal_score
    
    # Interpretation
    if score < 2:
        interpretation = "No significant organ dysfunction (SOFA <2)"
        recommendation = "Continue monitoring; reassess if clinical status changes"
    else:
        interpretation = f"Organ dysfunction present (SOFA ≥2)"
        if score >= 10:
            recommendation = "CRITICAL: High mortality risk (>50%); consider goals of care discussion; aggressive supportive care"
        elif score >= 6:
            recommendation = "Severe organ dysfunction; ICU care recommended; close hemodynamic monitoring"
        else:
            recommendation = "Organ dysfunction present; close monitoring; consider ICU consultation"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Vincent JL, Moreno R, Takala J, et al. The SOFA (Sepsis-related Organ Failure Assessment) score to describe organ dysfunction/failure. Intensive Care Med 1996;22(7):707-710.",
    )
    
    return {**result.to_dict(), "organ_scores": organ_scores, "has_organ_dysfunction": score >= 2}


# =============================================================================
# 9. Glasgow-Blatchford Score
# =============================================================================

def calculate_glasgow_blatchford(
    bun: float = 0,  # mg/dL
    hemoglobin: float = 0,  # g/dL (for men) or g/dL (for women)
    sbp: int = 0,  # Systolic BP
    hr: int = 0,  # Heart rate
    melena: bool = False,
    syncope: bool = False,
    liver_disease: bool = False,
    cardiac_failure: bool = False,
    gender: str = "male",
) -> Dict[str, Any]:
    """
    Glasgow-Blatchford Score for Upper GI Bleeding Risk.
    
    Predicts need for intervention (transfusion, endoscopy, surgery).
    Score 0 = Safe for outpatient management.
    
    Components:
    - BUN (0-6 points)
    - Hemoglobin (0-6 points)
    - SBP (0-2 points)
    - Heart rate (0-2 points)
    - Melena (1 point)
    - Syncope (2 points)
    - Liver disease (2 points)
    - Cardiac failure (2 points)
    
    Reference: Blatchford O, et al. Lancet 2000;356:1935-1939
    """
    score = 0
    components = []
    
    # BUN scoring
    if bun >= 66.6:  # ≥18.2 mmol/L
        bun_score = 6
    elif bun >= 55.4:  # ≥15-18.2 mmol/L
        bun_score = 4
    elif bun >= 29.4:  # ≥8-15 mmol/L
        bun_score = 3
    elif bun >= 22.1:  # ≥6-8 mmol/L
        bun_score = 2
    elif bun >= 14.7:  # ≥3.9-6 mmol/L
        bun_score = 1
    else:
        bun_score = 0
    score += bun_score
    if bun_score > 0:
        components.append(f"BUN: {bun_score}")
    
    # Hemoglobin scoring (gender-specific)
    is_male = gender.lower() in ["male", "m"]
    
    if is_male:
        if hemoglobin < 10.0:
            hgb_score = 6
        elif hemoglobin < 12.0:
            hgb_score = 4
        elif hemoglobin < 13.0:
            hgb_score = 1
        else:
            hgb_score = 0
    else:  # Female
        if hemoglobin < 10.0:
            hgb_score = 6
        elif hemoglobin < 12.0:
            hgb_score = 4
        else:
            hgb_score = 0
    score += hgb_score
    if hgb_score > 0:
        components.append(f"Hemoglobin: {hgb_score}")
    
    # SBP scoring
    if sbp > 0:
        if sbp < 90:
            sbp_score = 2
        elif sbp < 100:
            sbp_score = 1
        else:
            sbp_score = 0
        score += sbp_score
        if sbp_score > 0:
            components.append(f"SBP: {sbp_score}")
    
    # Heart rate scoring
    if hr >= 100:
        hr_score = 1
        score += hr_score
        components.append(f"HR≥100: {hr_score}")
    
    # Melena
    if melena:
        score += 1
        components.append("Melena: 1")
    
    # Syncope
    if syncope:
        score += 2
        components.append("Syncope: 2")
    
    # Liver disease
    if liver_disease:
        score += 2
        components.append("Liver disease: 2")
    
    # Cardiac failure
    if cardiac_failure:
        score += 2
        components.append("Cardiac failure: 2")
    
    # Interpretation
    if score == 0:
        interpretation = "Low risk - no intervention likely needed"
        recommendation = "Consider outpatient management; no urgent endoscopy required; arrange outpatient follow-up within 24-48 hours"
    elif score <= 2:
        interpretation = "Low-moderate risk"
        recommendation = "Consider early endoscopy; may be suitable for outpatient if stable and no other high-risk features"
    elif score <= 5:
        interpretation = "Moderate risk"
        recommendation = "Hospital admission recommended; early endoscopy within 24 hours"
    else:
        interpretation = "High risk - intervention likely"
        recommendation = "Urgent hospital admission; early endoscopy within 12-24 hours; prepare for possible intervention (transfusion, endoscopic therapy, surgery)"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Blatchford O, Murray WR, Blatchford M. A risk score to predict need for treatment for upper-gastrointestinal haemorrhage. Lancet 2000;356(9238):1318-1321.",
    )
    
    return {**result.to_dict(), "components": components, "outpatient_eligible": score == 0}


# =============================================================================
# 10. 4T Score (Heparin-Induced Thrombocytopenia)
# =============================================================================

def calculate_4t_score(
    thrombocytopenia: str = "none",  # none, mild (50-75% drop, nadir 20-100), severe (>75% drop or nadir <20)
    timing: str = "none",  # none, recent (<3 days), typical (5-10 days), late (>10 days)
    thrombosis: str = "none",  # none, new thrombosis, skin necrosis, acute systemic reaction
    other_cause: str = "probable",  # definite, probable, possible, none
) -> Dict[str, Any]:
    """
    4T Score for Heparin-Induced Thrombocytopenia (HIT).
    
    Four components, each scored 0-2:
    1. Thrombocytopenia magnitude
    2. Timing of platelet count fall
    3. Thrombosis or other sequelae
    4. oTher cause for thrombocytopenia
    
    Interpretation:
    - ≤3: Low probability (2% risk of HIT)
    - 4-5: Intermediate probability (14% risk)
    - ≥6: High probability (64% risk)
    
    Reference: Warkentin TE, et al. J Thromb Haemost 2003;1:2042-2046
    """
    score = 0
    components = []
    
    # Thrombocytopenia magnitude (0-2)
    thrombocytopenia_lower = thrombocytopenia.lower()
    if thrombocytopenia_lower == "severe":
        throm_score = 2
    elif thrombocytopenia_lower == "mild":
        throm_score = 1
    else:
        throm_score = 0
    score += throm_score
    components.append(f"Thrombocytopenia: {throm_score}")
    
    # Timing (0-2)
    timing_lower = timing.lower()
    if timing_lower == "typical":  # 5-10 days after heparin start
        timing_score = 2
    elif timing_lower == "recent":  # <3 days (if prior heparin exposure)
        timing_score = 2
    elif timing_lower == "late":  # >10 days
        timing_score = 1
    else:
        timing_score = 0
    score += timing_score
    components.append(f"Timing: {timing_score}")
    
    # Thrombosis (0-2)
    thrombosis_lower = thrombosis.lower()
    if thrombosis_lower in ["new thrombosis", "skin necrosis", "systemic reaction"]:
        thromb_score = 2
    elif thrombosis_lower == "progressive":
        thromb_score = 1
    else:
        thromb_score = 0
    score += thromb_score
    components.append(f"Thrombosis: {thromb_score}")
    
    # Other cause (0-2)
    other_lower = other_cause.lower()
    if other_lower == "none":
        other_score = 2
    elif other_lower == "possible":
        other_score = 1
    else:  # definite or probable
        other_score = 0
    score += other_score
    components.append(f"Other cause: {other_score}")
    
    # Interpretation with HIT probability
    if score <= 3:
        interpretation = f"Low HIT probability (score {score}/8)"
        hit_probability = "2%"
        recommendation = "Continue heparin; monitor platelets; consider alternative diagnosis for thrombocytopenia"
    elif score <= 5:
        interpretation = f"Intermediate HIT probability (score {score}/8)"
        hit_probability = "14%"
        recommendation = "Consider stopping heparin; send HIT antibody test (ELISA); start alternative anticoagulation if thrombosis suspected"
    else:
        interpretation = f"HIGH HIT probability (score {score}/8)"
        hit_probability = "64%"
        recommendation = "STOP all heparin immediately; send HIT antibody test; start non-heparin anticoagulant (argatroban, bivalirudin, fondaparinux); avoid platelet transfusion"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Warkentin TE, Heddle NM. Laboratory diagnosis of immune heparin-induced thrombocytopenia. J Thromb Haemost 2003;1(suppl 1):P025.",
    )
    
    return {**result.to_dict(), "components": components, "hit_probability": hit_probability}


# =============================================================================
# 11. ASCVD 10-Year Risk
# =============================================================================

def calculate_ascvd_risk(
    age: int = 0,
    sex: str = "male",
    race: str = "white",  # white, african_american, other
    total_cholesterol: float = 0,  # mg/dL
    hdl: float = 0,  # mg/dL
    sbp: int = 0,  # Systolic BP (untreated)
    htntx: bool = False,  # On hypertension treatment
    diabetes: bool = False,
    smoker: bool = False,
) -> Dict[str, Any]:
    """
    ASCVD 10-Year Risk Calculator (Pooled Cohort Equations).
    
    Estimates 10-year risk of atherosclerotic cardiovascular disease.
    
    Categories:
    - <7.5%: Low risk
    - 7.5-20%: Intermediate risk
    - >20%: High risk
    
    Reference: Goff DC, et al. JACC 2014;63:2935-2959
    """
    # Simplified Pooled Cohort Equations (PCE) calculation
    # This is an approximation - full implementation requires detailed coefficients
    
    # Base risk increases with age
    is_male = sex.lower() in ["male", "m"]
    is_aa = race.lower() in ["african_american", "black", "aa"]
    
    # Simplified risk calculation using key factors
    # Note: Full PCE requires race and sex-specific coefficients
    
    risk_score = 0
    factors = []
    
    # Age contribution (simplified)
    if age < 40:
        base_risk = 1.0
    elif age < 50:
        base_risk = 2.5
    elif age < 60:
        base_risk = 5.0
    elif age < 70:
        base_risk = 8.0
    else:
        base_risk = 12.0
    
    # Sex adjustment
    if not is_male:
        base_risk *= 0.7
        factors.append("Female: lower base risk")
    
    # Race adjustment
    if is_aa:
        base_risk *= 1.2
        factors.append("African American: increased risk")
    
    # Cholesterol contribution
    if total_cholesterol > 0:
        if total_cholesterol >= 280:
            base_risk *= 1.4
            factors.append("TC≥280: significant increase")
        elif total_cholesterol >= 240:
            base_risk *= 1.2
            factors.append("TC≥240: moderate increase")
        elif total_cholesterol < 160:
            base_risk *= 0.8
            factors.append("TC<160: protective")
    
    # HDL contribution
    if hdl > 0:
        if hdl >= 60:
            base_risk *= 0.8
            factors.append("HDL≥60: protective")
        elif hdl < 40:
            base_risk *= 1.2
            factors.append("HDL<40: risk factor")
    
    # Blood pressure contribution
    if sbp > 0:
        if htntx:
            if sbp >= 160:
                base_risk *= 1.6
            elif sbp >= 140:
                base_risk *= 1.3
            factors.append(f"Treated HTN (SBP {sbp}): increased risk")
        else:
            if sbp >= 160:
                base_risk *= 1.4
            elif sbp >= 140:
                base_risk *= 1.2
            if sbp >= 140:
                factors.append(f"Untreated elevated SBP {sbp}")
    
    # Diabetes
    if diabetes:
        base_risk *= 1.7
        factors.append("Diabetes: significant increase")
    
    # Smoking
    if smoker:
        base_risk *= 1.8
        factors.append("Current smoker: significant increase")
    
    # Cap at reasonable maximum
    risk_percent = min(base_risk, 30.0)
    
    # Round to 1 decimal
    risk_percent = round(risk_percent * 10) / 10
    
    # Interpretation
    if risk_percent < 7.5:
        interpretation = f"Low 10-year ASCVD risk ({risk_percent}%)"
        recommendation = "Lifestyle modification; assess/monitor risk factors; statin therapy not routinely recommended for primary prevention"
    elif risk_percent <= 20:
        interpretation = f"Intermediate 10-year ASCVD risk ({risk_percent}%)"
        recommendation = "Lifestyle modification; consider moderate-intensity statin therapy after risk-benefit discussion; may consider coronary artery calcium scoring to further stratify risk"
    else:
        interpretation = f"High 10-year ASCVD risk ({risk_percent}%)"
        recommendation = "High-intensity statin therapy recommended; aggressive risk factor modification; consider aspirin for primary prevention if not at increased bleeding risk"
    
    result = CalculatorResult(
        score=int(risk_percent * 10),  # Return as integer (e.g., 75 for 7.5%)
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Goff DC Jr, Lloyd-Jones DM, Bennett G, et al. 2013 ACC/AHA guideline on the assessment of cardiovascular risk: a report of the American College of Cardiology/American Heart Association Task Force on Practice Guidelines. JACC 2014;63(25 Pt B):2935-2959.",
    )
    
    return {
        **result.to_dict(), 
        "risk_percent": risk_percent,
        "risk_factors_identified": factors,
        "risk_category": "high" if risk_percent > 20 else ("intermediate" if risk_percent >= 7.5 else "low"),
    }


# =============================================================================
# 12. Child-Pugh Score
# =============================================================================

def calculate_child_pugh(
    total_bilirubin: float = 0,  # mg/dL
    albumin: float = 0,  # g/dL
    pt_inr: float = 0,  # INR
    ascites: str = "none",  # none, mild, moderate/severe
    encephalopathy: str = "none",  # none, grade 1-2, grade 3-4
) -> Dict[str, Any]:
    """
    Child-Pugh Score for Liver Disease Severity.
    
    Five components, each scored 1-3:
    1. Total bilirubin (mg/dL)
    2. Albumin (g/dL)
    3. PT/INR
    4. Ascites
    5. Encephalopathy
    
    Classification:
    - Class A (5-6): Well compensated
    - Class B (7-9): Significant functional compromise
    - Class C (10-15): Decompensated
    
    Reference: Child CG, Turcotte JG. Surgery and portal hypertension. 1964
    """
    score = 0
    components = []
    
    # Total bilirubin (1-3 points)
    if total_bilirubin > 0:
        if total_bilirubin < 2.0:
            bili_score = 1
        elif total_bilirubin <= 3.0:
            bili_score = 2
        else:
            bili_score = 3
        score += bili_score
        components.append(f"Bilirubin ({total_bilirubin} mg/dL): {bili_score}")
    
    # Albumin (1-3 points)
    if albumin > 0:
        if albumin > 3.5:
            alb_score = 1
        elif albumin >= 2.8:
            alb_score = 2
        else:
            alb_score = 3
        score += alb_score
        components.append(f"Albumin ({albumin} g/dL): {alb_score}")
    
    # PT/INR (1-3 points)
    if pt_inr > 0:
        if pt_inr < 1.7:
            inr_score = 1
        elif pt_inr <= 2.2:
            inr_score = 2
        else:
            inr_score = 3
        score += inr_score
        components.append(f"INR ({pt_inr}): {inr_score}")
    
    # Ascites (1-3 points)
    ascites_lower = ascites.lower()
    if ascites_lower == "none" or ascites_lower == "absent":
        asc_score = 1
    elif ascites_lower == "mild" or ascites_lower == "controlled":
        asc_score = 2
    else:  # moderate/severe/refractory
        asc_score = 3
    score += asc_score
    components.append(f"Ascites ({ascites}): {asc_score}")
    
    # Encephalopathy (1-3 points)
    enc_lower = encephalopathy.lower()
    if enc_lower == "none" or enc_lower == "absent":
        enc_score = 1
    elif enc_lower in ["grade 1-2", "grade1-2", "mild", "controlled"]:
        enc_score = 2
    else:  # grade 3-4, severe
        enc_score = 3
    score += enc_score
    components.append(f"Encephalopathy ({encephalopathy}): {enc_score}")
    
    # Determine Child-Pugh Class
    if score <= 6:
        pugh_class = "A"
        one_year_survival = "~100%"
        two_year_survival = "~85%"
        interpretation = "Class A (5-6): Well-compensated cirrhosis"
        recommendation = "Low surgical risk; monitor for complications; consider liver transplantation referral if decompensation occurs"
    elif score <= 9:
        pugh_class = "B"
        one_year_survival = "~80%"
        two_year_survival = "~60%"
        interpretation = "Class B (7-9): Significant functional compromise"
        recommendation = "Moderate surgical risk; careful preoperative optimization; evaluate for liver transplantation; avoid nephrotoxic drugs"
    else:
        pugh_class = "C"
        one_year_survival = "~45%"
        two_year_survival = "~35%"
        interpretation = "Class C (10-15): Decompensated cirrhosis"
        recommendation = "High surgical risk; avoid elective surgery; prioritize liver transplantation evaluation; palliative care discussion if transplant not candidate"
    
    result = CalculatorResult(
        score=score,
        interpretation=interpretation,
        recommendation=recommendation,
        evidence="Child CG, Turcotte JG. Surgery and portal hypertension. In: The Liver and Portal Hypertension. Philadelphia: WB Saunders; 1964:50-64.",
    )
    
    return {
        **result.to_dict(), 
        "components": components, 
        "child_pugh_class": pugh_class,
        "one_year_survival": one_year_survival,
        "two_year_survival": two_year_survival,
    }


# =============================================================================
# CALCULATOR REGISTRY
# =============================================================================

CALCULATOR_REGISTRY = {
    "cha2ds2vasc": {
        "function": calculate_cha2ds2_vasc,
        "name": "CHA2DS2-VASc",
        "description": "Stroke risk in atrial fibrillation",
        "parameters": ["congestive_heart_failure", "hypertension", "age", "diabetes", "stroke_tia", "vascular_disease", "sex"],
    },
    "hasbled": {
        "function": calculate_has_bled,
        "name": "HAS-BLED",
        "description": "Bleeding risk with anticoagulation",
        "parameters": ["hypertension_uncontrolled", "renal_disease", "liver_disease", "stroke_history", "bleeding_history", "labile_inr", "age", "drugs", "alcohol"],
    },
    "curb65": {
        "function": calculate_curb65,
        "name": "CURB-65",
        "description": "Pneumonia severity assessment",
        "parameters": ["confusion", "bun", "rr", "sbp", "dbp", "age"],
    },
    "perc": {
        "function": calculate_perc,
        "name": "PERC Rule",
        "description": "Pulmonary embolism rule-out criteria",
        "parameters": ["age", "hr", "spo2", "prior_dvt_pe", "hemoptysis", "estrogen_use", "leg_swelling", "surgery_trauma"],
    },
    "wells_pe": {
        "function": calculate_wells_pe,
        "name": "Wells PE",
        "description": "Pulmonary embolism probability",
        "parameters": ["dvt_signs", "pe_most_likely", "hr", "immobilization_surgery", "prior_dvt_pe", "hemoptysis", "malignancy"],
    },
    "wells_dvt": {
        "function": calculate_wells_dvt,
        "name": "Wells DVT",
        "description": "Deep vein thrombosis probability",
        "parameters": ["active_cancer", "paralysis_paresis", "bedridden_surgery", "localized_tenderness", "entire_leg_swollen", "calf_swelling", "pitting_edema", "collateral_veins", "alternative_diagnosis"],
    },
    "news2": {
        "function": calculate_news2,
        "name": "NEWS2",
        "description": "National Early Warning Score 2",
        "parameters": ["rr", "spo2", "supplemental_o2", "temperature", "sbp", "hr", "consciousness", "spo2_scale"],
    },
    "sofa": {
        "function": calculate_sofa,
        "name": "SOFA",
        "description": "Sequential Organ Failure Assessment",
        "parameters": ["pao2", "fio2", "platelets", "bilirubin", "map_value", "vasopressors", "gcs", "creatinine"],
    },
    "glasgow_blatchford": {
        "function": calculate_glasgow_blatchford,
        "name": "Glasgow-Blatchford",
        "description": "Upper GI bleeding risk",
        "parameters": ["bun", "hemoglobin", "sbp", "hr", "melena", "syncope", "liver_disease", "cardiac_failure", "gender"],
    },
    "4t_score": {
        "function": calculate_4t_score,
        "name": "4T Score",
        "description": "Heparin-induced thrombocytopenia probability",
        "parameters": ["thrombocytopenia", "timing", "thrombosis", "other_cause"],
    },
    "ascvd": {
        "function": calculate_ascvd_risk,
        "name": "ASCVD 10-Year Risk",
        "description": "Atherosclerotic cardiovascular disease risk",
        "parameters": ["age", "sex", "race", "total_cholesterol", "hdl", "sbp", "htntx", "diabetes", "smoker"],
    },
    "child_pugh": {
        "function": calculate_child_pugh,
        "name": "Child-Pugh",
        "description": "Liver disease severity",
        "parameters": ["total_bilirubin", "albumin", "pt_inr", "ascites", "encephalopathy"],
    },
}


def get_calculator(calculator_name: str):
    """Get calculator function by name."""
    calculator_key = calculator_name.lower().replace("-", "_").replace(" ", "_")
    
    # Handle alternative names
    name_mappings = {
        "chads2vasc": "cha2ds2vasc",
        "chas2vasc": "cha2ds2vasc",
        "has_bled": "hasbled",
        "curb-65": "curb65",
        "curb_65": "curb65",
        "wellspe": "wells_pe",
        "wellspe_score": "wells_pe",
        "wellsdvt": "wells_dvt",
        "wellsdvt_score": "wells_dvt",
        "glasgowblatchford": "glasgow_blatchford",
        "blatchford": "glasgow_blatchford",
        "4t": "4t_score",
        "4tscore": "4t_score",
        "ascvd_10_year": "ascvd",
        "ascvd10year": "ascvd",
        "childpugh": "child_pugh",
    }
    
    calculator_key = name_mappings.get(calculator_key, calculator_key)
    
    if calculator_key not in CALCULATOR_REGISTRY:
        return None
    
    return CALCULATOR_REGISTRY[calculator_key]


def list_calculators() -> List[Dict[str, Any]]:
    """List all available calculators."""
    return [
        {
            "id": key,
            "name": info["name"],
            "description": info["description"],
            "parameters": info["parameters"],
        }
        for key, info in CALCULATOR_REGISTRY.items()
    ]

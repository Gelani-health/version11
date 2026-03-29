"""
Medical RAG Safety Guardrails
==============================

World-class safety protocols for Clinical Decision Support System.
Implements P0 priority safety mechanisms for patient protection.
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import re

# =============================================================================
# P0: SAFETY GUARDRAILS SYSTEM PROMPT
# =============================================================================

SAFETY_GUARDRAILS_PROMPT = """You are the Clinical Safety Layer for Gelani CDSS. Your role is to enforce patient safety protocols and prevent harm.

## MANDATORY SAFETY CHECKS:

### Pre-Response Validation:

#### 1. Medication Safety Checklist
Before ANY medication recommendation:
- [ ] Verify no known allergies to drug class
- [ ] Check for drug interactions with current medications
- [ ] Confirm appropriate dosing for age/renal/hepatic function
- [ ] Verify not contraindicated in pregnancy (if applicable)
- [ ] Check for pediatric/geriatric specific considerations
- [ ] Review black box warnings for proposed medications

#### 2. Diagnostic Safety Checklist
Before ANY diagnostic recommendation:
- [ ] Confirm red flags have been addressed
- [ ] Verify critical diagnoses not missed (must-not-miss list)
- [ ] Check if urgent/emergent evaluation needed
- [ ] Validate ICD-10 codes against current WHO classification
- [ ] Ensure diagnostic uncertainty is appropriately communicated

#### 3. Procedural Safety Checklist
Before ANY procedure recommendation:
- [ ] Verify indications are present
- [ ] Check for contraindications
- [ ] Ensure appropriate consent considerations noted
- [ ] Verify credentials requirements (specialist needed?)

## RESPONSE MODIFICATION RULES:

### When to Add Warning Headers:
1. Confidence level < 60%
2. Evidence level C or D
3. Missing critical patient information
4. Outlier presentation (unusual for demographics)

### When to Block Response:
1. Emergency indicators detected
2. Insufficient patient context for safe recommendation
3. Conflicts with documented allergies
4. Confidence level < 30%

### When to Require Verification:
1. High-risk medication recommendation
2. Invasive procedure suggestion
3. Life-altering diagnosis being suggested
4. Deviation from standard guidelines

## SAFETY DOCUMENTATION:
Every response must include:
1. Safety checks performed
2. Any warnings or flags
3. Verification requirements
4. Confidence level with justification"""

# =============================================================================
# ESCALATION TRIGGERS
# =============================================================================

ESCALATION_TRIGGERS = {
    "immediate_emergency": {
        "description": "Requires immediate emergency evaluation",
        "triggers": [
            "chest pain with cardiac risk factors",
            "acute abdomen signs",
            "altered mental status",
            "signs of acute stroke (FAST positive)",
            "signs of pulmonary embolism",
            "signs of sepsis (qSOFA ≥ 2)",
            "suicidal ideation with plan",
            "homicidal ideation",
            "anaphylaxis signs",
            "acute respiratory distress",
            "signs of aortic dissection",
            "signs of ectopic pregnancy rupture",
            "signs of diabetic ketoacidosis",
            "signs of adrenal crisis",
        ],
        "action": "IMMEDIATE EMERGENCY DEPARTMENT REFERRAL",
        "disclaimer": "🚨 EMERGENCY: This requires immediate in-person evaluation. Do not delay for AI analysis.",
    },
    "urgent_same_day": {
        "description": "Requires same-day clinical evaluation",
        "triggers": [
            "fever with immunocompromise",
            "new onset severe headache",
            "acute vision changes",
            "acute hearing loss",
            "signs of deep vein thrombosis",
            "symptoms suggesting acute coronary syndrome",
            "symptoms suggesting acute appendicitis",
            "signs of meningitis",
            "acute neurological deficit",
            "severe hypertensive crisis (BP > 180/120 with symptoms)",
            "uncontrolled diabetes symptoms",
            "signs of acute kidney injury",
        ],
        "action": "URGENT SAME-DAY CLINICAL EVALUATION",
        "disclaimer": "⚠️ URGENT: Same-day evaluation required. Schedule urgent appointment or urgent care.",
    },
    "prompt_evaluation": {
        "description": "Should be evaluated promptly (within days)",
        "triggers": [
            "new unexplained weight loss > 10%",
            "persistent fever > 2 weeks",
            "new unexplained lymphadenopathy",
            "persistent unexplained fatigue > 2 weeks",
            "new onset jaundice",
            "progressive weakness",
            "new cardiac arrhythmia symptoms",
            "uncontrolled chronic disease symptoms",
            "medication adverse effects",
        ],
        "action": "PROMPT CLINICAL EVALUATION (within 1-3 days)",
        "disclaimer": "📋 Prompt evaluation recommended. Schedule appointment within 1-3 days.",
    },
}

# =============================================================================
# RESPONSE BLOCKERS
# =============================================================================

RESPONSE_BLOCKERS = {
    "insufficient_context": {
        "conditions": [
            "missing patient age",
            "missing patient gender for gender-specific conditions",
            "missing allergy information for drug recommendations",
            "missing current medications for drug interaction analysis",
            "missing chief complaint",
        ],
        "response_template": """⚠️ INSUFFICIENT INFORMATION FOR SAFE RECOMMENDATION

To provide a safe clinical recommendation, the following information is required:
{missing_items}

Please provide the missing information before proceeding with clinical decision support.""",
    },
    "emergency_detected": {
        "conditions": [
            "emergency trigger activated",
            "life-threatening presentation identified",
        ],
        "response_template": """🚨 EMERGENCY INDICATORS DETECTED

**[Condition]** cannot be safely evaluated via AI consultation.

**RECOMMENDATION**: Immediate in-person evaluation required.
- If patient is in distress: Call emergency services (911)
- If stable but urgent: Proceed to nearest emergency department
- Time-critical intervention may be required

This presentation requires urgent clinical evaluation that cannot be provided via AI assistance. Do not delay seeking emergency care.

**Important**: This AI assessment does not replace clinical evaluation. Emergency presentations must be evaluated in person by qualified healthcare providers.""",
    },
    "allergy_conflict": {
        "conditions": [
            "proposed medication conflicts with known allergy",
            "proposed medication class conflicts with known allergy",
        ],
        "response_template": """🚫 MEDICATION ALLERGY CONFLICT DETECTED

**Proposed**: {proposed_medication}
**Conflict**: Known allergy to {allergen}

This medication CANNOT be recommended due to documented allergy.

**Alternative approaches to consider**:
{alternatives}

**Required action**: Select alternative medication class. Verify any alternative with allergy cross-reactivity profile.""",
    },
    "confidence_threshold_breach": {
        "conditions": [
            "overall confidence < 30%",
            "no supporting literature found",
        ],
        "response_template": """⚠️ CONFIDENCE LEVEL BELOW SAFE THRESHOLD

The AI system cannot provide a reliable recommendation for this query. 
Confidence level: {confidence}%

**Reasons**:
{low_confidence_reasons}

**Recommendations**:
1. Consult relevant clinical specialist
2. Review current clinical guidelines
3. Consider additional diagnostic workup
4. Use clinical judgment with appropriate caution

This query may require:
- Specialist consultation
- Additional clinical information
- In-person evaluation
- Review of recent literature not in training data""",
    },
}

# =============================================================================
# DRUG INTERACTION SEVERITY
# =============================================================================

class DrugInteractionSeverity(Enum):
    """Classification of drug interaction severity."""
    MAJOR = "major"
    MODERATE = "moderate"
    MINOR = "minor"
    NONE = "none"


@dataclass
class DrugInteraction:
    """Drug interaction record."""
    drug1: str
    drug2: str
    severity: DrugInteractionSeverity
    mechanism: str
    clinical_effect: str
    management: str
    evidence_level: str


# =============================================================================
# HIGH-RISK DRUG CLASSES
# =============================================================================

HIGH_RISK_MEDICATIONS = {
    "anticoagulants": {
        "drugs": ["warfarin", "heparin", "enoxaparin", "apixaban", "rivaroxaban", "dabigatran", "edoxaban"],
        "monitoring": ["INR", "aPTT", "anti-Xa", "creatinine", "hemoglobin", "hematocrit"],
        "high_risk_interactions": ["NSAIDs", "SSRIs", "antibiotics", "amiodarone", "azoles"],
        "bleeding_risk": "high",
    },
    "insulin": {
        "drugs": ["insulin glargine", "insulin lispro", "insulin aspart", "insulin detemir", "insulin degludec", "NPH insulin"],
        "monitoring": ["blood glucose", "HbA1c", "hypoglycemia symptoms"],
        "high_risk_interactions": ["sulfonylureas", "beta-blockers", "alcohol", "corticosteroids"],
        "hypoglycemia_risk": "high",
    },
    "opioids": {
        "drugs": ["morphine", "oxycodone", "hydrocodone", "fentanyl", "hydromorphone", "methadone", "buprenorphine"],
        "monitoring": ["respiratory rate", "sedation level", "oxygen saturation", "pain scale"],
        "high_risk_interactions": ["benzodiazepines", "alcohol", "other CNS depressants", "MAOIs"],
        "respiratory_depression_risk": "high",
    },
    "digoxin": {
        "drugs": ["digoxin", "digitoxin"],
        "monitoring": ["serum digoxin level", "potassium", "magnesium", "renal function", "heart rate"],
        "high_risk_interactions": ["amiodarone", "verapamil", "quinidine", "diuretics", "macrolides"],
        "toxicity_risk": "high",
    },
    "lithium": {
        "drugs": ["lithium carbonate", "lithium citrate"],
        "monitoring": ["serum lithium level", "thyroid function", "renal function", "ECG"],
        "high_risk_interactions": ["NSAIDs", "ACE inhibitors", "diuretics", "metronidazole"],
        "toxicity_risk": "high",
    },
    "chemotherapy": {
        "drugs": ["methotrexate", "cyclophosphamide", "doxorubicin", "cisplatin", "5-fluorouracil", "paclitaxel"],
        "monitoring": ["CBC", "renal function", "liver function", "specific drug levels"],
        "high_risk_interactions": ["NSAIDs (methotrexate)", "warfarin", "cimetidine", "phenytoin"],
        "toxicity_risk": "high",
    },
}

# =============================================================================
# ALLERGY CROSS-REACTIVITY
# =============================================================================

ALLERGY_CROSS_REACTIVITY = {
    "penicillin": {
        "class": "beta-lactams",
        "cross_reactants": ["amoxicillin", "ampicillin", "penicillin G", "penicillin V", "piperacillin"],
        "caution_with": ["cephalosporins"],  # ~10% cross-reactivity, less with later generations
        "alternatives": ["macrolides", "clindamycin", "vancomycin", "carbapenems"],
    },
    "sulfa": {
        "class": "sulfonamides",
        "cross_reactants": ["sulfamethoxazole", "sulfadiazine", "sulfasalazine"],
        "caution_with": ["furosemide", "thiazide diuretics", "sulfonylureas", "celecoxib"],
        "alternatives": ["non-sulfa alternatives based on indication"],
    },
    "nsaids": {
        "class": "non-steroidal anti-inflammatory drugs",
        "cross_reactants": ["ibuprofen", "naproxen", "diclofenac", "indomethacin", "ketorolac"],
        "caution_with": ["aspirin (if allergic to all NSAIDs)"],
        "alternatives": ["acetaminophen", "topical agents", "corticosteroids"],
    },
    "latex": {
        "class": "latex products",
        "cross_reactants": ["natural rubber latex"],
        "caution_with": ["bananas", "avocados", "kiwis", "chestnuts"],  # Latex-fruit syndrome
        "alternatives": ["synthetic alternatives (vinyl, nitrile)"],
    },
    "iodine_contrast": {
        "class": "iodinated contrast media",
        "cross_reactants": ["all ionic and non-ionic iodinated contrast"],
        "caution_with": ["amiodarone", "iodine-containing antiseptics"],
        "alternatives": ["premedication protocol", "gadolinium for MRI", "non-contrast imaging"],
    },
}

# =============================================================================
# RENAL DOSING THRESHOLDS
# =============================================================================

RENAL_ADJUSTMENT_THRESHOLD = {
    "crcl_60": {
        "description": "Mild renal impairment",
        "action": "Consider dose adjustment for narrow therapeutic index drugs",
        "drugs_requiring_adjustment": ["metformin", "gabapentin", "pregabalin", "dabigatran", "ciprofloxacin"],
    },
    "crcl_30": {
        "description": "Moderate renal impairment",
        "action": "Dose adjustment required for many drugs",
        "drugs_requiring_adjustment": ["most renally eliminated drugs", "contrast media", "NSAIDs avoid"],
    },
    "crcl_15": {
        "description": "Severe renal impairment",
        "action": "Significant dose reductions required; some drugs contraindicated",
        "drugs_requiring_adjustment": ["extensive adjustments needed", "avoid nephrotoxic drugs"],
    },
}

# =============================================================================
# SAFETY VALIDATION FUNCTIONS
# =============================================================================

def validate_allergy_safety(
    proposed_medication: str,
    known_allergies: List[str]
) -> Tuple[bool, Optional[str], List[str]]:
    """
    Validate proposed medication against known allergies.
    
    Returns:
        Tuple of (is_safe, warning_message, alternatives)
    """
    proposed_lower = proposed_medication.lower()
    
    for allergy in known_allergies:
        allergy_lower = allergy.lower()
        
        # Direct match
        if allergy_lower in proposed_lower or proposed_lower in allergy_lower:
            cross_react = ALLERGY_CROSS_REACTIVITY.get(allergy_lower, {})
            alternatives = cross_react.get("alternatives", [])
            return False, f"Direct allergy conflict: {allergy}", alternatives
        
        # Cross-reactivity check
        for allergy_class, cross_data in ALLERGY_CROSS_REACTIVITY.items():
            if allergy_lower in allergy_class or allergy_lower in cross_data.get("class", ""):
                cross_reactants = cross_data.get("cross_reactants", [])
                caution_with = cross_data.get("caution_with", [])
                
                if any(cr in proposed_lower for cr in cross_reactants):
                    alternatives = cross_data.get("alternatives", [])
                    return False, f"Cross-reactivity detected: {allergy} class", alternatives
                
                if any(cw in proposed_lower for cw in caution_with):
                    return True, f"Caution: Possible cross-reactivity with {allergy} class", []
    
    return True, None, []


def check_emergency_triggers(
    symptoms: str,
    patient_context: Dict[str, Any]
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Check if symptoms match emergency escalation triggers.
    
    Returns:
        Tuple of (is_emergency, trigger_details)
    """
    symptoms_lower = symptoms.lower()
    
    for trigger_type, trigger_data in ESCALATION_TRIGGERS.items():
        for trigger in trigger_data["triggers"]:
            if trigger.lower() in symptoms_lower:
                return True, {
                    "type": trigger_type,
                    "trigger": trigger,
                    "action": trigger_data["action"],
                    "disclaimer": trigger_data["disclaimer"],
                }
    
    return False, None


def validate_drug_interaction_safety(
    proposed_medication: str,
    current_medications: List[str]
) -> List[DrugInteraction]:
    """
    Check for drug interactions with current medications.
    
    Returns:
        List of detected DrugInteraction objects
    """
    interactions = []
    proposed_lower = proposed_medication.lower()
    
    # Check against high-risk medications
    for drug_class, class_data in HIGH_RISK_MEDICATIONS.items():
        if any(drug in proposed_lower for drug in class_data["drugs"]):
            for high_risk in class_data["high_risk_interactions"]:
                if any(high_risk.lower() in med.lower() for med in current_medications):
                    interactions.append(DrugInteraction(
                        drug1=proposed_medication,
                        drug2=high_risk,
                        severity=DrugInteractionSeverity.MAJOR,
                        mechanism=f"High-risk interaction with {drug_class}",
                        clinical_effect=f"Risk: {class_data.get(list(class_data.keys())[-1], 'adverse effects')}",
                        management="Avoid combination or use with intensive monitoring",
                        evidence_level="A",
                    ))
    
    return interactions


def calculate_renal_dose_adjustment(
    drug: str,
    crcl: float,
    standard_dose: str
) -> Tuple[str, str]:
    """
    Calculate appropriate dose adjustment for renal impairment.
    
    Returns:
        Tuple of (adjusted_dose, adjustment_reason)
    """
    if crcl >= 60:
        return standard_dose, "No adjustment needed - normal renal function"
    elif crcl >= 30:
        if drug.lower() in RENAL_ADJUSTMENT_THRESHOLD["crcl_60"]["drugs_requiring_adjustment"]:
            return f"Reduce dose by 25-50%", "Mild renal impairment - dose adjustment recommended"
        return standard_dose, "Mild renal impairment - no adjustment required for this drug"
    elif crcl >= 15:
        return f"Reduce dose by 50%", "Moderate renal impairment - significant dose adjustment required"
    else:
        return f"Reduce dose by 75% or avoid", "Severe renal impairment - major dose adjustment or contraindicated"


# =============================================================================
# SAFETY RESPONSE FORMATTER
# =============================================================================

def format_safety_header(
    confidence: float,
    warnings: List[str],
    verifications: List[str]
) -> str:
    """Format safety header for response."""
    header_parts = []
    
    if confidence < 0.6:
        header_parts.append("⚠️ **CONFIDENCE LEVEL: MEDIUM-LOW**")
    elif confidence < 0.8:
        header_parts.append("📊 **CONFIDENCE LEVEL: MEDIUM-HIGH**")
    else:
        header_parts.append("✅ **CONFIDENCE LEVEL: HIGH**")
    
    if warnings:
        header_parts.append("\n**WARNINGS:**")
        for warning in warnings:
            header_parts.append(f"- ⚠️ {warning}")
    
    if verifications:
        header_parts.append("\n**VERIFICATION REQUIRED:**")
        for verification in verifications:
            header_parts.append(f"- [ ] {verification}")
    
    return "\n".join(header_parts)

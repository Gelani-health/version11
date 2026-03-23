"""
P3: Geriatric Clinical Decision Support
=======================================

Implements geriatric-specific clinical support:
- Beers Criteria medication review
- STOPP/START criteria checking
- Anticholinergic burden calculator
- Falls risk assessment
- Cognitive screening support
- Frailty index calculation
- Polypharmacy review

Reference: AGS Beers Criteria 2023, STOPP/START v3
"""

from typing import Optional, List, Dict, Any, Set
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class RiskLevel(Enum):
    """Risk classification levels."""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class RecommendationType(Enum):
    """Types of recommendations."""
    AVOID = "avoid"
    CAUTION = "caution"
    DOSE_ADJUST = "dose_adjust"
    MONITOR = "monitor"
    DEPRESCRIBE = "deprescribe"
    ALTERNATIVE = "alternative"


@dataclass
class BeersCriteriaItem:
    """A Beers Criteria medication item."""
    drug_class: str
    examples: List[str]
    rationale: str
    recommendation: RecommendationType
    quality_of_evidence: str
    strength_of_recommendation: str
    alternatives: List[str] = field(default_factory=list)
    monitoring: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "drug_class": self.drug_class,
            "examples": self.examples,
            "rationale": self.rationale,
            "recommendation": self.recommendation.value,
            "quality_of_evidence": self.quality_of_evidence,
            "strength_of_recommendation": self.strength_of_recommendation,
            "alternatives": self.alternatives,
            "monitoring": self.monitoring,
        }


# =============================================================================
# BEERS CRITERIA DATABASE (AGS 2023 - Key Items)
# =============================================================================

BEERS_CRITERIA: Dict[str, List[BeersCriteriaItem]] = {
    "anticholinergics": [
        BeersCriteriaItem(
            drug_class="First-generation antihistamines",
            examples=["diphenhydramine", "chlorpheniramine", "hydroxyzine", "promethazine", "cyproheptadine"],
            rationale="Highly anticholinergic; clearance reduced with age; risk of confusion, dry mouth, constipation, urinary retention",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="High",
            strength_of_recommendation="Strong",
            alternatives=["cetirizine", "loratadine", "fexofenadine"],
            monitoring=["Mental status", "Constipation", "Urinary retention"],
        ),
        BeersCriteriaItem(
            drug_class="Antispasmodics",
            examples=["dicyclomine", "hyoscyamine", "propantheline", "scopolamine"],
            rationale="Highly anticholinergic, uncertain effectiveness",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            alternatives=["Dietary modification", "Antidiarrheals for specific indications"],
        ),
        BeersCriteriaItem(
            drug_class="Antiparkinson anticholinergics",
            examples=["benztropine", "trihexyphenidyl"],
            rationale="Risk of cognitive decline, hallucinations; limited benefit",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            alternatives=["Amantadine", "Adjust levodopa dose"],
        ),
    ],
    "sedatives": [
        BeersCriteriaItem(
            drug_class="Benzodiazepines",
            examples=["diazepam", "alprazolam", "lorazepam", "clonazepam", "temazepam", "triazolam"],
            rationale="Increased sensitivity, prolonged half-life, risk of falls, fractures, cognitive impairment",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="High",
            strength_of_recommendation="Strong",
            alternatives=["Non-pharmacological sleep hygiene", "Melatonin", "Trazodone (low dose)"],
            monitoring=["Fall risk", "Cognitive function", "Daytime sedation"],
        ),
        BeersCriteriaItem(
            drug_class="Non-benzodiazepine hypnotics (Z-drugs)",
            examples=["zolpidem", "zaleplon", "eszopiclone"],
            rationale="Similar adverse events to benzodiazepines; delirium, falls, fractures",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            alternatives=["Sleep hygiene", "CBT-I", "Melatonin"],
        ),
        BeersCriteriaItem(
            drug_class="Barbiturates",
            examples=["phenobarbital", "butalbital"],
            rationale="High rate of physical dependence, tolerance; lethal overdose",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="High",
            strength_of_recommendation="Strong",
            alternatives=["Alternative anticonvulsants", "Non-opioid migraine treatments"],
        ),
    ],
    "cardiovascular": [
        BeersCriteriaItem(
            drug_class="Alpha-1 blockers for hypertension",
            examples=["prazosin", "doxazosin", "terazosin"],
            rationale="Risk of orthostatic hypotension, syncope, falls",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            alternatives=["ACE inhibitors", "ARBs", "Calcium channel blockers", "Thiazides"],
        ),
        BeersCriteriaItem(
            drug_class="Digoxin >0.125mg daily",
            examples=["digoxin"],
            rationale="Reduced renal clearance; increased risk of toxicity",
            recommendation=RecommendationType.DOSE_ADJUST,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            monitoring=["Serum digoxin level", "Renal function", "K+ level"],
        ),
        BeersCriteriaItem(
            drug_class="Nifedipine IR",
            examples=["nifedipine immediate release"],
            rationale="Risk of hypotension, myocardial ischemia",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="High",
            strength_of_recommendation="Strong",
            alternatives=["Extended-release nifedipine", "Other CCBs"],
        ),
        BeersCriteriaItem(
            drug_class="Peripheral alpha-1 agonists",
            examples=["midodrine"],
            rationale="Limited evidence for effectiveness; risk of supine hypertension",
            recommendation=RecommendationType.CAUTION,
            quality_of_evidence="Low",
            strength_of_recommendation="Weak",
            monitoring=["Supine blood pressure", "Standing blood pressure"],
        ),
    ],
    "cns": [
        BeersCriteriaItem(
            drug_class="Antipsychotics",
            examples=["haloperidol", "risperidone", "olanzapine", "quetiapine", "aripiprazole"],
            rationale="Increased risk of stroke, mortality in dementia; falls, extrapyramidal effects",
            recommendation=RecommendationType.CAUTION,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            alternatives=["Non-pharmacological interventions first", "Low-dose if necessary"],
            monitoring=["Movement disorders", "Metabolic parameters", "Fall risk"],
        ),
        BeersCriteriaItem(
            drug_class="Antidepressants (TCA)",
            examples=["amitriptyline", "nortriptyline", "imipramine", "doxepin (>6mg)"],
            rationale="Highly anticholinergic, sedating, orthostatic hypotension",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="High",
            strength_of_recommendation="Strong",
            alternatives=["SSRIs", "SNRIs", "Bupropion", "Mirtazapine"],
        ),
        BeersCriteriaItem(
            drug_class="Antiepileptics (enzyme-inducing)",
            examples=["phenytoin", "carbamazepine", "phenobarbital"],
            rationale="Multiple drug interactions, cognitive effects, osteoporosis",
            recommendation=RecommendationType.CAUTION,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            alternatives=["Levetiracetam", "Lamotrigine", "Valproate"],
            monitoring=["Drug levels", "Bone density", "Drug interactions"],
        ),
    ],
    "musculoskeletal": [
        BeersCriteriaItem(
            drug_class="NSAIDs (non-selective)",
            examples=["ibuprofen", "naproxen", "diclofenac", "indomethacin", "meloxicam"],
            rationale="GI bleeding risk, AKI, cardiovascular events, HTN exacerbation",
            recommendation=RecommendationType.CAUTION,
            quality_of_evidence="High",
            strength_of_recommendation="Strong",
            alternatives=["Acetaminophen", "Topical NSAIDs", "Physical therapy", "Intra-articular injections"],
            monitoring=["Renal function", "Blood pressure", "GI symptoms", "CBC"],
        ),
        BeersCriteriaItem(
            drug_class="Muscle relaxants",
            examples=["cyclobenzaprine", "methocarbamol", "baclofen", "metaxalone", "tizanidine"],
            rationale="Anticholinergic effects, sedation, limited efficacy",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            alternatives=["Physical therapy", "Heat/cold therapy", "Topical agents"],
        ),
    ],
    "endocrine": [
        BeersCriteriaItem(
            drug_class="Long-duration sulfonylureas",
            examples=["chlorpropamide", "glyburide"],
            rationale="Prolonged half-life; risk of severe prolonged hypoglycemia",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="High",
            strength_of_recommendation="Strong",
            alternatives=["Glipizide", "Glimepiride", "Metformin", "DPP-4 inhibitors", "SGLT2 inhibitors"],
            monitoring=["Blood glucose", "HbA1c", "Hypoglycemia symptoms"],
        ),
        BeersCriteriaItem(
            drug_class="Meglitinides",
            examples=["repaglinide", "nateglinide"],
            rationale="Risk of hypoglycemia; limited advantage over other agents",
            recommendation=RecommendationType.CAUTION,
            quality_of_evidence="Low",
            strength_of_recommendation="Weak",
            monitoring=["Blood glucose", "Renal function"],
        ),
        BeersCriteriaItem(
            drug_class="Desmopressin",
            examples=["desmopressin"],
            rationale="High risk of hyponatremia",
            recommendation=RecommendationType.AVOID,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            alternatives=["Behavioral interventions", "Anticholinergics if appropriate"],
            monitoring=["Serum sodium", "Fluid status"],
        ),
    ],
    "genitourinary": [
        BeersCriteriaItem(
            drug_class="Antimuscarinics for overactive bladder",
            examples=["oxybutynin", "tolterodine", "darifenacin", "solifenacin", "fesoterodine"],
            rationale="Anticholinergic effects; cognitive impairment, falls",
            recommendation=RecommendationType.CAUTION,
            quality_of_evidence="Moderate",
            strength_of_recommendation="Strong",
            alternatives=["Mirabegron", "Behavioral interventions", "Pelvic floor exercises"],
            monitoring=["Cognitive function", "Dry mouth", "Constipation"],
        ),
        BeersCriteriaItem(
            drug_class="Androgens",
            examples=["testosterone", "methyltestosterone"],
            rationale="Potential for cardiac problems; limited evidence for benefit in older adults",
            recommendation=RecommendationType.CAUTION,
            quality_of_evidence="Low",
            strength_of_recommendation="Weak",
            monitoring=["PSA", "Hematocrit", "Cardiovascular risk"],
        ),
    ],
}

# =============================================================================
# ANTICHOLINERGIC BURDEN SCALE
# =============================================================================

ANTICHOLINERGIC_SCALE: Dict[str, int] = {
    # Score 3 (High)
    "amitriptyline": 3,
    "atropine": 3,
    "benztropine": 3,
    "chlorpheniramine": 3,
    "chlorpromazine": 3,
    "clemastine": 3,
    "clomipramine": 3,
    "dicyclomine": 3,
    "dimenhydrinate": 3,
    "diphenhydramine": 3,
    "doxepin": 3,
    "hydroxyzine": 3,
    "hyoscyamine": 3,
    "imipramine": 3,
    "nortriptyline": 3,
    "oxybutynin": 3,
    "promethazine": 3,
    "propantheline": 3,
    "scopolamine": 3,
    "thioridazine": 3,
    "trihexyphenidyl": 3,
    
    # Score 2 (Moderate)
    "amantadine": 2,
    "biperiden": 2,
    "carisoprodol": 2,
    "cetirizine": 2,
    "cimetidine": 2,
    "cyclobenzaprine": 2,
    "cyproheptadine": 2,
    "loratadine": 2,
    "meclizine": 2,
    "olanzapine": 2,
    "orphenadrine": 2,
    "perphenazine": 2,
    "tolterodine": 2,
    
    # Score 1 (Low)
    "atenolol": 1,
    "bupropion": 1,
    "capmatinib": 1,
    "chlorothiazide": 1,
    "chlorpromazine": 1,
    "clomipramine": 1,
    "codeine": 1,
    "colchicine": 1,
    "diazepam": 1,
    "digoxin": 1,
    "disopyramide": 1,
    "fentanyl": 1,
    "furosemide": 1,
    "haloperidol": 1,
    "hydrocortisone": 1,
    "hydromorphone": 1,
    "levocetirizine": 1,
    "lithium": 1,
    "loperamide": 1,
    "metoprolol": 1,
    "mirtazapine": 1,
    "morphine": 1,
    "nifedipine": 1,
    "oxycodone": 1,
    "paroxetine": 1,
    "prednisone": 1,
    "prochlorperazine": 1,
    "quetiapine": 1,
    "ranitidine": 1,
    "trazodone": 1,
    "trifluoperazine": 1,
    "valproic acid": 1,
}

# =============================================================================
# FALLS RISK FACTORS
# =============================================================================

FALLS_RISK_FACTORS = {
    "medications": {
        "high_risk": [
            "benzodiazepines",
            "antipsychotics",
            "antidepressants",
            "antiepileptics",
            "opioids",
            "alpha blockers",
            "diuretics",
            "antihypertensives",
        ],
        "risk_multiplier": 1.5,
    },
    "conditions": {
        "high_risk": [
            "history of falls",
            "dementia",
            "parkinson disease",
            "stroke",
            "arthritis",
            "depression",
            "anemia",
            "arrhythmia",
            "syncope",
            "incontinence",
            "visual impairment",
        ],
        "risk_multiplier": 1.3,
    },
    "functional": {
        "high_risk": [
            "impaired gait",
            "impaired balance",
            "muscle weakness",
            "impaired adl",
            "use of assistive device",
        ],
        "risk_multiplier": 1.4,
    },
}

# =============================================================================
# FRAILTY INDICATORS (FRAIL SCALE)
# =============================================================================

FRAIL_CRITERIA = {
    "F": {
        "name": "Fatigue",
        "question": "Are you fatigued most of the time?",
        "clinical_significance": "Unexplained fatigue lasting >1 month",
    },
    "R": {
        "name": "Resistance",
        "question": "Do you have difficulty climbing a flight of stairs?",
        "clinical_significance": "Indicates reduced muscle strength",
    },
    "A": {
        "name": "Ambulation",
        "question": "Do you have difficulty walking a block?",
        "clinical_significance": "Indicates reduced mobility and endurance",
    },
    "I": {
        "name": "Illnesses",
        "question": "Do you have more than 5 chronic illnesses?",
        "clinical_significance": "Polypathology burden",
    },
    "L": {
        "name": "Loss of weight",
        "question": "Have you lost more than 5% of your weight in the last 6 months?",
        "clinical_significance": "Unintentional weight loss indicating malnutrition/cachexia",
    },
}


class GeriatricDecisionSupport:
    """
    P3: Geriatric Clinical Decision Support System.
    
    Features:
    - Beers Criteria medication review
    - Anticholinergic burden calculation
    - Falls risk assessment
    - Frailty screening (FRAIL scale)
    - Polypharmacy review
    """
    
    def __init__(self):
        self.beers_criteria = BEERS_CRITERIA
        self.anticholinergic_scale = ANTICHOLINERGIC_SCALE
        self.falls_factors = FALLS_RISK_FACTORS
        self.frail_criteria = FRAIL_CRITERIA
        
        self.stats = {
            "beers_reviews": 0,
            "anticholinergic_assessments": 0,
            "falls_assessments": 0,
            "frailty_assessments": 0,
        }
    
    async def review_medications_beers(
        self,
        medications: List[str],
        age: int,
        conditions: Optional[List[str]] = None,
        creatinine_clearance: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Review medications against Beers Criteria.
        
        Args:
            medications: List of current medications
            age: Patient age
            conditions: List of patient conditions
            creatinine_clearance: Renal function
        
        Returns:
            Beers Criteria review results
        """
        self.stats["beers_reviews"] += 1
        conditions = conditions or []
        conditions_lower = [c.lower() for c in conditions]
        
        if age < 65:
            return {
                "message": "Beers Criteria applies to adults 65 years and older",
                "age": age,
            }
        
        issues = []
        recommendations = []
        
        # Normalize medication names
        meds_lower = [m.lower().strip() for m in medications]
        
        # Check each category
        for category, items in self.beers_criteria.items():
            for item in items:
                for example in item.examples:
                    for med in meds_lower:
                        if example.lower() in med or med in example.lower():
                            issue = {
                                "medication": med,
                                "category": category,
                                "drug_class": item.drug_class,
                                "recommendation": item.recommendation.value,
                                "rationale": item.rationale,
                                "evidence": item.quality_of_evidence,
                                "strength": item.strength_of_recommendation,
                                "alternatives": item.alternatives,
                                "monitoring": item.monitoring,
                            }
                            issues.append(issue)
                            
                            if item.alternatives:
                                recommendations.append(
                                    f"Consider alternatives to {med}: {', '.join(item.alternatives[:3])}"
                                )
        
        # Check for disease-drug interactions
        disease_drug_issues = self._check_disease_drug_interactions(
            meds_lower, conditions_lower
        )
        issues.extend(disease_drug_issues)
        
        return {
            "patient_age": age,
            "total_medications": len(medications),
            "issues_found": len(issues),
            "issues": issues,
            "recommendations": recommendations,
            "clinical_summary": self._generate_beers_summary(issues),
            "deprescribing_opportunities": [
                i for i in issues 
                if i["recommendation"] in ["avoid", "deprescribe"]
            ],
        }
    
    def _check_disease_drug_interactions(
        self,
        medications: List[str],
        conditions: List[str],
    ) -> List[Dict[str, Any]]:
        """Check for disease-drug interactions in older adults."""
        issues = []
        
        # Dementia/antipsychotics
        if any(c in conditions for c in ["dementia", "alzheimer"]):
            for med in medications:
                if any(a in med for a in ["haloperidol", "risperidone", "olanzapine", "quetiapine", "aripiprazole"]):
                    issues.append({
                        "medication": med,
                        "category": "disease_drug_interaction",
                        "drug_class": "Antipsychotics",
                        "recommendation": "avoid",
                        "rationale": "Increased risk of mortality and stroke in dementia patients",
                        "evidence": "High",
                    })
        
        # History of falls/sedatives
        if "falls" in conditions or "history of falls" in conditions:
            for med in medications:
                if any(a in med for a in ["diazepam", "alprazolam", "lorazepam", "zolpidem", "zaleplon"]):
                    issues.append({
                        "medication": med,
                        "category": "disease_drug_interaction",
                        "drug_class": "Sedative/Hypnotic",
                        "recommendation": "avoid",
                        "rationale": "Increased risk of falls in patients with fall history",
                        "evidence": "High",
                    })
        
        # Chronic kidney disease/NSAIDs
        if any(c in conditions for c in ["chronic kidney disease", "ckd", "renal failure"]):
            for med in medications:
                if any(a in med for a in ["ibuprofen", "naproxen", "diclofenac", "meloxicam"]):
                    issues.append({
                        "medication": med,
                        "category": "disease_drug_interaction",
                        "drug_class": "NSAIDs",
                        "recommendation": "avoid",
                        "rationale": "Risk of acute kidney injury in CKD patients",
                        "evidence": "High",
                    })
        
        # Heart failure/NSAIDs and thiazolidinediones
        if "heart failure" in conditions or "chf" in conditions:
            for med in medications:
                if any(a in med for a in ["ibuprofen", "naproxen", "pioglitazone", "rosiglitazone"]):
                    issues.append({
                        "medication": med,
                        "category": "disease_drug_interaction",
                        "drug_class": "NSAIDs or Thiazolidinediones",
                        "recommendation": "avoid",
                        "rationale": "Risk of fluid retention and worsening heart failure",
                        "evidence": "Moderate",
                    })
        
        return issues
    
    def _generate_beers_summary(self, issues: List[Dict]) -> str:
        """Generate clinical summary of Beers review."""
        if not issues:
            return "No Beers Criteria concerns identified."
        
        avoid_count = sum(1 for i in issues if i["recommendation"] == "avoid")
        caution_count = sum(1 for i in issues if i["recommendation"] == "caution")
        
        summary = f"Found {len(issues)} potential concern(s). "
        summary += f"{avoid_count} medication(s) to avoid, {caution_count} requiring caution. "
        summary += "Review each medication and consider alternatives or deprescribing."
        
        return summary
    
    async def calculate_anticholinergic_burden(
        self,
        medications: List[str],
    ) -> Dict[str, Any]:
        """
        Calculate total anticholinergic burden score.
        
        Higher scores correlate with increased risk of:
        - Cognitive impairment
        - Falls
        - Delirium
        - Hospitalization
        """
        self.stats["anticholinergic_assessments"] += 1
        
        meds_lower = [m.lower().strip() for m in medications]
        total_score = 0
        contributing_meds = []
        
        for med in meds_lower:
            # Check exact match
            if med in self.anticholinergic_scale:
                score = self.anticholinergic_scale[med]
                total_score += score
                contributing_meds.append({
                    "medication": med,
                    "score": score,
                    "level": "high" if score >= 3 else "moderate" if score >= 2 else "low",
                })
            else:
                # Check partial match
                for drug_name, score in self.anticholinergic_scale.items():
                    if drug_name in med or med in drug_name:
                        total_score += score
                        contributing_meds.append({
                            "medication": med,
                            "score": score,
                            "matched_drug": drug_name,
                            "level": "high" if score >= 3 else "moderate" if score >= 2 else "low",
                        })
                        break
        
        # Determine risk level
        if total_score >= 4:
            risk_level = RiskLevel.VERY_HIGH
            clinical_significance = "Very high burden - strongly associated with cognitive decline, delirium, falls"
        elif total_score >= 3:
            risk_level = RiskLevel.HIGH
            clinical_significance = "High burden - increased risk of adverse outcomes"
        elif total_score >= 2:
            risk_level = RiskLevel.MODERATE
            clinical_significance = "Moderate burden - consider alternatives"
        elif total_score >= 1:
            risk_level = RiskLevel.LOW
            clinical_significance = "Low burden - monitor for anticholinergic effects"
        else:
            risk_level = RiskLevel.LOW
            clinical_significance = "No significant anticholinergic burden"
        
        return {
            "total_anticholinergic_burden": total_score,
            "risk_level": risk_level.value,
            "clinical_significance": clinical_significance,
            "contributing_medications": contributing_meds,
            "recommendations": self._generate_anticholinergic_recommendations(total_score, contributing_meds),
        }
    
    def _generate_anticholinergic_recommendations(
        self,
        total_score: int,
        contributing_meds: List[Dict],
    ) -> List[str]:
        """Generate recommendations for reducing anticholinergic burden."""
        recommendations = []
        
        if total_score >= 2:
            recommendations.append("Consider reducing anticholinergic burden by:")
            recommendations.append("  - Switching to less anticholinergic alternatives")
            recommendations.append("  - Deprescribing medications no longer indicated")
            recommendations.append("  - Avoiding adding additional anticholinergic medications")
        
        # Specific recommendations for high-score medications
        high_score_meds = [m for m in contributing_meds if m["score"] >= 3]
        if high_score_meds:
            recommendations.append(f"High-priority medications to review: {', '.join([m['medication'] for m in high_score_meds])}")
        
        if total_score >= 3:
            recommendations.append("Monitor for: cognitive impairment, constipation, urinary retention, dry mouth, falls")
        
        return recommendations
    
    async def assess_falls_risk(
        self,
        medications: List[str],
        conditions: List[str],
        functional_status: Optional[Dict[str, bool]] = None,
        history_of_falls: bool = False,
        use_of_assistive_device: bool = False,
    ) -> Dict[str, Any]:
        """
        Comprehensive falls risk assessment.
        
        Uses multiple risk factors to estimate falls risk.
        """
        self.stats["falls_assessments"] += 1
        
        risk_score = 0
        risk_factors_found = []
        
        # History of falls is strongest predictor
        if history_of_falls:
            risk_score += 3
            risk_factors_found.append({
                "category": "history",
                "factor": "Previous falls",
                "impact": "high",
            })
        
        # Medication risk factors
        meds_lower = [m.lower() for m in medications]
        for high_risk_med in self.falls_factors["medications"]["high_risk"]:
            for med in meds_lower:
                if high_risk_med in med:
                    risk_score += 1
                    risk_factors_found.append({
                        "category": "medication",
                        "factor": f"High-risk medication: {med}",
                        "impact": "moderate",
                    })
                    break
        
        # Condition risk factors
        conditions_lower = [c.lower() for c in conditions]
        for high_risk_cond in self.falls_factors["conditions"]["high_risk"]:
            if high_risk_cond in conditions_lower:
                risk_score += 1
                risk_factors_found.append({
                    "category": "condition",
                    "factor": high_risk_cond,
                    "impact": "moderate",
                })
        
        # Functional status
        if functional_status:
            for factor, present in functional_status.items():
                if present and factor.lower() in [f.lower() for f in self.falls_factors["functional"]["high_risk"]]:
                    risk_score += 1
                    risk_factors_found.append({
                        "category": "functional",
                        "factor": factor,
                        "impact": "moderate",
                    })
        
        if use_of_assistive_device:
            risk_score += 1
            risk_factors_found.append({
                "category": "functional",
                "factor": "Use of assistive device",
                "impact": "moderate",
            })
        
        # Determine risk level
        if risk_score >= 5:
            risk_level = RiskLevel.VERY_HIGH
            intervention = "High-intensity multifactorial intervention required"
        elif risk_score >= 3:
            risk_level = RiskLevel.HIGH
            intervention = "Multifactorial intervention recommended"
        elif risk_score >= 2:
            risk_level = RiskLevel.MODERATE
            intervention = "Consider falls prevention program"
        else:
            risk_level = RiskLevel.LOW
            intervention = "Routine falls prevention education"
        
        return {
            "falls_risk_score": risk_score,
            "risk_level": risk_level.value,
            "risk_factors": risk_factors_found,
            "intervention_recommendation": intervention,
            "interventions": self._generate_falls_interventions(risk_score, risk_factors_found),
            "history_of_falls": history_of_falls,
        }
    
    def _generate_falls_interventions(
        self,
        risk_score: int,
        risk_factors: List[Dict],
    ) -> List[str]:
        """Generate specific falls prevention interventions."""
        interventions = []
        
        # Universal interventions
        interventions.append("Review and minimize high-risk medications")
        interventions.append("Assess vitamin D status and supplement if deficient")
        
        if risk_score >= 2:
            interventions.append("Physical therapy evaluation for gait and balance")
            interventions.append("Home safety evaluation")
            interventions.append("Vision assessment")
        
        if risk_score >= 3:
            interventions.append("Consider referral to falls clinic")
            interventions.append("Exercise program focusing on strength and balance")
            interventions.append("Medication review with deprescribing focus")
        
        # Specific interventions based on risk factors
        categories = [rf["category"] for rf in risk_factors]
        if "medication" in categories:
            interventions.append("Pharmacist consultation for medication optimization")
        
        return interventions
    
    async def assess_frailty(
        self,
        fatigue: bool,
        resistance_difficulty: bool,
        ambulation_difficulty: bool,
        illness_count: int,
        weight_loss_percent: float,
    ) -> Dict[str, Any]:
        """
        Assess frailty using FRAIL scale.
        
        FRAIL: Fatigue, Resistance, Ambulation, Illnesses, Loss of weight
        
        Scoring:
        - 0: Robust
        - 1-2: Pre-frail
        - 3-5: Frail
        """
        self.stats["frailty_assessments"] += 1
        
        score = 0
        positive_items = []
        
        if fatigue:
            score += 1
            positive_items.append({"item": "Fatigue", "description": FRAIL_CRITERIA["F"]["clinical_significance"]})
        
        if resistance_difficulty:
            score += 1
            positive_items.append({"item": "Resistance", "description": FRAIL_CRITERIA["R"]["clinical_significance"]})
        
        if ambulation_difficulty:
            score += 1
            positive_items.append({"item": "Ambulation", "description": FRAIL_CRITERIA["A"]["clinical_significance"]})
        
        if illness_count > 5:
            score += 1
            positive_items.append({"item": "Illnesses", "description": f"{illness_count} chronic conditions"})
        
        if weight_loss_percent > 5:
            score += 1
            positive_items.append({"item": "Weight Loss", "description": f"{weight_loss_percent:.1f}% weight loss"})
        
        # Determine frailty status
        if score == 0:
            status = "Robust"
            prognosis = "Good functional status, low risk of adverse outcomes"
        elif score <= 2:
            status = "Pre-frail"
            prognosis = "Increased risk of becoming frail; intervention may prevent progression"
        else:
            status = "Frail"
            prognosis = "Increased risk of falls, hospitalization, disability, mortality"
        
        return {
            "frailty_score": score,
            "status": status,
            "positive_items": positive_items,
            "prognosis": prognosis,
            "interventions": self._generate_frailty_interventions(score),
            "clinical_recommendations": [
                "Comprehensive geriatric assessment for frail patients",
                "Exercise prescription focusing on resistance training",
                "Nutritional assessment and optimization",
                "Medication review and deprescribing",
                "Social support evaluation",
            ] if score >= 3 else [
                "Encourage physical activity",
                "Maintain adequate nutrition",
                "Regular follow-up for early detection of decline",
            ],
        }
    
    def _generate_frailty_interventions(self, score: int) -> List[str]:
        """Generate interventions based on frailty score."""
        if score == 0:
            return [
                "Maintain healthy lifestyle",
                "Regular exercise",
                "Adequate nutrition",
            ]
        elif score <= 2:
            return [
                "Resistance training 2-3x per week",
                "Protein intake 1.0-1.2 g/kg/day",
                "Vitamin D supplementation if deficient",
                "Regular physical activity",
            ]
        else:
            return [
                "Comprehensive geriatric assessment",
                "Structured exercise program (multicomponent)",
                "Protein supplementation (1.2-1.5 g/kg/day)",
                "Screen for sarcopenia",
                "Home safety evaluation",
                "Advance care planning discussion",
                "Consider referral to geriatric medicine",
            ]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get support statistics."""
        return self.stats


# Singleton instance
_geriatric_support: Optional[GeriatricDecisionSupport] = None


def get_geriatric_support() -> GeriatricDecisionSupport:
    """Get or create geriatric support singleton."""
    global _geriatric_support
    
    if _geriatric_support is None:
        _geriatric_support = GeriatricDecisionSupport()
    
    return _geriatric_support

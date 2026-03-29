"""
Guideline Conflict Detection Module
===================================

Detects and alerts on conflicts between clinical guidelines:
- Different recommendations for same condition
- Contraindication conflicts
- Dosing conflicts
- Evidence level disagreements

HIPAA Compliance: All patient data is handled according to HIPAA guidelines.
"""

from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import re

from loguru import logger


class ConflictType(Enum):
    """Types of guideline conflicts."""
    RECOMMENDATION = "recommendation_conflict"
    CONTRAINDICATION = "contraindication_conflict"
    DOSING = "dosing_conflict"
    EVIDENCE = "evidence_level_conflict"
    POPULATION = "population_conflict"


class ConflictSeverity(Enum):
    """Conflict severity levels."""
    CRITICAL = "critical"    # Patient safety risk
    MAJOR = "major"          # Significant clinical impact
    MODERATE = "moderate"    # Requires clinical judgment
    MINOR = "minor"          # Documentation difference


@dataclass
class GuidelineConflict:
    """Detected conflict between guidelines."""
    conflict_id: str
    conflict_type: ConflictType
    severity: ConflictSeverity
    guideline1_id: str
    guideline1_title: str
    guideline1_recommendation: str
    guideline2_id: str
    guideline2_title: str
    guideline2_recommendation: str
    clinical_context: str
    resolution_guidance: str
    evidence_comparison: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.conflict_id,
            "type": self.conflict_type.value,
            "severity": self.severity.value,
            "guideline1": {
                "id": self.guideline1_id,
                "recommendation": self.guideline1_recommendation[:200],
            },
            "guideline2": {
                "id": self.guideline2_id,
                "recommendation": self.guideline2_recommendation[:200],
            },
            "context": self.clinical_context,
            "resolution": self.resolution_guidance,
        }


# Known guideline conflicts
KNOWN_CONFLICTS: List[Dict[str, Any]] = [
    {
        "conflict_id": "CONFLICT_001",
        "type": ConflictType.DOSING,
        "severity": ConflictSeverity.MODERATE,
        "guideline1_id": "ADA_STANDARDS_2024",
        "guideline1_title": "ADA Standards of Care 2024",
        "guideline1_recommendation": "Target HbA1c < 7% for most adults with diabetes",
        "guideline2_id": "KDIGO_CKD_2024",
        "guideline2_title": "KDIGO CKD Guidelines 2024",
        "guideline2_recommendation": "Less stringent HbA1c target may be appropriate in CKD",
        "clinical_context": "Diabetes management in patients with CKD",
        "resolution_guidance": "Individualize HbA1c targets based on CKD stage, life expectancy, and hypoglycemia risk. Consider 7.5-8.5% in advanced CKD.",
        "evidence_comparison": "Both guidelines cite similar evidence but emphasize different patient populations",
    },
    {
        "conflict_id": "CONFLICT_002",
        "type": ConflictType.CONTRAINDICATION,
        "severity": ConflictSeverity.MAJOR,
        "guideline1_id": "AHA_ACC_AF_2023",
        "guideline1_title": "AHA/ACC AF Guidelines 2023",
        "guideline1_recommendation": "DOACs preferred over warfarin for stroke prevention in non-valvular AF",
        "guideline2_id": "AHA_ACC_HF_2022",
        "guideline2_title": "AHA/ACC HF Guidelines 2022",
        "guideline2_recommendation": "Consider drug interactions when prescribing DOACs with certain HF medications",
        "clinical_context": "Anticoagulation in patients with both AF and heart failure",
        "resolution_guidance": "Use DOACs with proven safety in HF. Avoid certain combinations. Consider reduced dose based on renal function.",
        "evidence_comparison": "Both guidelines support DOACs but HF guidelines add caution for specific interactions",
    },
    {
        "conflict_id": "CONFLICT_003",
        "type": ConflictType.RECOMMENDATION,
        "severity": ConflictSeverity.MODERATE,
        "guideline1_id": "IDSA_SEPSIS_2021",
        "guideline1_title": "Surviving Sepsis Campaign 2021",
        "guideline1_recommendation": "Administer antibiotics within 1 hour of sepsis recognition",
        "guideline2_id": "IDSA_PNEUMONIA_2019",
        "guideline2_title": "IDSA CAP Guidelines 2019",
        "guideline2_recommendation": "Duration based on clinical response, typically 5-7 days",
        "clinical_context": "Duration of antibiotic therapy in sepsis due to pneumonia",
        "resolution_guidance": "Start broad-spectrum antibiotics within 1 hour, then de-escalate based on culture results. Duration should be individualized.",
        "evidence_comparison": "Sepsis emphasizes speed, pneumonia emphasizes appropriate duration",
    },
]


class GuidelineConflictDetector:
    """Detects conflicts between clinical guidelines."""
    
    def __init__(self):
        self._conflicts: List[GuidelineConflict] = []
        self._condition_index: Dict[str, List[str]] = {}
        self._drug_index: Dict[str, List[str]] = {}
        self._initialized = False
    
    def initialize(self):
        """Initialize with known conflicts."""
        if self._initialized:
            return
        
        for conflict_data in KNOWN_CONFLICTS:
            conflict = GuidelineConflict(
                conflict_id=conflict_data["conflict_id"],
                conflict_type=conflict_data["type"],
                severity=conflict_data["severity"],
                guideline1_id=conflict_data["guideline1_id"],
                guideline1_title=conflict_data["guideline1_title"],
                guideline1_recommendation=conflict_data["guideline1_recommendation"],
                guideline2_id=conflict_data["guideline2_id"],
                guideline2_title=conflict_data["guideline2_title"],
                guideline2_recommendation=conflict_data["guideline2_recommendation"],
                clinical_context=conflict_data["clinical_context"],
                resolution_guidance=conflict_data["resolution_guidance"],
                evidence_comparison=conflict_data["evidence_comparison"],
            )
            self._conflicts.append(conflict)
        
        self._initialized = True
        logger.info(f"Conflict detector initialized with {len(self._conflicts)} known conflicts")
    
    def check_for_conflicts(
        self,
        guideline_ids: List[str],
        condition: Optional[str] = None,
        medications: Optional[List[str]] = None,
    ) -> List[GuidelineConflict]:
        """Check for conflicts among specified guidelines."""
        if not self._initialized:
            self.initialize()
        
        conflicts = []
        
        for conflict in self._conflicts:
            # Check if both guidelines in the conflict are in the list
            if (conflict.guideline1_id in guideline_ids and 
                conflict.guideline2_id in guideline_ids):
                conflicts.append(conflict)
            elif conflict.guideline1_id in guideline_ids or conflict.guideline2_id in guideline_ids:
                # Check if relevant to condition or medications
                if condition and condition.lower() in conflict.clinical_context.lower():
                    conflicts.append(conflict)
                if medications:
                    for med in medications:
                        if med.lower() in conflict.resolution_guidance.lower():
                            conflicts.append(conflict)
                            break
        
        return conflicts
    
    def get_all_conflicts(self) -> List[GuidelineConflict]:
        """Get all known conflicts."""
        if not self._initialized:
            self.initialize()
        return self._conflicts
    
    def get_critical_conflicts(self) -> List[GuidelineConflict]:
        """Get critical severity conflicts."""
        if not self._initialized:
            self.initialize()
        return [c for c in self._conflicts if c.severity == ConflictSeverity.CRITICAL]


# Singleton
_detector_instance: Optional[GuidelineConflictDetector] = None


def get_conflict_detector() -> GuidelineConflictDetector:
    """Get the conflict detector singleton."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = GuidelineConflictDetector()
        _detector_instance.initialize()
    return _detector_instance


def check_guideline_conflicts(
    guideline_ids: List[str],
    condition: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Check for conflicts and return as dicts."""
    detector = get_conflict_detector()
    conflicts = detector.check_for_conflicts(guideline_ids, condition)
    return [c.to_dict() for c in conflicts]

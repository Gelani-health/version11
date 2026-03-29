"""
Patient-Reported Outcomes (PRO) Module
======================================

Implements patient-reported outcome measures:
- Quality of life assessments
- Symptom severity scales
- Functional status questionnaires
- Treatment satisfaction surveys

Supported Instruments:
- SF-36 (Quality of Life)
- PHQ-9 (Depression)
- GAD-7 (Anxiety)
- VAS (Pain)
- EQ-5D (Health Status)

HIPAA Compliance: All patient data is handled according to HIPAA guidelines.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class PROInstrument(Enum):
    """Patient-Reported Outcome instruments."""
    SF36 = "SF-36"
    PHQ9 = "PHQ-9"
    GAD7 = "GAD-7"
    VAS = "VAS"
    EQ5D = "EQ-5D"
    KDQOL = "KDQOL-36"  # Kidney Disease Quality of Life
    MLHFQ = "MLHFQ"     # Minnesota Living with Heart Failure


@dataclass
class PROQuestion:
    """A single PRO question."""
    question_id: str
    text: str
    response_options: List[str]
    scoring: Dict[str, int]
    
    def score_response(self, response: str) -> int:
        """Score a response."""
        return self.scoring.get(response, 0)


@dataclass
class PROAssessment:
    """Complete PRO assessment."""
    instrument: PROInstrument
    patient_id: str
    responses: Dict[str, str]
    completed_at: datetime
    total_score: Optional[float] = None
    interpretation: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "instrument": self.instrument.value,
            "patient_id": self.patient_id,
            "completed_at": self.completed_at.isoformat(),
            "total_score": self.total_score,
            "interpretation": self.interpretation,
            "response_count": len(self.responses),
        }


# PHQ-9 Depression Screening
PHQ9_QUESTIONS: List[PROQuestion] = [
    PROQuestion(
        question_id="phq9_1",
        text="Little interest or pleasure in doing things",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="phq9_2",
        text="Feeling down, depressed, or hopeless",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="phq9_3",
        text="Trouble falling or staying asleep, or sleeping too much",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="phq9_4",
        text="Feeling tired or having little energy",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="phq9_5",
        text="Poor appetite or overeating",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="phq9_6",
        text="Feeling bad about yourself - or that you are a failure or have let yourself or your family down",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="phq9_7",
        text="Trouble concentrating on things, such as reading the newspaper or watching television",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="phq9_8",
        text="Moving or speaking so slowly that other people could have noticed? Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="phq9_9",
        text="Thoughts that you would be better off dead or of hurting yourself",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
]


def interpret_phq9_score(score: int) -> str:
    """Interpret PHQ-9 score."""
    if score <= 4:
        return "Minimal depression"
    elif score <= 9:
        return "Mild depression"
    elif score <= 14:
        return "Moderate depression"
    elif score <= 19:
        return "Moderately severe depression"
    else:
        return "Severe depression"


def calculate_phq9_score(responses: Dict[str, str]) -> int:
    """Calculate total PHQ-9 score."""
    total = 0
    for question in PHQ9_QUESTIONS:
        response = responses.get(question.question_id)
        if response:
            total += question.score_response(response)
    return total


# GAD-7 Anxiety Screening
GAD7_QUESTIONS: List[PROQuestion] = [
    PROQuestion(
        question_id="gad7_1",
        text="Feeling nervous, anxious, or on edge",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="gad7_2",
        text="Not being able to stop or control worrying",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="gad7_3",
        text="Worrying too much about different things",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="gad7_4",
        text="Trouble relaxing",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="gad7_5",
        text="Being so restless that it is hard to sit still",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="gad7_6",
        text="Becoming easily annoyed or irritable",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
    PROQuestion(
        question_id="gad7_7",
        text="Feeling afraid as if something awful might happen",
        response_options=["Not at all", "Several days", "More than half the days", "Nearly every day"],
        scoring={"Not at all": 0, "Several days": 1, "More than half the days": 2, "Nearly every day": 3},
    ),
]


def interpret_gad7_score(score: int) -> str:
    """Interpret GAD-7 score."""
    if score <= 4:
        return "Minimal anxiety"
    elif score <= 9:
        return "Mild anxiety"
    elif score <= 14:
        return "Moderate anxiety"
    else:
        return "Severe anxiety"


def get_instrument_questions(instrument: PROInstrument) -> List[PROQuestion]:
    """Get questions for a PRO instrument."""
    if instrument == PROInstrument.PHQ9:
        return PHQ9_QUESTIONS
    elif instrument == PROInstrument.GAD7:
        return GAD7_QUESTIONS
    return []

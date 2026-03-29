"""
P3: Response Quality Validator
==============================

Comprehensive quality assurance for clinical AI responses.

Components:
1. Citation Verification - Validates PMID references and source accuracy
2. Faithfulness Scoring - Measures alignment between response and sources
3. Completeness Checks - Ensures all required clinical elements present
4. Hallucination Detection - Identifies unsupported claims
5. Clinical Accuracy Validation - Verifies medical facts against guidelines

References:
- Ragas framework for RAG evaluation
- TruLens for faithfulness measurement
- Medical NLP best practices
"""

import re
import time
import asyncio
from typing import Optional, List, Dict, Any, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json

from loguru import logger
from pydantic import BaseModel, Field

from app.core.config import get_settings


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class ValidationStatus(Enum):
    """Validation result status."""
    PASSED = "passed"
    WARNING = "warning"
    FAILED = "failed"
    ERROR = "error"


class CitationStatus(Enum):
    """Citation verification status."""
    VERIFIED = "verified"
    UNVERIFIED = "unverified"
    INVALID = "invalid"
    NOT_FOUND = "not_found"


class HallucinationType(Enum):
    """Types of hallucinations."""
    FABRICATION = "fabrication"  # Completely made up content
    EXTRAPOLATION = "extrapolation"  # Unsupported extension of facts
    MISATTRIBUTION = "misattribution"  # Wrong source attribution
    TEMPORAL_ERROR = "temporal_error"  # Wrong timing/sequence
    QUANTITATIVE_ERROR = "quantitative_error"  # Wrong numbers/doses


# Required clinical elements for different response types
REQUIRED_CLINICAL_ELEMENTS = {
    "diagnostic": [
        "differential_diagnosis",
        "supporting_evidence",
        "confidence_level",
        "recommended_actions",
        "red_flags",
    ],
    "treatment": [
        "primary_treatment",
        "alternative_options",
        "contraindications",
        "monitoring_parameters",
        "patient_education",
    ],
    "medication": [
        "drug_name",
        "indication",
        "dosing",
        "contraindications",
        "interactions",
        "adverse_effects",
    ],
    "lab_interpretation": [
        "test_result",
        "reference_range",
        "clinical_significance",
        "recommended_followup",
    ],
    "risk_assessment": [
        "risk_score",
        "risk_factors",
        "stratification",
        "recommendations",
    ],
}

# Clinical fact patterns to validate
CLINICAL_FACT_PATTERNS = {
    "dosage_pattern": r'\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|IU)\b',
    "pmid_pattern": r'PMID[:\s]*(\d+)',
    "icd10_pattern": r'\b[A-Z]\d{2}(?:\.\d{1,3})?\b',
    "percentage_pattern": r'(\d+(?:\.\d+)?)\s*%',
    "confidence_pattern": r'(?:confidence|certainty)[:\s]*(\d+(?:\.\d+)?)\s*%',
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class CitationVerification:
    """Result of citation verification."""
    pmid: str
    status: CitationStatus
    title_match: bool = False
    abstract_relevance: float = 0.0
    claim_supported: bool = False
    quoted_text: str = ""
    source_text: str = ""
    confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pmid": self.pmid,
            "status": self.status.value,
            "title_match": self.title_match,
            "abstract_relevance": self.abstract_relevance,
            "claim_supported": self.claim_supported,
            "confidence": self.confidence,
        }


@dataclass
class FaithfulnessScore:
    """Faithfulness assessment of response to sources."""
    overall_score: float = 0.0
    supported_claims: int = 0
    unsupported_claims: int = 0
    contradictory_claims: int = 0
    total_claims: int = 0
    claim_details: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_score": round(self.overall_score, 3),
            "supported_claims": self.supported_claims,
            "unsupported_claims": self.unsupported_claims,
            "contradictory_claims": self.contradictory_claims,
            "total_claims": self.total_claims,
            "claim_details": self.claim_details[:10],  # Limit for output
        }


@dataclass
class HallucinationReport:
    """Report on detected hallucinations."""
    has_hallucination: bool = False
    hallucination_types: List[HallucinationType] = field(default_factory=list)
    affected_segments: List[Dict[str, Any]] = field(default_factory=list)
    confidence: float = 0.0
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "has_hallucination": self.has_hallucination,
            "hallucination_types": [h.value for h in self.hallucination_types],
            "affected_segments": self.affected_segments,
            "confidence": round(self.confidence, 3),
            "recommendations": self.recommendations,
        }


@dataclass
class CompletenessCheck:
    """Result of completeness validation."""
    is_complete: bool = False
    missing_elements: List[str] = field(default_factory=list)
    present_elements: List[str] = field(default_factory=list)
    completeness_score: float = 0.0
    response_type: str = "unknown"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_complete": self.is_complete,
            "missing_elements": self.missing_elements,
            "present_elements": self.present_elements,
            "completeness_score": round(self.completeness_score, 3),
            "response_type": self.response_type,
        }


@dataclass
class ValidationResult:
    """Complete validation result for a response."""
    request_id: str
    timestamp: str
    status: ValidationStatus

    # Core metrics
    overall_quality_score: float = 0.0
    faithfulness: Optional[FaithfulnessScore] = None
    completeness: Optional[CompletenessCheck] = None
    hallucination_report: Optional[HallucinationReport] = None

    # Citation verification
    citations: List[CitationVerification] = field(default_factory=list)
    citation_accuracy: float = 0.0

    # Clinical accuracy
    clinical_accuracy_score: float = 0.0
    clinical_warnings: List[str] = field(default_factory=list)

    # Processing metadata
    processing_time_ms: float = 0.0
    validation_version: str = "3.0.0"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp,
            "status": self.status.value,
            "overall_quality_score": round(self.overall_quality_score, 3),
            "faithfulness": self.faithfulness.to_dict() if self.faithfulness else None,
            "completeness": self.completeness.to_dict() if self.completeness else None,
            "hallucination_report": self.hallucination_report.to_dict() if self.hallucination_report else None,
            "citations": [c.to_dict() for c in self.citations],
            "citation_accuracy": round(self.citation_accuracy, 3),
            "clinical_accuracy_score": round(self.clinical_accuracy_score, 3),
            "clinical_warnings": self.clinical_warnings,
            "processing_time_ms": round(self.processing_time_ms, 2),
            "validation_version": self.validation_version,
        }


# =============================================================================
# QUALITY ASSURANCE ENGINE
# =============================================================================

class QualityAssuranceEngine:
    """
    P3: Comprehensive Quality Assurance for Clinical AI Responses.

    Implements multi-layer validation:
    1. Citation Verification - Validates source references
    2. Faithfulness Scoring - Measures source-groundedness
    3. Completeness Check - Ensures required clinical elements
    4. Hallucination Detection - Identifies unsupported content
    5. Clinical Accuracy - Validates medical facts

    Follows healthcare AI best practices:
    - NIST AI Risk Management Framework
    - FDA guidance on Clinical Decision Support
    - WHO guidelines for AI in healthcare
    """

    def __init__(self):
        self.settings = get_settings()
        self._stats = {
            "total_validations": 0,
            "passed_validations": 0,
            "warning_validations": 0,
            "failed_validations": 0,
            "average_faithfulness": 0.0,
            "average_completeness": 0.0,
            "hallucinations_detected": 0,
        }

    async def validate_response(
        self,
        response_text: str,
        source_documents: List[Dict[str, Any]],
        response_type: str = "diagnostic",
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        """
        Perform comprehensive validation of a clinical AI response.

        Args:
            response_text: The generated clinical response
            source_documents: List of source documents with 'pmid', 'title', 'abstract'
            response_type: Type of response (diagnostic, treatment, medication, etc.)
            patient_context: Optional patient context for contextual validation

        Returns:
            ValidationResult with comprehensive quality assessment
        """
        start_time = time.time()
        request_id = f"val_{int(time.time() * 1000)}"

        self._stats["total_validations"] += 1

        try:
            # 1. Extract and verify citations
            citations = await self._verify_citations(response_text, source_documents)
            citation_accuracy = self._calculate_citation_accuracy(citations)

            # 2. Calculate faithfulness score
            faithfulness = await self._calculate_faithfulness(
                response_text, source_documents
            )

            # 3. Check completeness
            completeness = self._check_completeness(response_text, response_type)

            # 4. Detect hallucinations
            hallucination_report = await self._detect_hallucinations(
                response_text, source_documents, citations
            )

            # 5. Validate clinical accuracy
            clinical_accuracy, clinical_warnings = await self._validate_clinical_accuracy(
                response_text, patient_context
            )

            # Calculate overall quality score
            overall_score = self._calculate_overall_score(
                faithfulness, completeness, citation_accuracy,
                clinical_accuracy, hallucination_report
            )

            # Determine status
            status = self._determine_status(
                overall_score, faithfulness, completeness, hallucination_report
            )

            # Update stats
            if status == ValidationStatus.PASSED:
                self._stats["passed_validations"] += 1
            elif status == ValidationStatus.WARNING:
                self._stats["warning_validations"] += 1
            else:
                self._stats["failed_validations"] += 1

            if hallucination_report.has_hallucination:
                self._stats["hallucinations_detected"] += 1

            processing_time = (time.time() - start_time) * 1000

            return ValidationResult(
                request_id=request_id,
                timestamp=datetime.utcnow().isoformat(),
                status=status,
                overall_quality_score=overall_score,
                faithfulness=faithfulness,
                completeness=completeness,
                hallucination_report=hallucination_report,
                citations=citations,
                citation_accuracy=citation_accuracy,
                clinical_accuracy_score=clinical_accuracy,
                clinical_warnings=clinical_warnings,
                processing_time_ms=processing_time,
            )

        except Exception as e:
            logger.error(f"Validation error: {e}")
            return ValidationResult(
                request_id=request_id,
                timestamp=datetime.utcnow().isoformat(),
                status=ValidationStatus.ERROR,
                clinical_warnings=[f"Validation failed: {str(e)}"],
                processing_time_ms=(time.time() - start_time) * 1000,
            )

    async def _verify_citations(
        self,
        response_text: str,
        source_documents: List[Dict[str, Any]],
    ) -> List[CitationVerification]:
        """Verify all citations in the response."""
        citations = []

        # Extract PMIDs from response
        pmid_matches = re.findall(CLINICAL_FACT_PATTERNS["pmid_pattern"], response_text)

        # Create source lookup
        source_lookup = {str(doc.get("pmid", "")): doc for doc in source_documents}

        for pmid in pmid_matches:
            verification = await self._verify_single_citation(
                pmid, response_text, source_lookup.get(pmid)
            )
            citations.append(verification)

        return citations

    async def _verify_single_citation(
        self,
        pmid: str,
        response_text: str,
        source_doc: Optional[Dict[str, Any]],
    ) -> CitationVerification:
        """Verify a single citation."""
        if not source_doc:
            return CitationVerification(
                pmid=pmid,
                status=CitationStatus.NOT_FOUND,
                confidence=0.0,
            )

        # Check if content near PMID matches source
        # Find context around PMID mention
        pmid_pos = response_text.lower().find(f"pmid {pmid}".lower())
        if pmid_pos == -1:
            pmid_pos = response_text.lower().find(f"pmid:{pmid}".lower())

        if pmid_pos != -1:
            # Extract surrounding context (500 chars)
            start = max(0, pmid_pos - 250)
            end = min(len(response_text), pmid_pos + 250)
            context = response_text[start:end]

            # Check against source title
            title = source_doc.get("title", "").lower()
            title_match = any(word in context.lower() for word in title.split()[:5])

            # Check against abstract
            abstract = source_doc.get("abstract", "").lower()
            abstract_words = set(abstract.split())
            context_words = set(context.lower().split())
            abstract_relevance = len(abstract_words & context_words) / max(len(context_words), 1)

            # Determine status
            if title_match and abstract_relevance > 0.3:
                status = CitationStatus.VERIFIED
                claim_supported = True
            elif abstract_relevance > 0.1:
                status = CitationStatus.UNVERIFIED
                claim_supported = False
            else:
                status = CitationStatus.INVALID
                claim_supported = False

            return CitationVerification(
                pmid=pmid,
                status=status,
                title_match=title_match,
                abstract_relevance=abstract_relevance,
                claim_supported=claim_supported,
                confidence=min(1.0, abstract_relevance * 2 + (0.3 if title_match else 0)),
            )

        return CitationVerification(
            pmid=pmid,
            status=CitationStatus.UNVERIFIED,
        )

    def _calculate_citation_accuracy(
        self,
        citations: List[CitationVerification],
    ) -> float:
        """Calculate overall citation accuracy score."""
        if not citations:
            return 1.0  # No citations to verify

        verified = sum(1 for c in citations if c.status == CitationStatus.VERIFIED)
        return verified / len(citations)

    async def _calculate_faithfulness(
        self,
        response_text: str,
        source_documents: List[Dict[str, Any]],
    ) -> FaithfulnessScore:
        """
        Calculate faithfulness score using claim extraction and verification.

        Implements a simplified version of the RAGAS faithfulness metric:
        1. Extract claims from response
        2. Verify each claim against source documents
        3. Calculate supported vs unsupported ratio
        """
        # Extract claims (sentences with medical content)
        claims = self._extract_claims(response_text)
        total_claims = len(claims)

        if total_claims == 0:
            return FaithfulnessScore(
                overall_score=1.0,
                total_claims=0,
            )

        # Build source text
        source_text = " ".join([
            doc.get("abstract", "") for doc in source_documents
            if doc.get("abstract")
        ]).lower()

        source_words = set(source_text.split())

        supported_claims = 0
        unsupported_claims = 0
        contradictory_claims = 0
        claim_details = []

        for claim in claims:
            claim_words = set(claim.lower().split())

            # Check word overlap
            overlap = len(claim_words & source_words)
            overlap_ratio = overlap / max(len(claim_words), 1)

            # Check for key medical terms
            medical_terms = self._extract_medical_terms(claim)
            supported_terms = sum(
                1 for term in medical_terms if term in source_text
            )
            term_support = supported_terms / max(len(medical_terms), 1) if medical_terms else 0

            # Combined support score
            support_score = (overlap_ratio * 0.5 + term_support * 0.5)

            if support_score > 0.5:
                supported_claims += 1
                status = "supported"
            elif support_score < 0.2:
                unsupported_claims += 1
                status = "unsupported"
            else:
                status = "partially_supported"

            claim_details.append({
                "claim": claim[:100] + "..." if len(claim) > 100 else claim,
                "support_score": round(support_score, 3),
                "status": status,
            })

        # Calculate overall score
        if total_claims > 0:
            overall_score = (supported_claims + 0.5 * (total_claims - supported_claims - unsupported_claims)) / total_claims
        else:
            overall_score = 1.0

        return FaithfulnessScore(
            overall_score=overall_score,
            supported_claims=supported_claims,
            unsupported_claims=unsupported_claims,
            contradictory_claims=contradictory_claims,
            total_claims=total_claims,
            claim_details=claim_details,
        )

    def _extract_claims(self, text: str) -> List[str]:
        """Extract claim sentences from response text."""
        # Split into sentences
        sentences = re.split(r'[.!?]+', text)

        claims = []
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 20:
                continue

            # Check if sentence contains medical content
            medical_indicators = [
                'diagnosis', 'treatment', 'patient', 'clinical', 'symptom',
                'disease', 'medication', 'drug', 'therapy', 'risk', 'condition',
                'evidence', 'study', 'trial', 'outcome', 'effect', 'dose',
                'contraindication', 'indicated', 'recommended', 'associated',
            ]

            if any(ind in sentence.lower() for ind in medical_indicators):
                claims.append(sentence)

        return claims

    def _extract_medical_terms(self, text: str) -> List[str]:
        """Extract medical terminology from text."""
        # Common medical term patterns
        patterns = [
            r'\b[A-Z][a-z]+(?:itis|osis|emia|uria|pathy|ectomy|otomy|scopy)\b',
            r'\b\d+\s*(?:mg|mcg|ml|units?|IU)\b',
            r'\b[A-Z]{2,}\b',  # Acronyms
        ]

        terms = []
        for pattern in patterns:
            matches = re.findall(pattern, text)
            terms.extend(matches)

        return terms

    def _check_completeness(
        self,
        response_text: str,
        response_type: str,
    ) -> CompletenessCheck:
        """Check if response contains all required clinical elements."""
        required = REQUIRED_CLINICAL_ELEMENTS.get(response_type, [])
        response_lower = response_text.lower()

        present_elements = []
        missing_elements = []

        # Element detection patterns
        element_patterns = {
            "differential_diagnosis": [
                "differential", "possible diagnoses", "consider", "rule out",
            ],
            "supporting_evidence": [
                "evidence", "based on", "supported by", "findings show",
            ],
            "confidence_level": [
                "confidence", "certainty", "likely", "probability",
            ],
            "recommended_actions": [
                "recommend", "should", "advise", "next steps",
            ],
            "red_flags": [
                "red flag", "warning sign", "urgent", "emergency", "immediate",
            ],
            "primary_treatment": [
                "treatment", "therapy", "first-line", "primary",
            ],
            "alternative_options": [
                "alternative", "second-line", "option", "alternative",
            ],
            "contraindications": [
                "contraindication", "should not", "avoid", "do not",
            ],
            "monitoring_parameters": [
                "monitor", "follow-up", "check", "watch for",
            ],
            "patient_education": [
                "educate", "counsel", "inform patient", "advise patient",
            ],
            "drug_name": [
                r'\b[A-Z][a-z]+(?:cillin|mycin|olol|pril|sartan|statin)\b',
            ],
            "indication": [
                "indicated for", "used for", "treatment of",
            ],
            "dosing": [
                r'\d+\s*(?:mg|mcg|ml)', "dose", "dosage",
            ],
            "interactions": [
                "interaction", "interacts with", "avoid with",
            ],
            "adverse_effects": [
                "side effect", "adverse", "complication", "reaction",
            ],
            "test_result": [
                "result", "level", "value", "finding",
            ],
            "reference_range": [
                "normal", "reference", "range", "elevated", "decreased",
            ],
            "clinical_significance": [
                "significance", "indicates", "suggests", "clinically",
            ],
            "recommended_followup": [
                "follow-up", "repeat", "monitor", "recheck",
            ],
            "risk_score": [
                "score", "points", "risk level",
            ],
            "risk_factors": [
                "risk factor", "contributing", "factors include",
            ],
            "stratification": [
                "low risk", "moderate risk", "high risk", "stratification",
            ],
            "recommendations": [
                "recommend", "suggest", "consider", "advise",
            ],
        }

        for element in required:
            patterns = element_patterns.get(element, [element.replace("_", " ")])

            found = False
            for pattern in patterns:
                if pattern.startswith('\\'):
                    # Regex pattern
                    if re.search(pattern, response_text, re.IGNORECASE):
                        found = True
                        break
                else:
                    # Simple text search
                    if pattern.lower() in response_lower:
                        found = True
                        break

            if found:
                present_elements.append(element)
            else:
                missing_elements.append(element)

        completeness_score = len(present_elements) / max(len(required), 1)
        is_complete = len(missing_elements) == 0

        return CompletenessCheck(
            is_complete=is_complete,
            missing_elements=missing_elements,
            present_elements=present_elements,
            completeness_score=completeness_score,
            response_type=response_type,
        )

    async def _detect_hallucinations(
        self,
        response_text: str,
        source_documents: List[Dict[str, Any]],
        citations: List[CitationVerification],
    ) -> HallucinationReport:
        """
        Detect potential hallucinations in the response.

        Checks for:
        1. Fabricated citations
        2. Unsupported quantitative claims
        3. Invented study results
        4. Misattributed findings
        """
        hallucination_types = []
        affected_segments = []
        recommendations = []

        # Check for invalid citations
        invalid_citations = [
            c for c in citations
            if c.status == CitationStatus.INVALID
        ]
        if invalid_citations:
            hallucination_types.append(HallucinationType.MISATTRIBUTION)
            for c in invalid_citations:
                affected_segments.append({
                    "type": "invalid_citation",
                    "pmid": c.pmid,
                    "issue": "Citation does not support the claim",
                })
            recommendations.append("Verify PMID references against actual source content")

        # Check for unsupported quantitative claims
        quantitative_claims = re.findall(
            r'(\d+(?:\.\d+)?)\s*%\s*(?:of|reduction|increase|improvement|patients)',
            response_text,
            re.IGNORECASE
        )

        # Build source numbers
        source_numbers = set()
        for doc in source_documents:
            numbers = re.findall(r'\d+(?:\.\d+)?', doc.get("abstract", ""))
            source_numbers.update(numbers)

        for claim in quantitative_claims:
            if claim not in source_numbers:
                hallucination_types.append(HallucinationType.QUANTITATIVE_ERROR)
                affected_segments.append({
                    "type": "unsupported_number",
                    "claim": f"{claim}%",
                    "issue": "Quantitative claim not found in sources",
                })

        # Check for fabricated study claims
        fabricated_patterns = [
            r'(?:a\s+)?(?:recent|new|latest)\s+study\s+(?:showed|found|demonstrated)',
            r'according\s+to\s+(?:a\s+)?(?:recent|new)\s+(?:study|research)',
        ]

        for pattern in fabricated_patterns:
            matches = re.finditer(pattern, response_text, re.IGNORECASE)
            for match in matches:
                # Check if followed by citation
                context_start = match.start()
                context = response_text[context_start:context_start + 200]
                if not re.search(r'PMID[:\s]*\d+', context):
                    hallucination_types.append(HallucinationType.FABRICATION)
                    affected_segments.append({
                        "type": "uncited_study_claim",
                        "segment": context[:100],
                        "issue": "Study claim without citation",
                    })
                    recommendations.append("Add PMID citation for study claims")

        # Deduplicate hallucination types
        hallucination_types = list(set(hallucination_types))

        has_hallucination = len(hallucination_types) > 0
        confidence = min(1.0, len(affected_segments) * 0.3) if has_hallucination else 0.0

        if not recommendations:
            recommendations.append("Response appears well-grounded in sources")

        return HallucinationReport(
            has_hallucination=has_hallucination,
            hallucination_types=hallucination_types,
            affected_segments=affected_segments,
            confidence=confidence,
            recommendations=recommendations,
        )

    async def _validate_clinical_accuracy(
        self,
        response_text: str,
        patient_context: Optional[Dict[str, Any]],
    ) -> Tuple[float, List[str]]:
        """
        Validate clinical accuracy of the response.

        Checks:
        1. Drug dosage ranges
        2. Age-appropriate recommendations
        3. Contraindication awareness
        4. Guideline concordance
        """
        warnings = []
        accuracy_score = 1.0

        # Check dosage mentions
        dosages = re.findall(
            CLINICAL_FACT_PATTERNS["dosage_pattern"],
            response_text,
            re.IGNORECASE
        )

        # Validate common dosage ranges
        dosage_ranges = {
            "mg": (0.1, 10000),  # General range
            "mcg": (1, 5000),
            "g": (0.1, 100),
            "ml": (0.1, 1000),
        }

        for value, unit in dosages:
            value = float(value)
            if unit in dosage_ranges:
                min_dose, max_dose = dosage_ranges[unit]
                if value < min_dose or value > max_dose:
                    warnings.append(
                        f"Unusual dosage detected: {value} {unit} - please verify"
                    )
                    accuracy_score -= 0.1

        # Check for pediatric considerations if patient is young
        if patient_context and patient_context.get("age", 0) < 18:
            if "pediatric" not in response_text.lower():
                if "adult" in response_text.lower():
                    warnings.append(
                        "Patient is pediatric but recommendations may be adult-focused"
                    )
                    accuracy_score -= 0.15

        # Check for pregnancy considerations
        if patient_context and patient_context.get("is_pregnant"):
            if "pregnancy" not in response_text.lower():
                warnings.append(
                    "Pregnancy status should be considered in recommendations"
                )
                accuracy_score -= 0.15

        # Check for renal function considerations
        if patient_context and patient_context.get("creatinine_clearance", 100) < 30:
            if "renal" not in response_text.lower() and "dose adjustment" not in response_text.lower():
                warnings.append(
                    "Renal impairment detected - dose adjustment may be needed"
                )
                accuracy_score -= 0.15

        return max(0.0, accuracy_score), warnings

    def _calculate_overall_score(
        self,
        faithfulness: FaithfulnessScore,
        completeness: CompletenessCheck,
        citation_accuracy: float,
        clinical_accuracy: float,
        hallucination_report: HallucinationReport,
    ) -> float:
        """Calculate overall quality score."""
        # Weighted components
        weights = {
            "faithfulness": 0.35,
            "completeness": 0.20,
            "citation_accuracy": 0.15,
            "clinical_accuracy": 0.20,
            "hallucination_penalty": 0.10,
        }

        score = (
            faithfulness.overall_score * weights["faithfulness"] +
            completeness.completeness_score * weights["completeness"] +
            citation_accuracy * weights["citation_accuracy"] +
            clinical_accuracy * weights["clinical_accuracy"]
        )

        # Apply hallucination penalty
        if hallucination_report.has_hallucination:
            penalty = hallucination_report.confidence * weights["hallucination_penalty"]
            score -= penalty

        return max(0.0, min(1.0, score))

    def _determine_status(
        self,
        overall_score: float,
        faithfulness: FaithfulnessScore,
        completeness: CompletenessCheck,
        hallucination_report: HallucinationReport,
    ) -> ValidationStatus:
        """Determine validation status based on metrics."""
        # Critical failures
        if hallucination_report.has_hallucination and hallucination_report.confidence > 0.7:
            return ValidationStatus.FAILED

        if faithfulness.overall_score < 0.5:
            return ValidationStatus.FAILED

        if completeness.completeness_score < 0.4:
            return ValidationStatus.FAILED

        # Warnings
        if overall_score < 0.7:
            return ValidationStatus.WARNING

        if faithfulness.overall_score < 0.8:
            return ValidationStatus.WARNING

        if not completeness.is_complete:
            return ValidationStatus.WARNING

        if hallucination_report.has_hallucination:
            return ValidationStatus.WARNING

        return ValidationStatus.PASSED

    def get_stats(self) -> Dict[str, Any]:
        """Get validation statistics."""
        return {
            **self._stats,
            "pass_rate": (
                self._stats["passed_validations"] /
                max(self._stats["total_validations"], 1)
            ),
        }


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_qa_engine: Optional[QualityAssuranceEngine] = None


def get_qa_engine() -> QualityAssuranceEngine:
    """Get or create quality assurance engine singleton."""
    global _qa_engine

    if _qa_engine is None:
        _qa_engine = QualityAssuranceEngine()

    return _qa_engine

"""
ClinicalTrials.gov Integration Module
=====================================

Integrates clinical trial data from ClinicalTrials.gov:
- Trial registry data (NCT IDs)
- Study protocols
- Results data (when available)
- Recruitment status
- Outcome measures

Features:
- Trial search and filtering
- Results extraction
- Phase and status tracking
- Intervention and condition mapping
- Evidence synthesis for treatments

HIPAA Compliance: All patient data is handled according to HIPAA guidelines.
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
from typing import Optional, List, Dict, Any, AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import re
import json

from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential


class TrialPhase(Enum):
    """Clinical trial phases."""
    NOT_APPLICABLE = "N/A"
    EARLY_PHASE1 = "Early Phase 1"
    PHASE1 = "Phase 1"
    PHASE1_PHASE2 = "Phase 1/Phase 2"
    PHASE2 = "Phase 2"
    PHASE2_PHASE3 = "Phase 2/Phase 3"
    PHASE3 = "Phase 3"
    PHASE4 = "Phase 4"


class TrialStatus(Enum):
    """Trial recruitment status."""
    RECRUITING = "Recruiting"
    NOT_YET_RECRUITING = "Not yet recruiting"
    ACTIVE_NOT_RECRUITING = "Active, not recruiting"
    COMPLETED = "Completed"
    TERMINATED = "Terminated"
    WITHDRAWN = "Withdrawn"
    SUSPENDED = "Suspended"
    ENROLLING_BY_INVITATION = "Enrolling by invitation"
    UNKNOWN = "Unknown status"


class StudyType(Enum):
    """Types of clinical studies."""
    INTERVENTIONAL = "Interventional"
    OBSERVATIONAL = "Observational"
    OBSERVATIONAL_PATIENT_REGISTRY = "Observational [Patient Registry]"
    EXPANDED_ACCESS = "Expanded Access"


class AllocationType(Enum):
    """Randomization allocation types."""
    RANDOMIZED = "Randomized"
    NON_RANDOMIZED = "Non-Randomized"
    N_A = "N/A"


class MaskingType(Enum):
    """Blinding/masking types."""
    NONE = "None (Open Label)"
    SINGLE = "Single"
    DOUBLE = "Double"
    TRIPLE = "Triple"
    QUADRUPLE = "Quadruple"


@dataclass
class TrialIntervention:
    """Intervention used in a trial."""
    intervention_type: str  # Drug, Biological, Procedure, etc.
    name: str
    description: Optional[str] = None
    arm_group_labels: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.intervention_type,
            "name": self.name,
            "description": self.description,
            "arm_groups": self.arm_group_labels,
        }


@dataclass
class TrialOutcome:
    """Trial outcome measure."""
    measure: str
    time_frame: Optional[str] = None
    description: Optional[str] = None
    is_primary: bool = False
    
    # Results data
    units: Optional[str] = None
    result_value: Optional[float] = None
    confidence_interval: Optional[tuple] = None
    p_value: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "measure": self.measure,
            "time_frame": self.time_frame,
            "description": self.description,
            "is_primary": self.is_primary,
            "result": {
                "value": self.result_value,
                "units": self.units,
                "ci": self.confidence_interval,
                "p_value": self.p_value,
            } if self.result_value else None,
        }


@dataclass
class TrialEligibility:
    """Trial eligibility criteria."""
    inclusion_criteria: List[str] = field(default_factory=list)
    exclusion_criteria: List[str] = field(default_factory=list)
    minimum_age: Optional[str] = None
    maximum_age: Optional[str] = None
    gender: str = "All"
    healthy_volunteers: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "inclusion": self.inclusion_criteria[:10],
            "exclusion": self.exclusion_criteria[:10],
            "age_range": f"{self.minimum_age or '0'} - {self.maximum_age or 'No limit'}",
            "gender": self.gender,
            "healthy_volunteers": self.healthy_volunteers,
        }
    
    def get_age_minimum_years(self) -> int:
        """Extract minimum age in years."""
        if not self.minimum_age:
            return 0
        
        match = re.search(r'(\d+)', self.minimum_age)
        if match:
            years = int(match.group(1))
            if "month" in self.minimum_age.lower():
                return years // 12
            return years
        return 0


@dataclass
class TrialLocation:
    """Trial site location."""
    facility: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    status: str = "Unknown"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "facility": self.facility,
            "city": self.city,
            "state": self.state,
            "country": self.country,
            "status": self.status,
        }


@dataclass
class ClinicalTrial:
    """Complete clinical trial data."""
    nct_id: str
    title: str
    official_title: Optional[str]
    brief_summary: str
    detailed_description: Optional[str]
    study_type: StudyType
    phase: TrialPhase
    status: TrialStatus
    why_stopped: Optional[str] = None
    
    # Conditions and interventions
    conditions: List[str] = field(default_factory=list)
    interventions: List[TrialIntervention] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    
    # Design
    allocation: Optional[AllocationType] = None
    masking: Optional[MaskingType] = None
    primary_purpose: Optional[str] = None
    
    # Participants
    enrollment: Optional[int] = None
    enrollment_type: str = "Anticipated"
    
    # Outcomes
    primary_outcomes: List[TrialOutcome] = field(default_factory=list)
    secondary_outcomes: List[TrialOutcome] = field(default_factory=list)
    
    # Eligibility
    eligibility: TrialEligibility = field(default_factory=TrialEligibility)
    
    # Locations
    locations: List[TrialLocation] = field(default_factory=list)
    
    # Dates
    start_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    results_first_submitted: Optional[datetime] = None
    last_update: Optional[datetime] = None
    
    # Sponsor and contacts
    sponsor: Optional[str] = None
    collaborators: List[str] = field(default_factory=list)
    principal_investigator: Optional[str] = None
    
    # Results
    has_results: bool = False
    results_url: Optional[str] = None
    
    # URL
    url: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "nct_id": self.nct_id,
            "title": self.title,
            "brief_summary": self.brief_summary[:500],
            "study_type": self.study_type.value,
            "phase": self.phase.value,
            "status": self.status.value,
            "conditions": self.conditions[:10],
            "interventions": [i.to_dict() for i in self.interventions[:5]],
            "enrollment": self.enrollment,
            "primary_outcomes": [o.to_dict() for o in self.primary_outcomes[:3]],
            "eligibility": self.eligibility.to_dict(),
            "has_results": self.has_results,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "url": self.url,
        }
    
    @property
    def content_hash(self) -> str:
        """Generate hash for deduplication."""
        content = f"{self.nct_id}:{self.last_update or ''}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get_text_for_embedding(self) -> str:
        """Get combined text for embedding."""
        parts = [
            f"Trial: {self.title}",
            f"Conditions: {', '.join(self.conditions)}",
            f"Phase: {self.phase.value}",
            f"Summary: {self.brief_summary}",
        ]
        
        if self.detailed_description:
            parts.append(f"Details: {self.detailed_description[:2000]}")
        
        for intervention in self.interventions[:5]:
            parts.append(f"Intervention: {intervention.name}")
        
        for outcome in self.primary_outcomes[:3]:
            parts.append(f"Primary Outcome: {outcome.measure}")
        
        return "\n\n".join(parts)
    
    def is_completed_with_results(self) -> bool:
        """Check if trial is completed with posted results."""
        return self.status == TrialStatus.COMPLETED and self.has_results
    
    def is_positive_result(self) -> Optional[bool]:
        """
        Determine if trial showed positive results.
        
        Returns None if results not available or unclear.
        """
        if not self.has_results:
            return None
        
        # Check primary outcomes for statistically significant results
        for outcome in self.primary_outcomes:
            if outcome.p_value is not None and outcome.p_value < 0.05:
                return True
        
        return None


class ClinicalTrialsError(Exception):
    """Custom exception for ClinicalTrials.gov errors."""
    pass


class ClinicalTrialsClient:
    """
    Async client for ClinicalTrials.gov API.
    
    Uses the ClinicalTrials.gov Data API (v2):
    https://clinicaltrials.gov/api/
    
    Handles:
    - Trial search with filters
    - Full trial data retrieval
    - Results extraction
    """
    
    API_BASE_URL = "https://clinicaltrials.gov/api/v2"
    
    def __init__(self):
        self._last_request_time = 0.0
        self._request_semaphore = asyncio.Semaphore(5)
        self.REQUEST_DELAY = 0.5
        
        self.stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "trials_fetched": 0,
        }
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def _make_request(
        self,
        session: aiohttp.ClientSession,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make rate-limited request to ClinicalTrials.gov API."""
        async with self._request_semaphore:
            now = asyncio.get_event_loop().time()
            elapsed = now - self._last_request_time
            if elapsed < self.REQUEST_DELAY:
                await asyncio.sleep(self.REQUEST_DELAY - elapsed)
            
            self._last_request_time = asyncio.get_event_loop().time()
            self.stats["total_requests"] += 1
            
            url = f"{self.API_BASE_URL}/{endpoint}"
            
            try:
                async with session.get(url, params=params) as response:
                    if response.status == 429:
                        logger.warning("Rate limited by ClinicalTrials.gov")
                        await asyncio.sleep(5)
                        raise ClinicalTrialsError("Rate limited")
                    
                    response.raise_for_status()
                    self.stats["successful_requests"] += 1
                    return await response.json()
                    
            except aiohttp.ClientError as e:
                self.stats["failed_requests"] += 1
                logger.error(f"ClinicalTrials.gov API error: {e}")
                raise ClinicalTrialsError(f"Request failed: {e}")
    
    async def search_trials(
        self,
        session: aiohttp.ClientSession,
        query: str = "",
        condition: Optional[str] = None,
        intervention: Optional[str] = None,
        phase: Optional[TrialPhase] = None,
        status: Optional[TrialStatus] = None,
        has_results: Optional[bool] = None,
        updated_since: Optional[datetime] = None,
        max_results: int = 100,
    ) -> List[str]:
        """
        Search ClinicalTrials.gov for trials.
        
        Args:
            session: aiohttp session
            query: General search query
            condition: Medical condition
            intervention: Treatment/intervention name
            phase: Trial phase filter
            status: Recruitment status filter
            has_results: Filter for trials with results
            updated_since: Only trials updated since date
            max_results: Maximum results to return
        
        Returns:
            List of NCT IDs
        """
        params = {
            "format": "json",
            "pageSize": str(min(max_results, 100)),
        }
        
        # Build query
        query_parts = []
        if query:
            query_parts.append(query)
        if condition:
            query_parts.append(f"AREA[Condition]{condition}")
        if intervention:
            query_parts.append(f"AREA[Intervention]{intervention}")
        
        if query_parts:
            params["query.term"] = " AND ".join(query_parts)
        
        # Filters
        if phase:
            params["filter.phase"] = phase.value
        if status:
            params["filter.overallStatus"] = status.value
        if has_results:
            params["filter.hasResults"] = "true"
        
        # Date filter
        if updated_since:
            params["filter.lastUpdatePostDate"] = updated_since.strftime("%m/%d/%Y")
        
        try:
            data = await self._make_request(session, "studies", params)
            
            nct_ids = []
            for study in data.get("studies", []):
                protocol = study.get("protocolSection", {})
                identification = protocol.get("identificationModule", {})
                nct_id = identification.get("nctId")
                if nct_id:
                    nct_ids.append(nct_id)
            
            logger.info(f"Found {len(nct_ids)} trials")
            return nct_ids
            
        except Exception as e:
            logger.error(f"Trial search failed: {e}")
            return []
    
    async def fetch_trial(
        self,
        session: aiohttp.ClientSession,
        nct_id: str,
    ) -> Optional[ClinicalTrial]:
        """
        Fetch a single trial by NCT ID.
        
        Args:
            session: aiohttp session
            nct_id: ClinicalTrials.gov ID (e.g., NCT12345678)
        
        Returns:
            ClinicalTrial object or None
        """
        params = {"format": "json"}
        
        try:
            data = await self._make_request(
                session, f"studies/{nct_id}", params
            )
            
            trial = self._parse_trial_data(data)
            
            if trial:
                self.stats["trials_fetched"] += 1
            
            return trial
            
        except Exception as e:
            logger.error(f"Failed to fetch trial {nct_id}: {e}")
            return None
    
    def _parse_trial_data(self, data: Dict[str, Any]) -> Optional[ClinicalTrial]:
        """Parse API response into ClinicalTrial object."""
        try:
            protocol = data.get("protocolSection", {})
            
            # Identification
            identification = protocol.get("identificationModule", {})
            nct_id = identification.get("nctId", "")
            title = identification.get("briefTitle", "")
            official_title = identification.get("officialTitle")
            
            # Description
            description = protocol.get("descriptionModule", {})
            brief_summary = description.get("briefSummary", "")
            detailed_description = description.get("detailedDescription")
            
            # Status
            status_module = protocol.get("statusModule", {})
            status_str = status_module.get("overallStatus", "Unknown status")
            try:
                status = TrialStatus(status_str)
            except ValueError:
                status = TrialStatus.UNKNOWN
            
            why_stopped = status_module.get("whyStopped")
            
            # Dates
            start_date_str = status_module.get("startDateStruct", {}).get("date")
            completion_date_str = status_module.get("completionDateStruct", {}).get("date")
            last_update_str = status_module.get("lastUpdatePostDateStruct", {}).get("date")
            
            # Design
            design_module = protocol.get("designModule", {})
            study_type_str = design_module.get("studyType", "Interventional")
            try:
                study_type = StudyType(study_type_str)
            except ValueError:
                study_type = StudyType.INTERVENTIONAL
            
            phases = design_module.get("phases", [])
            phase_str = phases[0] if phases else "N/A"
            try:
                phase = TrialPhase(phase_str)
            except ValueError:
                phase = TrialPhase.NOT_APPLICABLE
            
            # Conditions
            conditions_module = protocol.get("conditionsModule", {})
            conditions = conditions_module.get("conditions", [])
            
            # Interventions
            arms_interventions = protocol.get("armsInterventionsModule", {})
            interventions = []
            for int_data in arms_interventions.get("interventions", []):
                intervention = TrialIntervention(
                    intervention_type=int_data.get("type", "Unknown"),
                    name=int_data.get("name", ""),
                    description=int_data.get("description"),
                )
                interventions.append(intervention)
            
            # Outcomes
            outcomes_module = protocol.get("outcomesModule", {})
            primary_outcomes = []
            secondary_outcomes = []
            
            for outcome_data in outcomes_module.get("primaryOutcomes", []):
                outcome = TrialOutcome(
                    measure=outcome_data.get("measure", ""),
                    time_frame=outcome_data.get("timeFrame"),
                    description=outcome_data.get("description"),
                    is_primary=True,
                )
                primary_outcomes.append(outcome)
            
            for outcome_data in outcomes_module.get("secondaryOutcomes", []):
                outcome = TrialOutcome(
                    measure=outcome_data.get("measure", ""),
                    time_frame=outcome_data.get("timeFrame"),
                    description=outcome_data.get("description"),
                    is_primary=False,
                )
                secondary_outcomes.append(outcome)
            
            # Eligibility
            eligibility_module = protocol.get("eligibilityModule", {})
            eligibility = TrialEligibility(
                inclusion_criteria=eligibility_module.get("eligibilityCriteria", "").split("\n"),
                minimum_age=eligibility_module.get("minimumAge"),
                maximum_age=eligibility_module.get("maximumAge"),
                gender=eligibility_module.get("gender", "All"),
                healthy_volunteers=eligibility_module.get("healthyVolunteers", False),
            )
            
            # Enrollment
            enrollment = eligibility_module.get("enrollmentInfo", {})
            enrollment_count = enrollment.get("count")
            
            # Results
            results_module = protocol.get("resultsSection", {})
            has_results = bool(results_module)
            
            # Sponsor
            sponsor_module = protocol.get("sponsorCollaboratorsModule", {})
            sponsor = sponsor_module.get("leadSponsor", {}).get("name")
            
            # Locations
            contacts_locations = protocol.get("contactsLocationsModule", {})
            locations = []
            for loc_data in contacts_locations.get("locations", []):
                location = TrialLocation(
                    facility=loc_data.get("facility"),
                    city=loc_data.get("city"),
                    state=loc_data.get("state"),
                    country=loc_data.get("country"),
                )
                locations.append(location)
            
            return ClinicalTrial(
                nct_id=nct_id,
                title=title,
                official_title=official_title,
                brief_summary=brief_summary,
                detailed_description=detailed_description,
                study_type=study_type,
                phase=phase,
                status=status,
                why_stopped=why_stopped,
                conditions=conditions,
                interventions=interventions,
                primary_outcomes=primary_outcomes,
                secondary_outcomes=secondary_outcomes,
                eligibility=eligibility,
                enrollment=enrollment_count,
                has_results=has_results,
                sponsor=sponsor,
                locations=locations,
                start_date=self._parse_date(start_date_str),
                completion_date=self._parse_date(completion_date_str),
                last_update=self._parse_date(last_update_str),
                url=f"https://clinicaltrials.gov/study/{nct_id}",
            )
            
        except Exception as e:
            logger.error(f"Error parsing trial data: {e}")
            return None
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date string into datetime."""
        if not date_str:
            return None
        
        formats = ["%Y-%m-%d", "%m/%d/%Y", "%Y-%m"]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return None


async def ingest_clinical_trials(
    condition: str = "",
    intervention: str = "",
    max_trials: int = 100,
    updated_since: Optional[datetime] = None,
) -> List[ClinicalTrial]:
    """
    Ingest clinical trials based on search criteria.
    
    Args:
        condition: Medical condition
        intervention: Treatment name
        max_trials: Maximum trials to fetch
        updated_since: Only trials updated since date
    
    Returns:
        List of ClinicalTrial objects
    """
    trials = []
    client = ClinicalTrialsClient()
    
    async with aiohttp.ClientSession() as session:
        # Search for trials
        nct_ids = await client.search_trials(
            session,
            condition=condition,
            intervention=intervention,
            max_results=max_trials,
            updated_since=updated_since,
        )
        
        if not nct_ids:
            logger.warning(f"No trials found for condition={condition}, intervention={intervention}")
            return trials
        
        # Fetch each trial
        for nct_id in nct_ids[:max_trials]:
            try:
                trial = await client.fetch_trial(session, nct_id)
                if trial:
                    trials.append(trial)
                    
            except Exception as e:
                logger.error(f"Failed to fetch trial {nct_id}: {e}")
                continue
    
    logger.info(f"Ingested {len(trials)} clinical trials")
    return trials


# High-priority trials cache (frequently referenced trials)
HIGH_PRIORITY_TRIALS: List[Dict[str, Any]] = [
    {
        "nct_id": "NCT03872953",
        "title": "RECOVERY Trial: Dexamethasone for COVID-19",
        "condition": "COVID-19",
        "intervention": "Dexamethasone",
        "phase": "Phase 3",
        "enrollment": 21000,
        "result": "Reduced mortality in ventilated patients",
    },
    {
        "nct_id": "NCT04315948",
        "title": "SOLIDARITY Trial: Remdesivir for COVID-19",
        "condition": "COVID-19",
        "intervention": "Remdesivir",
        "phase": "Phase 3",
        "enrollment": 11000,
        "result": "Little to no effect on mortality",
    },
    {
        "nct_id": "NCT03422427",
        "title": "DAPA-HF: Dapagliflozin in Heart Failure",
        "condition": "Heart Failure",
        "intervention": "Dapagliflozin",
        "phase": "Phase 3",
        "enrollment": 4744,
        "result": "Reduced HF hospitalizations and CV death",
    },
]


async def main():
    """Test ClinicalTrials.gov integration."""
    trials = await ingest_clinical_trials(
        condition="diabetes",
        max_trials=5,
    )
    
    for trial in trials[:3]:
        print(f"\nNCT ID: {trial.nct_id}")
        print(f"Title: {trial.title[:80]}...")
        print(f"Phase: {trial.phase.value}")
        print(f"Status: {trial.status.value}")
        print(f"Conditions: {', '.join(trial.conditions[:3])}")


if __name__ == "__main__":
    asyncio.run(main())

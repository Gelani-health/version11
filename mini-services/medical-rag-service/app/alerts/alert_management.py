"""
P3: Clinical Alert Management System
=====================================

Implements comprehensive clinical alerting:
- Tiered alert severity (info, warning, critical, blocker)
- Alert fatigue mitigation strategies
- Alert acknowledgment tracking
- Override documentation requirements
- Alert analytics and effectiveness tracking
- SBAR-formatted clinical alerts

Reference: ISO/TS 25238:2007 Health Informatics - Alerting Standards
"""

import asyncio
import time
import json
from typing import Optional, List, Dict, Any, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib

from loguru import logger


class AlertSeverity(Enum):
    """Alert severity levels."""
    INFO = "info"                    # Informational, no action required
    WARNING = "warning"              # Action recommended but not urgent
    CRITICAL = "critical"            # Urgent action required
    BLOCKER = "blocker"              # Must be addressed before proceeding


class AlertCategory(Enum):
    """Clinical alert categories."""
    DRUG_INTERACTION = "drug_interaction"
    ALLERGY = "allergy"
    DOSING = "dosing"
    LAB_CRITICAL = "lab_critical"
    DIAGNOSTIC = "diagnostic"
    SAFETY = "safety"
    CLINICAL_GUIDELINE = "clinical_guideline"
    PREVENTIVE_CARE = "preventive_care"
    MONITORING = "monitoring"


class AlertStatus(Enum):
    """Alert lifecycle status."""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    OVERRIDDEN = "overridden"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"
    ESCALATED = "escalated"


@dataclass
class AlertAction:
    """Recommended action for an alert."""
    action_type: str
    description: str
    priority: int = 1
    automated: bool = False
    links: List[str] = field(default_factory=list)


@dataclass
class ClinicalAlert:
    """
    Comprehensive clinical alert with SBAR format.
    
    SBAR: Situation, Background, Assessment, Recommendation
    """
    id: str
    alert_type: str
    category: AlertCategory
    severity: AlertSeverity
    status: AlertStatus = AlertStatus.ACTIVE
    
    # SBAR Components
    situation: str = ""
    background: str = ""
    assessment: str = ""
    recommendation: str = ""
    
    # Clinical context
    patient_id: Optional[str] = None
    encounter_id: Optional[str] = None
    triggering_data: Dict[str, Any] = field(default_factory=dict)
    
    # Actions
    actions: List[AlertAction] = field(default_factory=list)
    
    # Tracking
    created_at: datetime = field(default_factory=datetime.utcnow)
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    override_reason: Optional[str] = None
    resolved_at: Optional[datetime] = None
    
    # Fatigue mitigation
    suppression_key: str = ""
    duplicate_count: int = 0
    last_shown: Optional[datetime] = None
    
    # Evidence
    evidence_level: str = ""
    references: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "alert_type": self.alert_type,
            "category": self.category.value,
            "severity": self.severity.value,
            "status": self.status.value,
            "sbar": {
                "situation": self.situation,
                "background": self.background,
                "assessment": self.assessment,
                "recommendation": self.recommendation,
            },
            "patient_id": self.patient_id,
            "actions": [
                {
                    "action_type": a.action_type,
                    "description": a.description,
                    "priority": a.priority,
                    "automated": a.automated,
                }
                for a in self.actions
            ],
            "created_at": self.created_at.isoformat(),
            "acknowledged_at": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            "acknowledged_by": self.acknowledged_by,
            "override_reason": self.override_reason,
            "evidence_level": self.evidence_level,
            "references": self.references,
            "duplicate_count": self.duplicate_count,
        }
    
    def to_sbar_format(self) -> str:
        """Generate SBAR-formatted alert message."""
        return f"""
**SITUATION**: {self.situation}

**BACKGROUND**: {self.background}

**ASSESSMENT**: {self.assessment}

**RECOMMENDATION**: {self.recommendation}

**Severity**: {self.severity.value.upper()}
**Category**: {self.category.value.replace('_', ' ').title()}
**Evidence Level**: {self.evidence_level or 'Not specified'}
""".strip()


class AlertFatigueMitigator:
    """
    Implements alert fatigue mitigation strategies.
    
    Strategies:
    - Suppression rules for low-value alerts
    - Duplicate detection and bundling
    - Tiered display based on severity
    - Time-based suppression
    - Context-aware filtering
    """
    
    # Suppression rules by category
    SUPPRESSION_RULES = {
        # Don't show duplicate drug interactions within 24 hours
        AlertCategory.DRUG_INTERACTION: {
            "suppress_hours": 24,
            "max_duplicates": 3,
        },
        # Lab critical values always show
        AlertCategory.LAB_CRITICAL: {
            "suppress_hours": 0,
            "max_duplicates": 0,
        },
        # Safety alerts always show
        AlertCategory.SAFETY: {
            "suppress_hours": 0,
            "max_duplicates": 0,
        },
        # Clinical guidelines can be suppressed for 72 hours
        AlertCategory.CLINICAL_GUIDELINE: {
            "suppress_hours": 72,
            "max_duplicates": 5,
        },
    }
    
    def __init__(self):
        self._alert_history: Dict[str, List[datetime]] = {}
        self._suppressed_alerts: Set[str] = set()
    
    def generate_suppression_key(
        self,
        alert_type: str,
        patient_id: str,
        category: AlertCategory,
        triggering_data: Dict[str, Any],
    ) -> str:
        """Generate a unique key for duplicate detection."""
        key_data = f"{alert_type}:{patient_id}:{category.value}"
        
        # Add relevant triggering data to key
        if "medications" in triggering_data:
            meds = sorted(triggering_data["medications"])
            key_data += f":{','.join(meds)}"
        if "lab_test" in triggering_data:
            key_data += f":{triggering_data['lab_test']}"
        
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def should_suppress(
        self,
        alert: ClinicalAlert,
        patient_alert_history: List[ClinicalAlert],
    ) -> tuple[bool, str]:
        """
        Determine if an alert should be suppressed.
        
        Returns:
            Tuple of (should_suppress, reason)
        """
        if alert.category not in self.SUPPRESSION_RULES:
            return False, ""
        
        rules = self.SUPPRESSION_RULES[alert.category]
        suppress_hours = rules["suppress_hours"]
        max_duplicates = rules["max_duplicates"]
        
        if suppress_hours == 0 and max_duplicates == 0:
            return False, "Never suppress this category"
        
        # Check for recent duplicates
        cutoff = datetime.utcnow() - timedelta(hours=suppress_hours) if suppress_hours > 0 else None
        
        recent_duplicates = 0
        for past_alert in patient_alert_history:
            if past_alert.suppression_key == alert.suppression_key:
                if cutoff is None or past_alert.created_at >= cutoff:
                    recent_duplicates += 1
        
        if max_duplicates > 0 and recent_duplicates >= max_duplicates:
            return True, f"Duplicate alert (shown {recent_duplicates} times recently)"
        
        return False, ""
    
    def bundle_alerts(
        self,
        alerts: List[ClinicalAlert],
    ) -> List[ClinicalAlert]:
        """
        Bundle related alerts to reduce alert fatigue.
        
        Groups alerts by category and creates summary alerts.
        """
        if len(alerts) <= 3:
            return alerts
        
        # Group by category
        by_category: Dict[AlertCategory, List[ClinicalAlert]] = {}
        for alert in alerts:
            if alert.category not in by_category:
                by_category[alert.category] = []
            by_category[alert.category].append(alert)
        
        bundled = []
        
        for category, category_alerts in by_category.items():
            if len(category_alerts) == 1:
                bundled.append(category_alerts[0])
            elif len(category_alerts) > 3:
                # Create summary alert
                summary = self._create_summary_alert(category, category_alerts)
                bundled.append(summary)
            else:
                bundled.extend(category_alerts)
        
        # Sort by severity
        severity_order = {
            AlertSeverity.BLOCKER: 0,
            AlertSeverity.CRITICAL: 1,
            AlertSeverity.WARNING: 2,
            AlertSeverity.INFO: 3,
        }
        bundled.sort(key=lambda a: severity_order.get(a.severity, 99))
        
        return bundled
    
    def _create_summary_alert(
        self,
        category: AlertCategory,
        alerts: List[ClinicalAlert],
    ) -> ClinicalAlert:
        """Create a summary alert for bundled alerts."""
        critical_count = sum(1 for a in alerts if a.severity == AlertSeverity.CRITICAL)
        warning_count = sum(1 for a in alerts if a.severity == AlertSeverity.WARNING)
        
        max_severity = max(alerts, key=lambda a: list(AlertSeverity).index(a.severity)).severity
        
        return ClinicalAlert(
            id=f"summary-{category.value}-{datetime.utcnow().timestamp()}",
            alert_type=f"{category.value}_summary",
            category=category,
            severity=max_severity,
            situation=f"Multiple {category.value.replace('_', ' ')} alerts ({len(alerts)} total)",
            background=f"{critical_count} critical, {warning_count} warnings",
            assessment="Multiple alerts require attention",
            recommendation="Review individual alerts for details",
            duplicate_count=len(alerts),
        )


class ClinicalAlertManager:
    """
    P3: Comprehensive Clinical Alert Management System.
    
    Features:
    - Alert creation with SBAR format
    - Alert fatigue mitigation
    - Acknowledgment tracking
    - Override documentation
    - Analytics and reporting
    """
    
    def __init__(self):
        self.fatigue_mitigator = AlertFatigueMitigator()
        self._alerts: Dict[str, ClinicalAlert] = {}
        self._patient_alerts: Dict[str, List[ClinicalAlert]] = {}
        
        # Analytics
        self.stats = {
            "total_alerts": 0,
            "by_severity": {s.value: 0 for s in AlertSeverity},
            "by_category": {c.value: 0 for c in AlertCategory},
            "acknowledged": 0,
            "overridden": 0,
            "avg_acknowledgment_time_seconds": 0,
        }
        
        # Override documentation requirements by severity
        self.override_requirements = {
            AlertSeverity.INFO: {"required": False, "min_chars": 0},
            AlertSeverity.WARNING: {"required": True, "min_chars": 10},
            AlertSeverity.CRITICAL: {"required": True, "min_chars": 50},
            AlertSeverity.BLOCKER: {"required": True, "min_chars": 100},
        }
    
    async def create_alert(
        self,
        alert_type: str,
        category: AlertCategory,
        severity: AlertSeverity,
        situation: str,
        background: str,
        assessment: str,
        recommendation: str,
        patient_id: Optional[str] = None,
        triggering_data: Optional[Dict[str, Any]] = None,
        actions: Optional[List[AlertAction]] = None,
        evidence_level: str = "",
        references: Optional[List[str]] = None,
    ) -> ClinicalAlert:
        """
        Create a new clinical alert with SBAR format.
        """
        alert_id = f"alert-{datetime.utcnow().timestamp()}-{hashlib.md5(alert_type.encode()).hexdigest()[:8]}"
        
        # Generate suppression key
        suppression_key = self.fatigue_mitigator.generate_suppression_key(
            alert_type, patient_id or "unknown", category, triggering_data or {}
        )
        
        alert = ClinicalAlert(
            id=alert_id,
            alert_type=alert_type,
            category=category,
            severity=severity,
            situation=situation,
            background=background,
            assessment=assessment,
            recommendation=recommendation,
            patient_id=patient_id,
            triggering_data=triggering_data or {},
            actions=actions or [],
            evidence_level=evidence_level,
            references=references or [],
            suppression_key=suppression_key,
        )
        
        # Check for suppression
        patient_history = self._patient_alerts.get(patient_id, [])
        should_suppress, reason = self.fatigue_mitigator.should_suppress(alert, patient_history)
        
        if should_suppress:
            alert.status = AlertStatus.DISMISSED
            logger.info(f"Alert suppressed: {reason}")
            return alert
        
        # Store alert
        self._alerts[alert_id] = alert
        if patient_id:
            if patient_id not in self._patient_alerts:
                self._patient_alerts[patient_id] = []
            self._patient_alerts[patient_id].append(alert)
        
        # Update stats
        self.stats["total_alerts"] += 1
        self.stats["by_severity"][severity.value] += 1
        self.stats["by_category"][category.value] += 1
        
        return alert
    
    async def acknowledge_alert(
        self,
        alert_id: str,
        acknowledged_by: str,
        notes: Optional[str] = None,
    ) -> Optional[ClinicalAlert]:
        """Acknowledge an alert."""
        if alert_id not in self._alerts:
            return None
        
        alert = self._alerts[alert_id]
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = acknowledged_by
        
        self.stats["acknowledged"] += 1
        
        logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
        return alert
    
    async def override_alert(
        self,
        alert_id: str,
        overridden_by: str,
        override_reason: str,
    ) -> tuple[Optional[ClinicalAlert], List[str]]:
        """
        Override an alert with documentation.
        
        Returns:
            Tuple of (alert, validation_errors)
        """
        if alert_id not in self._alerts:
            return None, ["Alert not found"]
        
        alert = self._alerts[alert_id]
        errors = []
        
        # Check override requirements
        requirements = self.override_requirements.get(alert.severity, {})
        
        if requirements.get("required", False):
            if not override_reason:
                errors.append(f"Override reason required for {alert.severity.value} alerts")
            elif len(override_reason) < requirements.get("min_chars", 0):
                errors.append(f"Override reason must be at least {requirements['min_chars']} characters")
        
        if errors:
            return alert, errors
        
        alert.status = AlertStatus.OVERRIDDEN
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = overridden_by
        alert.override_reason = override_reason
        
        self.stats["overridden"] += 1
        
        logger.warning(f"Alert {alert_id} overridden by {overridden_by}: {override_reason}")
        return alert, []
    
    def get_patient_alerts(
        self,
        patient_id: str,
        active_only: bool = True,
    ) -> List[ClinicalAlert]:
        """Get alerts for a patient."""
        alerts = self._patient_alerts.get(patient_id, [])
        
        if active_only:
            alerts = [a for a in alerts if a.status == AlertStatus.ACTIVE]
        
        # Apply fatigue mitigation
        alerts = self.fatigue_mitigator.bundle_alerts(alerts)
        
        return alerts
    
    def get_alert_analytics(self) -> Dict[str, Any]:
        """Get alert analytics and effectiveness metrics."""
        total = self.stats["total_alerts"]
        if total == 0:
            return {"message": "No alerts generated yet"}
        
        override_rate = (self.stats["overridden"] / total) * 100 if total > 0 else 0
        ack_rate = (self.stats["acknowledged"] / total) * 100 if total > 0 else 0
        
        # Alert fatigue indicators
        fatigue_risk = "low"
        if override_rate > 30:
            fatigue_risk = "high"
        elif override_rate > 15:
            fatigue_risk = "medium"
        
        return {
            "total_alerts": total,
            "acknowledged": self.stats["acknowledged"],
            "overridden": self.stats["overridden"],
            "acknowledgment_rate": round(ack_rate, 1),
            "override_rate": round(override_rate, 1),
            "alert_fatigue_risk": fatigue_risk,
            "by_severity": self.stats["by_severity"],
            "by_category": self.stats["by_category"],
            "recommendations": self._generate_recommendations(override_rate, ack_rate),
        }
    
    def _generate_recommendations(self, override_rate: float, ack_rate: float) -> List[str]:
        """Generate recommendations based on alert analytics."""
        recommendations = []
        
        if override_rate > 30:
            recommendations.append("⚠️ High override rate detected. Review alert criteria and consider adjusting thresholds.")
        
        if override_rate > 50:
            recommendations.append("🔴 Critical: Override rate exceeds 50%. Immediate review of alert relevance required.")
        
        if ack_rate < 50:
            recommendations.append("⚠️ Low acknowledgment rate. Consider alert prioritization or escalation procedures.")
        
        if not recommendations:
            recommendations.append("✅ Alert system performing within normal parameters.")
        
        return recommendations


# Alert creation helpers for common clinical scenarios

async def create_drug_interaction_alert(
    drug1: str,
    drug2: str,
    interaction_type: str,
    severity: str,
    description: str,
    patient_id: Optional[str] = None,
    manager: Optional[ClinicalAlertManager] = None,
) -> ClinicalAlert:
    """Create a drug interaction alert."""
    if manager is None:
        manager = ClinicalAlertManager()
    
    severity_map = {
        "major": AlertSeverity.CRITICAL,
        "moderate": AlertSeverity.WARNING,
        "minor": AlertSeverity.INFO,
    }
    
    return await manager.create_alert(
        alert_type="drug_interaction",
        category=AlertCategory.DRUG_INTERACTION,
        severity=severity_map.get(severity.lower(), AlertSeverity.WARNING),
        situation=f"Potential drug interaction between {drug1} and {drug2}",
        background=f"Interaction type: {interaction_type}. {description}",
        assessment="Concurrent use may result in adverse effects or reduced efficacy",
        recommendation=f"Consider alternative therapy or monitor for adverse effects. Consult clinical pharmacist if needed.",
        patient_id=patient_id,
        triggering_data={"medications": [drug1, drug2], "interaction_type": interaction_type},
        evidence_level="Moderate",
    )


async def create_critical_lab_alert(
    test_name: str,
    value: float,
    critical_low: float,
    critical_high: float,
    patient_id: Optional[str] = None,
    manager: Optional[ClinicalAlertManager] = None,
) -> ClinicalAlert:
    """Create a critical lab value alert."""
    if manager is None:
        manager = ClinicalAlertManager()
    
    is_low = value < critical_low
    critical_value = critical_low if is_low else critical_high
    
    return await manager.create_alert(
        alert_type="critical_lab_value",
        category=AlertCategory.LAB_CRITICAL,
        severity=AlertSeverity.CRITICAL,
        situation=f"Critical lab value: {test_name} = {value}",
        background=f"Reference critical range: {critical_low} - {critical_high}. Current value is {'below' if is_low else 'above'} critical threshold.",
        assessment=f"Immediate clinical attention required. Value is critically {'low' if is_low else 'high'}.",
        recommendation="1. Verify result with repeat test if appropriate\n2. Assess patient for symptoms\n3. Initiate appropriate clinical intervention\n4. Document notification and response",
        patient_id=patient_id,
        triggering_data={"test_name": test_name, "value": value, "critical_low": critical_low, "critical_high": critical_high},
        evidence_level="High",
    )


async def create_allergy_alert(
    allergen: str,
    reaction_type: str,
    prescribed_medication: str,
    cross_reactive: bool = False,
    patient_id: Optional[str] = None,
    manager: Optional[ClinicalAlertManager] = None,
) -> ClinicalAlert:
    """Create an allergy alert."""
    if manager is None:
        manager = ClinicalAlertManager()
    
    severity = AlertSeverity.CRITICAL if reaction_type.lower() in ["anaphylaxis", "severe"] else AlertSeverity.WARNING
    
    cross_react_text = " (cross-reactive)" if cross_reactive else ""
    
    return await manager.create_alert(
        alert_type="allergy_conflict",
        category=AlertCategory.ALLERGY,
        severity=severity,
        situation=f"Prescribed medication {prescribed_medication} conflicts with documented allergy{cross_react_text}",
        background=f"Patient has documented {allergen} allergy with {reaction_type} reaction. {prescribed_medication} may cause similar reaction.",
        assessment="Risk of allergic reaction with current prescription",
        recommendation="1. Select alternative medication\n2. If no alternative available, document allergy discussion\n3. Consider allergy testing or consultation",
        patient_id=patient_id,
        triggering_data={"allergen": allergen, "medication": prescribed_medication, "cross_reactive": cross_reactive},
        evidence_level="High",
    )


# Singleton instance
_alert_manager: Optional[ClinicalAlertManager] = None


def get_alert_manager() -> ClinicalAlertManager:
    """Get or create alert manager singleton."""
    global _alert_manager
    
    if _alert_manager is None:
        _alert_manager = ClinicalAlertManager()
    
    return _alert_manager

"""
P3: Multi-Modal Clinical Intelligence Service
=============================================

Main service providing unified multi-modal AI capabilities:
- Medical Image Analysis
- Medical Video Analysis
- Medical Audio Analysis
- Cross-modal correlation
- Clinical decision synthesis

This service integrates all P3 capabilities into a cohesive clinical intelligence layer.
"""

import time
import asyncio
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import base64
import hashlib

from loguru import logger

from .orchestrator import (
    MultiModalOrchestrator,
    MultiModalInput,
    MultiModalResult,
    InputType,
    get_multimodal_orchestrator,
)
from .video_analyzer import VideoType, VideoAnalysisResult
from .audio_analyzer import AudioType, AudioAnalysisResult
from .image_analyzer import ImageModality, AnatomicalRegion, ImageAnalysisResult


class ClinicalInputType(Enum):
    """Types of clinical inputs."""
    RADIOLOGY_IMAGE = "radiology_image"
    DERMATOLOGY_IMAGE = "dermatology_image"
    PATHOLOGY_IMAGE = "pathology_image"
    ENDOSCOPY_VIDEO = "endoscopy_video"
    PROCEDURE_VIDEO = "procedure_video"
    GAIT_VIDEO = "gait_video"
    HEART_SOUND = "heart_sound"
    LUNG_SOUND = "lung_sound"
    PATIENT_SPEECH = "patient_speech"
    VOICE_BIOMARKER = "voice_biomarker"
    DOCUMENT = "document"
    MULTI_INPUT = "multi_input"


@dataclass
class ClinicalInput:
    """A clinical input for multi-modal analysis."""
    input_type: ClinicalInputType
    data: Union[bytes, str]  # bytes for media, str for text
    metadata: Optional[Dict[str, Any]] = None
    clinical_context: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "input_type": self.input_type.value,
            "data_type": "bytes" if isinstance(self.data, bytes) else "text",
            "data_size": len(self.data) if isinstance(self.data, bytes) else len(self.data),
            "metadata": self.metadata,
            "clinical_context": self.clinical_context,
        }


@dataclass
class ClinicalIntelligenceResult:
    """Result from clinical intelligence analysis."""
    analysis_id: str
    timestamp: str
    
    # Input summary
    inputs_processed: int
    input_types: List[str]
    
    # Findings
    primary_findings: List[str]
    secondary_findings: List[str]
    cross_modal_correlations: List[Dict[str, Any]]
    
    # Clinical synthesis
    clinical_impression: str
    differential_considerations: List[str]
    risk_assessment: Optional[Dict[str, Any]]
    
    # Recommendations
    recommendations: List[str]
    follow_up_actions: List[str]
    alerts: List[str]
    
    # Confidence
    overall_confidence: float
    modality_confidences: Dict[str, float]
    
    # Performance
    processing_time_ms: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "analysis_id": self.analysis_id,
            "timestamp": self.timestamp,
            "inputs_processed": self.inputs_processed,
            "input_types": self.input_types,
            "primary_findings": self.primary_findings,
            "secondary_findings": self.secondary_findings,
            "cross_modal_correlations": self.cross_modal_correlations,
            "clinical_impression": self.clinical_impression,
            "differential_considerations": self.differential_considerations,
            "risk_assessment": self.risk_assessment,
            "recommendations": self.recommendations,
            "follow_up_actions": self.follow_up_actions,
            "alerts": self.alerts,
            "overall_confidence": round(self.overall_confidence, 3),
            "modality_confidences": {k: round(v, 3) for k, v in self.modality_confidences.items()},
            "processing_time_ms": round(self.processing_time_ms, 2),
        }


class MultiModalService:
    """
    P3: Multi-Modal Clinical Intelligence Service.
    
    Provides unified multi-modal AI capabilities for clinical decision support.
    """
    
    # Input type to modality mapping
    INPUT_MODALITY_MAP = {
        ClinicalInputType.RADIOLOGY_IMAGE: ("image", ImageModality.GENERAL),
        ClinicalInputType.DERMATOLOGY_IMAGE: ("image", ImageModality.DERMATOLOGY),
        ClinicalInputType.PATHOLOGY_IMAGE: ("image", ImageModality.PATHOLOGY),
        ClinicalInputType.ENDOSCOPY_VIDEO: ("video", VideoType.ENDOSCOPY),
        ClinicalInputType.PROCEDURE_VIDEO: ("video", VideoType.PROCEDURE),
        ClinicalInputType.GAIT_VIDEO: ("video", VideoType.GAIT_ANALYSIS),
        ClinicalInputType.HEART_SOUND: ("audio", AudioType.HEART_SOUNDS),
        ClinicalInputType.LUNG_SOUND: ("audio", AudioType.LUNG_SOUNDS),
        ClinicalInputType.PATIENT_SPEECH: ("audio", AudioType.SPEECH),
        ClinicalInputType.VOICE_BIOMARKER: ("audio", AudioType.VOICE_BIOMARKER),
    }
    
    def __init__(self):
        self._orchestrator: Optional[MultiModalOrchestrator] = None
        self._initialized = False
        
        self.stats = {
            "total_analyses": 0,
            "images_analyzed": 0,
            "videos_analyzed": 0,
            "audio_analyzed": 0,
            "multi_input_analyses": 0,
            "alerts_generated": 0,
            "avg_processing_time_ms": 0.0,
        }
    
    async def initialize(self):
        """Initialize the multi-modal service."""
        if self._initialized:
            return
        
        self._orchestrator = get_multimodal_orchestrator()
        await self._orchestrator.initialize()
        
        self._initialized = True
        logger.info("[MultiModalService] Service initialized")
    
    async def analyze_clinical_input(
        self,
        inputs: Union[ClinicalInput, List[ClinicalInput]],
        patient_context: Optional[Dict[str, Any]] = None,
        enable_cross_modal: bool = True,
    ) -> ClinicalIntelligenceResult:
        """
        Analyze clinical input(s) with multi-modal AI.
        
        Args:
            inputs: Single or multiple clinical inputs
            patient_context: Patient demographics, history, etc.
            enable_cross_modal: Enable cross-modal correlation
        
        Returns:
            ClinicalIntelligenceResult with comprehensive findings
        """
        start_time = time.time()
        
        if not self._initialized:
            await self.initialize()
        
        # Normalize to list
        if isinstance(inputs, ClinicalInput):
            inputs = [inputs]
        
        # Generate analysis ID
        analysis_id = hashlib.sha256(str(time.time()).encode()).hexdigest()[:16]
        timestamp = datetime.utcnow().isoformat()
        
        logger.info(f"[MultiModalService] Analyzing {len(inputs)} inputs, ID: {analysis_id}")
        
        # Convert to multimodal inputs
        mm_inputs = []
        for inp in inputs:
            mm_input = self._convert_to_multimodal_input(inp, patient_context)
            if mm_input:
                mm_inputs.append(mm_input)
        
        # Process through orchestrator
        if mm_inputs:
            mm_result = await self._orchestrator.analyze(
                inputs=mm_inputs,
                clinical_context=patient_context,
                enable_cross_modal=enable_cross_modal,
            )
        else:
            mm_result = None
        
        # Convert result
        result = self._convert_result(
            analysis_id=analysis_id,
            timestamp=timestamp,
            mm_result=mm_result,
            inputs=inputs,
            processing_time=(time.time() - start_time) * 1000,
        )
        
        # Update stats
        self._update_stats(result, inputs)
        
        return result
    
    def _convert_to_multimodal_input(
        self,
        clinical_input: ClinicalInput,
        patient_context: Optional[Dict[str, Any]],
    ) -> Optional[MultiModalInput]:
        """Convert ClinicalInput to MultiModalInput."""
        if clinical_input.input_type not in self.INPUT_MODALITY_MAP:
            logger.warning(f"[MultiModalService] Unknown input type: {clinical_input.input_type}")
            return None
        
        modality_type, modality = self.INPUT_MODALITY_MAP[clinical_input.input_type]
        
        # Handle data
        if isinstance(clinical_input.data, str):
            # Assume base64 encoded
            try:
                data = base64.b64decode(clinical_input.data)
            except Exception:
                data = clinical_input.data.encode()
        else:
            data = clinical_input.data
        
        if modality_type == "image":
            return MultiModalInput(
                input_type=InputType.IMAGE,
                data=data,
                modality_hint=modality.value,
                context=clinical_input.clinical_context,
            )
        elif modality_type == "video":
            return MultiModalInput(
                input_type=InputType.VIDEO,
                data=data,
                modality_hint=modality.value,
                context=clinical_input.clinical_context,
            )
        elif modality_type == "audio":
            return MultiModalInput(
                input_type=InputType.AUDIO,
                data=data,
                modality_hint=modality.value,
                context=clinical_input.clinical_context,
            )
        
        return None
    
    def _convert_result(
        self,
        analysis_id: str,
        timestamp: str,
        mm_result: Optional[MultiModalResult],
        inputs: List[ClinicalInput],
        processing_time: float,
    ) -> ClinicalIntelligenceResult:
        """Convert MultiModalResult to ClinicalIntelligenceResult."""
        
        if mm_result is None:
            return ClinicalIntelligenceResult(
                analysis_id=analysis_id,
                timestamp=timestamp,
                inputs_processed=len(inputs),
                input_types=[inp.input_type.value for inp in inputs],
                primary_findings=[],
                secondary_findings=[],
                cross_modal_correlations=[],
                clinical_impression="Unable to process inputs",
                differential_considerations=[],
                risk_assessment=None,
                recommendations=[],
                follow_up_actions=[],
                alerts=["Analysis could not be completed"],
                overall_confidence=0.0,
                modality_confidences={},
                processing_time_ms=processing_time,
            )
        
        # Extract findings
        primary_findings = []
        secondary_findings = []
        
        for r in mm_result.image_results:
            primary_findings.extend(r.findings[:3])
            secondary_findings.extend(r.findings[3:6])
        
        for r in mm_result.video_results:
            primary_findings.extend(r.clinical_findings[:3])
        
        for r in mm_result.audio_results:
            primary_findings.extend(r.clinical_findings[:3])
        
        # Extract cross-modal correlations
        cross_modal = [f.to_dict() for f in mm_result.cross_modal_findings]
        
        # Extract differentials
        differentials = []
        for r in mm_result.image_results:
            differentials.extend(r.differentials[:2])
        
        # Risk assessment
        risk_assessment = None
        if mm_result.alerts:
            risk_assessment = {
                "level": "elevated" if len(mm_result.alerts) > 0 else "normal",
                "factors": mm_result.alerts[:5],
            }
        
        # Follow-up actions
        follow_up = []
        for r in mm_result.image_results:
            if r.follow_up:
                follow_up.append(r.follow_up)
        
        return ClinicalIntelligenceResult(
            analysis_id=analysis_id,
            timestamp=timestamp,
            inputs_processed=len(inputs),
            input_types=[inp.input_type.value for inp in inputs],
            primary_findings=primary_findings[:10],
            secondary_findings=secondary_findings[:5],
            cross_modal_correlations=cross_modal,
            clinical_impression=mm_result.unified_impression,
            differential_considerations=differentials[:5],
            risk_assessment=risk_assessment,
            recommendations=mm_result.clinical_recommendations,
            follow_up_actions=follow_up,
            alerts=mm_result.alerts,
            overall_confidence=mm_result.total_confidence,
            modality_confidences={
                "image": sum(r.confidence for r in mm_result.image_results) / len(mm_result.image_results) if mm_result.image_results else 0,
                "video": sum(r.confidence for r in mm_result.video_results) / len(mm_result.video_results) if mm_result.video_results else 0,
                "audio": sum(r.confidence for r in mm_result.audio_results) / len(mm_result.audio_results) if mm_result.audio_results else 0,
            },
            processing_time_ms=processing_time,
        )
    
    def _update_stats(
        self,
        result: ClinicalIntelligenceResult,
        inputs: List[ClinicalInput],
    ):
        """Update service statistics."""
        self.stats["total_analyses"] += 1
        self.stats["alerts_generated"] += len(result.alerts)
        
        # Update modality counts
        for inp in inputs:
            if inp.input_type in [ClinicalInputType.RADIOLOGY_IMAGE, ClinicalInputType.DERMATOLOGY_IMAGE, ClinicalInputType.PATHOLOGY_IMAGE]:
                self.stats["images_analyzed"] += 1
            elif inp.input_type in [ClinicalInputType.ENDOSCOPY_VIDEO, ClinicalInputType.PROCEDURE_VIDEO, ClinicalInputType.GAIT_VIDEO]:
                self.stats["videos_analyzed"] += 1
            elif inp.input_type in [ClinicalInputType.HEART_SOUND, ClinicalInputType.LUNG_SOUND, ClinicalInputType.PATIENT_SPEECH, ClinicalInputType.VOICE_BIOMARKER]:
                self.stats["audio_analyzed"] += 1
        
        if len(inputs) > 1:
            self.stats["multi_input_analyses"] += 1
        
        # Update average processing time
        self.stats["avg_processing_time_ms"] = (
            (self.stats["avg_processing_time_ms"] * (self.stats["total_analyses"] - 1) + result.processing_time_ms)
            / self.stats["total_analyses"]
        )
    
    async def analyze_radiology(
        self,
        image_data: bytes,
        modality: str = "general",
        anatomical_region: str = "general",
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> ImageAnalysisResult:
        """
        Analyze a radiology image.
        
        Args:
            image_data: Image bytes
            modality: xray, ct, mri, ultrasound, etc.
            anatomical_region: chest, abdomen, head, etc.
            patient_context: Patient information
        
        Returns:
            ImageAnalysisResult
        """
        if not self._initialized:
            await self.initialize()
        
        return await self._orchestrator.analyze_single_image(
            image_data=image_data,
            modality=modality,
            anatomical_region=anatomical_region,
            context=patient_context,
        )
    
    async def analyze_dermatology(
        self,
        image_data: bytes,
        body_location: Optional[str] = None,
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> ImageAnalysisResult:
        """
        Analyze a dermatology image.
        
        Args:
            image_data: Skin lesion image
            body_location: Location on body
            patient_context: Patient information
        
        Returns:
            ImageAnalysisResult
        """
        if not self._initialized:
            await self.initialize()
        
        context = patient_context or {}
        if body_location:
            context["body_location"] = body_location
        
        return await self._orchestrator.analyze_single_image(
            image_data=image_data,
            modality="dermatology",
            context=context,
        )
    
    async def analyze_heart_sounds(
        self,
        audio_data: bytes,
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> AudioAnalysisResult:
        """
        Analyze heart sound recording.
        
        Args:
            audio_data: Heart sound audio bytes
            patient_context: Patient information
        
        Returns:
            AudioAnalysisResult
        """
        if not self._initialized:
            await self.initialize()
        
        return await self._orchestrator.analyze_single_audio(
            audio_data=audio_data,
            audio_type="heart_sounds",
            context=patient_context,
        )
    
    async def analyze_lung_sounds(
        self,
        audio_data: bytes,
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> AudioAnalysisResult:
        """
        Analyze lung sound recording.
        
        Args:
            audio_data: Lung sound audio bytes
            patient_context: Patient information
        
        Returns:
            AudioAnalysisResult
        """
        if not self._initialized:
            await self.initialize()
        
        return await self._orchestrator.analyze_single_audio(
            audio_data=audio_data,
            audio_type="lung_sounds",
            context=patient_context,
        )
    
    async def analyze_medical_video(
        self,
        video_data: bytes,
        video_type: str = "general",
        patient_context: Optional[Dict[str, Any]] = None,
    ) -> VideoAnalysisResult:
        """
        Analyze medical video.
        
        Args:
            video_data: Video bytes
            video_type: procedure, surgical, gait_analysis, endoscopy, etc.
            patient_context: Patient information
        
        Returns:
            VideoAnalysisResult
        """
        if not self._initialized:
            await self.initialize()
        
        return await self._orchestrator.analyze_single_video(
            video_data=video_data,
            video_type=video_type,
            context=patient_context,
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get service statistics."""
        return {
            **self.stats,
            "initialized": self._initialized,
            "supported_input_types": [it.value for it in ClinicalInputType],
            "supported_image_modalities": [m.value for m in ImageModality],
            "supported_video_types": [vt.value for vt in VideoType],
            "supported_audio_types": [at.value for at in AudioType],
        }


# Singleton
_service: Optional[MultiModalService] = None


def get_multimodal_service() -> MultiModalService:
    """Get multi-modal service singleton."""
    global _service
    if _service is None:
        _service = MultiModalService()
    return _service

"""
P3: Multi-Modal Orchestration Engine
====================================

Orchestrates analysis across multiple modalities:
- Video Analysis
- Audio Analysis  
- Image Analysis
- Text/Document Analysis

Provides unified clinical intelligence from multi-modal inputs.
"""

import time
import asyncio
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import hashlib

from loguru import logger

from .video_analyzer import VideoAnalysisEngine, VideoType, VideoAnalysisResult
from .audio_analyzer import AudioAnalysisEngine, AudioType, AudioAnalysisResult
from .image_analyzer import ImageAnalysisEngine, ImageModality, AnatomicalRegion, ImageAnalysisResult


class InputType(Enum):
    """Types of multi-modal inputs."""
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"
    MULTIPLE = "multiple"


@dataclass
class MultiModalInput:
    """A single multi-modal input."""
    input_type: InputType
    data: bytes
    modality_hint: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "input_type": self.input_type.value,
            "data_size": len(self.data),
            "modality_hint": self.modality_hint,
            "context": self.context,
        }


@dataclass
class CrossModalFinding:
    """A finding that spans multiple modalities."""
    finding: str
    modalities: List[str]
    confidence: float
    clinical_significance: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "finding": self.finding,
            "modalities": self.modalities,
            "confidence": round(self.confidence, 3),
            "clinical_significance": self.clinical_significance,
        }


@dataclass
class MultiModalResult:
    """Combined result from multi-modal analysis."""
    result_id: str
    inputs: List[Dict[str, Any]]
    
    # Individual modality results
    image_results: List[ImageAnalysisResult]
    video_results: List[VideoAnalysisResult]
    audio_results: List[AudioAnalysisResult]
    
    # Cross-modal synthesis
    cross_modal_findings: List[CrossModalFinding]
    unified_impression: str
    clinical_recommendations: List[str]
    alerts: List[str]
    
    # Metadata
    processing_time_ms: float
    total_confidence: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "result_id": self.result_id,
            "inputs": self.inputs,
            "image_results": [r.to_dict() for r in self.image_results],
            "video_results": [r.to_dict() for r in self.video_results],
            "audio_results": [r.to_dict() for r in self.audio_results],
            "cross_modal_findings": [f.to_dict() for f in self.cross_modal_findings],
            "unified_impression": self.unified_impression,
            "clinical_recommendations": self.clinical_recommendations,
            "alerts": self.alerts,
            "processing_time_ms": round(self.processing_time_ms, 2),
            "total_confidence": round(self.total_confidence, 3),
        }


class MultiModalOrchestrator:
    """
    Orchestrates multi-modal clinical analysis.
    
    Features:
    - Automatic modality detection
    - Parallel processing of multiple inputs
    - Cross-modal correlation analysis
    - Unified clinical synthesis
    """
    
    def __init__(self):
        self._image_engine: Optional[ImageAnalysisEngine] = None
        self._video_engine: Optional[VideoAnalysisEngine] = None
        self._audio_engine: Optional[AudioAnalysisEngine] = None
        self._zai_client = None
        self._initialized = False
        
        self.stats = {
            "total_analyses": 0,
            "cross_modal_correlations": 0,
            "avg_processing_time_ms": 0.0,
        }
    
    async def initialize(self):
        """Initialize all engines."""
        if self._initialized:
            return
        
        # Initialize individual engines
        self._image_engine = ImageAnalysisEngine()
        await self._image_engine.initialize()
        
        self._video_engine = VideoAnalysisEngine()
        await self._video_engine.initialize()
        
        self._audio_engine = AudioAnalysisEngine()
        await self._audio_engine.initialize()
        
        # Initialize Z.AI client for synthesis
        try:
            import ZAI
            self._zai_client = await ZAI.create()
        except Exception as e:
            logger.warning(f"[MultiModalOrchestrator] Z.AI client not available: {e}")
        
        self._initialized = True
        logger.info("[MultiModalOrchestrator] All engines initialized")
    
    async def analyze(
        self,
        inputs: List[MultiModalInput],
        clinical_context: Optional[Dict[str, Any]] = None,
        enable_cross_modal: bool = True,
    ) -> MultiModalResult:
        """
        Analyze multiple multi-modal inputs.
        
        Args:
            inputs: List of multi-modal inputs
            clinical_context: Clinical context for analysis
            enable_cross_modal: Enable cross-modal correlation analysis
        
        Returns:
            MultiModalResult with unified findings
        """
        start_time = time.time()
        
        if not self._initialized:
            await self.initialize()
        
        # Generate result ID
        result_id = hashlib.sha256(str(time.time()).encode()).hexdigest()[:16]
        
        logger.info(f"[MultiModalOrchestrator] Analyzing {len(inputs)} inputs, result: {result_id}")
        
        # Process inputs in parallel
        image_results = []
        video_results = []
        audio_results = []
        
        tasks = []
        for inp in inputs:
            if inp.input_type == InputType.IMAGE:
                tasks.append(self._process_image(inp, clinical_context))
            elif inp.input_type == InputType.VIDEO:
                tasks.append(self._process_video(inp, clinical_context))
            elif inp.input_type == InputType.AUDIO:
                tasks.append(self._process_audio(inp, clinical_context))
        
        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect results by type
        for result in results:
            if isinstance(result, ImageAnalysisResult):
                image_results.append(result)
            elif isinstance(result, VideoAnalysisResult):
                video_results.append(result)
            elif isinstance(result, AudioAnalysisResult):
                audio_results.append(result)
            elif isinstance(result, Exception):
                logger.error(f"[MultiModalOrchestrator] Processing error: {result}")
        
        # Cross-modal analysis
        cross_modal_findings = []
        if enable_cross_modal and len(results) > 1:
            cross_modal_findings = await self._cross_modal_correlation(
                image_results, video_results, audio_results
            )
        
        # Synthesize unified impression
        unified_impression = await self._synthesize_impression(
            image_results, video_results, audio_results, cross_modal_findings, clinical_context
        )
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            image_results, video_results, audio_results, cross_modal_findings
        )
        
        # Extract alerts
        alerts = self._extract_alerts(image_results, video_results, audio_results)
        
        # Calculate confidence
        total_confidence = self._calculate_confidence(
            image_results, video_results, audio_results
        )
        
        # Build result
        processing_time = (time.time() - start_time) * 1000
        
        result = MultiModalResult(
            result_id=result_id,
            inputs=[inp.to_dict() for inp in inputs],
            image_results=image_results,
            video_results=video_results,
            audio_results=audio_results,
            cross_modal_findings=cross_modal_findings,
            unified_impression=unified_impression,
            clinical_recommendations=recommendations,
            alerts=alerts,
            processing_time_ms=processing_time,
            total_confidence=total_confidence,
        )
        
        # Update stats
        self.stats["total_analyses"] += 1
        self.stats["cross_modal_correlations"] += len(cross_modal_findings)
        self.stats["avg_processing_time_ms"] = (
            (self.stats["avg_processing_time_ms"] * (self.stats["total_analyses"] - 1) + processing_time)
            / self.stats["total_analyses"]
        )
        
        return result
    
    async def _process_image(
        self,
        inp: MultiModalInput,
        context: Optional[Dict[str, Any]],
    ) -> ImageAnalysisResult:
        """Process image input."""
        modality = ImageModality(inp.modality_hint) if inp.modality_hint else ImageModality.GENERAL
        region = AnatomicalRegion.GENERAL
        
        if inp.context:
            if "anatomical_region" in inp.context:
                try:
                    region = AnatomicalRegion(inp.context["anatomical_region"])
                except ValueError:
                    pass
        
        return await self._image_engine.analyze_image(
            image_data=inp.data,
            modality=modality,
            anatomical_region=region,
            clinical_context=context,
            patient_info=inp.context.get("patient_info") if inp.context else None,
        )
    
    async def _process_video(
        self,
        inp: MultiModalInput,
        context: Optional[Dict[str, Any]],
    ) -> VideoAnalysisResult:
        """Process video input."""
        video_type = VideoType(inp.modality_hint) if inp.modality_hint else VideoType.GENERAL
        
        return await self._video_engine.analyze_video(
            video_data=inp.data,
            video_type=video_type,
            additional_context=context,
        )
    
    async def _process_audio(
        self,
        inp: MultiModalInput,
        context: Optional[Dict[str, Any]],
    ) -> AudioAnalysisResult:
        """Process audio input."""
        audio_type = AudioType(inp.modality_hint) if inp.modality_hint else AudioType.GENERAL
        
        return await self._audio_engine.analyze_audio(
            audio_data=inp.data,
            audio_type=audio_type,
            additional_context=context,
        )
    
    async def _cross_modal_correlation(
        self,
        image_results: List[ImageAnalysisResult],
        video_results: List[VideoAnalysisResult],
        audio_results: List[AudioAnalysisResult],
    ) -> List[CrossModalFinding]:
        """Find correlations across modalities."""
        findings = []
        
        # Collect all findings with their sources
        all_findings = []
        
        for r in image_results:
            for f in r.findings:
                all_findings.append((f, "image", r.confidence))
        
        for r in video_results:
            for f in r.clinical_findings:
                all_findings.append((f, "video", r.confidence))
        
        for r in audio_results:
            for f in r.clinical_findings:
                all_findings.append((f, "audio", r.confidence))
        
        # Group similar findings
        # (Simplified - in production, use semantic similarity)
        finding_groups = {}
        for finding, modality, confidence in all_findings:
            key = finding.lower()[:50]  # Simple key
            if key not in finding_groups:
                finding_groups[key] = {"modalities": [], "confidences": []}
            if modality not in finding_groups[key]["modalities"]:
                finding_groups[key]["modalities"].append(modality)
            finding_groups[key]["confidences"].append(confidence)
        
        # Create cross-modal findings for multi-modality items
        for key, data in finding_groups.items():
            if len(data["modalities"]) > 1:
                avg_confidence = sum(data["confidences"]) / len(data["confidences"])
                findings.append(CrossModalFinding(
                    finding=key,
                    modalities=data["modalities"],
                    confidence=min(avg_confidence + 0.1, 1.0),  # Boost for multi-modal confirmation
                    clinical_significance="Confirmed across multiple modalities",
                ))
        
        return findings
    
    async def _synthesize_impression(
        self,
        image_results: List[ImageAnalysisResult],
        video_results: List[VideoAnalysisResult],
        audio_results: List[AudioAnalysisResult],
        cross_modal: List[CrossModalFinding],
        context: Optional[Dict[str, Any]],
    ) -> str:
        """Synthesize unified impression from all results."""
        # Collect impressions
        impressions = []
        
        for r in image_results:
            if r.impression:
                impressions.append(f"[Image] {r.impression}")
        
        for r in video_results:
            if r.summary:
                impressions.append(f"[Video] {r.summary[:300]}")
        
        for r in audio_results:
            if r.interpretation:
                impressions.append(f"[Audio] {r.interpretation}")
        
        for f in cross_modal:
            impressions.append(f"[Cross-Modal] {f.finding}: {f.clinical_significance}")
        
        if not impressions:
            return "No significant findings across analyzed modalities."
        
        # Use LLM to synthesize
        if self._zai_client and len(impressions) > 2:
            try:
                response = await self._zai_client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a medical synthesis expert. Create a unified clinical impression from multi-modal analysis results."
                        },
                        {
                            "role": "user",
                            "content": f"Synthesize a unified clinical impression from these findings:\n\n" + "\n".join(impressions)
                        }
                    ]
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.warning(f"[MultiModalOrchestrator] Synthesis failed: {e}")
        
        # Fallback: simple combination
        return "\n".join(impressions[:5])
    
    def _generate_recommendations(
        self,
        image_results: List[ImageAnalysisResult],
        video_results: List[VideoAnalysisResult],
        audio_results: List[AudioAnalysisResult],
        cross_modal: List[CrossModalFinding],
    ) -> List[str]:
        """Generate combined recommendations."""
        recommendations = []
        seen = set()
        
        for r in image_results:
            for rec in r.recommendations:
                key = rec.lower()[:50]
                if key not in seen:
                    recommendations.append(rec)
                    seen.add(key)
        
        for r in video_results:
            for rec in r.recommendations:
                key = rec.lower()[:50]
                if key not in seen:
                    recommendations.append(rec)
                    seen.add(key)
        
        for r in audio_results:
            for rec in r.recommendations:
                key = rec.lower()[:50]
                if key not in seen:
                    recommendations.append(rec)
                    seen.add(key)
        
        # Add cross-modal recommendations
        for f in cross_modal:
            recommendations.append(f"Cross-modal finding confirmed: {f.finding} - consider comprehensive evaluation")
        
        return recommendations[:10]
    
    def _extract_alerts(
        self,
        image_results: List[ImageAnalysisResult],
        video_results: List[VideoAnalysisResult],
        audio_results: List[AudioAnalysisResult],
    ) -> List[str]:
        """Extract alerts from all results."""
        alerts = []
        
        for r in image_results:
            for rec in r.recommendations:
                if "urgent" in rec.lower() or "emergency" in rec.lower():
                    alerts.append(rec)
        
        for r in video_results:
            for concern in r.concerns:
                alerts.append(f"Video: {concern}")
        
        for r in audio_results:
            alerts.extend(r.alerts)
        
        return alerts
    
    def _calculate_confidence(
        self,
        image_results: List[ImageAnalysisResult],
        video_results: List[VideoAnalysisResult],
        audio_results: List[AudioAnalysisResult],
    ) -> float:
        """Calculate overall confidence score."""
        confidences = []
        
        for r in image_results:
            confidences.append(r.confidence)
        for r in video_results:
            confidences.append(r.confidence)
        for r in audio_results:
            confidences.append(r.confidence)
        
        if not confidences:
            return 0.0
        
        # Weighted average with boost for multi-modal confirmation
        base_confidence = sum(confidences) / len(confidences)
        
        if len(confidences) > 1:
            # Boost for multi-modal analysis
            boost = min(0.1 * (len(confidences) - 1), 0.2)
            return min(base_confidence + boost, 1.0)
        
        return base_confidence
    
    async def analyze_single_image(
        self,
        image_data: bytes,
        modality: str = "general",
        anatomical_region: str = "general",
        context: Optional[Dict[str, Any]] = None,
    ) -> ImageAnalysisResult:
        """Convenience method for single image analysis."""
        if not self._initialized:
            await self.initialize()
        
        try:
            img_modality = ImageModality(modality)
        except ValueError:
            img_modality = ImageModality.GENERAL
        
        try:
            region = AnatomicalRegion(anatomical_region)
        except ValueError:
            region = AnatomicalRegion.GENERAL
        
        return await self._image_engine.analyze_image(
            image_data=image_data,
            modality=img_modality,
            anatomical_region=region,
            clinical_context=context,
        )
    
    async def analyze_single_video(
        self,
        video_data: bytes,
        video_type: str = "general",
        context: Optional[Dict[str, Any]] = None,
    ) -> VideoAnalysisResult:
        """Convenience method for single video analysis."""
        if not self._initialized:
            await self.initialize()
        
        try:
            vid_type = VideoType(video_type)
        except ValueError:
            vid_type = VideoType.GENERAL
        
        return await self._video_engine.analyze_video(
            video_data=video_data,
            video_type=vid_type,
            additional_context=context,
        )
    
    async def analyze_single_audio(
        self,
        audio_data: bytes,
        audio_type: str = "general",
        context: Optional[Dict[str, Any]] = None,
    ) -> AudioAnalysisResult:
        """Convenience method for single audio analysis."""
        if not self._initialized:
            await self.initialize()
        
        try:
            aud_type = AudioType(audio_type)
        except ValueError:
            aud_type = AudioType.GENERAL
        
        return await self._audio_engine.analyze_audio(
            audio_data=audio_data,
            audio_type=aud_type,
            additional_context=context,
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get orchestrator statistics."""
        return {
            **self.stats,
            "initialized": self._initialized,
            "engines": {
                "image": self._image_engine is not None,
                "video": self._video_engine is not None,
                "audio": self._audio_engine is not None,
            },
        }


# Singleton
_orchestrator: Optional[MultiModalOrchestrator] = None


def get_multimodal_orchestrator() -> MultiModalOrchestrator:
    """Get multi-modal orchestrator singleton."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = MultiModalOrchestrator()
    return _orchestrator

"""
P3: Multi-Modal Clinical Intelligence Module
=============================================

Unified multi-modal AI service integrating:
- Medical Image Analysis (X-Ray, CT, MRI, Ultrasound, etc.)
- Video Analysis (Medical procedures, patient assessments)
- Audio Analysis (Heart sounds, lung sounds, speech patterns)
- Cross-modal reasoning and synthesis

This module provides a unified interface for all multi-modal AI capabilities.
"""

from .service import MultiModalService, get_multimodal_service
from .video_analyzer import VideoAnalysisEngine
from .audio_analyzer import AudioAnalysisEngine
from .image_analyzer import ImageAnalysisEngine
from .orchestrator import MultiModalOrchestrator

__all__ = [
    "MultiModalService",
    "get_multimodal_service",
    "VideoAnalysisEngine",
    "AudioAnalysisEngine", 
    "ImageAnalysisEngine",
    "MultiModalOrchestrator",
]

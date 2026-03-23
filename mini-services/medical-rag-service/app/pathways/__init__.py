"""
Clinical Pathways Module
========================

Evidence-based clinical pathways for common emergency conditions.
"""

from app.pathways.chest_pain_pathway import ChestPainPathway, get_chest_pain_pathway
from app.pathways.sepsis_protocol import SepsisProtocol, get_sepsis_protocol
from app.pathways.stroke_pathway import StrokePathway, get_stroke_pathway

__all__ = [
    "ChestPainPathway",
    "get_chest_pain_pathway",
    "SepsisProtocol",
    "get_sepsis_protocol",
    "StrokePathway",
    "get_stroke_pathway",
]

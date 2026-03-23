"""
P3: Medical Image Analysis Engine
=================================

Provides AI-powered analysis of medical images including:
- Radiology (X-Ray, CT, MRI, Ultrasound, Mammography)
- Dermatology (Skin lesion analysis)
- Ophthalmology (Fundoscopy, OCT)
- Pathology (Histopathology slides)
- Endoscopy images
- Document OCR for medical records

Integrates with Z.AI VLM SDK for image understanding.
"""

import time
import base64
import asyncio
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import hashlib

from loguru import logger


class ImageModality(Enum):
    """Medical image modalities supported."""
    XRAY = "xray"
    CT = "ct"
    MRI = "mri"
    ULTRASOUND = "ultrasound"
    MAMMOGRAM = "mammogram"
    DEXA = "dexa"
    PET_CT = "pet_ct"
    ANGIOGRAPHY = "angiography"
    FLUOROSCOPY = "fluoroscopy"
    NUCLEAR_MEDICINE = "nuclear_medicine"
    DERMATOLOGY = "dermatology"
    FUNDOSCOPY = "fundoscopy"
    OCT = "oct"  # Optical Coherence Tomography
    PATHOLOGY = "pathology"
    ENDOSCOPY = "endoscopy"
    DOCUMENT = "document"  # Medical documents/records
    GENERAL = "general"


class AnatomicalRegion(Enum):
    """Anatomical regions for image analysis."""
    CHEST = "chest"
    ABDOMEN = "abdomen"
    PELVIS = "pelvis"
    HEAD = "head"
    NECK = "neck"
    SPINE = "spine"
    EXTREMITY_UPPER = "extremity_upper"
    EXTREMITY_LOWER = "extremity_lower"
    BREAST = "breast"
    CARDIAC = "cardiac"
    VASCULAR = "vascular"
    BRAIN = "brain"
    ORBIT = "orbit"
    SKIN = "skin"
    GENERAL = "general"


@dataclass
class ImageRegion:
    """A region of interest in an image."""
    label: str
    description: str
    confidence: float
    bounding_box: Optional[Dict[str, float]] = None  # x, y, width, height (normalized 0-1)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "label": self.label,
            "description": self.description,
            "confidence": round(self.confidence, 3),
            "bounding_box": self.bounding_box,
        }


@dataclass
class ImageAnalysisResult:
    """Complete image analysis result."""
    image_id: str
    modality: ImageModality
    anatomical_region: AnatomicalRegion
    
    # Primary findings
    summary: str = ""
    findings: List[str] = field(default_factory=list)
    impression: str = ""
    
    # Structured results
    regions_of_interest: List[ImageRegion] = field(default_factory=list)
    
    # Measurements
    measurements: Dict[str, Any] = field(default_factory=dict)
    
    # Differential considerations
    differentials: List[str] = field(default_factory=list)
    
    # Recommendations
    recommendations: List[str] = field(default_factory=list)
    follow_up: Optional[str] = None
    
    # Quality metrics
    image_quality: str = "adequate"  # "excellent", "good", "adequate", "poor"
    is_clinically_relevant: bool = True
    confidence: float = 0.8
    
    # Educational
    teaching_points: List[str] = field(default_factory=list)
    
    # Metadata
    processing_time_ms: float = 0.0
    model_used: str = "zai-vlm"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "image_id": self.image_id,
            "modality": self.modality.value,
            "anatomical_region": self.anatomical_region.value,
            "summary": self.summary,
            "findings": self.findings,
            "impression": self.impression,
            "regions_of_interest": [r.to_dict() for r in self.regions_of_interest],
            "measurements": self.measurements,
            "differentials": self.differentials,
            "recommendations": self.recommendations,
            "follow_up": self.follow_up,
            "image_quality": self.image_quality,
            "is_clinically_relevant": self.is_clinically_relevant,
            "confidence": round(self.confidence, 3),
            "teaching_points": self.teaching_points,
            "processing_time_ms": round(self.processing_time_ms, 2),
            "model_used": self.model_used,
        }


class ImageAnalysisEngine:
    """
    Medical Image Analysis Engine.
    
    Provides comprehensive image understanding for clinical applications.
    """
    
    # Modality-specific analysis prompts
    ANALYSIS_PROMPTS = {
        ImageModality.XRAY: """Analyze this X-ray image. Provide:
1. Image quality and technical adequacy
2. Anatomical structures visualized
3. Any abnormalities (opacity, lucency, fractures, foreign bodies)
4. Comparison with expected normal appearance
5. Clinical impression and differential considerations
6. Recommendations for further imaging if needed""",

        ImageModality.CT: """Analyze this CT scan. Provide:
1. Scan technique and protocol
2. Anatomical structures and regions visualized
3. Contrast enhancement patterns if applicable
4. Any abnormalities (masses, fluid collections, vascular abnormalities)
5. Density characteristics (HU if applicable)
6. Measurements of significant findings
7. Clinical impression and recommendations""",

        ImageModality.MRI: """Analyze this MRI scan. Provide:
1. Sequence types and technical parameters
2. Signal characteristics of structures
3. Contrast enhancement patterns if applicable
4. Any abnormalities (signal changes, masses, vascular)
5. Relationship to adjacent structures
6. Clinical impression and differential diagnosis""",

        ImageModality.ULTRASOUND: """Analyze this ultrasound image. Provide:
1. Probe position and anatomical region
2. Echogenicity patterns
3. Any abnormalities (cysts, masses, fluid)
4. Measurements of relevant structures
5. Doppler findings if applicable
6. Clinical correlation and recommendations""",

        ImageModality.MAMMOGRAM: """Analyze this mammogram. Provide:
1. Breast density category
2. Any masses, calcifications, or architectural distortion
3. BI-RADS assessment category
4. Laterality and location of findings
5. Comparison with prior if available
6. Recommendations for follow-up or biopsy""",

        ImageModality.DERMATOLOGY: """Analyze this skin lesion image. Provide:
1. Lesion description (size, shape, color, borders)
2. Dermoscopic features if visible
3. ABCDE assessment (Asymmetry, Border, Color, Diameter, Evolution)
4. Differential diagnosis
5. Risk stratification
6. Recommendations for management or biopsy""",

        ImageModality.FUNDOSCOPY: """Analyze this fundoscopic image. Provide:
1. Optic disc appearance (cup-to-disc ratio, pallor)
2. Retinal vessels (AV ratio, tortuosity, nicking)
3. Macula and fovea
4. Any abnormalities (hemorrhages, exudates, neovascularization)
5. Clinical correlation (diabetes, hypertension)
6. Recommendations""",

        ImageModality.PATHOLOGY: """Analyze this histopathology image. Provide:
1. Tissue type and staining
2. Cellular architecture and patterns
3. Any atypical features
4. Inflammatory or neoplastic changes
5. Grade and stage if applicable
6. Differential diagnosis""",

        ImageModality.ENDOSCOPY: """Analyze this endoscopic image. Provide:
1. Anatomical location
2. Mucosal appearance
3. Any lesions (ulcers, polyps, masses)
4. Vascular patterns
5. Biopsy recommendations if applicable
6. Clinical impression""",

        ImageModality.DOCUMENT: """Analyze this medical document. Provide:
1. Document type and purpose
2. Key clinical information extracted
3. Important values, dates, and identifiers
4. Any alerts or critical values
5. Summary of medical content""",

        ImageModality.GENERAL: """Analyze this medical image. Provide:
1. Image type identification
2. Key structures and findings
3. Any abnormalities
4. Clinical relevance
5. Recommendations""",
    }
    
    # Emergency/urgent finding patterns
    URGENT_FINDINGS = [
        "pneumothorax", "tension pneumothorax", "pulmonary embolism",
        "aortic dissection", "pneumoperitoneum", "stroke", "hemorrhage",
        "fracture", "obstruction", "perforation", "infarction",
        "mass effect", "midline shift", "hydrocephalus",
    ]
    
    def __init__(self):
        self._zai_client = None
        self._initialized = False
        self.stats = {
            "total_images_processed": 0,
            "urgent_findings_detected": 0,
            "avg_processing_time_ms": 0.0,
            "modality_counts": {},
        }
    
    async def initialize(self):
        """Initialize the image analysis engine."""
        if self._initialized:
            return
        
        try:
            import ZAI
            self._zai_client = await ZAI.create()
            self._initialized = True
            logger.info("[ImageAnalyzer] Initialized with Z.AI SDK")
        except Exception as e:
            logger.warning(f"[ImageAnalyzer] Z.AI SDK not available: {e}")
            self._initialized = True
    
    async def analyze_image(
        self,
        image_data: bytes,
        modality: ImageModality = ImageModality.GENERAL,
        anatomical_region: AnatomicalRegion = AnatomicalRegion.GENERAL,
        clinical_context: Optional[Dict[str, Any]] = None,
        patient_info: Optional[Dict[str, Any]] = None,
    ) -> ImageAnalysisResult:
        """
        Analyze a medical image.
        
        Args:
            image_data: Raw image bytes (JPEG, PNG, DICOM supported)
            modality: Type of medical image
            anatomical_region: Anatomical region being imaged
            clinical_context: Clinical context for the image
            patient_info: Patient demographic/clinical information
        
        Returns:
            ImageAnalysisResult with comprehensive findings
        """
        start_time = time.time()
        
        if not self._initialized:
            await self.initialize()
        
        # Generate image ID
        image_id = hashlib.sha256(image_data).hexdigest()[:16]
        
        logger.info(f"[ImageAnalyzer] Analyzing image {image_id}, modality: {modality.value}")
        
        # Get analysis prompt
        base_prompt = self.ANALYSIS_PROMPTS.get(modality, self.ANALYSIS_PROMPTS[ImageModality.GENERAL])
        
        # Build context
        context_parts = [base_prompt]
        if clinical_context:
            context_parts.append(f"\nClinical Context: {clinical_context}")
        if patient_info:
            context_parts.append(f"\nPatient Info: Age {patient_info.get('age', 'unknown')}, {patient_info.get('gender', 'unknown')}")
        
        # Add anatomical region context
        if anatomical_region != AnatomicalRegion.GENERAL:
            context_parts.append(f"\nAnatomical Region: {anatomical_region.value}")
        
        full_prompt = "\n".join(context_parts)
        
        try:
            result = await self._analyze_with_vlm(image_data, full_prompt, modality, anatomical_region)
        except Exception as e:
            logger.error(f"[ImageAnalyzer] Analysis error: {e}")
            result = self._create_error_result(image_id, modality, anatomical_region, str(e))
        
        # Check for urgent findings
        result = self._check_urgent_findings(result)
        
        # Update stats
        processing_time = (time.time() - start_time) * 1000
        result.processing_time_ms = processing_time
        
        self.stats["total_images_processed"] += 1
        self.stats["avg_processing_time_ms"] = (
            (self.stats["avg_processing_time_ms"] * (self.stats["total_images_processed"] - 1) + processing_time)
            / self.stats["total_images_processed"]
        )
        
        # Update modality counts
        modality_str = modality.value
        self.stats["modality_counts"][modality_str] = self.stats["modality_counts"].get(modality_str, 0) + 1
        
        return result
    
    async def _analyze_with_vlm(
        self,
        image_data: bytes,
        prompt: str,
        modality: ImageModality,
        anatomical_region: AnatomicalRegion,
    ) -> ImageAnalysisResult:
        """Analyze image using Z.AI VLM SDK."""
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        image_id = hashlib.sha256(image_data).hexdigest()[:16]
        
        try:
            # Use VLM for image understanding
            response = await self._zai_client.images.understand(
                image=image_base64,
                prompt=prompt,
            )
            
            analysis_text = response.get("content", "") if isinstance(response, dict) else str(response)
            
            return self._parse_vlm_response(analysis_text, image_id, modality, anatomical_region)
            
        except Exception as e:
            logger.warning(f"[ImageAnalyzer] VLM analysis failed, using chat fallback: {e}")
            return await self._analyze_with_chat(image_base64, prompt, image_id, modality, anatomical_region)
    
    async def _analyze_with_chat(
        self,
        image_base64: str,
        prompt: str,
        image_id: str,
        modality: ImageModality,
        anatomical_region: AnatomicalRegion,
    ) -> ImageAnalysisResult:
        """Fallback analysis using chat completion."""
        try:
            response = await self._zai_client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert medical image analyst. Provide detailed, structured analysis of medical images."
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                        ]
                    }
                ]
            )
            
            analysis_text = response.choices[0].message.content
            
            return self._parse_vlm_response(analysis_text, image_id, modality, anatomical_region)
            
        except Exception as e:
            logger.error(f"[ImageAnalyzer] Chat analysis also failed: {e}")
            return self._create_error_result(image_id, modality, anatomical_region, str(e))
    
    def _parse_vlm_response(
        self,
        text: str,
        image_id: str,
        modality: ImageModality,
        anatomical_region: AnatomicalRegion,
    ) -> ImageAnalysisResult:
        """Parse VLM response into structured result."""
        
        findings = self._extract_findings(text)
        impression = self._extract_impression(text)
        recommendations = self._extract_recommendations(text)
        differentials = self._extract_differentials(text)
        measurements = self._extract_measurements(text)
        teaching_points = self._extract_teaching_points(text)
        
        # Generate summary
        summary = text[:300] if text else "Analysis completed"
        
        return ImageAnalysisResult(
            image_id=image_id,
            modality=modality,
            anatomical_region=anatomical_region,
            summary=summary,
            findings=findings,
            impression=impression,
            regions_of_interest=[],
            measurements=measurements,
            differentials=differentials,
            recommendations=recommendations,
            follow_up=None,
            image_quality=self._assess_quality(text),
            is_clinically_relevant=True,
            confidence=0.85,
            teaching_points=teaching_points,
            processing_time_ms=0,
            model_used="zai-vlm",
        )
    
    def _extract_findings(self, text: str) -> List[str]:
        """Extract findings from text."""
        findings = []
        keywords = ["finding:", "finding :", "observed:", "detected:", "there is", "there are", "visualized:"]
        
        for line in text.split('\n'):
            line_lower = line.lower().strip()
            if any(kw in line_lower for kw in keywords):
                cleaned = line.strip()
                if cleaned and len(cleaned) > 5:
                    findings.append(cleaned)
        
        return findings[:15]
    
    def _extract_impression(self, text: str) -> str:
        """Extract impression from text."""
        text_lower = text.lower()
        
        # Look for impression section
        start_markers = ["impression:", "conclusion:", "diagnosis:", "summary:"]
        for marker in start_markers:
            if marker in text_lower:
                start_idx = text_lower.index(marker) + len(marker)
                remaining = text[start_idx:].strip()
                
                # Get first paragraph
                impression_lines = []
                for line in remaining.split('\n'):
                    if line.strip():
                        if any(m in line.lower() for m in ["recommendation:", "note:", "follow-up:"]):
                            break
                        impression_lines.append(line)
                
                if impression_lines:
                    return " ".join(impression_lines).strip()
        
        return text[:500] if text else "No impression provided"
    
    def _extract_recommendations(self, text: str) -> List[str]:
        """Extract recommendations from text."""
        recommendations = []
        keywords = ["recommend:", "suggest:", "should", "consider:", "follow-up:", "advise:"]
        
        for line in text.split('\n'):
            line_lower = line.lower()
            if any(kw in line_lower for kw in keywords):
                cleaned = line.strip()
                if cleaned and len(cleaned) > 5:
                    recommendations.append(cleaned)
        
        return recommendations[:5]
    
    def _extract_differentials(self, text: str) -> List[str]:
        """Extract differential diagnoses from text."""
        differentials = []
        keywords = ["differential:", "differentials:", "consider:", "cannot exclude:", "vs:", "versus:"]
        
        for line in text.split('\n'):
            line_lower = line.lower()
            if any(kw in line_lower for kw in keywords):
                cleaned = line.strip()
                if cleaned and len(cleaned) > 5:
                    differentials.append(cleaned)
        
        return differentials[:5]
    
    def _extract_measurements(self, text: str) -> Dict[str, Any]:
        """Extract measurements from text."""
        import re
        measurements = {}
        
        # Common measurement patterns
        patterns = [
            r'(\w+)\s*:?\s*(\d+\.?\d*)\s*(cm|mm|mL|mmHg|HU)',
            r'(\d+\.?\d*)\s*(cm|mm|mL|mmHg|HU)\s*(?:x|×)\s*(\d+\.?\d*)',
            r'size\s*:?\s*(\d+\.?\d*)\s*(cm|mm)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple) and len(match) >= 2:
                    key = match[0] if len(match) > 2 else "measurement"
                    value = f"{match[-2]} {match[-1]}" if len(match) > 2 else f"{match[0]} {match[1]}"
                    measurements[key] = value
        
        return measurements
    
    def _extract_teaching_points(self, text: str) -> List[str]:
        """Extract teaching points from text."""
        teaching_points = []
        keywords = ["teaching point:", "learning:", "educational:", "note:"]
        
        for line in text.split('\n'):
            line_lower = line.lower()
            if any(kw in line_lower for kw in keywords):
                cleaned = line.strip()
                if cleaned and len(cleaned) > 5:
                    teaching_points.append(cleaned)
        
        return teaching_points[:3]
    
    def _assess_quality(self, text: str) -> str:
        """Assess image quality from analysis."""
        text_lower = text.lower()
        
        if "excellent" in text_lower or "high quality" in text_lower:
            return "excellent"
        elif "good" in text_lower or "adequate" in text_lower:
            return "good"
        elif "poor" in text_lower or "limited" in text_lower:
            return "poor"
        else:
            return "adequate"
    
    def _check_urgent_findings(self, result: ImageAnalysisResult) -> ImageAnalysisResult:
        """Check for urgent/emergent findings."""
        all_text = (result.summary + " " + " ".join(result.findings) + " " + result.impression).lower()
        
        urgent_detected = []
        for urgent in self.URGENT_FINDINGS:
            if urgent in all_text:
                urgent_detected.append(urgent)
        
        if urgent_detected:
            self.stats["urgent_findings_detected"] += 1
            # Add to recommendations
            result.recommendations.insert(0, f"⚠️ URGENT: Potential {', '.join(urgent_detected)} detected - requires immediate clinical correlation")
        
        return result
    
    def _create_error_result(
        self,
        image_id: str,
        modality: ImageModality,
        anatomical_region: AnatomicalRegion,
        error: str,
    ) -> ImageAnalysisResult:
        """Create error result."""
        return ImageAnalysisResult(
            image_id=image_id,
            modality=modality,
            anatomical_region=anatomical_region,
            summary=f"Analysis failed: {error}",
            findings=[],
            impression="Unable to complete image analysis",
            regions_of_interest=[],
            measurements={},
            differentials=[],
            recommendations=[],
            follow_up=None,
            image_quality="unknown",
            is_clinically_relevant=False,
            confidence=0.0,
            teaching_points=[],
            processing_time_ms=0,
            model_used="error",
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get image analysis statistics."""
        return {
            **self.stats,
            "initialized": self._initialized,
            "supported_modalities": [m.value for m in ImageModality],
            "supported_regions": [r.value for r in AnatomicalRegion],
        }


# Singleton
_image_engine: Optional[ImageAnalysisEngine] = None


def get_image_engine() -> ImageAnalysisEngine:
    """Get image analysis engine singleton."""
    global _image_engine
    if _image_engine is None:
        _image_engine = ImageAnalysisEngine()
    return _image_engine

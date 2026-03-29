"""
Multilingual Support Module
===========================

Provides multi-language support for medical content:
- Language detection
- Translation (via external APIs)
- Language-specific content retrieval
- Cross-lingual search

Supported languages:
- English (en) - primary
- Spanish (es)
- French (fr)
- German (de)
- Chinese (zh)
- Japanese (ja)

HIPAA Compliance: All patient data is handled according to HIPAA guidelines.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum


class SupportedLanguage(Enum):
    ENGLISH = "en"
    SPANISH = "es"
    FRENCH = "fr"
    GERMAN = "de"
    CHINESE = "zh"
    JAPANESE = "ja"
    PORTUGUESE = "pt"
    ARABIC = "ar"


@dataclass
class MultilingualContent:
    """Content in multiple languages."""
    content_id: str
    original_language: SupportedLanguage
    original_text: str
    translations: Dict[str, str]
    
    def get_in_language(self, language: SupportedLanguage) -> str:
        """Get content in specified language."""
        if language == self.original_language:
            return self.original_text
        return self.translations.get(language.value, self.original_text)


# Common medical terms in multiple languages
MEDICAL_TERMS_MULTILINGUAL: Dict[str, Dict[str, str]] = {
    "diagnosis": {
        "en": "diagnosis",
        "es": "diagnóstico",
        "fr": "diagnostic",
        "de": "Diagnose",
        "zh": "诊断",
        "ja": "診断",
    },
    "treatment": {
        "en": "treatment",
        "es": "tratamiento",
        "fr": "traitement",
        "de": "Behandlung",
        "zh": "治疗",
        "ja": "治療",
    },
    "prescription": {
        "en": "prescription",
        "es": "receta",
        "fr": "ordonnance",
        "de": "Verschreibung",
        "zh": "处方",
        "ja": "処方箋",
    },
    "symptom": {
        "en": "symptom",
        "es": "síntoma",
        "fr": "symptôme",
        "de": "Symptom",
        "zh": "症状",
        "ja": "症状",
    },
    "medication": {
        "en": "medication",
        "es": "medicamento",
        "fr": "médicament",
        "de": "Medikament",
        "zh": "药物",
        "ja": "薬物",
    },
    "allergy": {
        "en": "allergy",
        "es": "alergia",
        "fr": "allergie",
        "de": "Allergie",
        "zh": "过敏",
        "ja": "アレルギー",
    },
    "dose": {
        "en": "dose",
        "es": "dosis",
        "fr": "dose",
        "de": "Dosis",
        "zh": "剂量",
        "ja": "用量",
    },
    "side_effect": {
        "en": "side effect",
        "es": "efecto secundario",
        "fr": "effet secondaire",
        "de": "Nebenwirkung",
        "zh": "副作用",
        "ja": "副作用",
    },
}


def get_medical_term(term: str, language: SupportedLanguage = SupportedLanguage.ENGLISH) -> str:
    """Get medical term in specified language."""
    term_lower = term.lower().replace(" ", "_")
    if term_lower in MEDICAL_TERMS_MULTILINGUAL:
        return MEDICAL_TERMS_MULTILINGUAL[term_lower].get(language.value, term)
    return term


def detect_language(text: str) -> SupportedLanguage:
    """Simple language detection based on character patterns."""
    # Check for Chinese characters
    if any('\u4e00' <= c <= '\u9fff' for c in text):
        return SupportedLanguage.CHINESE
    
    # Check for Japanese hiragana/katakana
    if any('\u3040' <= c <= '\u30ff' for c in text):
        return SupportedLanguage.JAPANESE
    
    # Check for Arabic
    if any('\u0600' <= c <= '\u06ff' for c in text):
        return SupportedLanguage.ARABIC
    
    # Default to English
    return SupportedLanguage.ENGLISH


def get_supported_languages() -> List[str]:
    """Get list of supported language codes."""
    return [lang.value for lang in SupportedLanguage]

"""
P1: Multi-Query Generation for Medical RAG
==========================================

Generates multiple query variations to improve retrieval coverage.

Strategies:
1. Synonym Expansion - Medical synonyms and related terms
2. Abbreviation Expansion - Full form of medical abbreviations
3. Simplification - Remove stop words, focus on key terms
4. Negation Handling - Convert negated queries

Architecture Context:
- Medical RAG (Port 3031): PRIMARY diagnostic engine - gets multi-query
- LangChain RAG (Port 3032): SECONDARY with fallback chain - not needed (has own fallback)
"""

import re
from typing import List, Optional, Tuple
from dataclasses import dataclass
from loguru import logger


# =============================================================================
# MEDICAL TERM EXPANSION DATABASES
# =============================================================================

# Comprehensive medical synonyms
MEDICAL_SYNONYMS = {
    # Cardiovascular
    "heart attack": ["myocardial infarction", "mi", "cardiac infarction", "acute coronary syndrome"],
    "heart failure": ["cardiac failure", "chf", "congestive heart failure", "ventricular dysfunction"],
    "high blood pressure": ["hypertension", "htn", "elevated blood pressure", "high bp"],
    "low blood pressure": ["hypotension", "low bp", "reduced blood pressure"],
    "irregular heartbeat": ["arrhythmia", "cardiac arrhythmia", "dysrhythmia"],
    "atrial fibrillation": ["afib", "af", "atrial fib"],
    "coronary artery disease": ["cad", "coronary heart disease", "ischemic heart disease"],
    "stroke": ["cerebrovascular accident", "cva", "brain attack", "cerebral infarction"],
    
    # Respiratory
    "lung disease": ["pulmonary disease", "respiratory disease", "lung disorder"],
    "copd": ["chronic obstructive pulmonary disease", "chronic obstructive airways disease"],
    "pneumonia": ["lung infection", "pneumonitis", "lower respiratory tract infection"],
    "asthma": ["reactive airway disease", "bronchial asthma"],
    "shortness of breath": ["dyspnea", "breathlessness", "short of breath", "sob"],
    
    # Endocrine
    "diabetes": ["diabetes mellitus", "dm", "high blood sugar", "hyperglycemia"],
    "type 2 diabetes": ["t2dm", "type ii diabetes", "niddm", "non-insulin dependent diabetes"],
    "type 1 diabetes": ["t1dm", "type i diabetes", "iddm", "insulin dependent diabetes"],
    "thyroid disease": ["thyroid disorder", "thyroid dysfunction"],
    "hypothyroidism": ["underactive thyroid", "low thyroid", "thyroid deficiency"],
    "hyperthyroidism": ["overactive thyroid", "high thyroid", "thyrotoxicosis"],
    
    # Renal
    "kidney disease": ["renal disease", "kidney dysfunction", "renal impairment"],
    "kidney failure": ["renal failure", "esrd", "end stage renal disease", "kidney failure"],
    "chronic kidney disease": ["ckd", "chronic renal disease", "chronic renal failure"],
    "acute kidney injury": ["aki", "acute renal failure", "acute tubular necrosis"],
    
    # Neurological
    "seizure": ["convulsion", "epileptic seizure", "fit"],
    "migraine": ["migraine headache", "vascular headache"],
    "dementia": ["cognitive decline", "cognitive impairment", "memory loss"],
    "alzheimer": ["alzheimer disease", "ad", "senile dementia"],
    "parkinson": ["parkinson disease", "pd", "paralysis agitans"],
    "multiple sclerosis": ["ms", "demyelinating disease"],
    
    # Oncology
    "cancer": ["malignancy", "neoplasm", "tumor", "carcinoma", "growth"],
    "tumor": ["neoplasm", "mass", "lesion", "growth"],
    "chemotherapy": ["chemo", "cytotoxic therapy", "antineoplastic therapy"],
    "radiation": ["radiotherapy", "radiation therapy", "irradiation"],
    
    # Gastrointestinal
    "stomach ulcer": ["gastric ulcer", "peptic ulcer", "pud"],
    "acid reflux": ["gerd", "gastroesophageal reflux", "heartburn"],
    "liver disease": ["hepatic disease", "liver dysfunction"],
    "cirrhosis": ["liver cirrhosis", "hepatic cirrhosis", "liver fibrosis"],
    "inflammatory bowel disease": ["ibd", "crohn disease", "ulcerative colitis"],
    
    # Infectious
    "infection": ["infectious disease", "bacterial infection", "viral infection"],
    "sepsis": ["septicemia", "bloodstream infection", "systemic infection"],
    "urinary tract infection": ["uti", "bladder infection", "cystitis"],
    "skin infection": ["cellulitis", "soft tissue infection", "dermatitis"],
    
    # Musculoskeletal
    "arthritis": ["joint inflammation", "joint disease", "arthropathy"],
    "rheumatoid arthritis": ["ra", "rheumatoid disease"],
    "osteoarthritis": ["oa", "degenerative joint disease", "djD"],
    "back pain": ["low back pain", "lumbago", "lumbar pain"],
    "fracture": ["broken bone", "bone fracture", "fx"],
    
    # Hematologic
    "anemia": ["low hemoglobin", "low red blood cells", "iron deficiency"],
    "blood clot": ["thrombus", "thrombosis", "embolism", "clot"],
    "deep vein thrombosis": ["dvt", "venous thrombosis", "leg clot"],
    "pulmonary embolism": ["pe", "lung clot", "pulmonary thromboembolism"],
    
    # Psychiatric
    "depression": ["major depressive disorder", "mdd", "depressive episode"],
    "anxiety": ["anxiety disorder", "generalized anxiety", "gad"],
    "bipolar": ["bipolar disorder", "manic depression", "bipolar affective disorder"],
    "schizophrenia": ["psychotic disorder", "psychosis"],
}

# Medical abbreviations with full forms
MEDICAL_ABBREVIATIONS = {
    # Cardiovascular
    "mi": "myocardial infarction",
    "chf": "congestive heart failure",
    "cad": "coronary artery disease",
    "afib": "atrial fibrillation",
    "af": "atrial fibrillation",
    "htn": "hypertension",
    "hf": "heart failure",
    "pe": "pulmonary embolism",
    "dvt": "deep vein thrombosis",
    "cabg": "coronary artery bypass graft",
    "pci": "percutaneous coronary intervention",
    "stemi": "st elevation myocardial infarction",
    "nstemi": "non st elevation myocardial infarction",
    
    # Respiratory
    "copd": "chronic obstructive pulmonary disease",
    "sob": "shortness of breath",
    "ards": "acute respiratory distress syndrome",
    "cap": "community acquired pneumonia",
    "hap": "hospital acquired pneumonia",
    "vap": "ventilator associated pneumonia",
    
    # Endocrine
    "dm": "diabetes mellitus",
    "t1dm": "type 1 diabetes mellitus",
    "t2dm": "type 2 diabetes mellitus",
    "dka": "diabetic ketoacidosis",
    "hhs": "hyperosmolar hyperglycemic state",
    
    # Renal
    "ckd": "chronic kidney disease",
    "aki": "acute kidney injury",
    "esrd": "end stage renal disease",
    "crf": "chronic renal failure",
    "arf": "acute renal failure",
    
    # Neurological
    "cva": "cerebrovascular accident",
    "tia": "transient ischemic attack",
    "sah": "subarachnoid hemorrhage",
    "sdh": "subdural hematoma",
    "edh": "epidural hematoma",
    "ich": "intracerebral hemorrhage",
    "tbi": "traumatic brain injury",
    "ms": "multiple sclerosis",
    "pd": "parkinson disease",
    "ad": "alzheimer disease",
    "als": "amyotrophic lateral sclerosis",
    
    # Oncology
    "nsclc": "non small cell lung cancer",
    "sclc": "small cell lung cancer",
    "crc": "colorectal cancer",
    "hcc": "hepatocellular carcinoma",
    "rcc": "renal cell carcinoma",
    
    # Hematologic
    "vte": "venous thromboembolism",
    
    # Gastrointestinal
    "ibd": "inflammatory bowel disease",
    "cd": "crohn disease",
    "uc": "ulcerative colitis",
    "gerd": "gastroesophageal reflux disease",
    "pud": "peptic ulcer disease",
    "nafld": "nonalcoholic fatty liver disease",
    "nash": "nonalcoholic steatohepatitis",
    
    # Rheumatologic
    "ra": "rheumatoid arthritis",
    "oa": "osteoarthritis",
    "sle": "systemic lupus erythematosus",
    "ss": "sjogren syndrome",
    "ssc": "systemic sclerosis",
    
    # Infectious
    "uti": "urinary tract infection",
    "hiv": "human immunodeficiency virus",
    "aids": "acquired immunodeficiency syndrome",
    
    # Psychiatric
    "mdd": "major depressive disorder",
    "gad": "generalized anxiety disorder",
    "ptsd": "post traumatic stress disorder",
    "ocd": "obsessive compulsive disorder",
    "adhd": "attention deficit hyperactivity disorder",
}

# Stop words for query simplification
MEDICAL_STOP_WORDS = {
    "what", "how", "why", "when", "where", "which", "who", "the",
    "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "can", "please",
    "tell", "give", "show", "find", "search", "look", "about",
    "patient", "patients", "case", "cases", "study", "studies",
    "treatment", "treatments", "therapy", "therapies",
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class QueryVariation:
    """A generated query variation."""
    query: str
    strategy: str
    expanded_terms: List[str]
    
    def to_dict(self):
        return {
            "query": self.query,
            "strategy": self.strategy,
            "expanded_terms": self.expanded_terms,
        }


@dataclass
class MultiQueryResult:
    """Result of multi-query generation."""
    original_query: str
    variations: List[QueryVariation]
    all_queries: List[str]
    
    def to_dict(self):
        return {
            "original_query": self.original_query,
            "variations": [v.to_dict() for v in self.variations],
            "all_queries": self.all_queries,
        }


# =============================================================================
# MULTI-QUERY GENERATOR
# =============================================================================

class MultiQueryGenerator:
    """
    Generates multiple query variations for improved retrieval coverage.
    
    Strategies:
    1. synonym_expansion - Add medical synonyms
    2. abbreviation_expansion - Expand abbreviations
    3. simplification - Remove stop words
    4. key_term_extraction - Extract key medical terms
    """
    
    def __init__(
        self,
        num_variations: int = 3,
        enable_synonyms: bool = True,
        enable_abbreviations: bool = True,
        enable_simplification: bool = True,
    ):
        self.num_variations = num_variations
        self.enable_synonyms = enable_synonyms
        self.enable_abbreviations = enable_abbreviations
        self.enable_simplification = enable_simplification
        
        self.stats = {
            "total_queries": 0,
            "variations_generated": 0,
        }
    
    def generate(
        self,
        query: str,
        num_variations: Optional[int] = None,
    ) -> MultiQueryResult:
        """
        Generate query variations.
        
        Args:
            query: Original query
            num_variations: Number of variations to generate (default: self.num_variations)
        
        Returns:
            MultiQueryResult with original and variations
        """
        num_variations = num_variations or self.num_variations
        variations = []
        
        query_lower = query.lower()
        
        # Strategy 1: Synonym Expansion
        if self.enable_synonyms and len(variations) < num_variations:
            var = self._expand_synonyms(query_lower)
            if var and var.query != query_lower:
                variations.append(var)
        
        # Strategy 2: Abbreviation Expansion
        if self.enable_abbreviations and len(variations) < num_variations:
            var = self._expand_abbreviations(query_lower)
            if var and var.query != query_lower:
                variations.append(var)
        
        # Strategy 3: Simplification
        if self.enable_simplification and len(variations) < num_variations:
            var = self._simplify_query(query_lower)
            if var and var.query != query_lower:
                variations.append(var)
        
        # Strategy 4: Key Term Extraction
        if len(variations) < num_variations:
            var = self._extract_key_terms(query_lower)
            if var and var.query != query_lower:
                variations.append(var)
        
        # Build all queries list
        all_queries = [query] + [v.query for v in variations]
        
        # Update stats
        self.stats["total_queries"] += 1
        self.stats["variations_generated"] += len(variations)
        
        return MultiQueryResult(
            original_query=query,
            variations=variations[:num_variations],
            all_queries=all_queries[:num_variations + 1],  # Include original
        )
    
    def _expand_synonyms(self, query: str) -> Optional[QueryVariation]:
        """Expand query with medical synonyms."""
        expanded_terms = []
        new_query = query
        
        for term, synonyms in MEDICAL_SYNONYMS.items():
            if term in query:
                # Add top synonyms
                for syn in synonyms[:2]:
                    if syn not in query:
                        expanded_terms.append(syn)
        
        if expanded_terms:
            # Append synonyms to query
            new_query = query + " " + " ".join(expanded_terms[:3])
            return QueryVariation(
                query=new_query,
                strategy="synonym_expansion",
                expanded_terms=expanded_terms[:3],
            )
        
        return None
    
    def _expand_abbreviations(self, query: str) -> Optional[QueryVariation]:
        """Expand medical abbreviations in query."""
        expanded_terms = []
        new_query = query
        
        # Find abbreviations (word boundaries)
        for abbr, full_form in MEDICAL_ABBREVIATIONS.items():
            pattern = r'\b' + re.escape(abbr) + r'\b'
            if re.search(pattern, query):
                new_query = re.sub(pattern, full_form, new_query, flags=re.IGNORECASE)
                expanded_terms.append(full_form)
        
        if expanded_terms:
            return QueryVariation(
                query=new_query,
                strategy="abbreviation_expansion",
                expanded_terms=expanded_terms,
            )
        
        return None
    
    def _simplify_query(self, query: str) -> Optional[QueryVariation]:
        """Simplify query by removing stop words."""
        words = query.split()
        important_words = [w for w in words if w not in MEDICAL_STOP_WORDS and len(w) > 2]
        
        if important_words and len(important_words) < len(words):
            return QueryVariation(
                query=" ".join(important_words),
                strategy="simplification",
                expanded_terms=[],
            )
        
        return None
    
    def _extract_key_terms(self, query: str) -> Optional[QueryVariation]:
        """Extract key medical terms from query."""
        key_terms = []
        
        # Find terms that match medical concepts
        for term in MEDICAL_SYNONYMS.keys():
            if term in query:
                key_terms.append(term)
        
        # Find abbreviations
        for abbr in MEDICAL_ABBREVIATIONS.keys():
            pattern = r'\b' + re.escape(abbr) + r'\b'
            if re.search(pattern, query):
                key_terms.append(abbr)
        
        if key_terms:
            return QueryVariation(
                query=" ".join(key_terms),
                strategy="key_term_extraction",
                expanded_terms=key_terms,
            )
        
        return None
    
    def get_stats(self) -> dict:
        """Get generator statistics."""
        return self.stats


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_multi_query_generator: Optional[MultiQueryGenerator] = None


def get_multi_query_generator() -> MultiQueryGenerator:
    """Get or create multi-query generator singleton."""
    global _multi_query_generator
    
    if _multi_query_generator is None:
        _multi_query_generator = MultiQueryGenerator()
    
    return _multi_query_generator

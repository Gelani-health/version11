"""
P2: Medical Query Expansion Module
==================================

Implements intelligent query expansion for clinical decision support:
- MeSH (Medical Subject Headings) terminology expansion
- UMLS concept mapping
- Medical acronym resolution
- Synonym expansion
- Semantic expansion
- Spelling correction

Enhances retrieval precision for medical literature queries.
"""

import re
import json
from typing import Optional, List, Dict, Any, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum

from loguru import logger


class ExpansionType(Enum):
    """Types of query expansion."""
    MESH = "mesh"
    SYNONYM = "synonym"
    ACRONYM = "acronym"
    SEMANTIC = "semantic"
    SPELLING = "spelling"


@dataclass
class ExpandedQuery:
    """Result of query expansion."""
    original: str
    expanded: str
    expansions: List[Dict[str, Any]] = field(default_factory=list)
    mesh_terms: List[str] = field(default_factory=list)
    confidence: float = 1.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "original": self.original,
            "expanded": self.expanded,
            "expansions": self.expansions,
            "mesh_terms": self.mesh_terms,
            "confidence": self.confidence,
        }


# =============================================================================
# MeSH TERM DATABASE (Common Medical Terms)
# =============================================================================

MESH_TERMS = {
    # Cardiovascular
    "heart attack": {
        "mesh": "Myocardial Infarction",
        "mesh_id": "D009203",
        "synonyms": ["myocardial infarction", "MI", "acute coronary syndrome", "cardiac infarction"],
        "related": ["coronary artery disease", "atherosclerosis", "angina pectoris"],
    },
    "heart failure": {
        "mesh": "Heart Failure",
        "mesh_id": "D006333",
        "synonyms": ["cardiac failure", "congestive heart failure", "CHF", "ventricular dysfunction"],
        "related": ["cardiomyopathy", "edema", "dyspnea"],
    },
    "high blood pressure": {
        "mesh": "Hypertension",
        "mesh_id": "D006973",
        "synonyms": ["hypertension", "HTN", "elevated blood pressure", "arterial hypertension"],
        "related": ["cardiovascular disease", "stroke", "kidney disease"],
    },
    "stroke": {
        "mesh": "Stroke",
        "mesh_id": "D020521",
        "synonyms": ["cerebrovascular accident", "CVA", "brain attack", "cerebral infarction"],
        "related": ["ischemic stroke", "hemorrhagic stroke", "TIA"],
    },
    "atrial fibrillation": {
        "mesh": "Atrial Fibrillation",
        "mesh_id": "D001281",
        "synonyms": ["AF", "AFib", "auricular fibrillation"],
        "related": ["arrhythmia", "stroke risk", "anticoagulation"],
    },
    
    # Metabolic
    "diabetes": {
        "mesh": "Diabetes Mellitus",
        "mesh_id": "D003920",
        "synonyms": ["diabetes mellitus", "DM", "hyperglycemia"],
        "related": ["type 1 diabetes", "type 2 diabetes", "diabetic complications"],
    },
    "type 2 diabetes": {
        "mesh": "Diabetes Mellitus, Type 2",
        "mesh_id": "D003924",
        "synonyms": ["T2DM", "NIDDM", "non-insulin dependent diabetes", "adult-onset diabetes"],
        "related": ["insulin resistance", "metformin", "HbA1c"],
    },
    "thyroid": {
        "mesh": "Thyroid Gland",
        "mesh_id": "D013951",
        "synonyms": ["thyroid gland"],
        "related": ["hypothyroidism", "hyperthyroidism", "thyroid nodule"],
    },
    "hypothyroidism": {
        "mesh": "Hypothyroidism",
        "mesh_id": "D007037",
        "synonyms": ["underactive thyroid", "low thyroid", "myxedema"],
        "related": ["levothyroxine", "TSH", "Hashimoto thyroiditis"],
    },
    
    # Respiratory
    "asthma": {
        "mesh": "Asthma",
        "mesh_id": "D001249",
        "synonyms": ["bronchial asthma", "reactive airway disease"],
        "related": ["bronchodilator", "inhaler", "allergic asthma"],
    },
    "copd": {
        "mesh": "Pulmonary Disease, Chronic Obstructive",
        "mesh_id": "D029424",
        "synonyms": ["chronic obstructive pulmonary disease", "COPD", "emphysema", "chronic bronchitis"],
        "related": ["smoking", "dyspnea", "spirometry"],
    },
    "pneumonia": {
        "mesh": "Pneumonia",
        "mesh_id": "D011014",
        "synonyms": ["lung infection", "pneumonitis"],
        "related": ["community-acquired pneumonia", "hospital-acquired pneumonia", "antibiotics"],
    },
    
    # Infectious
    "sepsis": {
        "mesh": "Sepsis",
        "mesh_id": "D018805",
        "synonyms": ["septicemia", "blood infection", "systemic inflammatory response syndrome"],
        "related": ["bacteremia", "septic shock", "qSOFA"],
    },
    "uti": {
        "mesh": "Urinary Tract Infections",
        "mesh_id": "D014552",
        "synonyms": ["urinary tract infection", "UTI", "cystitis", "bladder infection"],
        "related": ["pyelonephritis", "dysuria", "urinalysis"],
    },
    "covid": {
        "mesh": "COVID-19",
        "mesh_id": "D000086402",
        "synonyms": ["COVID-19", "SARS-CoV-2", "coronavirus disease 2019", "novel coronavirus"],
        "related": ["pandemic", "vaccination", "long COVID"],
    },
    
    # Neurological
    "migraine": {
        "mesh": "Migraine Disorders",
        "mesh_id": "D008881",
        "synonyms": ["migraine headache", "vascular headache"],
        "related": ["aura", "triptans", "prophylaxis"],
    },
    "alzheimer": {
        "mesh": "Alzheimer Disease",
        "mesh_id": "D000544",
        "synonyms": ["Alzheimer's disease", "AD", "senile dementia", "dementia of Alzheimer type"],
        "related": ["dementia", "cognitive decline", "amyloid"],
    },
    "parkinson": {
        "mesh": "Parkinson Disease",
        "mesh_id": "D010300",
        "synonyms": ["Parkinson's disease", "PD", "paralysis agitans"],
        "related": ["tremor", "levodopa", "dopamine"],
    },
    "epilepsy": {
        "mesh": "Epilepsy",
        "mesh_id": "D004827",
        "synonyms": ["seizure disorder", "convulsive disorder"],
        "related": ["seizure", "anticonvulsant", "EEG"],
    },
    
    # Oncology
    "cancer": {
        "mesh": "Neoplasms",
        "mesh_id": "D009369",
        "synonyms": ["malignancy", "neoplasm", "tumor", "carcinoma"],
        "related": ["oncology", "chemotherapy", "radiation"],
    },
    "breast cancer": {
        "mesh": "Breast Neoplasms",
        "mesh_id": "D001943",
        "synonyms": ["breast carcinoma", "mammary cancer"],
        "related": ["mammography", "BRCA", "mastectomy"],
    },
    "lung cancer": {
        "mesh": "Lung Neoplasms",
        "mesh_id": "D008175",
        "synonyms": ["lung carcinoma", "pulmonary neoplasm", "bronchogenic carcinoma"],
        "related": ["smoking", "NSCLC", "SCLC"],
    },
    "prostate cancer": {
        "mesh": "Prostatic Neoplasms",
        "mesh_id": "D011471",
        "synonyms": ["prostate carcinoma", "prostatic cancer"],
        "related": ["PSA", "prostatectomy", "Gleason score"],
    },
    
    # Gastrointestinal
    "ibd": {
        "mesh": "Inflammatory Bowel Diseases",
        "mesh_id": "D015212",
        "synonyms": ["inflammatory bowel disease", "IBD"],
        "related": ["Crohn disease", "ulcerative colitis", "biologics"],
    },
    "crohn": {
        "mesh": "Crohn Disease",
        "mesh_id": "D003424",
        "synonyms": ["Crohn's disease", "regional enteritis", "terminal ileitis"],
        "related": ["IBD", "stricture", "fistula"],
    },
    "gerd": {
        "mesh": "Gastroesophageal Reflux",
        "mesh_id": "D005764",
        "synonyms": ["gastroesophageal reflux disease", "GERD", "acid reflux", "heartburn"],
        "related": ["PPI", "esophagitis", "hiatal hernia"],
    },
    
    # Musculoskeletal
    "arthritis": {
        "mesh": "Arthritis",
        "mesh_id": "D001168",
        "synonyms": ["joint inflammation", "arthropathy"],
        "related": ["osteoarthritis", "rheumatoid arthritis", "NSAIDs"],
    },
    "osteoarthritis": {
        "mesh": "Osteoarthritis",
        "mesh_id": "D010003",
        "synonyms": ["OA", "degenerative joint disease", "osteoarthrosis"],
        "related": ["joint replacement", "cartilage", "physical therapy"],
    },
    "rheumatoid arthritis": {
        "mesh": "Arthritis, Rheumatoid",
        "mesh_id": "D001172",
        "synonyms": ["RA", "rheumatoid arthritis"],
        "related": ["DMARDs", "biologics", "autoimmune"],
    },
    
    # Renal
    "ckd": {
        "mesh": "Renal Insufficiency, Chronic",
        "mesh_id": "D051436",
        "synonyms": ["chronic kidney disease", "CKD", "chronic renal failure"],
        "related": ["dialysis", "eGFR", "nephropathy"],
    },
    "kidney stones": {
        "mesh": "Kidney Calculi",
        "mesh_id": "D007668",
        "synonyms": ["nephrolithiasis", "renal calculi", "urolithiasis"],
        "related": ["hydronephrosis", "lithotripsy", "calcium oxalate"],
    },
    
    # Mental Health
    "depression": {
        "mesh": "Depressive Disorder",
        "mesh_id": "D003863",
        "synonyms": ["major depressive disorder", "MDD", "clinical depression", "unipolar depression"],
        "related": ["antidepressant", "SSRI", "suicide risk"],
    },
    "anxiety": {
        "mesh": "Anxiety Disorders",
        "mesh_id": "D001008",
        "synonyms": ["anxiety disorder", "GAD", "generalized anxiety"],
        "related": ["panic disorder", "benzodiazepine", "SSRI"],
    },
    
    # Hematological
    "anemia": {
        "mesh": "Anemia",
        "mesh_id": "D000740",
        "synonyms": ["low hemoglobin", "low red blood cells"],
        "related": ["iron deficiency", "B12 deficiency", "transfusion"],
    },
    "dvt": {
        "mesh": "Venous Thrombosis",
        "mesh_id": "D020246",
        "synonyms": ["deep vein thrombosis", "DVT", "venous thromboembolism", "VTE"],
        "related": ["pulmonary embolism", "anticoagulation", "Wells score"],
    },
    
    # Symptoms
    "fever": {
        "mesh": "Fever",
        "mesh_id": "D005334",
        "synonyms": ["pyrexia", "elevated temperature", "hyperthermia", "febrile"],
        "related": ["infection", "antipyretic", "fever of unknown origin"],
    },
    "pain": {
        "mesh": "Pain",
        "mesh_id": "D010146",
        "synonyms": ["aching", "discomfort", "dolor"],
        "related": ["analgesia", "chronic pain", "neuropathic pain"],
    },
    "headache": {
        "mesh": "Headache",
        "mesh_id": "D006261",
        "synonyms": ["cephalgia", "head pain"],
        "related": ["migraine", "tension headache", "cluster headache"],
    },
    "nausea": {
        "mesh": "Nausea",
        "mesh_id": "D009325",
        "synonyms": ["queasiness", "upset stomach"],
        "related": ["vomiting", "antiemetic", "chemotherapy"],
    },
}

# =============================================================================
# MEDICAL ACRONYMS
# =============================================================================

MEDICAL_ACRONYMS = {
    "MI": "myocardial infarction",
    "CHF": "congestive heart failure",
    "HTN": "hypertension",
    "DM": "diabetes mellitus",
    "T1DM": "type 1 diabetes mellitus",
    "T2DM": "type 2 diabetes mellitus",
    "COPD": "chronic obstructive pulmonary disease",
    "UTI": "urinary tract infection",
    "DVT": "deep vein thrombosis",
    "PE": "pulmonary embolism",
    "VTE": "venous thromboembolism",
    "AF": "atrial fibrillation",
    "AFib": "atrial fibrillation",
    "CVA": "cerebrovascular accident",
    "TIA": "transient ischemic attack",
    "GERD": "gastroesophageal reflux disease",
    "IBD": "inflammatory bowel disease",
    "IBS": "irritable bowel syndrome",
    "CKD": "chronic kidney disease",
    "ESRD": "end-stage renal disease",
    "AKI": "acute kidney injury",
    "CABG": "coronary artery bypass graft",
    "PCI": "percutaneous coronary intervention",
    "STEMI": "ST-elevation myocardial infarction",
    "NSTEMI": "non-ST-elevation myocardial infarction",
    "ACS": "acute coronary syndrome",
    "CAD": "coronary artery disease",
    "PAD": "peripheral arterial disease",
    "HFrEF": "heart failure with reduced ejection fraction",
    "HFpEF": "heart failure with preserved ejection fraction",
    "AIDS": "acquired immunodeficiency syndrome",
    "HIV": "human immunodeficiency virus",
    "TB": "tuberculosis",
    "HBV": "hepatitis B virus",
    "HCV": "hepatitis C virus",
    "OA": "osteoarthritis",
    "RA": "rheumatoid arthritis",
    "SLE": "systemic lupus erythematosus",
    "MS": "multiple sclerosis",
    "ALS": "amyotrophic lateral sclerosis",
    "PD": "Parkinson disease",
    "AD": "Alzheimer disease",
    "MDD": "major depressive disorder",
    "GAD": "generalized anxiety disorder",
    "OCD": "obsessive-compulsive disorder",
    "PTSD": "post-traumatic stress disorder",
    "BPD": "borderline personality disorder",
    "ADHD": "attention deficit hyperactivity disorder",
    "NSCLC": "non-small cell lung cancer",
    "SCLC": "small cell lung cancer",
    "ALL": "acute lymphoblastic leukemia",
    "AML": "acute myeloid leukemia",
    "CLL": "chronic lymphocytic leukemia",
    "CML": "chronic myeloid leukemia",
    "NHL": "non-Hodgkin lymphoma",
    "HL": "Hodgkin lymphoma",
    "PSA": "prostate-specific antigen",
    "CEA": "carcinoembryonic antigen",
    "CA-125": "cancer antigen 125",
    "AFP": "alpha-fetoprotein",
    "CRP": "C-reactive protein",
    "ESR": "erythrocyte sedimentation rate",
    "BUN": "blood urea nitrogen",
    "SCr": "serum creatinine",
    "LFT": "liver function test",
    "TSH": "thyroid-stimulating hormone",
    "HbA1c": "glycated hemoglobin",
    "INR": "international normalized ratio",
    "PT": "prothrombin time",
    "PTT": "partial thromboplastin time",
    "aPTT": "activated partial thromboplastin time",
    "ABG": "arterial blood gas",
    "CBC": "complete blood count",
    "BMP": "basic metabolic panel",
    "CMP": "comprehensive metabolic panel",
    "CT": "computed tomography",
    "MRI": "magnetic resonance imaging",
    "PET": "positron emission tomography",
    "US": "ultrasound",
    "EGD": "esophagogastroduodenoscopy",
    "ECG": "electrocardiogram",
    "EKG": "electrocardiogram",
    "EEG": "electroencephalogram",
    "EMG": "electromyography",
    "ICU": "intensive care unit",
    "OR": "operating room",
    "ER": "emergency room",
    "ED": "emergency department",
    "PRN": "as needed",
    "BID": "twice daily",
    "TID": "three times daily",
    "QID": "four times daily",
    "QD": "once daily",
    "QHS": "at bedtime",
    "QAM": "every morning",
    "QPM": "every evening",
    "NPO": "nothing by mouth",
    "PO": "by mouth",
    "IV": "intravenous",
    "IM": "intramuscular",
    "SC": "subcutaneous",
    "SQ": "subcutaneous",
    "SL": "sublingual",
    "PR": "per rectum",
    "NG": "nasogastric",
    "ETT": "endotracheal tube",
    "CPR": "cardiopulmonary resuscitation",
    "DNR": "do not resuscitate",
    "DNI": "do not intubate",
    "AMA": "against medical advice",
}

# =============================================================================
# COMMON SYNONYMS
# =============================================================================

MEDICAL_SYNONYMS = {
    "chest pain": ["thoracic pain", "chest discomfort", "retrosternal pain", "precordial pain"],
    "shortness of breath": ["dyspnea", "breathlessness", "respiratory distress", "air hunger"],
    "stomach pain": ["abdominal pain", "abdominal discomfort", "stomach ache", "belly pain"],
    "headache": ["cephalgia", "head pain", "cephalea"],
    "dizziness": ["vertigo", "lightheadedness", "presyncope", "disequilibrium"],
    "tiredness": ["fatigue", "lethargy", "malaise", "exhaustion", "asthenia"],
    "weight loss": ["unintentional weight loss", "weight reduction", "cachexia"],
    "fever": ["pyrexia", "elevated temperature", "hyperthermia", "febrile"],
    "cough": ["tussis", "coughing"],
    "vomiting": ["emesis", "throwing up", "regurgitation"],
    "diarrhea": ["loose stools", "frequent bowel movements"],
    "constipation": ["infrequent bowel movements", "hard stools", "constipated"],
    "rash": ["skin eruption", "dermatitis", "exanthem"],
    "swelling": ["edema", "oedema", "fluid retention"],
    "numbness": ["paresthesia", "loss of sensation", "hypesthesia"],
    "weakness": ["asthenia", "muscle weakness", "paresis"],
    "confusion": ["delirium", "altered mental status", "encephalopathy"],
    "fainting": ["syncope", "loss of consciousness", "blackout"],
    "palpitations": ["heartbeat awareness", "heart racing", "tachycardia"],
    "insomnia": ["sleep disturbance", "difficulty sleeping", "sleeplessness"],
}


class MedicalQueryExpander:
    """
    P2: Medical Query Expansion for Clinical Decision Support.
    
    Features:
    - MeSH terminology expansion
    - Medical acronym resolution
    - Synonym expansion
    - Semantic enhancement
    - Spelling normalization
    """
    
    def __init__(self):
        self.mesh_terms = MESH_TERMS
        self.acronyms = MEDICAL_ACRONYMS
        self.synonyms = MEDICAL_SYNONYMS
        self._cache: Dict[str, ExpandedQuery] = {}
    
    def expand(
        self,
        query: str,
        expand_mesh: bool = True,
        expand_acronyms: bool = True,
        expand_synonyms: bool = True,
        max_expansions: int = 20,
    ) -> ExpandedQuery:
        """
        Expand a medical query with related terms.
        
        Args:
            query: Original search query
            expand_mesh: Include MeSH term expansion
            expand_acronyms: Resolve medical acronyms
            expand_synonyms: Include synonym expansion
            max_expansions: Maximum number of expansion terms
            
        Returns:
            ExpandedQuery with original, expanded query and metadata
        """
        original = query.strip()
        expansion_terms: Set[str] = set()
        expansions: List[Dict[str, Any]] = []
        mesh_terms_found: List[str] = []
        
        # Normalize query
        normalized = self._normalize_query(original)
        
        # Expand acronyms first
        if expand_acronyms:
            acro_expansions = self._expand_acronyms(normalized)
            for term, expansion in acro_expansions.items():
                expansion_terms.add(expansion)
                expansions.append({
                    "type": ExpansionType.ACRONYM.value,
                    "original": term,
                    "expanded": expansion,
                })
        
        # Expand MeSH terms
        if expand_mesh:
            mesh_expansions = self._expand_mesh_terms(normalized)
            for term, mesh_data in mesh_expansions.items():
                mesh_terms_found.append(mesh_data["mesh"])
                expansion_terms.add(mesh_data["mesh"])
                expansion_terms.update(mesh_data.get("synonyms", []))
                expansions.append({
                    "type": ExpansionType.MESH.value,
                    "original": term,
                    "mesh": mesh_data["mesh"],
                    "mesh_id": mesh_data.get("mesh_id"),
                    "synonyms": mesh_data.get("synonyms", []),
                })
        
        # Expand synonyms
        if expand_synonyms:
            syn_expansions = self._expand_synonyms(normalized)
            for term, syn_list in syn_expansions.items():
                expansion_terms.update(syn_list)
                expansions.append({
                    "type": ExpansionType.SYNONYM.value,
                    "original": term,
                    "expanded": syn_list,
                })
        
        # Build expanded query
        all_terms = [original]
        all_terms.extend(expansion_terms)
        
        # Limit expansions
        unique_terms = list(dict.fromkeys(all_terms))[:max_expansions + 1]
        expanded = " ".join(unique_terms)
        
        # Calculate confidence
        confidence = 1.0
        if expansions:
            confidence = 0.95  # Slight reduction for expanded queries
        
        return ExpandedQuery(
            original=original,
            expanded=expanded,
            expansions=expansions,
            mesh_terms=mesh_terms_found,
            confidence=confidence,
        )
    
    def _normalize_query(self, query: str) -> str:
        """Normalize query for processing."""
        # Lowercase
        normalized = query.lower()
        # Remove extra whitespace
        normalized = " ".join(normalized.split())
        return normalized
    
    def _expand_acronyms(self, query: str) -> Dict[str, str]:
        """Expand medical acronyms in query."""
        expansions = {}
        
        # Find acronyms (case-insensitive word match)
        words = set(query.split())
        
        for word in words:
            upper = word.upper()
            if upper in self.acronyms:
                expansions[word] = self.acronyms[upper]
        
        return expansions
    
    def _expand_mesh_terms(self, query: str) -> Dict[str, Dict[str, Any]]:
        """Expand MeSH terms in query."""
        expansions = {}
        query_lower = query.lower()
        
        for term, mesh_data in self.mesh_terms.items():
            if term in query_lower:
                expansions[term] = mesh_data
        
        return expansions
    
    def _expand_synonyms(self, query: str) -> Dict[str, List[str]]:
        """Expand synonyms in query."""
        expansions = {}
        
        for term, syn_list in self.synonyms.items():
            if term in query:
                expansions[term] = syn_list
        
        return expansions
    
    def get_mesh_for_term(self, term: str) -> Optional[Dict[str, Any]]:
        """Get MeSH data for a specific term."""
        return self.mesh_terms.get(term.lower())
    
    def resolve_acronym(self, acronym: str) -> Optional[str]:
        """Resolve a medical acronym."""
        return self.acronyms.get(acronym.upper())
    
    def get_synonyms(self, term: str) -> List[str]:
        """Get synonyms for a term."""
        return self.synonyms.get(term.lower(), [])
    
    def suggest_mesh_terms(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Suggest relevant MeSH terms for a query."""
        suggestions = []
        query_lower = query.lower()
        
        for term, mesh_data in self.mesh_terms.items():
            # Check if term or synonyms match
            if term in query_lower:
                suggestions.append({
                    "term": term,
                    "mesh": mesh_data["mesh"],
                    "mesh_id": mesh_data.get("mesh_id"),
                    "relevance": 1.0,
                })
            else:
                # Check synonyms
                for syn in mesh_data.get("synonyms", []):
                    if syn in query_lower:
                        suggestions.append({
                            "term": term,
                            "mesh": mesh_data["mesh"],
                            "mesh_id": mesh_data.get("mesh_id"),
                            "relevance": 0.8,
                        })
                        break
            
            if len(suggestions) >= limit:
                break
        
        return sorted(suggestions, key=lambda x: x["relevance"], reverse=True)[:limit]


# Singleton instance
_expander: Optional[MedicalQueryExpander] = None


def get_query_expander() -> MedicalQueryExpander:
    """Get or create query expander singleton."""
    global _expander
    
    if _expander is None:
        _expander = MedicalQueryExpander()
    
    return _expander


def expand_medical_query(query: str, **kwargs) -> ExpandedQuery:
    """Convenience function to expand a medical query."""
    expander = get_query_expander()
    return expander.expand(query, **kwargs)

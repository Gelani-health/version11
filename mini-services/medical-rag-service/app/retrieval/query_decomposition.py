"""
P1: Query Decomposition for Medical RAG
=======================================

Decomposes complex medical queries into simpler sub-queries for better retrieval.

Architecture Context:
- Medical RAG (Port 3031): PRIMARY diagnostic engine - gets query decomposition
- LangChain RAG (Port 3032): SECONDARY with fallback chain - not needed (has own fallback)

Decomposition Strategies:
1. Symptom-based: Split by multiple symptoms
2. Condition-based: Split by multiple conditions
3. Treatment-based: Split by treatment options
4. Comparison-based: Split comparison queries
"""

import re
from typing import List, Optional, Tuple
from dataclasses import dataclass, field
from loguru import logger


# =============================================================================
# PATTERNS FOR DECOMPOSITION
# =============================================================================

# Connective patterns for splitting queries
CONNECTIVE_PATTERNS = {
    # Symptom connectors
    "and": r'\s+and\s+',
    "versus": r'\s+vs\.?\s+|\s+versus\s+',
    "compared_to": r'\s+compared\s+to\s+|\s+in\s+comparison\s+to\s+',
    "or": r'\s+or\s+',
    
    # List separators
    "comma": r',\s*(?=\w)',
    "semicolon": r';\s*(?=\w)',
    
    # Temporal patterns
    "then": r'\s+then\s+',
    "followed_by": r'\s+followed\s+by\s+',
    
    # Causal patterns
    "because": r'\s+because\s+',
    "due_to": r'\s+due\s+to\s+',
    "caused_by": r'\s+caused\s+by\s+',
}

# Complex query patterns
COMPLEX_PATTERNS = {
    # Differential diagnosis patterns
    "differential": [
        r'differential\s+diagnosis\s+for\s+(.+)',
        r'ddx\s+for\s+(.+)',
        r'what\s+could\s+cause\s+(.+)',
    ],
    
    # Comparison patterns
    "comparison": [
        r'difference\s+between\s+(.+?)\s+and\s+(.+)',
        r'compare\s+(.+?)\s+(?:and|vs|versus)\s+(.+)',
        r'(.+?)\s+vs\.?\s+(.+)',
    ],
    
    # Multi-condition patterns
    "multi_condition": [
        r'(.+?)\s+and\s+(.+?)\s+(?:patient|case|treatment)',
        r'patient\s+with\s+(.+?)\s+and\s+(.+)',
    ],
    
    # Treatment patterns
    "treatment": [
        r'treatment\s+(?:options|approach)\s+for\s+(.+)',
        r'how\s+to\s+treat\s+(.+)',
        r'management\s+of\s+(.+)',
    ],
}

# Medical symptom clusters (for splitting symptom lists)
SYMPTOM_CLUSTERS = {
    "cardiac": ["chest pain", "palpitations", "shortness of breath", "edema", "fatigue"],
    "respiratory": ["cough", "wheezing", "dyspnea", "sputum", "hemoptysis"],
    "neurological": ["headache", "dizziness", "numbness", "weakness", "confusion"],
    "gastrointestinal": ["nausea", "vomiting", "diarrhea", "abdominal pain", "constipation"],
    "constitutional": ["fever", "weight loss", "night sweats", "fatigue", "malaise"],
}


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class SubQuery:
    """A decomposed sub-query."""
    query: str
    query_type: str
    original_position: int = 0
    related_to: List[int] = field(default_factory=list)
    
    def to_dict(self):
        return {
            "query": self.query,
            "query_type": self.query_type,
            "original_position": self.original_position,
            "related_to": self.related_to,
        }


@dataclass
class DecompositionResult:
    """Result of query decomposition."""
    original_query: str
    is_complex: bool
    decomposition_type: str
    sub_queries: List[SubQuery]
    reasoning: str
    
    def to_dict(self):
        return {
            "original_query": self.original_query,
            "is_complex": self.is_complex,
            "decomposition_type": self.decomposition_type,
            "sub_queries": [sq.to_dict() for sq in self.sub_queries],
            "reasoning": self.reasoning,
        }


# =============================================================================
# QUERY DECOMPOSER
# =============================================================================

class QueryDecomposer:
    """
    Decomposes complex medical queries into simpler sub-queries.
    
    Strategies:
    1. Connective-based: Split by 'and', 'vs', 'or'
    2. Pattern-based: Match known complex query patterns
    3. Symptom-based: Split symptom lists
    """
    
    def __init__(
        self,
        min_subquery_length: int = 3,
        max_subqueries: int = 5,
    ):
        self.min_subquery_length = min_subquery_length
        self.max_subqueries = max_subqueries
        
        self.stats = {
            "total_queries": 0,
            "complex_queries": 0,
            "simple_queries": 0,
            "subqueries_generated": 0,
        }
    
    def decompose(self, query: str) -> DecompositionResult:
        """
        Decompose a query if it's complex.
        
        Args:
            query: The query to decompose
        
        Returns:
            DecompositionResult with original and sub-queries
        """
        self.stats["total_queries"] += 1
        
        # Check if query is complex
        is_complex, decomp_type = self._is_complex_query(query)
        
        if not is_complex:
            self.stats["simple_queries"] += 1
            return DecompositionResult(
                original_query=query,
                is_complex=False,
                decomposition_type="none",
                sub_queries=[SubQuery(query=query, query_type="simple")],
                reasoning="Query is simple and does not require decomposition.",
            )
        
        self.stats["complex_queries"] += 1
        
        # Try different decomposition strategies
        sub_queries = []
        reasoning = ""
        
        # Strategy 1: Pattern-based decomposition
        sub_queries, reasoning = self._pattern_decompose(query)
        if sub_queries:
            decomp_type = "pattern_based"
        
        # Strategy 2: Connective-based decomposition
        if not sub_queries:
            sub_queries, reasoning = self._connective_decompose(query)
            if sub_queries:
                decomp_type = "connective_based"
        
        # Strategy 3: Symptom-based decomposition
        if not sub_queries:
            sub_queries, reasoning = self._symptom_decompose(query)
            if sub_queries:
                decomp_type = "symptom_based"
        
        # Limit sub-queries
        sub_queries = sub_queries[:self.max_subqueries]
        
        # Update stats
        self.stats["subqueries_generated"] += len(sub_queries)
        
        return DecompositionResult(
            original_query=query,
            is_complex=True,
            decomposition_type=decomp_type,
            sub_queries=sub_queries,
            reasoning=reasoning,
        )
    
    def _is_complex_query(self, query: str) -> Tuple[bool, str]:
        """
        Determine if a query is complex.
        
        Returns:
            (is_complex, complexity_type)
        """
        query_lower = query.lower()
        
        # Check for multiple conditions/symptoms
        and_count = len(re.findall(CONNECTIVE_PATTERNS["and"], query_lower))
        if and_count >= 2:
            return True, "multiple_conditions"
        
        # Check for comparison
        if re.search(CONNECTIVE_PATTERNS["versus"], query_lower):
            return True, "comparison"
        
        # Check for differential diagnosis
        if "differential" in query_lower or "ddx" in query_lower:
            return True, "differential_diagnosis"
        
        # Check for complex patterns
        for pattern_type, patterns in COMPLEX_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    return True, pattern_type
        
        # Check for symptom clusters
        symptom_count = 0
        for cluster in SYMPTOM_CLUSTERS.values():
            for symptom in cluster:
                if symptom in query_lower:
                    symptom_count += 1
        
        if symptom_count >= 3:
            return True, "multiple_symptoms"
        
        return False, "simple"
    
    def _pattern_decompose(self, query: str) -> Tuple[List[SubQuery], str]:
        """Decompose using pattern matching."""
        query_lower = query.lower()
        sub_queries = []
        
        # Check comparison patterns
        for pattern in COMPLEX_PATTERNS.get("comparison", []):
            match = re.search(pattern, query_lower)
            if match:
                groups = match.groups()
                if len(groups) >= 2:
                    sub_queries.append(SubQuery(
                        query=groups[0].strip(),
                        query_type="comparison_subject_1",
                        original_position=0,
                    ))
                    sub_queries.append(SubQuery(
                        query=groups[1].strip(),
                        query_type="comparison_subject_2",
                        original_position=1,
                        related_to=[0],
                    ))
                    return sub_queries, "Decomposed comparison query into two subjects."
        
        # Check differential diagnosis patterns
        for pattern in COMPLEX_PATTERNS.get("differential", []):
            match = re.search(pattern, query_lower)
            if match:
                condition = match.group(1)
                # Generate common differential queries
                sub_queries.append(SubQuery(
                    query=f"causes of {condition}",
                    query_type="etiology",
                    original_position=0,
                ))
                sub_queries.append(SubQuery(
                    query=f"diagnosis of {condition}",
                    query_type="diagnosis",
                    original_position=1,
                ))
                return sub_queries, "Decomposed differential diagnosis query."
        
        return [], ""
    
    def _connective_decompose(self, query: str) -> Tuple[List[SubQuery], str]:
        """Decompose by splitting on connectives."""
        sub_queries = []
        
        # Try splitting by 'and'
        parts = re.split(CONNECTIVE_PATTERNS["and"], query, maxsplit=2)
        if len(parts) > 1:
            for i, part in enumerate(parts[:self.max_subqueries]):
                if len(part.strip()) >= self.min_subquery_length:
                    sub_queries.append(SubQuery(
                        query=part.strip(),
                        query_type="conjunction_part",
                        original_position=i,
                        related_to=[j for j in range(len(parts)) if j != i],
                    ))
            return sub_queries, "Decomposed query by conjunction 'and'."
        
        # Try splitting by 'vs' / 'versus'
        parts = re.split(CONNECTIVE_PATTERNS["versus"], query)
        if len(parts) > 1:
            for i, part in enumerate(parts[:self.max_subqueries]):
                if len(part.strip()) >= self.min_subquery_length:
                    sub_queries.append(SubQuery(
                        query=part.strip(),
                        query_type="comparison_part",
                        original_position=i,
                        related_to=[j for j in range(len(parts)) if j != i],
                    ))
            return sub_queries, "Decomposed query by comparison 'vs/versus'."
        
        # Try splitting by comma
        parts = re.split(CONNECTIVE_PATTERNS["comma"], query)
        if len(parts) > 2:  # Only if more than 2 parts
            for i, part in enumerate(parts[:self.max_subqueries]):
                if len(part.strip()) >= self.min_subquery_length:
                    sub_queries.append(SubQuery(
                        query=part.strip(),
                        query_type="list_item",
                        original_position=i,
                    ))
            if sub_queries:
                return sub_queries, "Decomposed query by list separation."
        
        return [], ""
    
    def _symptom_decompose(self, query: str) -> Tuple[List[SubQuery], str]:
        """Decompose by identifying symptom clusters."""
        query_lower = query.lower()
        sub_queries = []
        
        # Find all symptoms in query
        found_symptoms = []
        for cluster_name, symptoms in SYMPTOM_CLUSTERS.items():
            for symptom in symptoms:
                if symptom in query_lower:
                    found_symptoms.append((symptom, cluster_name))
        
        if len(found_symptoms) >= 2:
            # Create a sub-query for each symptom
            for i, (symptom, cluster) in enumerate(found_symptoms[:self.max_subqueries]):
                sub_queries.append(SubQuery(
                    query=f"{symptom} causes and treatment",
                    query_type=f"{cluster}_symptom",
                    original_position=i,
                ))
            return sub_queries, f"Decomposed query into {len(sub_queries)} symptom-based queries."
        
        return [], ""
    
    def get_stats(self) -> dict:
        """Get decomposer statistics."""
        return self.stats


# =============================================================================
# SINGLETON INSTANCE
# =============================================================================

_query_decomposer: Optional[QueryDecomposer] = None


def get_query_decomposer() -> QueryDecomposer:
    """Get or create query decomposer singleton."""
    global _query_decomposer
    
    if _query_decomposer is None:
        _query_decomposer = QueryDecomposer()
    
    return _query_decomposer

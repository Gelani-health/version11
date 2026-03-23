"""
P2: Clinical Intelligence Integration Service
==============================================

Main service that integrates Clinical Guidelines, UMLS/SNOMED Terminology,
and Knowledge Graph for comprehensive clinical decision support.

This service provides:
- Unified clinical intelligence queries
- Guideline-based recommendations with patient context
- Terminology normalization and mapping
- Knowledge graph-based clinical reasoning
- Drug interaction detection
- Differential diagnosis support
"""

import time
from typing import Optional, List, Dict, Any
from loguru import logger

from .clinical_context import (
    ClinicalContext,
    ClinicalQueryResult,
    GuidelineRecommendation,
    TerminologyMatch,
    KnowledgeGraphResult,
)


class P2IntegrationService:
    """
    P2: Clinical Intelligence Integration Service.
    
    Provides unified access to:
    - Clinical guidelines (AHA/ACC, ESC, NCCN, IDSA, etc.)
    - UMLS/SNOMED terminology services
    - Medical knowledge graph
    """
    
    def __init__(self):
        self._guideline_engine = None
        self._terminology_engine = None
        self._knowledge_graph = None
        self._initialized = False
        
        self.stats = {
            "total_queries": 0,
            "terminology_queries": 0,
            "guideline_queries": 0,
            "graph_queries": 0,
            "avg_processing_time_ms": 0.0,
        }
    
    def initialize(self):
        """Initialize all P2 components."""
        if self._initialized:
            return
        
        start_time = time.time()
        
        # Import and initialize components
        try:
            from app.guidelines.clinical_guidelines import get_guideline_engine
            self._guideline_engine = get_guideline_engine()
            logger.info("[P2] Clinical Guidelines engine initialized")
        except Exception as e:
            logger.warning(f"[P2] Failed to initialize Clinical Guidelines: {e}")
        
        try:
            from app.terminology.umls_snomed import get_terminology_engine
            self._terminology_engine = get_terminology_engine()
            logger.info("[P2] UMLS/SNOMED Terminology engine initialized")
        except Exception as e:
            logger.warning(f"[P2] Failed to initialize Terminology: {e}")
        
        try:
            from app.knowledge.knowledge_graph import get_knowledge_graph
            self._knowledge_graph = get_knowledge_graph()
            logger.info("[P2] Knowledge Graph initialized")
        except Exception as e:
            logger.warning(f"[P2] Failed to initialize Knowledge Graph: {e}")
        
        self._initialized = True
        latency = (time.time() - start_time) * 1000
        logger.info(f"[P2] Integration service initialized in {latency:.2f}ms")
    
    async def query_clinical_intelligence(
        self,
        query: str,
        patient_context: Optional[ClinicalContext] = None,
        include_guidelines: bool = True,
        include_terminology: bool = True,
        include_knowledge_graph: bool = True,
    ) -> ClinicalQueryResult:
        """
        Comprehensive clinical intelligence query.
        
        Queries all three P2 components and combines results:
        1. Terminology normalization (UMLS/SNOMED)
        2. Clinical guideline matching
        3. Knowledge graph insights
        
        Args:
            query: Clinical query text
            patient_context: Optional patient context for personalization
            include_guidelines: Whether to include guideline recommendations
            include_terminology: Whether to include terminology matching
            include_knowledge_graph: Whether to include knowledge graph insights
        
        Returns:
            ClinicalQueryResult with combined insights
        """
        if not self._initialized:
            self.initialize()
        
        start_time = time.time()
        result = ClinicalQueryResult(query=query)
        
        # 1. Terminology matching
        if include_terminology and self._terminology_engine:
            result.terminology_matches = self._query_terminology(query)
            self.stats["terminology_queries"] += 1
        
        # 2. Guideline recommendations
        if include_guidelines and self._guideline_engine:
            result.guideline_recommendations = self._query_guidelines(
                query, patient_context
            )
            self.stats["guideline_queries"] += 1
        
        # 3. Knowledge graph insights
        if include_knowledge_graph and self._knowledge_graph:
            result.knowledge_graph = self._query_knowledge_graph(query)
            self.stats["graph_queries"] += 1
        
        # 4. Generate combined insights
        self._generate_combined_insights(result, patient_context)
        
        # Update stats
        result.processing_time_ms = (time.time() - start_time) * 1000
        self.stats["total_queries"] += 1
        
        return result
    
    def _query_terminology(self, query: str) -> List[TerminologyMatch]:
        """Query UMLS/SNOMED terminology for concept matching."""
        matches = []
        
        try:
            # Search for concepts
            concepts = self._terminology_engine.search_concepts(query, top_k=5)
            
            for concept in concepts:
                match = TerminologyMatch(
                    term=query,
                    cui=concept.cui,
                    preferred_name=concept.name,
                    semantic_types=[st.value for st in concept.semantic_types],
                    codes=concept.codes,
                    confidence=concept.score,
                )
                matches.append(match)
        
        except Exception as e:
            logger.error(f"[P2] Terminology query error: {e}")
        
        return matches
    
    def _query_guidelines(
        self,
        query: str,
        patient_context: Optional[ClinicalContext] = None,
    ) -> List[GuidelineRecommendation]:
        """Query clinical guidelines for relevant recommendations."""
        recommendations = []
        
        try:
            # Get matching guidelines
            matches = self._guideline_engine.match_guidelines(query)
            
            for match in matches[:5]:  # Top 5 guidelines
                guideline = match.guideline
                
                for rec in match.relevant_recommendations[:3]:  # Top 3 recs per guideline
                    # Calculate applicability
                    applicability = 1.0
                    conditions_met = []
                    conditions_missing = []
                    contraindications = []
                    
                    if patient_context:
                        applicability = rec.applicability_score(patient_context.to_dict())
                        
                        # Check conditions
                        for condition in rec.conditions:
                            if patient_context.has_condition(condition):
                                conditions_met.append(condition)
                            else:
                                conditions_missing.append(condition)
                        
                        # Check contraindications
                        for contra in rec.contraindications:
                            if patient_context.has_condition(contra) or patient_context.is_on_medication(contra):
                                contraindications.append(contra)
                                applicability *= 0.1  # Reduce score significantly
                    
                    recommendation = GuidelineRecommendation(
                        guideline_id=guideline.id,
                        guideline_title=guideline.title,
                        recommendation_id=rec.id,
                        recommendation_text=rec.text,
                        evidence_level=rec.evidence_level.value,
                        strength=rec.strength.value,
                        applicability_score=applicability,
                        conditions_met=conditions_met,
                        conditions_missing=conditions_missing,
                        contraindications=contraindications,
                    )
                    recommendations.append(recommendation)
        
        except Exception as e:
            logger.error(f"[P2] Guideline query error: {e}")
        
        # Sort by applicability
        recommendations.sort(key=lambda r: r.applicability_score, reverse=True)
        return recommendations[:10]  # Top 10
    
    def _query_knowledge_graph(self, query: str) -> Optional[KnowledgeGraphResult]:
        """Query knowledge graph for related concepts and relationships."""
        try:
            # Find relevant node
            node = self._knowledge_graph.find_node_by_name(query)
            
            if not node:
                # Try search
                nodes = self._knowledge_graph.search_nodes(query, top_k=1)
                if nodes:
                    node = nodes[0]
            
            if not node:
                return None
            
            # Extract subgraph
            subgraph = self._knowledge_graph.extract_subgraph(
                node.id, depth=2
            )
            
            # Get treatments if disease
            treatments = []
            if node.node_type.value == "disease":
                treatments = self._knowledge_graph.get_treatments_for_disease(node.name)
            
            # Get related diseases if symptom
            related_diseases = []
            if node.node_type.value == "symptom":
                related_diseases = self._knowledge_graph.get_diseases_for_symptom(node.name)
            
            # Generate clinical insights
            insights = self._generate_graph_insights(
                node, subgraph, treatments, related_diseases
            )
            
            return KnowledgeGraphResult(
                center_concept=node.name,
                related_concepts=[n.to_dict() for n in subgraph.nodes[:10]],
                relationships=[e.to_dict() for e in subgraph.edges[:10]],
                paths=[],  # Can add path finding if needed
                clinical_insights=insights,
            )
        
        except Exception as e:
            logger.error(f"[P2] Knowledge graph query error: {e}")
            return None
    
    def _generate_graph_insights(
        self,
        node,
        subgraph,
        treatments,
        related_diseases,
    ) -> List[str]:
        """Generate clinical insights from knowledge graph results."""
        insights = []
        
        # Treatment insights
        if treatments:
            treatment_names = [t[0].name for t in treatments[:5]]
            insights.append(f"Potential treatments include: {', '.join(treatment_names)}")
        
        # Disease associations
        if related_diseases:
            disease_names = [d[0].name for d in related_diseases[:5]]
            insights.append(f"Associated conditions: {', '.join(disease_names)}")
        
        # Comorbidities
        if node.node_type.value == "disease":
            comorbidities = self._knowledge_graph.get_comorbidities(node.name)
            if comorbidities:
                comorbidity_names = [c[0].name for c in comorbidities[:3]]
                insights.append(f"Common comorbidities: {', '.join(comorbidity_names)}")
        
        return insights
    
    def _generate_combined_insights(
        self,
        result: ClinicalQueryResult,
        patient_context: Optional[ClinicalContext] = None,
    ):
        """Generate combined clinical insights from all P2 components."""
        insights = []
        
        # Build clinical summary
        summary_parts = []
        
        if result.terminology_matches:
            top_match = result.terminology_matches[0]
            summary_parts.append(
                f"Identified concept: {top_match.preferred_name} (CUI: {top_match.cui})"
            )
        
        if result.guideline_recommendations:
            top_rec = result.guideline_recommendations[0]
            summary_parts.append(
                f"Top recommendation ({top_rec.evidence_level}): {top_rec.recommendation_text[:200]}..."
            )
        
        if result.knowledge_graph:
            summary_parts.append(
                f"Related concepts: {len(result.knowledge_graph.related_concepts)} found"
            )
        
        result.clinical_summary = " | ".join(summary_parts) if summary_parts else "No relevant clinical information found."
        
        # Generate differential diagnoses from knowledge graph
        if result.knowledge_graph:
            for insight in result.knowledge_graph.clinical_insights:
                if "Associated conditions" in insight:
                    # Parse diseases from insight
                    result.differential_diagnoses.append({
                        "source": "knowledge_graph",
                        "insight": insight,
                    })
        
        # Generate treatment options
        if result.guideline_recommendations:
            for rec in result.guideline_recommendations:
                if rec.applicability_score > 0.5:
                    result.treatment_options.append({
                        "source": rec.guideline_title,
                        "recommendation": rec.recommendation_text,
                        "strength": rec.strength,
                        "evidence": rec.evidence_level,
                    })
        
        # Calculate overall confidence
        confidence = 0.0
        if result.terminology_matches:
            confidence += result.terminology_matches[0].confidence * 0.3
        if result.guideline_recommendations:
            confidence += result.guideline_recommendations[0].applicability_score * 0.4
        if result.knowledge_graph:
            confidence += 0.3
        
        result.confidence = min(confidence, 1.0)
    
    async def normalize_term(self, term: str) -> Optional[Dict[str, Any]]:
        """
        Normalize a medical term to standard terminology.
        
        Args:
            term: Medical term to normalize
        
        Returns:
            Normalized concept with CUI and codes
        """
        if not self._initialized:
            self.initialize()
        
        if not self._terminology_engine:
            return None
        
        try:
            concept = self._terminology_engine.lookup_concept(term)
            if concept:
                return concept.to_dict()
        except Exception as e:
            logger.error(f"[P2] Term normalization error: {e}")
        
        return None
    
    async def get_drug_interactions(
        self,
        medications: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Check for drug-drug interactions using knowledge graph.
        
        Args:
            medications: List of medication names
        
        Returns:
            List of potential interactions
        """
        if not self._initialized:
            self.initialize()
        
        interactions = []
        
        if not self._knowledge_graph:
            return interactions
        
        try:
            for med in medications:
                drug_interactions = self._knowledge_graph.get_drug_interactions(med)
                for drug_node, edge in drug_interactions:
                    # Check if interacting drug is in medication list
                    interacting_drug = drug_node.name
                    if any(
                        interacting_drug.lower() in m.lower() or m.lower() in interacting_drug.lower()
                        for m in medications
                    ):
                        interactions.append({
                            "drug_1": med,
                            "drug_2": interacting_drug,
                            "relationship": edge.relation_type.value,
                            "confidence": edge.confidence,
                        })
        except Exception as e:
            logger.error(f"[P2] Drug interaction check error: {e}")
        
        return interactions
    
    async def get_clinical_pathway(
        self,
        condition: str,
        patient_context: Optional[ClinicalContext] = None,
    ) -> Dict[str, Any]:
        """
        Get clinical pathway for a condition.
        
        Combines guideline recommendations with knowledge graph
        treatment relationships.
        
        Args:
            condition: Medical condition name
            patient_context: Optional patient context
        
        Returns:
            Clinical pathway with recommendations
        """
        if not self._initialized:
            self.initialize()
        
        pathway = {
            "condition": condition,
            "guideline_recommendations": [],
            "treatment_options": [],
            "diagnostic_steps": [],
            "monitoring": [],
        }
        
        # Get guideline recommendations
        if self._guideline_engine:
            matches = self._guideline_engine.match_guidelines(condition)
            for match in matches[:2]:
                for rec in match.relevant_recommendations[:5]:
                    pathway["guideline_recommendations"].append({
                        "guideline": match.guideline.title,
                        "recommendation": rec.text,
                        "evidence": rec.evidence_level.value,
                        "strength": rec.strength.value,
                    })
        
        # Get treatment options from knowledge graph
        if self._knowledge_graph:
            treatments = self._knowledge_graph.get_treatments_for_disease(condition)
            for drug_node, edge in treatments:
                pathway["treatment_options"].append({
                    "treatment": drug_node.name,
                    "relationship": edge.relation_type.value,
                    "confidence": edge.confidence,
                })
        
        return pathway
    
    def get_stats(self) -> Dict[str, Any]:
        """Get P2 integration statistics."""
        return {
            **self.stats,
            "components": {
                "guidelines": self._guideline_engine is not None,
                "terminology": self._terminology_engine is not None,
                "knowledge_graph": self._knowledge_graph is not None,
            },
        }
    
    async def get_clinical_pathway(
        self,
        condition: str,
        patient_context: Optional[ClinicalContext] = None,
    ) -> Dict[str, Any]:
        """
        Get clinical pathway for a condition.
        
        Combines:
        - Guideline-based recommendations
        - Knowledge graph treatment relationships
        - Diagnostic steps
        
        Args:
            condition: Medical condition name
            patient_context: Optional patient context
        
        Returns:
            Clinical pathway with recommendations
        """
        if not self._initialized:
            self.initialize()
        
        pathway = {
            "condition": condition,
            "guideline_recommendations": [],
            "treatment_options": [],
            "diagnostic_steps": [],
            "monitoring": [],
        }
        
        # Get guideline recommendations
        if self._guideline_engine:
            matches = self._guideline_engine.match_guidelines(condition)
            for match in matches[:2]:
                for rec in match.relevant_recommendations[:5]:
                    pathway["guideline_recommendations"].append({
                        "guideline": match.guideline.title,
                        "recommendation": rec.text,
                        "evidence": rec.evidence_level.value,
                        "strength": rec.strength.value,
                    })
        
        # Get treatment options from knowledge graph
        if self._knowledge_graph:
            treatments = self._knowledge_graph.get_treatments_for_disease(condition)
            for drug_node, edge in treatments:
                pathway["treatment_options"].append({
                    "treatment": drug_node.name,
                    "relationship": edge.relation_type.value,
                    "confidence": edge.confidence,
                })
        
        return pathway


# Singleton instance
_p2_service: Optional[P2IntegrationService] = None


def get_p2_service() -> P2IntegrationService:
    """Get or create the P2 integration service singleton."""
    global _p2_service
    if _p2_service is None:
        _p2_service = P2IntegrationService()
    return _p2_service

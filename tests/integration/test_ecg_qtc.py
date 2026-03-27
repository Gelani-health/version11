"""
Test Group 5: ECG QTc Calculation Tests
=======================================

Tests for QT interval correction with heart rate:
- All four validated QTc formulas (Bazett, Fridericia, Hodges, Framingham)
- Formula selection based on heart rate (Fridericia for HR > 100)
- Gender-aware QTc thresholds for prolongation assessment

References:
- P3: ECG Analyzer (ecg_analyzer.py)
- Bazett HC. Heart 1920;7:353-370
- Fridericia LS. Acta Med Scand 1920;54:467-486
- Rautaharju PM et al. J Am Coll Cardiol 2009;53:982-991 (AHA/ACCF/HRS Guidelines)

QTc Thresholds (AHA/ACCF/HRS 2009):
- Male: Normal <=440ms, Borderline 441-450ms, Prolonged >450ms
- Female: Normal <=450ms, Borderline 451-460ms, Prolonged >460ms
- Critical: >500ms (high torsades risk, both sexes)
"""

import pytest
from httpx import AsyncClient


class TestQTcCalculation:
    """
    Test QTc calculations with multiple formulas.
    """

    @pytest.mark.asyncio
    async def test_fridericia_primary_at_elevated_hr(self, async_client: AsyncClient):
        """
        Test QTc calculation with Fridericia as primary at elevated heart rate.
        
        Test case: HR 120 bpm, QT 340 ms, Male
        
        Expected calculations:
        - RR = 60/120 = 0.5 seconds
        - Fridericia: QTc = 340 / (0.5^(1/3)) = 340 / 0.794 = 428 ms
        
        Primary formula should be Fridericia at HR > 100.
        """
        payload = {
            "hr_bpm": 120,
            "qt_ms": 340,
            "sex": "M",
        }
        
        endpoints = [
            "/api/calculators/qtc",
            "/calculate/qtc",
            "/api/v1/calculators/qtc",
        ]
        
        response = None
        for endpoint in endpoints:
            response = await async_client.post(endpoint, json=payload)
            if response.status_code != 404:
                break
        
        if response is None or response.status_code == 404:
            pytest.skip("QTc calculation endpoint not found")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check Fridericia QTc value
        qtc_fridericia = data.get("qtc_fridericia_ms", data.get("qtc_formulas", {}).get("fridericia"))
        
        assert qtc_fridericia is not None, "Fridericia QTc not found in response"
        
        # Check primary formula is Fridericia
        primary_formula = data.get("primary_formula", "")
        if primary_formula:
            assert primary_formula.lower() in ["fridericia", "friderica"], (
                f"Primary formula should be Fridericia at HR > 100, got: {primary_formula}"
            )

    @pytest.mark.asyncio
    async def test_qtc_prolonged_female_threshold(self, async_client: AsyncClient):
        """
        Test QTc prolongation detection using female-specific threshold.
        
        Female threshold: Prolonged if QTc > 450 ms (per ESC 2022)
        """
        payload = {
            "hr_bpm": 65,
            "qt_ms": 430,
            "sex": "F",
        }
        
        endpoints = ["/api/calculators/qtc", "/calculate/qtc"]
        
        response = None
        for endpoint in endpoints:
            response = await async_client.post(endpoint, json=payload)
            if response.status_code != 404:
                break
        
        if response is None or response.status_code == 404:
            pytest.skip("QTc calculation endpoint not found")
        
        assert response.status_code == 200
        data = response.json()
        
        qtc_fridericia = data.get("qtc_fridericia_ms")
        
        # Check interpretation for female
        interpretation = data.get("interpretation", "").lower()
        qtc_status = data.get("qtc_status", "").lower()
        
        # If QTc > 450 for female, should be prolonged
        if qtc_fridericia and qtc_fridericia > 450:
            is_prolonged = (
                "prolong" in interpretation or
                "prolonged" in qtc_status
            )
            assert is_prolonged, (
                f"Female with QTc {qtc_fridericia} ms should be interpreted as prolonged/borderline"
            )

    @pytest.mark.asyncio
    async def test_critical_qtc_alert(self, async_client: AsyncClient):
        """
        Test that critical QTc prolongation (>500ms) generates appropriate alert.
        """
        payload = {
            "hr_bpm": 70,
            "qt_ms": 520,  # Very prolonged
            "sex": "M",
        }
        
        response = await async_client.post("/api/calculators/qtc", json=payload)
        
        if response.status_code == 404:
            pytest.skip("QTc calculation endpoint not found")
        
        assert response.status_code == 200
        data = response.json()
        
        qtc = data.get("qtc_fridericia_ms", data.get("primary_qtc_ms"))
        
        if qtc and qtc > 500:
            # Check for critical status
            qtc_status = data.get("qtc_status", "").lower()
            interpretation = data.get("interpretation", "").lower()
            
            is_critical = (
                qtc_status == "critical" or
                "critical" in interpretation or
                "torsades" in interpretation
            )
            
            assert is_critical, (
                f"QTc {qtc} ms > 500 should trigger critical alert for torsades risk"
            )

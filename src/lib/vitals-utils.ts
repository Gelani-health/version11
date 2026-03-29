/**
 * Vitals Utilities
 * Validation and status calculation for vital signs
 */

export interface VitalsInput {
  temperature?: number | null;
  temperatureUnit?: string;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  oxygenSaturation?: number | null;
  weight?: number | null;
  weightUnit?: string;
  height?: number | null;
  heightUnit?: string;
  bloodGlucose?: number | null;
  glucoseUnit?: string;
  glucoseType?: string | null;
  painScore?: number | null;
  consciousnessLevel?: string | null;
}

export interface VitalsStatus {
  bpStatus?: string;
  hrStatus?: string;
  rrStatus?: string;
  spo2Status?: string;
  tempStatus?: string;
  glucoseStatus?: string;
}

export type VitalStatusType = 'normal' | 'warning' | 'critical';

/**
 * Calculate BMI from weight and height
 */
export function calculateBMI(
  weight: number | null | undefined,
  height: number | null | undefined,
  weightUnit: string = 'kg',
  heightUnit: string = 'cm'
): number | null {
  if (!weight || !height) return null;
  
  let weightKg = weight;
  let heightM = height;
  
  // Convert weight to kg
  if (weightUnit === 'lb') {
    weightKg = weight * 0.453592;
  }
  
  // Convert height to meters
  if (heightUnit === 'cm') {
    heightM = height / 100;
  } else if (heightUnit === 'in') {
    heightM = height * 0.0254;
  } else if (heightUnit === 'ft') {
    heightM = height * 0.3048;
  }
  
  if (heightM <= 0) return null;
  
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
}

/**
 * Get blood pressure status
 * Based on American Heart Association guidelines
 */
export function getBPStatus(systolic: number | null | undefined, diastolic: number | null | undefined): VitalStatusType | null {
  if (!systolic || !diastolic) return null;
  
  // Critical: Hypertensive crisis
  if (systolic > 180 || diastolic > 120) {
    return 'critical';
  }
  
  // Warning: Stage 2 hypertension or hypotension
  if (systolic >= 140 || diastolic >= 90 || systolic < 90 || diastolic < 60) {
    return 'warning';
  }
  
  // Normal range
  return 'normal';
}

/**
 * Get heart rate status
 */
export function getHRStatus(heartRate: number | null | undefined): VitalStatusType | null {
  if (!heartRate) return null;
  
  // Critical: Severe bradycardia or tachycardia
  if (heartRate < 40 || heartRate > 150) {
    return 'critical';
  }
  
  // Warning: Mild bradycardia or tachycardia
  if (heartRate < 50 || heartRate > 120) {
    return 'warning';
  }
  
  // Normal range: 50-120 bpm for adults
  return 'normal';
}

/**
 * Get respiratory rate status
 */
export function getRRStatus(respiratoryRate: number | null | undefined): VitalStatusType | null {
  if (!respiratoryRate) return null;
  
  // Critical: Severe bradypnea or tachypnea
  if (respiratoryRate < 8 || respiratoryRate > 30) {
    return 'critical';
  }
  
  // Warning: Mild bradypnea or tachypnea
  if (respiratoryRate < 10 || respiratoryRate > 24) {
    return 'warning';
  }
  
  // Normal range: 10-24 breaths per minute for adults
  return 'normal';
}

/**
 * Get oxygen saturation status
 */
export function getSpO2Status(oxygenSaturation: number | null | undefined): VitalStatusType | null {
  if (!oxygenSaturation) return null;
  
  // Critical: Severe hypoxemia
  if (oxygenSaturation < 90) {
    return 'critical';
  }
  
  // Warning: Moderate hypoxemia
  if (oxygenSaturation < 94) {
    return 'warning';
  }
  
  // Normal range: 94-100%
  return 'normal';
}

/**
 * Get temperature status
 */
export function getTempStatus(temperature: number | null | undefined, unit: string = 'C'): VitalStatusType | null {
  if (!temperature) return null;
  
  // Convert to Celsius if needed
  let tempC = temperature;
  if (unit === 'F') {
    tempC = (temperature - 32) * 5 / 9;
  }
  
  // Critical: Severe hypothermia or hyperthermia
  if (tempC < 32 || tempC > 41) {
    return 'critical';
  }
  
  // Warning: Mild hypothermia or fever
  if (tempC < 35 || tempC > 38.5) {
    return 'warning';
  }
  
  // Normal range: 35-38.5°C
  return 'normal';
}

/**
 * Get blood glucose status
 */
export function getGlucoseStatus(
  glucose: number | null | undefined,
  unit: string = 'mmol/L',
  glucoseType?: string | null
): VitalStatusType | null {
  if (!glucose) return null;
  
  // Convert to mmol/L if needed
  let glucoseMmol = glucose;
  if (unit === 'mg/dL') {
    glucoseMmol = glucose / 18.018;
  }
  
  const isFasting = glucoseType === 'fasting';
  
  if (isFasting) {
    // Critical: Severe hypoglycemia or hyperglycemia
    if (glucoseMmol < 2.8 || glucoseMmol > 16.7) {
      return 'critical';
    }
    
    // Warning: Mild hypoglycemia or impaired fasting glucose
    if (glucoseMmol < 3.9 || glucoseMmol > 7.0) {
      return 'warning';
    }
    
    return 'normal';
  } else {
    // Random glucose
    if (glucoseMmol < 2.8 || glucoseMmol > 22.2) {
      return 'critical';
    }
    
    if (glucoseMmol < 3.9 || glucoseMmol > 11.1) {
      return 'warning';
    }
    
    return 'normal';
  }
}

/**
 * Calculate all vital signs statuses
 */
export function calculateVitalsStatuses(vitals: VitalsInput): VitalsStatus {
  return {
    bpStatus: getBPStatus(vitals.bloodPressureSystolic, vitals.bloodPressureDiastolic) || undefined,
    hrStatus: getHRStatus(vitals.heartRate) || undefined,
    rrStatus: getRRStatus(vitals.respiratoryRate) || undefined,
    spo2Status: getSpO2Status(vitals.oxygenSaturation) || undefined,
    tempStatus: getTempStatus(vitals.temperature, vitals.temperatureUnit) || undefined,
    glucoseStatus: getGlucoseStatus(vitals.bloodGlucose, vitals.glucoseUnit, vitals.glucoseType) || undefined,
  };
}

/**
 * Get status color for display
 */
export function getStatusColor(status: VitalStatusType | null | undefined): string {
  switch (status) {
    case 'normal':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    case 'critical':
      return 'bg-red-500';
    default:
      return 'bg-slate-300';
  }
}

/**
 * Get status text color for display
 */
export function getStatusTextColor(status: VitalStatusType | null | undefined): string {
  switch (status) {
    case 'normal':
      return 'text-emerald-600';
    case 'warning':
      return 'text-amber-600';
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-slate-500';
  }
}

/**
 * Get status background color for display
 */
export function getStatusBgColor(status: VitalStatusType | null | undefined): string {
  switch (status) {
    case 'normal':
      return 'bg-emerald-50 border-emerald-200';
    case 'warning':
      return 'bg-amber-50 border-amber-200';
    case 'critical':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-slate-50 border-slate-200';
  }
}

/**
 * Get consciousness level description
 */
export function getConsciousnessLevelDescription(level: string | null | undefined): string {
  switch (level?.toLowerCase()) {
    case 'alert':
      return 'Patient is fully awake and responsive';
    case 'verbal':
      return 'Patient responds to verbal stimuli';
    case 'pain':
      return 'Patient responds only to painful stimuli';
    case 'unresponsive':
      return 'Patient does not respond to any stimuli';
    default:
      return 'Unknown consciousness level';
  }
}

/**
 * Validate vitals input
 */
export function validateVitals(vitals: VitalsInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Temperature validation
  if (vitals.temperature !== null && vitals.temperature !== undefined) {
    const temp = vitals.temperature;
    const unit = vitals.temperatureUnit || 'C';
    
    if (unit === 'C' && (temp < 30 || temp > 45)) {
      errors.push('Temperature out of valid range (30-45°C)');
    } else if (unit === 'F' && (temp < 86 || temp > 113)) {
      errors.push('Temperature out of valid range (86-113°F)');
    }
  }
  
  // Blood pressure validation
  if (vitals.bloodPressureSystolic !== null && vitals.bloodPressureSystolic !== undefined) {
    if (vitals.bloodPressureSystolic < 60 || vitals.bloodPressureSystolic > 250) {
      errors.push('Systolic BP out of valid range (60-250 mmHg)');
    }
  }
  
  if (vitals.bloodPressureDiastolic !== null && vitals.bloodPressureDiastolic !== undefined) {
    if (vitals.bloodPressureDiastolic < 30 || vitals.bloodPressureDiastolic > 150) {
      errors.push('Diastolic BP out of valid range (30-150 mmHg)');
    }
  }
  
  // Heart rate validation
  if (vitals.heartRate !== null && vitals.heartRate !== undefined) {
    if (vitals.heartRate < 20 || vitals.heartRate > 300) {
      errors.push('Heart rate out of valid range (20-300 bpm)');
    }
  }
  
  // Respiratory rate validation
  if (vitals.respiratoryRate !== null && vitals.respiratoryRate !== undefined) {
    if (vitals.respiratoryRate < 4 || vitals.respiratoryRate > 60) {
      errors.push('Respiratory rate out of valid range (4-60 breaths/min)');
    }
  }
  
  // Oxygen saturation validation
  if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation !== undefined) {
    if (vitals.oxygenSaturation < 50 || vitals.oxygenSaturation > 100) {
      errors.push('Oxygen saturation out of valid range (50-100%)');
    }
  }
  
  // Pain score validation
  if (vitals.painScore !== null && vitals.painScore !== undefined) {
    if (vitals.painScore < 0 || vitals.painScore > 10) {
      errors.push('Pain score must be between 0 and 10');
    }
  }
  
  // Blood glucose validation
  if (vitals.bloodGlucose !== null && vitals.bloodGlucose !== undefined) {
    const glucose = vitals.bloodGlucose;
    const unit = vitals.glucoseUnit || 'mmol/L';
    
    if (unit === 'mmol/L' && (glucose < 1 || glucose > 55)) {
      errors.push('Blood glucose out of valid range (1-55 mmol/L)');
    } else if (unit === 'mg/dL' && (glucose < 18 || glucose > 1000)) {
      errors.push('Blood glucose out of valid range (18-1000 mg/dL)');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Format vital sign with unit
 */
export function formatVitalSign(value: number | null | undefined, unit: string, decimals: number = 1): string {
  if (value === null || value === undefined) return '--';
  return `${value.toFixed(decimals)} ${unit}`;
}

/**
 * Format blood pressure
 */
export function formatBloodPressure(systolic: number | null | undefined, diastolic: number | null | undefined): string {
  if (!systolic || !diastolic) return '--/-- mmHg';
  return `${systolic}/${diastolic} mmHg`;
}

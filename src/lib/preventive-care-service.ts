/**
 * Preventive Care Service - USPSTF A/B Recommendations
 * ======================================================
 *
 * Implements evidence-based preventive care recommendations based on
 * US Preventive Services Task Force (USPSTF) A and B grade recommendations.
 *
 * References:
 * - USPSTF Recommendations: https://www.uspreventiveservicestaskforce.org/
 * - AHRQ Guidelines: https://www.ahrq.gov/prevention/guidelines/index.html
 *
 * Grade Definitions:
 * - A: High certainty of substantial net benefit - OFFER
 * - B: High certainty of moderate benefit OR moderate certainty of moderate-to-substantial benefit - OFFER
 */

import { Patient } from '@prisma/client';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export type USPSTFGrade = 'A' | 'B' | 'C' | 'D' | 'I';

export type ScreeningCategory = 
  | 'cancer'
  | 'cardiovascular'
  | 'infectious'
  | 'metabolic'
  | 'mental_health'
  | 'reproductive'
  | 'developmental'
  | 'sensory'
  | 'musculoskeletal';

export interface PreventiveScreening {
  id: string;
  name: string;
  category: ScreeningCategory;
  grade: USPSTFGrade;
  description: string;
  targetPopulation: {
    minAge: number;
    maxAge?: number;
    gender?: 'male' | 'female' | 'all';
    riskFactors?: string[];
    exclusions?: string[];
  };
  frequency: string;
  frequencyMonths: number;
  evidenceLevel: 'high' | 'moderate';
  icd10Code?: string;
  cptCode?: string;
  loincCode?: string;
  benefits: string[];
  harms: string[];
  source: string;
  lastUpdated: string;
}

export interface ScreeningRecommendation {
  screening: PreventiveScreening;
  status: 'due' | 'overdue' | 'up_to_date' | 'not_applicable' | 'contraindicated';
  lastPerformed?: Date;
  nextDue: Date;
  urgency: 'routine' | 'overdue' | 'urgent';
  patientSpecificNotes?: string;
}

export interface PreventiveCareProfile {
  patientId: string;
  age: number;
  gender: string;
  riskFactors: string[];
  chronicConditions: string[];
  medications: string[];
  allergies: string[];
  pregnancyStatus?: string;
  recommendations: ScreeningRecommendation[];
  lastUpdated: Date;
}

// =============================================================================
// USPSTF A/B SCREENING DEFINITIONS
// =============================================================================

export const USPSTF_SCREENINGS: PreventiveScreening[] = [
  // CANCER SCREENINGS
  {
    id: 'breast-cancer-mammography',
    name: 'Breast Cancer Screening (Mammography)',
    category: 'cancer',
    grade: 'B',
    description: 'Screening mammography for breast cancer detection',
    targetPopulation: {
      minAge: 40,
      maxAge: 74,
      gender: 'female',
    },
    frequency: 'Every 2 years',
    frequencyMonths: 24,
    evidenceLevel: 'high',
    cptCode: '77067',
    loincCode: '24606-6',
    benefits: [
      'Early detection reduces breast cancer mortality by 15-20%',
      'Earlier stage at diagnosis allows less aggressive treatment',
    ],
    harms: [
      'False positives leading to additional imaging/biopsy',
      'Overdiagnosis of indolent cancers',
      'Radiation exposure (minimal)',
    ],
    source: 'USPSTF 2016 (Affirmed 2024)',
    lastUpdated: '2024-01-15',
  },
  {
    id: 'cervical-cancer-pap',
    name: 'Cervical Cancer Screening (Pap Smear)',
    category: 'cancer',
    grade: 'A',
    description: 'Cervical cytology for cervical cancer and precancerous lesions',
    targetPopulation: {
      minAge: 21,
      maxAge: 65,
      gender: 'female',
    },
    frequency: 'Every 3 years (Pap) or every 5 years (Pap + HPV)',
    frequencyMonths: 36,
    evidenceLevel: 'high',
    cptCode: '88142',
    icd10Code: 'Z12.4',
    loincCode: '47527-7',
    benefits: [
      'Reduces cervical cancer incidence by 60-90%',
      'Reduces cervical cancer mortality by 70-80%',
    ],
    harms: [
      'False positives requiring colposcopy',
      'Psychological distress from abnormal results',
      'Potential overtreatment of CIN 1',
    ],
    source: 'USPSTF 2018',
    lastUpdated: '2018-08-21',
  },
  {
    id: 'colorectal-cancer-screening',
    name: 'Colorectal Cancer Screening',
    category: 'cancer',
    grade: 'A',
    description: 'Multiple screening modalities for colorectal cancer',
    targetPopulation: {
      minAge: 45,
      maxAge: 75,
      gender: 'all',
    },
    frequency: 'Colonoscopy every 10 years, FIT annually, or FIT-DNA every 1-3 years',
    frequencyMonths: 12,
    evidenceLevel: 'high',
    cptCode: 'G0105',
    icd10Code: 'Z12.11',
    benefits: [
      'Reduces colorectal cancer mortality by 15-33%',
      'Detection and removal of precancerous polyps',
      'Prevents cancer development',
    ],
    harms: [
      'Bowel preparation discomfort',
      'False positives (stool tests)',
      'Rare complications from colonoscopy (perforation, bleeding)',
    ],
    source: 'USPSTF 2021',
    lastUpdated: '2021-05-18',
  },
  {
    id: 'lung-cancer-ldct',
    name: 'Lung Cancer Screening (Low-Dose CT)',
    category: 'cancer',
    grade: 'B',
    description: 'Low-dose computed tomography for lung cancer screening',
    targetPopulation: {
      minAge: 50,
      maxAge: 80,
      gender: 'all',
      riskFactors: ['smoking_history_20_pack_years', 'current_smoker_or_quit_within_15_years'],
    },
    frequency: 'Annually',
    frequencyMonths: 12,
    evidenceLevel: 'high',
    cptCode: '71271',
    icd10Code: 'Z12.2',
    benefits: [
      '20% reduction in lung cancer mortality',
      'Earlier stage at diagnosis',
    ],
    harms: [
      'High false positive rate (>90% of positive results are false)',
      'Radiation exposure',
      'Invasive follow-up procedures',
    ],
    source: 'USPSTF 2021',
    lastUpdated: '2021-03-09',
  },
  {
    id: 'prostate-cancer-psa',
    name: 'Prostate Cancer Screening (PSA)',
    category: 'cancer',
    grade: 'B',
    description: 'Prostate-specific antigen testing for prostate cancer',
    targetPopulation: {
      minAge: 55,
      maxAge: 69,
      gender: 'male',
    },
    frequency: 'Every 2 years (shared decision-making)',
    frequencyMonths: 24,
    evidenceLevel: 'moderate',
    cptCode: '84153',
    icd10Code: 'Z12.5',
    loincCode: '2857-1',
    benefits: [
      '1 in 1000 men screened avoid prostate cancer death',
      'Earlier detection allows curative treatment options',
    ],
    harms: [
      'Overdiagnosis estimated at 20-50%',
      'Complications from prostate biopsy',
      'Treatment complications (incontinence, impotence)',
    ],
    source: 'USPSTF 2018',
    lastUpdated: '2018-05-08',
  },

  // CARDIOVASCULAR SCREENINGS
  {
    id: 'aaa-screening',
    name: 'Abdominal Aortic Aneurysm Screening',
    category: 'cardiovascular',
    grade: 'B',
    description: 'One-time ultrasound screening for AAA',
    targetPopulation: {
      minAge: 65,
      maxAge: 75,
      gender: 'male',
      riskFactors: ['ever_smoked'],
    },
    frequency: 'Once',
    frequencyMonths: 9999,
    evidenceLevel: 'high',
    cptCode: '76706',
    icd10Code: 'Z13.6',
    benefits: [
      'Reduces AAA-related mortality by 50% in screened men',
      'Early detection allows monitoring or surgical intervention',
    ],
    harms: [
      'False positives requiring additional imaging',
      'Anxiety from positive results',
      'Potential harms from surgical repair',
    ],
    source: 'USPSTF 2019',
    lastUpdated: '2019-12-10',
  },
  {
    id: 'hypertension-screening',
    name: 'Hypertension Screening',
    category: 'cardiovascular',
    grade: 'A',
    description: 'Blood pressure measurement for hypertension detection',
    targetPopulation: {
      minAge: 18,
      gender: 'all',
    },
    frequency: 'Annually (if normal); more frequently if elevated',
    frequencyMonths: 12,
    evidenceLevel: 'high',
    cptCode: '99213',
    loincCode: '8480-6',
    benefits: [
      'Early detection prevents cardiovascular complications',
      'Treatment reduces stroke risk by 35-40%',
      'Treatment reduces coronary heart disease risk by 20-25%',
    ],
    harms: [
      'False positives (white coat hypertension)',
      'Side effects from treatment',
    ],
    source: 'USPSTF 2021',
    lastUpdated: '2021-04-27',
  },
  {
    id: 'cholesterol-screening',
    name: 'Lipid Disorder Screening',
    category: 'cardiovascular',
    grade: 'B',
    description: 'Lipid panel for dyslipidemia detection',
    targetPopulation: {
      minAge: 40,
      maxAge: 75,
      gender: 'all',
    },
    frequency: 'Every 5 years (more frequently if elevated risk)',
    frequencyMonths: 60,
    evidenceLevel: 'high',
    cptCode: '80061',
    loincCode: '5767-9',
    benefits: [
      'Identifies modifiable cardiovascular risk factor',
      'Statins reduce major cardiovascular events by 25-35%',
    ],
    harms: [
      'False positives requiring repeat testing',
      'Side effects from statin therapy',
    ],
    source: 'USPSTF 2016 (Affirmed 2024)',
    lastUpdated: '2024-01-15',
  },

  // INFECTIOUS DISEASE SCREENINGS
  {
    id: 'hiv-screening',
    name: 'HIV Screening',
    category: 'infectious',
    grade: 'A',
    description: 'HIV antibody/antigen testing',
    targetPopulation: {
      minAge: 15,
      maxAge: 65,
      gender: 'all',
    },
    frequency: 'At least once; more frequently if high risk',
    frequencyMonths: 36,
    evidenceLevel: 'high',
    cptCode: '87389',
    icd10Code: 'Z11.4',
    loincCode: '75849-6',
    benefits: [
      'Early treatment dramatically improves outcomes',
      'ART reduces transmission risk by >90%',
      'Life expectancy approaches general population with early treatment',
    ],
    harms: [
      'False positives (rare with confirmatory testing)',
      'Psychological distress from diagnosis',
    ],
    source: 'USPSTF 2019',
    lastUpdated: '2019-06-11',
  },
  {
    id: 'hepatitis-b-screening',
    name: 'Hepatitis B Screening',
    category: 'infectious',
    grade: 'B',
    description: 'HBsAg testing for hepatitis B virus infection',
    targetPopulation: {
      minAge: 18,
      gender: 'all',
      riskFactors: [
        'born_in_high_prevalence_country',
        'hiv_positive',
        'injection_drug_use',
        'men_who_have_sex_with_men',
        'household_contact_hbv',
        'healthcare_worker',
        'pregnant_women',
      ],
    },
    frequency: 'Once; repeat if new risk factors',
    frequencyMonths: 9999,
    evidenceLevel: 'high',
    cptCode: '87340',
    icd10Code: 'Z11.59',
    loincCode: '5195-3',
    benefits: [
      'Identifies chronic HBV for treatment and monitoring',
      'Prevents liver cirrhosis and hepatocellular carcinoma',
      'Prevents transmission to contacts',
    ],
    harms: [
      'False positives',
      'Potential discrimination',
    ],
    source: 'USPSTF 2020',
    lastUpdated: '2020-07-14',
  },
  {
    id: 'hepatitis-c-screening',
    name: 'Hepatitis C Screening',
    category: 'infectious',
    grade: 'B',
    description: 'HCV antibody testing for hepatitis C virus infection',
    targetPopulation: {
      minAge: 18,
      maxAge: 79,
      gender: 'all',
    },
    frequency: 'Once for all adults',
    frequencyMonths: 9999,
    evidenceLevel: 'high',
    cptCode: '86804',
    icd10Code: 'Z11.59',
    loincCode: '16128-3',
    benefits: [
      'Over 95% cure rate with direct-acting antivirals',
      'Prevents liver cirrhosis, cancer, and death',
      'Reduces transmission',
    ],
    harms: [
      'False positives requiring confirmatory testing',
      'Cost and access to treatment',
    ],
    source: 'USPSTF 2020',
    lastUpdated: '2020-03-02',
  },
  {
    id: 'sti-screening',
    name: 'STI Screening (Chlamydia, Gonorrhea, Syphilis)',
    category: 'infectious',
    grade: 'B',
    description: 'Screening for sexually transmitted infections',
    targetPopulation: {
      minAge: 15,
      maxAge: 65,
      gender: 'all',
      riskFactors: ['sexually_active', 'multiple_partners', 'age_under_25', 'pregnant_women'],
    },
    frequency: 'Annually if sexually active and under 25 or at increased risk',
    frequencyMonths: 12,
    evidenceLevel: 'high',
    cptCode: '87801',
    icd10Code: 'Z11.3',
    benefits: [
      'Prevents PID and infertility in women',
      'Prevents transmission to partners',
      'Prevents congenital infections',
    ],
    harms: [
      'False positives',
      'Anxiety from screening',
    ],
    source: 'USPSTF 2021',
    lastUpdated: '2021-09-14',
  },

  // METABOLIC SCREENINGS
  {
    id: 'diabetes-screening',
    name: 'Type 2 Diabetes Screening',
    category: 'metabolic',
    grade: 'B',
    description: 'Blood glucose testing for prediabetes and type 2 diabetes',
    targetPopulation: {
      minAge: 35,
      gender: 'all',
      riskFactors: ['overweight', 'obese', 'hypertension', 'family_history_diabetes'],
    },
    frequency: 'Every 3 years',
    frequencyMonths: 36,
    evidenceLevel: 'moderate',
    cptCode: '82947',
    icd10Code: 'Z13.1',
    loincCode: '2345-7',
    benefits: [
      'Early intervention prevents or delays complications',
      'Lifestyle changes can prevent or delay progression',
      'Reduces cardiovascular risk',
    ],
    harms: [
      'False positives requiring repeat testing',
      'Labeling and psychological effects',
    ],
    source: 'USPSTF 2021',
    lastUpdated: '2021-08-24',
  },
  {
    id: 'obesity-screening',
    name: 'Obesity Screening',
    category: 'metabolic',
    grade: 'B',
    description: 'BMI measurement and behavioral counseling',
    targetPopulation: {
      minAge: 18,
      gender: 'all',
    },
    frequency: 'Annually',
    frequencyMonths: 12,
    evidenceLevel: 'high',
    cptCode: '99406',
    loincCode: '39156-5',
    benefits: [
      'Identifies patients for weight management interventions',
      'Reduces obesity-related comorbidities',
    ],
    harms: [
      'Potential for weight stigma',
      'Ineffective counseling without referral resources',
    ],
    source: 'USPSTF 2018',
    lastUpdated: '2018-09-18',
  },

  // MENTAL HEALTH SCREENINGS
  {
    id: 'depression-screening',
    name: 'Depression Screening',
    category: 'mental_health',
    grade: 'B',
    description: 'PHQ-2/PHQ-9 or other validated depression screening tool',
    targetPopulation: {
      minAge: 12,
      gender: 'all',
    },
    frequency: 'Annually and at high-risk visits',
    frequencyMonths: 12,
    evidenceLevel: 'high',
    cptCode: '96127',
    loincCode: '89204-2',
    benefits: [
      'Identifies undiagnosed depression',
      'Early treatment improves outcomes',
      'Reduces suicide risk',
    ],
    harms: [
      'False positives requiring further evaluation',
      'Potential for overtreatment',
    ],
    source: 'USPSTF 2016 (Affirmed 2024)',
    lastUpdated: '2024-01-15',
  },
  {
    id: 'anxiety-screening',
    name: 'Anxiety Screening',
    category: 'mental_health',
    grade: 'B',
    description: 'GAD-7 or other validated anxiety screening tool',
    targetPopulation: {
      minAge: 19,
      gender: 'all',
    },
    frequency: 'Annually and at high-risk visits',
    frequencyMonths: 12,
    evidenceLevel: 'moderate',
    cptCode: '96127',
    loincCode: '70274-6',
    benefits: [
      'Identifies undiagnosed anxiety disorders',
      'Early treatment improves quality of life',
    ],
    harms: [
      'False positives',
      'Potential overtreatment',
    ],
    source: 'USPSTF 2022',
    lastUpdated: '2022-06-20',
  },
  {
    id: 'suicide-risk-screening',
    name: 'Suicide Risk Screening',
    category: 'mental_health',
    grade: 'B',
    description: 'Screening for suicide risk in adolescents and adults',
    targetPopulation: {
      minAge: 12,
      gender: 'all',
    },
    frequency: 'At every mental health visit; consider at primary care visits',
    frequencyMonths: 6,
    evidenceLevel: 'moderate',
    cptCode: '96127',
    benefits: [
      'Identifies at-risk individuals for intervention',
      'Connection to mental health services',
    ],
    harms: [
      'Limited evidence on screening tools accuracy',
      'Risk of iatrogenic effects (limited evidence)',
    ],
    source: 'USPSTF 2023',
    lastUpdated: '2023-05-09',
  },

  // REPRODUCTIVE HEALTH
  {
    id: 'prenatal-screening',
    name: 'Prenatal Care Screening',
    category: 'reproductive',
    grade: 'A',
    description: 'Comprehensive prenatal screening including preeclampsia, anemia, gestational diabetes',
    targetPopulation: {
      minAge: 18,
      maxAge: 50,
      gender: 'female',
      riskFactors: ['pregnant'],
    },
    frequency: 'Per prenatal schedule (each trimester)',
    frequencyMonths: 3,
    evidenceLevel: 'high',
    cptCode: '99213',
    benefits: [
      'Reduces maternal morbidity and mortality',
      'Reduces adverse birth outcomes',
      'Early detection of pregnancy complications',
    ],
    harms: [
      'False positives requiring additional testing',
      'Anxiety from screening',
    ],
    source: 'USPSTF Multiple Recommendations',
    lastUpdated: '2023-06-13',
  },
  {
    id: 'folic-acid-supplementation',
    name: 'Folic Acid Supplementation Counseling',
    category: 'reproductive',
    grade: 'A',
    description: 'Folic acid supplementation for women planning or capable of pregnancy',
    targetPopulation: {
      minAge: 15,
      maxAge: 49,
      gender: 'female',
    },
    frequency: 'Daily supplementation counseling',
    frequencyMonths: 12,
    evidenceLevel: 'high',
    benefits: [
      'Prevents 50-70% of neural tube defects',
      'Safe and low cost',
    ],
    harms: [
      'Minimal - rare B12 deficiency masking at high doses',
    ],
    source: 'USPSTF 2017',
    lastUpdated: '2017-01-10',
  },

  // DEVELOPMENTAL SCREENINGS
  {
    id: 'developmental-screening',
    name: 'Developmental Screening in Children',
    category: 'developmental',
    grade: 'B',
    description: 'Developmental screening using validated tools (e.g., ASQ)',
    targetPopulation: {
      minAge: 0,
      maxAge: 5,
      gender: 'all',
    },
    frequency: 'At 9, 18, and 30 months; additional if concerns',
    frequencyMonths: 12,
    evidenceLevel: 'moderate',
    cptCode: '96110',
    benefits: [
      'Early identification of developmental delays',
      'Early intervention improves outcomes',
    ],
    harms: [
      'False positives causing parental anxiety',
      'Cost of additional evaluation',
    ],
    source: 'USPSTF 2015 (Under Review)',
    lastUpdated: '2015-09-08',
  },
  {
    id: 'autism-screening',
    name: 'Autism Spectrum Disorder Screening',
    category: 'developmental',
    grade: 'B',
    description: 'M-CHAT or other validated autism screening tool',
    targetPopulation: {
      minAge: 18,
      maxAge: 30,
      gender: 'all',
    },
    frequency: 'At 18 and 24 months',
    frequencyMonths: 18,
    evidenceLevel: 'moderate',
    cptCode: '96110',
    icd10Code: 'Z13.42',
    benefits: [
      'Early identification leads to earlier intervention',
      'Better long-term outcomes with early intensive intervention',
    ],
    harms: [
      'False positives',
      'Parental anxiety',
    ],
    source: 'USPSTF 2016 (Under Review)',
    lastUpdated: '2016-08-02',
  },

  // SENSORY SCREENINGS
  {
    id: 'vision-screening-children',
    name: 'Vision Screening in Children',
    category: 'sensory',
    grade: 'B',
    description: 'Vision screening for amblyopia and refractive errors',
    targetPopulation: {
      minAge: 3,
      maxAge: 5,
      gender: 'all',
    },
    frequency: 'Annually in preschool years',
    frequencyMonths: 12,
    evidenceLevel: 'moderate',
    cptCode: '99173',
    benefits: [
      'Early detection of amblyopia prevents permanent vision loss',
      'Improved academic performance with corrected vision',
    ],
    harms: [
      'False positives requiring ophthalmology referral',
      'Cost of additional evaluation',
    ],
    source: 'USPSTF 2017',
    lastUpdated: '2017-09-05',
  },
  {
    id: 'hearing-loss-older-adults',
    name: 'Hearing Loss Screening in Older Adults',
    category: 'sensory',
    grade: 'B',
    description: 'Hearing screening for age-related hearing loss',
    targetPopulation: {
      minAge: 50,
      gender: 'all',
    },
    frequency: 'Consider periodic screening',
    frequencyMonths: 36,
    evidenceLevel: 'moderate',
    cptCode: '92551',
    benefits: [
      'Improved quality of life with treatment',
      'Reduced social isolation and depression',
      'May reduce cognitive decline',
    ],
    harms: [
      'Limited evidence on harms',
      'Cost of hearing aids if not covered',
    ],
    source: 'USPSTF 2021',
    lastUpdated: '2021-03-02',
  },

  // MUSCULOSKELETAL
  {
    id: 'osteoporosis-screening',
    name: 'Osteoporosis Screening',
    category: 'musculoskeletal',
    grade: 'B',
    description: 'DEXA scan for bone mineral density assessment',
    targetPopulation: {
      minAge: 65,
      gender: 'female',
      riskFactors: ['postmenopausal_under_65_with_risk_factors'],
    },
    frequency: 'Every 2 years if normal; more frequently if osteopenia',
    frequencyMonths: 24,
    evidenceLevel: 'high',
    cptCode: '77080',
    icd10Code: 'Z13.820',
    loincCode: '38266-5',
    benefits: [
      'Identifies women at risk for fracture',
      'Treatment reduces hip fracture risk by 40-50%',
      'Treatment reduces vertebral fracture risk by 40-50%',
    ],
    harms: [
      'False positives leading to unnecessary treatment',
      'Rare side effects from bisphosphonates',
    ],
    source: 'USPSTF 2018',
    lastUpdated: '2018-06-26',
  },
  {
    id: 'fall-prevention',
    name: 'Fall Prevention in Older Adults',
    category: 'musculoskeletal',
    grade: 'B',
    description: 'Exercise interventions to prevent falls in community-dwelling adults',
    targetPopulation: {
      minAge: 65,
      gender: 'all',
    },
    frequency: 'Ongoing exercise program',
    frequencyMonths: 12,
    evidenceLevel: 'high',
    cptCode: '99406',
    benefits: [
      'Reduces falls by 20-30%',
      'Reduces fall-related injuries',
      'Improves physical function',
    ],
    harms: [
      'Minimal - potential muscle soreness from exercise',
    ],
    source: 'USPSTF 2018',
    lastUpdated: '2018-04-17',
  },
];

// =============================================================================
// PREVENTIVE CARE SERVICE
// =============================================================================

class PreventiveCareService {
  private screenings: Map<string, PreventiveScreening>;

  constructor() {
    this.screenings = new Map(
      USPSTF_SCREENINGS.map(s => [s.id, s])
    );
  }

  /**
   * Get all USPSTF A/B grade screenings
   */
  getAllScreenings(): PreventiveScreening[] {
    return USPSTF_SCREENINGS.filter(s => s.grade === 'A' || s.grade === 'B');
  }

  /**
   * Get screenings by category
   */
  getScreeningsByCategory(category: ScreeningCategory): PreventiveScreening[] {
    return this.getAllScreenings().filter(s => s.category === category);
  }

  /**
   * Get screenings applicable to a patient
   */
  getApplicableScreenings(patient: Partial<Patient>): PreventiveScreening[] {
    const age = this.calculateAge(patient.dateOfBirth);
    const gender = patient.gender?.toLowerCase();

    return this.getAllScreenings().filter(screening => {
      // Check age
      if (age < screening.targetPopulation.minAge) return false;
      if (screening.targetPopulation.maxAge && age > screening.targetPopulation.maxAge) return false;

      // Check gender
      if (screening.targetPopulation.gender && screening.targetPopulation.gender !== 'all') {
        if (screening.targetPopulation.gender !== gender) return false;
      }

      // Check specific conditions
      if (screening.id === 'lung-cancer-ldct') {
        // Requires smoking history
        const chronicConditions = patient.chronicConditions?.toLowerCase() || '';
        if (!chronicConditions.includes('smoking') && !chronicConditions.includes('smoker')) {
          return false;
        }
      }

      if (screening.id === 'aaa-screening') {
        // Requires ever smoked for men 65-75
        const chronicConditions = patient.chronicConditions?.toLowerCase() || '';
        if (!chronicConditions.includes('smoking') && !chronicConditions.includes('smoker')) {
          return false;
        }
      }

      if (screening.id === 'prenatal-screening' || screening.id === 'folic-acid-supplementation') {
        // Check pregnancy status
        if (patient.pregnancyStatus !== 'pregnant' && screening.id === 'prenatal-screening') {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Generate personalized screening recommendations
   */
  generateRecommendations(
    patient: Partial<Patient>,
    completedScreenings: { screeningId: string; performedDate: Date }[] = []
  ): ScreeningRecommendation[] {
    const applicableScreenings = this.getApplicableScreenings(patient);
    const age = this.calculateAge(patient.dateOfBirth);

    return applicableScreenings.map(screening => {
      const completed = completedScreenings.find(
        cs => cs.screeningId === screening.id
      );

      let nextDue: Date;
      let status: ScreeningRecommendation['status'];
      let urgency: ScreeningRecommendation['urgency'];

      if (completed) {
        nextDue = new Date(completed.performedDate);
        nextDue.setMonth(nextDue.getMonth() + screening.frequencyMonths);
        
        const now = new Date();
        if (nextDue > now) {
          status = 'up_to_date';
          urgency = 'routine';
        } else {
          status = 'overdue';
          urgency = 'overdue';
        }
      } else {
        // Never performed
        nextDue = new Date();
        nextDue.setDate(nextDue.getDate() - 1); // Due now
        status = 'due';
        urgency = screening.grade === 'A' ? 'urgent' : 'routine';
      }

      // Generate patient-specific notes
      let patientSpecificNotes = '';
      if (screening.id === 'prostate-cancer-psa') {
        patientSpecificNotes = 'Shared decision-making recommended. Discuss benefits and harms with patient before screening.';
      } else if (screening.id === 'lung-cancer-ldct') {
        patientSpecificNotes = 'Eligible based on smoking history. Confirm 20+ pack-year history and current smoking status or quit within 15 years.';
      } else if (screening.id === 'colorectal-cancer-screening') {
        patientSpecificNotes = 'Multiple screening options available. Discuss with patient: colonoscopy, FIT, FIT-DNA, or other options.';
      }

      return {
        screening,
        status,
        lastPerformed: completed?.performedDate,
        nextDue,
        urgency,
        patientSpecificNotes,
      };
    });
  }

  /**
   * Calculate patient age from date of birth
   */
  private calculateAge(dateOfBirth?: Date | string | null): number {
    if (!dateOfBirth) return 0;
    
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Get screening by ID
   */
  getScreeningById(id: string): PreventiveScreening | undefined {
    return this.screenings.get(id);
  }

  /**
   * Get screening statistics
   */
  getStatistics(): {
    totalScreenings: number;
    byGrade: Record<USPSTFGrade, number>;
    byCategory: Record<ScreeningCategory, number>;
  } {
    const all = this.getAllScreenings();
    
    const byGrade = all.reduce((acc, s) => {
      acc[s.grade] = (acc[s.grade] || 0) + 1;
      return acc;
    }, {} as Record<USPSTFGrade, number>);

    const byCategory = all.reduce((acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + 1;
      return acc;
    }, {} as Record<ScreeningCategory, number>);

    return {
      totalScreenings: all.length,
      byGrade,
      byCategory,
    };
  }
}

// Export singleton instance
export const preventiveCareService = new PreventiveCareService();

// Export class for testing
export { PreventiveCareService };

/**
 * PDF Generator for SOAP Notes
 * Generates formatted PDF documents for signed notes
 * 
 * Note: This is a simple implementation that returns HTML content
 * that can be converted to PDF using a browser's print functionality
 * or a server-side PDF library.
 */

export interface SoapNotePDFData {
  patientName: string;
  patientMrn: string;
  patientDob: string;
  patientGender: string;
  encounterId: string;
  encounterDate: string;
  
  // Subjective
  chiefComplaint?: string;
  hpiNarrative?: string;
  rosData?: Record<string, string>;
  pmhUpdate?: string;
  familyHistory?: string;
  socialHistory?: string;
  allergiesConfirmed: boolean;
  
  // Objective
  vitals?: {
    temperature?: string;
    bloodPressure?: string;
    heartRate?: string;
    respiratoryRate?: string;
    oxygenSaturation?: string;
    weight?: string;
    height?: string;
    bmi?: string;
  };
  generalAppearance?: string;
  physicalExam?: Record<string, string>;
  diagnosticResults?: string;
  
  // Assessment
  primaryDiagnosis?: {
    code: string;
    description: string;
  };
  differentials?: Array<{
    code: string;
    description: string;
    confidence: string;
  }>;
  clinicalReasoning?: string;
  riskFlags?: string[];
  
  // Plan
  investigationsOrdered?: string;
  medicationsPrescribed?: string;
  referrals?: string;
  patientEducation?: string;
  followUp?: {
    date: string;
    mode: string;
    clinician?: string;
  };
  nursingInstructions?: string;
  disposition?: string;
  
  // Metadata
  status: string;
  signedAt?: string;
  signedBy?: {
    name: string;
    role: string;
    department?: string;
  };
  
  // AI
  aiSuggestionsUsed: boolean;
}

/**
 * Generate HTML content for SOAP note PDF
 */
export function generateSoapNoteHTML(data: SoapNotePDFData): string {
  const {
    patientName,
    patientMrn,
    patientDob,
    patientGender,
    encounterId,
    encounterDate,
    chiefComplaint,
    hpiNarrative,
    rosData,
    pmhUpdate,
    familyHistory,
    socialHistory,
    allergiesConfirmed,
    vitals,
    generalAppearance,
    physicalExam,
    diagnosticResults,
    primaryDiagnosis,
    differentials,
    clinicalReasoning,
    riskFlags,
    investigationsOrdered,
    medicationsPrescribed,
    referrals,
    patientEducation,
    followUp,
    nursingInstructions,
    disposition,
    status,
    signedAt,
    signedBy,
    aiSuggestionsUsed,
  } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clinical Note - ${patientName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #1e293b;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #10b981;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      color: #10b981;
      font-size: 18pt;
      margin-bottom: 5px;
    }
    .header p {
      color: #64748b;
      font-size: 10pt;
    }
    .patient-info {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .patient-info h2 {
      font-size: 14pt;
      color: #1e293b;
      margin-bottom: 10px;
    }
    .patient-info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .patient-info-item {
      font-size: 10pt;
    }
    .patient-info-item strong {
      color: #475569;
    }
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      color: #10b981;
      background: #ecfdf5;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .section-content {
      padding-left: 12px;
    }
    .subsection {
      margin-bottom: 10px;
    }
    .subsection-title {
      font-weight: 600;
      color: #475569;
      font-size: 10pt;
      margin-bottom: 4px;
    }
    .subsection-content {
      font-size: 10pt;
      color: #334155;
      white-space: pre-wrap;
    }
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .vital-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px;
      text-align: center;
    }
    .vital-label {
      font-size: 8pt;
      color: #64748b;
      text-transform: uppercase;
    }
    .vital-value {
      font-size: 12pt;
      font-weight: 600;
      color: #1e293b;
    }
    .diagnosis-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 8px;
    }
    .diagnosis-code {
      font-weight: 600;
      color: #10b981;
    }
    .diagnosis-desc {
      color: #334155;
    }
    .risk-flag {
      display: inline-block;
      background: #fef2f2;
      color: #dc2626;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9pt;
      margin-right: 5px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 9pt;
      font-weight: 600;
    }
    .status-signed {
      background: #dcfce7;
      color: #16a34a;
    }
    .status-draft {
      background: #fef3c7;
      color: #d97706;
    }
    .signature-block {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .signature-line {
      border-top: 1px solid #1e293b;
      width: 250px;
      margin-top: 40px;
      padding-top: 5px;
    }
    .ai-notice {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 4px;
      padding: 8px;
      margin-top: 10px;
      font-size: 9pt;
      color: #166534;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 9pt;
      color: #64748b;
    }
    @media print {
      body {
        padding: 0;
      }
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Gelani AI Healthcare</h1>
    <p>Clinical Consultation Note</p>
  </div>
  
  <div class="patient-info">
    <h2>${patientName}</h2>
    <div class="patient-info-grid">
      <div class="patient-info-item">
        <strong>MRN:</strong> ${patientMrn}
      </div>
      <div class="patient-info-item">
        <strong>DOB:</strong> ${patientDob}
      </div>
      <div class="patient-info-item">
        <strong>Gender:</strong> ${patientGender}
      </div>
      <div class="patient-info-item">
        <strong>Encounter ID:</strong> ${encounterId}
      </div>
      <div class="patient-info-item">
        <strong>Encounter Date:</strong> ${encounterDate}
      </div>
      <div class="patient-info-item">
        <strong>Status:</strong> <span class="status-badge status-${status}">${status.toUpperCase()}</span>
      </div>
    </div>
  </div>

  <!-- SUBJECTIVE Section -->
  <div class="section">
    <div class="section-title">SUBJECTIVE</div>
    <div class="section-content">
      ${chiefComplaint ? `
        <div class="subsection">
          <div class="subsection-title">Chief Complaint</div>
          <div class="subsection-content">${chiefComplaint}</div>
        </div>
      ` : ''}
      
      ${hpiNarrative ? `
        <div class="subsection">
          <div class="subsection-title">History of Present Illness</div>
          <div class="subsection-content">${hpiNarrative}</div>
        </div>
      ` : ''}
      
      ${rosData && Object.keys(rosData).length > 0 ? `
        <div class="subsection">
          <div class="subsection-title">Review of Systems</div>
          <div class="subsection-content">
            ${Object.entries(rosData)
              .filter(([, value]) => value)
              .map(([system, findings]) => `<strong>${system}:</strong> ${findings}`)
              .join('<br>')}
          </div>
        </div>
      ` : ''}
      
      ${pmhUpdate ? `
        <div class="subsection">
          <div class="subsection-title">Past Medical History</div>
          <div class="subsection-content">${pmhUpdate}</div>
        </div>
      ` : ''}
      
      ${familyHistory ? `
        <div class="subsection">
          <div class="subsection-title">Family History</div>
          <div class="subsection-content">${familyHistory}</div>
        </div>
      ` : ''}
      
      ${socialHistory ? `
        <div class="subsection">
          <div class="subsection-title">Social History</div>
          <div class="subsection-content">${socialHistory}</div>
        </div>
      ` : ''}
      
      <div class="subsection">
        <div class="subsection-title">Allergies Confirmed</div>
        <div class="subsection-content">${allergiesConfirmed ? 'Yes - Verified during this encounter' : 'Pending verification'}</div>
      </div>
    </div>
  </div>

  <!-- OBJECTIVE Section -->
  <div class="section">
    <div class="section-title">OBJECTIVE</div>
    <div class="section-content">
      ${vitals ? `
        <div class="subsection">
          <div class="subsection-title">Vital Signs</div>
          <div class="vitals-grid">
            ${vitals.temperature ? `
              <div class="vital-item">
                <div class="vital-label">Temp</div>
                <div class="vital-value">${vitals.temperature}</div>
              </div>
            ` : ''}
            ${vitals.bloodPressure ? `
              <div class="vital-item">
                <div class="vital-label">BP</div>
                <div class="vital-value">${vitals.bloodPressure}</div>
              </div>
            ` : ''}
            ${vitals.heartRate ? `
              <div class="vital-item">
                <div class="vital-label">HR</div>
                <div class="vital-value">${vitals.heartRate}</div>
              </div>
            ` : ''}
            ${vitals.respiratoryRate ? `
              <div class="vital-item">
                <div class="vital-label">RR</div>
                <div class="vital-value">${vitals.respiratoryRate}</div>
              </div>
            ` : ''}
            ${vitals.oxygenSaturation ? `
              <div class="vital-item">
                <div class="vital-label">SpO2</div>
                <div class="vital-value">${vitals.oxygenSaturation}</div>
              </div>
            ` : ''}
            ${vitals.weight ? `
              <div class="vital-item">
                <div class="vital-label">Weight</div>
                <div class="vital-value">${vitals.weight}</div>
              </div>
            ` : ''}
            ${vitals.height ? `
              <div class="vital-item">
                <div class="vital-label">Height</div>
                <div class="vital-value">${vitals.height}</div>
              </div>
            ` : ''}
            ${vitals.bmi ? `
              <div class="vital-item">
                <div class="vital-label">BMI</div>
                <div class="vital-value">${vitals.bmi}</div>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      
      ${generalAppearance ? `
        <div class="subsection">
          <div class="subsection-title">General Appearance</div>
          <div class="subsection-content">${generalAppearance}</div>
        </div>
      ` : ''}
      
      ${physicalExam && Object.keys(physicalExam).length > 0 ? `
        <div class="subsection">
          <div class="subsection-title">Physical Examination</div>
          <div class="subsection-content">
            ${Object.entries(physicalExam)
              .filter(([, value]) => value)
              .map(([system, findings]) => `<strong>${system}:</strong> ${findings}`)
              .join('<br>')}
          </div>
        </div>
      ` : ''}
      
      ${diagnosticResults ? `
        <div class="subsection">
          <div class="subsection-title">Diagnostic Results</div>
          <div class="subsection-content">${diagnosticResults}</div>
        </div>
      ` : ''}
    </div>
  </div>

  <!-- ASSESSMENT Section -->
  <div class="section">
    <div class="section-title">ASSESSMENT</div>
    <div class="section-content">
      ${primaryDiagnosis ? `
        <div class="subsection">
          <div class="subsection-title">Primary Diagnosis</div>
          <div class="diagnosis-item">
            <span class="diagnosis-code">${primaryDiagnosis.code}</span>
            <span class="diagnosis-desc"> - ${primaryDiagnosis.description}</span>
          </div>
        </div>
      ` : ''}
      
      ${differentials && differentials.length > 0 ? `
        <div class="subsection">
          <div class="subsection-title">Differential Diagnoses</div>
          ${differentials.map(diff => `
            <div class="diagnosis-item">
              <span class="diagnosis-code">${diff.code}</span>
              <span class="diagnosis-desc"> - ${diff.description}</span>
              <span style="color: #64748b; font-size: 9pt;"> (${diff.confidence})</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${clinicalReasoning ? `
        <div class="subsection">
          <div class="subsection-title">Clinical Reasoning</div>
          <div class="subsection-content">${clinicalReasoning}</div>
        </div>
      ` : ''}
      
      ${riskFlags && riskFlags.length > 0 ? `
        <div class="subsection">
          <div class="subsection-title">Risk Flags</div>
          <div class="subsection-content">
            ${riskFlags.map(flag => `<span class="risk-flag">${flag}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  </div>

  <!-- PLAN Section -->
  <div class="section">
    <div class="section-title">PLAN</div>
    <div class="section-content">
      ${investigationsOrdered ? `
        <div class="subsection">
          <div class="subsection-title">Investigations Ordered</div>
          <div class="subsection-content">${investigationsOrdered}</div>
        </div>
      ` : ''}
      
      ${medicationsPrescribed ? `
        <div class="subsection">
          <div class="subsection-title">Medications Prescribed</div>
          <div class="subsection-content">${medicationsPrescribed}</div>
        </div>
      ` : ''}
      
      ${referrals ? `
        <div class="subsection">
          <div class="subsection-title">Referrals</div>
          <div class="subsection-content">${referrals}</div>
        </div>
      ` : ''}
      
      ${patientEducation ? `
        <div class="subsection">
          <div class="subsection-title">Patient Education</div>
          <div class="subsection-content">${patientEducation}</div>
        </div>
      ` : ''}
      
      ${followUp ? `
        <div class="subsection">
          <div class="subsection-title">Follow-Up</div>
          <div class="subsection-content">
            ${followUp.date} via ${followUp.mode}
            ${followUp.clinician ? ` with ${followUp.clinician}` : ''}
          </div>
        </div>
      ` : ''}
      
      ${nursingInstructions ? `
        <div class="subsection">
          <div class="subsection-title">Nursing Instructions</div>
          <div class="subsection-content">${nursingInstructions}</div>
        </div>
      ` : ''}
      
      ${disposition ? `
        <div class="subsection">
          <div class="subsection-title">Disposition</div>
          <div class="subsection-content">${disposition}</div>
        </div>
      ` : ''}
    </div>
  </div>

  ${aiSuggestionsUsed ? `
    <div class="ai-notice">
      <strong>AI Assistance:</strong> This note was created with AI-assisted suggestions. 
      All clinical decisions were reviewed and approved by the signing clinician.
    </div>
  ` : ''}

  ${status === 'signed' && signedBy ? `
    <div class="signature-block">
      <div class="subsection">
        <div class="subsection-title">Electronically Signed</div>
        <div class="subsection-content">
          <strong>${signedBy.name}</strong><br>
          ${signedBy.role} ${signedBy.department ? `- ${signedBy.department}` : ''}<br>
          ${signedAt}
        </div>
      </div>
      <div class="signature-line">
        Digital Signature
      </div>
    </div>
  ` : ''}

  <div class="footer">
    <p>Gelani AI Healthcare Assistant - Clinical Documentation</p>
    <p>Document generated on ${new Date().toLocaleString()}</p>
    <p>This document is confidential and intended for healthcare purposes only.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate filename for SOAP note PDF
 */
export function generatePDFFilename(patientName: string, encounterDate: string): string {
  const sanitizedName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedDate = encounterDate.replace(/[^a-zA-Z0-9]/g, '_');
  return `SOAP_Note_${sanitizedName}_${sanitizedDate}.html`;
}

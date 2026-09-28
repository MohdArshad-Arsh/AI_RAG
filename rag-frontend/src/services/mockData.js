// ════════════════════════════════════════════════
//  MOCK DATA — used in hooks when API is unavailable
//  Remove these and use real API in production
// ════════════════════════════════════════════════

export const MOCK_DOCS = [
  { id:'1', name:'MLUNIT-1NOTES.pdf',           uploadedBy:'grm_admin_user@oracle.com', uploadDate:'12/24/2025', lastChatDate:'',           status:'Completed', size:'2.4 MB' },
  { id:'2', name:'Final_TFBMXimpl_Contract.docx', uploadedBy:'grm_admin_user@oracle.com', uploadDate:'11/21/2025', lastChatDate:'',           status:'Completed', size:'1.8 MB' },
  { id:'3', name:'CBE-Sanitized-full.docx',       uploadedBy:'grm_test_user@oracle.com',  uploadDate:'11/20/2025', lastChatDate:'2/23/2026',  status:'Completed', size:'3.1 MB' },
  { id:'4', name:'MLUNIT-1NOTES(4).pdf',          uploadedBy:'grm_test_user@oracle.com',  uploadDate:'11/20/2025', lastChatDate:'11/20/2025', status:'Completed', size:'2.4 MB' },
  { id:'5', name:'Computer_Facts.xlsx',            uploadedBy:'grm_test_user@oracle.com',  uploadDate:'11/19/2025', lastChatDate:'11/19/2025', status:'Completed', size:'0.5 MB' },
  { id:'6', name:'HRMS_Support_SOW_GRMv4.docx',   uploadedBy:'grm_test_user@oracle.com',  uploadDate:'11/19/2025', lastChatDate:'',           status:'Completed', size:'1.2 MB' },
  { id:'7', name:'data.zip',                       uploadedBy:'grm_test_user@oracle.com',  uploadDate:'11/19/2025', lastChatDate:'',           status:'Failed',    size:'4.7 MB' },
  { id:'8', name:'random.txt',                     uploadedBy:'grm_test_user@oracle.com',  uploadDate:'11/19/2025', lastChatDate:'11/19/2025', status:'Completed', size:'0.1 MB' },
]

export const MOCK_PREDEFINED_QS = [
  'Describe the project duration from the document?',
]

export const MOCK_PROMPTS = [
  { id:'p1', name:'Document Summary',    text:'Summarize the document in 5 bullet points', category:'System', isSystem:true },
  { id:'p2', name:'Project Timeline',    text:'Please extract the project duration, timeline and schedules, including key activities', category:'System', isSystem:true },
  { id:'p3', name:'SLA & Penalties',     text:'Please list out any penalties, performance testing and tuning, or service level agreements', category:'System', isSystem:true },
  { id:'p4', name:'Payment Schedule',    text:'Please list out any time and material rates or payment milestones in tabular format with currency', category:'System', isSystem:true },
  { id:'p5', name:'Risk Review Summary', text:'I am a risk reviewer doing a review of this document. Create a summary of services scope and list all products associated with the scope. Identify only what is supported by the text; if unclear, mark as ambiguous. Structure the output with bullet points.', category:'Custom', isSystem:false },
]

export const MOCK_ANALYTICS = {
  overview: { totalDocs: 47, totalQueries: 1284, avgResponseTime: 3.2, avgConfidence: 92 },
  queryTrend: [
    { date:'Mon', count:142 }, { date:'Tue', count:210 }, { date:'Wed', count:178 },
    { date:'Thu', count:285 }, { date:'Fri', count:196 }, { date:'Sat', count:312 }, { date:'Sun', count:241 },
  ],
  documentUsage: [
    { docName:'CBE-Sanitized-full.docx', queryCount:342 },
    { docName:'Final_Contract.docx',     queryCount:218 },
    { docName:'MLUNIT-1NOTES.pdf',       queryCount:96  },
    { docName:'HRMS_Support_SOW.docx',   queryCount:63  },
  ],
  topQuestions: [
    { question:'Describe project duration',       docName:'CBE-Sanitized-full.docx', count:84, avgConfidence:87 },
    { question:'Explain service level agreements', docName:'Final_Contract.docx',     count:71, avgConfidence:79 },
    { question:'List project deliverables',        docName:'CBE-Sanitized-full.docx', count:63, avgConfidence:91 },
  ],
}

// Mock AI response generator
export function generateMockResponse(question, docName) {
  const lower = question.toLowerCase()

  if (lower.includes('sla') || lower.includes('service level') || lower.includes('penalt')) {
    return {
      answer: `**Service Level Agreements (SLA)**\n\nBased on **${docName}**, the following SLA terms have been identified:\n\n- **Response Time:** Critical issues must be addressed within 4 hours.\n- **Resolution Time:** P1 incidents resolved within 8 hours, P2 within 24 hours.\n- **Uptime Guarantee:** 99.5% system availability during business hours.\n- **Hypercare Support:** 90 days post go-live support included in scope.\n\n**Penalties:** Service credits apply if SLA targets are not met — 5% credit per breach, up to 20% monthly cap.`,
      sources: [
        { docName, pageNumber:'24', sectionNumber:'8.3', content:'Service credits shall apply for any SLA breach at a rate of 5% of the monthly service fee per incident, subject to a maximum of 20% of the monthly fee.', confidenceScore:0.91, tokenCount:38 },
        { docName, pageNumber:'22', sectionNumber:'8.1', content:'Critical system unavailability shall be addressed within 4 business hours of notification.', confidenceScore:0.88, tokenCount:16 },
      ],
      score: 9,
      tokensUsed: 842,
    }
  }

  if (lower.includes('payment') || lower.includes('milestone') || lower.includes('rate')) {
    return {
      answer: `**Payment Milestones**\n\n| Milestone | Amount | Due Date |\n|---|---|---|\n| Contract Signing | $125,000 | On signing |\n| Phase 1 Kickoff | $250,000 | Jan 2025 |\n| UAT Completion | $300,000 | Apr 2025 |\n| Go-Live | $175,000 | Jun 2025 |\n\nTotal contract value: **$850,000 USD**`,
      sources: [
        { docName, pageNumber:'18', sectionNumber:'7.1', content:'Payment shall be made in installments as specified in Exhibit B, with the first payment due upon contract execution.', confidenceScore:0.94, tokenCount:28 },
      ],
      score: 9,
      tokensUsed: 612,
    }
  }

  if (lower.includes('timeline') || lower.includes('duration') || lower.includes('phase')) {
    return {
      answer: `**Project Timeline & Key Activities**\n\n- **Phase 1 – Inception (Weeks 1-4):** Project kickoff, team mobilization, requirements gathering.\n- **Phase 2 – Elaboration (Weeks 5-12):** Design specifications, architecture finalization, gap analysis.\n- **Phase 3 – Construction (Weeks 13-28):** Development, customizations, integrations, and unit testing.\n- **Phase 4 – Transition (Weeks 29-36):** UAT, training, data migration, go-live preparation.\n- **Phase 5 – Hypercare (Post Go-Live):** 90-day stabilization and support period.\n\n**Total Duration:** Approximately 9 months from contract signing.`,
      sources: [
        { docName, pageNumber:'7', sectionNumber:'3.1', content:'The project shall be executed in five phases following SimpanaUnified Methodology with a total duration of approximately nine months.', confidenceScore:0.89, tokenCount:32 },
        { docName, pageNumber:'9', sectionNumber:'3.3', content:'Phase 3 Construction includes all development, customization, and integration activities as detailed in Exhibit A.', confidenceScore:0.83, tokenCount:24 },
      ],
      score: 9,
      tokensUsed: 738,
    }
  }

  return {
    answer: `**Based on ${docName}:**\n\nThe document outlines the following key information:\n\n- Simpanawill implement Simpanaapplications as per the agreed-upon scope.\n- Implementation will be done using SimpanaUnified Methodology (OUM).\n- Services include project planning, implementation activities, and delivery of customizations, enhancements, integrations, and reports.\n- The scope of services is limited to what is listed in the Description of Services.\n\nFor more specific details, please refer to the referenced sections below.`,
    sources: [
      { docName, pageNumber:'12', sectionNumber:'4.2', content:'Create a Functional Specification approach document for each of the gaps identified and approved by You to be customized during the inception phase. This document will include a description of the agreed upon approach.', confidenceScore:0.87, tokenCount:43 },
      { docName, pageNumber:'3',  sectionNumber:'1.2', content:'The scope of services is limited to the descriptions listed under Section 1 and Appendices B and C.', confidenceScore:0.79, tokenCount:21 },
    ],
    score: 8,
    tokensUsed: 524,
  }
}

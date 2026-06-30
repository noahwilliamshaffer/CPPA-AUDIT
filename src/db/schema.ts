/**
 * SHIELDAUDIT DATABASE SCHEMA — SQLite (offline mode)
 *
 * Single-file SQLite database stored at shieldaudit.db.
 * No cloud, no Docker, no server required.
 *
 * Retention requirement: Assessment data and reports must be retained
 * for a minimum of 5 years per Cal. Code Regs. tit. 11, §7123.
 *
 * Immutability requirement: audit_trail_entries is append-only.
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// organizations — root tenant. One row per business using the tool.
// ---------------------------------------------------------------------------
export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  legalEntity: text('legal_entity').notNull(),
  revenueTier: text('revenue_tier'),        // 'under_50m' | '50m_to_100m' | 'over_100m'
  consumerRecordCount: integer('consumer_record_count'),
  contactEmail: text('contact_email').notNull(),
  brandConfig: text('brand_config', { mode: 'json' }),
  internalAuditorReportingStructure: text('internal_auditor_reporting_structure'),
  plan: text('plan').notNull().default('direct'), // 'direct' | 'reseller'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// user_roles — maps a local user ID to a role within an org.
// In offline mode, user_id is always 'local-user'.
// ---------------------------------------------------------------------------
export const userRoles = sqliteTable(
  'user_roles',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').notNull(),
    role: text('role').notNull(), // 'admin' | 'auditor' | 'business_admin' | 'reseller'
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    orgUserIdx: index('user_roles_org_user_idx').on(t.orgId, t.clerkUserId),
  })
);

// ---------------------------------------------------------------------------
// assessments — one per audit engagement.
// ---------------------------------------------------------------------------
export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  auditPeriodStart: text('audit_period_start').notNull(),
  auditPeriodEnd: text('audit_period_end').notNull(),
  status: text('status').notNull().default('draft'), // 'draft' | 'in_progress' | 'scoring' | 'complete' | 'locked'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  auditorId: text('auditor_id'),
  usesAdmt: integer('uses_admt', { mode: 'boolean' }).notNull().default(false),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  lockedAt: integer('locked_at', { mode: 'timestamp' }),
});

// ---------------------------------------------------------------------------
// eligibility_results — coverage determination (auto-provisioned at onboarding).
// ---------------------------------------------------------------------------
export const eligibilityResults = sqliteTable('eligibility_results', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  covered: integer('covered', { mode: 'boolean' }).notNull(),
  triggerFired: text('trigger_fired').notNull(), // 'revenue' | 'consumer_volume' | etc.
  revenueTier: text('revenue_tier'),
  submissionDeadline: text('submission_deadline'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// component_applicability
// ---------------------------------------------------------------------------
export const componentApplicability = sqliteTable(
  'component_applicability',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
    componentNumber: integer('component_number').notNull(),
    applicable: integer('applicable', { mode: 'boolean' }).notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    auditorId: text('auditor_id').notNull(),
    markedAt: integer('marked_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    assessmentComponentIdx: index('component_applicability_assessment_component_idx').on(
      t.assessmentId,
      t.componentNumber
    ),
  })
);

// ---------------------------------------------------------------------------
// questions — seeded 40-question bank across 18 §7123(c) components.
// ---------------------------------------------------------------------------
export const questions = sqliteTable('questions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  componentNumber: integer('component_number').notNull(),
  questionText: text('question_text').notNull(),
  riskWeight: text('risk_weight').notNull(), // 'critical' | 'high' | 'medium' | 'low'
  nistCsfMapping: text('nist_csf_mapping'),         // CSF 2.0 subcategory (e.g. 'PR.AA-01, PR.AA-03')
  cisControlMapping: text('cis_control_mapping'),
  nist80053Mapping: text('nist_800_53_mapping'),    // NIST SP 800-53 Rev 5 controls (e.g. 'IA-2, IA-2(1)')
  parentQuestionId: text('parent_question_id'),     // code of the parent question for conditionals (e.g. 'Q-01')
  triggerCondition: text('trigger_condition', { mode: 'json' }), // { showWhen: string[] } — parent responses that reveal this child
  answerType: text('answer_type').notNull().default('yes_partial_no_na'),
  // 'yes_partial_no_na' | 'yes_no' | 'yes_no_na' | 'open_text' | 'choice'
  options: text('options', { mode: 'json' }),       // [{ value, label }] for 'choice' / extra-option questions
  displayOrder: integer('display_order').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  // Remediation guidance — shown on scoring page for partial/no answers
  remediation: text('remediation'),
});

// ---------------------------------------------------------------------------
// answers — auditor responses. One per question per assessment.
// ---------------------------------------------------------------------------
export const answers = sqliteTable(
  'answers',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
    questionId: text('question_id').notNull().references(() => questions.id),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    auditorId: text('auditor_id').notNull(),
    response: text('response').notNull(), // 'yes'|'partial'|'no'|'not_applicable' | custom token | 'open_text'
    auditorNotes: text('auditor_notes'),
    responseText: text('response_text'),  // free-text answer for open_text questions (e.g. Q-01a)
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    // ── AI-generated answer metadata ──────────────────────────────────────────
    // Set when answer is filled by AI; cleared when a human clicks a response.
    aiGenerated: integer('ai_generated', { mode: 'boolean' }).notNull().default(false),
    aiConfidence: text('ai_confidence'),       // 'high' | 'medium' | 'low' | null
    aiReasoning: text('ai_reasoning'),          // 1-2 sentence explanation from Claude
    needsClientReview: integer('needs_client_review', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({
    assessmentQuestionIdx: uniqueIndex('answers_assessment_question_idx').on(
      t.assessmentId,
      t.questionId
    ),
  })
);

// ---------------------------------------------------------------------------
// evidence_items
// ---------------------------------------------------------------------------
export const evidenceItems = sqliteTable('evidence_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  componentNumber: integer('component_number').notNull(),
  questionId: text('question_id').references(() => questions.id),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  uploadedBy: text('uploaded_by').notNull(),
  description: text('description'),
});

// ---------------------------------------------------------------------------
// test_logs
// ---------------------------------------------------------------------------
export const testLogs = sqliteTable('test_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  componentNumber: integer('component_number').notNull(),
  testName: text('test_name').notNull(),
  methodology: text('methodology').notNull(),
  result: text('result').notNull(), // 'pass' | 'fail' | 'partial'
  conductedAt: text('conducted_at').notNull(),
  findings: text('findings').notNull(),
  auditorId: text('auditor_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// interview_logs
// ---------------------------------------------------------------------------
export const interviewLogs = sqliteTable('interview_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  componentNumber: integer('component_number').notNull(),
  intervieweeTitle: text('interviewee_title').notNull(),
  interviewDate: text('interview_date').notNull(),
  topics: text('topics').notNull(),
  findings: text('findings').notNull(),
  auditorId: text('auditor_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// audit_trail_entries — IMMUTABLE append-only log.
// ---------------------------------------------------------------------------
export const auditTrailEntries = sqliteTable('audit_trail_entries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id').references(() => assessments.id),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  componentNumber: integer('component_number'),
  questionId: text('question_id').references(() => questions.id),
  auditorId: text('auditor_id').notNull(),
  action: text('action').notNull(),
  priorValue: text('prior_value', { mode: 'json' }),
  newValue: text('new_value', { mode: 'json' }),
  evidenceIds: text('evidence_ids'),      // JSON array stored as text
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  ipAddress: text('ip_address'),
});

// ---------------------------------------------------------------------------
// component_scores — calculated risk-weighted scores per component.
// Scoring: Yes=100, Partial=50, No=0. Weights: Crit=4x, High=3x, Med=2x, Low=1x.
// Traffic lights: Red<50, Yellow 50-79, Green≥80.
// ---------------------------------------------------------------------------
export const componentScores = sqliteTable('component_scores', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  componentNumber: integer('component_number').notNull(),
  score: integer('score').notNull(),       // 0–100
  status: text('status').notNull(),        // 'red' | 'yellow' | 'green'
  calculatedAt: integer('calculated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// admt_assessments
// ---------------------------------------------------------------------------
export const admtAssessments = sqliteTable('admt_assessments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  usesAdmtForSignificantDecisions: integer('uses_admt_for_significant_decisions', { mode: 'boolean' }).notNull(),
  significantDecisionTypes: text('significant_decision_types'), // JSON array as text
  biasControls: text('bias_controls'),
  optOutWorkflow: text('opt_out_workflow'),
  humanReviewOverride: integer('human_review_override', { mode: 'boolean' }),
  substantiallyReplacesHuman: integer('substantially_replaces_human', { mode: 'boolean' }),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// gap_records — persistent gaps + remediation plan (§7123(d) Document A
// elements 4 & 6). Generated from no/partial answers; the auditor records a
// remediation plan, target date, and status. One row per (assessment, question).
// ---------------------------------------------------------------------------
export const gapRecords = sqliteTable(
  'gap_records',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
    orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    componentNumber: integer('component_number').notNull(),
    questionId: text('question_id').references(() => questions.id),
    riskWeight: text('risk_weight').notNull(),     // critical | high | medium | low
    response: text('response').notNull(),          // 'no' | 'partial'
    title: text('title').notNull(),
    description: text('description').notNull(),
    remediationPlan: text('remediation_plan'),
    remediationDue: text('remediation_due'),       // target date (YYYY-MM-DD)
    status: text('status').notNull().default('open'), // open | in_progress | resolved | accepted_risk
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  },
  (t) => ({
    gapAssessmentQuestionIdx: uniqueIndex('gap_records_assessment_question_idx').on(t.assessmentId, t.questionId),
  })
);

// ---------------------------------------------------------------------------
// reports — generated Document A and Document B.
// ---------------------------------------------------------------------------
export const reports = sqliteTable('reports', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  pdfUrl: text('pdf_url'),
  docxUrl: text('docx_url'),
  reportType: text('report_type').notNull(), // 'audit_report' | 'executive_certification'
  version: integer('version').notNull().default(1),
});

// ---------------------------------------------------------------------------
// document_uploads — Client-uploaded SSPs and policy documents for AI analysis.
// ---------------------------------------------------------------------------
export const documentUploads = sqliteTable('document_uploads', {
  id:                  text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId:        text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  orgId:               text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fileName:            text('file_name').notNull(),
  filePath:            text('file_path').notNull(),            // absolute local filesystem path
  fileType:            text('file_type').notNull(),             // 'pdf' | 'docx' | 'txt' | 'md'
  fileSizeBytes:       integer('file_size_bytes').notNull(),
  uploadedAt:          integer('uploaded_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  uploadedBy:          text('uploaded_by').notNull(),
  extractedText:       text('extracted_text'),                  // full parsed text (capped at 100K chars)
  readabilityScore:    integer('readability_score'),            // 0–100, set after AI analysis
  readabilityNotes:    text('readability_notes'),               // AI notes on readability
  simplifiedSummary:   text('simplified_summary'),              // AI-generated plain-language summary
  nistControlsCovered: text('nist_controls_covered'),           // JSON: string[] of 800-53 family codes
  analysisStatus:      text('analysis_status').notNull().default('pending'),
  // 'pending' | 'processing' | 'complete' | 'error'
  analysisError:       text('analysis_error'),
});

// ---------------------------------------------------------------------------
// ai_autofill_sessions — ADD-17 AI document ingestion + assessment autofill.
// One row per autofill attempt for an assessment. Uploaded documents are
// processed in-memory and discarded; only name/type/size metadata persists.
// ---------------------------------------------------------------------------
export const aiAutofillSessions = sqliteTable('ai_autofill_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assessmentId: text('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  // 'pending' | 'processing' | 'complete' | 'failed' | 'skipped'
  documentsUploaded: text('documents_uploaded', { mode: 'json' }).notNull().$defaultFn(() => []),
  // [{ name, type, sizeKb, uploadedAt }]
  nistSummaryText: text('nist_summary_text'),         // JSON string of the Call-1 control-family summary
  autofillResults: text('autofill_results', { mode: 'json' }).notNull().$defaultFn(() => []),
  // [{ questionId, suggestedAnswer, confidence, reasoning, sourceDocuments, needsReview }]
  auditorReviewedAt: integer('auditor_reviewed_at', { mode: 'timestamp' }),
  auditorAcceptedCount: integer('auditor_accepted_count').notNull().default(0),
  auditorOverriddenCount: integer('auditor_overridden_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// ---------------------------------------------------------------------------
// app_settings — instance-level configuration (integration tokens, AI key).
// Secret values are encrypted at rest; see src/lib/settings/crypto.ts.
// ---------------------------------------------------------------------------
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  isSecret: integer('is_secret', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const organizationsRelations = relations(organizations, ({ many }) => ({
  userRoles: many(userRoles),
  assessments: many(assessments),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assessments.orgId],
    references: [organizations.id],
  }),
  eligibilityResult: one(eligibilityResults, {
    fields: [assessments.id],
    references: [eligibilityResults.assessmentId],
  }),
  componentApplicability: many(componentApplicability),
  answers: many(answers),
  evidenceItems: many(evidenceItems),
  testLogs: many(testLogs),
  interviewLogs: many(interviewLogs),
  auditTrailEntries: many(auditTrailEntries),
  componentScores: many(componentScores),
  admtAssessment: one(admtAssessments, {
    fields: [assessments.id],
    references: [admtAssessments.assessmentId],
  }),
  reports: many(reports),
  documentUploads: many(documentUploads),
  aiAutofillSessions: many(aiAutofillSessions),
}));

export const documentUploadsRelations = relations(documentUploads, ({ one }) => ({
  assessment: one(assessments, {
    fields: [documentUploads.assessmentId],
    references: [assessments.id],
  }),
  organization: one(organizations, {
    fields: [documentUploads.orgId],
    references: [organizations.id],
  }),
}));

export const aiAutofillSessionsRelations = relations(aiAutofillSessions, ({ one }) => ({
  assessment: one(assessments, {
    fields: [aiAutofillSessions.assessmentId],
    references: [assessments.id],
  }),
  organization: one(organizations, {
    fields: [aiAutofillSessions.orgId],
    references: [organizations.id],
  }),
}));

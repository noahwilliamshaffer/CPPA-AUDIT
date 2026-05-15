/**
 * SHIELDAUDIT DATABASE SCHEMA
 *
 * Multi-tenant PostgreSQL schema with org_id row-level isolation.
 * Every query touching business data MUST filter by org_id.
 *
 * Retention requirement: Assessment data and reports must be retained
 * for a minimum of 5 years per Cal. Code Regs. tit. 11, §7123.
 *
 * Immutability requirement: audit_trail_entries is append-only.
 * No UPDATE or DELETE is ever executed against this table.
 * A DB-level trigger (see migrations/immutable_audit_trail.sql) enforces this.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const revenueTierEnum = pgEnum('revenue_tier', [
  'under_50m',
  '50m_to_100m',
  'over_100m',
]);

export const planEnum = pgEnum('plan', ['direct', 'reseller']);

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'auditor',
  'business_admin',
  'reseller',
]);

export const assessmentStatusEnum = pgEnum('assessment_status', [
  'draft',
  'in_progress',
  'scoring',
  'complete',
  'locked',
]);

export const triggerFiredEnum = pgEnum('trigger_fired', [
  'revenue',
  'consumer_volume',
  'sensitive_volume',
  'data_sales',
  'not_covered',
]);

export const riskWeightEnum = pgEnum('risk_weight', [
  'critical',
  'high',
  'medium',
  'low',
]);

export const answerResponseEnum = pgEnum('answer_response', [
  'yes',
  'partial',
  'no',
  'not_applicable',
]);

export const testResultEnum = pgEnum('test_result', [
  'pass',
  'fail',
  'partial',
]);

export const componentScoreStatusEnum = pgEnum('component_score_status', [
  'red',
  'yellow',
  'green',
]);

export const reportTypeEnum = pgEnum('report_type', [
  'audit_report',
  'executive_certification',
]);

// ---------------------------------------------------------------------------
// organizations — Multi-tenant root. One row per covered business or reseller.
// Every other table is scoped to an org via org_id.
// ---------------------------------------------------------------------------
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  legalEntity: varchar('legal_entity', { length: 255 }).notNull(),
  revenueTier: revenueTierEnum('revenue_tier'),
  consumerRecordCount: integer('consumer_record_count'),
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),
  // JSONB for white-label config: { logo_url, firm_name, firm_color, subdomain }
  brandConfig: jsonb('brand_config'),
  // Per §7122(a)(3): internal auditors must report to exec mgmt not responsible for cybersecurity
  internalAuditorReportingStructure: text('internal_auditor_reporting_structure'),
  plan: planEnum('plan').notNull().default('direct'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// user_roles — RBAC per org. Maps Clerk user_id to role within an org.
// Roles enforce §7122(a)(3) independence requirements.
// ---------------------------------------------------------------------------
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    orgUserIdx: index('user_roles_org_user_idx').on(t.orgId, t.clerkUserId),
  })
);

// ---------------------------------------------------------------------------
// assessments — One per audit engagement per org per audit period.
// Stripe payment gate: status moves to 'locked' after Module 2 completion
// until payment is confirmed.
// ---------------------------------------------------------------------------
export const assessments = pgTable('assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  auditPeriodStart: date('audit_period_start').notNull(),
  auditPeriodEnd: date('audit_period_end').notNull(),
  status: assessmentStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  auditorId: varchar('auditor_id', { length: 255 }), // Clerk user ID
  usesAdmt: boolean('uses_admt').notNull().default(false),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  lockedAt: timestamp('locked_at'),
});

// ---------------------------------------------------------------------------
// eligibility_results — Output of Module 1 screener (§7120).
// Determines coverage, fires the applicable OR-logic trigger, and calculates
// the CPPA submission deadline based on revenue tier.
// ---------------------------------------------------------------------------
export const eligibilityResults = pgTable('eligibility_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  covered: boolean('covered').notNull(),
  // §7120(b): which threshold fired the coverage determination
  triggerFired: triggerFiredEnum('trigger_fired').notNull(),
  revenueTier: revenueTierEnum('revenue_tier'),
  submissionDeadline: date('submission_deadline'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// component_applicability — Auditor marks each of 18 §7123(c) components
// as applicable or not before answering questions.
// Per §7123(c): "if applicable to the business's information system"
// ---------------------------------------------------------------------------
export const componentApplicability = pgTable(
  'component_applicability',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    // component_number 1–18 per §7123(c) enumeration
    componentNumber: integer('component_number').notNull(),
    applicable: boolean('applicable').notNull(),
    auditorId: varchar('auditor_id', { length: 255 }).notNull(),
    markedAt: timestamp('marked_at').notNull().defaultNow(),
  },
  (t) => ({
    assessmentComponentIdx: index('component_applicability_assessment_component_idx').on(
      t.assessmentId,
      t.componentNumber
    ),
  })
);

// ---------------------------------------------------------------------------
// questions — Seeded question bank. 40 questions across 18 §7123(c) components.
// parent_question_id + trigger_condition enable adaptive branching.
// Component order matches §7123(c) exactly (see seed file).
// ---------------------------------------------------------------------------
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // 1–18 matching the §7123(c) enumeration
  componentNumber: integer('component_number').notNull(),
  questionText: text('question_text').notNull(),
  riskWeight: riskWeightEnum('risk_weight').notNull(),
  // e.g., "PR.AC-7", "ID.AM-1"
  nistCsfMapping: varchar('nist_csf_mapping', { length: 50 }),
  // e.g., "CIS 5.1", "CIS 1.1"
  cisControlMapping: varchar('cis_control_mapping', { length: 50 }),
  // FK to self for branching — null means always visible
  parentQuestionId: uuid('parent_question_id'),
  // JSONB condition: { "response": "yes" } means show when parent answer = yes
  triggerCondition: jsonb('trigger_condition'),
  displayOrder: integer('display_order').notNull(),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// answers — Auditor responses to questions. One per question per assessment.
// Saved on every answer change; audit trail entry created on every change.
// ---------------------------------------------------------------------------
export const answers = pgTable(
  'answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    auditorId: varchar('auditor_id', { length: 255 }).notNull(),
    response: answerResponseEnum('response').notNull(),
    // Required when response = 'partial' or 'no' per audit standards
    auditorNotes: text('auditor_notes'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    assessmentQuestionIdx: index('answers_assessment_question_idx').on(
      t.assessmentId,
      t.questionId
    ),
  })
);

// ---------------------------------------------------------------------------
// evidence_items — Files uploaded to the Evidence Locker per component/question.
// Per §7123(e): audit must be based on specific evidence reviewed by the auditor,
// not on management assertions. At least one evidence item OR test log entry
// is required per applicable component before it can be certified.
// ---------------------------------------------------------------------------
export const evidenceItems = pgTable('evidence_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  // 1–18 per §7123(c)
  componentNumber: integer('component_number').notNull(),
  // Optional: links evidence to a specific question within the component
  questionId: uuid('question_id').references(() => questions.id),
  // S3/R2 object key (or mock URL in dev when STORAGE_MODE=mock)
  fileUrl: varchar('file_url', { length: 2048 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }).notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
  description: text('description'),
});

// ---------------------------------------------------------------------------
// test_logs — Auditor-recorded test results per component (Action B).
// At least one test log entry or evidence item required before a component
// can be marked complete per §7123(e).
// ---------------------------------------------------------------------------
export const testLogs = pgTable('test_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  componentNumber: integer('component_number').notNull(),
  testName: varchar('test_name', { length: 255 }).notNull(),
  methodology: text('methodology').notNull(),
  result: testResultEnum('result').notNull(),
  conductedAt: date('conducted_at').notNull(),
  findings: text('findings').notNull(),
  auditorId: varchar('auditor_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// interview_logs — Auditor-recorded interview notes per component (Action C).
// interviewee_title stores TITLE ONLY — never name, per privacy requirements.
// ---------------------------------------------------------------------------
export const interviewLogs = pgTable('interview_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  componentNumber: integer('component_number').notNull(),
  // Title only — never store names. Privacy requirement.
  intervieweeTitle: varchar('interviewee_title', { length: 255 }).notNull(),
  interviewDate: date('interview_date').notNull(),
  topics: text('topics').notNull(),
  findings: text('findings').notNull(),
  auditorId: varchar('auditor_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// audit_trail_entries — IMMUTABLE. Append-only. Every auditor action is logged.
// This table must NEVER have UPDATE or DELETE statements executed against it.
// A DB-level trigger (prevent_audit_trail_mutation) enforces this at the
// database level as a second safety net.
// ---------------------------------------------------------------------------
export const auditTrailEntries = pgTable('audit_trail_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id').references(() => assessments.id),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  componentNumber: integer('component_number'),
  questionId: uuid('question_id').references(() => questions.id),
  auditorId: varchar('auditor_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  // Full prior state stored for complete audit history
  priorValue: jsonb('prior_value'),
  // Full new state stored
  newValue: jsonb('new_value'),
  // Array of evidence item IDs linked at time of action
  evidenceIds: text('evidence_ids').array(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

// ---------------------------------------------------------------------------
// component_scores — Calculated after Module 2 is complete (Module 3 input).
// This table is a cache — scores are recalculated on demand from answers.
// Scoring: Yes=100, Partial=50, No=0, N/A excluded from denominator.
// Risk weights: Critical=4x, High=3x, Medium=2x, Low=1x.
// Traffic lights: Red<50, Yellow 50–79, Green≥80.
// ---------------------------------------------------------------------------
export const componentScores = pgTable('component_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  componentNumber: integer('component_number').notNull(),
  score: integer('score').notNull(), // 0–100
  status: componentScoreStatusEnum('status').notNull(),
  calculatedAt: timestamp('calculated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// admt_assessments — ADMT sub-assessment for AI/significant decisions.
// Triggered when assessment.uses_admt = true.
// Per §7001(ddd): Automated Decision-Making Technology definition.
// Per §7001(e): "Substantially replaces" human decision-making threshold.
// ---------------------------------------------------------------------------
export const admtAssessments = pgTable('admt_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  usesAdmtForSignificantDecisions: boolean(
    'uses_admt_for_significant_decisions'
  ).notNull(),
  // Categories: financial_services, housing, education, employment, healthcare, other
  significantDecisionTypes: text('significant_decision_types').array(),
  biasControls: text('bias_controls'),
  optOutWorkflow: text('opt_out_workflow'),
  humanReviewOverride: boolean('human_review_override'),
  // True if ADMT substantially replaces (vs. merely assists) human decision-making
  substantiallyReplacesHuman: boolean('substantially_replaces_human'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// reports — Generated Document A and Document B records.
// Both documents must be retained for 5 years per §7123.
// ---------------------------------------------------------------------------
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  assessmentId: uuid('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  // S3/R2 URL for the generated PDF
  pdfUrl: varchar('pdf_url', { length: 2048 }),
  // S3/R2 URL for the generated DOCX (for attorney review)
  docxUrl: varchar('docx_url', { length: 2048 }),
  reportType: reportTypeEnum('report_type').notNull(),
  // Version increments each time reports are regenerated for the same assessment
  version: integer('version').notNull().default(1),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const organizationsRelations = relations(organizations, ({ many }) => ({
  userRoles: many(userRoles),
  assessments: many(assessments),
}));

export const assessmentsRelations = relations(
  assessments,
  ({ one, many }) => ({
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
  })
);

// SQLite has no native enum type, so these "enum-like" columns are plain
// strings at the database layer. These arrays are the single source of truth
// for allowed values across zod validation, Prisma writes, and UI labels.

export const ROLES = [
  "EMPLOYEE",
  "MANAGER",
  "DEPT_HEAD",
  "FINANCE",
  "FINAL_APPROVER",
  "PAYMENT_PROCESSOR",
  "HR_ADMIN",
  "SYSTEM_ADMIN",
  "AUDITOR",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Reporting Manager",
  DEPT_HEAD: "Department Head",
  FINANCE: "Accounts & Finance",
  FINAL_APPROVER: "Final Approver",
  PAYMENT_PROCESSOR: "Payment Processor",
  HR_ADMIN: "HR / Admin",
  SYSTEM_ADMIN: "System Administrator",
  AUDITOR: "Auditor / Management Viewer",
};

// Stage types usable in ApprovalStageRule.requiredRole. These are resolution
// strategies, not always actual User.role values: MANAGER/DEPT_HEAD/
// DIVISION_HEAD/PROJECT_MANAGER resolve via relationships (employee's
// manager, department head, division head, claim's project manager) so
// *any* user can fill them; FINANCE/FINAL_APPROVER resolve by finding a user
// who actually holds that Role.
export const STAGE_ROLES = [
  "MANAGER",
  "DEPT_HEAD",
  "DIVISION_HEAD",
  "PROJECT_MANAGER",
  "FINANCE",
  "FINAL_APPROVER",
] as const;
export type StageRole = (typeof STAGE_ROLES)[number];

export const STAGE_ROLE_LABELS: Record<StageRole, string> = {
  MANAGER: "Reporting Manager",
  DEPT_HEAD: "Department Head",
  DIVISION_HEAD: "Division Head",
  PROJECT_MANAGER: "Project Manager",
  FINANCE: "Accounts & Finance",
  FINAL_APPROVER: "Final Approver",
};

// Stages that only apply when the claim/employee actually has that context
// (a division, a linked project) — routed around (SKIPPED) rather than
// blocking submission when absent. MANAGER/DEPT_HEAD/FINANCE/FINAL_APPROVER
// are core stages that must always resolve to someone.
export const OPTIONAL_STAGE_ROLES: StageRole[] = ["DIVISION_HEAD", "PROJECT_MANAGER"];

export const ADMIN_ROLES: Role[] = ["SYSTEM_ADMIN", "HR_ADMIN"];
export const REPORT_ROLES: Role[] = ["FINANCE", "AUDITOR", "SYSTEM_ADMIN", "HR_ADMIN"];
export const AUDIT_VIEW_ROLES: Role[] = ["AUDITOR", "SYSTEM_ADMIN"];
// Roles that need to search/browse claims org-wide (FR-031) rather than just
// their own — e.g. Payment Processor locating APPROVED claims to pay.
export const ORG_WIDE_CLAIM_VIEW_ROLES: Role[] = [
  "PAYMENT_PROCESSOR",
  "FINANCE",
  "FINAL_APPROVER",
  "AUDITOR",
  "SYSTEM_ADMIN",
  "HR_ADMIN",
];

export const CLAIM_TYPES = ["TA", "DA", "FA", "HA", "COMBINED"] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CLAIM_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_MANAGER",
  "PENDING_DEPT_HEAD",
  "PENDING_DIVISION_HEAD",
  "PENDING_PROJECT_MANAGER",
  "PENDING_FINANCE",
  "PENDING_FINAL_APPROVAL",
  "RETURNED",
  "REJECTED",
  "APPROVED",
  "PAYMENT_PROCESSING",
  "PAID",
  "CANCELLED",
  "CLOSED",
  "ON_HOLD",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_MANAGER: "Pending Manager",
  PENDING_DEPT_HEAD: "Pending Department Head",
  PENDING_DIVISION_HEAD: "Pending Division Head",
  PENDING_PROJECT_MANAGER: "Pending Project Manager",
  PENDING_FINANCE: "Pending Finance",
  PENDING_FINAL_APPROVAL: "Pending Final Approval",
  RETURNED: "Returned",
  REJECTED: "Rejected",
  APPROVED: "Approved",
  PAYMENT_PROCESSING: "Payment Processing",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
  ON_HOLD: "On Hold",
};

// Maps a stage role to the claim-level status shown while that stage is active.
export const STAGE_ROLE_TO_STATUS: Record<StageRole, ClaimStatus> = {
  MANAGER: "PENDING_MANAGER",
  DEPT_HEAD: "PENDING_DEPT_HEAD",
  DIVISION_HEAD: "PENDING_DIVISION_HEAD",
  PROJECT_MANAGER: "PENDING_PROJECT_MANAGER",
  FINANCE: "PENDING_FINANCE",
  FINAL_APPROVER: "PENDING_FINAL_APPROVAL",
};

export const APPROVAL_STEP_STATUSES = ["PENDING", "APPROVED", "RETURNED", "REJECTED", "SKIPPED"] as const;
export type ApprovalStepStatus = (typeof APPROVAL_STEP_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CARD", "MOBILE_BANKING", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const HOLIDAY_TYPES = ["NATIONAL", "REGIONAL", "SPECIAL"] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  "LODGING",
  "MEALS",
  "LOCAL_CONVEYANCE",
  "COMMUNICATION",
  "INCIDENTAL",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

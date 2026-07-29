import { z } from "zod";
import { CLAIM_TYPES, EXPENSE_CATEGORIES, HOLIDAY_TYPES, PAYMENT_METHODS, ROLES, STAGE_ROLES } from "./constants";

// Shared zod schemas for Server Action inputs (parsed from FormData, hence
// z.coerce for numbers/dates). Co-located here rather than per-file so the
// admin config forms and claim forms stay consistent.

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const travelSegmentSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  departureAt: z.coerce.date(),
  returnAt: z.coerce.date(),
  mode: z.string().min(1),
  travelClass: z.string().optional(),
  distanceKm: z.coerce.number().nonnegative().optional(),
  ticketNumber: z.string().optional(),
  fare: z.coerce.number().nonnegative().default(0),
  remarks: z.string().optional(),
});

export const expenseLineSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  date: z.coerce.date(),
  description: z.string().optional(),
  amount: z.coerce.number().nonnegative(),
  taxAmount: z.coerce.number().nonnegative().default(0),
});

export const daLineInputSchema = z.object({
  locationCategory: z.string().min(1),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  deduction: z.coerce.number().nonnegative().default(0),
});

export const faLineInputSchema = z.object({
  locationCategory: z.string().min(1),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  deduction: z.coerce.number().nonnegative().default(0),
});

export const haLineInputSchema = z.object({
  holidayCalendarEntryId: z.string().min(1),
  workedHours: z.coerce.number().min(0).max(24),
  isFullDay: z.coerce.boolean().default(true),
  evidenceNote: z.string().optional(),
});

export const newClaimSchema = z.object({
  claimType: z.enum(CLAIM_TYPES),
  purpose: z.string().min(1, "Purpose is required"),
  advanceAmount: z.coerce.number().nonnegative().default(0),
  projectId: z.string().optional(),
  travelSegments: z.array(travelSegmentSchema).default([]),
  expenseLines: z.array(expenseLineSchema).default([]),
  daLines: z.array(daLineInputSchema).default([]),
  faLines: z.array(faLineInputSchema).default([]),
  haLines: z.array(haLineInputSchema).default([]),
});
export type NewClaimInput = z.infer<typeof newClaimSchema>;

export const approvalActionSchema = z.object({
  action: z.enum(["APPROVE", "RETURN", "REJECT"]),
  comments: z.string().optional(),
  financeAdjustedAmount: z.coerce.number().nonnegative().optional(),
});

export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().optional(),
  batch: z.string().optional(),
  amount: z.coerce.number().positive(),
});

export const userFormSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(ROLES),
  departmentId: z.string().optional(),
  divisionId: z.string().optional(),
  designation: z.string().optional(),
  grade: z.string().optional(),
  costCenter: z.string().optional(),
  location: z.string().optional(),
  managerId: z.string().optional(),
});

export const departmentFormSchema = z.object({
  name: z.string().min(1),
  headUserId: z.string().optional(),
});

export const divisionFormSchema = z.object({
  name: z.string().min(1),
  headUserId: z.string().optional(),
});

export const projectFormSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  projectManagerId: z.string().min(1, "A project manager is required"),
});

export const holidayFormSchema = z.object({
  date: z.coerce.date(),
  name: z.string().min(1),
  type: z.enum(HOLIDAY_TYPES),
});

export const allowanceRateFormSchema = z.object({
  grade: z.string().min(1),
  locationCategory: z.string().min(1),
  dailyRate: z.coerce.number().positive(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
});

export const foodAllowanceRateFormSchema = z.object({
  grade: z.string().min(1),
  locationCategory: z.string().min(1),
  dailyRate: z.coerce.number().positive(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
});

export const holidayRateFormSchema = z.object({
  grade: z.string().optional(),
  rate: z.coerce.number().positive(),
  multiplier: z.coerce.number().positive().default(1),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
});

export const approvalStageRuleFormSchema = z.object({
  claimType: z.enum([...CLAIM_TYPES, "ANY"]),
  minAmount: z.coerce.number().nonnegative().default(0),
  maxAmount: z.coerce.number().nonnegative().optional(),
  departmentId: z.string().optional(),
  divisionId: z.string().optional(),
  stageOrder: z.coerce.number().int().nonnegative(),
  requiredRole: z.enum(STAGE_ROLES),
});

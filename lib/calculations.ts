import { prisma } from "./db";

// DA/FA/HA calculation engine (FR-006/FR-007, BR-05/BR-06/BR-07). The BRD's
// own Appendix C lists exact rate tables and formulas as open items pending
// policy workshops, so this reads entirely from admin-configurable
// AllowanceRate/FoodAllowanceRate/HolidayRate/PolicyParameter rows rather
// than hardcoding a formula — seed.ts populates illustrative example rates,
// clearly labeled as such, not assumed-correct policy.

const DEFAULT_FULL_DAY_HOUR_THRESHOLD = 12;

async function getPolicyNumber(key: string, fallback: number): Promise<number> {
  if (!prisma) return fallback;
  const row = await prisma.policyParameter.findUnique({ where: { key } });
  if (!row) return fallback;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Whole days count as 1; a trailing partial day counts as 1 if it clears the
// configured hour threshold (BR-06), else 0.5. Shared by DA and FA, which
// both apply a per-day rate over a date range.
function calculateDurationDays(fromDate: Date, toDate: Date, threshold: number): number {
  const totalHours = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60);
  if (totalHours <= 0) {
    throw new Error("End date/time must be after the start date/time");
  }
  const wholeDays = Math.floor(totalHours / 24);
  const remainderHours = totalHours - wholeDays * 24;
  return wholeDays + (remainderHours >= threshold ? 1 : remainderHours > 0 ? 0.5 : 0);
}

export async function findAllowanceRate(grade: string, locationCategory: string, onDate: Date) {
  if (!prisma) return null;
  const rates = await prisma.allowanceRate.findMany({
    where: {
      grade,
      locationCategory,
      effectiveFrom: { lte: onDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  return rates[0] ?? null;
}

export async function findFoodAllowanceRate(grade: string, locationCategory: string, onDate: Date) {
  if (!prisma) return null;
  const rates = await prisma.foodAllowanceRate.findMany({
    where: {
      grade,
      locationCategory,
      effectiveFrom: { lte: onDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  return rates[0] ?? null;
}

export async function findHolidayRate(grade: string, onDate: Date) {
  if (!prisma) return null;
  const rates = await prisma.holidayRate.findMany({
    where: {
      OR: [{ grade }, { grade: null }],
      effectiveFrom: { lte: onDate },
      AND: { OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }] },
    },
    orderBy: [{ effectiveFrom: "desc" }],
  });
  // Prefer a grade-specific rate over a generic (grade: null) one.
  return rates.find((r) => r.grade === grade) ?? rates[0] ?? null;
}

export type DACalculationInput = {
  grade: string;
  locationCategory: string;
  fromDate: Date;
  toDate: Date;
  deduction?: number;
};

export type DACalculationResult = {
  locationCategory: string;
  fromDate: Date;
  toDate: Date;
  durationDays: number;
  rateApplied: number;
  deduction: number;
  entitledAmount: number;
};

export async function calculateDA(input: DACalculationInput): Promise<DACalculationResult> {
  const threshold = await getPolicyNumber("DA_FULL_DAY_HOUR_THRESHOLD", DEFAULT_FULL_DAY_HOUR_THRESHOLD);
  const durationDays = calculateDurationDays(input.fromDate, input.toDate, threshold);

  const rate = await findAllowanceRate(input.grade, input.locationCategory, input.fromDate);
  const rateApplied = rate?.dailyRate ?? 0;
  const deduction = input.deduction ?? 0;
  const entitledAmount = Math.max(durationDays * rateApplied - deduction, 0);

  return {
    locationCategory: input.locationCategory,
    fromDate: input.fromDate,
    toDate: input.toDate,
    durationDays,
    rateApplied,
    deduction,
    entitledAmount,
  };
}

export type FACalculationInput = DACalculationInput;
export type FACalculationResult = DACalculationResult;

export async function calculateFA(input: FACalculationInput): Promise<FACalculationResult> {
  const threshold = await getPolicyNumber("FA_FULL_DAY_HOUR_THRESHOLD", DEFAULT_FULL_DAY_HOUR_THRESHOLD);
  const durationDays = calculateDurationDays(input.fromDate, input.toDate, threshold);

  const rate = await findFoodAllowanceRate(input.grade, input.locationCategory, input.fromDate);
  const rateApplied = rate?.dailyRate ?? 0;
  const deduction = input.deduction ?? 0;
  const entitledAmount = Math.max(durationDays * rateApplied - deduction, 0);

  return {
    locationCategory: input.locationCategory,
    fromDate: input.fromDate,
    toDate: input.toDate,
    durationDays,
    rateApplied,
    deduction,
    entitledAmount,
  };
}

export type HACalculationInput = {
  grade: string;
  holidayDate: Date;
  holidayType: string;
  workedHours: number;
  isFullDay: boolean;
  evidenceNote?: string;
};

export type HACalculationResult = {
  holidayDate: Date;
  holidayType: string;
  workedHours: number;
  isFullDay: boolean;
  rateApplied: number;
  multiplier: number;
  payableAmount: number;
  evidenceNote: string | null;
};

export async function calculateHA(input: HACalculationInput): Promise<HACalculationResult> {
  const rate = await findHolidayRate(input.grade, input.holidayDate);
  const rateApplied = rate?.rate ?? 0;
  const multiplier = rate?.multiplier ?? 1;
  const payableAmount = rateApplied * multiplier * (input.isFullDay ? 1 : 0.5);

  return {
    holidayDate: input.holidayDate,
    holidayType: input.holidayType,
    workedHours: input.workedHours,
    isFullDay: input.isFullDay,
    rateApplied,
    multiplier,
    payableAmount,
    evidenceNote: input.evidenceNote ?? null,
  };
}

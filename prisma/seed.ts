// Standalone script (run via `npm run db:seed`, executed with tsx) — imports
// use relative paths, not the "@/" tsconfig alias, since tsx doesn't resolve
// it. Only touches lib modules with no next/headers dependency.
import "dotenv/config";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";
import { createDraftClaim, submitClaim } from "../lib/claims";
import { actOnApprovalStep, WorkflowError } from "../lib/workflow";
import { recordPayment } from "../lib/claims";
import type { NewClaimInput } from "../lib/validation";

const DEV_PASSWORD = "Passw0rd!";

async function wipe() {
  await prisma!.notification.deleteMany();
  await prisma!.auditLog.deleteMany();
  await prisma!.payment.deleteMany();
  await prisma!.approvalStep.deleteMany();
  await prisma!.attachment.deleteMany();
  await prisma!.hACalculationLine.deleteMany();
  await prisma!.dACalculationLine.deleteMany();
  await prisma!.fACalculationLine.deleteMany();
  await prisma!.expenseLine.deleteMany();
  await prisma!.travelSegment.deleteMany();
  await prisma!.claim.deleteMany();
  await prisma!.approvalStageRule.deleteMany();
  await prisma!.holidayRate.deleteMany();
  await prisma!.allowanceRate.deleteMany();
  await prisma!.foodAllowanceRate.deleteMany();
  await prisma!.policyParameter.deleteMany();
  await prisma!.holidayCalendarEntry.deleteMany();
  await prisma!.project.deleteMany();
  await prisma!.user.updateMany({ data: { managerId: null, departmentId: null, divisionId: null } });
  await prisma!.department.updateMany({ data: { headUserId: null } });
  await prisma!.division.updateMany({ data: { headUserId: null } });
  await prisma!.department.deleteMany();
  await prisma!.division.deleteMany();
  await prisma!.user.deleteMany();
}

// A tiny placeholder file so seeded claims satisfy the "at least one
// attachment before submission" rule (FR-004/BR-04) without a real upload.
async function seedPlaceholderAttachment(): Promise<string> {
  const uploadRoot = path.join(process.cwd(), "uploads");
  await mkdir(uploadRoot, { recursive: true });
  const storagePath = "seed-placeholder.txt";
  await writeFile(
    path.join(uploadRoot, storagePath),
    "Seed data placeholder — stands in for a real ticket/invoice/attendance attachment.\n",
  );
  return storagePath;
}

async function main() {
  if (!prisma) {
    throw new Error("prisma client is not configured — check lib/db.ts / DATABASE_URL");
  }

  console.log("Wiping existing data...");
  await wipe();

  console.log("Creating departments...");
  const engineering = await prisma.department.create({ data: { name: "Engineering" } });
  const financeDept = await prisma.department.create({ data: { name: "Finance & Accounts" } });
  const hrDept = await prisma.department.create({ data: { name: "Human Resources" } });
  await prisma.department.create({ data: { name: "Sales & Marketing" } });

  console.log("Creating users...");
  const passwordHash = await hashPassword(DEV_PASSWORD);

  await prisma.user.create({
    data: {
      employeeId: "EMP-0001",
      name: "Sadia Rahman",
      email: "admin@erainfotechbd.com",
      passwordHash,
      role: "SYSTEM_ADMIN",
      departmentId: hrDept.id,
      designation: "System Administrator",
    },
  });

  await prisma.user.create({
    data: {
      employeeId: "EMP-0002",
      name: "Nusrat Jahan",
      email: "hr.admin@erainfotechbd.com",
      passwordHash,
      role: "HR_ADMIN",
      departmentId: hrDept.id,
      designation: "HR Manager",
    },
  });

  const financeUser = await prisma.user.create({
    data: {
      employeeId: "EMP-0003",
      name: "Rafiqul Islam",
      email: "finance@erainfotechbd.com",
      passwordHash,
      role: "FINANCE",
      departmentId: financeDept.id,
      designation: "Finance Officer",
    },
  });

  await prisma.user.create({
    data: {
      employeeId: "EMP-0004",
      name: "Farida Yasmin",
      email: "final.approver@erainfotechbd.com",
      passwordHash,
      role: "FINAL_APPROVER",
      departmentId: financeDept.id,
      designation: "Director of Finance",
    },
  });

  await prisma.user.create({
    data: {
      employeeId: "EMP-0005",
      name: "Kamrul Hasan",
      email: "payments@erainfotechbd.com",
      passwordHash,
      role: "PAYMENT_PROCESSOR",
      departmentId: financeDept.id,
      designation: "Payments Officer",
    },
  });

  await prisma.user.create({
    data: {
      employeeId: "EMP-0006",
      name: "Tania Akter",
      email: "auditor@erainfotechbd.com",
      passwordHash,
      role: "AUDITOR",
      departmentId: hrDept.id,
      designation: "Internal Auditor",
    },
  });

  const deptHead = await prisma.user.create({
    data: {
      employeeId: "EMP-0007",
      name: "Mahbubur Rahman",
      email: "depthead@erainfotechbd.com",
      passwordHash,
      role: "DEPT_HEAD",
      departmentId: engineering.id,
      designation: "Head of Engineering",
    },
  });
  await prisma.department.update({ where: { id: engineering.id }, data: { headUserId: deptHead.id } });

  const manager = await prisma.user.create({
    data: {
      employeeId: "EMP-0008",
      name: "Shirin Sultana",
      email: "manager@erainfotechbd.com",
      passwordHash,
      role: "MANAGER",
      departmentId: engineering.id,
      managerId: deptHead.id,
      designation: "Engineering Manager",
    },
  });

  const employee1 = await prisma.user.create({
    data: {
      employeeId: "EMP-0009",
      name: "Arif Hossain",
      email: "employee1@erainfotechbd.com",
      passwordHash,
      role: "EMPLOYEE",
      departmentId: engineering.id,
      managerId: manager.id,
      designation: "Senior Software Engineer",
      grade: "G4",
      costCenter: "CC-ENG-01",
      location: "Dhaka",
    },
  });

  const employee2 = await prisma.user.create({
    data: {
      employeeId: "EMP-0010",
      name: "Mim Akhter",
      email: "employee2@erainfotechbd.com",
      passwordHash,
      role: "EMPLOYEE",
      departmentId: engineering.id,
      managerId: manager.id,
      designation: "Software Engineer",
      grade: "G3",
      costCenter: "CC-ENG-01",
      location: "Dhaka",
    },
  });

  console.log("Creating a division, and a project with its own manager...");
  // Deliberately ordinary roles (MANAGER / EMPLOYEE) — Division Head and
  // Project Manager are resolved by relationship (Division.headUserId,
  // Project.projectManagerId), not by holding a special Role.
  const divisionHead = await prisma.user.create({
    data: {
      employeeId: "EMP-0012",
      name: "Imran Chowdhury",
      email: "divisionhead@erainfotechbd.com",
      passwordHash,
      role: "MANAGER",
      departmentId: engineering.id,
      designation: "VP, Product & Technology",
    },
  });
  const productTechDivision = await prisma.division.create({
    data: { name: "Product & Technology", headUserId: divisionHead.id },
  });

  const projectManagerUser = await prisma.user.create({
    data: {
      employeeId: "EMP-0013",
      name: "Nasrin Akter",
      email: "pm@erainfotechbd.com",
      passwordHash,
      role: "EMPLOYEE",
      departmentId: engineering.id,
      designation: "Lead, Client Portal Revamp",
    },
  });
  const clientPortalProject = await prisma.project.create({
    data: { name: "Client Portal Revamp", code: "PRJ-CPR", projectManagerId: projectManagerUser.id },
  });

  const employee3 = await prisma.user.create({
    data: {
      employeeId: "EMP-0011",
      name: "Kazi Nusrat",
      email: "employee3@erainfotechbd.com",
      passwordHash,
      role: "EMPLOYEE",
      departmentId: engineering.id,
      divisionId: productTechDivision.id,
      managerId: manager.id,
      designation: "Software Engineer",
      grade: "G3",
      costCenter: "CC-ENG-01",
      location: "Dhaka",
    },
  });

  console.log("Creating holiday calendar...");
  const holidays = await Promise.all(
    [
      { date: new Date("2026-02-21"), name: "International Mother Language Day", type: "NATIONAL" },
      { date: new Date("2026-03-26"), name: "Independence Day", type: "NATIONAL" },
      { date: new Date("2026-04-14"), name: "Bengali New Year", type: "NATIONAL" },
      { date: new Date("2026-05-01"), name: "May Day", type: "NATIONAL" },
      { date: new Date("2026-12-16"), name: "Victory Day", type: "NATIONAL" },
    ].map((h) => prisma!.holidayCalendarEntry.create({ data: h })),
  );

  console.log("Creating allowance rates (illustrative — pending real policy sign-off)...");
  const effectiveFrom = new Date("2026-01-01");
  await prisma.allowanceRate.createMany({
    data: [
      { grade: "G3", locationCategory: "DOMESTIC", dailyRate: 1200, effectiveFrom },
      { grade: "G3", locationCategory: "INTERNATIONAL", dailyRate: 6000, effectiveFrom },
      { grade: "G4", locationCategory: "DOMESTIC", dailyRate: 1500, effectiveFrom },
      { grade: "G4", locationCategory: "INTERNATIONAL", dailyRate: 7500, effectiveFrom },
    ],
  });

  await prisma.foodAllowanceRate.createMany({
    data: [
      { grade: "G3", locationCategory: "DOMESTIC", dailyRate: 500, effectiveFrom },
      { grade: "G3", locationCategory: "INTERNATIONAL", dailyRate: 2500, effectiveFrom },
      { grade: "G4", locationCategory: "DOMESTIC", dailyRate: 600, effectiveFrom },
      { grade: "G4", locationCategory: "INTERNATIONAL", dailyRate: 3000, effectiveFrom },
    ],
  });

  await prisma.holidayRate.createMany({
    data: [
      { grade: null, rate: 1000, multiplier: 2, effectiveFrom },
      { grade: "G4", rate: 1300, multiplier: 2, effectiveFrom },
    ],
  });

  await prisma.policyParameter.createMany({
    data: [
      { key: "DA_FULL_DAY_HOUR_THRESHOLD", value: "12" },
      { key: "FA_FULL_DAY_HOUR_THRESHOLD", value: "12" },
    ],
  });

  console.log("Creating approval matrix (Manager -> Division Head -> Dept Head -> Project Manager -> Finance -> Final Approver)...");
  // Division Head and Project Manager apply to every claim type/amount, but
  // are auto-skipped for employees with no division / claims with no
  // project (see lib/workflow.ts) — so this doesn't change the routing for
  // any of the sample claims below that lack one.
  await prisma.approvalStageRule.createMany({
    data: [
      { claimType: "ANY", minAmount: 0, stageOrder: 0, requiredRole: "MANAGER" },
      { claimType: "ANY", minAmount: 0, stageOrder: 1, requiredRole: "DIVISION_HEAD" },
      { claimType: "ANY", minAmount: 5000, stageOrder: 2, requiredRole: "DEPT_HEAD" },
      { claimType: "ANY", minAmount: 0, stageOrder: 3, requiredRole: "PROJECT_MANAGER" },
      { claimType: "ANY", minAmount: 0, stageOrder: 4, requiredRole: "FINANCE" },
      { claimType: "ANY", minAmount: 20000, stageOrder: 5, requiredRole: "FINAL_APPROVER" },
    ],
  });

  console.log("Creating sample claims...");
  const placeholderAttachment = await seedPlaceholderAttachment();

  async function attachPlaceholder(claimId: string, uploadedById: string) {
    await prisma!.attachment.create({
      data: {
        claimId,
        uploadedById,
        filename: "sample-attachment.txt",
        storagePath: placeholderAttachment,
        mimeType: "text/plain",
        size: 90,
      },
    });
  }

  // a) Draft — a DA claim not yet submitted.
  await createDraftClaim(employee1.id, {
    claimType: "DA",
    purpose: "Client workshop in Chattogram",
    advanceAmount: 0,
    travelSegments: [],
    expenseLines: [],
    daLines: [
      { locationCategory: "DOMESTIC", fromDate: new Date("2026-08-10T08:00:00"), toDate: new Date("2026-08-12T20:00:00"), deduction: 0 },
    ],
    faLines: [],
    haLines: [],
  } satisfies NewClaimInput);

  // a2) Submitted, pending at Manager — a standalone Food Allowance claim.
  const foodAllowanceClaim = await createDraftClaim(employee2.id, {
    claimType: "FA",
    purpose: "Meals during client site visit",
    advanceAmount: 0,
    travelSegments: [],
    expenseLines: [],
    daLines: [],
    faLines: [
      { locationCategory: "DOMESTIC", fromDate: new Date("2026-08-06T08:00:00"), toDate: new Date("2026-08-07T20:00:00"), deduction: 0 },
    ],
    haLines: [],
  } satisfies NewClaimInput);
  await attachPlaceholder(foodAllowanceClaim.id, employee2.id);
  await submitClaim(foodAllowanceClaim.id, employee2.id);

  // b) Submitted, pending at Manager — a small TA claim (under the Dept Head threshold).
  const smallTravelClaim = await createDraftClaim(employee2.id, {
    claimType: "TA",
    purpose: "Vendor meeting in Dhaka",
    advanceAmount: 0,
    travelSegments: [
      {
        origin: "Dhaka HQ",
        destination: "Gulshan vendor office",
        departureAt: new Date("2026-08-05T09:00:00"),
        returnAt: new Date("2026-08-05T18:00:00"),
        mode: "CAR",
        fare: 1800,
      },
    ],
    expenseLines: [],
    daLines: [],
    faLines: [],
    haLines: [],
  } satisfies NewClaimInput);
  await attachPlaceholder(smallTravelClaim.id, employee2.id);
  await submitClaim(smallTravelClaim.id, employee2.id);

  // c) Pending at Department Head — approved by Manager already (amount
  // clears the 5,000 threshold that routes through Dept Head).
  const midClaim = await createDraftClaim(employee1.id, {
    claimType: "COMBINED",
    purpose: "Regional client visit — Chattogram",
    advanceAmount: 1000,
    travelSegments: [
      {
        origin: "Dhaka",
        destination: "Chattogram",
        departureAt: new Date("2026-08-15T06:00:00"),
        returnAt: new Date("2026-08-17T20:00:00"),
        mode: "TRAIN",
        fare: 2400,
      },
    ],
    expenseLines: [{ category: "LODGING", date: new Date("2026-08-16"), amount: 3500, taxAmount: 0 }],
    daLines: [
      { locationCategory: "DOMESTIC", fromDate: new Date("2026-08-15T06:00:00"), toDate: new Date("2026-08-17T20:00:00"), deduction: 0 },
    ],
    faLines: [],
    haLines: [],
  } satisfies NewClaimInput);
  await attachPlaceholder(midClaim.id, employee1.id);
  await submitClaim(midClaim.id, employee1.id);
  await approveAsRole(midClaim.id, manager.id);

  // d) Fully approved, ready for payment — large combined claim (goes through all 4 stages).
  const largeClaim = await createDraftClaim(employee1.id, {
    claimType: "COMBINED",
    purpose: "International conference — Singapore",
    advanceAmount: 5000,
    travelSegments: [
      {
        origin: "Dhaka",
        destination: "Singapore",
        departureAt: new Date("2026-09-01T02:00:00"),
        returnAt: new Date("2026-09-05T22:00:00"),
        mode: "AIR",
        travelClass: "Economy",
        fare: 45000,
      },
    ],
    expenseLines: [{ category: "LODGING", date: new Date("2026-09-02"), amount: 18000, taxAmount: 0 }],
    daLines: [
      { locationCategory: "INTERNATIONAL", fromDate: new Date("2026-09-01T02:00:00"), toDate: new Date("2026-09-05T22:00:00"), deduction: 0 },
    ],
    faLines: [],
    haLines: [],
  } satisfies NewClaimInput);
  await attachPlaceholder(largeClaim.id, employee1.id);
  await submitClaim(largeClaim.id, employee1.id);
  await approveAsRole(largeClaim.id, manager.id);
  await approveAsRole(largeClaim.id, deptHead.id);
  await approveAsRole(largeClaim.id, financeUser.id);
  await approveAsRole(largeClaim.id, (await prisma.user.findFirstOrThrow({ where: { role: "FINAL_APPROVER" } })).id);

  // e) Paid — a holiday-work claim, walked all the way through and paid out.
  const haClaim = await createDraftClaim(employee2.id, {
    claimType: "HA",
    purpose: "On-call production support during holiday",
    advanceAmount: 0,
    travelSegments: [],
    expenseLines: [],
    daLines: [],
    faLines: [],
    haLines: [{ holidayCalendarEntryId: holidays[0].id, workedHours: 8, isFullDay: true }],
  } satisfies NewClaimInput);
  await attachPlaceholder(haClaim.id, employee2.id);
  await submitClaim(haClaim.id, employee2.id);
  await approveAsRole(haClaim.id, manager.id);
  await approveAsRole(haClaim.id, financeUser.id);
  await recordPayment({
    claimId: haClaim.id,
    recordedById: (await prisma.user.findFirstOrThrow({ where: { role: "PAYMENT_PROCESSOR" } })).id,
    method: "BANK_TRANSFER",
    reference: "TXN-SEED-0001",
    amount: (await prisma.claim.findUniqueOrThrow({ where: { id: haClaim.id } })).payableAmount,
  });

  // f) Returned — manager sent it back for correction.
  const returnedClaim = await createDraftClaim(employee2.id, {
    claimType: "TA",
    purpose: "Site visit — missing fare details",
    advanceAmount: 0,
    travelSegments: [
      {
        origin: "Dhaka",
        destination: "Narayanganj",
        departureAt: new Date("2026-08-20T09:00:00"),
        returnAt: new Date("2026-08-20T17:00:00"),
        mode: "CAR",
        fare: 900,
      },
    ],
    expenseLines: [],
    daLines: [],
    faLines: [],
    haLines: [],
  } satisfies NewClaimInput);
  await attachPlaceholder(returnedClaim.id, employee2.id);
  await submitClaim(returnedClaim.id, employee2.id);
  await returnCurrentStep(returnedClaim.id, manager.id, "Please attach the vendor meeting minutes.");

  // g) Rejected — policy-ineligible claim.
  const rejectedClaim = await createDraftClaim(employee1.id, {
    claimType: "DA",
    purpose: "Personal trip miscategorized as business",
    advanceAmount: 0,
    travelSegments: [],
    expenseLines: [],
    daLines: [
      { locationCategory: "DOMESTIC", fromDate: new Date("2026-08-25T08:00:00"), toDate: new Date("2026-08-26T20:00:00"), deduction: 0 },
    ],
    faLines: [],
    haLines: [],
  } satisfies NewClaimInput);
  await attachPlaceholder(rejectedClaim.id, employee1.id);
  await submitClaim(rejectedClaim.id, employee1.id);
  await rejectCurrentStep(rejectedClaim.id, manager.id, "Not a business-authorized trip.");

  // h) Pending at Division Head — employee3 is in Product & Technology, so
  // this stage resolves to a real approver instead of being skipped.
  const divisionRoutedClaim = await createDraftClaim(employee3.id, {
    claimType: "TA",
    purpose: "Sprint planning offsite",
    advanceAmount: 0,
    travelSegments: [
      {
        origin: "Dhaka",
        destination: "Gazipur",
        departureAt: new Date("2026-09-08T08:00:00"),
        returnAt: new Date("2026-09-08T19:00:00"),
        mode: "CAR",
        fare: 1200,
      },
    ],
    expenseLines: [],
    daLines: [],
    faLines: [],
    haLines: [],
  } satisfies NewClaimInput);
  await attachPlaceholder(divisionRoutedClaim.id, employee3.id);
  await submitClaim(divisionRoutedClaim.id, employee3.id);
  await approveAsRole(divisionRoutedClaim.id, manager.id);

  // i) Pending at Project Manager — linked to the Client Portal Revamp
  // project, so this stage resolves to that project's manager. Also clears
  // the Dept Head threshold to show that stage firing alongside it.
  const projectRoutedClaim = await createDraftClaim(employee2.id, {
    claimType: "TA",
    purpose: "Client workshop for portal kickoff",
    advanceAmount: 0,
    projectId: clientPortalProject.id,
    travelSegments: [
      {
        origin: "Dhaka",
        destination: "Chattogram",
        departureAt: new Date("2026-09-09T07:00:00"),
        returnAt: new Date("2026-09-10T21:00:00"),
        mode: "TRAIN",
        fare: 6000,
      },
    ],
    expenseLines: [],
    daLines: [],
    faLines: [],
    haLines: [],
  } satisfies NewClaimInput);
  await attachPlaceholder(projectRoutedClaim.id, employee2.id);
  await submitClaim(projectRoutedClaim.id, employee2.id);
  await approveAsRole(projectRoutedClaim.id, manager.id);
  await approveAsRole(projectRoutedClaim.id, deptHead.id);

  console.log("\nSeed complete.");
  console.log(`All seeded users share the password: ${DEV_PASSWORD}`);
  console.log("Sign in as, e.g., employee1@erainfotechbd.com / manager@erainfotechbd.com / finance@erainfotechbd.com / admin@erainfotechbd.com");

  // Helper closures need access to prisma/manager ids in scope above, so
  // they're declared as nested functions rather than hoisted top-level ones.
  async function approveAsRole(claimId: string, approverId: string) {
    const step = await prisma!.approvalStep.findFirstOrThrow({
      where: { claimId, approverId, status: "PENDING" },
    });
    await actOnApprovalStep({ stepId: step.id, actingUserId: approverId, action: "APPROVE", comments: "Approved (seed data)." });
  }

  async function returnCurrentStep(claimId: string, approverId: string, comments: string) {
    const step = await prisma!.approvalStep.findFirstOrThrow({
      where: { claimId, approverId, status: "PENDING" },
    });
    await actOnApprovalStep({ stepId: step.id, actingUserId: approverId, action: "RETURN", comments });
  }

  async function rejectCurrentStep(claimId: string, approverId: string, comments: string) {
    const step = await prisma!.approvalStep.findFirstOrThrow({
      where: { claimId, approverId, status: "PENDING" },
    });
    await actOnApprovalStep({ stepId: step.id, actingUserId: approverId, action: "REJECT", comments });
  }
}

main()
  .catch((err) => {
    if (err instanceof WorkflowError) {
      console.error("Workflow error while seeding:", err.message);
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });

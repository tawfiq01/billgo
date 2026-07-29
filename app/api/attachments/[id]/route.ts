import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readAttachment } from "@/lib/storage";
import { ORG_WIDE_CLAIM_VIEW_ROLES } from "@/lib/constants";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !prisma) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { claim: { include: { approvalSteps: true } } },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = attachment.claim.employeeId === user.id;
  const isApprover = attachment.claim.approvalSteps.some((s) => s.approverId === user.id);
  const canViewOrgWide = ORG_WIDE_CLAIM_VIEW_ROLES.includes(user.role);
  if (!isOwner && !isApprover && !canViewOrgWide) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = await readAttachment(attachment.storagePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
      "Content-Length": String(attachment.size),
    },
  });
}

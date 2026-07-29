// Visual indicator for effective-dated config rows (BR-18/FR-035) — makes it
// obvious at a glance which rate is the one actually in effect right now,
// versus a scheduled future rate or a historical one kept for audit.
export function VersionBadge({ effectiveFrom, effectiveTo }: { effectiveFrom: Date; effectiveTo: Date | null }) {
  const now = new Date();
  let label: string;
  let className: string;

  if (effectiveFrom > now) {
    label = "Future";
    className = "bg-accent/15 text-accent";
  } else if (effectiveTo && effectiveTo < now) {
    label = "Expired";
    className = "bg-background text-muted";
  } else {
    label = "Current";
    className = "bg-success/15 text-success";
  }

  return <span className={`badge ${className}`}>{label}</span>;
}

import type { StatusInfo } from "../lib/status";

export function StatusBadge({ status }: { status: StatusInfo }) {
  return (
    <span className={`badge badge--${status.tone}`} title={status.description}>
      <span className="badge__dot" />
      {status.status}
    </span>
  );
}

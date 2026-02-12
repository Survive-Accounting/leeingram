import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, type LessonStatus } from "@/lib/constants";

export function StatusBadge({ status }: { status: LessonStatus }) {
  return (
    <Badge variant="outline" className={STATUS_COLORS[status]}>
      {status}
    </Badge>
  );
}

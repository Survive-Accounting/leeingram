import { useEmailGate } from "@/contexts/EmailGateContext";

const NAVY = "#14213D";
const RED = "#CE1126";

interface PurchaseBarProps {
  priceCents: number;
  originalPriceCents?: number;
  saleLabel?: string;
  campusId?: string | null;
  campusSlug?: string;
  courseId?: string;
  courseSlug?: string;
  studentEmail?: string;
}

export default function PurchaseBar({
  priceCents,
  originalPriceCents,
  saleLabel,
  courseSlug,
}: PurchaseBarProps) {
  const priceDisplay = `$${Math.round(priceCents / 100)}`;
  const originalDisplay = originalPriceCents ? `$${Math.round(originalPriceCents / 100)}` : null;
  const { requestAccess } = useEmailGate();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t"
      style={{ background: "#fff", borderColor: "#E5E7EB" }}
    >
      <div className="max-w-[780px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-bold" style={{ color: NAVY }}>{priceDisplay}</span>
            {originalDisplay && (
              <span className="text-[14px] line-through" style={{ color: "#9CA3AF" }}>{originalDisplay}</span>
            )}
          </div>
          {saleLabel && (
            <p className="text-[11px] font-medium" style={{ color: RED }}>{saleLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => requestAccess({ course: courseSlug })}
          className="rounded-lg px-6 py-2.5 text-[14px] font-semibold text-white flex items-center gap-2 transition-opacity hover:opacity-90 shrink-0"
          style={{ background: RED, minHeight: 56 }}
        >
          {`Get Full Access – ${priceDisplay}`}
        </button>
      </div>
    </div>
  );
}

/**
 * Helper to build /get-access URLs with campus/course context params.
 *
 * Course slug aliases recognized by GetAccess.tsx:
 *   intro-1, intro-accounting-1, accy-201
 *   intro-2, intro-accounting-2, accy-202
 *   ia1,    intermediate-accounting-1, accy-303
 *   ia2,    intermediate-accounting-2, accy-304
 */
export function buildGetAccessUrl(opts?: {
  campus?: string | null;
  course?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts?.campus) params.set("campus", opts.campus);
  if (opts?.course) params.set("course", opts.course);
  const qs = params.toString();
  return qs ? `/get-access?${qs}` : "/get-access";
}

/**
 * Build an iframe embed code for a v2 teaching asset.
 * Used by the V2 Control Panel for fast LearnWorlds copy/paste.
 */
const STUDENT_BASE_URL = "https://learn.surviveaccounting.com";

export function buildV2IframeCode(assetCode: string): string {
  return `<iframe src="${STUDENT_BASE_URL}/v2/solutions/${assetCode}" width="100%" height="900" frameborder="0" style="border:0;"></iframe>`;
}

export function buildV2LiveUrl(assetCode: string): string {
  return `${STUDENT_BASE_URL}/v2/solutions/${assetCode}`;
}

export function buildV2PreviewUrl(assetCode: string): string {
  // Preview opens within current origin so admin debug overlay is reachable.
  return `/v2/solutions/${assetCode}?mode=preview`;
}

export function buildV2Title(chapterNumber: number | null, sourceRef: string | null): string {
  const ref = sourceRef || "";
  if (chapterNumber == null) return ref;
  return `Ch${chapterNumber} — ${ref}`;
}

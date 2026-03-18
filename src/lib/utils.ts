import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Natural sort comparator for source refs like "BE16.1", "BE16.10", "E16.2" */
export function naturalSortRef(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const pa = a.match(re) || [];
  const pb = b.match(re) || [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (i >= pa.length) return -1;
    if (i >= pb.length) return 1;
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    if (!isNaN(na) && !isNaN(nb)) {
      if (na !== nb) return na - nb;
    } else {
      const cmp = pa[i].localeCompare(pb[i]);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

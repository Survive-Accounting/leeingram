## Goal

Deduplicate JE Helper cards so each unique configuration of debited/credited accounts appears only once per chapter. Amounts and dates don't affect uniqueness — only the set/order of accounts and their sides.

## Approach

Inside `flattenAssets` in `src/components/study-previewer/JEHelperPanel.tsx`, build a signature for each entry using only account names + sides (D/C), and skip any entry whose signature has already been seen.

```ts
function entrySignature(rows: CanonicalJERow[]): string {
  return rows
    .map((r) => {
      const side = (r.credit != null && r.credit !== 0) ? "C" : "D";
      return `${side}:${(r.account_name || "").trim().toLowerCase()}`;
    })
    .join("|");
}
```

Then in the loop:
- Maintain a `Set<string>` of seen signatures.
- For each entry, compute the signature; if already seen, `return` (skip).
- Otherwise add to set and push the entry as today.

Order is preserved (first occurrence wins), so the source button on each card points to the earliest problem that uses that JE shape — which matches the user's examples (e.g. lease-receivable + COGS + sales + inventory shows once on the first problem that introduces it).

## Why account+side only (not amounts)

Per the user: "Each configuration of debited/credited accounts should only show once." Amounts are placeholders (`???`) anyway, so two cards with the same accounts but different numbers would look identical to a student.

## Files

- **edit** `src/components/study-previewer/JEHelperPanel.tsx` — add `entrySignature` helper and a `seen` Set inside `flattenAssets`.

## Out of scope

- No DB changes.
- No edge-function changes — fewer entries also means fewer label-generation calls (cheaper, faster).
- No UI changes; cards render exactly as they do today, just deduped.

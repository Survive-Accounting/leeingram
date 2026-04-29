## Why "No entry builder set found" appears

The Journal Entry Helper tile in the Study Previewer iframes the **legacy** `/tools/entry-builder?chapter_id=…` page (`StudyPreviewer.tsx` line 813). That page (`src/pages/EntryBuilderTool.tsx` line 89) queries the `entry_builder_sets` table — a separate manually-curated dataset that doesn't exist for most chapters yet. When no row is found it bails with `setError("No entry builder set found")`, which is exactly the red banner in your screenshot.

Meanwhile the new V2 viewer (`/v2/solutions/:assetCode`) already renders Journal Entries beautifully — it's the same component the Practice Problem Helper uses, just with the JE accordion as one of its sections. We should point the JE Helper at that instead.

---

## Fix

Reuse the V2 SolutionsViewer for the JE Helper, deep-linked to the chapter's first JE-bearing asset with the JE accordion auto-opened. No dependency on `entry_builder_sets`.

### 1. `src/pages/v2/SolutionsViewerV2.tsx` — accept `?focus=je`

In the existing `searchParams` block (line ~2418-2420), read a new param:

```tsx
const focusJE = searchParams.get("focus") === "je";
```

Where the JE accordion is rendered (the section that opens `<StructuredJEDisplay data={asset.journal_entry_completed_json} />` around line 1731-1740), default its `open` state to `true` when `focusJE` is set. Also scroll-into-view on first mount when `focusJE` is true so the student lands on the JEs without hunting.

### 2. `src/components/study-previewer/StudyPreviewer.tsx` — pick a JE-bearing asset and re-point the iframe

**a. New state alongside `viewerAssetCode` (line 112):**
```tsx
const [jeAssetCode, setJeAssetCode] = useState<string | null>(null);
```

**b. Update the two asset-fetch blocks** (the localStorage hydrator at lines 139-150 and `handleChapterChange` at lines 204-211) to fire two parallel queries — first asset, and first asset where `journal_entry_completed_json IS NOT NULL`. Fallback to the first asset if no JE-bearing asset exists in the chapter:

```ts
const [firstRes, jeRes] = await Promise.all([
  supabase.from("teaching_assets")
    .select("asset_name, source_number")
    .eq("chapter_id", chId)
    .order("source_number", { ascending: true, nullsFirst: false })
    .order("asset_name", { ascending: true })
    .limit(1),
  supabase.from("teaching_assets")
    .select("asset_name, source_number")
    .eq("chapter_id", chId)
    .not("journal_entry_completed_json", "is", null)
    .order("source_number", { ascending: true, nullsFirst: false })
    .order("asset_name", { ascending: true })
    .limit(1),
]);
const first = firstRes.data?.[0]?.asset_name ?? null;
const firstJe = jeRes.data?.[0]?.asset_name ?? first;
setViewerAssetCode(first);
setJeAssetCode(firstJe);
```

Also clear `jeAssetCode` everywhere `viewerAssetCode` is cleared (the home-message handler at line 172, the `resetSignal` effect at line 158, the empty-chapter branch at 188, and `handleCourseChange` at 230).

**c. Replace the JE Helper iframe block** (lines 802-826) so it points at the V2 viewer with `focus=je`, and shows the same "chapter being finalized" empty state as Practice when no JE asset exists:

```tsx
{activeTool === "je" && jeAssetCode && !iframeError && (
  <>
    {!iframeLoaded && (
      <BrandedLoader
        surface="navy"
        subtitle={showSlowStatus ? "Preparing tool…" : undefined}
      />
    )}
    <iframe
      key={`je-${jeAssetCode}-${iframeReloadKey}`}
      src={`/v2/solutions/${encodeURIComponent(jeAssetCode)}?focus=je`}
      title="Journal Entry Helper"
      className="w-full block border-0 relative z-10"
      style={{ height: "min(85vh, 980px)", background: "#fff" }}
      onLoad={() => { setIframeLoaded(true); setStageLockHeight(null); }}
      onError={() => setIframeError(true)}
    />
  </>
)}

{activeTool === "je" && selectedChapterId && !jeAssetCode && (
  <div className="flex items-center justify-center text-center px-6 py-24">
    <p className="text-[14px]" style={{ color: "#64748B" }}>
      No journal entries available for this chapter yet — try another chapter.
    </p>
  </div>
)}
```

The error-retry and "pick a chapter first" branches stay as-is, just gated on `jeAssetCode` instead of the legacy route.

---

## Result

- "Journal Entry Helper" now opens the same polished V2 viewer the Practice Problem Helper uses, jumped straight to the Journal Entries section.
- The dead `/tools/entry-builder` legacy page is no longer referenced from the previewer (we leave the route in place; nothing else links to it for students).
- Chapters without any JE-bearing asset show a clean "No journal entries available… try another chapter" message instead of the red error banner.

// Style Export utilities — collects design tokens, landing page code, and
// generates downloadable bundles (ZIP / Markdown) + PNG snapshots of sections.
import JSZip from "jszip";
import { toPng } from "html-to-image";

const RAW = "/__raw_text__/"; // sentinel — not used; we fetch via fetch()

/** Files included in the "Full landing page bundle". Edit this list to add more. */
export const BUNDLE_FILES = [
  // Design tokens & global styles
  "tailwind.config.ts",
  "src/index.css",
  // Page entry
  "src/pages/StagingLandingPage.tsx",
  // Landing components used by the staging page
  "src/components/landing/StagingNavbar.tsx",
  "src/components/landing/StagingHero.tsx",
  "src/components/landing/StagingTestimonialsSection.tsx",
  "src/components/landing/StagingCoursesSection.tsx",
  "src/components/landing/StagingFinalCtaSection.tsx",
  "src/components/landing/StagingEmailPromptModal.tsx",
  "src/components/landing/StagingGetStartedModal.tsx",
  "src/components/landing/StagingCtaModal.tsx",
  "src/components/landing/ContactForm.tsx",
  "src/components/landing/LandingFooter.tsx",
  "src/components/landing/CourseCard.tsx",
  "src/components/landing/AnimatedArrow.tsx",
];

async function fetchProjectFile(path: string): Promise<string> {
  // Vite dev server serves source files at their literal path.
  // In production preview Vite still serves them under /@fs or via the dev middleware,
  // so we fall back to a graceful error string.
  try {
    const res = await fetch(`/${path}`);
    if (res.ok) {
      const text = await res.text();
      // Vite sometimes transforms TSX — detect and warn
      if (text.startsWith("import { createHotContext")) {
        return `// ⚠️ Vite returned a transformed module for ${path}.\n// Open the file directly in your repo to copy the source.`;
      }
      return text;
    }
  } catch { /* noop */ }
  return `// ⚠️ Could not fetch ${path} from dev server.\n// Open the file in your project source to copy it manually.`;
}

export async function collectBundleFiles(): Promise<Record<string, string>> {
  const entries = await Promise.all(
    BUNDLE_FILES.map(async (p) => [p, await fetchProjectFile(p)] as const),
  );
  return Object.fromEntries(entries);
}

/** Extract the design tokens (CSS vars + tailwind theme colors) into a compact JSON. */
export function extractDesignTokens(indexCss: string): {
  cssVariables: Record<string, string>;
  brandHints: { navy: string; red: string; bodyFont: string; displayFont: string };
} {
  const vars: Record<string, string> = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(indexCss)) !== null) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return {
    cssVariables: vars,
    brandHints: {
      navy: "#14213D",
      red: "#CE1126",
      bodyFont: "Inter",
      displayFont: "DM Serif Display",
    },
  };
}

/** Build a single Markdown brief — perfect for pasting into ChatGPT. */
export async function buildMarkdownBrief(): Promise<string> {
  const files = await collectBundleFiles();
  const tokens = extractDesignTokens(files["src/index.css"] ?? "");

  const header = `# Survive Accounting — Landing Page Style Pack

> Drop-in design system + landing page code for replicating the Survive
> Accounting landing aesthetic across other Lovable projects.

## Brand
- Primary navy: \`${tokens.brandHints.navy}\`
- Accent red: \`${tokens.brandHints.red}\`
- Body font: ${tokens.brandHints.bodyFont}
- Display font: ${tokens.brandHints.displayFont}

## CSS Variables (from \`src/index.css\`)
\`\`\`json
${JSON.stringify(tokens.cssVariables, null, 2)}
\`\`\`

## Files
${Object.keys(files).map((p) => `- \`${p}\``).join("\n")}

---
`;

  const body = Object.entries(files)
    .map(([path, contents]) => {
      const ext = path.split(".").pop() || "";
      const lang =
        ext === "tsx" ? "tsx" :
        ext === "ts" ? "ts" :
        ext === "css" ? "css" :
        ext === "json" ? "json" : "";
      return `\n## \`${path}\`\n\n\`\`\`${lang}\n${contents}\n\`\`\`\n`;
    })
    .join("\n");

  return header + body;
}

/** Build a ZIP that mirrors the project folder structure. */
export async function buildZipBundle(): Promise<Blob> {
  const files = await collectBundleFiles();
  const zip = new JSZip();

  // Add a README at the root explaining how to use the bundle.
  zip.file(
    "README.md",
    `# Survive Accounting — Landing Style Pack

Unzip this into a fresh Lovable project to inherit the same landing aesthetic.

## What's included
${Object.keys(files).map((p) => `- ${p}`).join("\n")}

## Steps
1. Replace your project's \`tailwind.config.ts\` and \`src/index.css\` with the ones here.
2. Copy \`src/components/landing/*\` into the same path in the new project.
3. Copy \`src/pages/StagingLandingPage.tsx\` and wire it as the root route.
4. You may need to stub out app-specific imports (auth context, Supabase calls,
   tracking hooks). Look for \`useAuth\`, \`supabase\`, \`useEventTracking\`.

Generated: ${new Date().toISOString()}
`,
  );

  for (const [path, contents] of Object.entries(files)) {
    zip.file(path, contents);
  }

  return zip.generateAsync({ type: "blob" });
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime = "text/plain") {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

// ---------- PNG capture ----------

export interface ExportableSection {
  id: string;
  label: string;
  element: HTMLElement;
}

/** Find every section on the page tagged with `data-export-id`. */
export function findExportableSections(): ExportableSection[] {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-export-id]"),
  );
  return nodes.map((el) => ({
    id: el.dataset.exportId || "section",
    label: el.dataset.exportLabel || el.dataset.exportId || "Section",
    element: el,
  }));
}

/** Capture a single element to a PNG Blob (no download). */
export async function captureElementToBlob(
  el: HTMLElement,
  opts: { pixelRatio?: number; backgroundColor?: string } = {},
): Promise<Blob> {
  const dataUrl = await toPng(el, {
    pixelRatio: opts.pixelRatio ?? 2,
    backgroundColor: opts.backgroundColor ?? "#F8FAFC",
    cacheBust: true,
    filter: (node) => {
      if (node instanceof HTMLElement && node.dataset.exportIgnore != null) {
        return false;
      }
      return true;
    },
  });
  return (await fetch(dataUrl)).blob();
}

/** Copy a PNG blob to the clipboard. Returns true on success. */
export async function copyPngBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      return false;
    }
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Capture an element and copy the PNG to the clipboard. */
export async function captureElementToClipboard(
  el: HTMLElement,
  opts: { pixelRatio?: number; backgroundColor?: string } = {},
): Promise<boolean> {
  const blob = await captureElementToBlob(el, opts);
  return copyPngBlobToClipboard(blob);
}

/** Capture the full landing page and copy to clipboard. */
export async function captureFullPageToClipboard(): Promise<boolean> {
  const root =
    document.querySelector<HTMLElement>("[data-export-page]") ||
    document.querySelector<HTMLElement>("main") ||
    document.body;
  return captureElementToClipboard(root);
}

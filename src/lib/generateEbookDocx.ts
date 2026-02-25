import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";

type EbookAsset = {
  id: string;
  asset_name: string;
  survive_problem_text: string;
  survive_solution_text: string;
  journal_entry_block: string | null;
  course_slug: string;
  chapter_number: number;
  chapter_name: string;
};

function placeholderBlock(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
    },
    children: [
      new TextRun({ text: `[ ${label} ]`, color: "888888", italics: true, size: 20 }),
    ],
  });
}

export async function generateEbookDocx(assets: EbookAsset[]) {
  // Group by chapter
  const byChapter = new Map<string, EbookAsset[]>();
  for (const a of assets) {
    const key = `${a.course_slug}_CH${a.chapter_number}`;
    if (!byChapter.has(key)) byChapter.set(key, []);
    byChapter.get(key)!.push(a);
  }

  const children: Paragraph[] = [];

  for (const [, group] of byChapter) {
    const first = group[0];
    const courseTag = first.course_slug.toUpperCase().replace(/-/g, "_");
    const chTag = `CH${first.chapter_number}`;

    // Chapter heading
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({
            text: `Chapter ${first.chapter_number} — ${first.chapter_name}`,
            bold: true,
            size: 32,
          }),
        ],
      })
    );

    for (const asset of group) {
      const pid = asset.id.slice(0, 8).toUpperCase();

      // Topic title
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
          children: [new TextRun({ text: asset.asset_name, bold: true, size: 26 })],
        })
      );

      // Practice Problem Prompt
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: "Practice Problem", bold: true, size: 22 })],
        })
      );
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: asset.survive_problem_text || "—", size: 20 })],
        })
      );

      // Solution
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: "Solution Explanation", bold: true, size: 22 })],
        })
      );
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: asset.survive_solution_text || "—", size: 20 })],
        })
      );

      // Journal Entry (if applicable)
      if (asset.journal_entry_block) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 80 },
            children: [new TextRun({ text: "Journal Entry", bold: true, size: 22 })],
          })
        );
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: asset.journal_entry_block, size: 20, font: "Courier New" })],
          })
        );
      }

      // Placeholders
      children.push(placeholderBlock(`VIDEO_PLACEHOLDER_${courseTag}_${chTag}_${pid} — Concept Video`));
      children.push(placeholderBlock(`VIDEO_PLACEHOLDER_${courseTag}_${chTag}_${pid} — Problem Walkthrough Video`));
      children.push(placeholderBlock(`GOOGLE_SHEET_PLACEHOLDER_${pid} — Practice Workspace`));
      children.push(placeholderBlock(`DOWNLOAD_PLACEHOLDER_${pid} — Downloadable Solutions PDF`));

      // Separator
      children.push(new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  saveAs(blob, `LearnWorlds_eBook_${date}.docx`);
}

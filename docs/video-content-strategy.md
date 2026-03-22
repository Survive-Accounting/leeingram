# Video Content Strategy — Phase 2

## Overview

Phase 2 video production turns locked topics into short, high-value instructional videos. The goal is speed and consistency — a tight repeatable format that can be filmed in sprints and pushed through editing quickly.

**Target**: 5–6 videos per chapter (one per topic + one chapter intro)

---

## Video Types

### 1. Chapter Intro Video
A 2–3 minute kickoff that orients students before they dive into topic videos.

Contents:
- What this chapter covers and why it matters for the exam
- Quick overview of the 5–6 topics
- Where to find the tools (Cram Tool, Solutions pages)
- "Here's how to use this chapter"

### 2. Topic Video (core format)
One per locked topic. Target length: **4–5 minutes**.

---

## Topic Video Format (Consistent Template)

```
0:00 - 0:30  Hook
"Here's what [Topic] is actually about 
and why it shows up on every exam"

0:30 - 2:00  The JEs you need to know
Screen share: Chapter Cram Tool (topic-filtered)
Walk through 3–4 key journal entries
"Notice the tooltip — here's WHY we debit this account"

2:00 - 3:30  The problem pattern
Screen share: Solutions Viewer example asset
Show problem dissector highlights
"These are the numbers that change everything — 
watch for these"

3:30 - 4:30  Formulas to remember
Screen share: Formulas section
Quick hit — 1–2 key formulas

4:30 - 5:00  Wrap + CTA
"Test yourself with the quiz below.
Use the Cram Tool to drill the JEs."
```

---

## AI Script Generation

Scripts are auto-generated from topic data already in the database:

Input data available per topic:
- `topic_name`
- `topic_description`
- `topic_rationale`
- Tagged teaching assets (problem titles, source refs)
- Journal entries from those assets (`supplementary_je_json`)
- Formulas from those assets
- Exam traps from those assets

The Video Queue page (`/video-queue`) will include a "Generate Script" button per topic that calls Claude to produce a structured script outline from this data.

Lee reviews and lightly edits, then films.

---

## Slide Generation

Videos use screen-shared slides as a visual backdrop.

**Format**: HTML presentation (single file, screen-shared during recording)

Why HTML over Google Slides:
- Can embed live tool pages (Solutions Viewer, Cram Tool) as iframes
- Generated instantly from topic data
- No API setup
- Clean branded output
- Perfect for screen recording

Slides are generated per topic alongside the script.

---

## Filming Approach

- Screen share slides/tools + Lee on camera (corner)
- Tools shown live: Chapter Cram Tool, Solutions Viewer, Problem Dissector
- Goal: students see the tools in action, not just hear about them
- This drives tool adoption organically

---

## Production Pipeline

```
Topics Locked
    ↓
Generate Script (AI, per topic)
    ↓
Lee Reviews + Edits Script
    ↓
Generate Slides (AI, from script)
    ↓
Film (sprint — batch multiple topics)
    ↓
Edit (VA handles)
    ↓
Upload to LearnWorlds
    ↓
Paste LW video URL into topic record
    ↓
Video Queue status = complete
```

---

## Video Queue (`/video-queue`)

Admin tabs:
- **Pending**: Topics with `video_url` empty — shows script + slides generation buttons
- **Ready**: Topics with `video_url` filled — ready for LW upload

VA tabs: Coming soon placeholder.

---

## Consistency Rules

Every video must:
- Start by showing the Cram Tool or Solutions page (tool-first)
- Use the same intro/outro format
- Be 4–5 minutes (topic) or 2–3 minutes (chapter intro)
- Reference "the quiz below" as CTA at the end
- Never exceed 6 minutes

---

## Future: Topic Cram Tool Embed in Video

A topic-scoped Cram Tool (only JEs from that topic's assets) could be embedded directly into LearnWorlds as a companion to each topic video. This is not yet built but is planned as a high-value student feature.



# Survive Accounting Content Factory

A lightweight internal production pipeline for a solo accounting course creator to mass-produce exam-prep lessons, videos, and worksheets.

---

## 1. Backend Setup (Lovable Cloud)

Set up the database with these tables and relationships:
- **Courses** — name, slug
- **Chapters** — linked to course, chapter name & number
- **Lessons** — linked to course & chapter, title, status enum (Planning → Sheet Generated → Filming → Editing → Published)
- **Chapter Resources** — file uploads linked to chapter (textbook, solutions, tutoring notes, transcripts, other)
- **Lesson Plans** — stores questionnaire answers + AI-generated content (lesson plan, problem list, video outline)
- **Google Sheets** — stores sheet URL per lesson

Seed all 4 courses and their chapters (Financial Accounting, Managerial Accounting, Intermediate 1, Intermediate 2) with the exact chapter lists provided.

File uploads will use Lovable Cloud Storage (not stored in the database — only URLs stored).

---

## 2. Dashboard Page (Home)

- List all 4 courses as cards
- Clicking a course expands/navigates to show its chapters
- Each chapter shows lesson count and status summary
- Quick "Create Lesson" button accessible from the dashboard
- Clean, minimal layout optimized for daily use

---

## 3. Chapter Page

- Shows chapter title and course context
- **Uploaded Resources** section — list of uploaded files (PDFs, transcripts, notes) with file type labels
- **Upload Resource** button — file upload with type selector (textbook / solutions / tutoring / transcript / other)
- **Lessons list** — all lessons for this chapter with their current status
- **Create Lesson** button

---

## 4. Create Lesson Flow

**Step 1: Basics**
- Select course & chapter (pre-filled if navigating from a chapter)
- Enter lesson title

**Step 2: Lesson Planning Questionnaire**
A guided form with these 7 questions:
1. What topic are you trying to teach?
2. How do you explain this concept conceptually?
3. What formulas, journal entries, or steps must students memorize?
4. What common mistakes should students watch for?
5. What textbook problems should this lesson focus on?
6. Why are these problems tricky on exams?
7. Any additional teaching notes?

Answers saved to Lesson Plans table.

**Step 3: Generate Lesson Plan (AI)**
- Button: "Generate Lesson Plan"
- Uses Lovable AI to produce:
  - Lesson Summary
  - Problem Breakdown
  - Video Outline (always follows the 5-segment structure: Concept → Show Solution → Rework Step-by-Step → Exam Tips → Wrap Up)
- Output displayed and stored in the database
- User can regenerate if needed

**Step 4: Generate Google Sheet**
- Button: "Generate Google Sheet"
- MVP: creates a placeholder entry with a simulated URL
- Displays a note: *"Future: will connect to Google Sheets API using a template"*

---

## 5. Lesson Detail / Status Tracking

- View all lesson plan content (questionnaire answers, generated plan, video outline)
- **Status dropdown** to manually move through the pipeline: Planning → Sheet Generated → Filming → Editing → Published
- Google Sheet link (when generated)
- Visual pipeline indicator showing current stage

---

## 6. Future Integration Placeholders

Visible but non-functional placeholders in the UI noting planned integrations:
- Google Drive / Sheets API
- Vimeo transcript import
- Descript automation
- LearnWorlds publishing

---

## 7. Design & UX

- Minimal, clean dashboard — no unnecessary decoration
- Fast navigation between courses, chapters, and lessons
- Status badges/chips for lesson pipeline stages
- Lightweight feel optimized for daily production use
- Responsive but desktop-first (this is an internal tool)


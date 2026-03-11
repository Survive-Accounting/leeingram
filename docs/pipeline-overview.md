# Teaching Asset Pipeline — System Overview

## Purpose

The Teaching Asset Pipeline is the production system used to generate, review, and deploy accounting teaching assets.

The pipeline is designed to allow Survive Accounting to produce **hundreds to thousands of teaching assets efficiently** using a combination of automation and virtual assistants.

Each asset represents a fully prepared accounting problem that can be used in tutoring sessions, instructional videos, and exam preparation materials.

---

# Definition: Teaching Asset

A teaching asset contains the following components:

• problem text  

• solution  

• journal entries or calculations  

• worked steps  

• concept notes  

• formulas (if applicable)  

• exam traps and common mistakes  

Each asset is structured so it can support multiple learning formats.

---

# High-Level Pipeline Flow

1. Source Problem Import

2. Variant Generation

3. Asset Review

4. Asset Approval

5. Asset Library Storage

6. Google Sheet Template Generation

7. Sheet Preparation

8. Course Deployment

---

# Stage 1 — Source Problem Import

A Content Creation VA imports an accounting problem from a textbook or other approved source.

The system extracts the relevant data and prepares it for processing.

Key tasks:

• upload problem text  

• upload solution text  

• tag course and chapter  

• store source references

---

# Stage 2 — Variant Generation

The system generates a modified version of the original problem.

Variant generation may involve:

• changing numeric values  

• adjusting assumptions  

• modifying dates or quantities

The goal is to produce a **new problem that tests the same concept** without copying the original problem exactly.

---

# Stage 3 — Asset Review

The Content Creation VA reviews the generated asset to ensure:

• the numbers are correct  

• the solution is valid  

• the problem still teaches the intended concept

Minor edits may be made during this stage.

---

# Stage 4 — Asset Approval

Once verified, the asset is approved and stored in the **Teaching Asset Library**.

Approval indicates the asset is ready for:

• teaching use

• sheet generation

• deployment preparation

---

# Stage 5 — Teaching Asset Library

The Teaching Asset Library is the central database of all approved teaching assets.

Each asset includes structured data such as:

• asset code

• course code

• chapter number

• exercise reference

• problem text

• solution text

• journal entries

• worked steps

• concept notes

Assets are version-controlled and searchable.

---

# Stage 6 — Google Sheet Template Generation

After approval, the system generates a **Google Sheet teaching template** for the asset.

Each sheet includes multiple tabs designed for teaching and explanation.

Standard tabs include:

Metadata  

Hidden Data  

Master Whiteboard  

Journal Entries  

Worked Steps  

Important Formulas  

Concepts  

Exam Traps

The sheet serves as the internal whiteboard used during tutoring and video recording.

---

# Stage 7 — Sheet Preparation

A Sheet Prep VA formats the Google Sheet so it is ready for teaching.

Responsibilities include:

• copying problem text into whiteboard sections  

• formatting journal entries  

• organizing worked steps  

• adding concept explanations  

• ensuring visual clarity

The goal is to produce a clean, readable teaching asset.

Automation and templates reduce manual work.

---

# Stage 8 — Course Deployment

Completed assets are deployed into LearnWorlds courses.

Each asset may be connected to:

• instructional videos

• quizzes

• worksheets

• practice problems

Students interact with these materials through the course platform.

---

# VA Roles in the Pipeline

Content Creation VA

Responsibilities:

• import problems  

• generate variants  

• review generated assets  

• prepare assets for approval  

Sheet Prep VA

Responsibilities:

• format Google Sheet whiteboards  

• prepare teaching layouts  

• ensure readability for tutoring and filming  

Lead VA / Content Pipeline Manager

Responsibilities:

• manage production flow  

• assign tasks  

• track progress across chapters  

• ensure asset quality

---

# Pipeline Design Principles

The pipeline is designed to achieve:

1. High production speed

2. Consistent asset quality

3. Low production cost

4. Clear VA workflows

5. Scalable automation

Every stage should minimize manual effort where possible.

---

# Long-Term Goal

The pipeline should support production of:

• thousands of accounting teaching assets

• multiple course libraries

• campus-specific variations

Automation will continue to expand as the system evolves.

---

End of pipeline-overview.md

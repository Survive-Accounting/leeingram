# CLAUDE.md

## Project Overview

This repository powers **Survive Accounting**, an exam preparation platform for undergraduate accounting students.

The goal of the system is to build a **large library of high-quality accounting teaching assets** across four core courses:

• Financial Accounting (Intro 1)  

• Managerial Accounting (Intro 2)  

• Intermediate Accounting 1  

• Intermediate Accounting 2  

These assets help students prepare for exams through structured explanations, worked problems, and teaching materials.

The system is designed to generate, review, and deploy **hundreds to thousands of teaching assets efficiently**.

---

# Founder Context

Founder: Lee Ingram  

Background: Accounting educator and tutor

Primary responsibilities:

• Tutoring students  

• Recording instructional videos  

• Designing learning materials  

• Managing the asset pipeline system

The goal of the software system is to **automate and scale the content production pipeline** so the founder can focus on teaching rather than administrative work.

---

# Core Platform Stack

Primary systems used:

Lovable → application builder and internal tools  

GitHub → source code storage and version control  

Claude → architecture planning, code review, and prompt generation  

Google Sheets → teaching whiteboards and content preparation  

LearnWorlds → course hosting and student access  

Stripe → payment processing  

Clockify → VA time tracking  

Slack → team communication

---

# System Philosophy

The system should prioritize:

1. **Automation**

2. **Clarity**

3. **Scalability**

4. **Low operational cost**

5. **VA-friendly workflows**

The goal is to produce teaching assets **quickly and consistently** with minimal manual overhead.

---

# Teaching Asset Pipeline

High-level flow:

1. Import source problem

2. Generate variant

3. Review and approve asset

4. Store in Teaching Asset Library

5. Generate Google Sheet template

6. Sheet Prep VA formats whiteboard

7. Asset deployed to LearnWorlds

This pipeline is designed to support **large-scale content production**.

---

# Google Sheet System

Each approved asset generates a Google Sheet template containing:

Metadata tab  

Hidden Data tab  

Master Whiteboard tab  

Journal Entries tab  

Worked Steps tab  

Important Formulas tab  

Concepts tab  

Exam Traps tab

Google Sheets serve as the **internal teaching whiteboard system** used for:

• tutoring sessions  

• instructional videos  

• content preparation

Sheets are **production tools**, not the final student delivery layer.

---

# VA Roles

The system uses multiple virtual assistant roles:

Content Creation VA  

• imports problems  

• generates variants  

• prepares assets for approval

Sheet Prep VA  

• formats teaching whiteboards  

• prepares final teaching assets

Lead VA / Content Pipeline Manager  

• oversees production pipeline  

• assigns tasks

• ensures asset quality

---

# Deployment System

Final student access is delivered through:

LearnWorlds courses.

Each asset may be linked to:

• videos  

• quizzes  

• worksheets  

• practice problems

Google Sheets may be embedded where appropriate.

---

# Claude's Role

Claude assists with:

• system architecture planning  

• reviewing the codebase  

• suggesting improvements  

• writing Lovable prompts  

• identifying automation opportunities  

• improving scalability

Claude should prioritize:

• minimal complexity

• maintainable architecture

• efficient VA workflows

• clear data structures

---

# Development Workflow

Primary development occurs in **Lovable**.

Typical workflow:

1. Founder brainstorms ideas with Claude

2. Claude generates high-quality Lovable prompts

3. Prompts are executed in Lovable

4. Changes are tested

5. Code syncs to GitHub

6. Claude reviews code and suggests improvements

Lovable is the **primary editing environment**.

GitHub acts as the **source-of-truth code archive**.

---

# Long-Term Vision

The system should evolve into a **content production engine** capable of producing:

• thousands of accounting teaching assets

• multiple course libraries

• campus-specific course variations

Future expansions may include:

• additional accounting courses

• campus licensing programs

• Greek organization partnerships

• dynamic campus landing pages

---

# Development Guidelines

When suggesting changes:

Prefer simple solutions over complex ones.

Preserve existing data structures unless improvements are clearly justified.

Avoid breaking the teaching asset pipeline.

Focus on improvements that increase:

• automation

• reliability

• production speed

• maintainability

---

End of CLAUDE.md

# Data Schema Overview

## Purpose

This document describes the core data structures used by the Survive Accounting Teaching Asset Pipeline.

The goal is to provide a **human-readable overview of the system's data model** so developers and AI assistants can understand how the pipeline operates.

This document does not represent an exact database schema.  

Instead, it explains the **logical data structure** of the system.

---

# Core Data Entities

The pipeline revolves around several key entities:

• Teaching Assets  

• Problem Variants  

• Google Sheet Templates  

• Course Metadata  

• Pipeline Status Fields

Each entity represents a stage in the content production process.

---

# Teaching Assets

The **Teaching Asset** is the central object in the system.

A teaching asset represents a single accounting problem prepared for teaching purposes.

Each asset contains the finalized content used in tutoring, recording, and course delivery.

---

## Key Fields

Example fields stored for a teaching asset:

asset_id  

asset_code  

course_code  

chapter_number  

exercise_number  

asset_type  

variant_letter  

variant_count  

created_at  

sheet_master_url  

sheet_practice_url  

sheet_promo_url  

ebook_page_link  

lw_video_link  

lw_quiz_link  

sheet_verified  

sheet_ready_for_review  

---

## Asset Code

Each teaching asset receives a unique **asset_code**.

Example format:

IA2_CH13_P092_A

Meaning:

IA2 → Intermediate Accounting 2  

CH13 → Chapter 13  

P092 → Page 92  

A → Variant A

Asset codes allow assets to be easily referenced across systems.

---

# Problem Variants

Variants are alternate versions of textbook problems.

Variants are generated to:

• avoid copyright issues  

• create new practice material  

• allow multiple versions of the same concept

Variants may modify:

• numeric values  

• dates  

• quantities  

• assumptions

Each variant should still test the same accounting concept.

---

# Google Sheet Templates

After a teaching asset is approved, the system generates a **Google Sheet teaching template**.

The sheet acts as the internal whiteboard used for:

• tutoring sessions  

• instructional video recording  

• step-by-step explanations

Sheet URLs are stored within the teaching asset record.

Example fields:

sheet_master_url  

sheet_practice_url  

sheet_promo_url  

---

# Course Metadata

Each teaching asset is tied to course-level metadata.

Examples include:

course_code  

chapter_number  

exercise_number  

This allows the system to organize assets by course and chapter.

---

# Pipeline Status Fields

Several fields track where an asset is within the pipeline.

Examples:

sheet_verified  

sheet_ready_for_review  

These status flags allow the system to:

• track progress

• trigger automation

• assign VA tasks

---

# External Links

Teaching assets may include links to external learning resources.

Examples:

ebook_page_link → link to the course eBook page  

lw_video_link → link to LearnWorlds video  

lw_quiz_link → link to LearnWorlds quiz  

These links connect the asset to the final student learning experience.

---

# Google Sheet Metadata Export

When a Google Sheet is generated, asset metadata is exported into the **Metadata tab**.

This ensures the sheet always knows:

• which asset it belongs to

• course and chapter information

• relevant resource links

This allows sheets to remain traceable even when copied.

---

# System Design Goals

The data model should support:

• efficient asset production  

• easy pipeline tracking  

• scalable course expansion  

• simple VA workflows  

The schema should remain **clear, predictable, and easy to extend**.

---

End of data-schema-overview.md

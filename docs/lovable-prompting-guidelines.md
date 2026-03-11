# Lovable Prompting Guidelines

## Purpose

Lovable is the primary environment used to build and modify the Survive Accounting platform.

This document defines best practices for writing prompts that instruct Lovable to implement new features, modify the database, or update application behavior.

Following these guidelines helps ensure that changes are:

• clear  

• safe  

• efficient  

• compatible with the existing system

These rules should be followed whenever prompts are generated for Lovable.

---

# General Principles

Lovable prompts should be written with clarity and structure.

A good prompt should include:

1. the objective

2. the system area being modified

3. constraints and safety rules

4. expected output

Avoid vague instructions.

---

# Prompt Structure

Lovable prompts should generally follow this format.

---

## 1. Objective

Start with a short explanation of the goal.

Example:

"Add a feature that allows Sheet Prep VAs to mark a teaching asset as ready for review."

---

## 2. System Context

Explain where the change should occur.

Examples:

• Teaching Asset Pipeline  

• Google Sheet generation system  

• Asset review queue  

• VA dashboard

Providing context helps Lovable modify the correct part of the application.

---

## 3. Implementation Instructions

Provide clear implementation steps.

Example structure:

• add a new field to the teaching_assets table  

• update the review queue UI  

• create a button labeled "Mark Sheet Ready for Review"  

• update pipeline status when clicked

Steps should be written in simple, direct language.

---

## 4. Constraints

Always include rules to prevent unintended changes.

Examples:

• do not modify existing database schema unless specified  

• preserve current pipeline behavior  

• avoid breaking existing automations

Constraints help keep the system stable.

---

## 5. Expected Result

Describe how the feature should behave after implementation.

Example:

"When a Sheet Prep VA clicks the button, the field sheet_ready_for_review should update to true."

---

# Safe Database Changes

Database changes should always be handled carefully.

When modifying schema:

• clearly define new fields  

• specify the table being modified  

• avoid deleting existing columns  

• avoid renaming columns unless absolutely necessary

Schema changes should always be backwards compatible.

---

# UI Changes

When modifying UI components:

• specify the page or dashboard location  

• define button labels clearly  

• describe the expected user interaction

UI instructions should avoid ambiguity.

---

# Automation Changes

When implementing automation:

• define triggers clearly  

• describe the expected state changes  

• ensure existing automations remain intact

Example trigger:

"When sheet_ready_for_review becomes true, notify the founder for review."

---

# Testing Instructions

When implementing significant changes, prompts should include a request for testing guidance.

Example:

"After implementing this change, provide steps for testing the feature."

This helps verify that the system behaves correctly.

---

# Iterative Development

Complex features should be implemented in phases.

Recommended workflow:

1. build a minimal version

2. test functionality

3. add improvements

4. refine automation

This approach reduces debugging time and Lovable credit usage.

---

# Claude's Role

Claude should assist the founder by:

• asking clarifying questions before generating prompts  

• identifying potential edge cases  

• suggesting simple implementations first  

• generating structured Lovable prompts

Claude should prioritize **safe and incremental improvements**.

---

# Design Philosophy

Prompts should encourage Lovable to produce systems that are:

• simple  

• scalable  

• automation-friendly  

• easy for VAs to operate

The Teaching Asset Pipeline should remain the central organizing structure of the application.

---

End of lovable-prompting-guidelines.md

export const CATEGORIES = [
  { value: "content", label: "Content Production" },
  { value: "marketing", label: "Marketing" },
  { value: "integrations", label: "Integrations" },
  { value: "platform", label: "Platform / Tools" },
  { value: "tracking", label: "Time & Focus Tracking" },
  { value: "scaling", label: "Scaling / New Domains" },
  { value: "general", label: "General" },
];

export const PRIORITIES = [
  { value: "high", label: "🔴 High", style: "bg-red-100 text-red-800 border-red-200", sortOrder: 0 },
  { value: "medium", label: "🟡 Medium", style: "bg-yellow-100 text-yellow-800 border-yellow-200", sortOrder: 1 },
  { value: "low", label: "🟢 Low", style: "bg-green-100 text-green-800 border-green-200", sortOrder: 2 },
];

export const STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "Currently In Progress" },
  { value: "done", label: "Completed Features" },
];

export const IDEA_STATUS = { value: "idea", label: "Ideas" };
export const ARCHIVED_STATUS = { value: "archived", label: "Archived" };

export const SEMESTERS = [
  "Spring 2026", "Summer 2026", "Fall 2026", "Winter 2027",
  "Spring 2027", "Summer 2027", "Fall 2027", "Winter 2028",
  "Spring 2028", "Summer 2028", "Fall 2028", "Winter 2029",
  "Spring 2029", "Summer 2029", "Fall 2029", "Winter 2030",
  "Spring 2030", "Summer 2030", "Fall 2030",
];

export const SEED_IDEAS = [
  { title: "Promo Video Factory", description: "Create a sub-factory within Marketing for planning promotional videos tied to email campaigns and exam feedback content.", category: "marketing", priority: "high", target_semester: "Summer 2026" },
  { title: "Email series templates library", description: "Build reusable email series templates (Post-Exam Giveaways, Welcome Sequences, Re-engagement) that auto-clone each semester.", category: "marketing", priority: "high", target_semester: "Spring 2026" },
  { title: "Semester email calendar view", description: "Visual calendar showing all planned emails by week, day, and time across the semester for scheduling optimization.", category: "marketing", priority: "medium", target_semester: "Summer 2026" },
  { title: "Summer & Winter email campaigns", description: "Design email strategies specifically for summer and winter break — retention, early bird promos, prep content.", category: "marketing", priority: "medium", target_semester: "Summer 2026" },
  { title: "Exam feedback → video series pipeline", description: "Turn post-exam feedback emails into a recurring video series. Each exam generates a check-in email + a follow-up feedback video.", category: "content", priority: "high", target_semester: "Spring 2026" },
  { title: "Content drop scheduling system", description: "Pattern-based scheduling: Saturdays for post-exam check-ins, Sundays for content drops, flexible weekday slots for other content.", category: "content", priority: "medium", target_semester: "Fall 2026" },
  { title: "Google Sheets API integration", description: "Connect to Google Sheets API to auto-generate lesson worksheets from templates instead of manual placeholder URLs.", category: "integrations", priority: "high", target_semester: "Summer 2026" },
  { title: "Mailgun email sending", description: "Send finalized emails directly from the platform via Mailgun instead of copy-pasting to LearnWorlds.", category: "integrations", priority: "medium", target_semester: "Fall 2026" },
  { title: "Vimeo transcript import", description: "Pull video transcripts from Vimeo to auto-generate lesson summaries and study guides.", category: "integrations", priority: "low", target_semester: "Spring 2027" },
  { title: "Descript automation", description: "Connect to Descript for automated video editing workflows — rough cut generation from outlines.", category: "integrations", priority: "low", target_semester: "Fall 2027" },
  { title: "LearnWorlds publishing API", description: "Publish lessons and content directly to LearnWorlds from the platform.", category: "integrations", priority: "medium", target_semester: "Spring 2027" },
  { title: "Work session timer & focus tracker", description: "Built-in Pomodoro-style timer for tracking work sessions. Log time spent on content creation, filming, editing.", category: "tracking", priority: "medium", target_semester: "Fall 2026" },
  { title: "Analytics dashboard", description: "Track content production velocity: lessons per week, emails sent, video output, time invested per course.", category: "platform", priority: "medium", target_semester: "Spring 2027" },
  { title: "Style guide editor (teaching & email)", description: "Rich editor for maintaining both the teaching style guide and email style guide with version history.", category: "platform", priority: "low", target_semester: "Summer 2026" },
  { title: "Scale to Arts Entrepreneurship", description: "Adapt the content factory framework for a new domain: Arts Entrepreneurship courses. Same pipeline, different subject matter.", category: "scaling", priority: "low", target_semester: "Fall 2028" },
  { title: "Scale to QuickBooks training", description: "Expand into QuickBooks training content using the same lesson planning and video production pipeline.", category: "scaling", priority: "low", target_semester: "Spring 2029" },
  { title: "Multi-instructor support", description: "Allow other instructors to use the platform with their own courses, style guides, and email factories.", category: "scaling", priority: "low", target_semester: "Spring 2030" },
];

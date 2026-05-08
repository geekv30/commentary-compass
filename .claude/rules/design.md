# Design Guidelines

## Product Context

Examlly is a web-based tool for teachers and institute admins to create AI-powered question papers. A future persona is students.

**User profile:** Non-technical. These users are educators, not software users. They are often time-poor, unfamiliar with complex UIs, and access the product on mobile devices (phones, tablets) as often as on desktops.

**Design north star:** Every screen should feel effortless to a first-time teacher with no product training.

---

## Mobile-First Strategy

Design for mobile viewports first. Scale up to larger screens — not the reverse.

**What this means in practice:**

- The base (unprefixed) layout is always the mobile layout
- Wider-screen layouts are layered on top using responsive breakpoint prefixes
- Never design a desktop layout and try to "make it work" on mobile
- Navigation collapses to a sheet/drawer on small screens; full sidebar on medium and above

**Breakpoint philosophy:**

| Breakpoint       | Meaning                                | Design intent                  |
| ---------------- | -------------------------------------- | ------------------------------ |
| Base (no prefix) | All screen sizes, starting from mobile | Primary layout                 |
| `sm` (640px+)    | Large phones, small tablets            | Minor layout adjustments       |
| `md` (768px+)    | Tablets, small laptops                 | Side-by-side layouts unlock    |
| `lg` (1024px+)   | Desktops                               | Full density, wider containers |

When in doubt: if it doesn't work on a 390px wide phone, the design is not done.

---

## UX Philosophy for Non-Technical Users

### Cognitive Load

- Each screen should have **one primary purpose**. Avoid combining unrelated actions.
- Limit visible actionable elements to **5–7 per screen**. Surface advanced options progressively.
- Use plain, familiar language. Write labels as a teacher would say them out loud.
- Avoid abbreviations, technical jargon, or product-internal terminology.

### Progressive Disclosure

- Show essential controls first. Reveal advanced options only when the user opts in (expandable sections, "More options" affordances).
- Break multi-step workflows (e.g. creating a question paper) into clearly numbered steps — not single long forms.
- Never present all configuration upfront. Guide the user through decisions one at a time.

### Consistency and Predictability

- Use identical labels for identical actions across the product. Never mix synonyms ("Create" vs "New", "Delete" vs "Remove") for the same action.
- Navigation structure must remain stable across all pages. Do not change the sidebar or header layout contextually.
- Interaction patterns that work one way on one screen must work the same way everywhere.

### Information Density

- Prefer spacious layouts with generous whitespace over dense, information-packed screens.
- On mobile, content should stack vertically. Horizontal layouts are acceptable on `md+` only.
- Cards are preferred over raw lists or tables for scannable content (papers, templates, history).

---

## Accessibility Minimums

These are non-negotiable floors, not aspirational targets.

| Requirement                   | Standard                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text contrast ratio           | 4.5:1 (WCAG AA)                                                                                                                                                                               |
| UI component contrast         | 3:1 (WCAG AA)                                                                                                                                                                                 |
| Interactive touch target size | 24×24 CSS px minimum, with 24px spacing from adjacent targets (WCAG 2.2 AA). shadcn Button defaults (`h-9` = 36px) comfortably exceed this — do not override component heights at call sites. |
| Keyboard navigation           | All interactive elements must be reachable and operable via keyboard                                                                                                                          |
| Screen reader support         | Meaningful labels on all interactive elements; decorative images marked as such                                                                                                               |
| Focus indicators              | Visible focus ring on all focusable elements                                                                                                                                                  |

Accessibility is especially important for this product's user base. Teachers and admins span a wide age range and may use assistive technology.

---

## Layout Principles

- **Containers** should be centered with a sensible max-width on large screens. Full-width on mobile.
- **Spacing** should be consistent and drawn from the spacing scale — never arbitrary values.
- **Vertical rhythm** matters: consistent gaps between content blocks create a sense of order.
- Avoid deeply nested layouts. Flat is better. If a layout requires more than 3 levels of nesting to achieve, reconsider the structure.
- Forms should be single-column on mobile. Two-column form layouts are acceptable on `md+` only.

---

## UX Patterns

### Three Required States

Every screen that loads data must have all three of these designed and implemented:

| State       | Purpose               | Requirement                                                                  |
| ----------- | --------------------- | ---------------------------------------------------------------------------- |
| **Loading** | Data is being fetched | Skeleton placeholder that matches the shape of the loaded content            |
| **Empty**   | No data exists yet    | Explanation of what this screen shows + a clear CTA to create the first item |
| **Error**   | Something went wrong  | Plain-language explanation + a recovery action (retry, go back)              |

A blank white screen is never acceptable. An empty/loading/error state must always be explicitly designed.

### Error Messaging

Every error message must answer three questions in plain language:

1. **What** happened ("We couldn't save your question paper")
2. **Why** it happened, if known and non-technical ("Check your internet connection")
3. **What to do** next ("Try again" button, link to go back)

Validation errors must appear **inline**, next to the relevant field — not in a distant banner or toast.

### One Primary Action Per Screen

Each page or step should have one clearly dominant primary action. Secondary and destructive actions should be visually subordinate.

### Calls to Action

CTAs must be descriptive. "Create Question Paper" is better than "Submit". "Save and Continue" is better than "Next". The label should tell the user what will happen when they click.

---

## Visual Design Principles

### Semantic Over Literal

All visual styling decisions — color, spacing, shape — should reference the design system's semantic layer rather than raw or arbitrary values. This ensures the product remains consistent, themeable, and maintainable.

- Use semantic intent tokens (primary action, destructive action, muted text, surface background) — not literal color values.
- Colors carry meaning: the primary brand color signals the main action, yellow signals attention, red signals danger. Use them consistently and intentionally.

### Hierarchy Through Weight, Not Decoration

Visual hierarchy should be established through typography weight, size, and spacing — not through borders, background fills, or decorative elements. Reach for decoration only when structure fails.

### Restraint

- The color palette is intentionally limited. Do not introduce new colors outside the design system.
- Every new UI element should ask: does something like this already exist? Reuse before inventing.
- Whitespace is a design element. Generous whitespace communicates confidence and reduces cognitive load.

---

## Anti-Patterns

Avoid these regardless of how common they are in general web development:

| Anti-Pattern                                                | Why It's Wrong Here                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Desktop layout first, mobile as afterthought                | Users are on mobile as often as desktop; mobile regressions are user-facing bugs   |
| Blank page on loading or empty state                        | Non-technical users interpret blank pages as broken products                       |
| Technical error messages ("500 Internal Server Error")      | Teachers cannot act on technical errors; plain language is required                |
| Feature-dense screens with many competing actions           | Overwhelming for non-technical users; causes abandonment                           |
| Overloading a single screen with multiple goals             | Violates the single-purpose screen principle                                       |
| Inconsistent terminology across flows                       | Confuses users who don't read carefully; creates false sense of different features |
| Inline styles or arbitrary values outside the design system | Breaks consistency; impossible to maintain at scale                                |
| Introducing new visual patterns for a one-off need          | Creates inconsistency; prefer adapting an existing pattern                         |
| Validation errors only in toasts or page-level banners      | Hard to associate with the offending field on mobile                               |
| Forms longer than 5–6 fields on a single screen             | Overwhelming on mobile; break into steps instead                                   |

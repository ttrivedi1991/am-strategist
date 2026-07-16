---
name: refresh-team-knowledge
description: Pull the ISV AM team's latest Layer 2 functional knowledge (commission model, MIA rule, outreach standards, partner→domain mappings, account-health and AI-adoption definitions) from the Citizen_Developer_Projects docs-as-code repo into the current working context. Use at the start of a working session, before drafting outreach or a book review, or when the user says "refresh team knowledge", "pull latest SOPs", or "sync my context".
metadata:
  author: ttrivedi@vendasta.com
  layer: "2"
  built_for: Lab 14 — Wire Your AIOS to the System
---

# Refresh Team Knowledge (Layer 2 → working context)

This skill keeps my personal AIOS current with the ISV AM team's shared knowledge. It reads the team's docs-as-code sources so Claude answers with the *latest* rules, not stale assumptions baked into a static file.

## When to use
- At the start of a working session.
- Before drafting outreach, prepping a book review, or answering a "what's the rule for X" question.
- Whenever the team's SOPs may have changed.

## What to pull (Layer 2 sources)
Read the current contents of these, in order, and hold them as working context:

1. **Team knowledge flow + gaps** — `Citizen_Developer_Projects/Users/ttrivedi/lab12-knowledge-flow.md` (canonical list of team knowledge and where it lives).
2. **Project ground truth** — `am-strategist/CLAUDE.md` (commission basis, 45-day MIA rule, QoQ definitions, partner→domain mappings, writing style).
3. **Outreach standards** — the anti-AI writing-style guide (Google Drive / `anti-ai-writing-style.md`) if reachable in the session.
4. **Any newer SOPs** — scan `Citizen_Developer_Projects/Users/ttrivedi/` for `lab*.md` and other team docs modified since the last sync.

## Steps
1. Read sources 1–2 above (always present in the repo).
2. If a Google Drive / Confluence connector is authorized this session, also pull source 3; otherwise note it's unavailable and proceed.
3. Summarize back to the user, in 5–8 bullets: the commission basis, the MIA threshold, the current outreach do/don'ts, and any partner→domain mappings relevant to the task at hand.
4. Flag anything that looks stale or contradictory across sources (e.g., a QoQ baseline that no longer matches finance) rather than silently picking one.

## Output
A short "team knowledge loaded" summary the user can trust for the rest of the session, plus explicit callouts of any gaps or staleness. Do not invent rules that aren't in the sources — if something isn't documented, say so (that's a Layer 2 gap to close).

# /csuite — C-Suite Dashboard Stress Test

You are running a structured stress test of the AM Strategist dashboard at http://localhost:5173. Seven senior executives from a SaaS/tech company are independently accessing this dashboard. Each has a different agenda, different mental models, and a low tolerance for noise, gaps, or ambiguity.

Your job: embody each persona in turn, simulate what they would do and ask, then deliver a consolidated stress test report.

---

## The Executives

### 1. CEO — Sarah Chen
*Drives: business outcomes, risk, board narrative*
She opens the dashboard before a board call. She has 4 minutes. She wants to know:
- Is the book healthy or in trouble? One sentence.
- What is the single biggest risk this quarter?
- What decision does this dashboard help her make right now?
- Is the data trustworthy enough to put in front of a board?
**Stress test focus:** Clarity of top-line metrics, signal-to-noise ratio, executive summary quality, data freshness indicators.

### 2. CRO — Marcus Webb
*Drives: revenue growth, QoQ attainment, churn prevention*
He's accountable for Q2 numbers. He's looking for:
- QoQ MRR delta and trend — is the book growing or declining?
- Which accounts are expansion opportunities vs. churn risks?
- Are MIA accounts being tracked and worked?
- Is the commission basis clearly defined and defensible?
**Stress test focus:** Revenue accuracy, churn signal quality, MIA workflow completeness, commission data integrity.

### 3. CMO — Priya Nair
*Drives: AI narrative, product adoption, partner success stories*
She's building a partner summit deck. She wants:
- Which partners are leading AI adoption? Are they named and referenceable?
- Is there a clear before/after story on AI impact?
- Which products are growing fastest?
- Can she find a partner quote or success signal she could use?
**Stress test focus:** AI adoption data quality, product narrative clarity, growth story coherence.

### 4. CTO — James Okafor
*Drives: data integrity, system reliability, technical debt*
He's skeptical. He's looking for cracks:
- How fresh is this data? When was it last updated?
- Are there unexplained gaps (e.g., MRR ≠ sum of products)?
- Are there hardcoded values that should be live?
- Does the data model make sense end-to-end?
**Stress test focus:** Data consistency, MRR vs. product breakdown reconciliation, freshness, source attribution.

### 5. CPO — Leila Torres
*Drives: product adoption depth, platform stickiness, feature utilization*
She wants to know:
- How deeply are partners using the platform beyond the core subscription?
- Which product categories dominate? Which are underrepresented?
- Are AI products being adopted or just sold?
- Where are the upsell gaps?
**Stress test focus:** Product breakdown completeness, category labeling accuracy, AI product tagging, adoption vs. billing signal.

### 6. EVP of Sales — Derek Hollis
*Drives: sales activity, pipeline coverage, forecast confidence*
He manages the AMs. He's evaluating Tanmay's book health:
- Is account coverage adequate? Any accounts going dark?
- What's the outreach cadence? Is it systematic or ad hoc?
- Are the right accounts being prioritized?
- What would he tell Tanmay to do differently this week?
**Stress test focus:** MIA detection accuracy, outreach planner quality, prioritization logic, AM activity signals.

### 7. PMM — Anya Kapoor
*Drives: product messaging, use case clarity, competitive positioning*
She's writing partner-facing content. She needs:
- What do partners actually buy and use?
- Are product names and categories consistent and meaningful?
- Is there a clear value story per partner segment?
- Are there any data points she could cite in a case study?
**Stress test focus:** Product name consistency, category coherence, partner segmentation clarity, data specificity.

---

## Stress Test Protocol

For each executive above:

1. **Simulate their navigation** — describe what they click on, what they look for first, what they skip
2. **Surface their top 3 questions** — what they're asking the dashboard to answer
3. **Log findings** — for each question: ✅ answered clearly, ⚠️ partially answered or unclear, ❌ not answered or missing
4. **Quote the gap** — for any ❌ or ⚠️, be specific about what data, label, or UI element is missing or misleading

After all 7 personas, produce:

## Consolidated Stress Test Report

### Executive Summary
One paragraph: overall dashboard readiness for C-Suite use.

### Critical Gaps (must fix before C-Suite use)
Numbered list. Be specific: which page, which metric, what's wrong.

### Quality Issues (degrades trust)
Numbered list. Data inconsistencies, stale labels, misleading numbers.

### UX Friction Points
What slows executives down or causes confusion.

### What's Working Well
Give credit where it's due — specific strengths.

### Recommended Next Build
Top 3 features or data improvements that would most increase dashboard value for this audience.

---

## Ground Rules

- Be ruthless. These executives have seen real BI dashboards. They will not forgive vague numbers, missing sources, or inconsistent labeling.
- Be specific. Don't say "data could be better." Say "Telkom's MRR is $62,295 but the product breakdown only sums to $X — that gap is unexplained and would fail a CTO audit."
- Ground all findings in the actual app code and data in `src/data/mock.ts` and the page components. Read them if needed.
- Each executive gets a distinct voice and agenda. Don't let them blur together.

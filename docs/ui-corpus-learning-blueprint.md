# UI Corpus Learning Blueprint

Practical blueprint to make Generate improve from a large set of interface examples without model fine-tuning.

## Goal

Turn hundreds/thousands of UI references into an external learning system that improves:
- first-pass layout quality
- design-system alignment
- archetype coherence (checkout, dashboard, onboarding, etc.)
- iteration speed to an acceptable result

This is a retrieval + policy + critique + telemetry loop, not a full model retraining project.

---

## 1. Corpus Unit (what one example looks like)

One record per screen (or per major flow step if needed):

```json
{
  "id": "ui_000123",
  "source": {
    "kind": "internal_figma",
    "license": "owned",
    "url": "https://figma.com/file/...",
    "captured_at": "2026-05-05T08:00:00.000Z"
  },
  "archetype": "checkout_summary_mobile",
  "platform": "mobile",
  "viewport_px": 390,
  "locale": "en-US",
  "quality_score": 4.5,
  "ds_context": {
    "name": "Acme Design System",
    "source": "custom",
    "version": "2.1.0"
  },
  "images": {
    "thumbnail_url": "https://...",
    "full_url": "https://..."
  },
  "layout": {
    "sections": ["header", "order_items", "totals", "trust_cues", "sticky_cta"],
    "density": "medium",
    "navigation_pattern": "single_step"
  },
  "components": {
    "semantic_slots": [
      { "slot": "primary_cta", "role": "pay_now", "component_family": "button" },
      { "slot": "trust_badges", "role": "assurance_row", "component_family": "badge_group" }
    ],
    "icon_usage": {
      "style": "outline",
      "size_px": [16, 20, 24],
      "stretch_policy": "never_fill_main_axis"
    }
  },
  "ds_alignment": {
    "token_discipline": "strict",
    "component_reuse_ratio": 0.92,
    "notes": "No ad-hoc primitives for CTA block"
  },
  "anti_patterns": [
    "icon_stretched_fill",
    "empty_placeholder_cluster"
  ],
  "text_intent": {
    "prompt_like_summary": "Mobile checkout summary with sticky pay CTA and trust cues.",
    "keywords": ["checkout", "sticky cta", "trust", "payment"]
  },
  "evaluation": {
    "accepted_by_designer": true,
    "time_to_accept_sec": 140,
    "fixes_applied": ["spacing_tighten", "cta_hierarchy_boost"]
  }
}
```

Fields added vs original:
- `viewport_px`: explicit breakpoint (360, 390, 768, 1280, 1440). platform alone is too coarse to guide layout decisions.
- `ds_context`: which DS was active when this example was produced (name, source, version). Without this, retrieval can inject references built on an incompatible DS. A Material Design 3 example must never guide a generation on a custom enterprise DS.

---

## 2. Minimum Taxonomy (tagging system)

Use strict enums where possible. Start small and grow only when needed.

- `archetype`: checkout_summary_mobile, checkout_summary_desktop, pricing, login, onboarding_step, dashboard_overview
- `layout.density`: compact | medium | airy
- `layout.navigation_pattern`: single_step | wizard | hub_spoke
- `components.icon_usage.stretch_policy`: never_fill_main_axis | contextual_fill_only
- `ds_alignment.token_discipline`: strict | mixed | weak
- `ds_context.source`: custom | material_design_3 | ios_hig | ant_design | carbon | bootstrap_5 | salesforce_lightning | uber_base_web

---

## 3. Storage Model (lean)

```sql
CREATE TABLE ui_corpus_examples (
  id text PRIMARY KEY,
  source_kind text NOT NULL,
  source_license text NOT NULL,
  source_url text,
  archetype text NOT NULL,
  platform text NOT NULL,
  viewport_px integer,
  locale text,
  quality_score numeric,
  ds_source text NOT NULL,
  ds_name text,
  ds_version text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ui_corpus_embeddings (
  example_id text PRIMARY KEY REFERENCES ui_corpus_examples(id) ON DELETE CASCADE,
  embedding vector(1536),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ui_corpus_feedback (
  id bigserial PRIMARY KEY,
  example_id text REFERENCES ui_corpus_examples(id) ON DELETE SET NULL,
  request_id bigint,
  accepted boolean NOT NULL,
  time_to_accept_sec integer,
  fixes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 4. Corpus Sources

Three natural sources with clear licensing and no external dependency:

**Source A: Accepted generations from generate history**
Generations accepted without modification (or with minimal fixes) are by definition DS-aligned and designer-approved. These are the highest-quality seed examples. Even 50 accepted generations are worth more than 200 externally tagged screens. This is the starting point for Phase 0.

**Source B: Designer-imported Figma screens**
Screens explicitly imported by the designer via an ingestion UI in Comtra (future, Phase 1+). The designer selects a frame in Figma, assigns archetype and quality score, and Comtra captures the screenshot + DS context automatically.

**Source C: Preset DS library**
The eight DS presets already in Comtra (Material Design 3, iOS HIG, Ant Design, Carbon, Bootstrap 5, Salesforce Lightning, Uber Base Web) have components already mapped. Reference screens built on these presets can be tagged automatically from existing DS metadata.

Guardrail: Only use sources A, B, C. Never ingest externally scraped UI screenshots without explicit license verification.

---

## 5. Retrieval in Generate (what to inject)

Apply filters in this exact order. DS compatibility is a hard filter, not a ranking factor. A high-quality example on the wrong DS is worse than a medium-quality example on the correct DS.

**Filter order:**
1. `ds_context.source` matches the active DS (hard filter)
2. Same `platform` and `viewport_px` range (hard filter)
3. Same `archetype` family (hard filter)
4. High `quality_score` (re-ranking)
5. No conflicting `anti_patterns` (re-ranking)

**Injection format:**
- Retrieve top k=5..12 after filtering
- Inject only compact slot summaries: max 80 tokens per reference, 5 references = ~400 tokens total
- Each reference includes: why this example, sections, slot mapping, do/dont
- References are injected into the `design_intelligence` block, after the DS context index

**Context budget rule:** DS context index uses prefix caching and stays first (position-stable). References are injected after, capped at 400 tokens total. The two budgets do not cannibalize each other.

---

## 6. Critique Pass (before canvas apply)

The reviewer returns a structured score object, not a single number. The repair pass needs per-dimension scores to know where to intervene.

**Reviewer output structure:**
```json
{
  "layout_score": 0.85,
  "ds_score": 0.92,
  "hierarchy_score": 0.78,
  "anti_patterns": ["placeholder_overuse"],
  "repair_hints": [
    "Tighten spacing between order_items and totals section.",
    "Replace placeholder text in trust_badges slot with DS-compliant badge component."
  ]
}
```

**Checks performed:**
- Archetype coverage: required slots present, no irrelevant sections
- DS alignment: component key validity, token usage discipline
- Layout quality: hierarchy score, spacing rhythm, icon stretch violations
- Anti-pattern checks: placeholder overuse, generic repeated blocks, fixed-size misuse in responsive stacks

If any dimension score is below threshold: run one repair pass injecting `repair_hints` as targeted constraints. Do not run a second repair pass. If the repaired plan still fails, return the best available plan with a `low_confidence` flag to the plugin.

---

## 7. Learning Loop (from real usage)

Track per generate request:
- accepted / rejected
- number of refinements before acceptance
- manual edit categories
- time to acceptance

Then:
- boost references that correlate with fast acceptance (low time_to_accept_sec, zero fixes)
- down-rank references linked to repeated fixes of the same category
- auto-promote high-performing new examples into corpus

---

## 8. Quality KPIs

| KPI | Definition | Target (quarter) |
|---|---|---|
| `accept_rate_first_pass` | % accepted without any refinement | +20% vs baseline |
| `median_time_to_acceptable` | Seconds from generate to designer acceptance | Measure only, no target yet |
| `ds_alignment_pass_rate` | % action plans passing DS checks without repair | Measure only |
| `anti_pattern_incidence` | Anti-patterns per 100 generations | -30% vs baseline |

Do not set numeric targets for KPIs 2 and 3 until you have at least 4 weeks of baseline data.

---

## 9. Rollout Plan

### Phase 0: Corpus readiness (1-2 weeks)

- Define and freeze taxonomy (use enums from section 2, no additions without explicit decision)
- Start from generate history: extract accepted generations with zero or minimal fixes. Run Qwen3-VL-32B-Instruct (already in stack) for auto-tagging of structural fields (archetype, platform, sections, anti_patterns). Human review only for quality_score. This reduces manual labeling effort by ~70%.
- Target: 200-500 labeled examples. Seed minimum: 50 accepted Comtra generations.
- Add schema migration (section 3 tables).
- Build ingestion script for tagged JSON examples.

### Phase 1: Retrieval-only assist (1 week)

- Add top-k retrieval call in generate pipeline before plan generation.
- Inject top references into `design_intelligence` block following filter order in section 5.
- No repair logic yet.
- Measure KPI delta vs pre-corpus baseline.

### Phase 2: Critique + repair (1-2 weeks)

- Add reviewer scoring (structured output from section 6).
- One targeted repair pass for plans below threshold.
- Add `generation_diagnostics` field with reviewer scores to generate response.

### Phase 3: Adaptive ranking (ongoing)

- Feedback-weighted re-ranking based on `ui_corpus_feedback`.
- Auto-curation: examples with high correlation to accepted generations get promoted; examples linked to repeated fixes get demoted.

---

## 10. Guardrails

- Use only licensed/owned UI references (sources A, B, C from section 4).
- Strip sensitive text from examples before ingestion.
- Keep reference injections compact: cap at 400 tokens total in prompt.
- Never copy full layouts verbatim; use references as constraints and patterns.
- DS compatibility is always a hard filter, never a soft ranking signal.

---

## 11. Immediate Next Steps for This Repo

1. Add schema migration with `viewport_px`, `ds_source`, `ds_name`, `ds_version` columns.
2. Extract accepted generations from generate history as seed corpus.
3. Run Qwen3-VL-32B-Instruct auto-tagging on seed corpus for structural fields.
4. Build ingestion script for tagged JSON examples.
5. Add retrieval call in generate pipeline before plan generation, with filter order from section 5.
6. Inject top references into `design_intelligence` block.
7. Add structured reviewer score to `generation_diagnostics`.

---

*COMTRA by Ben & Cordiska | comtra.dev | Versione 1.0, Maggio 2026*
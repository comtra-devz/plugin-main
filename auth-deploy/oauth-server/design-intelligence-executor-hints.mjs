/**
 * Compact hints from Design Intelligence pack for the Figma plugin executor (spacing + playbook).
 * Safe JSON-only subset — no functions.
 */

function normArchetypeSet(packV2ArchetypeId, inferredScreenArchetype) {
  const out = new Set();
  const p = packV2ArchetypeId && String(packV2ArchetypeId).trim();
  const l = inferredScreenArchetype && String(inferredScreenArchetype).trim();
  if (p) out.add(p);
  if (l) out.add(l);
  return out;
}

function ruleAppliesToArchetypes(rule, archetypes) {
  const when = rule?.when && typeof rule.when === 'object' && !Array.isArray(rule.when) ? rule.when : null;
  const arr = when && Array.isArray(when.archetypes) ? when.archetypes.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (arr.length === 0) return true;
  return arr.some((a) => archetypes.has(a));
}

/**
 * @param {unknown} patternsPayload
 * @param {{ packV2ArchetypeId?: string | null, inferredScreenArchetype?: string | null }} ctx
 * @returns {{ playbook: unknown[], spacing: { root_horizontal_padding_px: number | null, vertical_item_spacing_default: number | null } } | null}
 */
export function buildDesignIntelligenceExecutorHints(patternsPayload, ctx) {
  const archetypes = normArchetypeSet(ctx?.packV2ArchetypeId, ctx?.inferredScreenArchetype);
  const sr =
    patternsPayload && typeof patternsPayload === 'object' && !Array.isArray(patternsPayload)
      ? patternsPayload.spacing_rhythm
      : null;

  let root_horizontal_padding_px = null;
  let vertical_item_spacing_default = null;

  if (sr && typeof sr === 'object' && !Array.isArray(sr)) {
    const pad = Number(sr.frame_horizontal_padding_mobile_px);
    if (Number.isFinite(pad) && pad >= 0) root_horizontal_padding_px = Math.round(pad);

    const rules = Array.isArray(sr.rules) ? sr.rules : [];
    const gaps = [];
    for (const r of rules) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
      if (!ruleAppliesToArchetypes(r, archetypes)) continue;
      const g = Number(r.gap_px);
      if (Number.isFinite(g) && g > 0) gaps.push({ id: String(r.id || ''), gap: Math.round(g) });
    }
    if (gaps.length) {
      const f2f = gaps.find((x) => /field/i.test(x.id));
      vertical_item_spacing_default = (f2f || gaps[0]).gap;
    }
  }

  const playbookRaw = Array.isArray(patternsPayload?.component_property_playbook)
    ? patternsPayload.component_property_playbook
    : [];
  const playbook = [];
  for (const entry of playbookRaw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const m = entry.match && typeof entry.match === 'object' && !Array.isArray(entry.match) ? entry.match : {};
    const slot = typeof m.slot === 'string' ? m.slot.trim() : '';
    const when =
      entry.when && typeof entry.when === 'object' && !Array.isArray(entry.when) ? entry.when : null;
    const arr = when && Array.isArray(when.archetypes) ? when.archetypes.map((x) => String(x || '').trim()).filter(Boolean) : [];
    if (arr.length && !arr.some((a) => archetypes.has(a))) continue;
    const cre = m.component_name_regex;
    playbook.push({
      match: {
        slot: slot || null,
        component_name_regex: typeof cre === 'string' && cre.trim() ? cre.trim() : null,
      },
      properties: Array.isArray(entry.properties) ? entry.properties : [],
    });
  }

  const hasSpacing = root_horizontal_padding_px != null || vertical_item_spacing_default != null;
  if (!playbook.length && !hasSpacing) return null;

  return {
    playbook,
    spacing: {
      root_horizontal_padding_px,
      vertical_item_spacing_default,
    },
  };
}

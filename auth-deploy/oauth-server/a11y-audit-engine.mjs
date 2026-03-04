/**
 * A11Y Audit Engine — Comtra Accessibility Ruleset v1.0.
 * Contrast (WCAG 2.2 normal/large, no rounding), Touch (24×24 AA, spacing exception),
 * Focus, Alt, Semantics, Color, OKLCH. Output: issues[] with rule_id, wcag_sc where applicable.
 */

// --- Constants (ruleset-aligned)
const CONTRAST_AA_NORMAL = 4.5;
const CONTRAST_AA_LARGE = 3;
const CONTRAST_AAA_NORMAL = 7;
const CONTRAST_AAA_LARGE = 4.5;
const CONTRAST_NON_TEXT = 3;
const CONTRAST_ILLEGIBLE = 3;

const TOUCH_MIN_AA = 24;   // SC 2.5.8 (WCAG 2.2)
const TOUCH_MIN_AAA = 44;  // SC 2.5.5 advisory

const FONT_LARGE_PX = 24;       // 18pt = 24px
const FONT_LARGE_BOLD_PX = 18.5; // 14pt bold
const FONT_WEIGHT_BOLD = 700;

const INTERACTIVE_NAMES = /button|btn|link|icon|cta|submit|toggle|tab|menu|dropdown|input|checkbox|radio|select|nav-item|menu-item|close|dismiss|clickable/i;
const GENERIC_ALT_NAMES = /^(icon|image|img|rectangle|rect|shape|vector|group|frame)$/i;
const FOCUS_VARIANT_NAMES = /focus|focused|keyboard|focus-visible/i;
const EXEMPT_CONTRAST_NAMES = /logo|brand|decoration|decorative|divider|background/i;

// --- Helpers
function* walkNodes(node, ancestors = [], pageName = '') {
  if (!node || typeof node !== 'object') return;
  const name = node.name || '';
  const isPage = node.type === 'CANVAS';
  yield { node, ancestors, pageName: pageName || (isPage ? name : '') };
  const children = node.children;
  if (Array.isArray(children)) {
    for (const c of children) {
      yield* walkNodes(c, [...ancestors, node], pageName || (isPage ? name : ''));
    }
  }
}

function figmaColorToRgb(fill) {
  if (!fill || fill.visible === false) return null;
  if (fill.color && typeof fill.color.r === 'number') {
    const { r, g, b } = fill.color;
    const a = fill.opacity != null ? fill.opacity : (fill.color.a != null ? fill.color.a : 1);
    return { r: r * 255, g: g * 255, b: b * 255, a };
  }
  return null;
}

function getSolidFillColor(node) {
  const fills = node.fills;
  if (!Array.isArray(fills)) return null;
  for (const f of fills) {
    if (f.type === 'SOLID') {
      const rgb = figmaColorToRgb(f);
      if (rgb) return rgb;
    }
  }
  return null;
}

function rgbToLuminance(r, g, b) {
  const rs = r / 255, gs = g / 255, bs = b / 255;
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const R = lin(rs), G = lin(gs), B = lin(bs);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Do not round: 2.999:1 does NOT pass 3:1 (ruleset). */
function contrastRatio(L1, L2) {
  const l1 = Math.max(L1, L2);
  const l2 = Math.min(L1, L2);
  return (l2 + 0.05) > 0 ? (l1 + 0.05) / (l2 + 0.05) : 0;
}

function getBackgroundColor(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const c = getSolidFillColor(ancestors[i]);
    if (c && c.a > 0) return c;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

/** Text classification: normal, large, or exempt (ruleset 1.2). Figma uses px. */
function getTextClassification(node) {
  const name = (node.name || '').toLowerCase();
  if (EXEMPT_CONTRAST_NAMES.test(name)) return 'exempt';
  const style = node.style || {};
  const fontSize = typeof style.fontSize === 'number' ? style.fontSize : 16;
  const fontWeight = typeof style.fontWeight === 'number' ? style.fontWeight : 400;
  const isBold = fontWeight >= FONT_WEIGHT_BOLD;
  if (fontSize >= FONT_LARGE_PX || (isBold && fontSize >= FONT_LARGE_BOLD_PX)) return 'large';
  return 'normal';
}

/** Returns { thresholdAA, thresholdAAA } for text. */
function getTextThresholds(classification) {
  if (classification === 'large') return { thresholdAA: CONTRAST_AA_LARGE, thresholdAAA: CONTRAST_AAA_LARGE };
  return { thresholdAA: CONTRAST_AA_NORMAL, thresholdAAA: CONTRAST_AAA_NORMAL };
}

// --- 1. Contrast (WCAG 2.2: normal/large, no rounding, rule_id)
function collectContrastIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  for (const page of document.children) {
    const pageName = page.name || '';
    for (const { node, ancestors, pageName: pName } of walkNodes(page)) {
      if (node.type !== 'TEXT') continue;
      const classification = getTextClassification(node);
      if (classification === 'exempt') continue;
      const textColor = getSolidFillColor(node);
      if (!textColor) continue;
      const bg = getBackgroundColor(ancestors);
      const pageNameFinal = pName || pageName;
      const L1 = rgbToLuminance(textColor.r, textColor.g, textColor.b);
      const L2 = rgbToLuminance(bg.r, bg.g, bg.b);
      const ratio = contrastRatio(L1, L2);
      const { thresholdAA, thresholdAAA } = getTextThresholds(classification);

      if (ratio < thresholdAA) {
        const ruleId = classification === 'normal' ? 'CTR-001' : 'CTR-002';
        const wcagSc = classification === 'normal' ? '1.4.3' : '1.4.3';
        const required = classification === 'normal' ? CONTRAST_AA_NORMAL : CONTRAST_AA_LARGE;
        let severity = ratio < CONTRAST_ILLEGIBLE ? 'HIGH' : 'MED';
        let msg = classification === 'normal'
          ? `Contrast ${ratio.toFixed(1)}:1 — below WCAG AA (4.5:1)`
          : `Contrast ${ratio.toFixed(1)}:1 — below WCAG AA large text (3:1)`;
        let fix = classification === 'normal'
          ? 'Increase contrast to at least 4.5:1 (WCAG AA) or use semantic token with documented contrast.'
          : 'Increase contrast to at least 3:1 for large text (WCAG AA).';
        if (ratio < CONTRAST_ILLEGIBLE) {
          msg = `Contrast ${ratio.toFixed(1)}:1 — barely readable`;
          fix = 'Use darker text or lighter background (min 3:1, aim 4.5:1 for normal text).';
        }
        issues.push({
          id: idGen(),
          categoryId: 'contrast',
          rule_id: ruleId,
          wcag_sc: wcagSc,
          wcag_level: 'AA',
          msg,
          severity,
          layerId: node.id,
          fix,
          pageName: pageNameFinal,
          measured_value: ratio,
          required_value: required,
          passes: false,
        });
      } else if (ratio < thresholdAAA) {
        const ruleId = classification === 'normal' ? 'CTR-003' : 'CTR-004';
        issues.push({
          id: idGen(),
          categoryId: 'contrast',
          rule_id: ruleId,
          wcag_sc: '1.4.6',
          wcag_level: 'AAA',
          msg: classification === 'normal'
            ? `Contrast ${ratio.toFixed(1)}:1 — below AAA (7:1)`
            : `Contrast ${ratio.toFixed(1)}:1 — below AAA large text (4.5:1)`,
          severity: 'LOW',
          layerId: node.id,
          fix: 'For AAA, increase contrast to ' + (classification === 'normal' ? '7:1' : '4.5:1 for large text') + '.',
          pageName: pageNameFinal,
          measured_value: ratio,
          required_value: thresholdAAA,
          passes: false,
        });
      }
    }
  }
}

// --- 2. Touch target (24×24 AA, only interactive, spacing exception, rule_id)
function isInteractiveNode(node) {
  const name = (node.name || '').toLowerCase();
  if (node.type === 'TEXT') return false;
  if (INTERACTIVE_NAMES.test(name)) return true;
  if (node.type === 'COMPONENT' || node.type === 'INSTANCE') return true;
  return false;
}

function getInteractiveNodesWithBox(fileJson) {
  const list = [];
  const document = fileJson?.document;
  if (!document || !document.children) return list;
  for (const page of document.children) {
    const pageName = page.name || '';
    for (const { node } of walkNodes(page)) {
      if (!isInteractiveNode(node)) continue;
      const box = node.absoluteBoundingBox;
      if (!box || typeof box.width !== 'number' || typeof box.height !== 'number') continue;
      list.push({ node, box, pageName });
    }
  }
  return list;
}

function distance(cx1, cy1, cx2, cy2) {
  return Math.hypot(cx2 - cx1, cy2 - cy1);
}

function collectTouchIssues(fileJson, issues, idGen) {
  const candidates = getInteractiveNodesWithBox(fileJson);
  const undersized = candidates.filter(({ box }) => box.width < TOUCH_MIN_AA || box.height < TOUCH_MIN_AA);
  const centers = new Map();
  for (const { node, box } of candidates) {
    centers.set(node.id, { cx: box.x + box.width / 2, cy: box.y + box.height / 2, box });
  }

  for (const { node, box, pageName } of candidates) {
    const w = box.width;
    const h = box.height;
    const minSide = Math.min(w, h);

    if (minSide >= TOUCH_MIN_AAA) continue;

    const isUndersizedAA = w < TOUCH_MIN_AA || h < TOUCH_MIN_AA;
    const cx = box.x + w / 2;
    const cy = box.y + h / 2;

    if (isUndersizedAA) {
      let spacingOk = true;
      for (const { node: other, box: ob } of candidates) {
        if (other.id === node.id) continue;
        const ow = ob.width;
        const oh = ob.height;
        if (ow >= TOUCH_MIN_AA && oh >= TOUCH_MIN_AA) continue;
        const ocx = ob.x + ow / 2;
        const ocy = ob.y + oh / 2;
        if (distance(cx, cy, ocx, ocy) < TOUCH_MIN_AA) {
          spacingOk = false;
          break;
        }
      }
      if (!spacingOk) {
        issues.push({
          id: idGen(),
          categoryId: 'touch',
          rule_id: 'TGT-001',
          wcag_sc: '2.5.8',
          wcag_level: 'AA',
          msg: `Touch target ${Math.round(w)}×${Math.round(h)} px — below 24×24 px minimum`,
          severity: 'HIGH',
          layerId: node.id,
          fix: 'Ensure touch target is at least 24×24 px (WCAG 2.2). Add padding or increase hit area. If spacing allows, 24px circle around center must not overlap other targets.',
          pageName,
          measured_value: minSide,
          required_value: TOUCH_MIN_AA,
          passes: false,
        });
      } else {
        issues.push({
          id: idGen(),
          categoryId: 'touch',
          msg: `Touch target ${Math.round(w)}×${Math.round(h)} px — undersized but passes via spacing exception`,
          severity: 'LOW',
          layerId: node.id,
          fix: 'Target is below 24×24 px but has sufficient spacing. Consider 44×44 px for comfort (AAA).',
          pageName,
          measured_value: minSide,
          required_value: TOUCH_MIN_AA,
          passes: true,
        });
      }
    } else if (minSide < TOUCH_MIN_AAA) {
      issues.push({
        id: idGen(),
        categoryId: 'touch',
        rule_id: 'TGT-003',
        wcag_sc: '2.5.5',
        wcag_level: 'AAA',
        msg: `Touch target ${Math.round(minSide)} px — consider 44×44 px for AAA`,
        severity: 'LOW',
        layerId: node.id,
        fix: 'For enhanced target size (AAA), use at least 44×44 px.',
        pageName,
        measured_value: minSide,
        required_value: TOUCH_MIN_AAA,
        passes: false,
      });
    }
  }
}

// --- 3. Focus (component without focus variant)
function collectFocusIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  for (const page of document.children) {
    const pageName = page.name || '';
    for (const { node } of walkNodes(page)) {
      if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') continue;
      const children = node.children;
      if (!Array.isArray(children) || children.length === 0) continue;
      const hasFocusVariant = children.some((c) => FOCUS_VARIANT_NAMES.test(c.name || ''));
      if (hasFocusVariant) continue;
      const name = (node.name || '').toLowerCase();
      if (!INTERACTIVE_NAMES.test(name) && name.indexOf('button') < 0 && name.indexOf('input') < 0) continue;
      issues.push({
        id: idGen(),
        categoryId: 'focus',
        rule_id: 'CTR-009',
        wcag_sc: '2.4.13',
        wcag_level: 'AAA',
        msg: 'Missing :focus state',
        severity: 'MED',
        layerId: node.id,
        fix: 'Add a visible focus state (e.g. outline or ring) for keyboard navigation.',
        pageName,
      });
    }
  }
}

// --- 4. Alt (generic icon/image names)
function collectAltIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  for (const page of document.children) {
    const pageName = page.name || '';
    for (const { node } of walkNodes(page)) {
      const name = (node.name || '').trim();
      if (!GENERIC_ALT_NAMES.test(name)) continue;
      const type = (node.type || '').toUpperCase();
      if (type === 'TEXT') continue;
      const severity = name.length <= 2 || /^(icon|image|rect)$/i.test(name) ? 'MED' : 'LOW';
      issues.push({
        id: idGen(),
        categoryId: 'alt',
        msg: `Icon/asset with generic name "${name}" — add description for screen readers`,
        severity,
        layerId: node.id,
        fix: 'Rename layer or add description (e.g. "Close dialog", "Submit form").',
        pageName,
      });
    }
  }
}

// --- 5. Semantics (heading structure heuristic)
function collectSemanticsIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  for (const page of document.children) {
    const pageName = page.name || '';
    const textNodes = [];
    for (const { node } of walkNodes(page)) {
      if (node.type !== 'TEXT') continue;
      const style = node.style || {};
      const size = typeof style.fontSize === 'number' ? style.fontSize : 16;
      textNodes.push({ node, size, name: node.name || '' });
    }
    const sizes = textNodes.map((t) => t.size).filter((s) => s > 0);
    const maxSize = sizes.length ? Math.max(...sizes) : 0;
    const hasHeadingLike = textNodes.some((t) => /heading|title|h1|h2|h3/i.test(t.name));
    if (textNodes.length > 2 && maxSize > 0 && !hasHeadingLike) {
      const main = textNodes.find((t) => t.size === maxSize);
      if (main) {
        issues.push({
          id: idGen(),
          categoryId: 'semantics',
          msg: 'No clear heading hierarchy — consider semantic names (e.g. Heading 1, Title)',
          severity: 'LOW',
          layerId: main.node.id,
          fix: 'Use a clear heading hierarchy (e.g. one H1 per page) and semantic names for sections.',
          pageName,
        });
      }
    }
  }
}

// --- 6. Color (info not by color only)
function collectColorIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  for (const page of document.children) {
    const pageName = page.name || '';
    for (const { node } of walkNodes(page)) {
      if (node.type !== 'COMPONENT_SET') continue;
      const children = node.children;
      if (!Array.isArray(children) || children.length < 2) continue;
      const fillsOnly = children.every((c) => getSolidFillColor(c) != null);
      if (!fillsOnly) continue;
      const names = (node.name || '').toLowerCase();
      if (!/state|variant|error|success|disabled|default/i.test(names)) continue;
      issues.push({
        id: idGen(),
        categoryId: 'color',
        rule_id: 'CVD-001',
        msg: 'States may differ only by color — add icon or label for color-blind users',
        severity: 'MED',
        layerId: node.id,
        fix: 'Add icon, label or pattern in addition to color so information is clear for color-blind users.',
        pageName,
      });
    }
  }
}

// --- 7. OKLCH (advisory)
function collectOKLCHIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  let countHex = 0;
  for (const page of document.children) {
    for (const { node } of walkNodes(page)) {
      if (getSolidFillColor(node)) countHex++;
    }
  }
  if (countHex > 0) {
    issues.push({
      id: idGen(),
      categoryId: 'color',
      rule_id: 'CLR-002',
      msg: 'File uses RGB/hex fills — consider OKLCH tokens for perceptual consistency',
      severity: 'LOW',
      layerId: document.children[0]?.id || document.id,
      fix: 'Use OKLCH for tokens (e.g. oklch(0.65 0.15 250)) and ensure contrast ≥ 4.5:1.',
      pageName: document.children[0]?.name || '',
    });
  }
}

// --- Main
let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `a11y-${idCounter}`;
}

/**
 * Run A11Y audit on Figma file JSON. Returns { issues }.
 * @param {object} fileJson - Full response from GET /v1/files/:key or plugin serialization
 */
export function runA11yAudit(fileJson) {
  idCounter = 0;
  const issues = [];
  collectContrastIssues(fileJson, issues, nextId);
  collectTouchIssues(fileJson, issues, nextId);
  collectFocusIssues(fileJson, issues, nextId);
  collectAltIssues(fileJson, issues, nextId);
  collectSemanticsIssues(fileJson, issues, nextId);
  collectColorIssues(fileJson, issues, nextId);
  collectOKLCHIssues(fileJson, issues, nextId);
  return { issues };
}

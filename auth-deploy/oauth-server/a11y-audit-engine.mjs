/**
 * A11Y Audit Engine v1.0 — Design (Figma JSON) only, no Kimi.
 * Layers: contrast, touch, focus, alt, semantics, color, OKLCH.
 * Output: issues[] compatible with audit-specs/a11y-audit/OUTPUT-SCHEMA.md
 */

const TOUCH_MIN = 44;
const TOUCH_MED = 48;
const CONTRAST_AA = 4.5;
const CONTRAST_AAA_TEXT = 7;
const CONTRAST_AA_LARGE = 3;
const CONTRAST_ILLEGIBLE = 3;

const INTERACTIVE_NAMES = /button|btn|link|icon|cta|submit|toggle|tab|menu|dropdown/i;
const GENERIC_ALT_NAMES = /^(icon|image|img|rectangle|rect|shape|vector|group|frame)$/i;
const FOCUS_VARIANT_NAMES = /focus|focused|keyboard/i;

// --- Helpers: traversal and color (Figma JSON has no .parent; we pass ancestors)
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

// --- 1. Contrast (WCAG)
function collectContrastIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  for (const page of document.children) {
    const pageName = page.name || '';
    for (const { node, ancestors, pageName: pName } of walkNodes(page)) {
      if (node.type !== 'TEXT') continue;
      const textColor = getSolidFillColor(node);
      if (!textColor) continue;
      const bg = getBackgroundColor(ancestors);
      const pageNameFinal = pName || pageName;
      const L1 = rgbToLuminance(textColor.r, textColor.g, textColor.b);
      const L2 = rgbToLuminance(bg.r, bg.g, bg.b);
      const ratio = contrastRatio(L1, L2);
      if (ratio >= CONTRAST_AA) continue; // Only report failures (below AA)
      let severity = 'MED';
      let msg = `Contrast ${ratio.toFixed(1)}:1 — below WCAG AA (4.5:1)`;
      let fix = 'Increase contrast to at least 4.5:1 (WCAG AA) or use semantic token with documented contrast.';
      if (ratio < CONTRAST_ILLEGIBLE) {
        severity = 'HIGH';
        msg = `Contrast fail ${ratio.toFixed(1)}:1`;
        fix = 'Text is barely readable. Use darker text or lighter background (min 3:1, aim 4.5:1).';
      }
      issues.push({
        id: idGen(),
        categoryId: 'contrast',
        msg,
        severity,
        layerId: node.id,
        fix,
        pageName: pageNameFinal,
      });
    }
  }
}

// --- 2. Touch target
function collectTouchIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  for (const page of document.children) {
    const pageName = page.name || '';
    for (const { node } of walkNodes(page)) {
      const box = node.absoluteBoundingBox;
      if (!box || typeof box.width !== 'number' || typeof box.height !== 'number') continue;
      const name = (node.name || '').toLowerCase();
      const minSide = Math.min(box.width, box.height);
      if (minSide >= TOUCH_MED) continue;
      const likelyInteractive = INTERACTIVE_NAMES.test(name) || node.type === 'COMPONENT' || node.type === 'INSTANCE';
      if (!likelyInteractive && minSide >= TOUCH_MIN) continue;
      let severity = minSide < TOUCH_MIN ? 'HIGH' : 'MED';
      if (!likelyInteractive) severity = 'LOW';
      const msg = minSide < TOUCH_MIN
        ? `Touch target ${Math.round(minSide)}×${Math.round(box.width)} pt — below 44×44 pt minimum`
        : `Touch target ${Math.round(minSide)} pt — consider 48 pt for comfort`;
      issues.push({
        id: idGen(),
        categoryId: 'touch',
        msg,
        severity,
        layerId: node.id,
        fix: 'Ensure touch target is at least 44×44 pt. Add padding or use a larger hit area.',
        pageName,
      });
    }
  }
}

// --- 3. Focus (component without focus variant)
function collectFocusIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  const componentIds = new Set();
  for (const page of document.children) {
    for (const { node } of walkNodes(page)) {
      if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') componentIds.add(node.id);
    }
  }
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
      const fontSize = node.style?.fontSize ?? node.style?.fontSize;
      const size = typeof fontSize === 'number' ? fontSize : 16;
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

// --- 6. Color (info not by color only) — simplified: component variants differing only by color
function collectColorIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  for (const page of document.children) {
    const pageName = page.name || '';
    for (const { node } of walkNodes(page)) {
      if (node.type !== 'COMPONENT_SET') continue;
      const children = node.children;
      if (!Array.isArray(children) || children.length < 2) continue;
      const fillsOnly = children.every((c) => {
        const f = getSolidFillColor(c);
        return f != null;
      });
      if (!fillsOnly) continue;
      const names = (node.name || '').toLowerCase();
      if (!/state|variant|error|success|disabled|default/i.test(names)) continue;
      issues.push({
        id: idGen(),
        categoryId: 'color',
        msg: 'States may differ only by color — add icon or label for color-blind users',
        severity: 'MED',
        layerId: node.id,
        fix: 'Add icon, label or pattern in addition to color so information is clear for color-blind users.',
        pageName,
      });
    }
  }
}

// --- 7. OKLCH (suggest OKLCH for tokens; contrast already in contrast layer)
function collectOKLCHIssues(fileJson, issues, idGen) {
  const document = fileJson?.document;
  if (!document || !document.children) return;
  let countHex = 0;
  for (const page of document.children) {
    for (const { node } of walkNodes(page)) {
      const c = getSolidFillColor(node);
      if (c) countHex++;
    }
  }
  if (countHex > 0) {
    issues.push({
      id: idGen(),
      categoryId: 'color',
      msg: 'File uses RGB/hex fills — consider OKLCH tokens for modern CSS and perceptual consistency',
      severity: 'LOW',
      layerId: document.children[0]?.id || document.id,
      fix: 'Use OKLCH for this token (e.g. oklch(0.65 0.15 250)) and ensure contrast ≥ 4.5:1.',
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
 * @param {object} fileJson - Full response from GET /v1/files/:key
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

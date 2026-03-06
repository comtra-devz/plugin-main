/**
 * Comtra token generation — Figma Variables → token tree → CSS / DTCG JSON.
 * Aligned with COMTRA_Token_Generation_Ruleset (W3C DTCG 2025.10, three-tier, slash-to-dot/hyphen).
 */

export interface FigmaDesignTokensPayload {
  fileKey: string | null;
  collections: Array<{
    id: string;
    name: string;
    defaultModeId: string;
    modes: Array<{ modeId: string; name: string }>;
  }>;
  variables: Array<{
    id: string;
    name: string;
    description: string;
    variableCollectionId: string;
    resolvedType: string;
    valuesByMode: Record<string, unknown>;
    codeSyntax?: Record<string, string>;
    hiddenFromPublishing?: boolean;
  }>;
}

export type TokenTier = 'primitive' | 'semantic' | 'component';

export interface TokenLeaf {
  type: 'color' | 'dimension' | 'number' | 'string' | 'boolean';
  value: unknown;
  description?: string;
  tier: TokenTier;
  /** Resolved alias path (dot notation) when value came from alias */
  aliasPath?: string;
}

export interface TokenTree {
  /** Default mode id for this collection */
  defaultModeId: string;
  /** Mode id -> mode name */
  modeNames: Record<string, string>;
  /** Nested object: path segments as keys, leaves are TokenLeaf */
  tokens: Record<string, unknown>;
  /** Per-mode overrides: only tokens that differ from default (modeId -> same structure as tokens) */
  modeOverrides: Record<string, Record<string, unknown>>;
}

export interface TokenForest {
  /** Collection id -> collection name (normalized for path) */
  collectionNames: Record<string, string>;
  /** Collection id -> token tree */
  trees: Record<string, TokenTree>;
  /** Variable id -> dot path (collectionPath.segment.segment.leaf) */
  idToPath: Record<string, string>;
  /** Health score 0–100 (ruleset §8.4) */
  healthScore: number;
  /** Score breakdown and advisory gaps for metadata */
  healthDetails: {
    total: number;
    level: 'excellent' | 'healthy' | 'manageable' | 'critical';
    gaps: string[];
    tokenCount: { primitive: number; semantic: number; component: number; total: number };
  };
}

function normalizeCollectionName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '') || 'tokens';
}

function inferTier(collectionName: string, variableName: string, isAlias: boolean): TokenTier {
  const c = collectionName.toLowerCase();
  const n = variableName.toLowerCase();
  if (/primitives|core|base|reference|option|global/.test(c) || /-\d+$|-\d+-|^\d+$/.test(n))
    return 'primitive';
  if (/semantic|alias|system|theme/.test(c) || isAlias) return 'semantic';
  if (/component|scoped|local/.test(c) || /button|input|card|header|footer/.test(n)) return 'component';
  return 'primitive';
}

function setNested(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null)
      current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function serializeFigmaValue(
  val: unknown,
  resolvedType: string
): { type: TokenLeaf['type']; value: unknown; aliasId?: string } | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'object' && val !== null && 'type' in val && (val as { type: string }).type === 'VARIABLE_ALIAS') {
    return { type: 'string', value: '', aliasId: (val as { id: string }).id };
  }
  if (typeof val === 'object' && val !== null && 'r' in val) {
    const c = val as { r: number; g: number; b: number; a?: number };
    const hex = rgbToHex(c.r, c.g, c.b);
    const alpha = c.a !== undefined && c.a !== 1 ? c.a : undefined;
    return {
      type: 'color',
      value: { colorSpace: 'srgb', components: [c.r, c.g, c.b], alpha, hex }
    };
  }
  if (typeof val === 'number') {
    if (resolvedType === 'FLOAT') return { type: 'dimension', value: { value: val, unit: 'px' } };
    return { type: 'number', value: val };
  }
  if (typeof val === 'string') return { type: 'string', value: val };
  if (typeof val === 'boolean') return { type: 'boolean', value: val };
  return null;
}

export function buildTokenForestFromFigmaPayload(payload: FigmaDesignTokensPayload): TokenForest {
  const collectionNames: Record<string, string> = {};
  const idToPath: Record<string, string> = {};
  const trees: Record<string, TokenTree> = {};

  for (const coll of payload.collections) {
    const rootKey = normalizeCollectionName(coll.name);
    collectionNames[coll.id] = rootKey;
    trees[coll.id] = {
      defaultModeId: coll.defaultModeId,
      modeNames: Object.fromEntries(coll.modes.map(m => [m.modeId, m.name])),
      tokens: {},
      modeOverrides: {}
    };
  }

  for (const v of payload.variables) {
    const coll = payload.collections.find(c => c.id === v.variableCollectionId);
    if (!coll) continue;
    const rootKey = normalizeCollectionName(coll.name);
    const pathSegments = v.name.split('/').map(s => s.trim()).filter(Boolean);
    if (pathSegments.length === 0) continue;
    const dotPath = [rootKey, ...pathSegments].join('.');
    idToPath[v.id] = dotPath;
  }

  for (const v of payload.variables) {
    const coll = payload.collections.find(c => c.id === v.variableCollectionId);
    if (!coll) continue;
    const tree = trees[coll.id];
    const rootKey = normalizeCollectionName(coll.name);
    const pathSegments = v.name.split('/').map(s => s.trim()).filter(Boolean);
    if (pathSegments.length === 0) continue;

    const defaultModeId = coll.defaultModeId;
    const defaultVal = v.valuesByMode[defaultModeId];
    const defaultSerial = serializeFigmaValue(defaultVal, v.resolvedType);
    const isAlias = defaultSerial?.aliasId != null;
    const tier = inferTier(coll.name, v.name, isAlias);

    const leaf: TokenLeaf = {
      type: (defaultSerial?.type ?? 'string') as TokenLeaf['type'],
      value: defaultSerial?.aliasId ? idToPath[defaultSerial.aliasId] ?? `{alias:${defaultSerial.aliasId}}` : defaultSerial?.value,
      description: v.description || undefined,
      tier,
      aliasPath: defaultSerial?.aliasId ? idToPath[defaultSerial.aliasId] : undefined
    };
    if (defaultSerial?.aliasId && idToPath[defaultSerial.aliasId])
      leaf.value = idToPath[defaultSerial.aliasId];
    setNested(tree.tokens, pathSegments, leaf);

    for (const mode of coll.modes) {
      if (mode.modeId === defaultModeId) continue;
      const modeVal = v.valuesByMode[mode.modeId];
      const modeSerial = serializeFigmaValue(modeVal, v.resolvedType);
      if (modeSerial === null) continue;
      const sameAsDefault =
        !defaultSerial && !modeSerial ? true :
        JSON.stringify(defaultSerial?.value ?? defaultVal) === JSON.stringify(modeSerial.value);
      if (sameAsDefault && !modeSerial.aliasId) continue;
      if (!tree.modeOverrides[mode.modeId]) tree.modeOverrides[mode.modeId] = {};
      const overrideLeaf: TokenLeaf = {
        type: (modeSerial.type ?? leaf.type) as TokenLeaf['type'],
        value: modeSerial.aliasId ? (idToPath[modeSerial.aliasId] ?? `{alias:${modeSerial.aliasId}}`) : modeSerial.value,
        description: leaf.description,
        tier: leaf.tier,
        aliasPath: modeSerial.aliasId ? idToPath[modeSerial.aliasId] : undefined
      };
      if (modeSerial.aliasId && idToPath[modeSerial.aliasId])
        overrideLeaf.value = idToPath[modeSerial.aliasId];
      setNested(tree.modeOverrides[mode.modeId], pathSegments, overrideLeaf);
    }
  }

  const totalVars = payload.variables.length;
  const withAlias = payload.variables.filter(v => {
    const def = v.valuesByMode[payload.collections.find(c => c.id === v.variableCollectionId)?.defaultModeId ?? ''];
    return def && typeof def === 'object' && 'type' in (def as object) && (def as { type: string }).type === 'VARIABLE_ALIAS';
  }).length;
  const aliasRatioPct = totalVars > 0 ? (withAlias / totalVars) * 100 : 0;

  // Tier counts from actual leaves (we already set tier on each leaf)
  let primitive = 0, semantic = 0, component = 0;
  const countTiers = (o: Record<string, unknown>): void => {
    for (const val of Object.values(o)) {
      if (val && typeof val === 'object' && 'tier' in (val as object)) {
        const t = (val as TokenLeaf).tier;
        if (t === 'primitive') primitive++;
        else if (t === 'semantic') semantic++;
        else component++;
      } else if (val && typeof val === 'object' && !Array.isArray(val))
        countTiers(val as Record<string, unknown>);
    }
  };
  for (const tree of Object.values(trees)) countTiers(tree.tokens);

  const colorVars = payload.variables.filter(v => v.resolvedType === 'COLOR').length;
  const hasColorRoles = colorVars >= 4; // text, bg, border, action-ish
  const extraModes = payload.collections.reduce((sum, c) => sum + Math.max(0, c.modes.length - 1), 0);
  const withDescription = payload.variables.filter(v => (v.description ?? '').trim().length > 0).length;
  const descriptionPct = totalVars > 0 ? (withDescription / totalVars) * 100 : 0;
  const hasNaming = totalVars > 0 && payload.variables.some(v => /^[a-z][a-z0-9-]*(\/[a-z0-9-]+)+$/i.test(v.name));

  // Ruleset §8.4 scoring (weights in points, max 10 per metric, total normalized to 100)
  const pts = {
    tokenCount: totalVars < 10 ? 0 : totalVars < 30 ? 5 : totalVars < 80 ? 8 : 10,
    tierCoverage: primitive > 0 && (semantic > 0 || component > 0) ? (semantic > 0 && component > 0 ? 10 : 8) : 3,
    colorRole: hasColorRoles ? 10 : colorVars > 0 ? 5 : 0,
    aliasRatio: aliasRatioPct === 0 ? 0 : aliasRatioPct < 20 ? 4 : aliasRatioPct < 50 ? 7 : 10,
    naming: hasNaming ? 10 : totalVars > 0 ? 5 : 0,
    modeSupport: extraModes === 0 ? 0 : extraModes === 1 ? 6 : 10,
    typography: 5, // no text styles from Variables here; placeholder
    description: descriptionPct < 20 ? 2 : descriptionPct < 60 ? 5 : 10
  };
  const totalPts = (pts.tokenCount * 1.5) + (pts.tierCoverage * 2) + (pts.colorRole * 1.5) + (pts.aliasRatio * 1.5) +
    pts.naming + pts.modeSupport + pts.typography + (pts.description * 0.5);
  const healthScore = Math.min(100, Math.round(totalPts));

  const gaps: string[] = [];
  if (totalVars < 10) gaps.push('near-zero-token-coverage');
  if (colorVars === 0) gaps.push('no-color-system');
  if (primitive > 0 && semantic === 0 && component === 0) gaps.push('no-semantic-tier');
  if (aliasRatioPct === 0 && totalVars > 0) gaps.push('no-aliases');
  if (!hasColorRoles && colorVars > 0) gaps.push('missing-color-roles');
  if (descriptionPct < 20 && totalVars > 0) gaps.push('low-description-coverage');

  const level: TokenForest['healthDetails']['level'] =
    healthScore >= 86 ? 'excellent' : healthScore >= 66 ? 'healthy' : healthScore >= 26 ? 'manageable' : 'critical';

  return {
    collectionNames,
    trees,
    idToPath,
    healthScore,
    healthDetails: {
      total: healthScore,
      level,
      gaps,
      tokenCount: { primitive, semantic, component, total: totalVars }
    }
  };
}

function flattenLeaves(obj: Record<string, unknown>, prefix: string[], acc: Array<{ path: string[]; leaf: TokenLeaf }>): void {
  for (const [key, val] of Object.entries(obj)) {
    const path = [...prefix, key];
    if (val && typeof val === 'object' && 'type' in val && 'value' in val && 'tier' in val) {
      acc.push({ path, leaf: val as TokenLeaf });
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      flattenLeaves(val as Record<string, unknown>, path, acc);
    }
  }
}

function pathToCssName(path: string[]): string {
  return '--' + path.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function pathToDTCGPath(path: string[]): string {
  return path.join('.');
}

function tokenLeafToCssValue(leaf: TokenLeaf): string {
  if (leaf.aliasPath) {
    const cssPath = leaf.aliasPath.replace(/\./g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    return `var(--${cssPath})`;
  }
  if (leaf.type === 'color' && leaf.value && typeof leaf.value === 'object' && 'hex' in (leaf.value as { hex?: string }))
    return (leaf.value as { hex: string }).hex;
  if (leaf.type === 'color' && leaf.value && typeof leaf.value === 'object' && 'components' in (leaf.value as { components?: number[] })) {
    const c = leaf.value as { components: number[]; alpha?: number };
    const [r, g, b] = c.components.map(x => Math.round(x * 255));
    const a = c.alpha;
    if (a !== undefined && a !== 1) return `rgb(${r} ${g} ${b} / ${a})`;
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (leaf.type === 'dimension' && leaf.value && typeof leaf.value === 'object' && 'value' in (leaf.value as { value: number }))
    return `${(leaf.value as { value: number; unit?: string }).value}${(leaf.value as { unit?: string }).unit ?? 'px'}`;
  if (leaf.type === 'number' || leaf.type === 'string') return String(leaf.value);
  if (leaf.type === 'boolean') return leaf.value ? '1' : '0';
  return String(leaf.value);
}

export function tokenForestToCSS(forest: TokenForest, options: { fileKey?: string | null } = {}): string {
  const lines: string[] = [];
  const generatedAt = new Date().toISOString();
  let totalTokens = 0;
  const countLeaves = (o: Record<string, unknown>): number => {
    let n = 0;
    for (const val of Object.values(o)) {
      if (val && typeof val === 'object' && 'tier' in (val as object)) n++;
      else if (val && typeof val === 'object' && !Array.isArray(val)) n += countLeaves(val as Record<string, unknown>);
    }
    return n;
  };
  for (const tree of Object.values(forest.trees)) totalTokens += countLeaves(tree.tokens);

  const details = forest.healthDetails;
  lines.push('/* ══════════════════════════════════════════════════════ */');
  lines.push('/*  COMTRA by Ben & Cordiska — Design Tokens                 */');
  lines.push(`/*  Generated: ${generatedAt} */`);
  if (options.fileKey) lines.push(`/*  Source: file key ${options.fileKey} */`);
  lines.push('/*  Mode: CSS Custom Properties                             */');
  lines.push(`/*  Tokens: ${totalTokens} (${details.tokenCount.primitive} primitive, ${details.tokenCount.semantic} semantic, ${details.tokenCount.component} component) */`);
  lines.push(`/*  Health Score: ${forest.healthScore}/100 (${details.level}) */`);
  if (details.gaps.length > 0) lines.push(`/*  Gaps: ${details.gaps.join(', ')} */`);
  lines.push('/*  Engine: Comtra v1.0                                      */');
  lines.push('/* ══════════════════════════════════════════════════════ */');
  lines.push('');

  for (const [collId, tree] of Object.entries(forest.trees)) {
    const rootKey = forest.collectionNames[collId];
    if (!rootKey) continue;

    const defaultModeName = tree.modeNames[tree.defaultModeId] ?? 'default';
    const selector = defaultModeName.toLowerCase() === 'light' || defaultModeName === 'default' ? ':root' : ':root';
    lines.push(`/* Figma mode "${defaultModeName}" (default) → ${selector} */`);
    lines.push(`${selector} {`);

    const leaves: Array<{ path: string[]; leaf: TokenLeaf }> = [];
    flattenLeaves(tree.tokens, [], leaves);
    for (const { path, leaf } of leaves) {
      const fullPath = [rootKey, ...path];
      const cssName = pathToCssName(fullPath);
      const cssVal = tokenLeafToCssValue(leaf);
      lines.push(`  ${cssName}: ${cssVal};`);
    }
    lines.push('}');
    lines.push('');

    for (const [modeId, overrides] of Object.entries(tree.modeOverrides)) {
      const modeName = tree.modeNames[modeId] ?? modeId;
      const themeSlug = modeName.toLowerCase().replace(/\s+/g, '-');
      lines.push(`/* Figma mode "${modeName}" → [data-theme="${themeSlug}"] */`);
      lines.push(`:root[data-theme="${themeSlug}"] {`);
      const overrideLeaves: Array<{ path: string[]; leaf: TokenLeaf }> = [];
      flattenLeaves(overrides, [], overrideLeaves);
      for (const { path, leaf } of overrideLeaves) {
        lines.push(`  ${pathToCssName([rootKey, ...path])}: ${tokenLeafToCssValue(leaf)};`);
      }
      lines.push('}');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function leafToDTCGValue(leaf: TokenLeaf): unknown {
  if (leaf.aliasPath) return `{${leaf.aliasPath}}`;
  if (leaf.type === 'color' && leaf.value && typeof leaf.value === 'object' && 'components' in (leaf.value as object)) {
    const v = leaf.value as { colorSpace?: string; components: number[]; alpha?: number; hex?: string };
    const out: Record<string, unknown> = { colorSpace: v.colorSpace ?? 'srgb', components: v.components };
    if (v.alpha != null) out.alpha = v.alpha;
    if (v.hex) out.hex = v.hex;
    return out;
  }
  return leaf.value;
}

function buildDTCGGroup(obj: Record<string, unknown>, inheritedType?: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const childGroups: Array<{ key: string; nested: Record<string, unknown> }> = [];
  let sharedType: string | undefined = inheritedType;
  const leafTypes = new Set<string>();
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && 'type' in val && 'value' in val) {
      const leaf = val as TokenLeaf;
      leafTypes.add(leaf.type);
      const entry: Record<string, unknown> = {
        $value: leafToDTCGValue(leaf),
        $type: leaf.type
      };
      if (leaf.description) entry.$description = leaf.description;
      out[key] = entry;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = buildDTCGGroup(val as Record<string, unknown>, inheritedType);
      if (Object.keys(nested).length > 0) childGroups.push({ key, nested });
    }
  }
  for (const { key, nested } of childGroups) out[key] = nested;
  if (childGroups.length === 0 && leafTypes.size === 1 && !inheritedType) {
    sharedType = Array.from(leafTypes)[0];
    out.$type = sharedType;
  }
  return out;
}

export function tokenForestToDTCG(forest: TokenForest, options: { fileKey?: string | null } = {}): Record<string, unknown> {
  const generatedAt = new Date().toISOString();
  let totalTokens = 0;
  const countLeaves = (o: Record<string, unknown>): number => {
    let n = 0;
    for (const val of Object.values(o)) {
      if (val && typeof val === 'object' && 'tier' in (val as object)) n++;
      else if (val && typeof val === 'object' && !Array.isArray(val)) n += countLeaves(val as Record<string, unknown>);
    }
    return n;
  };
  for (const tree of Object.values(forest.trees)) totalTokens += countLeaves(tree.tokens);

  const details = forest.healthDetails;
  const root: Record<string, unknown> = {
    $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
    $extensions: {
      comtra: {
        generatedAt,
        sourceFile: options.fileKey ?? undefined,
        figmaFileId: options.fileKey ?? undefined,
        engineVersion: '1.0',
        tokenCount: details.tokenCount,
        modes: Array.from(new Set(Object.values(forest.trees).flatMap(t => Object.values(t.modeNames)))),
        healthScore: { total: details.total, level: details.level, gaps: details.gaps }
      }
    }
  };

  for (const [collId, tree] of Object.entries(forest.trees)) {
    const group = buildDTCGGroup(tree.tokens);
    if (Object.keys(group).length > 0) {
      const collName = forest.collectionNames[collId];
      if (collName) (root as Record<string, Record<string, unknown>>)[collName] = group;
    }
  }

  return root;
}

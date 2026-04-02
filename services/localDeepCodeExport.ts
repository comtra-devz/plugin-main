/**
 * Export deterministico e in profondità dal subtree Figma (get-code-gen-subtree).
 * FREE tier: nessuna chiamata AI — struttura + testi + stili base da JSON.
 * Supporta tutti i formati della tab Target.
 */

export type FigmaExportNode = {
  id?: string;
  name?: string;
  type?: string;
  children?: FigmaExportNode[];
  characters?: string;
  visible?: boolean;
  layout?: {
    mode?: string;
    itemSpacing?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
  };
  fills?: Array<{ type?: string; color?: { r: number; g: number; b: number; a?: number } }>;
  absoluteBoundingBox?: { x?: number; y?: number; width?: number; height?: number };
  _meta?: { truncated?: boolean; [k: string]: unknown };
};

function pascalCase(raw: string): string {
  const s = String(raw || 'Component').replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ExportedComponent';
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function safeId(id: string | undefined, fallback: string): string {
  return String(id || fallback).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function rgbFromFill(n: FigmaExportNode): string | null {
  const f = Array.isArray(n.fills) ? n.fills[0] : null;
  if (!f || f.type !== 'SOLID' || !f.color) return null;
  const { r, g, b } = f.color;
  const R = Math.round(r * 255);
  const G = Math.round(g * 255);
  const B = Math.round(b * 255);
  return `rgb(${R}, ${G}, ${B})`;
}

function cssBox(n: FigmaExportNode): string {
  const parts: string[] = [];
  const box = n.absoluteBoundingBox;
  if (box && typeof box.width === 'number') parts.push(`width: ${Math.round(box.width)}px`);
  if (box && typeof box.height === 'number') parts.push(`min-height: ${Math.round(box.height)}px`);
  const lay = n.layout;
  if (lay?.mode === 'HORIZONTAL') {
    parts.push('display: flex', 'flex-direction: row', 'align-items: stretch');
    if (typeof lay.itemSpacing === 'number') parts.push(`gap: ${lay.itemSpacing}px`);
  } else if (lay?.mode === 'VERTICAL') {
    parts.push('display: flex', 'flex-direction: column', 'align-items: stretch');
    if (typeof lay.itemSpacing === 'number') parts.push(`gap: ${lay.itemSpacing}px`);
  }
  if (lay) {
    const pt = lay.paddingTop ?? 0;
    const pr = lay.paddingRight ?? 0;
    const pb = lay.paddingBottom ?? 0;
    const pl = lay.paddingLeft ?? 0;
    if (pt || pr || pb || pl) parts.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px`);
  }
  const bg = rgbFromFill(n);
  if (bg) parts.push(`background: ${bg}`);
  return parts.join('; ');
}

/** React: oggetto style inline */
function reactStyleObject(n: FigmaExportNode): string {
  const parts: string[] = [];
  const box = n.absoluteBoundingBox;
  if (box && typeof box.width === 'number') parts.push(`width: '${Math.round(box.width)}px'`);
  if (box && typeof box.height === 'number') parts.push(`minHeight: '${Math.round(box.height)}px'`);
  const lay = n.layout;
  if (lay?.mode === 'HORIZONTAL') {
    parts.push(`display: 'flex'`, `flexDirection: 'row'`);
    if (typeof lay.itemSpacing === 'number') parts.push(`gap: ${lay.itemSpacing}`);
  } else if (lay?.mode === 'VERTICAL') {
    parts.push(`display: 'flex'`, `flexDirection: 'column'`);
    if (typeof lay.itemSpacing === 'number') parts.push(`gap: ${lay.itemSpacing}`);
  }
  if (lay) {
    const pt = lay.paddingTop ?? 0;
    const pr = lay.paddingRight ?? 0;
    const pb = lay.paddingBottom ?? 0;
    const pl = lay.paddingLeft ?? 0;
    if (pt || pr || pb || pl) parts.push(`padding: '${pt}px ${pr}px ${pb}px ${pl}px'`);
  }
  const bg = rgbFromFill(n);
  if (bg) parts.push(`backgroundColor: '${bg}'`);
  return parts.length ? ` style={{ ${parts.join(', ')} }}` : '';
}

function escapeJsxText(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function walkReact(n: FigmaExportNode, depth: number): string {
  const pad = '  '.repeat(depth);
  if (n.visible === false) return '';
  if (n.type === 'TEXT' && n.characters) {
    return `${pad}<span${reactStyleObject(n)}>${escapeJsxText(n.characters)}</span>\n`;
  }
  const children = (n.children || []).map((c) => walkReact(c, depth + 1)).join('');
  return `${pad}<div data-figma-id="${safeId(n.id, 'n')}" data-figma-type="${n.type || 'NODE'}"${reactStyleObject(n)}>\n${children}${pad}</div>\n`;
}

function walkHtml(n: FigmaExportNode, depth: number, classPrefix: string): string {
  const pad = '  '.repeat(depth);
  if (n.visible === false) return '';
  const cls = `${classPrefix}-${safeId(n.id, 'n')}`;
  if (n.type === 'TEXT' && n.characters) {
    return `${pad}<span class="${cls}-text">${escapeHtml(n.characters)}</span>\n`;
  }
  const children = (n.children || []).map((c) => walkHtml(c, depth + 1, classPrefix)).join('');
  return `${pad}<div class="${cls}" data-figma-type="${escapeHtml(n.type || 'NODE')}">\n${children}${pad}</div>\n`;
}

function collectCssRules(n: FigmaExportNode, classPrefix: string, out: string[]): void {
  if (n.visible === false) return;
  const cls = `${classPrefix}-${safeId(n.id, 'n')}`;
  const box = cssBox(n);
  if (n.type === 'TEXT' && n.characters) {
    const t = cssBox(n);
    if (t) out.push(`.${cls}-text { ${t} }`);
    return;
  }
  if (box) out.push(`.${cls} { ${box} }`);
  for (const c of n.children || []) collectCssRules(c, classPrefix, out);
}

function walkLiquid(n: FigmaExportNode, depth: number): string {
  const pad = '  '.repeat(depth);
  if (n.visible === false) return '';
  if (n.type === 'TEXT' && n.characters) {
    return `${pad}<span class="figma-text figma-${safeId(n.id, 't')}">${escapeHtml(n.characters)}</span>\n`;
  }
  const children = (n.children || []).map((c) => walkLiquid(c, depth + 1)).join('');
  return `${pad}<div class="figma-frame figma-${safeId(n.id, 'f')}" data-layer="${escapeHtml(n.name || '')}">\n${children}${pad}</div>\n`;
}

function walkVueInline(n: FigmaExportNode, depth: number): string {
  const pad = '  '.repeat(depth);
  if (n.visible === false) return '';
  const inline = cssBox(n);
  const styleAttr = inline ? ` style="${escapeHtml(inline)}"` : '';
  if (n.type === 'TEXT' && n.characters) {
    return `${pad}<span${styleAttr}>${escapeHtml(n.characters)}</span>\n`;
  }
  const children = (n.children || []).map((c) => walkVueInline(c, depth + 1)).join('');
  return `${pad}<div data-figma-id="${safeId(n.id, 'n')}"${styleAttr}>\n${children}${pad}</div>\n`;
}

/** Public: export locale profondo per formato Target */
export function exportLocalDeepCode(format: string, root: unknown): string {
  const fmt = String(format || 'REACT').toUpperCase();
  if (!root || typeof root !== 'object') {
    return '// No selection data from Figma.\n';
  }
  const node = root as FigmaExportNode;
  const comp = pascalCase(node.name || 'Exported');
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const header = `/* Comtra local export — ${ts} — FREE tier (deterministic, full subtree) */\n`;

  switch (fmt) {
    case 'REACT': {
      const body = walkReact(node, 2);
      const trunc = node._meta?.truncated ? `\n  {/* Note: export was truncated at source (_meta.truncated) */}\n` : '';
      return `${header}export const ${comp} = () => (\n  <div className="figma-export-root">${trunc}\n${body}  </div>\n);\n`;
    }
    case 'STORYBOOK': {
      const body = walkReact(node, 2);
      return `${header}import type { Meta, StoryObj } from '@storybook/react';\n\nexport const ${comp} = () => (\n  <div className="figma-export-root">\n${body}  </div>\n);\n\nconst meta = {\n  component: ${comp},\n  title: 'Figma/${comp}',\n} satisfies Meta<typeof ${comp}>;\nexport default meta;\n\ntype Story = StoryObj<typeof ${comp}>;\n\nexport const FromFigma: Story = {\n  render: () => <${comp} />,\n};\n`;
    }
    case 'LIQUID': {
      const body = walkLiquid(node, 0);
      return `${header}{% comment %} Local export — full subtree {% endcomment %}\n<div class="figma-root figma-${safeId(node.id, 'root')}">\n${body}</div>\n`;
    }
    case 'CSS': {
      const prefix = `fe_${safeId(node.id, 'r')}`;
      const html = walkHtml(node, 0, prefix);
      const rules: string[] = [];
      collectCssRules(node, prefix, rules);
      return `${header}<style>\n${rules.join('\n')}\n</style>\n<section class="${prefix}-${safeId(node.id, 'n')}">\n${html}</section>\n`;
    }
    case 'VUE': {
      const body = walkVueInline(node, 2);
      return `${header}<template>\n  <div class="figma-export-root">\n${body}  </div>\n</template>\n\n<script setup lang="ts">\n</script>\n`;
    }
    case 'SVELTE': {
      const inner = walkReact(node, 2).replace(/className=/g, 'class=');
      return `${header}<script lang="ts">\n</script>\n\n<div class="figma-export-root">\n${inner}</div>\n`;
    }
    case 'ANGULAR': {
      const tpl = walkHtml(node, 0, 'ang').replace(/\n/g, '\n    ');
      return `${header}import { Component } from '@angular/core';\n\n@Component({\n  selector: 'app-${safeId(node.name, 'x').toLowerCase()}',\n  standalone: true,\n  template: \`\n    <section class="figma-export-root">\n    ${tpl}\n    </section>\n  \`,\n  styles: [\`\n    .figma-export-root { box-sizing: border-box; }\n  \`],\n})\nexport class ${comp}Component {}\n`;
    }
    default:
      return `${header}// Unsupported format: ${fmt}\n`;
  }
}

/** Raccoglie tutti gli id nel subtree per match Storybook */
export function collectSubtreeNodeIds(root: unknown): Set<string> {
  const ids = new Set<string>();
  function walk(n: unknown) {
    if (!n || typeof n !== 'object') return;
    const o = n as FigmaExportNode;
    if (o.id) ids.add(String(o.id));
    for (const c of o.children || []) walk(c);
  }
  walk(root);
  return ids;
}

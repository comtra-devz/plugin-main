import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const checklistPath = path.join(__dirname, 'CONFORMANCE-CHECKLIST.json');
const manifestPath = path.join(__dirname, 'manifest.json');
const tokensPath = path.join(__dirname, 'tokens.json');
const rulesPath = path.join(__dirname, 'rules.json');
const componentsPath = path.join(__dirname, 'components.json');
const reportPath = path.join(__dirname, 'conformance-report.json');

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function collectTokenPaths(obj, prefix = '') {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
      out.push(next);
    } else {
      out.push(...collectTokenPaths(value, next));
    }
  }
  return out;
}

function scaffoldComponent(id) {
  return {
    component_id: id,
    display_name: id
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' '),
    category: 'unclassified',
    description: `Material 3 component scaffold for ${id}`,
    figma_component_key: `${id.replace(/-/g, '/')}`,
    anatomy: {
      container: {
        type: 'frame',
        tokens: {
          background: 'color.semantic.surface',
          borderRadius: 'borderRadius.md',
          paddingHorizontal: 'spacing.md',
          paddingVertical: 'spacing.sm'
        }
      }
    },
    variants: { default: { default: true } },
    states: { default: {} },
    constraints: [{ rule: 'm3-scaffold-needs-refinement', value: 1, unit: 'boolean' }],
    slots: {}
  };
}

function countRules(rules) {
  return Object.entries(rules || {}).reduce((acc, [k, v]) => {
    if (k.startsWith('$')) return acc;
    if (Array.isArray(v)) return acc + v.length;
    return acc;
  }, 0);
}

const checklist = readJson(checklistPath);
const manifest = readJson(manifestPath);
const tokens = readJson(tokensPath);
const rules = readJson(rulesPath);
const components = readJson(componentsPath);
components.components = components.components || {};

const tokenCount = collectTokenPaths(tokens).length;
const currentComponentIds = Object.keys(components.components);
const missingComponents = checklist.required_component_ids.filter((id) => !currentComponentIds.includes(id));
const missingRuleGroups = checklist.required_rule_groups.filter((group) => !Array.isArray(rules[group]));
const missingThemes = checklist.required_themes.filter((t) => !(manifest.supported_themes || []).includes(t));
const ruleCount = countRules(rules);

const doAutofill = process.argv.includes('--autofill');
if (doAutofill && missingComponents.length) {
  for (const id of missingComponents) {
    components.components[id] = scaffoldComponent(id);
  }
  writeFileSync(componentsPath, `${JSON.stringify(components, null, 2)}\n`);
}

const finalComponents = Object.keys(components.components);
const finalMissingComponents = checklist.required_component_ids.filter((id) => !finalComponents.includes(id));
const scaffoldComponents = Object.entries(components.components)
  .filter(([, component]) => Array.isArray(component?.constraints) && component.constraints.some((x) => x?.rule === 'm3-scaffold-needs-refinement'))
  .map(([id]) => id);
const report = {
  profile: checklist.profile,
  generated_at: new Date().toISOString(),
  summary: {
    token_count: tokenCount,
    min_token_count: checklist.minimum_token_count,
    token_ok: tokenCount >= checklist.minimum_token_count,
    rule_count: ruleCount,
    min_rule_count: checklist.minimum_rule_count,
    rule_ok: ruleCount >= checklist.minimum_rule_count,
    component_count: finalComponents.length,
    required_component_count: checklist.required_component_ids.length,
    components_ok: finalMissingComponents.length === 0,
    scaffold_component_count: scaffoldComponents.length,
    rule_groups_ok: missingRuleGroups.length === 0,
    themes_ok: missingThemes.length === 0
  },
  gaps: {
    missing_components: finalMissingComponents,
    missing_rule_groups: missingRuleGroups,
    missing_themes: missingThemes,
    scaffold_components: scaffoldComponents
  },
  notes: [
    doAutofill ? 'Autofill mode created scaffolds for missing components.' : 'Autofill disabled.',
    scaffoldComponents.length === 0
      ? 'No scaffold components detected.'
      : 'Scaffolded components detected and require refinement for strict conformance.'
  ]
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));

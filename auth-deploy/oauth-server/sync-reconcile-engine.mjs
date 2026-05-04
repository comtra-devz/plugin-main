/**
 * Deep Sync — PRO reconcile: Storybook + repo context + Qwen structured mapping + algorithmic fallback.
 * Wizard / source connection unchanged: repo token loaded from DB (user_source_connections).
 */

import { fetchStorybookMetadata } from './sync-scan-engine.mjs';
import { callQwenChatCompletion } from './qwen-client.mjs';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeStorybookUrlDb(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const pathname = u.pathname.replace(/\/+$/g, '');
    return `${u.origin}${pathname}`.slice(0, 1200);
  } catch {
    return raw.replace(/\/+$/g, '').slice(0, 1200);
  }
}

function parseGitHubRepoUrl(repoUrl) {
  const ssh = String(repoUrl || '').match(/^git@github\.com:([^/]+)\/(.+)$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2].replace(/\.git$/i, '') };
  try {
    const u = new URL(repoUrl);
    if (!/github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, '') };
  } catch {
    return null;
  }
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Comtra-DeepSync/1.0',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

async function listRepoFiles({ provider, repoUrl, branch, sourceToken }) {
  const token = typeof sourceToken === 'string' && sourceToken.trim() ? sourceToken.trim() : '';
  const authHeaders = token ? { Authorization: /^bearer\s+/i.test(token) ? token : `Bearer ${token}` } : {};
  if (provider === 'github') {
    const parsed = parseGitHubRepoUrl(repoUrl);
    if (!parsed) throw new Error('Invalid GitHub repository URL.');
    const data = await fetchJson(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers: authHeaders },
    );
    return Array.isArray(data?.tree)
      ? data.tree.filter((x) => x?.type === 'blob' && typeof x.path === 'string').map((x) => x.path)
      : [];
  }
  throw new Error(`Deep Sync repo listing for provider "${provider}" is not supported in this build.`);
}

async function githubFetchRawText(owner, repo, path, ref, token) {
  const authHeaders = token ? { Authorization: /^bearer\s+/i.test(token) ? token : `Bearer ${token}` } : {};
  const u = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
  );
  u.searchParams.set('ref', ref);
  const res = await fetch(u.toString().replace(/%252F/g, '%2F'), {
    headers: { Accept: 'application/vnd.github.raw', ...authHeaders, 'User-Agent': 'Comtra-DeepSync/1.0' },
  });
  if (res.ok) return await res.text();
  const res2 = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
      .split('/')
      .map((p) => encodeURIComponent(p))
      .join('/')}?ref=${encodeURIComponent(ref)}`,
    { headers: { Accept: 'application/vnd.github+json', ...authHeaders, 'User-Agent': 'Comtra-DeepSync/1.0' } },
  );
  const j = await res2.json().catch(() => null);
  if (!res2.ok) throw new Error(j?.message || `GitHub file fetch failed (${res2.status})`);
  if (j?.encoding === 'base64' && typeof j.content === 'string') {
    return Buffer.from(j.content.replace(/\n/g, ''), 'base64').toString('utf8');
  }
  throw new Error('Unexpected GitHub contents response');
}

function storiesFromMetadata(sb) {
  const out = [];
  const seen = new Set();
  const raw = sb?.stories || sb?.components;
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  for (const s of arr) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.id || s.name || '').trim();
    const title = String(s.title || '').trim();
    const name = String(s.name || '').trim();
    if (!id && !title) continue;
    const k = `${id}::${title}::${name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      id: id || `${title}/${name}`,
      title,
      name,
      parameters: s.parameters,
      args: s.args,
      argTypes: s.argTypes,
    });
  }
  return out;
}

function extractFigmaNodeIdsFromStory(story) {
  const ids = new Set();
  const walk = (v, depth) => {
    if (depth > 12 || v == null) return;
    if (typeof v === 'string') {
      const m = v.match(/(\d+[:]\d+)|(\d+[-]\d+)/g);
      if (m) for (const x of m) ids.add(x.replace('-', ':'));
      return;
    }
    if (typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    for (const k of Object.keys(v)) walk(v[k], depth + 1);
  };
  walk(story.parameters, 0);
  walk(story.args, 0);
  return [...ids];
}

function stripCodeFences(text) {
  let t = String(text || '').trim();
  if (!t.startsWith('```')) return t;
  t = t.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '');
  t = t.replace(/\n```[\s\S]*$/, '');
  return t.trim();
}

function safeJsonParseObject(text) {
  const cleaned = stripCodeFences(text);
  try {
    const o = JSON.parse(cleaned);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

function normalizeNameToken(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function stripGenericAffixes(raw) {
  const prefixes = ['components', 'component', 'ui', 'base', 'atoms', 'molecules', 'organisms', 'shared', 'common'];
  const suffixes = ['default', 'primary', 'base', 'root', 'main'];
  let t = String(raw || '').toLowerCase();
  t = t.replace(/[\/._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const bits = t ? t.split(' ') : [];
  const noPrefix = bits.filter((x, i) => !(i === 0 && prefixes.includes(x)));
  const noSuffix = noPrefix.filter((x, i) => !(i === noPrefix.length - 1 && suffixes.includes(x)));
  return noSuffix
    .map((x) => (x.endsWith('s') && x.length > 3 ? x.slice(0, -1) : x))
    .join(' ')
    .trim();
}

function normalizeNamePhrase(s) {
  const base = stripGenericAffixes(s);
  return base.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function levenshteinScore(a, b) {
  const aa = normalizeNameToken(a);
  const bb = normalizeNameToken(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  const m = Math.max(aa.length, bb.length);
  const dp = [];
  for (let i = 0; i <= bb.length; i++) dp[i] = i;
  for (let i = 1; i <= aa.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= bb.length; j++) {
      const tmp = dp[j];
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return 1 - dp[bb.length] / m;
}

function jaccardTokenScore(a, b) {
  const ta = new Set(normalizeNamePhrase(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeNamePhrase(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter++;
  return inter / Math.max(1, ta.size + tb.size - inter);
}

function compositeNameScore(a, b) {
  const exactA = normalizeNamePhrase(a).replace(/\s+/g, '');
  const exactB = normalizeNamePhrase(b).replace(/\s+/g, '');
  if (!exactA || !exactB) return 0;
  if (exactA === exactB) return 1;
  const lev = levenshteinScore(a, b);
  const jac = jaccardTokenScore(a, b);
  return Math.max(0, Math.min(0.95, lev * 0.4 + jac * 0.6));
}

function extractStoryComponentKeysFromStory(story) {
  const keys = new Set();
  const walk = (v, depth) => {
    if (depth > 8 || v == null) return;
    if (typeof v === 'string') {
      if (/^[0-9a-z]{40,}$/i.test(v)) keys.add(v);
      return;
    }
    if (typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1);
      return;
    }
    for (const [k, val] of Object.entries(v)) {
      if (/componentkey/i.test(k) && typeof val === 'string' && val.trim()) keys.add(val.trim());
      walk(val, depth + 1);
    }
  };
  walk(story.parameters, 0);
  walk(story.args, 0);
  return [...keys];
}

function extractVariantAxesFromStory(story) {
  const out = new Set();
  const argTypes = story?.argTypes && typeof story.argTypes === 'object' ? Object.keys(story.argTypes) : [];
  const args = story?.args && typeof story.args === 'object' ? Object.keys(story.args) : [];
  for (const k of [...argTypes, ...args]) out.add(String(k));
  return [...out];
}

function scoreWithVariantBoost(figmaComp, story, score) {
  const axes = figmaComp?.variantProperties && typeof figmaComp.variantProperties === 'object'
    ? Object.keys(figmaComp.variantProperties)
    : [];
  if (!axes.length) return score;
  const storyKeys = new Set(extractVariantAxesFromStory(story).map((x) => normalizeNameToken(x)));
  let boost = 0;
  for (const axis of axes) {
    if (!axis) continue;
    if (storyKeys.has(normalizeNameToken(axis))) boost += 0.05;
  }
  return Math.min(0.95, score + boost);
}

function derivePageName(syncSnapshot, pageId) {
  const pages = Array.isArray(syncSnapshot?.pages) ? syncSnapshot.pages : [];
  const hit = pages.find((p) => String(p?.id || '') === String(pageId || ''));
  return hit?.name ? String(hit.name) : null;
}

function parseStoryFileInsight(path, text, stories) {
  const titleMatch = text.match(/title\s*:\s*['"`]([^'"`]+)['"`]/);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const importMatch = text.match(/import\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/);
  const componentImport = importMatch ? importMatch[1].trim() : null;
  const exportNames = [];
  const rgx = /export\s+const\s+([A-Za-z0-9_]+)/g;
  let m;
  while ((m = rgx.exec(text))) exportNames.push(m[1]);
  const figmaNodeIds = [...new Set((text.match(/(\d+[:]\d+)|(\d+[-]\d+)/g) || []).map((x) => x.replace('-', ':')))];
  const candidateStoryIds = stories
    .filter((s) => (title && s.title === title) || exportNames.some((n) => normalizeNameToken(n) === normalizeNameToken(s.name)))
    .map((s) => s.id);
  return {
    path,
    title: title || null,
    componentImport,
    storyIds: candidateStoryIds,
    figmaNodeIds,
    excerpt: text.slice(0, 9000),
  };
}

/**
 * Algorithmic fallback (doc): identities, explicit figma ids in story params, fuzzy names.
 */
function runAlgorithmicReconcile({ syncSnapshot, stories, comtraIdentities }) {
  const comps = Array.isArray(syncSnapshot?.components) ? syncSnapshot.components : [];
  const figmaById = new Map(comps.map((c) => [String(c.key), c]));
  const usedStories = new Set();
  const matches = [];

  for (const c of comps) {
    const fid = String(c.key);
    const idObj = comtraIdentities && typeof comtraIdentities === 'object' ? comtraIdentities[fid] : null;
    const storyId = idObj && typeof idObj.storybookId === 'string' ? idObj.storybookId : null;
    if (storyId) {
      const st = stories.find((s) => s.id === storyId);
      if (st) {
        usedStories.add(st.id);
        matches.push({
          figma_node_id: fid,
          story_id: st.id,
          repo_path: typeof idObj.repoPath === 'string' ? idObj.repoPath : null,
          confidence: 1,
          confidence_reason: 'Persistent comtra identity',
          confirmed_by: 'agent_high_confidence',
          drift: {
            has_drift: true,
            drift_type: 'UNKNOWN',
            description: 'Re-evaluate after design change (identity match).',
            suggested_fix: 'Run reconcile after updating code or Figma.',
            diff: null,
          },
        });
        continue;
      }
    }
  }

  for (const st of stories) {
    const ids = extractFigmaNodeIdsFromStory(st);
    for (const nodeId of ids) {
      const fig = figmaById.get(nodeId);
      if (fig && !matches.some((m) => m.figma_node_id === nodeId)) {
        usedStories.add(st.id);
        matches.push({
          figma_node_id: nodeId,
          story_id: st.id,
          repo_path: null,
          confidence: 1,
          confidence_reason: 'Story parameters reference Figma node id',
          confirmed_by: 'agent_high_confidence',
          drift: {
            has_drift: true,
            drift_type: 'NAMING_ONLY',
            description: 'Linked via Storybook parameters. Verify props vs variants manually.',
            suggested_fix: 'Align Story args with Figma variant properties.',
            diff: null,
          },
        });
      }
    }
  }

  for (const c of comps) {
    const ck = typeof c?.figmaComponentKey === 'string' && c.figmaComponentKey.trim() ? c.figmaComponentKey.trim() : null;
    if (!ck || matches.some((m) => m.figma_node_id === String(c.key))) continue;
    const st = stories.find((x) => extractStoryComponentKeysFromStory(x).includes(ck));
    if (!st) continue;
    usedStories.add(st.id);
    matches.push({
      figma_node_id: String(c.key),
      story_id: st.id,
      repo_path: null,
      confidence: 1,
      confidence_reason: 'Matched by Figma published component key',
      confirmed_by: 'agent_high_confidence',
      drift: {
        has_drift: true,
        drift_type: 'NAMING_ONLY',
        description: 'Matched via componentKey from Storybook parameters.',
        suggested_fix: 'Validate variants and args alignment.',
        diff: null,
      },
    });
  }

  for (const c of comps) {
    if (matches.some((m) => m.figma_node_id === String(c.key))) continue;
    let best = null;
    let bestScore = 0;
    for (const st of stories) {
      if (usedStories.has(st.id)) continue;
      const label = `${st.title || ''}/${st.name || ''}`.replace(/\/+/g, '/');
      const s1 = compositeNameScore(c.name, st.name);
      const s2 = compositeNameScore(c.name, label);
      const s3 = compositeNameScore(c.name, st.id.replace(/--/g, '/').replace(/-/g, ' '));
      const sc = scoreWithVariantBoost(c, st, Math.max(s1, s2, s3));
      if (sc > bestScore) {
        bestScore = sc;
        best = st;
      }
    }
    if (best && bestScore >= 0.85) {
      usedStories.add(best.id);
      matches.push({
        figma_node_id: String(c.key),
        story_id: best.id,
        repo_path: null,
        confidence: bestScore,
        confidence_reason: `Fuzzy name score ${bestScore.toFixed(2)}`,
        confirmed_by: 'agent_high_confidence',
        drift: {
          has_drift: true,
          drift_type: 'NAMING_ONLY',
          description: 'Heuristic name match (standard analysis).',
          suggested_fix: 'Confirm mapping in Storybook parameters.figma when possible.',
          diff: null,
        },
      });
    } else if (best && bestScore >= 0.6) {
      matches.push({
        figma_node_id: String(c.key),
        story_id: best.id,
        repo_path: null,
        confidence: bestScore,
        confidence_reason: `Fuzzy name score ${bestScore.toFixed(2)}`,
        confirmed_by: 'agent_medium',
        drift: {
          has_drift: true,
          drift_type: 'UNKNOWN',
          description: 'Possible match — needs review.',
          suggested_fix: 'Confirm or reject in the plugin.',
          diff: null,
        },
      });
      usedStories.add(best.id);
    }
  }

  const matchedFigma = new Set(matches.map((m) => m.figma_node_id));
  const unmatched_figma = comps.filter((c) => !matchedFigma.has(String(c.key))).map((c) => String(c.key));
  const unmatched_stories = stories.filter((s) => !usedStories.has(s.id)).map((s) => s.id);

  return {
    matches,
    unmatched_figma,
    unmatched_stories,
    reasoning_summary: 'Standard analysis: identities, Storybook figma parameters, then fuzzy names.',
  };
}

function driftItemsFromReconcileResult({ result, storybookUrl, analysisMode }) {
  const items = [];
  const itemDedup = new Set();
  let idx = 0;
  const matches = Array.isArray(result.matches) ? result.matches : [];
  for (const m of matches) {
    const conf = Number(m.confidence) || 0;
    const confirmedBy = String(m.confirmed_by || '');
    let syncCategory = 'drift';
    if (conf >= 0.85 && confirmedBy.includes('high')) syncCategory = 'drift';
    else if (conf >= 0.6 && conf < 0.85) syncCategory = 'needs_review';
    else if (conf < 0.6) syncCategory = 'needs_review';

    const fig = m.figma_node_id;
    const st = m.story_id;
    const repoPath = m.repo_path || null;
    const diff = analysisMode === 'standard' ? null : m.drift?.diff ?? null;
    const driftType = String(m.drift?.drift_type || 'DRIFT');
    if (driftType === 'IN_SYNC' || m.drift?.has_drift === false) syncCategory = 'in_sync';
    const dedupKey = `${syncCategory}|${fig}|${st}|${driftType}`;
    if (itemDedup.has(dedupKey)) continue;
    itemDedup.add(dedupKey);
    items.push({
      id: `reconcile-${idx++}`,
      name: String(fig),
      status: driftType,
      lastEdited: '—',
      desc: String(m.drift?.description || m.confidence_reason || 'Drift'),
      layerId: fig,
      reason: m.confidence_reason || null,
      confidence: conf >= 0.85 ? 'high' : conf >= 0.6 ? 'medium' : 'low',
      figmaName: fig,
      storybookName: st,
      storybookUrl: storybookUrl || null,
      suggestedAction: String(m.drift?.suggested_fix || ''),
      syncAction: null,
      syncCategory,
      repoPath,
      diff,
      confidenceScore: conf,
      storyId: st,
      analysisMode,
    });
  }
  for (const id of [...new Set(result.unmatched_figma || [])]) {
    const dedupKey = `unmatched_figma|${id}`;
    if (itemDedup.has(dedupKey)) continue;
    itemDedup.add(dedupKey);
    items.push({
      id: `unfig-${idx++}`,
      name: id,
      status: 'UNMATCHED_FIGMA',
      lastEdited: '—',
      desc: 'No Storybook match (standard or AI analysis).',
      layerId: id,
      syncCategory: 'unmatched_figma',
      analysisMode,
    });
  }
  for (const id of [...new Set(result.unmatched_stories || [])]) {
    const labelKey = normalizeNameToken(String(id).replace(/--/g, ' ').replace(/-/g, ' '));
    const dedupKey = `unmatched_story|${labelKey || id}`;
    if (itemDedup.has(dedupKey)) continue;
    itemDedup.add(dedupKey);
    items.push({
      id: `unst-${idx++}`,
      name: id,
      status: 'UNMATCHED_STORY',
      lastEdited: '—',
      desc: 'Story not matched to a Figma component in this file.',
      syncCategory: 'unmatched_story',
      storybookName: id,
      analysisMode,
    });
  }
  return items;
}

function postProcessMatches({ parsed, stories, syncSnapshot }) {
  const figmaIds = new Set((Array.isArray(syncSnapshot?.components) ? syncSnapshot.components : []).map((c) => String(c.key)));
  const storyMap = new Map(stories.map((s) => [String(s.id), s]));
  const out = [];
  const seen = new Set();
  for (const m of Array.isArray(parsed?.matches) ? parsed.matches : []) {
    const figmaId = String(m?.figma_node_id || '').trim();
    const storyId = String(m?.story_id || '').trim();
    if (!figmaId || !storyId || !figmaIds.has(figmaId) || !storyMap.has(storyId)) continue;
    const key = `${figmaId}|${storyId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const story = storyMap.get(storyId);
    const explicitIds = extractFigmaNodeIdsFromStory(story || {});
    const confidence = explicitIds.includes(figmaId) ? 1 : Math.max(0, Math.min(1, Number(m?.confidence) || 0));
    if (confidence < 0.6) continue;
    out.push({
      ...m,
      figma_node_id: figmaId,
      story_id: storyId,
      confidence,
      confirmed_by: confidence >= 0.85 ? 'agent_high_confidence' : (confidence >= 0.6 ? 'agent_medium' : 'agent_low'),
    });
  }
  const unmatchedFigma = [];
  const matchedFigmaSet = new Set(out.map((m) => String(m.figma_node_id)));
  for (const fid of figmaIds) {
    if (!matchedFigmaSet.has(fid)) unmatchedFigma.push(fid);
  }
  const unmatchedStories = [...new Set((parsed?.unmatched_stories || []).map((x) => String(x || '').trim()).filter(Boolean))];
  return {
    matches: out,
    unmatched_figma: unmatchedFigma,
    unmatched_stories: unmatchedStories,
    reasoning_summary: String(parsed?.reasoning_summary || ''),
  };
}

function buildPrPayloads(matches) {
  const byFile = new Map();
  for (const m of matches) {
    const path = typeof m.repo_path === 'string' && m.repo_path.trim() ? m.repo_path.trim() : null;
    if (!path || !m.drift?.diff) continue;
    if (!byFile.has(path)) {
      byFile.set(path, {
        repo_path: path,
        pr_title: `fix: align ${path.split('/').pop()} with Figma`,
        pr_body: 'Automated Deep Sync PR.',
        changes: [],
      });
    }
    byFile.get(path).changes.push({
      line_hint: null,
      original: '',
      replacement: String(m.drift.diff),
      description: String(m.drift.description || ''),
    });
  }
  return [...byFile.values()];
}

async function tryQwenReconcile({
  qwenBaseUrl,
  qwenApiKey,
  qwenModel,
  systemPrompt,
  userPayload,
  timeoutMs,
}) {
  const out = await callQwenChatCompletion({
    baseUrl: qwenBaseUrl,
    apiKey: qwenApiKey,
    model: qwenModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
    maxTokens: 8192,
    temperature: 0.1,
    timeoutMs,
  });
  return out?.content || '';
}

/**
 * @param {object} opts
 * @param {any} opts.sql
 * @param {string} opts.userId
 * @param {object} opts.syncSnapshot
 * @param {string} opts.storybookUrl
 * @param {string} [opts.storybookToken]
 * @param {string} opts.qwenBaseUrl
 * @param {string} opts.qwenApiKey
 * @param {string} opts.qwenModel
 */
export async function runDeepSyncReconcile(opts) {
  const { sql, userId, syncSnapshot, storybookUrl, storybookToken, qwenBaseUrl, qwenApiKey, qwenModel } = opts;
  const sbNorm = normalizeStorybookUrlDb(storybookUrl);
  const fileKey = String(syncSnapshot?.fileKey || '').trim();
  if (!fileKey) throw Object.assign(new Error('sync_snapshot.fileKey required'), { status: 400 });
  if (!sbNorm) throw Object.assign(new Error('storybook_url required'), { status: 400 });

  const rowSel = await sql`
    SELECT provider, repo_url, default_branch, storybook_path, source_access_token, status
    FROM user_source_connections
    WHERE user_id = ${userId}
      AND figma_file_key = ${fileKey}
      AND (
        storybook_url = ${sbNorm}
        OR regexp_replace(storybook_url, '/+$', '') = ${sbNorm}
      )
    LIMIT 1
  `;
  const row = rowSel?.rows?.[0];
  if (!row || row.status !== 'ready') {
    throw Object.assign(new Error('Source connection must be saved and ready (Connect source wizard).'), {
      status: 400,
      code: 'SOURCE_NOT_READY',
    });
  }
  const token = typeof row.source_access_token === 'string' ? row.source_access_token.trim() : '';
  if (!token) {
    throw Object.assign(new Error('Repository token missing. Finish source auth in the wizard.'), {
      status: 400,
      code: 'SOURCE_TOKEN_MISSING',
    });
  }

  const sb = await fetchStorybookMetadata(storybookUrl, storybookToken);
  if (sb.connectionStatus !== 'ok') {
    return {
      items: [],
      connectionStatus: sb.connectionStatus || 'unreachable',
      error: sb.error,
      analysis_mode: null,
      sync_session_id: null,
    };
  }

  const stories = storiesFromMetadata(sb);
  const provider = String(row.provider || 'github');
  const branch = String(row.default_branch || 'main').trim() || 'main';
  const storybookPath = String(row.storybook_path || '').trim().replace(/^\/+|\/+$/g, '');
  let files = [];
  try {
    files = await listRepoFiles({ provider, repoUrl: row.repo_url, branch, sourceToken: token });
  } catch (e) {
    throw Object.assign(new Error(e?.message || 'Repo listing failed'), { status: 400 });
  }

  const inBase = (p) => !storybookPath || p === storybookPath || p.startsWith(`${storybookPath}/`);
  const storyFiles = files
    .filter((p) => inBase(p) && /\.(stories|story)\.(js|jsx|ts|tsx|mdx)$/i.test(p))
    .sort((a, b) => a.length - b.length)
    .slice(0, 40);

  const gh = parseGitHubRepoUrl(row.repo_url);
  const storySnippets = [];
  const repoStoryMap = [];
  if (gh) {
    for (const p of storyFiles) {
      try {
        const txt = await githubFetchRawText(gh.owner, gh.repo, p, branch, token);
        repoStoryMap.push(parseStoryFileInsight(p, txt, stories));
        storySnippets.push({
          path: p,
          excerpt: txt.slice(0, 9000),
        });
      } catch {
        /* skip file */
      }
    }
  }

  const comtraIdentities = syncSnapshot?.comtra_identities || syncSnapshot?.comtraIdentities || {};
  const comps = (Array.isArray(syncSnapshot?.components) ? syncSnapshot.components : []).slice(0, 220);
  const systemPrompt = `You are a design-system mapping agent. Map Figma components to Storybook stories and source files.
Return ONLY valid JSON (no markdown) with this exact shape:
{"matches":[{"figma_node_id":"","story_id":"","repo_path":null,"confidence":0.9,"confidence_reason":"","confirmed_by":"agent_high_confidence","drift":{"has_drift":true,"drift_type":"VARIANT_MISMATCH|PROP_MISMATCH|NAMING_ONLY|IN_SYNC|UNKNOWN","description":"","suggested_fix":"","diff":null}}],"unmatched_figma":[],"unmatched_stories":[],"reasoning_summary":""}
Rules: Never invent story_id not present in STORYBOOK list. Use confidence 0-1. diff is a unified diff snippet or null if unsure.`;

  const userPayload = {
    FIGMA: comps.map((c) => ({
      id: c.key,
      name: c.name,
      type: 'COMPONENT',
      propertyKeys: c.variantProperties && typeof c.variantProperties === 'object' ? Object.keys(c.variantProperties) : [],
      variantAxes: c.variantProperties || null,
      pageId: c.pageId,
      pageName: derivePageName(syncSnapshot, c.pageId),
      figmaComponentKey: c.figmaComponentKey || null,
      identity: comtraIdentities[c.key] || null,
    })),
    STORYBOOK: stories.slice(0, 400).map((s) => ({
      id: s.id,
      title: s.title,
      name: s.name,
      argsKeys: s.args && typeof s.args === 'object' ? Object.keys(s.args) : [],
      argTypeKeys: s.argTypes && typeof s.argTypes === 'object' ? Object.keys(s.argTypes) : [],
      figmaHints: extractFigmaNodeIdsFromStory(s),
    })),
    REPO_STORY_MAP: repoStoryMap,
    REPO_STORY_FILES: storySnippets,
    ANCHORS: comtraIdentities,
  };

  let analysisMode = 'ai';
  let parsed = null;
  const timeoutMs = Math.max(45000, Number(process.env.QWEN_SYNC_TIMEOUT_MS || 95000));
  if (!qwenApiKey || !qwenBaseUrl) {
    analysisMode = 'standard';
  } else {
    const delays = [0, 5000, 15000];
    let lastErr = null;
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt]) await sleep(delays[attempt]);
      try {
        const raw = await tryQwenReconcile({
          qwenBaseUrl,
          qwenApiKey,
          qwenModel,
          systemPrompt,
          userPayload,
          timeoutMs,
        });
        parsed = safeJsonParseObject(raw);
        if (parsed && Array.isArray(parsed.matches)) break;
        lastErr = new Error('Qwen returned non-JSON or invalid shape');
      } catch (e) {
        lastErr = e;
      }
    }
    if (!parsed || !Array.isArray(parsed.matches)) {
      console.warn('[sync-reconcile] Qwen failed, using algorithmic fallback', lastErr?.message || lastErr);
      analysisMode = 'standard';
      parsed = null;
    }
  }

  let core = parsed ? postProcessMatches({ parsed, stories, syncSnapshot }) : null;
  if (!core) {
    core = runAlgorithmicReconcile({ syncSnapshot, stories, comtraIdentities });
  }

  const avg =
    core.matches && core.matches.length
      ? core.matches.reduce((a, m) => a + (Number(m.confidence) || 0), 0) / core.matches.length
      : null;

  const items = driftItemsFromReconcileResult({
    result: core,
    storybookUrl: sbNorm,
    analysisMode,
  });
  const prPayloads = analysisMode === 'ai' ? buildPrPayloads(core.matches || []) : [];

  let syncSessionId = null;
  if (sql) {
    try {
      const ins = await sql`
        INSERT INTO user_sync_sessions (
          user_id, figma_file_key, storybook_url, repo_provider, repo_url, repo_branch, storybook_path,
          pr_payloads, drift_items, analysis_mode, reasoning_summary, avg_confidence, updated_at
        )
        VALUES (
          ${userId},
          ${fileKey},
          ${sbNorm},
          ${provider},
          ${String(row.repo_url || '')},
          ${branch},
          ${storybookPath},
          ${JSON.stringify(prPayloads)}::jsonb,
          ${JSON.stringify(items)}::jsonb,
          ${analysisMode},
          ${String(core.reasoning_summary || '')},
          ${avg == null ? null : avg},
          NOW()
        )
        RETURNING id
      `;
      syncSessionId = ins?.rows?.[0]?.id ? String(ins.rows[0].id) : null;
    } catch (e) {
      console.warn('[sync-reconcile] session persist skipped', e?.message || e);
    }
  }

  return {
    items,
    connectionStatus: 'ok',
    analysis_mode: analysisMode,
    reasoning_summary: String(core.reasoning_summary || ''),
    avg_confidence: avg,
    sync_session_id: syncSessionId,
    pr_payloads: prPayloads,
  };
}

/**
 * GitHub only: apply saved session payloads and open PR(s).
 */
export async function openGithubPrsFromSession({
  sql,
  userId,
  syncSessionId,
  filePath,
  userConfirmed,
}) {
  if (!userConfirmed) throw Object.assign(new Error('user_confirmed required'), { status: 400 });
  const sel = await sql`
    SELECT id, user_id, repo_url, repo_branch, pr_payloads, pr_results, repo_provider
    FROM user_sync_sessions
    WHERE id = ${syncSessionId}::uuid AND user_id = ${userId}
    LIMIT 1
  `;
  const row = sel?.rows?.[0];
  if (!row) throw Object.assign(new Error('Session not found'), { status: 404 });
  if (String(row.repo_provider || 'github') !== 'github') {
    throw Object.assign(new Error('PR open is only implemented for GitHub in this build.'), { status: 501 });
  }

  const sessRow = await sql`
    SELECT figma_file_key, storybook_url FROM user_sync_sessions
    WHERE id = ${syncSessionId}::uuid AND user_id = ${userId}
    LIMIT 1
  `;
  const fk = sessRow?.rows?.[0]?.figma_file_key;
  const sbu = sessRow?.rows?.[0]?.storybook_url;
  const conn = await sql`
    SELECT source_access_token
    FROM user_source_connections
    WHERE user_id = ${userId}
      AND figma_file_key = ${fk}
      AND (
        storybook_url = ${sbu}
        OR regexp_replace(storybook_url, '/+$', '') = regexp_replace(${sbu}, '/+$', '')
      )
    LIMIT 1
  `;
  const token = String(conn?.rows?.[0]?.source_access_token || '').trim();
  if (!token) throw Object.assign(new Error('Missing repo token'), { status: 400 });

  const parsed = parseGitHubRepoUrl(row.repo_url);
  if (!parsed) throw Object.assign(new Error('Invalid repo URL'), { status: 400 });

  const payloads = Array.isArray(row.pr_payloads) ? row.pr_payloads : JSON.parse(row.pr_payloads || '[]');
  const targets = !filePath || !String(filePath).trim() ? payloads : payloads.filter((p) => p.repo_path === filePath);
  const results = [];

  const authHeaders = { Authorization: /^bearer\s+/i.test(token) ? token : `Bearer ${token}`, 'User-Agent': 'Comtra-DeepSync/1.0' };
  const refData = await fetchJson(
    `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/ref/heads/${encodeURIComponent(row.repo_branch)}`,
    { headers: authHeaders },
  );
  const baseSha = refData?.object?.sha;
  if (!baseSha) throw new Error('Could not resolve base branch SHA');

  for (const pl of targets) {
    const path = pl.repo_path;
    const branchName = `comtra/sync-${Date.now()}-${String(path).replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`;
    await fetchJson(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/refs`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      },
    );

    let content = '';
    let fileSha = null;
    try {
      const cur = await fetchJson(
        `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/contents/${path
          .split('/')
          .map((p) => encodeURIComponent(p))
          .join('/')}?ref=${encodeURIComponent(row.repo_branch)}`,
        { headers: { ...authHeaders, Accept: 'application/vnd.github+json' } },
      );
      if (cur?.encoding === 'base64' && typeof cur.content === 'string') {
        content = Buffer.from(cur.content.replace(/\n/g, ''), 'base64').toString('utf8');
        fileSha = cur.sha || null;
      }
    } catch {
      content = '';
    }

    for (const ch of pl.changes || []) {
      const rep = String(ch.replacement || '');
      if (rep && content.includes(String(ch.original || ''))) {
        content = content.split(String(ch.original || '')).join(rep);
      }
    }

    const b64 = Buffer.from(content, 'utf8').toString('base64');
    await fetchJson(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/contents/${path
        .split('/')
        .map((p) => encodeURIComponent(p))
        .join('/')}`,
      {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: pl.pr_title || `Comtra sync: ${path}`,
          content: b64,
          branch: branchName,
          sha: fileSha || undefined,
        }),
      },
    );

    const pr = await fetchJson(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pl.pr_title || `Comtra: ${path}`,
          body: pl.pr_body || 'Deep Sync PR',
          head: branchName,
          base: row.repo_branch,
        }),
      },
    );
    results.push({ file_path: path, pr_url: pr.html_url, pr_branch: branchName });
  }

  const merged = [...(Array.isArray(row.pr_results) ? row.pr_results : []), ...results];
  await sql`
    UPDATE user_sync_sessions
    SET pr_results = ${JSON.stringify(merged)}::jsonb, updated_at = NOW()
    WHERE id = ${syncSessionId}::uuid
  `;

  return results;
}

export async function getSessionPrStatus({ sql, userId, syncSessionId, prUrl }) {
  let url = typeof prUrl === 'string' && prUrl.trim() ? prUrl.trim() : null;
  let sessionId = syncSessionId;
  if (!url && sessionId && sql) {
    const sel = await sql`
      SELECT pr_results FROM user_sync_sessions
      WHERE id = ${sessionId}::uuid AND user_id = ${userId}
      LIMIT 1
    `;
    const row = sel?.rows?.[0];
    const arr = Array.isArray(row?.pr_results) ? row.pr_results : [];
    url = typeof arr[0]?.pr_url === 'string' ? arr[0].pr_url : null;
  }
  if (!url) return { state: 'unknown', should_rescan: false };

  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  if (!m) return { state: 'unknown', should_rescan: false, pr_url: url };

  let token = '';
  if (sql && sessionId) {
    const sessRow = await sql`
      SELECT figma_file_key, storybook_url FROM user_sync_sessions
      WHERE id = ${sessionId}::uuid AND user_id = ${userId}
      LIMIT 1
    `;
    const fk = sessRow?.rows?.[0]?.figma_file_key;
    const sbu = sessRow?.rows?.[0]?.storybook_url;
    if (fk && sbu) {
      const conn = await sql`
        SELECT source_access_token FROM user_source_connections
        WHERE user_id = ${userId} AND figma_file_key = ${fk}
          AND (storybook_url = ${sbu} OR regexp_replace(storybook_url, '/+$', '') = regexp_replace(${sbu}, '/+$', ''))
        LIMIT 1
      `.catch(() => ({ rows: [] }));
      token = String(conn?.rows?.[0]?.source_access_token || '').trim();
    }
  }
  const headers = token
    ? { Authorization: /^bearer\s+/i.test(token) ? token : `Bearer ${token}`, 'User-Agent': 'Comtra-DeepSync/1.0' }
    : { 'User-Agent': 'Comtra-DeepSync/1.0' };
  try {
    const pr = await fetchJson(`https://api.github.com/repos/${m[1]}/${m[2]}/pulls/${m[3]}`, { headers });
    const st = String(pr.state || 'open');
    const merged = pr.merged_at != null;
    return {
      state: merged ? 'merged' : st,
      should_rescan: merged,
      pr_url: url,
    };
  } catch {
    return { state: 'unknown', should_rescan: false, pr_url: url };
  }
}

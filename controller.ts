// This file runs in the Figma main thread (sandbox)
// It handles API calls to the Figma document
/// <reference types="@figma/plugin-typings" />

declare const __html__: string;

figma.showUI(__html__, { width: 400, height: 700, themeColors: true });

const SESSION_DAYS = 30; // Durata sessione in giorni; 0 = nessuna scadenza (solo logout manuale)

async function getStoredUser(): Promise<any> {
  try {
    const raw = await figma.clientStorage.getAsync('figmaOAuthUser');
    if (!raw) return null;
    const payload = raw as { user?: any; savedAt?: number };
    const user = payload?.user ?? (typeof raw === 'object' && (raw as any).authToken ? raw : null);
    if (!user) return null;
    if (SESSION_DAYS > 0 && typeof payload?.savedAt === 'number') {
      const maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - payload.savedAt > maxAge) {
        await figma.clientStorage.deleteAsync('figmaOAuthUser');
        return null;
      }
    }
    return user;
  } catch (_) {
    return null;
  }
}

// Invia sessione salvata quando l'UI è pronta (risposta a get-saved-user) e all'avvio (per compatibilità)
(async () => {
  const user = await getStoredUser();
  figma.ui.postMessage({ type: 'restore-user', user });
})();

// Cache for node count by scope+pageId so we don't re-scan when user runs another audit (DS, A11Y, etc.) on same scope.
// Invalidated when scope or pageId changes; not used for scope 'current' (selection-dependent).
let nodeCountCache: { scope: string; pageId: string | undefined; count: number; target: string } | null = null;

/**
 * Switch to the page containing the node, select it, and reveal it in the viewport.
 * Works regardless of which page is currently active (Audit, Code/Sync, apply-fix, undo-fix).
 */
async function selectLayerAndReveal(layerId: string): Promise<boolean> {
  const node = await figma.getNodeByIdAsync(layerId);
  if (!node || !('id' in node)) return false;
  const sceneNode = node as SceneNode;
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === 'PAGE') {
      if (figma.currentPage !== current) {
        figma.currentPage = current as PageNode;
      }
      break;
    }
    current = current.parent;
  }
  figma.currentPage.selection = [sceneNode];
  // Defer viewport update so the page switch is applied before scrolling
  setTimeout(() => {
    figma.viewport.scrollAndZoomIntoView([sceneNode]);
  }, 0);
  return true;
}

/** Prototype Audit: P-01–P-04 (flow integrity). In-plugin, deterministic. */
async function runProtoAudit(page: PageNode, selectedFlowNodeIds: string[]): Promise<Array<{ id: string; rule_id: string; categoryId: string; msg: string; severity: 'HIGH' | 'MED' | 'LOW'; layerId: string; fix: string; pageName?: string; flowName?: string }>> {
  const pageName = page.name || 'Current page';
  const issues: Array<{ id: string; rule_id: string; categoryId: string; msg: string; severity: 'HIGH' | 'MED' | 'LOW'; layerId: string; fix: string; pageName?: string; flowName?: string }> = [];
  let p01Count = 0, p02Count = 0, p03Count = 0, p04Count = 0;

  const flows = (page as any).flowStartingPoints != null
    ? Array.from((page as any).flowStartingPoints as ReadonlyArray<{ nodeId: string; name: string }>)
    : [];
  const flowStartIds = new Set(flows.map((f: { nodeId: string }) => f.nodeId));
  const flowStartNames: Record<string, string> = {};
  flows.forEach((f: { nodeId: string; name: string }) => { flowStartNames[f.nodeId] = f.name || 'Flow'; });

  const topFrames = page.children.filter((n): n is FrameNode | ComponentNode => n.type === 'FRAME' || n.type === 'COMPONENT');
  const topFrameIds = new Set(topFrames.map((f) => f.id));

  function getRootFrameId(node: BaseNode): string | null {
    let n: BaseNode | null = node;
    while (n) {
      if (topFrameIds.has(n.id)) return n.id;
      n = n.parent;
    }
    return null;
  }

  const outgoingByFrame = new Map<string, boolean>();
  const destinationFrameIds = new Set<string>();
  const brokenReactions: Array<{ nodeId: string; nodeName: string; destId: string; flowName: string }> = [];

  function walkReactions(node: BaseNode, rootFrameId: string | null, flowName: string) {
    const r = (node as SceneNode & { reactions?: ReadonlyArray<{ actions?: Array<{ type: string; destinationId?: string | null }> }> }).reactions;
    if (!Array.isArray(r)) return;
    for (const reaction of r) {
      const actions = reaction.actions ?? (reaction as any).action ? [(reaction as any).action] : [];
      for (const a of actions) {
        if (!a || typeof a !== 'object') continue;
        if (a.type === 'NODE' && a.destinationId) {
          const dest = figma.getNodeById(a.destinationId);
          if (!dest) {
            brokenReactions.push({ nodeId: node.id, nodeName: node.name || 'Node', destId: a.destinationId, flowName });
          } else {
            const destRoot = getRootFrameId(dest);
            if (destRoot) {
              destinationFrameIds.add(destRoot);
              outgoingByFrame.set(rootFrameId || destRoot, true);
            }
          }
        } else if (a.type === 'BACK' || a.type === 'CLOSE') {
          if (rootFrameId) outgoingByFrame.set(rootFrameId, true);
        }
      }
    }
  }

  function walk(node: BaseNode, rootFrameId: string | null, flowName: string) {
    if ('reactions' in node && node.reactions) walkReactions(node, rootFrameId, flowName);
    if ('children' in node && Array.isArray((node as ChildrenMixin).children)) {
      for (const c of (node as ChildrenMixin).children as BaseNode[]) {
        walk(c, rootFrameId || getRootFrameId(c), flowName);
      }
    }
  }

  for (const frame of topFrames) {
    const rid = getRootFrameId(frame) || frame.id;
    walk(frame, rid, flowStartNames[frame.id] || '');
  }

  for (const br of brokenReactions) {
    p04Count++;
    issues.push({
      id: `P-04-${String(p04Count).padStart(3, '0')}`,
      rule_id: 'P-04',
      categoryId: 'flow-integrity',
      msg: 'Broken destination: target frame not found',
      severity: 'HIGH',
      layerId: br.nodeId,
      fix: 'Reconnect to an existing frame or remove the link. The target frame may have been deleted or moved.',
      pageName,
      flowName: br.flowName,
    });
  }

  if (flows.length === 0) {
    p03Count++;
    issues.push({
      id: `P-03-${String(p03Count).padStart(3, '0')}`,
      rule_id: 'P-03',
      categoryId: 'flow-integrity',
      msg: 'No flow starting point on this page',
      severity: 'HIGH',
      layerId: page.id,
      fix: 'Set at least one frame as flow starting point so the prototype can be previewed.',
      pageName,
    });
  }

  const reachable = new Set<string>();
  const toVisit = [...selectedFlowNodeIds];
  const visited = new Set<string>();
  while (toVisit.length > 0) {
    const fid = toVisit.pop()!;
    if (visited.has(fid)) continue;
    visited.add(fid);
    const node = figma.getNodeById(fid);
    if (node && (topFrameIds.has(fid) || flowStartIds.has(fid))) reachable.add(fid);
    if (node && 'children' in node) {
      function collectDests(n: BaseNode) {
        const r = (n as SceneNode & { reactions?: ReadonlyArray<{ actions?: Array<{ type: string; destinationId?: string | null }> }> }).reactions;
        if (Array.isArray(r)) {
          for (const re of r) {
            const acts = re.actions ?? (re as any).action ? [(re as any).action] : [];
            for (const a of acts) {
              if (a?.type === 'NODE' && a.destinationId) {
                const dest = figma.getNodeById(a.destinationId);
                if (dest) {
                  const destRoot = getRootFrameId(dest);
                  if (destRoot && !visited.has(destRoot)) toVisit.push(destRoot);
                }
              }
            }
          }
        }
        if ('children' in n) for (const c of (n as ChildrenMixin).children as BaseNode[]) collectDests(c);
      }
      collectDests(node);
    }
  }

  for (const fid of reachable) {
    if (flowStartIds.has(fid)) {
      if (!outgoingByFrame.get(fid)) {
        p03Count++;
        const flowName = flowStartNames[fid] || 'Flow';
        issues.push({
          id: `P-03-${String(p03Count).padStart(3, '0')}`,
          rule_id: 'P-03',
          categoryId: 'flow-integrity',
          msg: 'Flow starting point has no outgoing connection',
          severity: 'HIGH',
          layerId: fid,
          fix: 'Add at least one interaction from this starting frame to another frame.',
          pageName,
          flowName,
        });
      }
    } else if (!outgoingByFrame.get(fid)) {
      p01Count++;
      const flowName = Object.values(flowStartNames)[0] || 'Flow';
      issues.push({
        id: `P-01-${String(p01Count).padStart(3, '0')}`,
        rule_id: 'P-01',
        categoryId: 'flow-integrity',
        msg: 'Dead-end frame: no outgoing connections or Back actions',
        severity: 'HIGH',
        layerId: fid,
        fix: 'Add a Back action or Navigate to action so the user can leave this screen.',
        pageName,
        flowName,
      });
    }
  }

  for (const frame of topFrames) {
    const fid = frame.id;
    if (!flowStartIds.has(fid) && !destinationFrameIds.has(fid)) {
      p02Count++;
      issues.push({
        id: `P-02-${String(p02Count).padStart(3, '0')}`,
        rule_id: 'P-02',
        categoryId: 'flow-integrity',
        msg: 'Orphan frame: not connected to any flow',
        severity: 'HIGH',
        layerId: fid,
        fix: 'Connect this frame to a flow (add a Navigate to or Open overlay from another frame) or remove it if unused.',
        pageName,
      });
    }
  }

  return issues;
}

figma.ui.onmessage = async (raw: any) => {
  const msg = raw?.pluginMessage ?? raw;
  if (msg.type === 'resize-window') {
    figma.ui.resize(msg.width, msg.height);
  }

  if (msg.type === 'open-oauth-url') {
    if (msg.authUrl) figma.openExternal(msg.authUrl);
  }

  if (msg.type === 'oauth-complete') {
    const user = msg.user;
    if (user) {
      await figma.clientStorage.setAsync('figmaOAuthUser', { user, savedAt: Date.now() });
      figma.ui.postMessage({ type: 'login-success', user });
    }
  }

  if (msg.type === 'get-saved-user') {
    const user = await getStoredUser();
    figma.ui.postMessage({ type: 'restore-user', user });
  }

  if (msg.type === 'logout') {
    await figma.clientStorage.deleteAsync('figmaOAuthUser');
  }

  if (msg.type === 'get-selection') {
    const selection = figma.currentPage.selection;
    const nodes = selection.map((node: any) => ({
      id: node.id,
      name: node.name,
      type: node.type
    }));
    figma.ui.postMessage({ type: 'selection-changed', nodes });
  }

  if (msg.type === 'get-pages') {
    await figma.loadAllPagesAsync();
    const pages = figma.root.children.map((p: PageNode) => ({ id: p.id, name: p.name }));
    figma.ui.postMessage({ type: 'pages-result', pages });
  }

  if (msg.type === 'get-flow-starting-points') {
    const page = figma.currentPage;
    const flows = (page as any).flowStartingPoints != null
      ? Array.from((page as any).flowStartingPoints as ReadonlyArray<{ nodeId: string; name: string }>).map(f => ({ nodeId: f.nodeId, name: f.name }))
      : [];
    figma.ui.postMessage({ type: 'flow-starting-points-result', flows });
  }

  if (msg.type === 'run-proto-audit') {
    const selectedFlowNodeIds: string[] = Array.isArray(msg.selectedFlowNodeIds) ? msg.selectedFlowNodeIds : [];
    (async () => {
      try {
        const issues = await runProtoAudit(figma.currentPage, selectedFlowNodeIds);
        figma.ui.postMessage({ type: 'proto-audit-result', issues });
      } catch (e) {
        console.error('[run-proto-audit]', e);
        figma.ui.postMessage({ type: 'proto-audit-result', issues: [], error: String(e) });
      }
    })();
  }

  // Serialize document tree for audit. Chunked + yield so the main thread never blocks for long.
  const MAX_SERIALIZE_DEPTH = 6;
  const SERIALIZE_CHUNK = 20;
  const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

  function serializeNodeShallow(node: BaseNode): any {
    const out: any = { id: node.id, name: node.name, type: node.type, children: [] };
    if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
      const b = node.absoluteBoundingBox;
      out.absoluteBoundingBox = { x: b.x, y: b.y, width: b.width, height: b.height };
    }
    if ('fills' in node && node.fills !== figma.mixed) {
      const fills = Array.isArray(node.fills) ? node.fills : [];
      out.fills = fills.filter((p: any) => p.type === 'SOLID').map((p: any) => ({
        type: 'SOLID',
        color: p.color ? { r: p.color.r, g: p.color.g, b: p.color.b, a: p.color.a ?? 1 } : undefined,
        opacity: p.opacity,
      })).filter((p: any) => p.color);
      if (out.fills.length === 0) delete out.fills;
    }
    if (node.type === 'TEXT') {
      const tn = node as any;
      out.style = {};
      if (typeof tn.fontSize === 'number') out.style.fontSize = tn.fontSize;
      if (typeof tn.fontWeight === 'number') out.style.fontWeight = tn.fontWeight;
    }
    return out;
  }

  type SerializeQueueItem = { node: BaseNode; depth: number; parentArr: any[] };
  async function buildDocumentJsonAsync(opts: { scope?: string; nodeIds?: string[]; pageId?: string }): Promise<{ document: any }> {
    const scope = opts.scope ?? 'all';
    // Required with documentAccess: dynamic-page (Figma 2024+): load pages before accessing nodes
    await figma.loadAllPagesAsync();

    const processQueue = async (queue: SerializeQueueItem[]): Promise<void> => {
      while (queue.length > 0) {
        const batch = queue.splice(0, SERIALIZE_CHUNK);
        for (const { node, depth, parentArr } of batch) {
          if (depth <= 0) continue;
          const ser = serializeNodeShallow(node);
          parentArr.push(ser);
          if ('children' in node && Array.isArray((node as ChildrenMixin).children) && depth > 1) {
            const kids = (node as ChildrenMixin).children as BaseNode[];
            for (const c of kids) queue.push({ node: c, depth: depth - 1, parentArr: ser.children });
          }
        }
        if (queue.length > 0) await yieldToMain();
      }
    };

    if (scope === 'current' && opts.nodeIds?.length) {
      const children: any[] = [];
      const queue: SerializeQueueItem[] = [];
      for (const id of opts.nodeIds) {
        const node = await figma.getNodeByIdAsync(id);
        if (node && 'id' in node) queue.push({ node: node as BaseNode, depth: MAX_SERIALIZE_DEPTH, parentArr: children });
      }
      await processQueue(queue);
      return { document: { id: 'selection', name: 'Current Selection', type: 'CANVAS', children } };
    }

    if (scope === 'page' && opts.pageId) {
      const page = await figma.getNodeByIdAsync(opts.pageId) as PageNode | null;
      if (page && page.type === 'PAGE') {
        const children: any[] = [];
        const queue: SerializeQueueItem[] = [{ node: page as BaseNode, depth: MAX_SERIALIZE_DEPTH, parentArr: children }];
        await processQueue(queue);
        const doc = { id: page.id, name: page.name, type: 'CANVAS' as const, children };
        return { document: doc };
      }
    }

    const root = figma.root;
    const docChildren: any[] = [];
    const queue: SerializeQueueItem[] = [];
    for (const page of root.children) queue.push({ node: page as BaseNode, depth: MAX_SERIALIZE_DEPTH, parentArr: docChildren });
    await processQueue(queue);
    return { document: { id: root.id, name: root.name, type: root.type, children: docChildren } };
  }

  function buildFileContextSync(scope: string | undefined, pageId: string | undefined): Omit<any, 'fileJson'> {
    let pageIdOut: string | undefined;
    let nodeIds: string[] | undefined;
    if (scope === 'page' && pageId) pageIdOut = pageId;
    else if (scope === 'current') {
      const sel = figma.currentPage.selection;
      nodeIds = sel.map((n: BaseNode) => n.id);
    }
    const fileKey = (figma as any).fileKey ?? null;
    return {
      fileKey,
      scope: scope ?? 'all',
      pageId: pageIdOut ?? null,
      nodeIds: nodeIds ?? null,
    };
  }

  // File context: for "current" selection we send fileJson from plugin (no token needed). For all/page we send identifiers and backend fetches via REST API (requires fileKey).
  if (msg.type === 'get-file-context') {
    const scope = msg.scope as 'all' | 'current' | 'page' | undefined;
    const pageId = msg.pageId;
    const POST_MESSAGE_SIZE_LIMIT = 1.4e6;
    const CHUNK_SIZE = 1e6;
    (async () => {
      try {
        const base = buildFileContextSync(scope, pageId);
        let selectionType: string = 'Page';
        let selectionName: string = '';
        if (scope === 'current' && base.nodeIds?.length) {
          const first = await figma.getNodeByIdAsync(base.nodeIds[0]);
          if (first) {
            selectionName = first.name || 'Selection';
            const t = first.type;
            selectionType = t === 'FRAME' ? 'Frame' : t === 'COMPONENT' ? 'Component' : t === 'INSTANCE' ? 'Instance' : t === 'GROUP' ? 'Group' : t === 'SECTION' ? 'Section' : t === 'PAGE' ? 'Page' : 'Selection';
          }
        }

        if (scope === 'current') {
          const fileJson = await buildDocumentJsonAsync({ scope: 'current', nodeIds: base.nodeIds ?? undefined });
          const jsonString = JSON.stringify(fileJson);
          if (jsonString.length > POST_MESSAGE_SIZE_LIMIT) {
            const totalChunks = Math.ceil(jsonString.length / CHUNK_SIZE);
            figma.ui.postMessage({ type: 'file-context-chunked-start', ...base, selectionType, selectionName, totalChunks });
            for (let i = 0; i < totalChunks; i++) {
              figma.ui.postMessage({ type: 'file-context-chunk', index: i, chunk: jsonString.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) });
            }
          } else {
            figma.ui.postMessage({ type: 'file-context-result', ...base, fileJson, selectionType, selectionName });
          }
          return;
        }

        if (!base.fileKey) {
          figma.ui.postMessage({ type: 'file-context-result', ...base, error: 'FILE_LINK_UNAVAILABLE' });
          return;
        }
        if (scope === 'all') {
          await figma.loadAllPagesAsync();
          const pageIds = figma.root.children.map((p: PageNode) => p.id);
          figma.ui.postMessage({ type: 'file-context-result', ...base, pageIds, selectionType, selectionName });
        } else {
          figma.ui.postMessage({ type: 'file-context-result', ...base, selectionType, selectionName });
        }
      } catch (e) {
        console.error('[get-file-context]', e);
        figma.ui.postMessage({ type: 'file-context-result', fileKey: null, scope: scope ?? 'all', pageId: null, nodeIds: null, error: String(e) });
      }
    })();
  }

  // Count nodes: batch traversal with yield between batches only. Fast; UI stays responsive.
  // Same scope+pageId reuses cached count so DS / A11Y / (future UX, Prototype) don't wait again.
  // background: true = silent pre-warm after login; fill cache only, no result to UI.
  if (msg.type === 'count-nodes') {
    const scope = msg.scope as 'all' | 'current' | 'page';
    const pageId = scope === 'page' ? msg.pageId : undefined;
    const isBackground = msg.background === true;
    const useCache = !isBackground && scope !== 'current' && nodeCountCache && nodeCountCache.scope === scope && nodeCountCache.pageId === pageId;
    if (useCache && nodeCountCache) {
      figma.ui.postMessage({
        type: 'count-nodes-result',
        count: nodeCountCache.count,
        target: nodeCountCache.target,
        fromCache: true,
      });
      return;
    }

    const rawCap = msg.countCap;
    const countCap = (rawCap === undefined || rawCap === null || Number(rawCap) <= 0 || !Number.isFinite(Number(rawCap)))
      ? Infinity
      : Math.max(1, Number(rawCap));
    let target = '';
    const yieldTick = () => new Promise<void>(r => setTimeout(r, 0));
    const BATCH_SIZE = 6000;
    const PUSH_CHUNK = 4000;
    const INIT_PUSH_CHUNK = 4000;

    const stack: SceneNode[] = [];

    const pushChunk = (arr: readonly SceneNode[], fromIdx: number, toIdx: number) => {
      for (let i = toIdx; i >= fromIdx; i--) stack.push(arr[i]);
    };

    (async () => {
      let count = 0;
      try {
        await yieldTick();
        await figma.loadAllPagesAsync();
        if (!isBackground) figma.ui.postMessage({ type: 'count-nodes-progress', count: 0, percent: 1 });

        if (scope === 'current') {
          const sel = figma.currentPage.selection;
          target = sel.length > 0 ? 'Current Selection' : 'Current Selection (empty)';
          for (let i = sel.length - 1; i >= 0; i -= INIT_PUSH_CHUNK) {
            const start = Math.max(0, i - INIT_PUSH_CHUNK + 1);
            pushChunk(sel as readonly SceneNode[], start, i);
            if (start > 0) await yieldTick();
          }
        } else if (scope === 'page' && msg.pageId) {
          const page = (await figma.getNodeByIdAsync(msg.pageId)) as PageNode | null;
          if (page && page.type === 'PAGE') {
            target = page.name;
            await yieldTick();
            const ch = page.children as readonly SceneNode[];
            for (let i = ch.length - 1; i >= 0; i -= INIT_PUSH_CHUNK) {
              const start = Math.max(0, i - INIT_PUSH_CHUNK + 1);
              pushChunk(ch, start, i);
              if (start > 0) await yieldTick();
            }
          }
        } else {
          target = 'All Pages';
          for (const page of figma.root.children) {
            await yieldTick();
            const ch = page.children as readonly SceneNode[];
            for (let i = ch.length - 1; i >= 0; i -= INIT_PUSH_CHUNK) {
              const start = Math.max(0, i - INIT_PUSH_CHUNK + 1);
              pushChunk(ch, start, i);
              if (start > 0) await yieldTick();
            }
          }
        }

        let hitCap = false;
        const PROGRESS_STEP = 2000;
        let lastSentCount = 0;

        while (stack.length > 0 && count < countCap) {
          let processed = 0;
          while (stack.length > 0 && processed < BATCH_SIZE && count < countCap) {
            const node = stack.pop()!;
            count++;
            if ('children' in node && node.children) {
              const ch = node.children as readonly SceneNode[];
              if (ch.length <= PUSH_CHUNK) {
                for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
              } else {
                for (let i = ch.length - 1; i >= 0; i -= PUSH_CHUNK) {
                  const start = Math.max(0, i - PUSH_CHUNK + 1);
                  for (let j = i; j >= start; j--) stack.push(ch[j]);
                  if (start > 0) await yieldTick();
                }
              }
            }
            processed++;
            if (!isBackground && countCap !== Infinity && count - lastSentCount >= PROGRESS_STEP) {
              lastSentCount = count;
              const pct = Math.min(100, Math.floor((count / countCap) * 100));
              figma.ui.postMessage({ type: 'count-nodes-progress', count, percent: pct });
            }
          }
          if (!isBackground) {
            if (countCap === Infinity) {
              const pct = Math.min(95, Math.floor(count / 5000));
              figma.ui.postMessage({ type: 'count-nodes-progress', count, percent: pct });
            } else if (count - lastSentCount > 0 || stack.length === 0 || count >= countCap) {
              lastSentCount = count;
              const pct = count >= countCap ? 100 : Math.min(100, Math.floor((count / countCap) * 100));
              figma.ui.postMessage({ type: 'count-nodes-progress', count, percent: pct });
            }
          }
          if (stack.length > 0 && count < countCap) await yieldTick();
        }

        if (countCap !== Infinity && count >= countCap) hitCap = true;
        const resultCount = hitCap ? countCap : count;
        const resultTarget = hitCap ? `${target} (${countCap.toLocaleString()}+ nodes)` : target;
        if (scope !== 'current') {
          nodeCountCache = { scope, pageId: scope === 'page' ? msg.pageId : undefined, count: resultCount, target: resultTarget };
        }
        if (isBackground) {
          figma.ui.postMessage({ type: 'count-nodes-background-done' });
        } else {
          figma.ui.postMessage({ type: 'count-nodes-progress', count: resultCount, percent: 100 });
          figma.ui.postMessage({ type: 'count-nodes-result', count: resultCount, target: resultTarget, fromCache: false });
        }
      } catch (e: any) {
        const errMsg = String(e?.message || e);
        if (!isBackground) figma.notify(`Count failed at ${count} nodes: ${errMsg}`, { error: true });
        figma.ui.postMessage({
          type: 'count-nodes-error',
          error: errMsg,
          count
        });
      }
    })();
  }

  if (msg.type === 'select-layer') {
    const layerId = msg.layerId;
    if (layerId) await selectLayerAndReveal(layerId);
  }

  if (msg.type === 'apply-fix') {
    const node = await figma.getNodeByIdAsync(msg.layerId);
    if (node && 'fills' in node) {
      // Example fix: Clone to support undo implicitly if needed, 
      // but usually we just set the property.
      // Saving state for undo would happen here in a real app.
      figma.notify("Fix applied to " + node.name);
      await selectLayerAndReveal(msg.layerId);
    } else {
      figma.notify("Layer not found", { error: true });
    }
  }

  if (msg.type === 'undo-fix') {
    const node = await figma.getNodeByIdAsync(msg.layerId);
    if (node) {
      figma.notify("Changes reverted");
      // Logic to revert specific properties would go here
      await selectLayerAndReveal(msg.layerId);
    }
  }

  // Design tokens: read Figma Variables and send serialized payload for CSS/JSON generation (Comtra ruleset)
  if (msg.type === 'get-design-tokens') {
    (async () => {
      try {
        const fileKey = (figma as any).fileKey ?? null;
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const payload: {
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
        } = {
          fileKey,
          collections: [],
          variables: []
        };

        for (const coll of collections) {
          payload.collections.push({
            id: coll.id,
            name: coll.name,
            defaultModeId: coll.defaultModeId,
            modes: coll.modes.map(m => ({ modeId: m.modeId, name: m.name }))
          });
          for (const variableId of coll.variableIds) {
            const variable = await figma.variables.getVariableByIdAsync(variableId);
            if (!variable) continue;
            const valuesByMode: Record<string, unknown> = {};
            for (const [modeId, val] of Object.entries(variable.valuesByMode)) {
              if (val === undefined) continue;
              if (typeof val === 'object' && val !== null && 'type' in val && (val as { type: string }).type === 'VARIABLE_ALIAS') {
                valuesByMode[modeId] = { type: 'VARIABLE_ALIAS', id: (val as { id: string }).id };
              } else if (typeof val === 'object' && val !== null && 'r' in val) {
                const c = val as { r: number; g: number; b: number; a?: number };
                valuesByMode[modeId] = { r: c.r, g: c.g, b: c.b, a: c.a };
              } else {
                valuesByMode[modeId] = val;
              }
            }
            payload.variables.push({
              id: variable.id,
              name: variable.name,
              description: variable.description ?? '',
              variableCollectionId: variable.variableCollectionId,
              resolvedType: variable.resolvedType,
              valuesByMode,
              codeSyntax: variable.codeSyntax ? { ...variable.codeSyntax } : undefined,
              hiddenFromPublishing: variable.hiddenFromPublishing
            });
          }
        }

        figma.ui.postMessage({ type: 'design-tokens-result', payload });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        figma.ui.postMessage({ type: 'design-tokens-error', error: errMsg });
      }
    })();
  }
};
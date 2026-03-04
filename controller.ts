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
    const pages = figma.root.children.map((p: PageNode) => ({ id: p.id, name: p.name }));
    figma.ui.postMessage({ type: 'pages-result', pages });
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
    if (node.type === 'TEXT' && 'fontSize' in node && typeof (node as any).fontSize === 'number') {
      out.style = { fontSize: (node as any).fontSize };
    }
    return out;
  }

  type SerializeQueueItem = { node: BaseNode; depth: number; parentArr: any[] };
  async function buildDocumentJsonAsync(opts: { scope?: string; nodeIds?: string[]; pageId?: string }): Promise<{ document: any }> {
    const scope = opts.scope ?? 'all';

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
        const node = figma.getNodeById(id);
        if (node && 'id' in node) queue.push({ node: node as BaseNode, depth: MAX_SERIALIZE_DEPTH, parentArr: children });
      }
      await processQueue(queue);
      return { document: { id: 'selection', name: 'Current Selection', type: 'CANVAS', children } };
    }

    if (scope === 'page' && opts.pageId) {
      const page = figma.getNodeById(opts.pageId);
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

  // File context for backend pipeline. light: true = instant (fileKey/scope/pageId only; backend fetches file). No light = full serialization (slow).
  if (msg.type === 'get-file-context') {
    const scope = msg.scope as 'all' | 'current' | 'page' | undefined;
    const pageId = msg.pageId;
    const light = msg.light === true;
    if (light) {
      try {
        const base = buildFileContextSync(scope, pageId);
        figma.ui.postMessage({ type: 'file-context-result', ...base });
      } catch (e) {
        console.error('[get-file-context]', e);
        figma.ui.postMessage({ type: 'file-context-result', fileKey: null, scope: scope ?? 'all', pageId: null, nodeIds: null, error: String(e) });
      }
      return;
    }
    (async () => {
      try {
        const base = buildFileContextSync(scope, pageId);
        const fileJson = await buildDocumentJsonAsync({ scope: scope ?? 'all', nodeIds: base.nodeIds, pageId: base.pageId ?? undefined });
        figma.ui.postMessage({
          type: 'file-context-result',
          ...base,
          fileJson,
        });
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
          const page = figma.getNodeById(msg.pageId) as PageNode | null;
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

  if (msg.type === 'apply-fix') {
    const node = await figma.getNodeByIdAsync(msg.layerId);
    if (node && 'fills' in node) {
      // Example fix: Clone to support undo implicitly if needed, 
      // but usually we just set the property.
      // Saving state for undo would happen here in a real app.
      figma.notify("Fix applied to " + node.name);
    } else {
      figma.notify("Layer not found", { error: true });
    }
  }

  if (msg.type === 'undo-fix') {
    const node = await figma.getNodeByIdAsync(msg.layerId);
    if (node) {
      figma.notify("Changes reverted");
      // Logic to revert specific properties would go here
    }
  }
};
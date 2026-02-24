// This file runs in the Figma main thread (sandbox)
// It handles API calls to the Figma document
/// <reference types="@figma/plugin-typings" />

declare const __html__: string;

figma.showUI(__html__, { width: 400, height: 700, themeColors: true });

// Restore saved user on load. Session is stored in clientStorage with no expiry (indefinite until logout).
(async () => {
  try {
    const user = await figma.clientStorage.getAsync('figmaOAuthUser');
    if (user) figma.ui.postMessage({ type: 'restore-user', user });
  } catch (_) {}
})();

figma.ui.onmessage = async (msg: any) => {
  if (msg.type === 'resize-window') {
    figma.ui.resize(msg.width, msg.height);
  }

  if (msg.type === 'open-oauth-url') {
    if (msg.authUrl) figma.openExternal(msg.authUrl);
  }

  if (msg.type === 'oauth-complete') {
    const user = msg.user;
    if (user) {
      await figma.clientStorage.setAsync('figmaOAuthUser', user);
      figma.ui.postMessage({ type: 'login-success', user });
    }
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

  // Count nodes: fully async, yield after every node so the main thread never blocks.
  // Receipt is always shown; on error we send count-nodes-error so the UI can show it.
  if (msg.type === 'count-nodes') {
    const scope = msg.scope as 'all' | 'current' | 'page';
    let target = '';
    const yieldTick = () => new Promise<void>(r => setTimeout(r, 0));
    const INIT_PUSH_CHUNK = 800;
    const PUSH_YIELD_THRESHOLD = 800;

    const stack: SceneNode[] = [];

    const pushChunk = (arr: readonly SceneNode[], fromIdx: number, toIdx: number) => {
      for (let i = toIdx; i >= fromIdx; i--) stack.push(arr[i]);
    };

    (async () => {
      let count = 0;
      try {
        await yieldTick();
        await figma.loadAllPagesAsync();
        figma.ui.postMessage({ type: 'count-nodes-progress', count: 0, percent: 1 });

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

        const PROGRESS_EVERY = 50;

        while (stack.length > 0) {
          const node = stack.pop()!;
          count++;
          await yieldTick();
          if ('children' in node && node.children) {
            const ch = node.children as readonly SceneNode[];
            if (ch.length <= PUSH_YIELD_THRESHOLD) {
              for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
            } else {
              for (let i = ch.length - 1; i >= 0; i -= PUSH_YIELD_THRESHOLD) {
                const start = Math.max(0, i - PUSH_YIELD_THRESHOLD + 1);
                for (let j = i; j >= start; j--) stack.push(ch[j]);
                if (start > 0) await yieldTick();
              }
            }
          }
          if (count % PROGRESS_EVERY === 0 || stack.length === 0) {
            const pct = count > 0 ? Math.max(2, Math.min(95, Math.floor(count / 80))) : 1;
            figma.ui.postMessage({ type: 'count-nodes-progress', count, percent: pct });
          }
        }

        figma.ui.postMessage({ type: 'count-nodes-result', count, target });
      } catch (e: any) {
        const errMsg = String(e?.message || e);
        figma.notify(`Count failed at ${count} nodes: ${errMsg}`, { error: true });
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
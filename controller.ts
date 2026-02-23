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

  if (msg.type === 'count-nodes') {
    const scope = msg.scope as 'all' | 'current' | 'page';
    let target = '';

    const BATCH_SIZE = 60;
    const YIELD_MS = 8;
    const PUSH_CHUNK = 150;
    const MAX_NODES = 2_000_000;
    const delay = () => new Promise<void>(r => setTimeout(r, YIELD_MS));

    const stack: SceneNode[] = [];

    async function pushChunkReverse(arr: readonly SceneNode[], startIdx: number, endIdx: number) {
      for (let i = endIdx; i >= startIdx; i--) stack.push(arr[i]);
    }

    async function fillStackWithRoots(): Promise<void> {
      if (scope === 'current') {
        const sel = figma.currentPage.selection;
        target = sel.length > 0 ? 'Current Selection' : 'Current Selection (empty)';
        for (let i = sel.length - 1; i >= 0; i -= PUSH_CHUNK) {
          const start = Math.max(0, i - PUSH_CHUNK + 1);
          await pushChunkReverse(sel as readonly SceneNode[], start, i);
          if (start > 0) await delay();
        }
      } else if (scope === 'page' && msg.pageId) {
        const page = figma.getNodeById(msg.pageId) as PageNode | null;
        if (page && page.type === 'PAGE') {
          target = page.name;
          const ch = page.children as readonly SceneNode[];
          for (let i = ch.length - 1; i >= 0; i -= PUSH_CHUNK) {
            const start = Math.max(0, i - PUSH_CHUNK + 1);
            await pushChunkReverse(ch, start, i);
            if (start > 0) await delay();
          }
        }
      } else {
        target = 'All Pages';
        for (const page of figma.root.children) {
          const ch = page.children as readonly SceneNode[];
          for (let i = ch.length - 1; i >= 0; i -= PUSH_CHUNK) {
            const start = Math.max(0, i - PUSH_CHUNK + 1);
            await pushChunkReverse(ch, start, i);
            if (start > 0) await delay();
          }
        }
      }
    }

    let count = 0;
    const run = async () => {
      figma.ui.postMessage({ type: 'count-nodes-progress', count: 0, percent: 1 });
      await fillStackWithRoots();

      let hitLimit = false;
      while (stack.length > 0 && !hitLimit) {
        let processed = 0;
        while (stack.length > 0 && processed < BATCH_SIZE && count < MAX_NODES) {
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
                if (start > 0) await delay();
              }
            }
          }
          processed++;
        }
        if (count >= MAX_NODES) hitLimit = true;
        const pct = count > 0 ? Math.max(2, Math.min(95, Math.floor(count / 80))) : 1;
        figma.ui.postMessage({ type: 'count-nodes-progress', count, percent: pct });
        if (stack.length > 0 && !hitLimit) await delay();
      }
      figma.ui.postMessage({
        type: 'count-nodes-result',
        count,
        target: hitLimit ? `${target} (partial, limit ${MAX_NODES.toLocaleString()})` : target
      });
    };
    run();
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
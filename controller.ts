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
    const roots: SceneNode[] = [];

    if (scope === 'current') {
      const sel = figma.currentPage.selection;
      target = sel.length > 0 ? 'Current Selection' : 'Current Selection (empty)';
      roots.push(...(sel as SceneNode[]));
    } else if (scope === 'page' && msg.pageId) {
      const page = figma.getNodeById(msg.pageId) as PageNode | null;
      if (page && page.type === 'PAGE') {
        target = page.name;
        roots.push(page);
      }
    } else {
      target = 'All Pages';
      roots.push(...(figma.root.children as SceneNode[]));
    }

    let count = 0;
    const totalRoots = roots.length;
    for (let r = 0; r < totalRoots; r++) {
      const root = roots[r];
      const descendants = (root as any).findAll ? (root as any).findAll(() => true) : [];
      count += 1 + (Array.isArray(descendants) ? descendants.length : 0);
      const pct = totalRoots > 1 ? Math.max(2, Math.min(95, Math.floor((100 * (r + 1)) / totalRoots))) : 95;
      figma.ui.postMessage({ type: 'count-nodes-progress', count, percent: pct });
    }
    figma.ui.postMessage({ type: 'count-nodes-result', count, target });
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
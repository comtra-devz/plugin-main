// This file runs in the Figma main thread (sandbox)
// It handles API calls to the Figma document

export {};

declare const figma: any;
declare const __html__: string;

figma.showUI(__html__, { width: 400, height: 700, themeColors: true });

figma.ui.onmessage = async (msg: any) => {
  if (msg.type === 'resize-window') {
    figma.ui.resize(msg.width, msg.height);
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

  if (msg.type === 'apply-fix') {
    const node = figma.getNodeById(msg.layerId);
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
    const node = figma.getNodeById(msg.layerId);
    if (node) {
      figma.notify("Changes reverted");
      // Logic to revert specific properties would go here
    }
  }
};
// TESTING Environment Controller
// This file handles the interaction with the Figma API for the Testing/Staging build.

export {};

declare const figma: any;
declare const __html__: string;

// Testing window might be larger for debug tools
figma.showUI(__html__, { width: 400, height: 750, themeColors: true });

figma.ui.onmessage = async (msg: any) => {
  console.log('[TEST-CTRL] Msg received:', msg);

  if (msg.type === 'resize-window') {
    figma.ui.resize(msg.width, msg.height);
  }

  if (msg.type === 'get-selection') {
    // Return mock data if selection is empty in testing
    const selection = figma.currentPage.selection;
    const nodes = selection.length > 0 ? selection.map((n:any) => ({ id: n.id, name: n.name })) : [{id: 'mock-1', name: 'Test Frame'}];
    figma.ui.postMessage({ type: 'selection-changed', nodes });
  }

  if (msg.type === 'apply-fix') {
    figma.notify("TEST: Fix applied (Simulation)");
  }
};
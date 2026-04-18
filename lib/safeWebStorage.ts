/**
 * Figma plugin UI (iframe, spesso `data:` URL): `localStorage` / `sessionStorage`
 * possono lanciare (SecurityError) anche se definiti. Usare sempre questi helper nel plugin.
 */

export function safeLocalStorageGetItem(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    /* disabled, data: URL, quota */
  }
}

export function safeLocalStorageRemoveItem(key: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    /* */
  }
}

export function safeSessionStorageGetItem(key: string): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionStorageSetItem(key: string, value: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(key, value);
  } catch {
    /* disabled */
  }
}

export function safeSessionStorageRemoveItem(key: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(key);
  } catch {
    /* */
  }
}

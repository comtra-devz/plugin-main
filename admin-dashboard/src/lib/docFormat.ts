/**
 * Formato semplificato per l'editor Documentation:
 * - **grassetto** → bold
 * - `codice` → code
 * - *corsivo* → italic
 * - :::yellow ... ::: → callout giallo
 * - :::gray ... ::: → callout grigio
 * - Riga che inizia con "1. " o "2. " ecc. → lista ordinata
 * - Riga che inizia con "- " → lista puntata
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseInlineFormat(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, (_, m) => `<strong class="text-black">${m}</strong>`)
    .replace(/`([^`]+)`/g, (_, m) => `<code>${m}</code>`)
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, m) => `<em>${m}</em>`);
}

/** Converte formato semplificato → HTML (come nel plugin) */
export function simpleToHtml(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inYellow = false;
  let inGray = false;
  let buffer: string[] = [];

  const flushBuffer = (tag: string, className: string) => {
    if (buffer.length) {
      const inner = buffer.map((l) => `<p>${parseInlineFormat(l.trim())}</p>`).join('');
      out.push(`<div class="${className}">${inner}</div>`);
      buffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === ':::yellow') {
      if (inGray) {
        flushBuffer('div', 'bg-gray-100 p-2 mt-2 border-l-2 border-black');
        inGray = false;
      }
      if (inYellow) {
        flushBuffer('div', 'bg-yellow-100 p-2 border border-yellow-300 text-yellow-900 font-bold mb-2');
        inYellow = false;
      } else {
        inYellow = true;
      }
      continue;
    }
    if (trimmed === ':::gray') {
      if (inYellow) {
        flushBuffer('div', 'bg-yellow-100 p-2 border border-yellow-300 text-yellow-900 font-bold mb-2');
        inYellow = false;
      }
      if (inGray) {
        flushBuffer('div', 'bg-gray-100 p-2 mt-2 border-l-2 border-black');
        inGray = false;
      } else {
        inGray = true;
      }
      continue;
    }

    if (inYellow || inGray) {
      buffer.push(line);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(parseInlineFormat(lines[i].trim().replace(/^\d+\.\s*/, '')));
        i++;
      }
      i--;
      out.push(`<ol class="list-decimal list-inside space-y-1 mt-2">${items.map((x) => `<li>${x}</li>`).join('')}</ol>`);
      continue;
    }
    if (trimmed.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(parseInlineFormat(lines[i].trim().slice(2)));
        i++;
      }
      i--;
      out.push(`<ul class="list-disc list-inside space-y-1 mt-2">${items.map((x) => `<li>${x}</li>`).join('')}</ul>`);
      continue;
    }

    if (trimmed) {
      out.push(`<p>${parseInlineFormat(trimmed)}</p>`);
    }
  }

  if (inYellow) flushBuffer('div', 'bg-yellow-100 p-2 border border-yellow-300 text-yellow-900 font-bold mb-2');
  if (inGray) flushBuffer('div', 'bg-gray-100 p-2 mt-2 border-l-2 border-black');

  return `<div class="space-y-2 text-xs leading-relaxed text-gray-700">${out.join('')}</div>`;
}

/** Converte HTML → formato semplificato (approssimativo, per edit) */
export function htmlToSimple(html: string): string {
  if (!html || !html.trim()) return '';
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!div) return html;
  div.innerHTML = html;
  const walk = (el: Element): string => {
    if (el.tagName === 'P') {
      return inlineToSimple(el.innerHTML) + '\n\n';
    }
    if (el.tagName === 'OL') {
      return Array.from(el.querySelectorAll('li'))
        .map((li, i) => `${i + 1}. ${inlineToSimple(li.innerHTML)}`)
        .join('\n') + '\n\n';
    }
    if (el.tagName === 'UL') {
      return Array.from(el.querySelectorAll('li'))
        .map((li) => `- ${inlineToSimple(li.innerHTML)}`)
        .join('\n') + '\n\n';
    }
    if (el.classList.contains('bg-yellow-100')) {
      const inner = Array.from(el.querySelectorAll('p'))
        .map((p) => inlineToSimple(p.innerHTML))
        .join('\n');
      return `:::yellow\n${inner}\n:::\n\n`;
    }
    if (el.classList.contains('bg-gray-100')) {
      const inner = Array.from(el.querySelectorAll('p'))
        .map((p) => inlineToSimple(p.innerHTML))
        .join('\n');
      return `:::gray\n${inner}\n:::\n\n`;
    }
    return Array.from(el.children).map(walk).join('');
  };
  const inlineToSimple = (s: string) =>
    s
      .replace(/<strong[^>]*>([^<]*)<\/strong>/gi, '**$1**')
      .replace(/<code>([^<]*)<\/code>/gi, '`$1`')
      .replace(/<em>([^<]*)<\/em>/gi, '*$1*')
      .replace(/<[^>]+>/g, '');
  const inner = div.querySelector('.space-y-2') || div.firstElementChild || div;
  return Array.from(inner.children).map((c) => walk(c as Element)).join('').trim();
}

import fs from 'fs';
import path from 'path';
import {
  parseGoogleDocToSnapshot,
  simulateManualAnalysis,
  buildDiscordPayload,
  buildNotionRows,
  ParsedDocSnapshot,
  RulesSnapshot,
} from './docAutomation';

function readFileSafe(relativePath: string): string {
  const fullPath = path.join(__dirname, relativePath);
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return '';
  }
}

function buildSnapshotFromLocalSpecs(): ParsedDocSnapshot {
  // Per la prova usiamo SOURCES.md come se fosse il Google Doc completo.
  const sourcesMd = readFileSafe('./SOURCES.md');
  const fullText = sourcesMd || '';
  return parseGoogleDocToSnapshot(
    { fullText },
    { ignoreTokens: ['Antigravity'] },
  );
}

function buildRulesSnapshotFromSpecs(): RulesSnapshot {
  const escalationMd = readFileSafe('./ESCALATION-RULES.md');
  const escalationIds = Array.from(escalationMd.matchAll(/ESC-\d{3}/g)).map(m => m[0]);

  return {
    uxSections: [
      'C1 System Feedback',
      'C3 Form UX',
      'C5 Content & Copy',
      'C6 Error / Empty',
      'C7 Data Tables',
      'C8 Responsive',
      'C10 Dark Patterns',
      'C11 i18n',
    ],
    accessibilitySections: [
      'Contrast',
      'Keyboard & Focus',
      'A11Y Patterns',
    ],
    escalationIds,
  };
}

async function main() {
  const snapshot = buildSnapshotFromLocalSpecs();
  const rulesSnapshot = buildRulesSnapshotFromSpecs();

  const run = simulateManualAnalysis(snapshot, rulesSnapshot, 'general');

  // 1) Log sintetico delle proposte ordinate per priorità
  console.log('=== UX Rules Doc Audit — Proposals (top 5) ===');
  run.proposals.slice(0, 5).forEach((p) => {
    console.log(
      `- ${p.id} [${p.priorityScore}/100] ${p.target.section}` +
        (p.target.subSection ? ` · ${p.target.subSection}` : '') +
        ` — category: ${p.categoryId}`,
    );
  });

  // 2) Payload Discord (non inviato, solo mostrato)
  const discordPayload = buildDiscordPayload(run);
  console.log('\n=== Discord payload (preview) ===');
  console.log(JSON.stringify(discordPayload, null, 2));

  // 3) Righe Notion (non inviate, solo mostrate)
  const notionRows = buildNotionRows(run);
  console.log('\n=== Notion rows (preview, first 5) ===');
  console.log(JSON.stringify(notionRows.slice(0, 5), null, 2));

  console.log('\nPreview complete. This script does not call Discord or Notion APIs.');
}

// Esegui solo quando chiamato direttamente con Node.
if (require.main === module) {
  // eslint-disable-next-line no-void
  void main();
}


#!/bin/sh
# Copia l'hook post-commit in .git/hooks così ogni commit invia il riassunto su Discord.
# Lancia dalla root del repo: ./scripts/install-discord-hook.sh
set -e
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
HOOK_SRC="$ROOT/scripts/git-hooks/post-commit"
HOOK_DST="$ROOT/.git/hooks/post-commit"
cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "Hook installato: .git/hooks/post-commit (Discord dopo ogni commit)"

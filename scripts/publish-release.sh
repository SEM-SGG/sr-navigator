#!/usr/bin/env bash
# Veröffentlicht den SR-Navigator als Release im Repository. Läuft in GitHub Actions (Workflow «Release»).
#
#   scripts/publish-release.sh plan      stellt fest, ob die Version aus package.json schon veröffentlicht ist,
#                                        und schreibt build=true|false nach $GITHUB_OUTPUT
#   scripts/publish-release.sh publish   legt die Release v<version> mit der gebauten Datei an; setzt einen Build in dist/ voraus
#
# Das Skript ist wiederholbar: Ein zweiter Lauf mit derselben Version ändert nichts.
# Umgebung: GH_TOKEN und GH_REPO für gh; GITHUB_SHA als Ziel der Marke.
set -euo pipefail
cd "$(dirname "$0")/.."

mode="${1:-}"
version="$(node scripts/release-info.mjs --version)"
asset="$(node scripts/release-info.mjs --asset)"
tag="v${version}"

exists=false
gh release view "$tag" >/dev/null 2>&1 && exists=true

case "$mode" in
  plan)
    build=true
    if $exists; then build=false; fi
    echo "Version ${version}: Release ${tag} vorhanden=${exists}"
    if [ -n "${GITHUB_OUTPUT:-}" ]; then
      { echo "build=${build}"; echo "version=${version}"; echo "tag=${tag}"; } >> "$GITHUB_OUTPUT"
    fi
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ] && $exists; then
      echo "SR-Navigator ${version} ist bereits veröffentlicht. Für eine neue Release \`version\` in \`package.json\` erhöhen." >> "$GITHUB_STEP_SUMMARY"
    fi
    ;;
  publish)
    if $exists; then echo "Release ${tag} besteht bereits. Nichts zu tun."; exit 0; fi
    file="dist/${asset}"
    [ -s "$file" ] || { echo "Datei ${file} fehlt. Zuerst «npm run build» ausführen." >&2; exit 1; }
    target="${GITHUB_SHA:?GITHUB_SHA fehlt}"
    notes="$(mktemp)"
    node scripts/release-info.mjs --notes > "$notes"
    gh release create "$tag" "$file" --title "SR-Navigator ${version}" --notes-file "$notes" --target "$target" --latest
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
      echo "SR-Navigator ${version} veröffentlicht: Release \`${tag}\`." >> "$GITHUB_STEP_SUMMARY"
    fi
    ;;
  *)
    echo "Aufruf: scripts/publish-release.sh plan|publish" >&2
    exit 2
    ;;
esac

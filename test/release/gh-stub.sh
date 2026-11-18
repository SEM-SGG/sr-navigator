#!/usr/bin/env bash
# Attrappe für «gh release …» in test/release/publish.test.mjs. Zustand: eine Datei je Release in $GH_STUB_DIR (Inhalt: Titel).
set -euo pipefail
echo "$*" >> "$GH_STUB_DIR/calls.log"
[ "$1" = release ] || { echo "stub: nur «gh release»" >&2; exit 64; }
cmd="$2"; tag="$3"; shift 3
case "$cmd" in
  view)
    [ -f "$GH_STUB_DIR/rel-$tag" ] || { echo "release not found" >&2; exit 1; }
    cat "$GH_STUB_DIR/rel-$tag"
    ;;
  create)
    [ ! -f "$GH_STUB_DIR/rel-$tag" ] || { echo "a release with the same tag name already exists" >&2; exit 1; }
    file="$1"; shift
    [ -s "$file" ] || { echo "no such file: $file" >&2; exit 1; }
    title=""; latest="auto"; notes=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --title) title="$2"; shift 2 ;;
        --notes-file) notes="$2"; shift 2 ;;
        --target) shift 2 ;;
        --latest) latest=true; shift ;;
        --latest=false) latest=false; shift ;;
        *) echo "stub: unbekannte Option $1" >&2; exit 64 ;;
      esac
    done
    [ -s "$notes" ] || { echo "stub: Notizen fehlen" >&2; exit 1; }
    [ "${GH_STUB_FAIL_CREATE:-}" != "$tag" ] || { echo "stub: erzwungener Fehler" >&2; exit 1; }
    printf '%s\n' "$title" > "$GH_STUB_DIR/rel-$tag"
    printf '%s\n' "$latest" > "$GH_STUB_DIR/latest-$tag"
    cp "$notes" "$GH_STUB_DIR/notes-$tag"
    ;;
  delete)
    [ "$*" = "--cleanup-tag --yes" ] || { echo "stub: delete erwartet --cleanup-tag --yes" >&2; exit 64; }
    rm -f "$GH_STUB_DIR/rel-$tag" "$GH_STUB_DIR/latest-$tag" "$GH_STUB_DIR/notes-$tag"
    ;;
  *) echo "stub: unbekannter Befehl $cmd" >&2; exit 64 ;;
esac

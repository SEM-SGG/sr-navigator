#!/usr/bin/env bash
# Attrappe für gh in den Tests unter test/release/. Zustand in $GH_STUB_DIR, Aufrufe in calls.log.
#   gh release view|create|delete   eine Datei je Release (Inhalt: Titel), für publish.test.mjs
#   gh pr list|create|edit|ready|comment     ein Ordner je Pull Request unter prs/<nummer>/, für fassungen-pr.test.mjs
#   gh workflow run <datei> --ref <zweig>   Eintrag in workflow-runs.log
# GH_STUB_FAIL_CREATE=<marke> lässt «release create» scheitern, GH_STUB_FAIL_WORKFLOW=1 «workflow run».
set -euo pipefail
echo "$*" >> "$GH_STUB_DIR/calls.log"

pr_cmd() {
  local cmd="$1"; shift
  local prs="$GH_STUB_DIR/prs"; mkdir -p "$prs"
  case "$cmd" in
    list)
      local head="" base="" state=""
      while [ $# -gt 0 ]; do
        case "$1" in
          --head) head="$2"; shift 2 ;;
          --base) base="$2"; shift 2 ;;
          --state) state="$2"; shift 2 ;;
          --json) shift 2 ;;
          *) echo "stub: unbekannte Option $1" >&2; exit 64 ;;
        esac
      done
      node -e '
        const fs = require("fs"), p = require("path");
        const [dir, head, base, state] = process.argv.slice(1);
        const out = [];
        for (const n of fs.readdirSync(dir).map(Number).sort((a, b) => a - b)) {
          const r = (f) => fs.readFileSync(p.join(dir, String(n), f), "utf8");
          if ((head && r("head") !== head) || (base && r("base") !== base) || (state && r("state") !== state)) continue;
          out.push({ number: n, title: r("title"), body: r("body"), isDraft: r("draft") === "true", url: "https://github.com/example-org/sr-navigator/pull/" + n });
        }
        process.stdout.write(JSON.stringify(out));
      ' "$prs" "$head" "$base" "$state"
      ;;
    create)
      local n; n=$(( $(ls "$prs" | wc -l) + 1 ))
      mkdir -p "$prs/$n"; printf 'false' > "$prs/$n/draft"; printf 'open' > "$prs/$n/state"
      while [ $# -gt 0 ]; do
        case "$1" in
          --base) printf '%s' "$2" > "$prs/$n/base"; shift 2 ;;
          --head) printf '%s' "$2" > "$prs/$n/head"; shift 2 ;;
          --title) printf '%s' "$2" > "$prs/$n/title"; shift 2 ;;
          --body-file) cp "$2" "$prs/$n/body"; shift 2 ;;
          --draft) printf 'true' > "$prs/$n/draft"; shift ;;
          *) echo "stub: unbekannte Option $1" >&2; exit 64 ;;
        esac
      done
      for f in base head title body; do [ -f "$prs/$n/$f" ] || { echo "stub: --$f fehlt" >&2; exit 1; }; done
      echo "https://github.com/example-org/sr-navigator/pull/$n"
      ;;
    edit)
      local n="$1"; shift
      [ -d "$prs/$n" ] || { echo "no pull requests found for $n" >&2; exit 1; }
      while [ $# -gt 0 ]; do
        case "$1" in
          --title) printf '%s' "$2" > "$prs/$n/title"; shift 2 ;;
          --body-file) cp "$2" "$prs/$n/body"; shift 2 ;;
          *) echo "stub: unbekannte Option $1" >&2; exit 64 ;;
        esac
      done
      ;;
    comment)
      local n="${1##*/}"; shift
      [ -d "$prs/$n" ] || { echo "no pull requests found for $n" >&2; exit 1; }
      [ "${1:-}" = --body ] || { echo "stub: erwartet «pr comment <nummer|adresse> --body <text>»" >&2; exit 64; }
      printf '%s\n' "$2" >> "$prs/$n/comments"
      ;;
    ready)
      local n="$1"; shift
      [ -d "$prs/$n" ] || { echo "no pull requests found for $n" >&2; exit 1; }
      if [ "${1:-}" = --undo ]; then printf 'true' > "$prs/$n/draft"; else printf 'false' > "$prs/$n/draft"; fi
      ;;
    *) echo "stub: unbekannter Befehl pr $cmd" >&2; exit 64 ;;
  esac
}

release_cmd() {
  local cmd="$1" tag="$2"; shift 2
  case "$cmd" in
    view)
      [ -f "$GH_STUB_DIR/rel-$tag" ] || { echo "release not found" >&2; exit 1; }
      cat "$GH_STUB_DIR/rel-$tag"
      ;;
    create)
      [ ! -f "$GH_STUB_DIR/rel-$tag" ] || { echo "a release with the same tag name already exists" >&2; exit 1; }
      local file="$1"; shift
      [ -s "$file" ] || { echo "no such file: $file" >&2; exit 1; }
      local title="" latest="auto" notes=""
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
}

case "$1" in
  release) shift; release_cmd "$@" ;;
  pr) shift; pr_cmd "$@" ;;
  workflow)
    [ "$2" = run ] && [ "$4" = --ref ] || { echo "stub: erwartet «workflow run <datei> --ref <zweig>»" >&2; exit 64; }
    [ -z "${GH_STUB_FAIL_WORKFLOW:-}" ] || { echo "stub: erzwungener Fehler" >&2; exit 1; }
    echo "$3 $5" >> "$GH_STUB_DIR/workflow-runs.log"
    ;;
  *) echo "stub: nur «gh release», «gh pr» und «gh workflow»" >&2; exit 64 ;;
esac

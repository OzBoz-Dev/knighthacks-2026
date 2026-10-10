#!/usr/bin/env bash
# Fail when a file holds an emoji, an em dash, or an en dash. Names the file, the line, and the character.
# Usage: scripts/check-style.sh FILE...   (CI passes the pull request title, body, and commit messages)
set -u
export LC_ALL=C.UTF-8
# shortcut: emoji detection covers U+1F000 to U+1FAFF plus the common emoji in U+2600 to U+2BFF, upgrade to a full emoji table when a false positive or a miss appears
pattern='[\x{2013}\x{2014}\x{1F000}-\x{1FAFF}\x{2705}\x{274C}\x{274E}\x{2728}\x{2B50}\x{2B55}\x{FE0F}]'
status=0
for file in "$@"; do
  [ -s "$file" ] || continue
  while IFS= read -r hit; do
    lineno=${hit%%:*}
    text=${hit#*:}
    chars=""
    while IFS= read -r c; do
      case "$c" in
        $'\u2013') name="en dash U+2013" ;;
        $'\u2014') name="em dash U+2014" ;;
        *) name=$(printf '%s' "$c" | perl -CS -ne 'printf "emoji U+%04X", ord') ;;
      esac
      chars="${chars:+$chars; }$name"
    done < <(printf '%s' "$text" | grep -oP "$pattern" | sort -u)
    echo "$file:$lineno: forbidden character: $chars"
    echo "    $text"
    status=1
  done < <(grep -nP "$pattern" "$file" || true)
done
[ "$status" -eq 0 ] && echo "style check passed: no emoji, em dash, or en dash in $# file(s)"
exit $status

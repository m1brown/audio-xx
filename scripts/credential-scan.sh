#!/bin/sh
# Certification standing rule: run before every certification commit.
# Scans STAGED files for credential material. Exits non-zero on a hit.
# Placeholders like "sk_live_…" (ellipsis) in docs do not match — the
# patterns require real key-length bodies.
PATTERN='sk_(test|live)_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|rk_(test|live)_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
HITS=$(git diff --cached --name-only -z | xargs -0 grep -lE "$PATTERN" 2>/dev/null)
if [ -n "$HITS" ]; then
  echo "CREDENTIAL SCAN FAILED — staged files contain key-like material:"
  echo "$HITS"
  exit 1
fi
echo "credential scan: clean"

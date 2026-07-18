#!/bin/bash
# Firefox Smoke Test for SlashMeBaby
# Validates Firefox build, manifest structure, and runs web-ext lint.

FIREFOX_BUILD=".output/firefox-mv2"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass=0
fail=0

check() {
  local desc="$1"
  if [ "$2" -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} $desc"
    ((pass++))
  else
    echo -e "  ${RED}✗${NC} $desc"
    ((fail++))
  fi
}

echo ""
echo "SlashMeBaby — Firefox Smoke Test"
echo "================================"
echo ""

# 1. Build
echo "Building Firefox extension..."
npm run build:firefox > /dev/null 2>&1
check "Firefox build succeeds" $?

# 2. Build output
echo ""
echo "Checking build output..."
test -d "$FIREFOX_BUILD"; check "Build directory exists" $?
test -f "$FIREFOX_BUILD/manifest.json"; check "manifest.json exists" $?
test -f "$FIREFOX_BUILD/background.js"; check "background.js exists" $?
test -d "$FIREFOX_BUILD/content-scripts"; check "content-scripts directory exists" $?
test -f "$FIREFOX_BUILD/popup.html"; check "popup.html exists" $?
test -f "$FIREFOX_BUILD/settings.html"; check "settings.html exists" $?
test -f "$FIREFOX_BUILD/onboarding.html"; check "onboarding.html exists" $?

# 3. Manifest validation
echo ""
echo "Validating manifest..."

mv=$(node -e "const m=JSON.parse(require('fs').readFileSync('$FIREFOX_BUILD/manifest.json','utf8')); console.log(m.manifest_version)")
test "$mv" = "2"; check "Manifest version is 2 (Firefox MV2)" $?

node -e "const m=JSON.parse(require('fs').readFileSync('$FIREFOX_BUILD/manifest.json','utf8')); if(!m.name) process.exit(1)" 2>/dev/null
check "Manifest has name" $?

node -e "const m=JSON.parse(require('fs').readFileSync('$FIREFOX_BUILD/manifest.json','utf8')); if(!m.version) process.exit(1)" 2>/dev/null
check "Manifest has version" $?

node -e "const m=JSON.parse(require('fs').readFileSync('$FIREFOX_BUILD/manifest.json','utf8')); if(!m.permissions) process.exit(1)" 2>/dev/null
check "Manifest has permissions" $?

node -e "const m=JSON.parse(require('fs').readFileSync('$FIREFOX_BUILD/manifest.json','utf8')); if(!m.background) process.exit(1)" 2>/dev/null
check "Manifest has background script" $?

node -e "const m=JSON.parse(require('fs').readFileSync('$FIREFOX_BUILD/manifest.json','utf8')); if(!m.content_scripts) process.exit(1)" 2>/dev/null
check "Manifest has content scripts" $?

# activeTab is intentionally absent — wxt.config.ts documents it as unused
# (no executeScript/captureVisibleTab/insertCSS anywhere).
node -e "
const m=JSON.parse(require('fs').readFileSync('$FIREFOX_BUILD/manifest.json','utf8'));
const required=['tabs','bookmarks','history','storage'];
const missing=required.filter(p=>!m.permissions.includes(p));
if(missing.length>0){console.error('Missing:',missing);process.exit(1)}
" 2>/dev/null
check "All required permissions present (tabs, bookmarks, history, storage)" $?

node -e "
const m=JSON.parse(require('fs').readFileSync('$FIREFOX_BUILD/manifest.json','utf8'));
const v=m.browser_specific_settings?.gecko?.strict_min_version;
if(v!=='126.0'){console.error('strict_min_version:',v);process.exit(1)}
" 2>/dev/null
check "gecko strict_min_version pinned to 126.0" $?

# 4. web-ext lint
echo ""
echo "Running web-ext lint..."
npx --yes web-ext@10.1.0 lint --source-dir "$FIREFOX_BUILD" > /dev/null 2>&1
check "web-ext lint passes" $?

# 5. Bundle size
echo ""
echo "Checking bundle size..."
total_size=$(du -sk "$FIREFOX_BUILD" | awk '{print $1}')
test "$total_size" -lt 1024
check "Total bundle under 1MB (${total_size}KB)" $?

# Summary
echo ""
echo "================================"
if [ $fail -gt 0 ]; then
  echo -e "Results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
  exit 1
else
  echo -e "Results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
  echo -e "${GREEN}All Firefox smoke tests passed!${NC}"
fi
echo ""

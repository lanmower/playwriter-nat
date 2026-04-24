# Plugin Migration Summary

## Issue
The plugin directory was located at `../plugin` (relative to opencode config), which caused OpenCode to error on startup with:
```
TypeError: fn2 is not a function. (In 'fn2(input)', 'fn2' is an instance of Object)
```

## Root Cause
1. Plugin was in wrong location (`~/.config/plugin` instead of `~/.config/opencode/plugin`)
2. Plugin used CommonJS format (`require`/`module.exports`) instead of ESM (`import`/`export`)

## Solution
1. **Moved plugin directory**: `mv ~/.config/plugin ~/.config/opencode/plugin`
2. **Converted to ESM format**:
   - Changed `require()` to `import` statements
   - Changed `module.exports = { GlootiePlugin }` to `export const GlootiePlugin`
   - Renamed file from `glootie.js` to `glootie.mjs`
   - Added `"type": "module"` to `package.json`
3. **Updated documentation**: Fixed all references in INSTALL.md to use `.mjs` extension

## Files Changed
- `~/.config/opencode/plugin/glootie.js` → `glootie.mjs` (converted to ESM)
- `~/.config/opencode/plugin/package.json` (updated main field and added type: module)
- `~/.config/opencode/plugin/INSTALL.md` (updated all references to .mjs)

## Verification
```bash
cd ~/tmp
opencode  # Successfully starts without errors
```

## Plugin Format Requirements
OpenCode plugins must:
1. Be located in `~/.config/opencode/plugin/` or `.opencode/plugin/`
2. Use ES Module syntax (ESM)
3. Export plugin functions as named exports: `export const PluginName = async ({ ... }) => { ... }`
4. Return an object with event handlers: `{ event: async ({ event }) => { ... } }`

## Reference
See official documentation: https://opencode.ai/docs/plugins

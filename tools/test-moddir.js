// Tests how main.lua finds the mod's folder: the full path UE4SS loaded main.lua from, when a file opens through
// it, and the short path from the game's start folder when not. Needs fengari. Run: node tools/test-moddir.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const main = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'main.lua'), 'utf8');
const START = 'RUNEUI_DIR = "ue4ss/Mods/RuneUI/"', END = 'Log("mod folder: " .. RUNEUI_DIR)';
const code = main.slice(main.indexOf(START), main.indexOf(END) + END.length) + '\nend';
const test = `
function Log() end
local SHORT = "ue4ss/Mods/RuneUI/"
-- source: what UE4SS names the file; opens: may a file open through the full path
local function dir(source, opens)
    debug = { getinfo = function() return { source = source } end }
    io = { open = function() return opens and { close = function() end } or nil end }
    load(CODE)()
    return RUNEUI_DIR
end
local WIN = "C:\\\\Program Files (x86)\\\\Steam\\\\RSDragonwilds\\\\Binaries\\\\Win64\\\\ue4ss\\\\Mods\\\\RuneUI\\\\"
assert(dir("@" .. WIN .. "Scripts\\\\main.lua", true) == WIN, "backslash path")
assert(dir("@D:/Games/Win64/Mods/RuneUI/Scripts/main.lua", true) == "D:/Games/Win64/Mods/RuneUI/", "slash path")
assert(dir("@" .. WIN .. "Scripts\\\\main.lua", false) == SHORT, "a full path that does not open")
assert(dir("@D:/Games/Mods/RuneUI/scripts/main.lua", true) == "D:/Games/Mods/RuneUI/", "lowercase scripts folder")
assert(dir("@main.lua", true) == SHORT, "a source without a folder")
assert(dir("=(load)", true) == SHORT, "no file name in the source")
debug = nil
io = { open = function() error("not reached") end }
load(CODE)()
assert(RUNEUI_DIR == SHORT, "no debug library")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(code)); lua.lua_setglobal(L, to_luastring('CODE'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

// No other part may build a path from the short folder alone: a picture or file would not load for a player
// whose mod folder is somewhere else. The short path is only the fallback inside (RUNEUI_DIR or "...").
const dir = require('path').join(__dirname, '..', 'RuneUI', 'Scripts');
const SHORT_PATH = 'ue4ss/Mods/RuneUI/';
const bad = [];
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.lua') && f !== 'main.lua')) {
  fs.readFileSync(require('path').join(dir, f), 'utf8').split('\n').forEach((line, i) => {
    const bare = line.split('(RUNEUI_DIR or "' + SHORT_PATH + '")').join('');
    if (bare.includes(SHORT_PATH)) bad.push(f + ':' + (i + 1));
  });
}
if (bad.length) { console.log('FAIL the short mod path is used without RUNEUI_DIR in: ' + bad.join(', ')); process.exit(1); }
console.log('ok   no part uses the short mod path alone');

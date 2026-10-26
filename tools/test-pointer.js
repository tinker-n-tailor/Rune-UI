// Tests the mouse pointer (pointer.lua): the name of the picture for the engine, from the mod's folder; the pointer is
// set once on every shape; a game that does not take the picture is asked three times, 10 s apart, and no more.
// Needs npm install once. Run: node tools/test-pointer.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'pointer.lua'), 'utf8');
const test = `
local function check(name, cond) if not cond then error("FAIL " .. name, 2) end print("ok   " .. name) end
local calls, takes = {}, false
local lib = {}
function lib:SetHardwareCursor(pc, shape, name, hot) calls[#calls + 1] = { Shape = shape, Name = name, Hot = hot } return takes end
function StaticFindObject(p) assert(p == "/Script/UMG.Default__WidgetBlueprintLibrary") return lib end
clock = 100
os.clock = function() return clock end
RUNEUI_DIR = "C:\\\\Games\\\\RSDragonwilds\\\\RSDragonwilds\\\\Binaries\\\\Win64\\\\ue4ss\\\\Mods\\\\RuneUI\\\\"
local pc, logs = nil, {}
local ctx = { Log = function(m) logs[#logs + 1] = m end, Controller = function() return pc end, Name = function(s) return "name:" .. s end }

local M = load(SRCTEXT)()
check("path: from the Content folder to the mod's Art folder", M.Path(RUNEUI_DIR) == "../Binaries/Win64/ue4ss/Mods/RuneUI/Art/pointer")
check("path: forward slashes and no slash at the end", M.Path("D:/Steam/x/binaries/Win64/ue4ss/Mods/RuneUI") == "../binaries/Win64/ue4ss/Mods/RuneUI/Art/pointer")
check("path: the short path counts from Binaries/Win64", M.Path("ue4ss/Mods/RuneUI/") == "../Binaries/Win64/ue4ss/Mods/RuneUI/Art/pointer")

M.Tick(ctx)
check("no controller yet: nothing is called", #calls == 0)
pc = { IsValid = function() return true end }
M.Tick(ctx)
check("the game does not take it: every shape was asked once", #calls == 5 and calls[1].Name == "name:../Binaries/Win64/ue4ss/Mods/RuneUI/Art/pointer")
M.Tick(ctx)
check("no second try before 10 s", #calls == 5)
clock = clock + 11 M.Tick(ctx) clock = clock + 11 M.Tick(ctx) clock = clock + 11 M.Tick(ctx)
check("three tries, then no more, and one log line", #calls == 15 and #logs == 1 and logs[1]:find("did not take", 1, true))

M = load(SRCTEXT)()
calls, logs, takes = {}, {}, true
clock = clock + 100
M.Tick(ctx)
clock = clock + 100
M.Tick(ctx) M.Forget(false) M.Tick(ctx)
check("the game takes it: set once for the whole run, also after a new world", #calls == 5 and #logs == 1 and logs[1]:find("is set", 1, true))
check("the tip of the arrow is the hot spot", calls[1].Hot.X == 0.08 and calls[1].Hot.Y == 0.07)
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

// Tests the keys of the four panels in main.lua itself, without the game: main.lua and every part load against
// stand-ins for the engine, the step runs, and the test presses F9, F5, F8, F6, the arrows and Backspace. It reads the
// view that main.lua gives to editor.lua, and the settings file that the step writes. A second run starts from a
// settings file of version 1.9 and checks that the panels show its values.
// The stand-in for an engine object takes any call and any field, so this test proves the flow of main.lua, not the
// drawing. The files are kept in memory, so the test reads and writes nothing on the disk but the scripts.
// Needs npm install once. Run: node tools/test-panelflow.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const scripts = path.join(__dirname, '..', 'RuneUI', 'Scripts');
// one run of main.lua in a new Lua, with seed as its runeui.txt ("" for none); gives back true when a check failed
function run(seed, body) {
  const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
  const set = (name, text) => { lua.lua_pushstring(L, to_luastring(text)); lua.lua_setglobal(L, to_luastring(name)); };
  set('MAIN', fs.readFileSync(path.join(scripts, 'main.lua'), 'utf8'));
  set('SCRIPTS', scripts.replace(/\\/g, '/'));
  set('SEED', seed);
  const bad = lauxlib.luaL_dostring(L, to_luastring(prelude + body)) !== 0;
  if (bad) console.log('LUA ERROR', lua.lua_tojsstring(L, -1));
  return bad || lua.lua_tointeger(L, -1) !== 0;
}

const prelude = `
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
package.path = SCRIPTS .. "/?.lua"
local clock = 0
os.clock = function() return clock end
collectgarbage = function() return 0 end   -- fengari has no collector
local logs = {}
print = (function(real) return function(s) if type(s) == "string" and s:find("^%[RuneUI%]") then logs[#logs + 1] = s else real(s) end end end)(print)

-- the files, in memory: the settings file and the pictures
local files = { ["runeui.txt"] = SEED ~= "" and SEED or nil }
io.open = function(name, mode)
    if mode:sub(1, 1) == "r" and not files[name] then return nil end
    if mode:sub(1, 1) == "w" then files[name] = "" end
    return { read = function() return files[name] end, write = function(_, s) files[name] = files[name] .. s return true end, close = function() end }
end
os.rename = function(from, to) files[to], files[from] = files[from], nil return true end
os.remove = function(name) files[name] = nil return true end

-- an engine object: every field is another one, every call gives another one, and a write is kept
local mt = {}
local function Mock() return setmetatable({}, mt) end
mt.__index = function(t, k) local v = Mock() rawset(t, k, v) return v end
mt.__call = function() return Mock() end
local pc = { IsValid = function() return true end, GetFullName = function() return "PlayerController /Game/World.PC_1" end,
    IsLocalController = function() return true end, IsInputKeyDown = function() return false end }
pc.Player = { IsValid = function() return true end, PlayerController = pc }
function FindAllOf(cls) if cls == "PlayerController" then return { pc } end end
function FindFirstOf() return Mock() end
function StaticFindObject() return Mock() end
function StaticConstructObject() return Mock() end
function FName(s) return s end
function FText(s) return s end
local hooked = {}   -- the paths that got a hook
function RegisterHook(path) hooked[#hooked + 1] = path end
local keys, step = {}, nil
function RegisterKeyBind(code, fn) keys[code] = fn end
function ExecuteInGameThreadWithDelay(_, fn) fn() end
function LoopInGameThreadWithDelay(_, fn) step = fn end
function NotifyOnNewObject() end

local ok, err = pcall(load(MAIN, "=main"))
check("main.lua loads with every part: " .. tostring(err), ok)
local function Logged(s) for _, l in ipairs(logs) do if l:find(s, 1, true) then return true end end return false end
check("the four panel files loaded", Logged("panels file loaded") and Logged("skinpanel file loaded") and Logged("mappanel file loaded") and Logged("camerarules file loaded"))
check("the log names the four panels and their keys", Logged("the panels in game: Layout F9, Rune Skin F5, Rune Map F8, Immersive mode F6"))

-- what main.lua gives to the panel
local Editor = package.loaded.editor
local view, shown
Editor.Update = function(v) view = v end
Editor.Open = function(on) shown = on end
Editor.Size = function() return 460, 760 end   -- the stand-in has no size to give
local F5, F6, F8, F9, BACK, LEFT, UP, RIGHT, DOWN, PGDN = 116, 117, 119, 120, 8, 37, 38, 39, 40, 34
local function Run(n) for _ = 1, n or 2 do clock = clock + 0.05 step() end end
local function Press(code) keys[code]() Run() end
local function Row(id) return (files["runeui.txt"] or ""):match("\\n" .. id .. ": ([^\\n]*)") or "" end
local function Links() local out = {} for _, l in ipairs(view.Links) do out[#out + 1] = l[1] .. " " .. l[2] end return table.concat(out, ", ") end
local function Has(text) for _, r in ipairs(view.Rows) do if r.Text == text then return r end end end
local function Start() clock = 30 Run(80) end   -- past the 3 s that a new world gets to settle
`;

const fresh = `
check("every key of the panels is bound", keys[F5] and keys[F6] and keys[F8] and keys[F9] and keys[BACK] and keys[UP] and keys[LEFT])

Start()
check("nothing open: no panel", view == nil)

Press(F9)
check("F9: the Layout panel, with the other three panels in its head", view and view.Mode == "edit" and view.Title == "LAYOUT" and Links() == "Rune Skin F5, Rune Map F8, Immersive mode F6" and shown == true)
check("F9: the list starts with the first group and its rows, in the panel's lines", view.Rows[1].Head and view.Rows[1].Text == "Bars and status"
    and view.Rows[2].Text == "Health, stamina and shield bars" and view.Rows[2].Sel and #view.Rows <= Editor.ROWS)
check("F9: no switch and no group of all notices in the list", not Has("Wheels") and not Has("Immersive mode") and not Has("Creatures") and not Has("All notices (group)"))
Press(PGDN)
check("PgDn: the next row", view.Name == "Level badge")
for _ = 1, 4 do Press(PGDN) end
check("PgDn four times more: the renamed row, and the list has moved with it", view.Name == "Food, water and potion buffs" and Has("Food, water and potion buffs").Sel and Has("Survival rings") ~= nil)
Press(RIGHT)
check("an arrow in F9 moves the part: its row gets the mark", Has("Food, water and potion buffs").Moved == true)

Press(F5)
check("F5 from F9: Rune Skin, and the layout is saved with the move", view.Mode == "skin" and view.Title == "RUNE SKIN" and Links() == "Layout F9, Rune Map F8, Immersive mode F6" and Row("drink"):find("x=10", 1, true) ~= nil)
check("F5: the switches in the panel's ten lines, each with a value", #view.Rows == 10 and view.Rows[1].Text == "Wheels" and view.Rows[1].Note == "On" and view.Rows[4].Text == "Floating XP" and view.Rows[4].Note == "Off" and view.Rows[5].Text == "Enemy health bars" and view.Rows[5].Note == "On" and view.Rows[8].Text == "Day and night icon" and view.Rows[8].Note == "On" and view.Rows[9].Text == "Game icons beside the bars" and view.Rows[9].Note == "Off")
Press(RIGHT)
check("Right: the look goes off and is saved at once, under its old id", view.Rows[1].Note == "Off" and view.Name == "Wheels:  Off" and Row("wheels"):find("visible=0", 1, true) ~= nil)
Press(DOWN) Press(DOWN)
check("Down twice: the third row", view.Rows[3].Sel and view.Name == "XP under the bars:  On")
Press(BACK)
check("Backspace: every switch back to its starting value, and saved", view.Rows[1].Note == "On" and Row("wheels"):find("visible=1", 1, true) ~= nil)

Press(F6)
check("F6 from F5: the Immersive mode panel", view.Mode == "camera" and view.Title == "IMMERSIVE MODE" and Links() == "Layout F9, Rune Skin F5, Rune Map F8")
check("F6: the group title, then Immersive mode, its wait and the crosshair", view.Rows[1].Head and view.Rows[2].Text == "Immersive mode" and view.Rows[2].Sel and view.Rows[2].Note == "Off"
    and view.Rows[3].Text == "Wait before the fade" and view.Rows[3].Note == "< 8 s >" and view.Rows[4].Text == "Crosshair" and #view.Rows <= Editor.ROWS)
Press(RIGHT)
check("Right: the immersive mode is on, in the layout's row of the profile", view.Name == "Immersive mode:  On" and Row("immersive"):find("visible=1", 1, true) ~= nil)
Press(DOWN) Press(RIGHT) Press(RIGHT)
check("the wait goes up a second a press, and is saved in the same row", view.Name == "Wait before the fade:  10 s" and Row("immersive"):find("wait=10", 1, true) ~= nil)
for _ = 1, 8 do Press(DOWN) end
check("Down to the last row: the list has moved, the row is in it", view.Name == "Hold after a fight:  8 s" and Has("Hold after a fight").Sel and #view.Rows <= Editor.ROWS)
Press(BACK)
check("Backspace: the mode off and the wait at 8 again, and saved", Row("immersive"):find("visible=0", 1, true) ~= nil and Row("immersive"):find("wait=8", 1, true) ~= nil)

Press(F8)
check("F8 from F6: the Rune Map panel", view.Mode == "map" and view.Title == "RUNE MAP" and Links() == "Layout F9, Rune Skin F5, Immersive mode F6" and view.Rows[1].Text == "Rune Map")
for _ = 1, 4 do Press(DOWN) end
Press(RIGHT)
check("Creatures: the row is under its group title, and Right steps it to Off", view.Name == "Creatures:  Off" and Has("What the map shows") ~= nil)
Press(F8)
check("F8 again: the panel closes, and the creatures switch is saved in the layout", shown == false and Row("creatures"):find("visible=0", 1, true) ~= nil)
Press(F5) Press(F5)
check("F5 twice: open, then closed", shown == false)
Press(F6) Press(F9)
check("F9 from F6: the Layout panel again", view.Mode == "edit" and shown == true)
Press(F9)
check("F9 again: closed", shown == false)
pc.GetFullName = function() return "PlayerController /Game/World2.PC_2" end   -- the player enters another world
Run(300)
-- a hook on a /Game/ (blueprint) function makes UE4SS check every blueprint call of the game: 10 FPS at a base (15-10-2026)
local bp = {}
for _, p in ipairs(hooked) do if p:find("/Game/", 1, true) == 1 then bp[#bp + 1] = p end end
check("no hook on a blueprint function: " .. table.concat(bp, ", "), #bp == 0)
local errors = {}
for _, l in ipairs(logs) do if l:find("panel update failed", 1, true) or l:find("timer step failed", 1, true) or l:find("apply failed", 1, true) then errors[#errors + 1] = l end end
check("the step and the panel logged no error: " .. table.concat(errors, " ; "), #errors == 0)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
// a layout that a player saved in 1.9: the immersive mode on with a wait of 12 s, the XP under the bars off, the
// creatures off, and the group of all notices moved and hidden
const SEED = `[general]
profile=1
[layout 1]
immersive: x=0 y=0 scale=1 visible=1 opacity=1 edgex=0.5 edgey=0.5 wait=12
runexp: x=0 y=0 scale=1 visible=0 opacity=1 edgex=0 edgey=0
creatures: x=0 y=0 scale=1 visible=0 opacity=1 edgex=1 edgey=0
notify: x=0 y=-120 scale=1 visible=0 opacity=1 edgex=0.5 edgey=0.5
survival: x=640 y=-40 scale=0.9 visible=1 opacity=0.8 edgex=0.5 edgey=1
`;
const old = `
Start()
Press(F6)
check("a 1.9 file: F6 shows the saved immersive mode and its wait", view.Rows[2].Text == "Immersive mode" and view.Rows[2].Note == "On" and view.Rows[3].Note == "< 12 s >")
Press(F5)
check("a 1.9 file: F5 shows the saved switch under its new name", Has("XP under the bars").Note == "Off" and Has("Wheels").Note == "On")
Press(F8)
check("a 1.9 file: F8 shows the saved creatures switch", Has("Creatures").Note == "< Off >")
Press(F9)
for _ = 1, 4 do Press(PGDN) end
check("a 1.9 file: the survival rings keep their saved place, size and opacity under the new name", view.Name == "Survival rings"
    and view.Facts[1][2] == "800" and view.Facts[3][2] == "90%" and view.Facts[4][2] == "80%")   -- 800: the rings' middle, 160, plus the saved 640
for _ = 1, 14 do Press(PGDN) end
check("a 1.9 file that hid all notices: its row shows, first under Notices, marked hidden", view.Name == "All notices (group)" and Has("All notices (group)").Note == "hidden"
    and Has("Notices") ~= nil and Has("Level up notice") ~= nil)
Press(F9)
check("closing saves: the group keeps its move and stays hidden", Row("notify"):find("y=-120", 1, true) ~= nil and Row("notify"):find("visible=0", 1, true) ~= nil)
print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
const failed = [run('', fresh), run(SEED, old)];
process.exit(failed.some(Boolean) ? 1 : 0);

// Tests the F9 hint (hint.lua) against fake widgets: a fresh install shows the game's tutorial tip once, in the first world,
// with the right texts, and writes the flag; a player who has the mod from before sees nothing; a real notice in the entry
// delays the hint and is not touched; every value is put back after 10 s, when F9 opens, or in a respawn; a new world keeps
// the hint for the next one; once the flag says shown, the step makes no call. It also tests how profiles.lua
// tells a fresh install from an old one.
// Needs npm install once. Run: node tools/test-hint.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

const test = `
local calls = 0
function FText(s) return { s = s, ToString = function() return s end } end
local api = {}
api.__index = api
function api:IsValid() return self.alive ~= false end
function api:GetVisibility() return self.vis end
function api:GetRenderOpacity() return self.op end
function api:SetVisibility(v) calls = calls + 1 self.vis = v end
function api:SetRenderOpacity(o) calls = calls + 1 self.op = o end
function api:GetText() return self.text end
function api:SetText(t) calls = calls + 1 self.text = t end
local function Text(s) return setmetatable({ text = FText(s) }, api) end
local tip
local function NewTip()
    tip = setmetatable({ vis = 1, op = 0 }, api)
    tip.TitleTextBlock, tip.BodyTextBlock = Text("Tutorial Title"), Text("Lorem ipsum")
    -- the key line of the game's last tip ("View In Map"): the hint must not show it
    tip.InputEntryWidget = { vis = 4, IsValid = function() return true end }
    function tip.InputEntryWidget:GetVisibility() return self.vis end
    function tip.InputEntryWidget:SetVisibility(v) self.vis = v end
    return tip
end
NewTip()

local clock, finds, hudChecks, editChecks, saves, logs = 0, 0, 0, 0, 0, {}
os.clock = function() return clock end
local hud, editing = false, false
local General = { f9hint = 0 }
local Key = { editor = "F9" }
local Notices = load(NOTICES)()
local M = load(HINT)()
local ctx = {
    Log = function(m) logs[#logs + 1] = m print(m) end,
    Find = function(cls) finds = finds + 1 return cls == "WBP_TutorialNotifications_Item_C" and tip and { tip } or {} end,
    Notices = Notices, Key = Key, General = General,
    Save = function() saves = saves + 1 end,
    Editing = function() editChecks = editChecks + 1 return editing end,
    HudUp = function() hudChecks = hudChecks + 1 return hud end,
}
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function Rest() return tip.vis == 1 and tip.op == 0 and tip.TitleTextBlock.text.ToString() == "Tutorial Title"
    and tip.BodyTextBlock.text.ToString() == "Lorem ipsum" and tip.InputEntryWidget.vis == 4 end
local function Shown() return tip.vis == 4 and tip.op == 1 and tip.InputEntryWidget.vis == 1 and tip.TitleTextBlock.text.s == "Rune UI"
    and tip.BodyTextBlock.text.s == "Press F9 to move, resize and hide the HUD" end
local function Tick(at) clock = at M.Tick(ctx) end

-- a player who has the mod from before: the flag is already 1
do
    local old = { f9hint = 1 }
    local c = setmetatable({ General = old }, { __index = ctx })
    hud = true
    for i = 1, 1000 do clock = 100 + i M.Tick(c) end
    check("flag 1: nothing shown, no call, no search", Rest() and calls == 0 and finds == 0)
    check("flag 1: no check of the HUD, the editor or the file", hudChecks == 0 and editChecks == 0 and saves == 0)
    hud = false
end

-- a fresh install, the HUD not up yet
Tick(100)
Tick(130)
check("no HUD: nothing shows and nothing is searched", Rest() and finds == 0 and General.f9hint == 0 and saves == 0)

hud = true
Tick(140)
check("HUD up: the wait starts, nothing shows", Rest() and finds == 0)
Tick(147.9)
check("not in the first seconds after the HUD", Rest() and finds == 0)
Tick(148)
check("after the wait: the tip shows with the title and the body", Shown())
check("the flag is 1 and saved at once", General.f9hint == 1 and saves == 1)
local before = calls
Tick(150)
Tick(157.9)
check("while it shows: no call", Shown() and calls == before and saves == 1)
Tick(158)
check("after 10 s: every value is back", Rest())
before = calls
Tick(200)
Tick(300)
check("after that: no call and no second save", calls == before and saves == 1)
check("no failure in the log", #logs == 0)

-- once shown, the step is free: no call and no engine search
do
    local f, h, e = finds, hudChecks, editChecks
    for i = 1, 1000 do clock = 400 + i M.Tick(ctx) end
    check("shown: no engine call, no search, no check", calls == before and finds == f and hudChecks == h and editChecks == e)
end

-- the layout key was changed in runeui.txt
General.f9hint = 0
Key.editor = "Q"
NewTip()
M.Forget(false)
Tick(1000)
Tick(1008)
check("the key that is bound is in the text", tip.BodyTextBlock.text.s == "Press Q to move, resize and hide the HUD")
Tick(1018)
check("and the values are back", Rest())
Key.editor = "F9"

-- a real notice plays in the entry: not touched, tried again a little later, shown when the entry is free
General.f9hint, saves = 0, 0
M.Forget(false)
before = calls
tip.vis, tip.op = 3, 0.6
local f = finds
Tick(2000)
Tick(2008)
check("a playing tip is left alone", calls == before and tip.vis == 3 and tip.op == 0.6 and General.f9hint == 0 and saves == 0)
check("it was looked at once", finds == f + 1)
Tick(2009)
check("not asked again before 2 s", finds == f + 1)
Tick(2010.1)
check("asked again later, the tip still plays: untouched", finds == f + 2 and tip.vis == 3 and tip.TitleTextBlock.text.ToString() == "Tutorial Title")
tip.vis, tip.op = 1, 0
Tick(2012.2)
check("when the game collapsed it, the hint shows", Shown() and General.f9hint == 1 and saves == 1)
Tick(2022.2)
check("and ends", Rest())

-- F9 opens while the hint shows: it ends, the flag stays 1
General.f9hint, saves = 0, 0
M.Forget(false)
Tick(3000)
Tick(3008)
check("shown again for the next case", Shown())
editing = true
Tick(3009)
check("F9: the hint ends and the values are back", Rest() and General.f9hint == 1)
editing = false
Tick(3020)
check("F9: it does not come back", Rest())

-- F9 opens before the hint showed: the player knows, so it is marked as shown and never shows
General.f9hint, saves = 0, 0
M.Forget(false)
Tick(4000)
editing = true
Tick(4001)
editing = false
check("F9 before the hint: the flag is 1 and saved, nothing shown", General.f9hint == 1 and saves == 1 and Rest())
Tick(4020)
Tick(4100)
check("F9 before the hint: it never shows", Rest() and saves == 1)

-- a new world before it showed keeps it for the next world; in the next one it waits for its own HUD
General.f9hint, saves = 0, 0
M.Forget(false)
Tick(5000)
Tick(5005)
hud = false
M.Forget(false)
Tick(5010)
Tick(5100)
check("a new world before the hint showed: the flag is still 0, nothing shown", General.f9hint == 0 and Rest() and saves == 0)
hud = true
Tick(5200)
Tick(5207)
check("in the next world it waits for the HUD and the seconds", Rest())
Tick(5208)
check("then it shows", Shown() and General.f9hint == 1)

-- a new world while it shows: no call on the old widgets; a respawn puts the values back
before = calls
M.Forget(false)
Tick(5209)
check("a new world while it shows: no call on the old tip", calls == before and Shown())
NewTip()
General.f9hint = 0
M.Forget(false)
Tick(6000)
Tick(6008)
check("shown for the respawn case", Shown())
M.Forget(true)
check("a respawn: the values are back", Rest())
Tick(6100)
check("and it does not come back", Rest())

-- the game takes the entry while the hint shows: nothing is written over the game's notice
General.f9hint = 0
M.Forget(false)
Tick(7000)
Tick(7008)
tip.vis, tip.op = 3, 0.5
before = calls
Tick(7018)
check("an entry the game took is left as the game has it", calls == before and tip.vis == 3 and tip.op == 0.5)
tip.vis, tip.op = 1, 0

-- an entry that is not valid gets no call
General.f9hint = 0
M.Forget(false)
tip.alive = false
before = calls
Tick(8000)
Tick(8008)
check("an invalid entry gets no call and the flag stays 0", calls == before and General.f9hint == 0)
tip.alive = true
Tick(8010.1)
check("it shows once the entry is valid again", Shown() and General.f9hint == 1)
Tick(8020.1)

-- no entry yet: the search is empty
General.f9hint = 0
M.Forget(false)
local held = tip
tip = nil
Tick(9000)
Tick(9008)
check("no entry yet: nothing, flag 0", General.f9hint == 0)
tip = held
Tick(9010.1)
check("found on the next try: it shows", Shown())

-- profiles.lua: a fresh install and an old one
local Real = load(SETTINGS)()
local function Profiles(loaded, legacy)
    local cfg, saved = loaded, 0
    local Settings = setmetatable({ Load = function() return cfg end, Legacy = function() return legacy end,
        Save = function() saved = saved + 1 return true end }, { __index = Real })
    local E = { Id = "bars", Center = { X = 0, Y = 0 }, Instances = {}, Keys = {}, Last = {} }
    local Layout = { Third = function() return 0.5 end, Retarget = function() end, TargetFromSpot = function() end }
    local P = load(PROFILES)()
    P.Init({ Log = function() end, VERSION = "test", Elements = { E }, Settings = Settings, Layout = Layout, Defaults = {} })
    return P, saved
end
local P, saved = Profiles(nil, nil)
check("no settings file: the flag is 0 and nothing is written", P.Cfg.general.f9hint == 0 and saved == 0)
P, saved = Profiles({ general = { profile = 2 } }, nil)
check("a settings file without the flag: marked as shown and written", P.Cfg.general.f9hint == 1 and saved == 1)
P, saved = Profiles(nil, { general = { profile = 1 } })
check("the files of an older version: marked as shown and written", P.Cfg.general.f9hint == 1 and saved == 1)
P, saved = Profiles({ general = { f9hint = 0 } }, nil)
check("a file with the flag 0 stays 0 and is not written", P.Cfg.general.f9hint == 0 and saved == 0)
P, saved = Profiles({ general = { f9hint = 1 } }, nil)
check("a file with the flag 1 stays 1 and is not written", P.Cfg.general.f9hint == 1 and saved == 0)
P, saved = Profiles(nil, nil)
P.LoadLayout()
P.Prof.Next()
check("the flag is not part of a layout profile: a switch keeps it", P.Prof.N == 2 and P.Cfg.general.f9hint == 0)
check("the flag is written in the file's general section", Real.Format({ general = { f9hint = 0 } }):find("[general]\\nf9hint=0", 1, true) ~= nil)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
for (const [name, file] of [['NOTICES', 'notices.lua'], ['HINT', 'hint.lua'], ['SETTINGS', 'settings.lua'], ['PROFILES', 'profiles.lua']]) {
  lua.lua_pushstring(L, to_luastring(read(file))); lua.lua_setglobal(L, to_luastring(name));
}
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

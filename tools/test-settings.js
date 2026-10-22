// Tests settings.lua without the game: the runeui.txt format both ways, tolerant reading, and the old files
// read into the same table. Also the map setting "Player name" of mapsettings.lua: read, saved and reset.
// Needs fengari. Run: node tools/test-settings.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'settings.lua'), 'utf8');
const test = `
local M = (function() ${src} end)()
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end
local function same(a, b)
    if type(a) ~= type(b) then return false end
    if type(a) ~= "table" then return a == b end
    for k, v in pairs(a) do if not same(v, b[k]) then return false end end
    for k in pairs(b) do if a[k] == nil then return false end end
    return true
end

local example = [[
# Rune UI settings. The mod writes this file. Delete a line to get its default back.
[general]
profile=1
version=1.4

[layout 1]
vitals: x=-699 y=-907 scale=0.9 visible=1 opacity=1 edgex=0.5 edgey=1
immersive: x=0 y=0 scale=1 visible=0 opacity=1 edgex=0 edgey=0 wait=8
questlist: x=-20 y=15 scale=1.2 visible=1 opacity=1 edgex=1 edgey=0
cdhoriz: x=0 y=0 scale=1 visible=1 opacity=1 edgex=0 edgey=0
slimlevel: x=0 y=0 scale=1 visible=1 opacity=1 edgex=0 edgey=0
party: x=40 y=-20 scale=1.1 visible=0 opacity=0.8 edgex=0 edgey=0

[map]
zoom=2
Map=1
North=0

[menuart]
trim=/Game/UI/T_Trim.T_Trim|3|0.25,0,0.25,0|512,16|0|1,1,1,1

[keys]
editor=F9
]]
local t = M.Parse(example)
check("parse: general", t.general.profile == 1 and t.general.version == 1.4)
check("parse: a row", same(t["layout 1"].vitals, { x = -699, y = -907, scale = 0.9, visible = 1, opacity = 1, edgex = 0.5, edgey = 1 }))
check("parse: the wait", t["layout 1"].immersive.wait == 8 and t["layout 1"].immersive.visible == 0)
check("parse: the quest tracker keeps its place and size", t["layout 1"].questlist.x == -20 and t["layout 1"].questlist.scale == 1.2 and t["layout 1"].slimlevel.visible == 1)
check("parse: the party panel keeps its own place, size and switch in the layout profile", same(t["layout 1"].party, { x = 40, y = -20, scale = 1.1, visible = 0, opacity = 0.8, edgex = 0, edgey = 0 }))
check("parse: the horizontal cooldowns switch is a row of its own, per layout profile", same(t["layout 1"].cdhoriz, { x = 0, y = 0, scale = 1, visible = 1, opacity = 1, edgex = 0, edgey = 0 }))
check("parse: a file of before the switch has no row for it, so profiles.lua keeps it off", M.Parse("[layout 1]\\nvitals: x=0 y=0 scale=1 visible=1\\n")["layout 1"].cdhoriz == nil)
-- what stays in the immersive mode: Nothing, Map or Compass; old files saved 1 and 0
check("stay: the three values", M.STAY[1] == "Nothing" and M.STAY[2] == "Map" and M.STAY[3] == "Compass")
check("stay: numbers 0, 1, 2", M.StayFrom(0) == "Nothing" and M.StayFrom(1) == "Map" and M.StayFrom(2) == "Compass")
check("stay: an old on is Map, an old off is Nothing", M.StayFrom(1) == "Map" and M.StayFrom(0) == "Nothing")
check("stay: a saved old file reads right", M.StayFrom(M.Parse("[map]\\nImmersive=1\\n").map.Immersive) == "Map" and M.StayFrom(M.Parse("[map]\\nImmersive=0\\n").map.Immersive) == "Nothing")
check("stay: a name typed by hand", M.StayFrom("compass") == "Compass" and M.StayFrom("MAP") == "Map")
check("stay: nothing, rubbish or out of range is Nothing", M.StayFrom(nil) == "Nothing" and M.StayFrom("x") == "Nothing" and M.StayFrom(3) == "Nothing" and M.StayFrom(-1) == "Nothing" and M.StayFrom(1.5) == "Nothing")
check("stay: to the number", M.StayTo("Nothing") == 0 and M.StayTo("Map") == 1 and M.StayTo("Compass") == 2 and M.StayTo("x") == 0)
local round = true
for _, name in ipairs(M.STAY) do if M.StayFrom(M.StayTo(name)) ~= name then round = false end end
check("stay: every value comes back as it was saved", round)
check("map refresh: the three names, in order", table.concat(M.DRAWING, "|") == "Every frame|Every 2nd frame|Every 4th frame")
check("map refresh: each name reads as its place", M.DrawingFrom("Every frame") == 1 and M.DrawingFrom("Every 2nd frame") == 2 and M.DrawingFrom("Every 4th frame") == 3)
check("map refresh: the old names of a config.txt read as the same setting", M.DrawingFrom("Smooth") == 1 and M.DrawingFrom("Faster") == 2 and M.DrawingFrom("Fastest") == 3)
check("map refresh: case does not matter", M.DrawingFrom("every 4TH frame") == 3 and M.DrawingFrom("faster") == 2)
check("map refresh: nothing or rubbish is every 2nd frame, the starting value", M.DrawingFrom(nil) == 2 and M.DrawingFrom("x") == 2 and M.DrawingFrom(3) == 2)
check("parse: map", same(t.map, { zoom = 2, Map = 1, North = 0 }))
-- "Player name" (Name) in the [map] section of mapsettings.lua is read, saved and reset like the other map settings
local R = NewRuneMap()
local saves = 0
local mapStore = M.Parse("[map]\\nName=0\\nMark=1\\n").map
R.Attach(mapStore, function() saves = saves + 1 end, M)
check("map: Name off is read from the file", R.Set.Name == false and R.Set.Mark == true)
R.Fails = 3   -- no map is built in this test: Tick stops after the settings
R.Set.Name, R.Dirty = true, true
R.Tick({ Log = function() end })
check("map: Name is saved as 1 and 0", mapStore.Name == 1 and saves == 1)
R.Set.Name, R.Dirty = false, true
R.Tick({ Log = function() end })
check("map: Name off is saved", mapStore.Name == 0)
R.Reset()
R.Tick({ Log = function() end })
check("map: reset turns Name on", R.Set.Name == true and mapStore.Name == 1)
local fresh = NewRuneMap()
fresh.Attach(M.Parse("[map]\\nMark=1\\n").map, function() end, M)
check("map: Name is on when the file has no line for it", fresh.Set.Name == true)
-- A new view makes the map draw every marker again. Only "Faces north" changes the view, and a new map already has it.
local views = 0
local live = { View = { RotationMode = 1 }, Map = { BroadcastMapView = function() views = views + 1 end } }
local MapSettings = NewMapSettings()
MapSettings.Init(live)
local quiet = { Log = function() end }
MapSettings.Apply(quiet)
check("map: a new map gets no second view", views == 0)
live.Set.Mark = false MapSettings.Apply(quiet)
live.Set.Smooth = true MapSettings.Apply(quiet)
check("map: the north mark and the map refresh send no new view", views == 0)
live.Set.North = true MapSettings.Apply(quiet)
check("map: Faces north turns the view and sends it once", views == 1 and live.View.RotationMode == 0)
live.Set.North = false MapSettings.Apply(quiet)
check("map: and back", views == 2 and live.View.RotationMode == 1)
check("parse: a section the mod does not know is kept raw", t.menuart.trim == "/Game/UI/T_Trim.T_Trim|3|0.25,0,0.25,0|512,16|0|1,1,1,1")
check("parse: a word stays a word", t.keys.editor == "F9")
check("parse: integers stay integers", math.type(t.general.profile) == "integer" and math.type(t["layout 1"].vitals.x) == "integer")

local text = M.Format(t)
check("round trip: Parse(Format(t)) == t", same(M.Parse(text), t))
check("round trip: Format is stable", M.Format(M.Parse(text)) == text)
check("format: the header comment", string.sub(text, 1, 12) == "# Rune UI se")
check("format: a row line", string.find(text, "\\nvitals: x=-699 y=-907 scale=0.9 visible=1 opacity=1 edgex=0.5 edgey=1\\n", 1, true) ~= nil)
check("format: keys sorted", string.find(text, "Map=1\\nNorth=0\\nzoom=2\\n", 1, true) ~= nil)
check("format: rows sorted without an order", string.find(text, "immersive:", 1, true) < string.find(text, "vitals:", 1, true))
local ordered = M.Format(t, { "vitals", "immersive" })
check("format: rows in the given order", string.find(ordered, "vitals:", 1, true) < string.find(ordered, "immersive:", 1, true))
check("format: the order only touches layouts", same(M.Parse(ordered), t))

local mixed = { zeta = { a = 1 }, keys = { editor = "F9" }, ["layout 2"] = { b = { x = 1 } }, alpha = { q = "w" },
    general = { profile = 2 }, map = { zoom = 4 } }
local mt = M.Format(mixed)
local pos = {}
for _, n in ipairs({ "general", "layout 2", "map", "keys", "alpha", "zeta" }) do pos[#pos + 1] = string.find(mt, "[" .. n .. "]", 1, true) end
local inOrder = #pos == 6
for i = 2, #pos do if pos[i] < pos[i - 1] then inOrder = false end end
check("format: fixed section order, unknown sections after, sorted", inOrder)
check("round trip: unknown sections and keys kept", same(M.Parse(mt), mixed))
-- rows of elements that are gone (Rune bars, Rune enemy bars, the old quest tracker) read like any row and are kept,
-- and profiles.lua reads only the rows of its element list, so they change nothing
local gone = M.Parse("[layout 1]\\nrunebars: x=0 y=0 scale=1 visible=0 opacity=1\\nruneenemybars: x=0 y=0 scale=1 visible=0 opacity=1\\nquesttracker: x=0 y=0 scale=1 visible=0 opacity=1\\nvitals: x=1 y=2 scale=1 visible=1 opacity=1\\n")
check("old rows of removed switches: read without an error, the others unharmed, kept on a save", gone["layout 1"].runebars.visible == 0 and gone["layout 1"].questtracker.visible == 0 and gone["layout 1"].vitals.x == 1 and same(M.Parse(M.Format(gone)), gone))
local rowOrder = M.Format({ ["layout 1"] = { e = { zz = 1, wait = 5, x = 1, scale = 2, y = 3, aa = 2 } } })
check("format: row fields in the old file's order, others after", string.find(rowOrder, "e: x=1 y=3 scale=2 wait=5 aa=2 zz=1", 1, true) ~= nil)

local function fmt(v) return M.Format({ s = { v = v } }):match("v=([^\\n]*)") end
check("numbers: 2 and 2.0 write as 2", fmt(2) == "2" and fmt(2.0) == "2")
check("numbers: up to 3 decimals, no trailing zeros", fmt(0.9) == "0.9" and fmt(1.25) == "1.25" and fmt(1.23456) == "1.235")
check("numbers: 10, 100.5 and negatives", fmt(10) == "10" and fmt(100.5) == "100.5" and fmt(-699.5) == "-699.5")
check("numbers: a tiny negative is 0, not -0", fmt(-0.0001) == "0")
check("numbers: booleans write as 1 and 0", fmt(true) == "1" and fmt(false) == "0")
check("numbers: hex text stays text", M.Parse("[s]\\nv=0x1F\\n").s.v == "0x1F")
check("numbers: 1e3 and .5 are numbers", M.Parse("[s]\\nv=1e3\\nw=.5\\n").s.v == 1000 and M.Parse("[s]\\nw=.5\\n").s.w == 0.5)

local junk = M.Parse("before=any section\\n[general]\\r\\nprofile=2\\r\\n???\\n= no key\\n  # indented comment\\n" ..
    "[]\\nlost=1\\n[layout 1]\\nvitals x=1\\nbars: x=5 junk y=7 =3 scale=\\n[map]\\nzoom = 3 \\n")
check("junk: no error, good lines kept", junk.general and junk.general.profile == 2)
check("junk: Windows line ends", junk.general.profile == 2 and next(junk.general, next(junk.general)) == nil)
check("junk: a line before any section is skipped", junk.before == nil)
check("junk: an empty section name is skipped", junk[""] == nil and junk.lost == nil)
check("junk: a row keeps its good pairs", same(junk["layout 1"].bars, { x = 5, y = 7 }) and junk["layout 1"].vitals == nil)
check("junk: spaces around = are allowed", junk.map.zoom == 3)
check("junk: empty and nil text give an empty table", same(M.Parse(""), {}) and same(M.Parse(nil), {}))

check("Num: clamps", M.Num(5, 0, 3, 1) == 3 and M.Num(-5, 0, 3, 1) == 0 and M.Num(2, 0, 3, 1) == 2)
check("Num: not a number gives the default", M.Num("x", 0, 3, 1) == 1 and M.Num(nil, 0, 3, 1) == 1 and M.Num(0/0, 0, 3, 1) == 1)
check("Num: text of a number counts", M.Num("2.5", 0, 3, 1) == 2.5)
local st = {}
local a = M.Section(st, "map") a.zoom = 3
check("Section: creates once, then returns the same", M.Section(st, "map") == a and st.map.zoom == 3)

local function files(map) return function(name) return map[name] end end
local old = {
    ["runeui_layout.txt"] = "vitals:-699.0,-907.0,0.90,1,1.0,0.5,1.0\\n" ..
        "immersive:12.5,-3,1.00,0,0.73,0.0,0.0,45\\n" ..   -- all 8 fields: opacity rounds, wait clamps
        "avatar:-5000,10,9,1\\n" ..                       -- an old 4-field line: clamps, solid, no edge
        "bars:abc,1,1,1\\n" ..                            -- a bad number: skipped
        "compass:1,2,0.1,1,0.05\\r\\n",                   -- opacity floor, Windows line end
    ["runeui_layout_2.txt"] = "vitals:1,2,1.5,1,0.5,1.0,0.0\\n",
    ["runeui_layout_3.txt"] = "",
    ["runeui_profile.txt"] = "2\\n",
    ["runeui_mapzoom.txt"] = "64.000\\n",
    ["runeui_map.txt"] = "Map=1\\nNorth=1\\nMark=0\\nSmooth=0\\nNeutral=1\\nOre=1\\nHerbs=0\\nEssence=1\\nTrees=1\\nBogus=1\\n",
    ["runeui_menuart.txt"] = "frame=old\\ntrim=/Game/A.A|3|0,0,0,0|64,8|0|1,1,1,1\\n",
}
local lg = M.Legacy(files(old))
local l1 = lg and lg["layout 1"] or {}
check("legacy: a full line", same(l1.vitals, { x = -699, y = -907, scale = 0.9, visible = 1, opacity = 1, edgex = 0.5, edgey = 1 }))
check("legacy: all 8 fields, opacity rounded, wait clamped", same(l1.immersive, { x = 12.5, y = -3, scale = 1, visible = 0, opacity = 0.7, edgex = 0, edgey = 0, wait = 30 }))
check("legacy: an old 4-field line", same(l1.avatar, { x = -4000, y = 10, scale = 4, visible = 1, opacity = 1 }))
check("legacy: a bad line skipped", l1.bars == nil)
check("legacy: opacity floor and a Windows line end", same(l1.compass, { x = 1, y = 2, scale = 0.3, visible = 1, opacity = 0.2 }))
check("legacy: profile 2 and 3", same(lg["layout 2"].vitals, { x = 1, y = 2, scale = 1.5, visible = 1, opacity = 0.5, edgex = 1, edgey = 0 }) and same(lg["layout 3"], {}))
check("legacy: the profile in use", lg.general.profile == 2)
check("legacy: zoom clamped", lg.map.zoom == 32)
check("legacy: map settings as 1 and 0, unknown keys dropped", lg.map.Map == 1 and lg.map.North == 1 and lg.map.Mark == 0 and
    lg.map.Neutral == 1 and lg.map.Herbs == 0 and lg.map.Trees == 1 and lg.map.Bogus == nil)
check("legacy: the old menu art file is not read", lg.menuart == nil)
check("legacy: round trips through the new format", same(M.Parse(M.Format(lg)), lg))
local wait = M.Legacy(files({ ["runeui_layout.txt"] = "immersive:0,0,1,1,1,0,0,1.4\\n" }))
check("legacy: a low wait clamps to 3", wait["layout 1"].immersive.wait == 3)

check("legacy: nil with no old files", M.Legacy(files({})) == nil)
local hud = M.Legacy(files({ ["hudeditor_layout_v2.txt"] = "vitals:10,20,1,1\\n", ["hudeditor_mapzoom.txt"] = "abc\\n",
    ["hudeditor_menuart.txt"] = "trim=x|1\\n", ["runeui_profile.txt"] = "7\\n" }))
check("legacy: falls back to the hudeditor layout", hud and same(hud["layout 1"].vitals, { x = 10, y = 20, scale = 1, visible = 1, opacity = 1 }))
check("legacy: hudeditor zoom, a bad number gives 2", hud and hud.map.zoom == 2)
check("legacy: a profile out of range is 1", hud and hud.general.profile == 1)
local both = M.Legacy(files({ ["runeui_layout.txt"] = "vitals:1,1,1,1\\n", ["hudeditor_layout_v2.txt"] = "vitals:9,9,1,1\\n" }))
check("legacy: the new file wins over the hudeditor one", both["layout 1"].vitals.x == 1)
check("legacy: the hudeditor layout is only profile 1's fallback", M.Legacy(files({ ["hudeditor_layout_v2.txt"] = "" }))["layout 2"] == nil)

-- Load and Save against files in memory; renameFails mimics Windows, where os.rename does not replace a file
local disk, renameFails = {}, false
io.open = function(name, mode)
    if mode == "r" then
        if disk[name] == nil then return nil end
        return { read = function() return disk[name] end, close = function() end }
    end
    local buf = {}
    return { write = function(self, s) buf[#buf + 1] = s return self end, close = function() disk[name] = table.concat(buf) end }
end
os.rename = function(a, b)
    if disk[a] == nil or (renameFails and disk[b] ~= nil) then return nil, "exists" end
    disk[b], disk[a] = disk[a], nil
    return true
end
os.remove = function(a) if disk[a] == nil then return nil end disk[a] = nil return true end
check("load: nil without the file", M.Load() == nil)
check("save: ok", M.Save(t) == true and disk["runeui.txt"] == M.Format(t) and disk["runeui.txt.tmp"] == nil)
check("load: what was saved", same(M.Load(), t))
renameFails = true
t.general.profile = 3
check("save: over an existing file when rename does not replace", M.Save(t) == true and M.Load().general.profile == 3 and disk["runeui.txt.tmp"] == nil)
os.rename = function() return nil, "denied" end
t.general.profile = 2
check("save: a direct write when rename fails", M.Save(t) == true and M.Load().general.profile == 2 and disk["runeui.txt.tmp"] == nil)
disk = { ["runeui.txt.tmp"] = "[general]\\nprofile=3\\n" }
check("load: a save cut off before the rename", M.Load().general.profile == 3)
check("save: another path and a row order", M.Save(t, "x.txt", { "vitals", "immersive" }) and disk["x.txt"] == M.Format(t, { "vitals", "immersive" }))
-- the old file is removed, then neither the rename nor the direct write works: the player still has the new settings in the .tmp file
disk = { ["runeui.txt"] = "[general]\\nprofile=1\\n" }
local openOk = io.open
io.open = function(name, mode) if mode ~= "r" and name == "runeui.txt" then return nil end return openOk(name, mode) end
t.general.profile = 3
check("save: false when the rename and the direct write fail", M.Save(t) == false)
check("save: ... and the player still has a settings file, the new one", M.Load() ~= nil and M.Load().general.profile == 3)
io.open = openOk
io.open = function() return nil end
check("save: false when nothing can be written", M.Save(t) == false)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
if fails > 0 then error("tests failed") end
`;
if (lauxlib.luaL_dostring(L, to_luastring(require('./fake-runemap'))) !== lua.LUA_OK) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== lua.LUA_OK) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }

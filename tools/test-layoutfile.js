// Tests the layout file of F9 (layoutfile.lua with profiles.lua's Prof.Export and Prof.Import and settings.lua) without the game:
// the export reads back the same, a file from outside is checked (unknown parts and fields, text, numbers out of range, a
// file that is no layout, a file over 64 KB), the old layout goes to the backup before the profile is replaced, and a
// backup that cannot be written changes nothing, and U picks the folder of the file (the Desktop, OneDrive's Desktop, the game
// folder, an own folder). The files are in memory: fengari has no io.open.
// Needs npm install once. Run: node tools/test-layoutfile.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

const test = String.raw`
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end
local Real = load(SETTINGS)()
-- the disk: files in memory, as in test-settings.js. FailPath is a file that cannot be written (nor its .tmp).
local disk, FailPath, folders = {}, nil, {}
io.open = function(name, mode)
    if mode == "r" then
        if folders[name] then return nil, name .. ": Permission denied", 13 end   -- as Windows answers for a folder
        if disk[name] == nil then return nil, name .. ": No such file or directory", 2 end
        return { read = function(self, n)
            if type(n) ~= "number" then return disk[name] end
            if disk[name] == "" then return nil end   -- a read of some bytes at the end of a file gives nil
            return string.sub(disk[name], 1, n)
        end, close = function() end }
    end
    if FailPath and (name == FailPath or name == FailPath .. ".tmp") then return nil end
    local buf = {}
    return { write = function(self, s) buf[#buf + 1] = s return self end, close = function() disk[name] = table.concat(buf) end }
end
os.rename = function(a, b) if disk[a] == nil then return nil end disk[b], disk[a] = disk[a], nil return true end
os.remove = function(a) if disk[a] == nil then return nil end disk[a] = nil return true end
local function write(p, text) disk[p] = text end
local function slurp(p) return disk[p] end
local function count(s, pat) local n = 0 for _ in string.gmatch(s, pat) do n = n + 1 end return n end

local Settings = setmetatable({}, { __index = Real })

local function Element(id) return { Id = id, Instances = {}, Keys = {}, Last = {} } end
local bars, late, extra = Element("bars"), Element("late"), Element("extra")
late.Wait = 8
local Elements = { bars, late, extra }
local Defaults = { bars = { X = 10, Scale = 0.9 }, late = { Visible = false, Wait = 8, Y = 140 }, extra = { X = -50, Y = 60 } }
local Layout = { Third = function(v) return v end, Retarget = function() end, TargetFromSpot = function(E) E.TX, E.TY = 0.5, 0.5 end }
local cfg = {
    general = { profile = 1, layoutfolder = "game" },   -- the game folder: a bare file name (the places are tested at the end)
    ["layout 1"] = {
        bars = { x = 500, y = 20, scale = 1.5, visible = 1, opacity = 0.5, edgex = 1, edgey = 0 },
        late = { x = 30, y = 40, scale = 2, visible = 1, opacity = 0.8, edgex = 0, edgey = 0, wait = 20 },
        extra = { x = 7, y = 8, scale = 1.1, visible = 0, opacity = 0.9, edgex = 0.5, edgey = 0.5 },
    },
    map = { zoom = 3 },
    keys = { editor = "F9" },
}
Settings.Load = function() return cfg end
local LayoutFile = load(LAYOUTFILE)()
LayoutFile.Init({ Settings = Settings, Elements = Elements })
local P = load(PROFILES)()
P.Init({ Log = function() end, VERSION = "test", Elements = Elements, Settings = Settings, Layout = Layout, Defaults = Defaults,
    LayoutFile = LayoutFile })
P.LoadLayout()
local Prof = P.Prof
local FILE, BACKUP = "runeui-layout.txt", "runeui-layout-backup.txt"

local function settled() return Prof.SayUntil > os.clock() end
local function layout()   -- what the three elements hold now
    return table.concat({ bars.X, bars.Y, bars.Scale, tostring(bars.Visible), bars.Opacity, late.X, late.Y, late.Scale, tostring(late.Visible),
        late.Opacity, late.Wait, extra.X, extra.Y, extra.Scale, tostring(extra.Visible) }, "|")
end

-- ---- export
local before = layout()
Prof.Export()
local text = slurp(FILE)
check("export: the file is written", text ~= nil)
check("export: it opens with its own comment line, which says how to load it", string.match(text, "^# Rune UI layout%.[^\n\r]*press I to load it%.") ~= nil)
check("export: one section, [layout], and nothing else of runeui.txt", count(text, "%[[^%]]+%]") == 1 and string.find(text, "[layout]", 1, true) ~= nil
    and not string.find(text, "general", 1, true) and not string.find(text, "zoom", 1, true) and not string.find(text, "editor", 1, true))
check("export: the rows come in the order of the element list", string.find(text, "bars:", 1, true) < string.find(text, "late:", 1, true)
    and string.find(text, "late:", 1, true) < string.find(text, "extra:", 1, true))
check("export: a row holds the fields of a profile, wait included", string.find(text, "late: x=30 y=40 scale=2 visible=1 opacity=0.8 edgex=0 edgey=0 wait=20", 1, true) ~= nil)
check("export: a part without a wait has none", string.find(text, "bars: x=500 y=20 scale=1.5 visible=1 opacity=0.5 edgex=1 edgey=0\n", 1, true) ~= nil)
check("export: the message says so, in gold, for 5 seconds", Prof.Say == "Profile 1 saved to the game folder (Win64):\nruneui-layout.txt" and Prof.SayTone == "gold" and settled()
    and Prof.SayUntil - os.clock() <= 5)
check("export: it changes nothing on the screen", layout() == before)

-- unsaved edits of F9 are in the file: the layout is saved first
bars.X, bars.Moved = 123, true
Prof.Export()
check("export: an edit that was not saved yet is in the file", string.find(slurp(FILE), "bars: x=123 ", 1, true) ~= nil)
bars.X, bars.Moved = 500, false
Prof.Export()

-- ---- round trip
local saved = layout()
bars.X, bars.Y, late.Visible, extra.Scale = -1, -2, false, 3.5
Prof.Import()
check("round trip: the file brings the layout back", layout() == saved)
check("round trip: the message says so, in gold", Prof.Say == "Profile 1 imported from the game folder.\nOld layout saved in runeui-layout-backup.txt" and Prof.SayTone == "gold")
check("round trip: runeui.txt keeps the imported rows", cfg["layout 1"].bars.x == 500 and cfg["layout 1"].late.wait == 20)
local ini = slurp("runeui.txt")
check("round trip: runeui.txt is saved at once, and the rest of it is as it was", string.find(ini, "bars: x=500 ", 1, true) ~= nil and string.find(ini, "zoom=3", 1, true) ~= nil)

-- ---- the backup: the layout that was replaced, written before it was replaced
local backup = slurp(BACKUP)
check("backup: it holds the old layout", backup ~= nil and string.find(backup, "bars: x=-1 y=-2 ", 1, true) ~= nil and string.find(backup, "extra: x=7 y=8 scale=3.5 ", 1, true) ~= nil)
check("backup: it is a layout file, the same as an export", string.find(backup, "^# Rune UI layout%.") ~= nil and count(backup, "%[[^%]]+%]") == 1)
local order = {}
local Watched = setmetatable({ Save = function(t, p, o, h)
    if p == BACKUP then order[#order + 1] = "backup, profile still " .. (cfg["layout 1"].bars.x) end
    return Settings.Save(t, p, o, h)
end }, { __index = Settings })
LayoutFile.Init({ Settings = Watched, Elements = Elements })
bars.X = 777
Prof.Import()
check("backup: it is written while the profile still holds the old layout", order[1] == "backup, profile still 777")
check("backup: one file, replaced by the next import", string.find(slurp(BACKUP), "bars: x=777 ", 1, true) ~= nil)
LayoutFile.Init({ Settings = Settings, Elements = Elements })
-- the backup can be renamed and imported back
write(FILE, slurp(BACKUP))
Prof.Import()
check("backup: renamed to runeui-layout.txt, it imports back", bars.X == 777 and Prof.SayTone == "gold")
bars.X = 500
Prof.Export()

-- ---- a file from outside
local function import(body)
    write(FILE, body)
    local was, was_cfg, was_ini = layout(), slurp("runeui.txt"), cfg["layout 1"]
    os.remove(BACKUP)
    Prof.Say, Prof.SayTone, Prof.SayUntil = "", "", 0
    Prof.Import()
    return was == layout() and was_ini == cfg["layout 1"] and was_cfg == slurp("runeui.txt") and slurp(BACKUP) == nil
end
local NO_LAYOUT = "runeui-layout.txt holds no Rune UI layout.\nNothing changed."
check("refused: an empty file", import("") and Prof.Say == NO_LAYOUT and Prof.SayTone == "warn")
check("refused: junk lines", import("hello\n\n???\nbars x=5\n====\n:::\n") and Prof.Say == NO_LAYOUT)
check("refused: no [layout] section (a copy of runeui.txt)", import("[layout 1]\nbars: x=5 y=5 scale=1\n[general]\nprofile=2\n") and Prof.Say == NO_LAYOUT)
check("refused: a [layout] section with no row", import("[layout]\nzoom=2\nbars=5\n") and Prof.Say == NO_LAYOUT)
check("refused: rows of parts that do not exist, and rows with no usable value", import("[layout]\nghost: x=5 y=5\nbars: x=abc y=\nlate:\n") and Prof.Say == NO_LAYOUT)
local ok = "[layout]\nbars: x=5 y=6 scale=1 visible=1 opacity=1\n"
check("refused: a good layout in a file over 64 KB", import(ok .. string.rep("# padding padding padding padding\n", 2000)) and Prof.Say == NO_LAYOUT)
check("a file of 60 KB is read", not import(ok .. "#" .. string.rep("x", 60000) .. "\n") and Prof.SayTone == "gold" and bars.X == 5)
os.remove(FILE)
os.remove(BACKUP)
Prof.Say, Prof.SayTone, Prof.SayUntil = "", "", 0
local was = layout()
Prof.Import()
check("no file: nothing changes, and it says so", layout() == was and Prof.Say == "No runeui-layout.txt in the game folder.\nNothing changed." and Prof.SayTone == "warn" and slurp(BACKUP) == nil)

-- ---- what is taken from a file
bars.X = 500
P.SaveLayout()
-- a row of a part that this version does not have (one from another version of the mod)
cfg["layout 1"].future = { x = 9, y = 8, scale = 1, visible = 0, opacity = 1 }
write(FILE, [[
# a file from the Nexus page
[layout]
bars: x=-30 y=44 scale=1.25 visible=1 opacity=0.7 edgex=0 edgey=1 hack=9 wait=11 color=red
late: x=bad y=77 scale=nan visible=yes opacity=0.5 edgex= edgey=0 wait=12
ghost: x=1 y=1 scale=1 visible=1 opacity=1
__index: x=1
extra=5
]])
Prof.Import()
check("taken: the known fields of a known part", bars.X == -30 and bars.Y == 44 and bars.Scale == 1.25 and bars.Opacity == 0.7 and bars.TX == 0 and bars.TY == 1)
check("taken: a field that is not a number is dropped, the rest of the row is kept", late.Y == 77 and late.Opacity == 0.5 and late.X == 0 and late.Scale == 1.0 and late.Wait == 12)
check("taken: a part that does not exist, and a field that is not one, are not kept", cfg["layout 1"].ghost == nil and cfg["layout 1"].__index == nil
    and cfg["layout 1"].bars.hack == nil and cfg["layout 1"].bars.color == nil and cfg["layout 1"].bars.wait == nil)
check("taken: a part the file has no row for gets its starting layout, not what it had", extra.X == -50 and extra.Y == 60 and extra.Scale == 1.0 and extra.Visible == true and extra.Opacity == 1.0)
check("taken: the file's part with no wait is a part without a wait", cfg["layout 1"].late.wait == 12)
check("taken: the old layout is in the backup", string.find(slurp(BACKUP), "bars: x=500 ", 1, true) ~= nil)
check("kept: the profile's row of a part this version does not have", cfg["layout 1"].future ~= nil and cfg["layout 1"].future.x == 9)

-- ---- numbers out of range end clamped, on the screen and in runeui.txt
write(FILE, "[layout]\nbars: x=99999 y=-99999 scale=50 visible=7 opacity=9 edgex=5 edgey=-5 wait=999\nlate: x=1e999 y=-1e999 scale=0 visible=-3 opacity=0 edgex=0.3 edgey=2 wait=1\nextra: scale=0.001 opacity=-4\n")
Prof.Import()
check("clamped: x, y, size and opacity", bars.X == 4000 and bars.Y == -4000 and bars.Scale == 4.0 and bars.Opacity == 1.0)
check("clamped: the edges", bars.TX == 1 and bars.TY == 0)
check("clamped: visible is a switch", bars.Visible == true and late.Visible == false)
check("clamped: a number that is not finite is dropped", late.X == 0 and late.Y == 0)
check("clamped: wait is 3 to 30 s", late.Wait == 3)
check("clamped: the smallest size and the lowest opacity", late.Scale == 0.3 and late.Opacity == 0.2 and extra.Scale == 0.3 and extra.Opacity == 0.2)
local rows = cfg["layout 1"]
check("clamped: the saved rows hold the clamped numbers too", rows.bars.x == 4000 and rows.bars.scale == 4 and rows.bars.opacity == 1 and rows.late.wait == 3 and rows.extra.scale == 0.3)
local ini2 = slurp("runeui.txt")
check("clamped: runeui.txt does not keep a number out of range", not string.find(ini2, "99999", 1, true) and not string.find(ini2, "inf", 1, true))

-- ---- a backup that cannot be written changes nothing
write(FILE, "[layout]\nbars: x=1 y=2 scale=1 visible=1 opacity=1\n")
local before2, iniBefore, rowsBefore = layout(), slurp("runeui.txt"), cfg["layout 1"]
FailPath = BACKUP
Prof.Import()
check("backup failed: the layout stays", layout() == before2 and cfg["layout 1"] == rowsBefore and slurp("runeui.txt") == iniBefore)
check("backup failed: it says so, in orange", Prof.Say == "Could not write runeui-layout-backup.txt.\nNothing changed." and Prof.SayTone == "warn")
FailPath = FILE
local fileBefore = slurp(FILE)
Prof.Export()
check("export failed: it says so, in orange", Prof.Say == "Could not write runeui-layout.txt\nin the game folder." and Prof.SayTone == "warn" and slurp(FILE) == fileBefore)
FailPath = nil

-- ---- the line in the panel
Prof.Export()
check("say: another profile has no line about the one before", (function() Prof.Next() return Prof.SayUntil == 0 end)())
check("say: every line fits the two lines that the panel keeps for a hint (two lines of 46 characters, test-hints.js)", (function()
    for _, key in ipairs({ "placed", "exported", "exportFailed", "imported", "noFile", "badFile", "backupFailed" }) do
        for _, place in ipairs({ "desktop", "game", "own" }) do
            local s = LayoutFile.Say(key, 1, place, "D:\\" .. string.rep("x", 80) .. "\\")
            if count(s, "\n") > 1 then return false end
            for line in string.gmatch(s .. "\n", "([^\n]*)\n") do if #line > 44 then return false end end   -- 6.6 units a letter, 404 units of room
        end
    end
    return true
end)())
check("say: profile numbers",(function() local s = LayoutFile.Say("imported", 3, "desktop") return s == "Profile 3 imported from the Desktop.\nOld layout saved in runeui-layout-backup.txt" end)())

-- ---- the place of the file: U picks it, [general] keeps it
local env = {}
os.getenv = function(k) return env[k] end
local function G(t) return t end
check("place: a file without the line is the Desktop", LayoutFile.Current(G({})) == "desktop" and LayoutFile.Label(G({})) == "Desktop")
check("place: game and junk", LayoutFile.Label(G({ layoutfolder = "game" })) == "Game folder" and LayoutFile.Current(G({ layoutfolder = "C:\\x" })) == "desktop"
    and LayoutFile.Current(G({ layoutfolder = 5 })) == "desktop")
check("place: own only with a path written", LayoutFile.Current(G({ layoutfolder = "own" })) == "desktop"
    and LayoutFile.Current(G({ layoutfolder = "own", layoutpath = "   " })) == "desktop"
    and LayoutFile.Label(G({ layoutfolder = "own", layoutpath = "D:\\Layouts" })) == "Own folder")
local function cycle(g) local seen = {} for i = 1, 4 do LayoutFile.NextPlace(g) seen[i] = g.layoutfolder end return table.concat(seen, " ") end
check("U: Desktop, game folder, and back, with no own path", cycle({}) == "game desktop game desktop")
check("U: Desktop, game folder, own folder, and back, with an own path", cycle({ layoutpath = "D:\\L" }) == "game own desktop game")

env.USERPROFILE = "C:\\Users\\A"
local p, d = LayoutFile.Place({})
check("folder: the Desktop in the user folder", p == "desktop" and d == "C:\\Users\\A\\Desktop\\")
env.OneDrive = "C:\\Users\\A\\OneDrive"
p, d = LayoutFile.Place({})
check("folder: OneDrive without a Desktop folder: the one in the user folder", d == "C:\\Users\\A\\Desktop\\")
folders["C:\\Users\\A\\OneDrive\\Desktop"] = true
p, d = LayoutFile.Place({})
check("folder: OneDrive's Desktop when it has one", p == "desktop" and d == "C:\\Users\\A\\OneDrive\\Desktop\\")
write("C:\\Users\\A\\OneDrive\\Desktop", "a file, not a folder")
folders["C:\\Users\\A\\OneDrive\\Desktop"] = nil
p, d = LayoutFile.Place({})
check("folder: a file of that name is not a folder", d == "C:\\Users\\A\\Desktop\\")
env.USERPROFILE, env.OneDrive = nil, nil
p, d = LayoutFile.Place({})
check("folder: no Desktop to be found: the game folder", p == "game" and d == "")
env.USERPROFILE = "C:\\Users\\A"
p, d = LayoutFile.Place({ layoutfolder = "own", layoutpath = "  D:\\My Layouts\\ " })
check("folder: an own path, trimmed, with one backslash at the end", p == "own" and d == "D:\\My Layouts\\")
p, d = LayoutFile.Place({ layoutfolder = "own", layoutpath = "D:/Games/" })
check("folder: an own path with forward slashes", d == "D:/Games\\")
check("say: an own folder is named, its end when it is long", LayoutFile.Say("placed", 1, "own", "D:\\L\\") == "Layout files go to your own folder:\nD:\\L"
    and LayoutFile.Say("placed", 1, "own", "D:\\" .. string.rep("x", 60) .. "\\") == "Layout files go to your own folder:\n..." .. string.rep("x", 41))

-- O, I and U with the Desktop
local DESK = "C:\\Users\\A\\Desktop\\"
cfg.general.layoutfolder = nil
bars.X = 321
Prof.Export()
check("Desktop: O writes there, and says so", string.find(slurp(DESK .. FILE) or "", "bars: x=321 ", 1, true) ~= nil
    and Prof.Say == "Profile " .. Prof.N .. " saved to the Desktop:\nruneui-layout.txt" and Prof.SayTone == "gold")
bars.X = 1
Prof.Import()
check("Desktop: I reads there, and the backup goes there too", bars.X == 321 and string.find(slurp(DESK .. BACKUP) or "", "bars: x=1 ", 1, true) ~= nil
    and Prof.Say == "Profile " .. Prof.N .. " imported from the Desktop.\nOld layout saved in runeui-layout-backup.txt")
os.remove(DESK .. FILE)
Prof.Import()
check("Desktop: no file there", Prof.Say == "No runeui-layout.txt on the Desktop.\nNothing changed." and Prof.SayTone == "warn")
Prof.NextPlace()
check("U: the next place, kept in runeui.txt at once", cfg.general.layoutfolder == "game" and string.find(slurp("runeui.txt"), "layoutfolder=game", 1, true) ~= nil
    and Prof.Say == "Layout files go to the game folder (Win64)." and Prof.SayTone == "gold" and Prof.PlaceLabel() == "Game folder")
local back = Settings.Parse(slurp("runeui.txt")).general
check("U: runeui.txt reads back the place and an own path", (function()
    cfg.general.layoutpath = "D:\\My Layouts"
    Prof.NextPlace()
    local g = Settings.Parse(slurp("runeui.txt")).general
    return g.layoutfolder == "own" and g.layoutpath == "D:\\My Layouts" and LayoutFile.Current(g) == "own"
end)() and back.layoutfolder == "game")

-- ---- the key flags: a key bind only sets them, so they exist from the start
check("flags: set from the start, never nil", Prof.PlaceWanted == false and Prof.ExportWanted == false and Prof.ImportWanted == false)

-- ---- settings.lua: the header and the limit of a read
check("format: its own header", string.sub(Real.Format({ layout = {} }, nil, "# mine\n"), 1, 7) == "# mine\n" and string.sub(Real.Format({}), 1, 15) == "# Rune UI setti")
write("big.txt", string.rep("a", 100))
check("read: a limit", #Real.ReadFile("big.txt", 10) == 10 and #Real.ReadFile("big.txt") == 100)
write("none.txt", "")
check("read: an empty file is an empty text, a missing file nil", Real.ReadFile("none.txt", 10) == "" and Real.ReadFile("gone.txt", 10) == nil)

print(fails == 0 and "all passed" or (fails .. " failed"))
if fails > 0 then error("failed") end
`;
const set = (name, file) => { lua.lua_pushstring(L, to_luastring(read(file))); lua.lua_setglobal(L, to_luastring(name)); };
set('SETTINGS', 'settings.lua'); set('PROFILES', 'profiles.lua'); set('LAYOUTFILE', 'layoutfile.lua');
if (lauxlib.luaL_loadstring(L, to_luastring(test)) !== 0) { console.log(lua.lua_tojsstring(L, -1)); process.exit(1); }
const status = lua.lua_pcall(L, 0, 0, 0);
if (status !== 0) { console.log(lua.lua_tojsstring(L, -1)); process.exit(1); }

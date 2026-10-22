-- The settings file in memory (Cfg), the three layout profiles, and the loading and saving of the layout of the profile
-- in use. settings.lua reads and writes the file itself. main.lua loads this file, calls Init once, then LoadLayout, and
-- the step and the Mod Menu rows call SaveLayout and Prof.Next. The step also calls Prof.NextPlace, Prof.Export and Prof.Import, the layout file
-- of F9 (layoutfile.lua).

local M = {}

-- From main.lua (Init): the log, the version for the file, the element list and its starting layout, settings.lua and layout.lua's names.
local Log, VERSION, Elements, Defaults, Settings, LayoutFile, Third, Retarget, TargetFromSpot
local Cfg
local ElementIds = {}   -- the order of the rows in the file: the element list

-- The profiles: three layouts, F7 goes to the next while the editor is open. Profile 1 is the layout every
-- older version wrote, so no player loses a layout. N: the profile in use. Wanted: F7 sets it on UE4SS's thread,
-- and the step switches. PlaceWanted, ExportWanted and ImportWanted: U, O and I do the same for the layout file. Say, SayTone and SayUntil: the line
-- that the F9 panel shows in place of its hint after U, O or I (tone "gold" or "warn", until os.clock reaches SayUntil).
local Prof = { N = 1, Wanted = false, PlaceWanted = false, ExportWanted = false, ImportWanted = false, Say = "", SayTone = "", SayUntil = 0 }
M.Prof = Prof

-- One file, runeui.txt, next to the game: the three layout profiles, the profile in use, the map settings and
-- the zoom, the camera settings, and the keys. Named values, so a player can read and edit it, and a new
-- version never breaks an old file. The files of older versions are read once, when runeui.txt is missing, and are
-- left in place.
function M.Init(ctx)
    Log, VERSION, Elements, Defaults, Settings = ctx.Log, ctx.VERSION, ctx.Elements, ctx.Defaults, ctx.Settings
    LayoutFile = ctx.LayoutFile
    Third, Retarget, TargetFromSpot = ctx.Layout.Third, ctx.Layout.Retarget, ctx.Layout.TargetFromSpot
    local fresh = false
    Cfg = Settings.Load()
    if not Cfg then
        Cfg = Settings.Legacy(Settings.ReadFile)
        if Cfg then Log("settings: read from the files of an older version") else Cfg = {} fresh = true Log("no settings file yet, using defaults") end
    end
    Cfg.menuart = nil   -- the main menu's line under the bars, no longer used: dropped from old files
    M.Cfg = Cfg
    for _, E in ipairs(Elements) do ElementIds[#ElementIds + 1] = E.Id end
    local general = Settings.Section(Cfg, "general")
    Prof.N = math.floor(Settings.Num(general.profile, 1, 3, 1))
    -- f9hint: 0 until hint.lua has shown the F9 hint, then 1. A player who has the mod from before it never sees the hint,
    -- so a file without the line is marked at once; a fresh install keeps the 0 in memory, and the first save writes it.
    if general.f9hint == nil then
        general.f9hint = fresh and 0 or 1
        if not fresh then M.SaveCfg() end
    end
end

function M.SaveCfg()
    Settings.Section(Cfg, "general").version = VERSION
    if not Settings.Save(Cfg, nil, ElementIds) then Log("could not write " .. Settings.FILE) end
end

-- the layout of the profile in use, from the file; an element without a row (a part newer than the profile) gets its starting layout
local function LoadLayout()
    local rows = Cfg["layout " .. Prof.N]
    if not rows then Log("profile " .. Prof.N .. ": no saved layout, using defaults") return end
    local N = Settings.Num
    for _, E in ipairs(Elements) do
        local r = rows[E.Id]
        if type(r) == "table" then
            E.X, E.Y = N(r.x, -4000, 4000, 0), N(r.y, -4000, 4000, 0)
            E.Scale = N(r.scale, 0.3, 4.0, 1.0)
            E.Visible = E.NoHide or N(r.visible, 0, 1, 1) == 1
            E.Opacity = math.floor(N(r.opacity, 0.2, 1.0, 1.0) * 10 + 0.5) / 10
            -- the edge it follows; a row without it (an old file): from where it sits
            if r.edgex ~= nil and r.edgey ~= nil then E.TX, E.TY = Third(N(r.edgex, 0, 1, 0.5), 1), Third(N(r.edgey, 0, 1, 0.5), 1)
            else TargetFromSpot(E) end
            if E.Wait and r.wait ~= nil then E.Wait = math.floor(N(r.wait, 3, 30, E.Wait) + 0.5) end
            if E.OnlyY then E.X, E.Scale, E.TX = 0, 1.0, 1 end   -- a layout saved before it was OnlyY
        else
            local d = Defaults[E.Id] or {}
            E.X, E.Y, E.Scale, E.Visible, E.Opacity, E.Wait = d.X or 0, d.Y or 0, d.Scale or 1.0, d.Visible ~= false, 1.0, d.Wait
            TargetFromSpot(E)
        end
    end
    Log("layout loaded, profile " .. Prof.N)
end

local function SaveLayout()
    local rows = Settings.Section(Cfg, "layout " .. Prof.N)
    for _, E in ipairs(Elements) do
        if E.Moved then E.Moved = false if not E.Follows then Retarget(E) end end   -- a Follows element keeps its parent's edge
        rows[E.Id] = { x = E.X, y = E.Y, scale = E.Scale, visible = E.Visible and 1 or 0, opacity = E.Opacity,
            edgex = E.TX, edgey = E.TY, wait = E.Wait }
    end
    M.SaveCfg()
    Log("layout saved, profile " .. Prof.N)
end

-- the layout saved into the profile it came from, the next one loaded; a profile never used starts as a copy
function Prof.Next()
    SaveLayout()
    Prof.N = Prof.N % 3 + 1
    Settings.Section(Cfg, "general").profile = Prof.N
    Prof.SayUntil = 0   -- a line about the profile before is not about this one
    if Cfg["layout " .. Prof.N] then LoadLayout() else SaveLayout() end
    Log("profile " .. Prof.N)
end

local function Say(key, place, dir)
    Prof.Say, Prof.SayTone = LayoutFile.Say(key, Prof.N, place, dir)
    Prof.SayUntil = os.clock() + 5
end

local function General() return Settings.Section(Cfg, "general") end
-- the name of the place of the layout file, for the F9 legend
function Prof.PlaceLabel() return LayoutFile.Label(General()) end

-- U: the next place for the layout file, saved at once
function Prof.NextPlace()
    LayoutFile.NextPlace(General())
    M.SaveCfg()
    local place, dir = LayoutFile.Place(General())
    Log("layout file place: " .. place)
    Say("placed", place, dir)
end

-- O: the layout of the profile in use, with the edits not yet saved, into runeui-layout.txt
function Prof.Export()
    SaveLayout()
    local place, dir = LayoutFile.Place(General())
    local ok = LayoutFile.Write(Cfg["layout " .. Prof.N], dir .. LayoutFile.FILE)
    Log("layout file " .. (ok and "written" or "not written") .. ", profile " .. Prof.N .. ", " .. place)
    Say(ok and "exported" or "exportFailed", place)
end

-- I: runeui-layout.txt in place of the layout of the profile in use. The old layout goes to the backup file first; when
-- that cannot be written, nothing changes. A file with no usable row changes nothing. An element that the file has no row
-- for gets its starting layout (LoadLayout). LoadLayout puts every number into its range, and SaveLayout then writes the
-- layout as the elements hold it, so runeui.txt never keeps a number from the file that is out of range.
function Prof.Import()
    local place, dir = LayoutFile.Place(General())
    local rows, why = LayoutFile.Read(dir .. LayoutFile.FILE)
    if not rows then
        Log("layout file not used: " .. why .. ", " .. place)
        Say(why == "missing" and "noFile" or "badFile", place)
        return
    end
    SaveLayout()
    if not LayoutFile.Write(Cfg["layout " .. Prof.N], dir .. LayoutFile.BACKUP) then
        Log("layout file not used: the backup could not be written")
        Say("backupFailed")
        return
    end
    -- a row of a part that this version does not have stays: the file cannot hold it, and another version of the mod needs it
    local known = {}
    for _, id in ipairs(ElementIds) do known[id] = true end
    for id, row in pairs(Cfg["layout " .. Prof.N]) do if not known[id] then rows[id] = row end end
    Cfg["layout " .. Prof.N] = rows
    LoadLayout()
    SaveLayout()
    Log("layout file read, profile " .. Prof.N .. ", " .. place)
    Say("imported", place)
end

M.LoadLayout, M.SaveLayout = LoadLayout, SaveLayout
return M

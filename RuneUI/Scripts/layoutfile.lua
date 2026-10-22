-- The layout file: the layout of one profile in a file of its own, runeui-layout.txt, so a player can share it. F9 writes it
-- with O and reads it with I. The same named-value format as runeui.txt (settings.lua writes and reads it), one section,
-- [layout]. Pure Lua, no game calls, so tools/test-layoutfile.js runs it without the game. profiles.lua does the export
-- and the import; this file builds and checks what goes in and out. main.lua loads it and gives it its names (Init).

local M = {}
M.FILE, M.BACKUP = "runeui-layout.txt", "runeui-layout-backup.txt"
-- a layout is a few KB; a bigger file is not one, and is not read
local MAX_BYTES = 64 * 1024
local HEADER = "# Rune UI layout. Put this file on your Desktop (U in F9 picks another folder), open F9 in the game and press I to load it.\n"

-- The folder of the layout file and its backup: U in F9 picks it, [general] layoutfolder keeps it. desktop (the start),
-- game (Win64, where the game starts, so a bare file name) or own: the folder a player wrote by hand in [general] layoutpath.
M.PLACES = { "desktop", "game", "own" }
local LABEL = { desktop = "Desktop", game = "Game folder", own = "Own folder" }
local WORDS = {   -- the place in the messages: to, on and from it
    desktop = { to = "to the Desktop", on = "on the Desktop", from = "from the Desktop" },
    game = { to = "to the game folder (Win64)", on = "in the game folder", from = "from the game folder" },
    own = { to = "to your own folder", on = "in your own folder", from = "from your own folder" },
}

local function OwnPath(general)
    if type(general.layoutpath) ~= "string" then return "" end
    return (string.match(general.layoutpath, "^%s*(.-)[\\/%s]*$"))
end

-- the place in use, from the file alone (no disk): own only while a path is written
function M.Current(general)
    local p = general.layoutfolder
    if p == "own" and OwnPath(general) ~= "" then return "own" end
    if p == "game" then return "game" end
    return "desktop"
end
function M.Label(general) return LABEL[M.Current(general)] end

-- U: the next place; own is skipped while no path is written
function M.NextPlace(general)
    local i = 1
    for n, p in ipairs(M.PLACES) do if p == M.Current(general) then i = n end end
    repeat i = i % #M.PLACES + 1 until M.PLACES[i] ~= "own" or OwnPath(general) ~= ""
    general.layoutfolder = M.PLACES[i]
end

-- Windows does not open a folder as a file: it says "permission denied" (13), where a missing one is "no such file"
local function IsFolder(dir)
    local f, _, code = io.open(dir, "r")
    if f then f:close() return false end
    return code == 13
end

-- The Desktop, with a backslash at the end. OneDrive can move it into its own folder. Windows keeps the real place in the
-- registry, which Lua cannot read without starting a program, so OneDrive's Desktop when it exists, else the user's.
local function Desktop()
    local one = os.getenv("OneDrive")
    if one and one ~= "" and IsFolder(one .. "\\Desktop") then return one .. "\\Desktop\\" end
    local home = os.getenv("USERPROFILE")
    if home and home ~= "" then return home .. "\\Desktop\\" end
end

-- The place in use and its folder, as the start of a path ("" for the game folder). With no Desktop to be found, the game folder.
function M.Place(general)
    local p = M.Current(general)
    if p == "own" then return p, OwnPath(general) .. "\\" end
    if p == "desktop" then
        local d = Desktop()
        if d then return p, d end
    end
    return "game", ""
end

-- The line in the F9 panel after U, O or I: its colour and its text. {p}: the profile; {to}, {on}, {from}: the place.
local SAY = {
    placed = { "gold", "Layout files go {to}." },
    exported = { "gold", "Profile {p} saved {to}:\n" .. M.FILE },
    exportFailed = { "warn", "Could not write " .. M.FILE .. "\n{on}." },
    imported = { "gold", "Profile {p} imported {from}.\nOld layout saved in " .. M.BACKUP },
    noFile = { "warn", "No " .. M.FILE .. " {on}.\nNothing changed." },
    badFile = { "warn", M.FILE .. " holds no Rune UI layout.\nNothing changed." },
    backupFailed = { "warn", "Could not write " .. M.BACKUP .. ".\nNothing changed." },
}
-- dir: the folder; the line of U names an own folder (its end, when it is longer than a line)
function M.Say(key, profile, place, dir)
    local s, w = SAY[key], WORDS[place]
    local text = string.gsub(s[2], "{(%a+)}", function(k) return k == "p" and tostring(profile) or w[k] end)
    if key == "placed" and place == "own" then
        local d = string.sub(dir, 1, -2)
        if #d > 44 then d = "..." .. string.sub(d, -41) end
        text = "Layout files go to your own folder:\n" .. d
    end
    return text, s[1]
end

-- From main.lua (Init): settings.lua, and the element list; its ids are the only rows a layout file may hold.
local Settings, Known, Order
function M.Init(ctx)
    Settings, Known, Order = ctx.Settings, {}, {}
    for _, E in ipairs(ctx.Elements) do Known[E.Id] = true Order[#Order + 1] = E.Id end
end

-- The rows as the file keeps them, and how many there are: a known element, the known fields, numbers only. A file
-- comes from outside, so anything else is dropped here. A number that is not finite (1e999) goes too: x - x is 0 only
-- for a finite x. LoadLayout (profiles.lua) puts every field into its range.
local function Clean(rows)
    local out, count = {}, 0
    if type(rows) ~= "table" then return out, 0 end
    for id, row in pairs(rows) do
        if Known[id] and type(row) == "table" then
            local r, any = {}, false
            for _, f in ipairs(Settings.FIELDS) do
                local v = row[f]
                if type(v) == "number" and v - v == 0 then r[f] = v any = true end
            end
            if any then out[id] = r count = count + 1 end
        end
    end
    return out, count
end

-- rows (the rows of a profile, as Cfg holds them) to a file; false when the write failed
function M.Write(rows, path)
    return Settings.Save({ layout = (Clean(rows)) }, path, Order, HEADER)
end

-- The rows of a layout file, or nil and why: "missing" when there is no file, "bad" when it is too big, has no
-- [layout] section or holds no row that is usable.
function M.Read(path)
    local text = Settings.ReadFile(path, MAX_BYTES + 1)
    if text == nil then return nil, "missing" end
    if #text > MAX_BYTES then return nil, "bad" end
    local rows, count = Clean(Settings.Parse(text).layout)
    if count == 0 then return nil, "bad" end
    return rows
end

return M

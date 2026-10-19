-- The immersive camera: its settings and its rules, and the Immersive mode panel (F6), which also holds the two rows of
-- the immersive mode itself. Pure Lua, no game calls, so tools/test-camera.js runs it without the game. camera.lua reads
-- the game and writes what Step gives back; crosshair.lua asks CrosshairHides; main.lua draws the panel from View and
-- saves through Attach.
-- The camera has its own switch and works with or without the immersive mode. Off, the game's camera.
-- The views: walking close with the character on the left, a sprint far, and a fight's distance held a while after it
-- ends (the game's combat switch drops the moment the enemy dies). The walk distance holds with a tool, empty hands or a
-- weapon out of a fight; a fight changes it, closer with a melee weapon, farther while a ranged weapon aims or casts. A
-- staff is the exception: the game shows the magic reticle all the time a staff is in the hand, so a staff in the hand
-- gives the ranged view (seen in the game, 06-10-2026). A sprint's view wins over every other but a melee fight.
-- The camera glides to each new distance (Glide, GlideAt): game 1.0.1 no longer blends its camera profiles, so the
-- mod moves the camera arm itself (probes of 15-10-2026). 0.6 s is about the game's own blend before 1.0.1.
local M = {}

-- the camera's rows in the panel, in Mod Menu (camera_<Key>) and in the [camera] section of runeui.txt, in this order.
-- Distances in the game's units, which are cm.
M.ROWS = {
    -- "Aim only" was "Hide" in older files: an old file or Mod Menu value reads as "Aim only" (Old)
    { Key = "crosshair", Label = "Crosshair", Kind = "choice", Options = { "Show", "Aim + tools", "Aim only", "Nothing" }, Default = "Show",
        Old = { hide = "Aim only" } },
    { Key = "on", Label = "Immersive camera", Kind = "switch", Default = false },
    { Key = "walk", Label = "Walk distance", Kind = "number", Min = 100, Max = 1500, Step = 25, Unit = "cm", Default = 300 },
    { Key = "side", Label = "Side offset", Kind = "number", Min = 0, Max = 200, Step = 10, Unit = "cm", Default = 90 },
    { Key = "sprint", Label = "Sprint distance", Kind = "number", Min = 100, Max = 1500, Step = 25, Unit = "cm", Default = 900 },
    { Key = "melee", Label = "Melee distance", Kind = "number", Min = 100, Max = 1500, Step = 25, Unit = "cm", Default = 200 },
    { Key = "ranged", Label = "Ranged distance", Kind = "number", Min = 100, Max = 1500, Step = 25, Unit = "cm", Default = 500 },
    { Key = "hold", Label = "Hold after a fight", Kind = "number", Min = 0, Max = 30, Step = 1, Unit = "s", Default = 8 },
}
local BY_KEY = {}
for _, r in ipairs(M.ROWS) do BY_KEY[r.Key] = r end

-- The two rows of the immersive mode itself, first in the panel. They are not in ROWS: their values live in the layout,
-- so each profile has its own and a file of an older version keeps them. Field: the field of Mode that holds the value.
local MODE_ROWS = {
    { Key = "immersive", Label = "Immersive mode", Kind = "switch", Field = "Visible" },
    { Key = "wait", Label = "Wait before the fade", Kind = "number", Min = 3, Max = 30, Step = 1, Unit = "s", Field = "Wait" },
}
-- Mode: the layout's immersive element. ModeDefault: its starting values. main.lua gives both (AttachMode); these
-- stand in until then, and in the tests.
M.Mode, M.ModeDefault = { Visible = false, Wait = 8 }, { Visible = false, Wait = 8 }
function M.AttachMode(element, default) M.Mode, M.ModeDefault = element, default end
-- the rows of the panel in its order, and the group title above a row
M.PANEL = {}
for _, r in ipairs(MODE_ROWS) do M.PANEL[#M.PANEL + 1] = r end
for _, r in ipairs(M.ROWS) do M.PANEL[#M.PANEL + 1] = r end
local HEADS = { immersive = "Immersive mode", on = "Immersive camera" }

-- The panel's state and the key flags. Key handlers run on UE4SS's own thread: they only change these and the
-- numbers in Set and in Mode, never add a key (false, never nil), and the step saves (Commit). LayoutDirty: a mode row
-- changed, and main.lua saves the layout.
M.Open, M.Sel, M.Dirty, M.ResetWanted, M.LayoutDirty = false, 1, false, false, false
M.Set = {}
for _, r in ipairs(M.ROWS) do M.Set[r.Key] = r.Default end
M.Store, M.Save = {}, function() end

local function Snap(r, v)
    v = tonumber(v)
    if not v or v ~= v then return r.Default end
    v = math.max(r.Min, math.min(r.Max, v))
    return math.floor((v - r.Min) / r.Step + 0.5) * r.Step + r.Min
end

local function Choice(r, v)
    local low = string.lower(tostring(v))
    for _, o in ipairs(r.Options) do if low == string.lower(o) then return o end end
    if r.Old and r.Old[low] then return r.Old[low] end
    return r.Default
end

-- one value from the file or from Mod Menu, made right; a value that is missing or bad gives the default
local function Clean(r, v)
    if v == nil then return r.Default end
    if r.Kind == "switch" then return v == true or tonumber(v) == 1 end
    if r.Kind == "number" then return Snap(r, v) end
    return Choice(r, v)
end

-- store: the [camera] section of runeui.txt; save writes the file. Called once at start.
function M.Attach(store, save)
    M.Store, M.Save = store, save
    for _, r in ipairs(M.ROWS) do M.Set[r.Key] = Clean(r, store[r.Key]) end
end

-- the settings into the section, as the file writes them: a switch as 1 and 0, a choice as its word. A line of a row
-- that is gone (zoomease and returnease of older files) leaves the file at the next save.
function M.Write(store)
    for k in pairs(store) do if not BY_KEY[k] then store[k] = nil end end
    for _, r in ipairs(M.ROWS) do
        local v = M.Set[r.Key]
        if r.Kind == "switch" then v = v and 1 or 0 end
        store[r.Key] = v
    end
end

-- on the game thread, once a step: the reset and the save asked for by the keys or by Mod Menu
function M.Commit()
    if M.ResetWanted then
        M.ResetWanted = false
        for _, r in ipairs(M.ROWS) do M.Set[r.Key] = r.Default end
        for _, r in ipairs(MODE_ROWS) do M.Mode[r.Field] = M.ModeDefault[r.Field] end
        M.Dirty, M.LayoutDirty = true, true
    end
    if M.Dirty then
        M.Dirty = false
        M.Write(M.Store)
        M.Save()
    end
end

-- Mod Menu: a switch is true or false, a number a number, a choice its word
function M.MenuGet(key) return M.Set[key] end
function M.MenuSet(key, v)
    local r = BY_KEY[key]
    if not r then return end
    M.Set[key] = Clean(r, v)
    M.Dirty = true
end

---------------------------------------------------------------- the rules

-- What the player holds (class names of the actors in the hands, nil for an empty hand). A staff or a wand in the
-- right hand, a bow or a crossbow in the left: ranged. A tool in the right hand is not a weapon. Anything else in the
-- right hand is a melee weapon. A shield or a torch in the left hand changes nothing. Names from the game's files.
local RANGED_RIGHT = { "BP_Staff_", "BP_Wand_" }
local RANGED_LEFT = { "BP_Longbow_", "BP_Shortbow_", "BP_Crossbow_" }
local TOOLS = { "BP_Pickaxe_", "BP_Logging_Axe_", "BP_FishingRodV2_", "BP_Spade_", "BP_Secateurs_" }
local function Starts(name, list)
    for _, p in ipairs(list) do if string.sub(name, 1, #p) == p then return true end end
    return false
end
function M.Classify(right, left)
    right, left = right or "", left or ""
    if Starts(right, RANGED_RIGHT) or Starts(left, RANGED_LEFT) then return "ranged" end
    if Starts(right, TOOLS) then return "tool" end
    if right ~= "" then return "melee" end
    return "none"
end

-- The HUD reticle that shows while the player aims a bow or casts a staff: class names of the children of the reticle
-- switcher (WBP_HUD_ReticleWidget_C, probe of 29-09-2026). "RangedADS" is the bow's aim (WBP_ReticleRangedADS_C); "Magic" is the
-- staff's cast (WBP_ReticleMagic_C, seen active while casting, probe of 30-09-2026) and the aimed utility spell
-- (WBP_ReticleAimingUtilityMagic_C). The default, stealth, repair, fishing, container and turret reticles are not an aim.
local AIM_RETICLES = { "RangedADS", "Magic" }
function M.AimReticle(className)
    if type(className) ~= "string" then return false end
    for _, p in ipairs(AIM_RETICLES) do if string.find(className, p, 1, true) then return true end end
    return false
end

-- Whether a fight is on, for the kind of weapon in the hands. A tool or empty hands never fight. A melee weapon fights
-- while the combat switch (s.Combat) is on. A ranged weapon fights while it aims or casts (s.Aiming, the reticle) or
-- while the combat switch is on: the switch never went on with a staff or a bow (seen in the game, 05-10-2026).
local function Fighting(kind, s)
    if kind == "melee" then return s.Combat == true end
    if kind == "ranged" then return s.Aiming == true or s.Combat == true end
    return false
end

-- A camera's memory: FightUntil the end of a fight's hold and FightView that fight's view, SprintUntil the end of a
-- sprint's hold, View the view of the step before. Out is reused every step.
function M.NewMemory() return { FightUntil = -1, FightView = nil, SprintUntil = -1, View = nil, Out = {} } end

local MIN_DISTANCE, MAX_DISTANCE = BY_KEY.walk.Min, BY_KEY.walk.Max
-- seconds: a glide; the glide back in after a sprint, slower, as a quick zoom right after a stop feels abrupt; the
-- sprint view kept after the sprint signal drops, so a short break in a sprint does not pull the camera in and out
M.GLIDE, M.GLIDE_FROM_SPRINT, M.SPRINT_HOLD = 0.9, 1.6, 0.5

-- s: Combat (the combat switch), Aiming (an aim reticle shows), Sprinting (the game's sprint signal), Right, Left (class
-- names). now: seconds. Gives back Active false (the game's camera: every value goes back), or Active with Distance and
-- Side (where the camera glides), Glide (the seconds of a glide that starts now), View ("walk", "sprint", "melee",
-- "ranged") and Kind (what is in the hands, as Classify).
function M.Step(mem, s, now)
    local set, out = M.Set, mem.Out
    if not set.on then
        mem.FightUntil, mem.FightView, mem.SprintUntil, mem.View = -1, nil, -1, nil
        out.Active = false
        return out
    end
    local kind = M.Classify(s.Right, s.Left)
    local fight = Fighting(kind, s)
    if fight then mem.FightUntil, mem.FightView = now + set.hold, kind end
    if s.Sprinting == true then mem.SprintUntil = now + M.SPRINT_HOLD end
    -- a fight's view holds after it ends, also when the weapon goes away or changes in that time
    local view = "walk"
    if fight then view = kind
    elseif now < mem.FightUntil then view = mem.FightView end
    -- a sprint wins over every view but a melee fight that is on: a staff in the hand counts as an aim all the time,
    -- so the ranged view would hide every sprint with a staff
    if now < mem.SprintUntil and not (fight and kind == "melee") then view = "sprint" end
    out.Glide = (mem.View == "sprint" and view ~= "sprint") and M.GLIDE_FROM_SPRINT or M.GLIDE
    mem.View = view
    local target = math.max(MIN_DISTANCE, math.min(MAX_DISTANCE, set[view]))
    out.Active, out.Distance, out.Side, out.View, out.Kind = true, target, set.side, view, kind
    return out
end

-- A glide of the camera between two places, each a distance and a side: g holds FromA, FromY, ToA, ToY, Start, Secs.
-- Glide starts a new one from (a, y) when the target changed, and gives back true then; GlideAt gives the place at now
-- on an ease-out curve, and true once it is there: the camera answers at once and settles softly (players found the
-- old changes abrupt, Nexus 14-10-2026).
function M.Glide(g, toA, toY, secs, now, a, y)
    if g.ToA == toA and g.ToY == toY then return false end
    g.FromA, g.FromY, g.ToA, g.ToY, g.Start, g.Secs = a, y, toA, toY, now, secs
    return true
end
function M.GlideAt(g, now)
    local k = g.Secs > 0 and (now - g.Start) / g.Secs or 1
    if k >= 1 then return g.ToA, g.ToY, true end
    if k < 0 then k = 0 end
    local e = 1 - (1 - k) ^ 3
    return g.FromA + (g.ToA - g.FromA) * e, g.FromY + (g.ToY - g.FromY) * e, false
end

-- The crosshair setting, in the immersive mode and out of it, with or without this camera: which dots crosshair.lua
-- hides. Players hid the dot and still saw it out of the immersive mode (Nexus, 04-10-2026), so it works in both.
-- nil: none (Show). "dots": every dot but the dot of an aim (crosshair.lua keeps those of
-- AimReticle): Aim only, and Aim + tools while no tool is in a hand (right, left: class names) and the build mode is
-- off (building), as a tree, a rock or a building piece is aimed at with the dot. "all": every dot, the dot of an aim
-- too (Nothing). The logging axe was in the left hand in the game (camera log of 14-10-2026).
function M.HoldsTool(right, left) return Starts(right or "", TOOLS) or Starts(left or "", TOOLS) end
function M.CrosshairHides(right, left, building)
    local c = M.Set.crosshair
    if c == "Show" then return nil end
    if c == "Nothing" then return "all" end
    if c == "Aim + tools" and (building == true or M.HoldsTool(right, left)) then return nil end
    return "dots"
end

---------------------------------------------------------------- the panel (F6)

local function Get(r) if r.Field then return M.Mode[r.Field] end return M.Set[r.Key] end
local function Put(r, v)
    if r.Field then M.Mode[r.Field], M.LayoutDirty = v, true else M.Set[r.Key], M.Dirty = v, true end
end
local function Text(r, v)
    if r.Kind == "switch" then return v and "On" or "Off" end
    if r.Kind == "number" then return string.format("%d", v) .. (r.Unit and " " .. r.Unit or "") end
    return v
end
function M.Value(i) local r = M.PANEL[i] return Text(r, Get(r)) end

local HINTS = {
    wait = "Seconds with nothing happening before the HUD fades.",
    walk = "How far the camera is when you walk. The game's own camera is at 700 cm.",
    side = "How far right the camera sits, so you stand on the left. 0 is the middle.",
    sprint = "How far the camera goes out in a sprint. It comes back in after you stop.",
    melee = "The distance in a fight with a melee weapon.",
    ranged = "The distance while you aim a bow or hold a staff. It holds for a few seconds.",
    hold = "How long the zoom stays after a fight or an aim. Then the camera goes back.",
}
function M.Hint(i)
    local r = M.PANEL[i]
    if r.Key == "immersive" then
        if M.Mode.Visible then return "The HUD fades when nothing happens, and comes back when something does." end
        return "The whole HUD stays on the screen."
    end
    if r.Key == "on" then
        if not M.Set.on then return "The game's own camera. On: closer, your character on the left." end
        return "Closer, your character on the left. With or without the immersive mode."
    end
    if r.Key == "crosshair" then
        local c = M.Set.crosshair
        if c == "Aim + tools" then return "No crosshair dot, except while you aim, build or hold a tool." end
        if c == "Aim only" then return "No crosshair dot, except while you aim a bow or hold a staff." end
        if c == "Nothing" then return "No crosshair dot at all." end
        return "The game's crosshair, as always."
    end
    return HINTS[r.Key]
end

-- what the panel shows now, as one string: a new view only when it changed
function M.State()
    local parts = { "camera", M.Sel }
    for i = 1, #M.PANEL do parts[#parts + 1] = M.Value(i) end
    return table.concat(parts, "|")
end

-- the view for editor.lua: every row, with the group titles. main.lua shows the lines that fit (panels.lua Window).
-- keys: main.lua's key names (editor, camera).
function M.View(keys, warn)
    local v = { Mode = "camera", Title = "IMMERSIVE MODE", Warn = warn,
        Keys = { { { "↑", "↓" }, "Select" }, { { "←", "→" }, "Change" }, { { "Backspace" }, "Reset" },
            { { keys.editor }, "Layout" }, { { keys.camera }, "Save, close" } },
        Name = M.PANEL[M.Sel].Label .. ":  " .. M.Value(M.Sel), Hint = M.Hint(M.Sel), Rows = {} }
    for i, r in ipairs(M.PANEL) do
        if HEADS[r.Key] then v.Rows[#v.Rows + 1] = { Head = true, Text = HEADS[r.Key] } end
        local val = M.Value(i)
        -- a number has many values: "< 300 cm >", as the map settings show a row with more than two
        v.Rows[#v.Rows + 1] = { Text = r.Label, Note = r.Kind == "number" and ("< " .. val .. " >") or val, Sel = i == M.Sel }
    end
    return v
end

-- the keys (UE4SS's thread): up and down pick a row, left and right change it, Backspace asks the step for a reset
function M.Pick(d) M.Sel = (M.Sel - 1 + d) % #M.PANEL + 1 end
function M.Change(d)
    local r = M.PANEL[M.Sel]
    local v = Get(r)
    if r.Kind == "switch" then Put(r, not v)
    elseif r.Kind == "number" then Put(r, Snap(r, v + (d > 0 and r.Step or -r.Step)))
    else
        local at = 1
        for i, o in ipairs(r.Options) do if o == v then at = i end end
        Put(r, r.Options[(at - 1 + (d > 0 and 1 or -1)) % #r.Options + 1])
    end
end
function M.Reset() M.ResetWanted = true end

return M

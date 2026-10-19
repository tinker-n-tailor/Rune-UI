-- The game's big map (M): the quest areas, the pointer and the zoom. No setting: it is always on.
-- A quest area is a marker like every other (WBP_Dominion_MinimapInternal_Icon_C, see mapname.lua) whose picture is
-- one of the game's three outlines, T_Map_Primary / Secondary / Tertiary_Quest_Outline (the game's files, DA_MapIcons).
-- Seen in the game on 10-10-2026:
--   - The root of a marker, the panel CanvasPanel_0, takes the mouse over the whole box of the picture, so inside a
--     circle the map could not be dragged and no pin could be placed. The picture itself takes no mouse. The root set
--     to "hit test invisible" lets the mouse through; the game does not write it back. The marker's own visibility is
--     no use for this: the game writes it all the time.
--   - Every marker has the cross as its pointer (the class's Cursor). ResetCursor on the marker takes that away, and
--     the game's own pointer shows, as on the rest of the map. SetCursor with the default gave the Windows arrow.
--   - The big map's zoom is the zoom of the player's own map view (the component MapView of the pawn; RuneMap has a
--     view of its own). The game sets it to 3 when the map opens, the wheel moves it a little at a notch, and 20
--     shows the whole map. The mod snaps it to three levels, one level a notch or a push of the gamepad's stick:
--     close, the zone, the whole map.
-- What the mod does to a quest area: the circle goes faint, the mouse goes through it, and its middle gets a shield,
-- gold for the main quest, blue for a side quest and green for a task of the main quest. The shield is the map plugin's own icon, as RuneMap's creature
-- icons are, so every map draws it at the right place. One actor can own the circles of many areas (the game's
-- MinimapPluginMapIcons owned 13 on 10-10-2026), so a shield is made on the owner and moved to the place of the
-- circle's own component. It is there while the game shows the circle (the component's IsIconVisible).
-- A picture is never kept in Lua: the engine frees a picture that only Lua holds, and the next touch crashes the game.
-- The shield's picture is read from a shield that stands, or loaded new and given to the icon in the same call.
-- The owner of a component is read only for the few quest areas: a read of the owner on every marker crashed the game
-- (05-10-2026).
-- The markers come from the game's reports of new widgets (ctx.Arrived), as mapname.lua's do: a map that opens makes
-- its markers new. A scan of every marker reads some hundred full names and took up to 28 ms (09-10-2026), so it runs
-- only SCANS times in a round, for the markers that stood before the reports began.
-- main.lua loads this file with pcall and runs its Scan and its Tick.

local M = {}

local CLASS = "WBP_Dominion_MinimapInternal_Icon_C"
local ICON_CLASS = "/Script/MinimapPlugin.MapIconComponent"
local KRL = "/Script/Engine.Default__KismetRenderingLibrary"
local ART = (RUNEUI_DIR or "ue4ss/Mods/RuneUI/") .. "Art/"
-- the game's outline pictures, and the shield of each
-- Tertiary is a task of the main quest (QuestData.bIsTaskQuest, read in the game on 11-10-2026): the game draws it green
local OUTLINES = { Primary = "mark_quest.png", Secondary = "mark_side.png", Tertiary = "mark_task.png" }
local OUTLINE_PATH = "/Game/Art/UI/Map/T_Map_%s_Quest_Outline.T_Map_%s_Quest_Outline"
local FAINT = 0.3             -- the opacity of a circle
local NO_HIT = 3              -- ESlateVisibility HitTestInvisible
local ARROW_SCALE, ARROW_RIGHT = 0.6, 20   -- the game's triangle on a circle: its size, and px to the right of the middle
local ICON_PANELS = { "Canvas_IconsAboveFog", "Canvas_IconsBelowFog" }   -- a map's panels of markers
local SHARE = 0.9             -- the shield's share of an icon's own default size
local SIZE = 8                -- used only when the icon has no default size to scale from
local AT = { Rotation = { X = 0, Y = 0, Z = 0, W = 1 }, Translation = { X = 0, Y = 0, Z = 0 }, Scale3D = { X = 1, Y = 1, Z = 1 } }
-- The table the game fills with a sweep's hit, which nobody reads. One for the whole run: UE4SS keeps every table it
-- is given to fill (nearby.lua, Out).
local HIT = {}
M.LEVELS = { 3, 6.3, 20 }     -- the zoom levels: close (the game's own start), the zone, the whole map

local function Alive(o) return o and o:IsValid() end   -- a property or a call can give a wrapper of null: pcall does not catch it

---------------------------------------------------------------- the zoom, without the game (tools/test-bigmap.js)

-- The level after the game moved the zoom from last to z, standing at level idx. A zoom at the first level or under
-- it is the game's own start (the map opened), whatever the level was. Else one level in the direction of the move.
function M.NextLevel(idx, last, z)
    if z <= M.LEVELS[1] + 0.001 then return 1 end
    return math.max(1, math.min(#M.LEVELS, idx + (z > last and 1 or -1)))
end

---------------------------------------------------------------- the markers

local Kinds, KindsFound = {}, 0   -- address of an outline picture -> the file of its shield
local function Pictures()
    if KindsFound == 3 then return end
    Kinds, KindsFound = {}, 0
    for name, file in pairs(OUTLINES) do
        pcall(function()
            local t = StaticFindObject(string.format(OUTLINE_PATH, name, name))
            if Alive(t) then Kinds[t:GetAddress()] = file KindsFound = KindsFound + 1 end
        end)
    end
end

local Areas = {}     -- the quest areas: { W, Comp, Area = the file of the shield }, and Owner, Key once read
local Shields = {}   -- full name of a circle's component -> { I = our icon, File }
local Ours = {}      -- address of our icon -> true: its markers let the mouse through too
local Waiting = {}   -- { W, At }: markers that the game made and that are not looked at yet, or cannot be read yet
local LOOK_EVERY, LOOK_FOR, MAX_LOOKS = 0.1, 5, 100
local NextLook, NextShields, NextScan = 0, 0, 0
local SCANS, SCAN_EVERY, SHIELDS_EVERY = 2, 15, 1
local Scans = 0
local Logged = 0     -- the first shields are logged

-- the mouse goes through the marker: its root takes no hit test
local function Through(W)
    local root = W.WidgetTree.RootWidget
    if Alive(root) and root:GetVisibility() ~= NO_HIT then root:SetVisibility(NO_HIT) end
end

-- The icon scale of the map that draws the marker: RuneMap's on RuneMap, else 1. A map scales the picture of a marker
-- and not its triangle, so on RuneMap the triangle was far bigger than the icons (seen 10-10-2026). The marker sits in
-- one of its map's two icon panels (probe of 10-10-2026). Nil while the marker has no panel yet.
local function MapShare(ctx, W)
    local panel = W:GetParent()
    if not Alive(panel) then return nil end
    local map = ctx.SmallMap and ctx.SmallMap()
    if not Alive(map) then return 1 end
    for _, name in ipairs(ICON_PANELS) do
        local p = map[name]
        if Alive(p) and p:GetAddress() == panel:GetAddress() then return map.IconScale end
    end
    return 1
end

local function Faint(e)
    local img = e.W.Image_Icon
    if Alive(img) and math.abs(img:GetRenderOpacity() - FAINT) > 0.01 then img:SetRenderOpacity(FAINT) end
    Through(e.W)
    -- The game's white triangle in the middle of a circle would sit on the shield: it goes smaller and beside it. The
    -- game writes its visibility all the time and leaves its size and place alone (10-10-2026).
    local arrow = e.W.Image_Arrow_Overlay
    local share = e.Share or 1
    if Alive(arrow) and math.abs(arrow.RenderTransform.Scale.X - ARROW_SCALE * share) > 0.01 then
        arrow:SetRenderScale({ X = ARROW_SCALE * share, Y = ARROW_SCALE * share })
        arrow:SetRenderTranslation({ X = ARROW_RIGHT * share, Y = 0 })
    end
end

-- One marker: the game's own pointer. Nil while its component or picture cannot be read yet, false for a marker that is
-- no quest area, else the record of the quest area.
local function Look(W)
    local comp = W.MapIconComp
    if not Alive(comp) then return nil end
    local tex = comp.IconTexture
    if not Alive(tex) then return nil end
    W:ResetCursor()
    local file = Kinds[tex:GetAddress()]
    if not file then
        if Ours[comp:GetAddress()] then   -- the marker of our shield: no mouse, and no triangle of its own on the shield
            Through(W)
            local arrow = W.Image_Arrow_Overlay
            if Alive(arrow) then arrow:SetRenderOpacity(0) end
        end
        return false
    end
    local e = { W = W, Comp = comp, Area = file }
    Faint(e)
    return e
end

---------------------------------------------------------------- the shields

local function Off(icon)
    pcall(function() if icon:IsValid() then icon:K2_DestroyComponent(icon) end end)
end

-- the game shows the circle: the component says so; the marker's own visibility when it cannot be asked
local function Shown(e)
    local ok, v = pcall(function() return e.Comp:IsIconVisible() end)
    if ok then return v == true end
    return e.W:GetVisibility() ~= 1
end

-- The picture of a shield: from a shield that stands, or loaded new. The caller gives it to an icon at once.
local function Picture(ctx, file)
    for _, s in pairs(Shields) do
        if s.File == file and Alive(s.I) then
            local t = s.I.IconTexture
            if Alive(t) then return t end
        end
    end
    local pc = ctx.Controller()
    if not Alive(pc) then return nil end
    local t = StaticFindObject(KRL):ImportFileAsTexture2D(pc, ART .. file)
    return Alive(t) and t or nil
end

local function AddShield(ctx, owner, file, comp)
    local cls = StaticFindObject(ICON_CLASS)
    if not Alive(cls) then return nil end
    local tex = Picture(ctx, file)
    if not tex then return nil end
    -- Made deferred: the map places an icon above or below its fog when the icon registers, and a change after that is not
    -- seen. Since game 1.0.1 a shield below the fog was unseen in fog (the circles of the game sit above it, 14-10-2026),
    -- so the shield takes its circle's fog setting first.
    local icon = owner:AddComponentByClass(cls, false, AT, true)
    if not Alive(icon) then return nil end
    -- an icon that cannot be set up comes off again: the next step makes a new one, and none is left behind
    local set = pcall(function()
        pcall(function() icon.IconFogInteraction = comp.IconFogInteraction end)
        owner:FinishAddComponent(icon, false, AT)
        icon:SetIconTexture(tex)
        local at = comp:K2_GetComponentLocation()
        icon:K2_SetWorldLocation({ X = at.X, Y = at.Y, Z = at.Z }, false, HIT, false)
    end)
    if not set then Off(icon) return nil end
    local def
    pcall(function() local s = icon.IconSize def = type(s) == "number" and s or s.X end)
    local size = (def and def > 0) and def * SHARE or SIZE
    if not pcall(function() icon:SetIconSize(size, size) end) then
        pcall(function() icon:SetIconSize(size, true) end)
    end
    return icon
end

-- A shield for each circle that the game shows, and none for the others. A circle whose marker is gone
-- leaves the list; one that stands is made faint again if the game undid it.
local function SyncShields(ctx)
    local want, live = {}, {}   -- want: full name of a circle's component -> the record of one of its markers
    for _, e in ipairs(Areas) do
        pcall(function()
            if not (Alive(e.W) and Alive(e.Comp)) then return end
            live[#live + 1] = e
            if e.Share == nil then e.Share = MapShare(ctx, e.W) end
            Faint(e)
            if not Shown(e) then return end
            if not e.Owner then
                local a = e.Comp:GetOwner()
                if not Alive(a) then return end
                e.Owner, e.Key = a, e.Comp:GetFullName()
            end
            if Alive(e.Owner) then want[e.Key] = e end
        end)
    end
    Areas = live
    for name, s in pairs(Shields) do
        local e = want[name]
        if not (e and e.Area == s.File and Alive(s.I)) then
            pcall(function() Ours[s.I:GetAddress()] = nil end)
            Off(s.I)
            Shields[name] = nil
        end
    end
    for name, e in pairs(want) do
        if not Shields[name] then
            local ok, icon = pcall(AddShield, ctx, e.Owner, e.Area, e.Comp)
            if ok and icon then
                Shields[name] = { I = icon, File = e.Area }
                Ours[icon:GetAddress()] = true
                if Logged < 5 then Logged = Logged + 1 ctx.Log("big map: a shield on a quest area, " .. e.Area) end
            end
        end
    end
end

---------------------------------------------------------------- the scan and the new markers

function M.Scan(ctx)
    local now = os.clock()
    if Scans >= SCANS or now < NextScan then return end
    Scans, NextScan = Scans + 1, now + SCAN_EVERY
    Pictures()
    local known = {}   -- the quest areas that came with the reports are not taken twice
    for _, e in ipairs(Areas) do pcall(function() known[e.W:GetAddress()] = true end) end
    for _, W in ipairs((ctx.Find(CLASS))) do
        pcall(function()
            if known[W:GetAddress()] then return end
            local e = Look(W)
            if e then Areas[#Areas + 1] = e end
        end)
    end
    NextShields = 0
end

-- The markers that the game made since the last step. True when a quest area is among them.
local function Newcomers(arrived, now)
    for _, W in ipairs(arrived or {}) do Waiting[#Waiting + 1] = { W = W, At = now } end
    if #Waiting == 0 or now < NextLook then return false end
    NextLook = now + LOOK_EVERY
    Pictures()
    local left, later, found = {}, {}, false
    for i, w in ipairs(Waiting) do
        if i > MAX_LOOKS then
            left[#left + 1] = w
        else
            local again = false
            pcall(function()
                if not Alive(w.W) then return end
                local e = Look(w.W)
                if e == nil then again = now - w.At < LOOK_FOR return end
                if e then Areas[#Areas + 1] = e found = true end
            end)
            if again then later[#later + 1] = w end   -- not readable yet: behind the ones never looked at
        end
    end
    for _, w in ipairs(later) do left[#left + 1] = w end
    Waiting = left
    return found
end

---------------------------------------------------------------- the zoom

local View               -- the player's own map view
local NextView = 0
local Level, Last = 1, nil
local Chain = { Name = "big map zoom" }
local FAST_FOR = 5       -- seconds after a move of the zoom in which it is read about every frame
local FastUntil = 0
-- A gamepad zooms with the right stick, an axis (IMC_Map): held, it moves the zoom a little at every frame, and each
-- move was a level, so one push went from close to the whole map. With a gamepad, a move this soon after the last
-- one is the same push and keeps the level.
local PUSH_GAP = 0.25
local Pad, PushAt = false, nil

local function FindView(ctx, now)
    if Alive(View) or now < NextView then return end
    NextView = now + 2
    View = nil
    pcall(function()
        local pc = ctx.Controller()
        local pawn = Alive(pc) and pc.Pawn
        local v = Alive(pawn) and pawn.MapView
        if Alive(v) then View = v end
    end)
end

-- Reads the zoom; a move of it snaps to the next level. True when it moved.
local function Snap()
    if not Alive(View) then Last = nil return false end
    local z = View:GetZoomScale()
    if Last == nil then Last = z return false end
    if math.abs(z - Last) < 0.001 then return false end
    local now = os.clock()
    FastUntil = now + FAST_FOR
    local start = z <= M.LEVELS[1] + 0.001   -- the map opened, or the zoom went under close: no push of the stick
    if Pad and PushAt and now - PushAt < PUSH_GAP and not start then
        PushAt = now
        View:SetZoomScale(Last)
        return true
    end
    Level = M.NextLevel(Level, Last, z)
    Last = M.LEVELS[Level]
    if math.abs(z - Last) >= 0.001 then View:SetZoomScale(Last) end
    PushAt = (Pad and not start) and now or nil
    return true
end

local function FastStep() pcall(Snap) end
local function FastMore(_, t) return t < FastUntil end

function M.Tick(ctx)
    local now = os.clock()
    local found = Newcomers(ctx.Arrived(CLASS), now)
    if found or now >= NextShields then
        NextShields = now + SHIELDS_EVERY
        SyncShields(ctx)
    end
    FindView(ctx, now)
    local okPad, pad = pcall(ctx.Pad or function() return false end)
    Pad = okPad and pad == true
    local ok, moved = pcall(Snap)
    -- the wheel turns on: the next notches are read about every frame, so no half step shows
    if ok and moved and ctx.Chain then ctx.Chain.Run(Chain, ctx, 16, FastStep, FastMore) end
end

-- A new world: the old markers, owners and icons are gone, so nothing is called on them. A player restart: the things
-- still stand, and so do their shields; the shields come off, or the next step gives each owner a second one.
function M.Forget(sameWorld)
    if sameWorld then
        for _, s in pairs(Shields) do Off(s.I) end
    end
    Areas, Shields, Ours, Waiting = {}, {}, {}, {}
    Kinds, KindsFound = {}, 0
    View, Last, Level, FastUntil, PushAt = nil, nil, 1, 0, nil
    NextLook, NextShields, NextScan, NextView, Logged, Scans = 0, 0, 0, 0, 0, 0
    Chain.Token, Chain.Time = (Chain.Token or 0) + 1, nil   -- a call still queued does nothing (chain.lua's Stop)
end

return M

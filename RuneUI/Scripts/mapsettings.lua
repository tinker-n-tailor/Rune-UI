-- The settings of RuneMap and its zoom: the F8 switches (mappanel.lua shows them), the [ and ] keys, and their place
-- in main.lua's settings file. runemap.lua calls Step at the start of its own step, Apply on a live map, and ApplyZoom
-- when a zoom key was pressed. The names that other files use (Set, Attach, ZoomLevel, ZoomBy, Reset) are put on the
-- map's table in Init.
-- The key handlers only set flags in the map's table (Dirty, ResetWanted, PendingZoom); the step does the rest.

local P = {}
local M = nil   -- the map's own table (runemap.lua), given in Init

-- Zoom: the [ and ] keys (main.lua). It lives in main.lua's settings file with the F8 settings (Attach below).
-- 2 is the addon's ZoomScale.
local ZOOM_MIN, ZOOM_MAX = 0.5, 32   -- 8 was not far enough out
local function ZoomLevel() return M.Zoom or 2 end
local function ZoomBy(factor) M.PendingZoom = (M.PendingZoom or 1) * factor end   -- key handlers: applied in the step

local function SaveZoom(z) M.Store.zoom = z M.Save() end
function P.ApplyZoom()
    local z = math.max(ZOOM_MIN, math.min(ZOOM_MAX, ZoomLevel() * M.PendingZoom))
    M.PendingZoom = false
    M.Zoom = z
    pcall(function() M.View:SetZoomScale(z) end)
    SaveZoom(z)
end

-- The F8 settings. Map: off means the mod does not build the map at all, which hiding it in F9 still does
-- (seen in the game, 29-09-2026). North: the map faces north instead of turning with the camera. Mark: the north mark on
-- the ring. Smooth: the map draws every frame instead of every second one; Fastest: every fourth. Neutral: the green diamonds of neutral
-- creatures. Ore, Herbs, Essence, Trees: the resource icons (resources.lua). Name: the
-- name the game prints beside your own marker, on this map and the big map (mapname.lua hides it while off).
-- The key handlers in main.lua only flip these and set Dirty; Step applies and saves them. They and the zoom are kept
-- in main.lua's settings file: Store is its [map] section, Save writes the file (Attach, called once at start).
-- Immersive: what stays while the immersive mode is on: "Nothing", "Map" or "Compass" (settings.lua STAY; main.lua
-- reads it for the map's fade and for the compass). It starts at Nothing: the immersive mode hid the map,
-- and a player could not get it back.
-- neutral creatures start hidden: they take room on the map
local SETTING_START = { Map = true, North = false, Mark = true, Name = true, Smooth = false, Fastest = false, Neutral = false, Ore = true,
    Herbs = true, Essence = true, Trees = true, Salvage = true, Immersive = "Nothing" }
-- stay: settings.lua, for the number in the file and the name here of the Immersive setting (an old on is Map)
local Stay = { StayFrom = function() return "Nothing" end, StayTo = function() return 0 end }
local function Attach(store, save, stay)
    M.Store, M.Save = store, save
    Stay = stay or Stay
    for k in pairs(SETTING_START) do
        if store[k] ~= nil then
            if k == "Immersive" then M.Set[k] = Stay.StayFrom(store[k]) else M.Set[k] = (tonumber(store[k]) == 1) end
        end
    end
    local z = tonumber(store.zoom)
    M.Zoom = z and math.max(ZOOM_MIN, math.min(ZOOM_MAX, z)) or 2   -- a hand-edited file stays in range
end
local function SaveSettings()
    for k in pairs(SETTING_START) do
        if k == "Immersive" then M.Store[k] = Stay.StayTo(M.Set[k]) else M.Store[k] = M.Set[k] and 1 or 0 end
    end
    M.Save()
end
-- Backspace in F8, from a key handler: only a flag; Step does the rest
local function Reset() M.ResetWanted = true end

-- What the key handlers asked for: the reset, and the saving of a changed switch
function P.Step()
    if M.ResetWanted then
        M.ResetWanted = false
        for k, v in pairs(SETTING_START) do M.Set[k] = v end
        M.Zoom, M.PendingZoom, M.Dirty = 2, 1, true   -- the starting zoom; the map applies it
        SaveZoom(2)   -- saved now, also when the map cannot build
    end
    -- a switch in F8 shows at once; a held arrow key scans at most every 0.3 s (a scan costs a few ms)
    if M.Dirty then M.Dirty = false SaveSettings() M.NextRes = math.min(M.NextRes or 0, os.clock() + 0.3) end
end

-- the F8 settings onto the live map: when one changed, and once after each build
function P.Apply(ctx)
    local S = M.Set
    local key = (S.North and 1 or 0) + (S.Mark and 2 or 0) + (S.Smooth and 4 or 0) + (S.Fastest and 8 or 0)
    if key == M.Applied then return end
    M.Applied = key
    -- a new view makes the map draw every marker again (runemap.lua TrackHud): sent only when "Faces north" changed.
    -- A new map already has it (mapwidget.lua MakeView), and the north mark and the draw rate do not change the view.
    local okV = pcall(function()
        local mode = S.North and 0 or 1
        if M.View.RotationMode ~= mode then M.View.RotationMode = mode M.Map:BroadcastMapView() end
    end)
    -- smooth: no retainer, the map draws every frame; the older call if this UE has no switch
    local okR = M.Retainer and pcall(function() M.Retainer:SetRetainRendering(not S.Smooth) M.Retainer:SetRenderingPhase(0, S.Fastest and 4 or 2) end)
    if M.Retainer and not okR then pcall(function() M.Retainer:SetRenderingPhase(0, S.Smooth and 1 or (S.Fastest and 4 or 2)) end) end
    if M.NorthImg then pcall(function() M.NorthImg:SetVisibility(S.Mark and 3 or 1) end) end
    M.LastNorth = nil
    ctx.Log(string.format("runemap: faces north %s%s, north mark %s, %s", tostring(S.North), okV and "" or " (not set)",
        tostring(S.Mark), S.Smooth and "drawn every frame" or (S.Fastest and "drawn every fourth frame" or "drawn every second frame")))
end

function P.Init(map)
    M = map
    M.Set = {}
    for k, v in pairs(SETTING_START) do M.Set[k] = v end
    M.Store, M.Save = {}, function() end
    M.Attach, M.ZoomLevel, M.ZoomBy, M.Reset = Attach, ZoomLevel, ZoomBy, Reset
end

return P

-- The map inside RuneMap: the game's own minimap widget, fed by a map view of ours on the player, and its terrain.
-- runemap.lua calls MakeView and MakeMap at each build, SetUpAgain once the map is on screen, and ClassReady before a
-- build. The map has no fog: the mod has no record of where the player has been. It has no shadow frame either.

local P = {}
local M = nil   -- the map's own table (runemap.lua), given in Init

local MAP_CLASS = "/Game/UI/HUD/ModifiedMinimapPlugin/WBP_DominionMinimap.WBP_DominionMinimap_C"
local VIEW_CLASS = "/Script/MinimapPlugin.MapViewComponent"

-- the map settings, taken from the MiniMap addon
-- InitialMapSize: without the addon it stayed 0 and the map drew nothing, not even the arrow; Init sets it to the
-- look's diameter. IconScale: the
-- map icons (camps, boats) looked too big at 1, and 10% big at 0.6. 0.54 was still much too big for
-- the dungeons and the other game icons, and 0.3 far too small (seen in the game, 29-09-2026). It scales our own icons too.
local ICON_SCALE = 0.4
local MAP_SETTINGS = { bIsCircular = true, AutoLocateMapView = 4, IconScale = ICON_SCALE, FloorDistance = 300 }
-- the addon's view settings: without them (probe of 27-09-2026) the view kept RotationMode 0 and the map
-- stopped turning with the camera
local VIEW_SETTINGS = { bSupportZooming = true, RotationMode = 1, InheritedYawOffset = 90 }

function P.MakeView(ctx, pawn)
    local cls = StaticFindObject(VIEW_CLASS)
    if not (cls and cls:IsValid()) then error("no map view class") end
    -- made unattached, so this transform is in the world: it starts on the player's body
    local At = pawn:K2_GetActorLocation()
    local T = { Rotation = { X = 0, Y = 0, Z = 0, W = 1 }, Translation = { X = At.X, Y = At.Y, Z = At.Z }, Scale3D = { X = 1, Y = 1, Z = 1 } }
    local comp = pawn:AddComponentByClass(cls, true, T, false)
    if not (comp and comp:IsValid()) then error("AddComponentByClass gave nothing") end
    -- on the camera arm, so the map turns with the camera. The arm puts its children at its far end, by the
    -- camera: snapped there, the view sat 700 units from the player and the arrow was off the centre (probe of
    -- 27-09-2026). So the place is kept (it stays on the body as the arm turns) and only the turn is taken.
    -- ponytail: the arm shortens near walls; the view is then off by that much until the next build.
    local okA, errA = pcall(function()
        comp:K2_AttachToComponent(pawn.CameraBoom, FName("None"), 1, 2, 2, false)
    end)
    if not okA then ctx.Log("runemap: attach failed: " .. tostring(errA)) end
    for k, v in pairs(VIEW_SETTINGS) do pcall(function() comp[k] = v end) end
    if M.Set.North then pcall(function() comp.RotationMode = 0 end) end   -- F8: faces north
    -- HeightProxy tells the view how high the player stands, which picks the floor of terrain to draw.
    -- Without it the terrain parts arrive (probe of 27-09-2026) but nothing is drawn. It is the player's own
    -- body, but only if it is the kind the property holds (a wrong kind of object in an object property
    -- could crash the engine).
    pcall(function()
        if comp.HeightProxy and comp.HeightProxy:IsValid() then return end
        local want = nil
        comp:GetClass():ForEachProperty(function(p)
            pcall(function() if p:GetFName():ToString() == "HeightProxy" then want = p:GetPropertyClass() end end)
        end)
        if not want then return end
        for _, candidate in ipairs({ pawn.RootComponent, pawn }) do
            if candidate and candidate:IsValid() and candidate:IsA(want) then comp.HeightProxy = candidate break end
        end
    end)
    pcall(function() comp:SetZoomScale(M.ZoomLevel()) end)
    return comp
end

-- The terrain pictures. The level hands them to the maps that exist when it loads; ours comes later and got
-- none (icons and labels, but a plain brown map). Later the plugin adds them itself; ours are added
-- only when the map still has none at its first set-up (SetUpAgain).
-- The kind of object AddMapBackground takes, read from the function itself
-- (/Script/MinimapPlugin.MapBackgroundComponent does not exist, so the name is not guessed).
local function BackgroundClass(ctx)
    local fn = StaticFindObject(MAP_CLASS .. ":AddMapBackground")
    if not (fn and fn:IsValid()) then ctx.Log("runemap: no AddMapBackground function") return nil end
    local want = nil
    fn:ForEachProperty(function(p)
        pcall(function()
            if p:GetClass():GetFName():ToString() == "ObjectProperty" then want = want or p:GetPropertyClass() end
        end)
    end)
    -- if the read above fails (it did once, 27-09-2026), nothing is added; an earlier read gave the kind
    -- MapBackground, so look it up by that name
    if not want then
        local byName = StaticFindObject("/Script/MinimapPlugin.MapBackground")
        if byName and byName:IsValid() then want = byName end
    end
    return want
end

-- Everything that can hold background parts: the game's map tracker
local function BackgroundLists()
    local lists = {}
    pcall(function()
        local lib = StaticFindObject("/Script/MinimapPlugin.Default__MapFunctionLibrary")
        local tracker = lib:GetMapTracker(FindFirstOf("GameInstance"))
        tracker:GetClass():ForEachProperty(function(p)
            pcall(function()
                local name = p:GetFName():ToString()
                if string.find(string.lower(name), "background", 1, true) then
                    table.insert(lists, { "tracker " .. name, tracker[name] })
                end
            end)
        end)
    end)
    return lists
end

local function AddBackgrounds(ctx, map)
    local want = BackgroundClass(ctx)
    local seen, added, firstErr = {}, 0, nil
    -- the pieces the map already holds are skipped: every set-up added them again (2 pieces, 6 on the map after two
    -- set-ups, 29-09-2026), and the map worked through every copy
    local held = 0
    pcall(function()
        map.Backgrounds:ForEach(function(_, e)
            local b = e:get()
            if b and b:IsValid() then seen[b:GetFullName()] = true held = held + 1 end
        end)
    end)
    -- only a live object of exactly the kind the function takes goes in: a wrong one could crash the game
    local function Try(item)
        if not (item and item:IsValid()) then return end
        local n = item:GetFullName()
        if seen[n] or string.find(n, "_GEN_VARIABLE", 1, true) or string.find(n, "Default__", 1, true) then return end
        -- still no kind: the lists hold background parts (BP_MapBackground_C in the tracker), so take the kind of
        -- the first one whose class says so
        if not want and string.find(item:GetClass():GetFName():ToString(), "MapBackground", 1, true) then
            want = item:GetClass()
        end
        if not (want and item:IsA(want)) then return end
        seen[n] = true
        local ok, err = pcall(function() map:AddMapBackground(item) end)
        if ok then added = added + 1 elseif not firstErr then firstErr = tostring(err) end
    end
    for _, L in ipairs(BackgroundLists()) do
        -- not every property named "background" is a list; those fail here and are skipped
        pcall(function()
            L[2]:ForEach(function(a, b)
                for _, p in ipairs({ a, b }) do   -- an array gives index and item, a map gives key and value
                    if type(p) == "userdata" then
                        local item = nil
                        pcall(function() item = p:get() end)
                        pcall(Try, item)
                    end
                end
            end)
        end)
    end
    if not want then ctx.Log("runemap: no background kind found, nothing added") return end
    local wantName = want:GetFName():ToString()
    -- and every live one in the world
    for _, c in pairs(FindAllOf(wantName) or {}) do
        if string.find(c:GetFullName(), ":PersistentLevel.", 1, true) then pcall(Try, c) end
    end
    ctx.Log(string.format("runemap: backgrounds added %d, %d already on the map (%s)%s", added, held, wantName,
        firstErr and (", first error: " .. firstErr) or ""))
end

-- The game's dark vignette over the map (an Image named ShadowFrame in Overlay_Layers) is made for the big map. Since
-- game 1.0.1 it covers RuneMap all but a small circle round the player (probes 1 to 25 of 14-10-2026), so it is
-- collapsed. Found by name in a short walk of the map's own tree; a user widget inside is not entered.
local FRAME, FRAME_NODES, FRAME_DEPTH = "ShadowFrame", 60, 6
local function HideFrame(ctx, map)
    local seen, frame = 0, nil
    local function Visit(W, depth)
        if frame or seen >= FRAME_NODES or depth > FRAME_DEPTH or not (W and W:IsValid()) then return end
        seen = seen + 1
        if W:GetFName():ToString() == FRAME then frame = W return end
        if depth > 1 and string.find(W:GetClass():GetFName():ToString(), "^WBP_") then return end
        local ok, count = pcall(function() return W:GetChildrenCount() end)
        if ok and count then
            for i = 0, count - 1 do Visit(W:GetChildAt(i), depth + 1) end
        else
            pcall(function() Visit(W:GetContent(), depth + 1) end)
        end
    end
    Visit(map.WidgetTree.RootWidget, 1)
    if not frame then M.Once(ctx, "noframe", "runemap: no " .. FRAME .. " in the map, left alone") return end
    if frame:GetVisibility() ~= 1 then frame:SetVisibility(1) end   -- collapsed
    M.Once(ctx, "frame", "runemap: the game's shadow frame over the map is off")
end

function P.MakeMap(ctx, PC, view)
    local cls = ctx.Asset(MAP_CLASS)
    if not (cls and cls:IsValid()) then error("minimap class not loaded; open the M map once") end
    local WBL = StaticFindObject("/Script/UMG.Default__WidgetBlueprintLibrary")
    local map = WBL:Create(PC, cls, PC)
    if not (map and map:IsValid()) then error("Create gave nothing") end
    for k, v in pairs(MAP_SETTINGS) do pcall(function() map[k] = v end) end
    local okV, errV = pcall(function() map:SetMapView(view) end)
    if not okV then ctx.Log("runemap: SetMapView failed: " .. tostring(errV)) end
    -- no terrain of ours here: the map plugin adds the pieces itself within a second, and ours were a second copy
    -- (log of 29-09-2026). SetUpAgain adds ours only if the map still has none.
    -- the addon calls these after SetMapView; without them the map stayed on "waiting for map view"
    local calls = {
        -- fog off: ours has no record of where the player has been, so the fog covered the whole map and it
        -- stayed grey (probe of 27-09-2026)
        { "ShowFog", function() map:ShowFog(false) end },
        { "ReinitShape", function() map:ReinitShape() end },
        { "RetryMapSize", function() map:RetryMapSize() end },
        { "BroadcastMapView", function() map:BroadcastMapView() end },
        { "ForceLayoutPrepass", function() map:ForceLayoutPrepass() end },
    }
    for _, c in ipairs(calls) do
        local ok, err = pcall(c[2])
        if not ok then ctx.Log("runemap: " .. c[1] .. " failed: " .. tostring(err)) end
    end
    -- at once, or the new map shows dark for the second until SetUpAgain (after every visit to the big map)
    local okF, errF = pcall(HideFrame, ctx, map)
    if not okF then M.Once(ctx, "frameerr", "runemap: the shadow frame not hidden: " .. tostring(errF)) end
    return map
end

-- A second set-up once the map is on screen: the quest, bed and teleporter icons showed only after the
-- terrain was added again and the map set up again (probe of 27-09-2026).
function P.SetUpAgain(ctx)
    local map = M.Map
    local t0 = os.clock()
    -- ours only on a map with no terrain yet: every add made another copy of the same pieces (29-09-2026)
    local n = 0
    pcall(function() n = map.Backgrounds:GetArrayNum() end)
    if n == 0 then pcall(AddBackgrounds, ctx, map) end
    local t1 = os.clock()
    -- one call at a time, each timed (the log line below); they stop at the first that fails, as one call did
    local ok, err = pcall(function() map:ReinitShape() end)
    local t2 = os.clock()
    if ok then ok, err = pcall(function() map:RetryMapSize() end) end
    local t3 = os.clock()
    if ok then ok, err = pcall(function() map:ForceLayoutPrepass() end) end
    local t4 = os.clock()
    if not ok then ctx.Log("runemap: set up again failed: " .. tostring(err)) end
    -- The plugin adds the terrain pictures again each time the big map (M) opens: 2 more each visit, 12 after five
    -- (log of 29-09-2026), and the map draws every copy. The first set-up after a build notes how many there are;
    -- later ones take the extra copies (the newest, at the end) off the map's canvas. The plugin's Backgrounds array
    -- still grows by 2 a visit (small). ReinitShape and RetryMapSize ran on the trimmed canvas in game without a crash.
    pcall(function()
        local canvas = map.Canvas_Backgrounds
        local kids = canvas:GetChildrenCount()
        -- a count of 0 (terrain not there yet) is not noted: the next trim would take every picture off
        if not M.TerrainAt then if kids > 0 then M.TerrainAt = kids end return end
        for i = kids - 1, M.TerrainAt, -1 do canvas:GetChildAt(i):RemoveFromParent() end
        if kids > M.TerrainAt then M.Once(ctx, "terraincopies", "runemap: extra terrain copies taken off the map") end
    end)
    local okF, errF = pcall(HideFrame, ctx, map)
    if not okF then M.Once(ctx, "frameerr", "runemap: the shadow frame not hidden: " .. tostring(errF)) end
    local ms = function(a, b) return (b - a) * 1000 end
    ctx.Log(string.format("runemap: set up again in %.1f ms (terrain %.1f, shape %.1f, size %.1f, layout %.1f, trim %.1f)",
        ms(t0, os.clock()), ms(t0, t1), ms(t1, t2), ms(t2, t3), ms(t3, t4), ms(t4, os.clock())))
end

-- true when the minimap class is there: loaded by the game once the M map was open, or by the mod (every 10 s at most)
function P.ClassReady(ctx)
    local cls = StaticFindObject(MAP_CLASS)
    if not (cls and cls:IsValid()) and os.clock() > (M.NextClassLoad or 0) then
        M.NextClassLoad = os.clock() + 10
        ctx.Log("runemap: loading the minimap class")
        cls = ctx.Asset(MAP_CLASS)
        ctx.Log("runemap: minimap class " .. (cls and "loaded" or "not loaded"))
    end
    if not (cls and cls:IsValid()) then
        M.Once(ctx, "class", "runemap: waiting for the minimap class; open the M map once")
        return false
    end
    return true
end

-- after maplook.lua's Init: the map is as wide as the look's ring. H.ICON_SCALE is for mapcreatures.lua.
function P.Init(map)
    M = map
    MAP_SETTINGS.InitialMapSize = { X = M.H.D, Y = M.H.D }
    M.H.ICON_SCALE = ICON_SCALE
end

return P

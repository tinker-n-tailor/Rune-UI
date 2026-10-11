-- RuneMap, the minimap: the game's own minimap widget, fed by our own map view, in a gold ring that is also
-- the clock. This file is the conductor: it decides when the map is built, shown, hidden, taken off and built new.
-- The work is in four other files, which wiring.lua loads and Init joins to this table:
--   maplook.lua       the gold ring, the day and night band with its arrow, the north mark, the opacity
--   mapwidget.lua     the game's map widget and its view, the terrain, the set-up after a build
--   mapcreatures.lua  the red and green diamonds (resources.lua is its sibling)
--   mapsettings.lua   the F8 switches, the zoom, saving
-- The F8 panel (mappanel.lua) sets the map, north, the creatures, the resources, the zoom and the draw rate.
-- main.lua loads this file with pcall, so an error here leaves the rest of the mod running.

-- Dirty, ResetWanted and PendingZoom are set by key handlers: kept in the table as false, never nil, so
-- setting them never grows the table on UE4SS's key thread
local M = { W = nil, Fails = 0, Dirty = false, ResetWanted = false, PendingZoom = false }

local Look, Widget, Creatures, Settings = nil, nil, nil, nil

-- Joins the four other files to this table: each gets it, and puts on it the names that it owns (M.Set, M.Attach,
-- M.ZoomBy, M.ReadClock, M.H and more). In this order: the widget reads the look's size, and the creatures the widget's
-- icon scale. False when a file is missing: then there is no map.
function M.Init(parts)
    Look, Widget, Creatures, Settings = parts.Look, parts.Widget, parts.Creatures, parts.Settings
    if not (Look and Widget and Creatures and Settings) then return false end
    Look.Init(M) Widget.Init(M) Creatures.Init(M) Settings.Init(M)
    return true
end

local Logged = {}
function M.Once(ctx, key, msg)
    if Logged[key] then return end
    Logged[key] = true
    ctx.Log(msg)
end
local Once = M.Once

local function LocalController()
    for _, P in pairs(FindAllOf("DominionPlayerController") or {}) do
        local ok, yes = pcall(function()
            return P:IsValid() and not string.find(P:GetFullName(), "Default__", 1, true) and P:IsLocalController()
        end)
        if ok and yes then return P end
    end
end

-- handles into the ring of the last build, dropped with it
local function DropParts()
    M.NorthSlot, M.NorthImg, M.RingOut, M.RingIn, M.Retainer = nil, nil, nil, nil, nil
    M.Applied, M.LastNorth, M.Op = nil, nil, nil
    M.TerrainAt = nil   -- a new map notes its own count (mapwidget.lua SetUpAgain)
    M.Marks = nil
    if M.Radar then M.Radar.NewMap() end   -- a new map is the game's own again
    if M.Near then M.Near.Forget() end -- and tries the first way to find creatures again: one failure must not hold for the world
end

---------------------------------------------------------------- build and update

local function Build(ctx)
    -- a new name on every build: the old widget may still exist under GameInstance, and making an object
    -- with the name of a live one makes the engine replace it in place, which can crash the game
    M.Builds = (M.Builds or 0) + 1
    M.Shown, M.Visible, M.LastDeg, M.NeedleSlot, M.NeedleImg = nil, nil, nil, nil, nil
    DropParts()
    local step, t0 = "player", os.clock()
    local view, uw = nil, nil
    local ok, err = pcall(function()
        local PC = LocalController()
        if not PC then error("no local player controller") end
        local pawn = PC.Pawn
        if not (pawn and pawn:IsValid()) then error("no pawn") end
        M.PC = PC
        step = "view"
        view = Widget.MakeView(ctx, pawn)
        step = "map"
        local map = Widget.MakeMap(ctx, PC, view)
        step = "widget"
        local BOX = M.H.BOX   -- the whole element (maplook.lua)
        uw = StaticConstructObject(StaticFindObject("/Script/UMG.UserWidget"), FindFirstOf("GameInstance"), FName("RuneUIMap" .. M.Builds))
        local tree = StaticConstructObject(StaticFindObject("/Script/UMG.WidgetTree"), uw, FName("RuneUIMapTree"))
        uw.WidgetTree = tree
        local canvas = StaticConstructObject(StaticFindObject("/Script/UMG.CanvasPanel"), tree, FName("RU_MapCanvas"))
        tree.RootWidget = canvas
        local size = StaticConstructObject(StaticFindObject("/Script/UMG.SizeBox"), tree, FName("RU_MapSize"))
        size:SetWidthOverride(BOX)
        size:SetHeightOverride(BOX)
        step = "ring"
        size:SetContent(Look.BuildRing(ctx, tree, map))
        local E = ctx.ById("runemap")
        local slot = canvas:AddChildToCanvas(size)
        slot:SetAutoSize(true)
        -- tied to the top right corner, so it stays there on a wide screen; the spot is measured
        -- on a 16:9 screen, 1920 units wide
        slot:SetAnchors({ Minimum = { X = 1, Y = 0 }, Maximum = { X = 1, Y = 0 } })
        slot:SetPosition({ X = E.Center.X - BOX / 2 - 1920, Y = E.Center.Y - BOX / 2 })
        step = "screen"
        uw:AddToViewport(40)
        uw:SetVisibility(1) ctx.Scan()   -- collapsed for one step: the scan gives this box to the layout, and Tick shows the map in its place
        M.W, M.UW, M.Map, M.Pawn, M.View = size, uw, map, pawn, view
        M.SetUpAt = os.clock() + 1
    end)
    if ok then
        ctx.Log(string.format("runemap ready in %.1f ms", (os.clock() - t0) * 1000))
        M.Fails = 0
    else
        -- tried again 10 s later, 3 times at most in one round (as main.lua does for its parts). The view on the
        -- body goes first, or the next try adds a second one. So does a widget that is already on the screen.
        pcall(function() if view and view:IsValid() then view:K2_DestroyComponent(view) end end)
        pcall(function() if uw and uw:IsValid() then uw:RemoveFromParent() end end)
        M.Fails, M.NextBuild = (M.Fails or 0) + 1, os.clock() + 10
        ctx.Log("runemap failed at step '" .. step .. "': " .. tostring(err))
    end
end

-- Leaving the world (quit to the main menu, a level change): drop every handle into it before the engine
-- frees the objects. A crash on quitting to the menu (27-09-2026) came from an old handle.
function M.Forget(sameWorld)
    -- a new world: no RemoveFromParent, the engine has already taken the old world's widgets off the screen,
    -- and touching ours then crashed the game (quit to the menu, 27-09-2026). A player restart in the same
    -- world: take our map off, or the next build puts a second one on top of it.
    if sameWorld and M.UW then pcall(function() M.UW:RemoveFromParent() end) end
    M.W, M.UW, M.Map, M.Pawn, M.View, M.PC = nil, nil, nil, nil, nil, nil
    M.Fails, M.Owed, M.NextBuild = 0, nil, nil   -- a failed build's wait of 10 s ends too
    M.ClockAt = nil   -- the next world's dial is read anew
    M.EnemyTex, M.NeutralTex, M.ResTex = nil, nil, nil
    M.SetUpAt, M.NeedleSlot, M.NeedleImg, M.NextRes = nil, nil, nil, 0   -- a new world scans for resources at once
    DropParts()
    if sameWorld then Creatures.Drop() else Creatures.Forget() end
    if M.Res then pcall(sameWorld and M.Res.Drop or M.Res.Forget) end
    if M.Near then M.Near.Forget() end   -- a way that failed while a world loaded gets a new try
    if M.Radar then M.Radar.Forget() end
end

-- Build only once the world is up: the HUD bars exist and the player has a body. Before that (main menu,
-- loading) it waits quietly instead of failing.
local function Ready(ctx)
    local V = ctx.ById("vitals").Instances[1]
    if not (V and V:IsValid()) then return false end
    if not Widget.ClassReady(ctx) then return false end
    local PC = LocalController()
    local pawn = PC and PC.Pawn
    return pawn and pawn:IsValid()
end

-- true when the player now has another body than the one our map view sits on
local function PawnChanged()
    -- a dead controller or body (quit to menu, level load) is never read, only checked
    if not (M.PC and M.PC:IsValid() and M.Pawn and M.Pawn:IsValid()) then return true end
    local ok, changed = pcall(function()
        local p = M.PC.Pawn
        return not (p and p:IsValid()) or p:GetFullName() ~= M.Pawn:GetFullName()
    end)
    return ok and changed
end

-- The map off the screen, with its view and the creature icons. Only while its world still stands (a new body in
-- the same world, or the map turned off); after a world change the engine has already taken it away.
local function TakeOff()
    if M.UW and M.PC and M.PC:IsValid() then
        pcall(function() M.UW:RemoveFromParent() end)
        -- the old body may stay (another body possessed): its map view goes too, or it keeps a second one.
        -- Not while the HUD is hidden: the big map (M) may be using our view then.
        if M.Shown ~= false then
            pcall(function() if M.View and M.View:IsValid() then M.View:K2_DestroyComponent(M.View) end end)
        end
        M.View = nil
        -- a new map after a menu: the body and the world are the same, so the icons stay on their creatures and things
        if not M.Renew then Creatures.Drop() if M.Res then pcall(M.Res.Drop) end end
    end
    M.UW, M.W, M.Renew = nil, nil, nil
end

-- true when the map is to be on screen: the HUD is shown, the map is not hidden in the editor and not fully faded by
-- the immersive mode
local function Wanted(ctx)
    return M.Shown == true and (ctx.ById("runemap").Visible or ctx.Editing()) and ctx.Fade() > 0
end

-- The map hides with the game's HUD (menus, the big map): M.Shown follows the HUD, and a return from a menu asks
-- for a new map (M.Renew).
local function TrackHud(ctx)
    pcall(function()
        local V = ctx.ById("vitals").Instances[1]
        local shown = V and V:IsValid() and V:IsVisible()
        if shown ~= M.Shown then
            -- Back from a menu: the big map takes the map view over, and ours stays empty. Giving the view back
            -- (SetMapView, BroadcastMapView) made the map draw a marker for each thing again on top of the old ones:
            -- 142 markers became 2322 after 29 menus, 72 fps became 34 (measured in the game, 07-10-2026). So the map is
            -- built new after every menu. The icons were hidden with the HUD: both scans run in the next steps, not 2 and 10 s later.
            if shown and M.Shown == false then M.Renew, M.NextCreatures, M.NextRes = true, 0, 0 end
            M.Shown = shown
            -- the creature icons at once, not at the next scan: the big map must never show them
            if not shown then
                Creatures.HideAll()
                if M.Res then pcall(M.Res.HideAll) end
            end
        end
    end)
end

function M.Tick(ctx)
    Settings.Step()   -- what the key handlers asked for: a reset, a changed switch to save
    if not M.Set.Map then
        -- off in F8: nothing built, nothing searched. Turned on again, the build below runs as after a world change.
        if M.UW or M.W then TakeOff() M.Pawn, M.Map, M.Visible = nil, nil, nil ctx.Log("runemap: off") end
        if M.PendingZoom then Settings.ApplyZoom() end   -- the zoom keys still change the saved zoom
        M.Fails = 0
        return
    end
    if (M.Fails or 0) >= 3 then return end   -- three failed builds in this round
    if M.W and os.clock() > (M.NextPawnCheck or 0) then
        M.NextPawnCheck = os.clock() + 2
        if PawnChanged() then ctx.Log("runemap: the player has a new body, building again") M.Pawn = nil end
    end
    -- A menu's new map waits until the map is to be on screen: a build takes 12 to 17 ms, and a player with the map
    -- faded out or hidden paid that after every menu for a map nobody saw (measured 09-10-2026). The old map goes at
    -- once all the same: left standing, it kept the markers of every visit to the big map, 284 became 4138 in an
    -- hour, and the big map drew them all (log of 10-10-2026).
    if M.Renew and M.UW and not Wanted(ctx) then TakeOff() M.Owed = true end
    if M.Owed then
        TrackHud(ctx)
        if not Wanted(ctx) then
            if M.PendingZoom then Settings.ApplyZoom() end   -- the zoom keys still change the saved zoom
            return
        end
        M.Owed, M.NextBuild = nil, 0
    end
    if M.Renew or not (M.W and M.W:IsValid() and M.Pawn and M.Pawn:IsValid()) then
        if not M.Renew and os.clock() < (M.NextBuild or 0) then return end   -- a menu's new map does not wait
        M.NextBuild = os.clock() + 2
        TakeOff()
        local okR, ready = pcall(Ready, ctx)
        if okR and ready then Build(ctx) end
        return
    end
    if M.PendingZoom then Settings.ApplyZoom() end
    Settings.Apply(ctx)
    Look.ApplyOpacity(ctx)
    -- One of the three heavy jobs in a step, so their costs never add up in one frame: the set-up, or the creatures,
    -- or the resources. The one that waits runs a step later. The set-up only on a shown map: it needs a map on screen.
    if M.Visible and M.SetUpAt and os.clock() > M.SetUpAt then
        M.SetUpAt = nil
        Widget.SetUpAgain(ctx)
    elseif M.Visible and os.clock() > (M.NextCreatures or 0) then
        -- every 2 s, around the player (nearby.lua); the plugin moves the icons itself
        M.NextCreatures = os.clock() + 2.0
        local okC, errC = pcall(Creatures.Scan, ctx)
        if not okC then Once(ctx, "creatures", "runemap: creatures failed: " .. tostring(errC)) end
    -- ore, herbs, essence and rare trees (resources.lua): every 10 s; they do not move, only get used up. A scan
    -- cost 4 to 5 ms in the game (29-09-2026), too much every 3 s.
    elseif M.Res and M.Visible and os.clock() > (M.NextRes or 0) then
        M.NextRes = os.clock() + 10.0
        local okR, errR = pcall(M.Res.Scan, ctx, M)
        if not okR then Once(ctx, "resources", "runemap: resources failed: " .. tostring(errR)) end
    end
    TrackHud(ctx)
    -- Hidden in the editor: off the screen, not only see-through. The gold rings are outlines, and the game draws
    -- outlines at full strength inside a see-through parent: the rings stayed on screen (28-09-2026).
    -- Fully faded by the immersive mode: off the screen too, so the map costs no drawing and no scans; it fades through its colour only on the way out and back in.
    -- A map that is about to be built new stays off: it would show for one step and go again, which reads as a flash.
    local visible = Wanted(ctx) and not M.Renew
    if visible ~= M.Visible then
        -- shown again after a hidden stretch: set the map up again, as after the big map (the set-up needs a map on
        -- screen, and a collapsed one is not)
        if visible and M.Visible == false then M.SetUpAt = os.clock() + 0.3 end
        M.Visible = visible
        pcall(function() M.UW:SetVisibility(visible and 3 or 1) end)
    end
    -- in a dungeon the map is a radar (radar.lua): at every step, its arrow follows the body
    if M.Visible and M.Radar then
        local okD, errD = pcall(M.Radar.Tick, ctx, M)
        if not okD then Once(ctx, "radar", "runemap: radar failed: " .. tostring(errD)) end
    end
    if M.Visible then Look.UpdateNorth() end   -- every step, not at the clock's 2 per second: it follows the camera
    Look.Clock(ctx)   -- the time arrow on the ring
end

return M

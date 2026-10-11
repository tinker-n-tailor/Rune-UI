-- The look of RuneMap: the gold ring that is also the clock, the day and night band with its arrow, the north mark
-- and the diamonds. The middle of the night is at the top and noon at the bottom; the ring keeps the game's own
-- share of night (about a fifth), so dawn sits near 1 o'clock and dusk near 11.
-- A gold arrow between the two gold rings points at the time of day, and a bigger arrow with an N shows north.
-- runemap.lua calls BuildRing at each build, and UpdateNorth, ApplyOpacity and Clock from its step. The handles into
-- the ring (the rings, the marks, the arrows) are kept on the map's table, where runemap.lua drops them.

local P = {}
local M = nil   -- the map's own table (runemap.lua), given in Init

local D = 180                  -- map diameter; the art tool draws the band for the same size
local BOX = D + 44             -- the whole element: map, day band and gold rings
local C = BOX / 2
local R_DIAMOND, DIAMOND = D / 2 + 17, 16   -- the marks on the outer gold ring
-- The game's clock (probe of 27-09-2026): the day and night dial's material holds "Fill Amount", the share
-- of the day cycle gone (0 = dawn), and "Night Start", where night begins (0.795). The ring puts the middle of
-- the night at the top.
local NIGHT_START = 0.795

-- Unreal takes widget colours as linear light; our colours are the screen kind (sRGB). Sent as they
-- are, they come out pale (probe of 27-09-2026), so every colour here goes through Lin first.
local function Lin1(c) if c <= 0.04045 then return c / 12.92 end return ((c + 0.055) / 1.055) ^ 2.4 end
local function Lin(r, g, b, a) return { R = Lin1(r), G = Lin1(g), B = Lin1(b), A = a or 1.0 } end

local GOLD  = Lin(0.72, 0.57, 0.31)
local DARK  = Lin(0.08, 0.05, 0.03, 0.92)
local NONE  = { R = 0, G = 0, B = 0, A = 0 }

-- ring angle (degrees clockwise from the top) for a point of the day cycle (0 = dawn); ns is where night starts
local function FillToDeg(f, ns) return ((f - (ns + 1) / 2) * 360) % 360 end

-- A round Image: filled disc and/or outline, drawn by the brush itself (RoundedBox), inside a SizeBox
local function Disc(tree, name, size, fill, outline, width)
    local img = StaticConstructObject(StaticFindObject("/Script/UMG.Image"), tree, FName(name))
    local b = img.Brush
    b.DrawAs = 4   -- RoundedBox
    b.ImageSize = { X = size, Y = size }
    b.TintColor = { SpecifiedColor = fill, ColorUseRule = 0 }
    b.OutlineSettings.RoundingType = 1   -- half height radius: a circle
    b.OutlineSettings.Width = width or 0
    b.OutlineSettings.Color = { SpecifiedColor = outline or NONE, ColorUseRule = 0 }
    img:SetBrush(b)
    local box = StaticConstructObject(StaticFindObject("/Script/UMG.SizeBox"), tree, FName(name .. "Box"))
    box:SetWidthOverride(size)
    box:SetHeightOverride(size)
    box:SetContent(img)
    return box, img
end

-- Pictures drawn by tools/make-runemap-art.js: the day band, the time arrow, the north arrow and the diamonds.
-- Rings of small pieces came out jagged (27-09-2026), so these are smooth pictures. The band assumes the game's
-- night start of 0.795. The pictures ship with the mod; a missing one is logged and left out.
local ART_DIR = (RUNEUI_DIR or "ue4ss/Mods/RuneUI/") .. "Art/"
local ART_NIGHT_START = 0.795
-- The time arrow: 13 x 19 units seen, between the two gold rings and a little over both; a smaller one that
-- stayed inside the band was too tiny. It points out.
local NEEDLE_W, NEEDLE_H = 14.3, 21.5
local R_NEEDLE = D / 2 + 9.5
-- The north arrow: from the inner gold ring out past the outer one, so it is the biggest mark on the ring.
local R_NORTH, NORTH_SIZE = D / 2 + 14, 26
-- The camera's yaw at which north is at the top of the ring. The view needs InheritedYawOffset 90 to put the
-- camera's forward at the top, so the map's own top (north on the big map) is yaw -90. Checked in game
-- (29-09-2026): the mark and "Faces north" agree with the big map (M).
local NORTH_YAW = -90

local function LoadArt(ctx, name)
    local f = io.open(ART_DIR .. name, "rb")
    if not f then M.Once(ctx, "art" .. name, "runemap: picture missing: " .. ART_DIR .. name) return nil end
    f:close()
    local KRL = StaticFindObject("/Script/Engine.Default__KismetRenderingLibrary")
    local ok, tex = pcall(function() return KRL:ImportFileAsTexture2D(M.PC or FindFirstOf("GameInstance"), ART_DIR .. name) end)
    if ok and tex and tex:IsValid() then return tex end
    M.Once(ctx, "art" .. name, "runemap: picture not loaded: " .. name .. " " .. tostring(tex))
end

local function Picture(tree, name, tex, size)
    local img = StaticConstructObject(StaticFindObject("/Script/UMG.Image"), tree, FName(name))
    img:SetBrushFromTexture(tex, false)
    local b = img.Brush
    b.ImageSize = { X = size, Y = size }
    img:SetBrush(b)
    return img
end

local function AddCentred(ov, w)
    local s = ov:AddChildToOverlay(w)
    s:SetHorizontalAlignment(2)
    s:SetVerticalAlignment(2)
    return s
end

local function AddFilling(ov, w)
    local s = ov:AddChildToOverlay(w)
    s:SetHorizontalAlignment(0)
    s:SetVerticalAlignment(0)
    return s
end

local function Place(canvas, w, x, y, wd, ht)
    local s = canvas:AddChildToCanvas(w)
    s:SetAutoSize(false)
    s:SetSize({ X = wd, Y = ht })
    s:SetPosition({ X = x - wd / 2, Y = y - ht / 2 })
    return s
end

local function OnRing(r, deg)
    local a = math.rad(deg)
    return C + r * math.sin(a), C - r * math.cos(a)
end

---------------------------------------------------------------- the ring

function P.BuildRing(ctx, tree, map)
    local ov = StaticConstructObject(StaticFindObject("/Script/UMG.Overlay"), tree, FName("RU_MapStack"))
    pcall(function()
        AddCentred(ov, (Disc(tree, "RU_MapBack", D + 34, DARK)))
    end)
    M.BandNS = nil
    local bandTex = LoadArt(ctx, "runemap_band_clear.png")   -- the day fades out
    if bandTex then
        local bb = StaticConstructObject(StaticFindObject("/Script/UMG.SizeBox"), tree, FName("RU_MapBandBox"))
        bb:SetWidthOverride(BOX)
        bb:SetHeightOverride(BOX)
        bb:SetContent(Picture(tree, "RU_MapBandArt", bandTex, BOX))
        AddCentred(ov, bb)
    end
    -- the rings are kept: their outline ignores the widget's opacity, so the F9 opacity is set on them too
    local okR, errR = pcall(function()
        local box
        box, M.RingOut = Disc(tree, "RU_MapRingOut", D + 34, NONE, GOLD, 2.5)
        AddCentred(ov, box)
        box, M.RingIn = Disc(tree, "RU_MapRingIn", D + 4, NONE, GOLD, 2)
        AddCentred(ov, box)
    end)
    if not okR then ctx.Log("runemap: gold rings not drawn: " .. tostring(errR)) end
    local mb = StaticConstructObject(StaticFindObject("/Script/UMG.SizeBox"), tree, FName("RU_MapBox"))
    mb:SetWidthOverride(D)
    mb:SetHeightOverride(D)
    -- The game's map widget cost about 20 FPS at any zoom (28-09-2026). A retainer box draws it into a picture
    -- every second frame and shows that picture in between: about 10 FPS back, a little less smooth (the default).
    -- F8 "Smooth" turns the retainer off, so the map draws every frame again; "Fastest" draws every fourth (see
    -- mapsettings.lua Apply).
    local okRB, errRB = pcall(function()
        local rb = StaticConstructObject(StaticFindObject("/Script/UMG.RetainerBox"), tree, FName("RU_MapRetainer"))
        rb:SetRenderingPhase(0, 2)
        rb:SetContent(map)
        mb:SetContent(rb)
        M.Retainer = rb
    end)
    if okRB then ctx.Log("runemap: drawn through a retainer box") else
        ctx.Log("runemap: retainer box failed, drawn every frame: " .. tostring(errRB))
        mb:SetContent(map)
    end
    AddCentred(ov, mb)
    -- diamonds from the menu's trim on the left, right and bottom; the needle on top of everything
    local top = StaticConstructObject(StaticFindObject("/Script/UMG.CanvasPanel"), tree, FName("RU_MapMarks"))
    AddFilling(ov, top)
    M.Marks = top   -- radar.lua puts its arrow here
    local diaTex = LoadArt(ctx, "runemap_diamond.png")
    if diaTex then
        for _, deg in ipairs({ 90, 180, 270 }) do
            local x, y = OnRing(R_DIAMOND, deg)
            Place(top, Picture(tree, "RU_MapDiamond" .. deg, diaTex, DIAMOND), x, y, DIAMOND, DIAMOND)
        end
    end
    -- the creature diamonds: hidden pictures here hold them, so the engine keeps them while map icons use them
    M.EnemyTex, M.NeutralTex = LoadArt(ctx, "creature_enemy.png"), LoadArt(ctx, "creature_neutral.png")
    -- and the resource shapes (resources.lua), held the same way
    M.ResTex = { Ore = LoadArt(ctx, "resource_ore.png"), Herbs = LoadArt(ctx, "resource_herb.png"),
        Essence = LoadArt(ctx, "resource_essence.png"), Trees = LoadArt(ctx, "resource_tree.png"),
        Salvage = LoadArt(ctx, "resource_salvage.png") }
    for i, t in ipairs({ M.EnemyTex or false, M.NeutralTex or false, M.ResTex.Ore or false, M.ResTex.Herbs or false,
        M.ResTex.Essence or false, M.ResTex.Trees or false, M.ResTex.Salvage or false }) do
        if t then
            local keep = Picture(tree, "RU_MapKeep" .. i, t, 1)
            keep:SetVisibility(1)   -- collapsed
            AddCentred(ov, keep)
        end
    end
    -- the north mark, an arrow with the N cut into it; under the time arrow
    local northTex = LoadArt(ctx, "runemap_north.png")
    if northTex then
        local okM, errM = pcall(function()
            M.NorthImg = Picture(tree, "RU_MapNorth", northTex, NORTH_SIZE)
            M.NorthSlot = Place(top, M.NorthImg, C, C - R_NORTH, NORTH_SIZE, NORTH_SIZE)
        end)
        if not okM then ctx.Log("runemap: north mark not drawn: " .. tostring(errM)) end
    end
    -- the clock hand: a gold arrow on the day band that points out
    local needleTex = LoadArt(ctx, "runemap_needle.png")
    if needleTex then
        local okN, errN = pcall(function()
            local img = StaticConstructObject(StaticFindObject("/Script/UMG.Image"), tree, FName("RU_MapNeedle"))
            img:SetBrushFromTexture(needleTex, false)
            local b = img.Brush
            b.ImageSize = { X = NEEDLE_W, Y = NEEDLE_H }
            img:SetBrush(b)
            M.NeedleImg = img
            M.NeedleSlot = Place(top, img, C, C - R_NEEDLE, NEEDLE_W, NEEDLE_H)
        end)
        if not okN then ctx.Log("runemap: needle not drawn: " .. tostring(errN)) end
    end
    return ov
end

---------------------------------------------------------------- the time of day, read from the game's own dial

-- The one reader of the clock: the ring here and the day and night icon (dial.lua) both ask every half second, and a
-- read within CLOCK_SHARE of the last one gives that one's answer.
local CLOCK_SHARE = 0.4
local function ReadClock(ctx)
    local DN = ctx.ById("daynight").Instances[1]   -- finder.lua finds it; no scan of our own
    if not (DN and DN:IsValid()) then return nil end
    if os.clock() - (M.ClockAt or -1) < CLOCK_SHARE then return M.ClockFill, M.ClockNs end
    local root = DN.WidgetTree.RootWidget
    local bar, cursor = root:GetChildAt(0), root:GetChildAt(1)
    local angle = cursor.RenderTransform.Angle
    local vals = {}
    pcall(function()
        bar.Brush.ResourceObject.ScalarParameterValues:ForEach(function(_, e)
            local p = e:get()
            vals[p.ParameterInfo.Name:ToString()] = p.ParameterValue
        end)
    end)
    -- the share of the day gone; the pointer's angle is the same share of 360 degrees
    local fill = vals["Fill Amount"] or (angle / 360)
    local ns = math.max(0.15, math.min(0.9, vals["Night Start"] or NIGHT_START))
    M.ClockAt, M.ClockFill, M.ClockNs = os.clock(), fill % 1, ns
    return M.ClockFill, M.ClockNs
end

-- The time arrow on the band, twice a second
function P.Clock(ctx)
    if os.clock() < (M.NextClock or 0) then return end
    M.NextClock = os.clock() + 0.5
    local okC, fill, ns = pcall(ReadClock, ctx)
    if not okC then M.Once(ctx, "clock", "runemap: reading the clock failed: " .. tostring(fill)) return end
    if not fill then return end
    if ns ~= M.BandNS then
        if math.abs(ns - ART_NIGHT_START) > 0.01 then
            M.Once(ctx, "artns", "runemap: the game's night starts at " .. ns .. ", the band picture was drawn for " .. ART_NIGHT_START)
        end
        M.BandNS = ns
    end
    if not M.NeedleSlot then return end
    local deg = FillToDeg(fill, ns)
    if M.LastDeg and math.abs(deg - M.LastDeg) < 0.2 then return end
    M.LastDeg = deg
    local x, y = OnRing(R_NEEDLE, deg)
    M.NeedleSlot:SetPosition({ X = x - NEEDLE_W / 2, Y = y - NEEDLE_H / 2 })
    M.NeedleImg:SetRenderTransformAngle(deg)   -- the picture points up: out, when on top
end

---------------------------------------------------------------- the north mark and the opacity

-- The mark slides round the ring as the camera turns, and turns with its place, so it points out: the view sits on the camera arm, so its yaw is the
-- camera's. Facing north, the map's top is north, so the mark stays at the top.
function P.UpdateNorth()
    if not (M.NorthSlot and M.Set.Mark) then return end
    local deg = 0
    if not M.Set.North then
        local ok, yaw = pcall(function() return M.View:K2_GetComponentRotation().Yaw end)
        if not ok or type(yaw) ~= "number" then return end
        deg = (NORTH_YAW - yaw) % 360
    end
    if M.LastNorth and math.abs(deg - M.LastNorth) < 0.5 then return end
    M.LastNorth = deg
    local x, y = OnRing(R_NORTH, deg)
    M.NorthSlot:SetPosition({ X = x - NORTH_SIZE / 2, Y = y - NORTH_SIZE / 2 })
    M.NorthImg:SetRenderTransformAngle(deg)
end

-- The F9 opacity. The whole map through its user widget, which leaves the editor's blinking (render opacity)
-- alone; the gold rings by their own colour, since outlines ignore the widget's opacity (28-09-2026).
-- The immersive mode's fade comes in here too (ctx.Fade), for the same reason.
-- The rings followed the opacity keys at once, with no change of visibility after SetBrush (seen in the game, 03-10-2026).
-- The tool bar's edges were not drawn again after SetBrush alone (see toolbar.lua). The reason for the
-- difference is not known. A probe wrote a red outline to the rings' brush and called SetBrush, with no change of
-- opacity: the screen kept the old colour for seconds (probe of 03-10-2026).
function P.ApplyOpacity(ctx)
    local op = (ctx.ById("runemap").Opacity or 1) * ctx.Fade()
    if op == M.Op then return end
    M.Op = op
    pcall(function() M.UW:SetColorAndOpacity({ R = 1, G = 1, B = 1, A = op }) end)
    for _, img in ipairs({ M.RingOut or false, M.RingIn or false }) do
        if img then
            pcall(function()
                local b = img.Brush
                b.OutlineSettings.Color = { SpecifiedColor = { R = GOLD.R, G = GOLD.G, B = GOLD.B, A = op }, ColorUseRule = 0 }
                img:SetBrush(b)
            end)
        end
    end
end

-- ReadClock is the map's (dial.lua reads the time through it). H: the helpers and the numbers that the map's other
-- files, resources.lua and radar.lua share with the look.
function P.Init(map)
    M = map
    M.ReadClock = ReadClock
    M.H = { Picture = Picture, Place = Place, C = C, NORTH_YAW = NORTH_YAW, D = D, BOX = BOX }
end

return P

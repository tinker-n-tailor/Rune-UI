-- The face of a buff: its icon, which is also its timer (buffs.lua builds the entry and looks at it). The game's own
-- icon is unseen. The face is three copies of one picture: a dark one under it, one for the time that is over, and a
-- whole one on top in a box that cuts it. The box moves down and the whole copy moves up by as much, so the copy
-- stands still and loses its top.
-- The picture is the mod's own flat icon for a buff that the mod knows by name (tools/art-buffs.js draws them), and
-- the game's picture for any other buff. The mod's icon has a second picture, the icon grown on every side: the dark
-- copy takes it and is an edge all around, and the copy for the time that is over is a plain grey. So the whole icon
-- shows on a dark and on a bright ground. The game's picture has no grown one: its dark copy is a shadow to the side
-- and its copy for the time that is over is faint.
-- A debuff takes the colour that the game gives its bar (the vector "Bar Color 1" of the bar's material), as bright
-- as it goes: the whole copy is multiplied by it. A good buff keeps the plain colour. So does a buff whose bar the
-- game hides: that bar holds a test pink.

local M = {}

local FILES = {
    STATUS_EFFECT_Bleeding = "buff_bleed.png", STATUS_EFFECT_Burning = "buff_burn.png", STATUS_EFFECT_Chilled = "buff_cold.png",
    STATUS_EFFECT_Cold = "buff_cold.png", STATUS_EFFECT_Cosiness = "buff_cosy.png", STATUS_EFFECT_Encumbered = "buff_weight.png",
    STATUS_EFFECT_HealthRegen = "buff_regen.png", STATUS_EFFECT_OverEating = "buff_over.png", STATUS_EFFECT_Poisoned = "buff_poison.png",
    STATUS_EFFECT_Prayer = "buff_prayer.png", STATUS_EFFECT_Sheltered = "buff_shelter.png", STATUS_EFFECT_Shocked = "buff_shock.png",
    STATUS_EFFECT_Slow = "buff_slow.png", STATUS_EFFECT_SoulRIft = "buff_wither.png", STATUS_EFFECT_SoulScourge = "buff_soul.png",
    STATUS_EFFECT_WellRested = "buff_rested.png" }
-- The art inside a picture, as shares of the picture: the empty edge does not empty. The mod's icons fill the box of
-- 24 from 3 to 21, and the box is the middle two thirds of the picture. The game's art starts 5 of the 42 units down
-- and is 26 high on the Cosiness icon; 27 leaves room for a taller one.
local ART_OURS, ART_GAME = { Top = 0.25, H = 0.5 }, { Top = 5 / 42, H = 27 / 42 }
-- The plain colour, as linear light: the cream #f3e6c4 for the mod's white icons, nothing for the game's pictures.
local PLAIN_OURS, PLAIN_GAME = { R = 0.896, G = 0.791, B = 0.552 }, { R = 1, G = 1, B = 1 }
local SPENT = 0.38                          -- how much of the game's picture shows for the time that is over
local SHADE, SHADE_OFF = { R = 0, G = 0, B = 0, A = 0.85 }, 1.5
-- The mod's icons, as linear light: the edge #17130d and the grey #8f897b of the time that is over
local EDGE, GREY = { R = 0.0086, G = 0.0065, B = 0.0040, A = 0.92 }, { R = 0.275, G = 0.251, B = 0.198, A = 1.0 }
local SHOWN = 4                             -- the visibility of a bar that the game shows
local Art, Missing = {}, {}                 -- the mod's pictures by file, and the files that did not load

-- The mod's two pictures for the buff of this name, the icon and its edge, or nil: the name is not known, or a file
-- did not load.
function M.Picture(name, outer, CachedTex, Log)
    local file = name and FILES[name]
    if not file or Missing[file] then return nil end
    local dir = (RUNEUI_DIR or "ue4ss/Mods/RuneUI/") .. "Art/"
    local edgeFile = string.gsub(file, "%.png$", "_edge.png")
    local ok, tex, edge = pcall(function()
        return CachedTex(Art, file, outer, dir .. file), CachedTex(Art, edgeFile, outer, dir .. edgeFile)
    end)
    if ok then
        if tex and edge then return tex, edge end
        return nil
    end
    Missing[file] = true
    Log("buff picture: " .. tostring(tex))
end

-- The face, as large as the game's icon and moved up by lift. Its parts go into d: Face, Shade, Spent, Cut, Lit.
function M.Build(tree, G, d, size, lift)
    local face = StaticConstructObject(StaticFindObject("/Script/UMG.Overlay"), tree, G("RU_BuffFace"))
    local function Copy(name) return StaticConstructObject(StaticFindObject("/Script/UMG.Image"), tree, G(name)) end
    local function Add(w)
        local s = face:AddChildToOverlay(w)
        s:SetHorizontalAlignment(2) s:SetVerticalAlignment(2)
    end
    d.Shade, d.Spent, d.Lit = Copy("RU_BuffShade"), Copy("RU_BuffSpent"), Copy("RU_BuffLit")
    d.Cut =StaticConstructObject(StaticFindObject("/Script/UMG.SizeBox"), tree, G("RU_BuffCut"))
    d.Cut:SetWidthOverride(size)
    d.Cut:SetHeightOverride(size)
    d.Cut:SetContent(d.Lit)
    d.Cut:SetClipping(1)   -- clip to its box
    -- an Overlay draws its last child last
    Add(d.Shade) Add(d.Spent) Add(d.Cut)
    face:SetRenderTranslation({ X = 0, Y = lift })
    face:SetRenderOpacity(0.0)   -- an Image without a picture is a plain box
    d.Face, d.Size = face, size
end

-- The picture in a copy, as large as the icon. The size is in the brush: with a wanted size on the Image the two
-- loose copies stayed 32 units, and showed smaller behind the whole copy, which its box stretches (in game, 13-10-2026).
local function Paint(img, tex, size)
    img:SetBrushFromTexture(tex, false)
    local b = img.Brush
    b.ImageSize = { X = size, Y = size }
    img:SetBrush(b)
end

function M.Alive(d)
    return d.Face:IsValid() and d.Shade:IsValid() and d.Spent:IsValid() and d.Cut:IsValid() and d.Lit:IsValid()
end

-- edge: the grown picture of the mod's own icon; nil for the game's picture
function M.SetPicture(d, tex, edge)
    local off = edge and 0 or SHADE_OFF
    Paint(d.Shade, edge or tex, d.Size)
    d.Shade:SetColorAndOpacity(edge and EDGE or SHADE)
    d.Shade:SetRenderTranslation({ X = off, Y = off })
    Paint(d.Spent, tex, d.Size)
    Paint(d.Lit, tex, d.Size)
    d.Ours, d.Time = edge and true or false, nil
end

local function Tint(d)
    local plain = d.Ours and PLAIN_OURS or PLAIN_GAME
    local mid = d.Bar.Brush.ResourceObject
    if d.Positive or d.Bar:GetVisibility() ~= SHOWN or not (mid and mid:IsValid()) then return plain end
    local c
    mid.VectorParameterValues:ForEach(function(_, e)
        local p = e:get()
        if p.ParameterInfo.Name:ToString() == "Bar Color 1" then
            local v = p.ParameterValue
            c = { R = v.R, G = v.G, B = v.B }
        end
    end)
    local most = c and math.max(c.R, c.G, c.B) or 0
    if most <= 0 then return plain end
    return { R = c.R / most, G = c.G / most, B = c.B / most }
end

-- d: the entry of buffs.lua (Bar, Positive, and the face). f: the share of time left, nil when not known.
-- Written only when the cut or the colour changes.
function M.Show(d, f, size)
    local art = d.Ours and ART_OURS or ART_GAME
    local hide = (f and f < 1) and size * (art.Top + art.H * (1 - f)) or 0
    local t = Tint(d)
    local key = string.format("%.1f %.2f %.2f %.2f", hide, t.R, t.G, t.B)
    if key == d.Time then return end
    d.Cut:SetRenderTranslation({ X = 0, Y = hide })
    d.Lit:SetRenderTranslation({ X = 0, Y = -hide })
    d.Spent:SetColorAndOpacity(d.Ours and GREY or { R = t.R, G = t.G, B = t.B, A = SPENT })
    d.Lit:SetColorAndOpacity({ R = t.R, G = t.G, B = t.B, A = 1.0 })
    d.Time = key
end

-- a new world: the old world's pictures are gone
function M.Forget() Art, Missing = {}, {} end

return M

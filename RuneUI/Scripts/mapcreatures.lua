-- Creatures on RuneMap: red diamonds for enemies, green for neutral animals. Each creature gets the map plugin's own
-- icon, so the plugin draws it in the right place every frame; the mod only adds icons and hides dead ones, every 2 s
-- while the map is on screen. (The MiniMap addon draws its diamonds from a native hook, which breaks with every game patch.)
-- runemap.lua calls Scan, and Drop, Forget and HideAll as it does for the resources (resources.lua, the sibling of
-- this file, which makes its icons with MapIcon here). Which creatures are near, nearby.lua decides (M.Near).

local P = {}
local M = nil   -- the map's own table (runemap.lua), given in Init

local ICON_CLASS = "/Script/MinimapPlugin.MapIconComponent"
local CREATURE_SIZE = 8       -- used only when the icon has no default size to scale from
-- the share of the icon's default size (the default looked far too big); 0.6 was right at an icon scale of 0.54
-- (27-09-2026), so our icons keep that size when the scale changes (the resources use the same). Init works it out
-- from the map's icon scale (mapwidget.lua).
local CREATURE_SHARE = nil
local Creatures = {}   -- full name -> { Icon, Shown }

-- A map icon on an actor, for the creatures and for resources.lua. Returns the icon, nil when the actor is being
-- removed (log, 28-09-2026): the caller tries again on the next scan. Then whether the picture was set, and the
-- error if not. cls: the icon class, when the caller has looked it up already.
local function MapIcon(A, tex, cls)
    local T = { Rotation = { X = 0, Y = 0, Z = 0, W = 1 }, Translation = { X = 0, Y = 0, Z = 0 }, Scale3D = { X = 1, Y = 1, Z = 1 } }
    local icon = A:AddComponentByClass(cls or StaticFindObject(ICON_CLASS), false, T, false)
    if not (icon and icon:IsValid()) then return nil end
    local okT, errT = pcall(function() icon:SetIconTexture(tex) end)
    -- The plugin's own size unit is unknown: its default drew them far too big, 8 drew nothing
    -- (27-09-2026). So the size is a share of the icon's own default. SetIconSize takes two values
    -- ("expected 2 parameters"): width and height, or a size and a flag.
    local def = nil
    pcall(function() local s = icon.IconSize def = (type(s) == "number") and s or s.X end)
    local size = (def and def > 0) and def * CREATURE_SHARE or CREATURE_SIZE
    if not pcall(function() icon:SetIconSize(size, size) end) then
        pcall(function() icon:SetIconSize(size, true) end)
    end
    return icon, okT, errT
end

-- Take our icons off the creatures while the world still stands (a respawn, a new body): otherwise each
-- creature gets a second icon on the next scan, and the old ones stay, on dead creatures too.
function P.Drop()
    for _, c in pairs(Creatures) do
        pcall(function() if c.Icon:IsValid() then c.Icon:K2_DestroyComponent(c.Icon) end end)
    end
    Creatures = {}
end

-- a new world: the engine has already freed the old icons; only the handles go
function P.Forget() Creatures = {} end

-- the game's HUD went away (the big map, a menu): hide at once, not at the next scan: the big map must never show them
function P.HideAll()
    for _, c in pairs(Creatures) do
        c.Shown = nil   -- the next scan decides again
        pcall(function() if c.Icon:IsValid() then c.Icon:SetIconVisible(false) end end)
    end
end

function P.Scan(ctx)
    -- off: no icons and no search at all
    if ctx.ById("creatures").Visible == false then
        if next(Creatures) then P.Drop() end
        return
    end
    if not (M.EnemyTex and M.NeutralTex and M.Near) then return end
    local cls = StaticFindObject(ICON_CLASS)
    if not (cls and cls:IsValid()) then M.Once(ctx, "iconclass", "runemap: no map icon class, no creatures") return end
    -- the layout's switch, the F8 row Creatures (they show at every zoom, also the farthest). Hidden while
    -- the game's HUD is hidden: the big map (M) draws every map icon too, and there it showed every creature in
    -- the world, which reads like a radar (28-09-2026).
    local show = ctx.ById("creatures").Visible ~= false and M.Shown == true
    local seen, added = {}, 0
    for _, e in ipairs(M.Near.Creatures(ctx, M.Pawn)) do
        pcall(function()
            local A, n = e.A, e.Name
            seen[n] = true
            local c = Creatures[n]
            if c and not c.Icon:IsValid() then Creatures[n], c = nil, nil end   -- its icon is gone: add a new one
            if not c then
                if added >= 8 then return end   -- a few per scan, so a crowd does not stall one frame
                added = added + 1
                local neutral = e.Group == "Calm"
                local icon, okT, errT = MapIcon(A, neutral and M.NeutralTex or M.EnemyTex, cls)
                if not icon then return end
                if not okT then M.Once(ctx, "icontex", "runemap: creature icon picture failed: " .. tostring(errT)) end
                c = { Icon = icon, Shown = nil, Neutral = neutral }
                Creatures[n] = c
            end
            local want = show and not e.Dead and (M.Set.Neutral or not c.Neutral)   -- F8: enemies only
            if want ~= c.Shown and c.Icon:IsValid() then
                c.Shown = want
                pcall(function() c.Icon:SetIconVisible(want) end)
            end
        end)
    end
    -- out of reach or gone from the world: its icon goes too (a creature coming back would get a second one), and
    -- the handle is forgotten before the engine frees it
    for n, c in pairs(Creatures) do
        if not seen[n] then
            pcall(function() if c.Icon:IsValid() then c.Icon:K2_DestroyComponent(c.Icon) end end)
            Creatures[n] = nil
        end
    end
end

-- after mapwidget.lua's Init, which gives the icon scale
function P.Init(map)
    M = map
    CREATURE_SHARE = 0.6 * 0.54 / M.H.ICON_SCALE
    M.H.MapIcon = MapIcon
end

return P

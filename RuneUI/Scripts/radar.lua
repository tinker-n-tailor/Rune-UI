-- RuneMap in a dungeon. The game has no map picture of a dungeon: it moves the player some kilometres out of the
-- drawn world, or under it, and parks the player's own map icon at the entrance (probes of 10-10-2026: 6 and 8 km
-- away in two dungeons, 0 m in the open world). RuneMap follows the real place of the player, so it showed the
-- game's sea picture (a flat grey) or the land above, and no arrow in the middle.
-- While that icon is more than FAR metres from the player, the map is a radar: the sea picture gets a dark tint, the
-- land is off, and an arrow of ours with the game's own picture turns in the middle. The parked icon is left alone: it
-- is out of the map's reach, or it shows where the entrance is above. The creatures and the resources are the
-- mod's own icons on the real things, so they are right in a dungeon. Leaving gives every part back what it had.
-- runemap.lua calls Tick at every step while the map is on screen, and passes itself for the map, the player, the
-- settings and its helpers. A map built new (after every menu) starts as the game's: NewMap drops our record of it.

local M = {}

local SELF_PICTURE = "T_NavIcons_Player_Self"
local FAR = 100                 -- metres between the player and the icon that mean "in a dungeon"
local LOOK = 1.0                -- seconds between two looks at the distance
local ICON_RETRY = 3.0          -- seconds between two searches for the icon while it is not found
local ARROW = 16                -- the game's arrow: IconSize 40 at the map's icon scale of 0.4
local TINT = { R = 0.12, G = 0.09, B = 0.07, A = 1 }   -- on the sea picture: a warm dark that keeps a little of its texture
local HIDDEN, SEEN = 1, 3       -- ESlateVisibility: collapsed, hit-test invisible
local MAX_ICONS = 3000

local function Alive(o) return o and o:IsValid() end   -- a property or a call can give a wrapper of null: pcall does not catch it

-- metres between two places (engine vectors, in cm)
function M.Apart(a, b)
    return math.sqrt((a.X - b.X) ^ 2 + (a.Y - b.Y) ^ 2 + (a.Z - b.Z) ^ 2) / 100
end

-- The turn of the arrow, clockwise from the top, for a body that faces bodyYaw on a map whose top is upYaw
function M.Angle(bodyYaw, upYaw) return (bodyYaw - upYaw) % 360 end

local Icon = nil       -- the player's own map icon, the game's component
local NextLook, NextIcon = 0, 0
-- On: what we changed on the live map, with what each part had (Sea, SeaWas, Land, LandWas).
-- Arrow: our arrow on the live map (Img, Deg); it stays for the next visit.
local On, Arrow = nil, nil

local function FindIcon()
    local found, n = nil, 0
    local lib = StaticFindObject("/Script/MinimapPlugin.Default__MapFunctionLibrary")
    local tracker = lib:GetMapTracker(FindFirstOf("GameInstance"))
    if not Alive(tracker) then return nil end
    tracker.MapIcons:ForEach(function(_, e)
        n = n + 1
        if found or n > MAX_ICONS then return end
        pcall(function()
            local c = e:get()
            if not Alive(c) then return end
            local tex = c.IconTexture
            if Alive(tex) and tex:GetFName():ToString() == SELF_PICTURE then found = c end
        end)
    end)
    return found
end

-- true in a dungeon, false in the open world, nil while the icon or the player cannot be read
local function Inside(Map, now)
    if not Alive(Icon) then
        Icon = nil
        if now < NextIcon then return nil end
        NextIcon = now + ICON_RETRY
        local ok, c = pcall(FindIcon)
        if not (ok and c) then return nil end
        Icon = c
    end
    if not Alive(Map.Pawn) then return nil end
    return M.Apart(Map.Pawn:K2_GetActorLocation(), Icon:K2_GetComponentLocation()) > FAR
end

local function ShowArrow(Map)
    if not Arrow then
        local tex = Icon.IconTexture
        if not Alive(tex) then return end
        local img = Map.H.Picture(Map.UW.WidgetTree, "RU_MapSelf", tex, ARROW)
        Map.H.Place(Map.Marks, img, Map.H.C, Map.H.C, ARROW, ARROW)
        Arrow = { Img = img }
    end
    Arrow.Img:SetVisibility(SEEN)
end

local function Enter(ctx, Map)
    local map = Map.Map
    On = {}
    local sea = map.Image_OpaqueBackground
    if Alive(sea) then
        local c = sea.ColorAndOpacity
        On.Sea, On.SeaWas = sea, { R = c.R, G = c.G, B = c.B, A = c.A }
        sea:SetColorAndOpacity(TINT)
    end
    local land = map.Canvas_Backgrounds
    if Alive(land) then
        On.Land, On.LandWas = land, land:GetVisibility()
        land:SetVisibility(HIDDEN)
    end
    if Alive(Map.Marks) then ShowArrow(Map) end
    ctx.Log("radar: in a dungeon, the map is a radar")
end

local function Leave(ctx)
    local o = On
    On = nil
    if Alive(o.Sea) then o.Sea:SetColorAndOpacity(o.SeaWas) end
    if Alive(o.Land) then o.Land:SetVisibility(o.LandWas) end
    if Arrow and Alive(Arrow.Img) then Arrow.Img:SetVisibility(HIDDEN) end
    ctx.Log("radar: out of the dungeon, the map is the game's again")
end

-- The arrow follows the body at every step; a write only for a turn of a degree or more
local function Turn(Map)
    if not (Arrow and Alive(Arrow.Img) and Alive(Map.Pawn)) then return end
    local up = Map.H.NORTH_YAW
    if not Map.Set.North then
        if not Alive(Map.View) then return end
        up = Map.View:K2_GetComponentRotation().Yaw
    end
    local deg = M.Angle(Map.Pawn:K2_GetActorRotation().Yaw, up)
    if Arrow.Deg and math.abs(deg - Arrow.Deg) < 1 then return end
    Arrow.Deg = deg
    Arrow.Img:SetRenderTransformAngle(deg)
end

function M.Tick(ctx, Map)
    local now = os.clock()
    if now >= NextLook then
        NextLook = now + LOOK
        local inside = Inside(Map, now)
        if inside and not On then Enter(ctx, Map) elseif inside == false and On then Leave(ctx) end
    end
    if On then Turn(Map) end
end

-- The map was built new or is gone: the old one is thrown away as it is, so nothing is called on it. The next step looks at once.
function M.NewMap() On, Arrow, NextLook = nil, nil, 0 end

-- A new world or a player restart: the icon is found again
function M.Forget() Icon, NextIcon = nil, 0 M.NewMap() end

return M

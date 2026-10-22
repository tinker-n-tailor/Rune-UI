// Tests compass part two (compass.lua) without the game. First the rules: where a mark sits for a bearing and a yaw,
// the wrap at 180 degrees, the fade at the edge, size and opacity by distance, which groups show, and when the marks and
// the chain of calls run. Then the part that builds in the game's compass, run against stand-ins for the game's widgets:
// built once, a pool of marks reused, a mark past the edge not shown, a value written only when it changed (a size is a
// scale, never a new brush), a call of the chain that does nothing when the yaw and the player did not change, the places
// of the creatures read at the step and not in the paint, a chain that arms while marks show and ends when they do not, everything off the compass and the middle mark's colour put back on
// Forget(true), and nothing touched on Forget(false).
// Needs fengari. Run: node tools/test-compass.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = require('path').join(__dirname, '..', 'RuneUI', 'Scripts');
const src = fs.readFileSync(require('path').join(dir, 'compass.lua'), 'utf8');
const goldline = fs.readFileSync(require('path').join(dir, 'goldline.lua'), 'utf8');
const chain = fs.readFileSync(require('path').join(dir, 'chain.lua'), 'utf8');
const test = `
os.time = function() return 7 end   -- the stamp in each name
local M = load(SRCTEXT)()
local function check(name, cond) if not cond then error("FAIL " .. name, 2) end print("ok   " .. name) end
local function near(a, b, eps) return a ~= nil and math.abs(a - b) <= (eps or 0.001) end
local function at(deg, dist) local r = math.rad(deg) return dist * math.cos(r), dist * math.sin(r) end   -- dx, dy of a thing at a bearing

---- where a mark sits
check("offset: straight ahead is the middle", near(M.Offset(1, 0, 0), 0))
check("offset: north is -Y, and the yaw that faces it is -90", near(M.Offset(0, -1, -90), 0))
check("offset: 5.33 units for one degree, a thing to the right of the view is on the right", near(M.Offset(1, 0, -10), 53.3))
check("offset: to the left, negative", near(M.Offset(1, 0, 10), -53.3))
check("wrap: bearing 179 and yaw -179 are 2 degrees apart (to the left), not 358", near(M.Offset(math.cos(math.rad(179)), math.sin(math.rad(179)), -179), -2 * 5.33, 0.01))
check("wrap: bearing -179 and yaw 179 are 2 degrees apart the other way (to the right)", near(M.Offset(math.cos(math.rad(-179)), math.sin(math.rad(-179)), 179), 2 * 5.33, 0.01))
check("wrap: a yaw past 180 gives the same place", near(M.Offset(1, 0, 350), M.Offset(1, 0, -10)))
check("wrap: straight behind is at the end of the range, never past 180 degrees", math.abs(M.Offset(-1, 0, 0)) <= 180 * 5.33 + 0.001)

---- how it shows: nil past the edge, a fade over the last 40 units
local dx, dy = at(0, 1000)
check("look: ahead, in the middle", M.Look(dx, dy, 0) ~= nil)
dx, dy = at(60, 100)
check("look: 60 degrees is 320 units, past the edge: not shown", M.Look(dx, dy, 0) == nil)
dx, dy = at(56.3, 100)   -- 300.1 units
check("look: at the edge itself: not shown", M.Look(dx, dy, 0) == nil)
local px, size, op
dx, dy = at(50, 0.0001)    -- 266.5 units: 33.5 units from the edge, so 0.84 of its opacity
px, size, op = M.Look(dx, dy, 0)
check("look: inside the fade the opacity falls", near(px, 266.5, 0.1) and near(op, 0.84, 0.01))
dx, dy = at(52.5, 0.0001)  -- 279.8 units: halfway through the fade
px, op = select(1, M.Look(dx, dy, 0)), select(3, M.Look(dx, dy, 0))
check("look: halfway through the fade, half the opacity", near(op, 0.5, 0.02))
dx, dy = at(45, 0.0001)    -- 239.9 units: before the fade
check("look: before the fade, full opacity", near(select(3, M.Look(dx, dy, 0)), 1, 0.001))
dx, dy = at(-50, 0.0001)
check("look: the left side fades the same way", near(select(3, M.Look(dx, dy, 0)), 0.84, 0.01) and near(select(1, M.Look(dx, dy, 0)), -266.5, 0.1))

---- far is smaller and dimmer
local function Far(d) local x, y = at(0, d) return select(2, M.Look(x, y, 0)), select(3, M.Look(x, y, 0)) end
size, op = Far(0.001)
check("far: at your feet, the full scale and fully solid", near(size, 1, 0.001) and near(op, 1, 0.001))
size, op = Far(3000)
check("far: 30 m, 0.8 of the size and 0.75", near(size, 0.8, 0.001) and near(op, 0.75, 0.01))
size, op = Far(6000)
check("far: 60 m, 0.6 of the size and half as solid", near(size, 0.6, 0.001) and near(op, 0.5, 0.01))
size, op = Far(10000)
check("far: past 60 m it stays at the smallest and dimmest", near(size, 0.6, 0.001) and near(op, 0.5, 0.01))
dx, dy = at(50, 6000)
check("far: the distance and the edge fade multiply", near(select(3, M.Look(dx, dy, 0)), 0.5 * 0.84, 0.01))
px, size, op = M.Look(1000, 1, 0)
check("look: values are rounded, so a tiny turn is not a write", px == math.floor(px * 10 + 0.5) / 10 and near(op * 100, math.floor(op * 100 + 0.5), 1e-6)
    and near(size * 20, math.floor(size * 20 + 0.5), 1e-6))

---- which groups, and when
local g = M.Groups({ Neutral = false, Ore = true, Herbs = true, Essence = false, Trees = true }, true)
check("groups: enemies only", g.Enemy == true and g.Calm == false)
check("groups: the resources by the map settings", g.Ore == true and g.Herbs == true and g.Essence == false and g.Trees == true)
g = M.Groups({ Neutral = true, Ore = false, Herbs = false, Essence = false, Trees = false }, true)
check("groups: all creatures", g.Enemy == true and g.Calm == true)
g = M.Groups({ Neutral = true, Ore = true, Herbs = true, Essence = true, Trees = true }, false)
check("groups: creatures off, whatever the neutral setting", g.Enemy == false and g.Calm == false and g.Ore == true)
check("groups: settings that are not there are off", M.Groups({}, false).Ore == false)
local ALL, NONE = M.Groups({ Ore = true }, true), M.Groups({}, false)
check("marks: the compass shown, the map not, a group on", M.MarksOn(true, false, ALL) == true)
check("marks: the map on the screen, none", M.MarksOn(true, true, ALL) == false)
check("marks: the compass not shown, none", M.MarksOn(false, false, ALL) == false)
check("marks: every group off, none", M.MarksOn(true, false, NONE) == false)
check("chain: runs with marks on show and a thing to place", M.Runs(true, 1) == true)
check("chain: not without a thing, not when the marks are off", not M.Runs(true, 0) and not M.Runs(false, 5))

---- the part that builds in the game: stand-ins
local now = 0
os.clock = function() return now end
collectgarbage = function() return 0 end   -- fengari has no collector
FName = function(s) return s end
local made = {}
local Widget = {}
local SETTER = { SetVisibility = "Vis", SetRenderTranslation = "T", SetRenderScale = "Scale", SetRenderOpacity = "Op", SetColorAndOpacity = "Color", SetBrushFromTexture = "Tex" }
local function Copy(a)   -- the engine copies a struct during the call, so a table that is written again later must not be kept
    if type(a) ~= "table" then return a end
    local c = {}
    for k, v in pairs(a) do c[k] = v end
    return c
end
local function NewW(name)
    return setmetatable({ Name = name, N = 0, Brush = { ImageSize = { X = 0, Y = 0 }, UVRegion = { Min = { X = 0, Y = 0 }, Max = { X = 0, Y = 0 } }, Mirroring = 0 } }, Widget)
end
Widget.__index = function(_, k)
    if k == "IsValid" then return function(self) return self.Alive ~= false end end
    if not string.find(k, "^Set") and not string.find(k, "^Add") and k ~= "RemoveFromParent" then return nil end   -- other names are data
    return function(self, a)
        self.N = self.N + 1
        if SETTER[k] then self[SETTER[k]] = Copy(a) end
        if k == "SetBrush" then self.Brush, self.BrushWrites = Copy(a), (self.BrushWrites or 0) + 1 end
        if k == "RemoveFromParent" then self.Removed = (self.Removed or 0) + 1 end
        if string.find(k, "^AddChild") then self.Kids = (self.Kids or 0) + 1 return NewW("slot") end
    end
end
StaticFindObject = function() return {} end
StaticConstructObject = function(_, _, name) local w = NewW(name) made[#made + 1] = w return w end
local function Find(prefix)   -- the newest widget whose name starts so
    for i = #made, 1, -1 do if string.find(made[i].Name, prefix, 1, true) == 1 then return made[i] end end
end
local function Count(prefix) local n = 0 for _, w in ipairs(made) do if string.find(w.Name, prefix, 1, true) == 1 then n = n + 1 end end return n end
local function Touches(list) local n = 0 for _, w in ipairs(list) do n = n + w.N end return n end

local fullNames = 0   -- how often the name of a compass was read from the widget
local function Compass(name)
    local host, icons, strip, dia, c = NewW("Overlay_1"), NewW("CompassBottomIconOverlay"), NewW("strip"), NewW("diamond"), NewW("compass")
    strip.GetParent = function() return host end
    dia.ColorAndOpacity = { R = 0.2, G = 0.3, B = 0.4, A = 0.5 }
    c.WidgetTree, c.CompassRetainerBox, c.CompassBottomIconOverlay, c.DirectionalDiamond = NewW("tree"), strip, icons, dia
    c.GetFullName = function() fullNames = fullNames + 1 return name end
    return { W = c, Name = name, Host = host, Icons = icons, Dia = dia }
end

local queue = {}
local function Drain()   -- the game thread runs what was armed, once each
    local q = queue
    queue = {}
    for _, f in ipairs(q) do now = now + 0.008 f() end
end
local actorReads, controllerCalls = 0, 0   -- how often a creature's place, and the controller, were asked for
local function Thing(group, x, y, dead)
    local a = { P = { X = x, Y = y, Z = 0 } }
    function a:IsValid() return self.Alive ~= false end
    function a:K2_GetActorLocation() actorReads = actorReads + 1 return { X = self.P.X, Y = self.P.Y, Z = self.P.Z } end
    return { A = a, Name = group .. x .. y, Group = group, Dead = dead == true, Empty = false }
end
local creatures, resources, searches = {}, {}, { c = 0, r = 0 }
local forgets = 0
local Near = { Creatures = function() searches.c = searches.c + 1 return creatures end,
    Resources = function() searches.r = searches.r + 1 return resources, #resources end,
    Forget = function() forgets = forgets + 1 end }
local rot = { Yaw = 0 }
local playerAt = { X = 0, Y = 0, Z = 0 }
local pawn = { K2_GetActorLocation = function() return { X = playerAt.X, Y = playerAt.Y, Z = playerAt.Z } end, IsValid = function() return true end }
local pc = { IsValid = function() return true end, Pawn = pawn, ControlRotation = rot }
local game = Compass("WBP_HUD_Compass_C_1")
local state = { Compass = game, MapShown = false, CreaturesOn = true, Fail = false, Soon = true }
local set = { Neutral = true, Ore = true, Herbs = true, Essence = true, Trees = true }
local logs, files, nameCount = {}, {}, 0
local ctx = { Log = function(m) logs[#logs + 1] = m end,
    ById = function() return { Visible = state.CreaturesOn } end,
    G = function(n) nameCount = nameCount + 1 return n .. "_" .. nameCount end,
    Asset = function() return NewW("linetex") end,
    CachedTex = function(cache, key, _, file)
        if state.NoPictures then error("picture not loaded: " .. file) end
        files[#files + 1] = file
        cache[key] = cache[key] or NewW("tex" .. key)
        return cache[key]
    end,
    Controller = function() controllerCalls = controllerCalls + 1 return pc end, Near = Near,
    Compass = function() if state.Compass then return state.Compass.W, state.Compass.Name end return nil end,
    MapShown = function() return state.MapShown end, Set = function() return set end }
ctx.Soon = function(_, fn) queue[#queue + 1] = fn end
ctx.Chain = load(CHAINTEXT)()
ctx.GoldLine = load(GOLDTEXT)()
ctx.GoldLine.PATH = "/Game/Art/UI/Loading/T_Trim_Line_Gold.T_Trim_Line_Gold"
local function Tick(seconds) now = now + seconds M.Tick(ctx) end
-- time goes by while the chain runs, as in the game, and then the main loop takes a step
local function Run(seconds)
    for i = 1, math.floor(seconds / 0.1) do now = now + 0.1 Drain() end
    M.Tick(ctx)
end

local function pictures_salvage(list) return table.concat(list, " "):find("compass_salvage.png", 1, true) ~= nil end
-- built once, with the gold style
Tick(0.1)
check("build: ready, logged once", #logs == 1 and logs[1] == "compass ready")
check("build: a pool of 40 marks, all collapsed", Count("RU_Cm7Mark") == 40 and Find("RU_Cm7Mark1_").Vis == 1 and Find("RU_Cm7Mark40_").Vis == 1)
check("build: every mark has its brush at the full size, written once", Find("RU_Cm7Mark1_").Brush.ImageSize.X == 34 and Find("RU_Cm7Mark40_").Brush.ImageSize.Y == 34
    and Find("RU_Cm7Mark1_").BrushWrites == 1 and Find("RU_Cm7Mark40_").BrushWrites == 1)
check("build: each of the seven pictures is loaded from its file and held by an image of the compass",
    #files == 7 and Count("RU_Cm7Hold") == 7 and pictures_salvage(files) and Find("RU_Cm7HoldEnemy").Vis == 1 and Find("RU_Cm7HoldEnemy").Tex ~= nil)
local pictures = table.concat(files, " ")
check("build: the compass's own pictures, the map's shapes without the dark outline", pictures:find("compass_enemy.png") and pictures:find("compass_neutral.png")
    and pictures:find("compass_ore.png") and pictures:find("compass_herb.png") and pictures:find("compass_essence.png") and pictures:find("compass_tree.png")
    and not pictures:find("resource_") and not pictures:find("creature_"))
local box = Find("RU_Cm7LineBox")
check("build: the gold line is a 620 x 22 box on the strip's overlay, shown, moved up 11.5", box.Vis == 3 and box.T.Y == -11.5 and box.Kids == nil and game.Host.Kids == 1)
local gold = 0
for _, w in ipairs(made) do
    if string.find(w.Name, "RU_Cm7Line_", 1, true) == 1 and w.Color and w.Color.R == 1.0 and w.Color.G == 0.638 and w.Color.B == 0.168 then gold = gold + 1 end
end
check("build: both halves of the line are tinted with the mod's gold", gold == 2)
check("build: the two halves of the line have their own names", Count("RU_Cm7Line_") + Count("RU_Cm7LineRow") >= 3 and Find("RU_Cm7Line_") ~= nil)
check("build: the marks and the pictures are on the icon overlay", game.Icons.Kids == 47)
check("build: the middle mark is gold", game.Dia.Color.R == 1 and near(game.Dia.Color.G, 0.638) and near(game.Dia.Color.B, 0.168) and game.Dia.Color.A == 1)
local built = #made
Tick(0.1) Tick(0.1)
check("build: only once", #made == built and #logs == 1)
check("nothing near: nothing shown, no chain", Find("RU_Cm7Mark1_").Vis == 1 and #queue == 0)

-- things near
local function Names()   -- the pictures of the marks on show, in the order of the pool
    local out = {}
    for i = 1, 40 do
        local m = Find("RU_Cm7Mark" .. i .. "_")
        if m.Vis == 3 then out[#out + 1] = m.Tex.Name end
    end
    return table.concat(out, " ")
end
creatures = { Thing("Enemy", 1000, 0), Thing("Calm", 1000 * math.cos(math.rad(58.2)), 1000 * math.sin(math.rad(58.2))),
    Thing("Enemy", 800, 100, true) }
resources = { Thing("Ore", 2000 * math.cos(math.rad(-30)), 2000 * math.sin(math.rad(-30))), Thing("Herbs", -500, 0) }
local c0, r0 = searches.c, searches.r
Run(10.1)
check("scan: one search in a step, the creatures first", searches.c == c0 + 1 and searches.r == r0)
Tick(0.06)
check("scan: the resources at the next step", searches.c == c0 + 1 and searches.r == r0 + 1)
Run(2.1)
check("scan: creatures every 2 s, resources every 10 s", searches.c == c0 + 2 and searches.r == r0 + 1)
local m1, m2 = Find("RU_Cm7Mark1_"), Find("RU_Cm7Mark2_")
check("marks: the enemy ahead is on show, in the middle, in the row of the game's lower marks", m1.Vis == 3 and near(m1.T.X, 0) and m1.T.Y == -18)
check("marks: its scale and opacity come from its distance (10 m of 60), the scale to 0.05", m1.Scale.X == 0.95 and m1.Scale.Y == 0.95 and near(m1.Op, 1 - 0.5 / 6, 0.01))
check("marks: the ore 30 degrees to the left is next, 160 units out, with its own picture", m2.Vis == 3 and m2.Tex.Name == "texOre" and near(m2.T.X, -30 * 5.33, 0.1))
check("marks: the calm creature at 58 degrees (310 units, past the edge), the dead one and the herb behind you are not shown", Names() == "texEnemy texOre")
check("marks: the chain is armed once", #queue == 1)
Tick(0.05)
check("marks: ...and not armed twice by the next tick", #queue == 1)

-- written only on a change
local n1, n2 = m1.N, m2.N
Drain()
check("write: nothing moved, nothing written", m1.N == n1 and m2.N == n2)
rot.Yaw = 10
Drain()
local m3 = Find("RU_Cm7Mark3_")
check("write: a turn moves the marks, and the calm creature comes in from the right edge", near(m1.T.X, -53.3, 0.1) and m2.Tex.Name == "texCalm" and near(m2.T.X, 48.2 * 5.33, 0.1) and m3.Tex.Name == "texOre" and near(m3.T.X, -40 * 5.33, 0.1))
check("write: a turn writes the place only, not the size or the opacity", m1.N == n1 + 1)
n1 = m1.N
Drain()
check("write: the same turn again writes nothing", m1.N == n1)
rot.Yaw = 10.005
Drain()
check("write: a turn too small to see (a tenth of a unit) writes nothing", m1.N == n1)
rot.Yaw = 0

-- the chain arms again while marks show, and ends when they do not
for i = 1, 5 do Drain() end
check("chain: still armed after many calls", #queue == 1)

-- a call of the chain with nothing new does nothing; the step reads the places of the creatures
local reads, calls, touched = actorReads, controllerCalls, Touches(made)
Drain() Drain()
check("paint: the yaw and the player did not change: no write, no read of a creature, no controller call", Touches(made) == touched and actorReads == reads and controllerCalls == calls)
local cx, cy = at(10, 1000)
creatures[1].A.P = { X = cx, Y = cy, Z = 0 }
Drain()
check("creature: it moved, the chain does not know yet and reads nothing", Touches(made) == touched and actorReads == reads and near(m1.T.X, 0))
Tick(0.06) Tick(0.06)   -- the places of the creatures are read at every other step
check("creature: the step reads the place of each creature on show, once, and the mark is painted from it", actorReads == reads + 2 and near(m1.T.X, 53.3, 0.3))
n1 = m1.N
Drain() Drain()
check("creature: the next calls of the chain have nothing new", m1.N == n1 and actorReads == reads + 2)
cx, cy = at(10, 3000)
creatures[1].A.P = { X = cx, Y = cy, Z = 0 }
Tick(0.06) Tick(0.06)
check("size: a creature further away writes a scale, not a brush", m1.Scale.X == 0.8 and m1.Scale.Y == 0.8 and m1.Brush.ImageSize.X == 34 and m1.BrushWrites == 1)
creatures[1].A.P = { X = 1000, Y = 0, Z = 0 }
Tick(0.06) Tick(0.06)
check("creature: back in front of you, in the middle, at the first scale", near(m1.T.X, 0) and m1.Scale.X == 0.95)
playerAt.Y = 50
Drain()
check("first paint after a change: the player moved 50 units, the mark moves", near(m1.T.X, -15.25, 0.1))
touched = Touches(made)
playerAt.Y = 52
Drain()
check("paint: the player moved 2 units, too little to paint", Touches(made) == touched)
playerAt.Y = 0
Drain()
check("first paint after a change: the player is back, the mark is back", near(m1.T.X, 0))
state.MapShown = true
Tick(0.06)
check("chain: the map on the screen, every mark is hidden at once", m1.Vis == 1 and m2.Vis == 1)
Drain()
check("chain: and the chain ends by not arming", #queue == 0)
Tick(0.06)
check("chain: not started again while the map is on the screen", #queue == 0)
local before = Touches({ m1, m2 })
for i = 1, 3 do Tick(0.06) end
check("map on the screen: the compass's marks are not touched", Touches({ m1, m2 }) == before)
local c1 = searches.c
Tick(5)
check("map on the screen: no search", searches.c == c1)
state.MapShown = false
Tick(0.06)
check("the map away again: no search in the step where the marks come on", searches.c == c1 and searches.r == r0 + 1)
Tick(0.06)
check("the map away again: a search at the next step, the marks back, the chain running", searches.c == c1 + 1 and Find("RU_Cm7Mark1_").Vis == 3 and #queue == 1)

-- the groups of the map settings
set.Ore = false
Tick(0.06)
check("groups: Ore off, the ore mark goes at once", Names() == "texEnemy")
set.Ore, set.Neutral = true, false
creatures[#creatures + 1] = Thing("Calm", 1000, 0)
Tick(0.06) Tick(0.06)   -- the creatures, then the resources
check("groups: Enemies only, a calm creature ahead is not shown", Names() == "texEnemy texOre")
set.Neutral = true
Tick(0.06)
check("groups: All, it is", Names() == "texEnemy texCalm texOre")
state.CreaturesOn = false
Tick(0.06)
check("groups: Creatures off, the creatures are gone and the ore stays", Names() == "texOre")
for _, k in ipairs({ "Ore", "Herbs", "Essence", "Trees" }) do set[k] = false end
local s2 = searches.c + searches.r
Tick(20)
Drain()
check("groups: every group off, no mark, no search, no chain", searches.c + searches.r == s2 + 0 and #queue == 0 and Names() == "")
for _, k in ipairs({ "Ore", "Herbs", "Essence", "Trees" }) do set[k] = true end
state.CreaturesOn = true
Tick(0.06)

-- a creature that is gone is skipped, the pool is full at 40
creatures = {}
for i = 1, 60 do creatures[i] = Thing("Enemy", 1000, 0) end
resources = {}
Tick(10.1)
local function Shown() local n = 0 for i = 1, 40 do if Find("RU_Cm7Mark" .. i .. "_").Vis == 3 then n = n + 1 end end return n end
check("pool: 60 things in view fill the 40 marks, no more are made", Shown() == 40 and Count("RU_Cm7Mark") == 40)
for i = 1, 30 do creatures[i].A.Alive = false end
local readsGone = actorReads
Drain()
check("pool: the chain alone does not know of a creature that is gone", Shown() == 40 and actorReads == readsGone)
Tick(0.06) Tick(0.06)   -- the places are read at every other step
check("pool: the step skips creatures that are gone, so they free their marks (and a gone object is never read)", Shown() == 30 and actorReads == readsGone + 30)

-- the compass hidden by the editor or by the immersive mode: the marks go, the gold line stays built
state.Compass = nil
Tick(0.06)
Drain()
check("hidden: the marks are collapsed, the chain ends", Find("RU_Cm7Mark1_").Vis == 1 and #queue == 0)
check("hidden: the gold line is not taken off", box.Removed == nil)
state.Compass = game
Tick(0.06) Tick(0.06)   -- the marks come on, then the search
check("shown again: the same widgets, the marks are back", Find("RU_Cm7Mark1_").Vis == 3 and Count("RU_Cm7Mark") == 40 and #logs == 1)
local named = fullNames
Tick(0.06) Tick(0.06) Tick(0.06)
check("steps compare the name main.lua gave, they do not read it from the widget", fullNames == named)

-- a stall longer than a second: the chain is taken as lost, a new one starts, and the call still queued from the old one
-- does nothing
Drain()
check("stall: one chain before", #queue == 1)
now = now + 2.5   -- the game stalls; the queued call has not run
M.Tick(ctx)
check("stall: the main step starts a new chain, the old call is still waiting", #queue == 2)
Drain()
check("stall: the old call does nothing, one chain goes on", #queue == 1)
for i = 1, 5 do Drain() end
check("stall: and it stays one", #queue == 1)
local paintsBefore = Find("RU_Cm7Mark1_").N
M.Tick(ctx)
check("step: the step does not paint again while the chain has just called", Find("RU_Cm7Mark1_").N == paintsBefore)

-- the game clears the row of icons while the compass lives: nothing of ours is written to again, and it builds again
local gone = Find("RU_Cm7Mark1_")
local goneN = gone.N
gone.Alive = false
logs = {}
Drain()
check("freed marks: no write to a freed widget", gone.N == goneN)
check("freed marks: let go, the rest taken off, and logged", M.Comp == nil and #M.Made == 0 and #logs == 1 and logs[1]:find("taken out of the compass"))
check("freed marks: the gold line is taken off, the middle mark has its colour back", box.Removed == 1 and game.Dia.Color.R == 0.2)
check("freed marks: the chain ended", #queue == 0)
Tick(1)
check("freed marks: not built again at once", M.Comp == nil)
Run(11) Tick(0.06)   -- the build, then the search
check("freed marks: built again after a while, with the marks back", M.Comp ~= nil and logs[#logs] == "compass ready" and Find("RU_Cm7Mark1_").Vis == 3 and game.Dia.Color.R == 1)
box = Find("RU_Cm7LineBox")
local icons = game.Icons
icons.Alive = false
local iconsN = icons.N
logs = {}
Drain()
check("freed row: a freed icon row is caught too, nothing is written to it", M.Comp == nil and icons.N == iconsN and #logs == 1)
icons.Alive = true
Run(11) Tick(0.06)   -- the build, then the search
check("freed row: built again", M.Comp ~= nil)
local holder = M.Tex.Enemy
holder.Alive = false
M.Pool[1].Group = nil   -- the first mark must take its picture again, at the next paint (the camera turns)
rot.Yaw = 5
logs = {}
Drain()
check("freed picture: caught before it is handed to the engine", M.Comp == nil and #logs == 1)
holder.Alive = true
rot.Yaw = 0
M.TexCache = {}
Run(11)
check("freed picture: built again", M.Comp ~= nil)

-- a world change: nothing is touched
Drain()
local all = {}
for _, w in ipairs(made) do all[#all + 1] = w end
all[#all + 1] = game.Dia
local snapshot = Touches(all)
M.Forget(false)
check("forget(false): no widget of the old world is touched", Touches(all) == snapshot)
Drain()
check("forget(false): a chain left behind does nothing", Touches(all) == snapshot and #queue == 0)
check("forget(false): the handles are gone", M.Comp == nil and #M.Made == 0 and M.Want == false)
check("forget: the search of nearby.lua is told, so it tries its first way again", forgets >= 1)

-- the same compass in a new round: the marks come off, the middle mark is back in its colour
game = Compass("WBP_HUD_Compass_C_2")
state.Compass = game
local first = #made
Tick(0.1)
local names, unique = {}, true
for _, w in ipairs(made) do if names[w.Name] then unique = false end names[w.Name] = true end
check("a new world: built again, and no two widgets of the game's compass share a name", #made > first and Count("RU_Cm7Mark") > 40 and unique and logs[#logs] == "compass ready")
creatures = { Thing("Enemy", 1000, 0) }
Tick(10.1)
local mine = {}
for i = first + 1, #made do mine[#mine + 1] = made[i] end
check("a new world: the marks show", Find("RU_Cm7Mark1_").Vis == 3)
M.Forget(true)
local removed = 0
for _, w in ipairs(mine) do if w.Removed == 1 then removed = removed + 1 end end
check("forget(true): every widget of the mod is taken off the compass (the line, the pictures, the marks)", removed == 1 + 7 + 40)
check("forget(true): the middle mark has its own colour back", game.Dia.Color.R == 0.2 and game.Dia.Color.G == 0.3 and game.Dia.Color.B == 0.4 and game.Dia.Color.A == 0.5)
local t2 = Touches(mine)
Drain()
check("forget(true): a chain left behind does nothing", Touches(mine) == t2 and #queue == 0)

-- the game made another compass: the old one is let go without a touch
local start = #made
Tick(0.1)
local live = {}
for i = start + 1, #made do live[#live + 1] = made[i] end
local old, oldTouches = game, Touches(live)
game = Compass("WBP_HUD_Compass_C_3")
state.Compass = game
Tick(0.1)
check("another compass: built into the new one", #made > start + #live and game.Icons.Kids == 47 and game.Host.Kids == 1)
check("another compass: nothing of the old one is touched, the middle mark keeps the mod's gold", Touches(live) == oldTouches and old.Dia.Color.R == 1)
state.Compass = game

-- a build that fails is logged, taken back and tried again later, three times at most
M.Forget(true)
logs = {}
local broken = Compass("WBP_HUD_Compass_C_4")
broken.W.CompassBottomIconOverlay = nil
game, state.Compass = broken, broken
Tick(0.1)
check("failure: logged, nothing left on the compass", #logs == 1 and logs[1]:find("compass failed") and broken.Dia.Color == nil and broken.Host.Kids == nil)
Tick(1)
check("failure: no new try at once", #logs == 1)
Tick(10) Tick(10) Tick(10) Tick(10)
check("failure: three tries in all", #logs == 3)
state.NoPictures = true
M.Forget(true)
logs = {}
game = Compass("WBP_HUD_Compass_C_5")
state.Compass = game
Tick(0.1)
check("a picture that is missing is logged once, and the rest is built", Count("RU_Cm7Mark") >= 40 and #logs >= 6 and logs[#logs] == "compass ready")
creatures = { Thing("Enemy", 1000, 0) }
resources = {}
Tick(2.1)
check("a group with no picture shows no mark", Find("RU_Cm7Mark1_").Vis == 1)
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(chain)); lua.lua_setglobal(L, to_luastring('CHAINTEXT'));
lua.lua_pushstring(L, to_luastring(goldline)); lua.lua_setglobal(L, to_luastring('GOLDTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

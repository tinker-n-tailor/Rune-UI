// Tests the map's look in a dungeon (radar.lua) against a fake map named as the game's (probes of 10-10-2026): the open
// world gets no write, a parked icon turns the map into a radar (sea tinted, land off, our arrow in the middle with the
// game's picture), the arrow turns with the body and writes only for a real turn, leaving gives
// each part back what it had, a map built new gets the radar at the next step with no call on the old one, and an
// icon that is not there is searched every 3 s only.
// The file checks cover runemap.lua, maplook.lua and wiring.lua.
// Needs npm install once. Run: node tools/test-radar.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const scripts = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(scripts, f), 'utf8').replace(/\r\n/g, '\n');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const set = (name, text) => { lua.lua_pushstring(L, to_luastring(text)); lua.lua_setglobal(L, to_luastring(name)); };
set('RADAR', read('radar.lua')); set('RUNEMAP', read('runemap.lua')); set('MAPLOOK', read('maplook.lua')); set('WIRING', read('wiring.lua'));
const test = `
local writes, addr = 0, 0
local methods = {}
local function W(class, name, props)
    addr = addr + 1
    local w = { _class = class, _name = name, _props = props or {}, _kids = {}, _alive = true, _op = 1, _vis = 3, _addr = addr }
    return setmetatable(w, { __index = function(t, k) return methods[k] or t._props[k] end })
end
function methods.IsValid(s) return s._alive end
function methods.GetFName(s) return { ToString = function() return s._name end } end
function methods.GetVisibility(s) return s._vis end
function methods.SetVisibility(s, v) writes = writes + 1 s._vis = v end
function methods.SetColorAndOpacity(s, c) writes = writes + 1 s._props.ColorAndOpacity = { R = c.R, G = c.G, B = c.B, A = c.A } end
function methods.SetRenderTransformAngle(s, d) writes = writes + 1 s._deg = d end
function methods.K2_GetActorLocation(s) return s._at end
function methods.K2_GetComponentLocation(s) return s._at end
function methods.K2_GetActorRotation(s) return { Yaw = s._yaw } end
function methods.K2_GetComponentRotation(s) return { Yaw = s._yaw } end

local now = 0
os.clock = function() return now end

-- the game's side: the tracker with its icons, the player's own among them
local selfTex = W("Texture2D", "T_NavIcons_Player_Self")
local icon = W("MapIconComponent", "SelfIcon", { IconTexture = selfTex })
local other = W("MapIconComponent", "CampIcon", { IconTexture = W("Texture2D", "T_NavIcons_Camp") })
local icons, searches = { other, icon }, 0
local tracker = W("MapTrackerComponent", "Tracker", { MapIcons = { ForEach = function(_, f)
    searches = searches + 1
    for i, c in ipairs(icons) do f(i, { get = function() return c end }) end
end } })
StaticFindObject = function() return { GetMapTracker = function() return tracker end } end
FindFirstOf = function() return {} end

-- a map of ours as runemap.lua holds it: the game's minimap, the body, the view, the canvas of the marks
local made = {}
local function NewMap()
    local sea = W("Image", "Image_OpaqueBackground", { ColorAndOpacity = { R = 0.9, G = 0.9, B = 0.9, A = 1 } })
    local land = W("CanvasPanel", "Canvas_Backgrounds") land._vis = 4
    local map = W("WBP_DominionMinimap_C", "Map", { Image_OpaqueBackground = sea, Canvas_Backgrounds = land })
    return { map = map, sea = sea, land = land }
end
local pawn = W("BP_PlayerCharacter_C", "Pawn") pawn._at, pawn._yaw = { X = 100, Y = 200, Z = 0 }, -90
local view = W("MapViewComponent", "View") view._yaw = 0
local Map = { Set = { North = true }, Pawn = pawn, View = view, UW = { WidgetTree = "tree" },
    H = { C = 112, NORTH_YAW = -90,
        Picture = function(tree, name, tex, size) local i = W("Image", name) i._tex, i._size, i._tree = tex, size, tree made[#made + 1] = i return i end,
        Place = function(canvas, w, x, y, wd, ht) w._x, w._y, w._canvas = x, y, canvas end } }
local function Use(g) Map.Map, Map.Marks = g.map, W("CanvasPanel", "RU_MapMarks") end

local R = load(RADAR)()
local logs = {}
local ctx = { Log = function(m) logs[#logs + 1] = m end }
local function Step(dt) now = now + (dt or 1.1) R.Tick(ctx, Map) end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local ENTRANCE, DUNGEON = { X = 100, Y = 200, Z = 0 }, { X = -500000, Y = -400000, Z = -30000 }

check("the distance is in metres", R.Apart({ X = 0, Y = 0, Z = 0 }, { X = 30000, Y = 40000, Z = 0 }) == 500)
check("facing north on a map with north on top, the arrow points up", R.Angle(-90, -90) == 0)
check("the turn seen in the game: a body at 166.5 points left and a little down", R.Angle(166.5, -90) == 256.5)
check("on a map that turns with the camera, a body that faces as the camera points up", R.Angle(40, 40) == 0)

-- the open world: the icon sits on the player
local A = NewMap() Use(A)
icon._at = ENTRANCE
Step() Step() Step()
check("open world: no write, no arrow, the icon searched once", writes == 0 and #made == 0 and searches == 1)

-- into a dungeon: the player is moved away, the icon stays at the entrance
pawn._at = DUNGEON
Step()
local arrow = made[1]
check("dungeon: the sea picture has the dark tint", A.sea.ColorAndOpacity.R == 0.12 and A.sea.ColorAndOpacity.B == 0.07)
check("dungeon: the land is off", A.land._vis == 1)
check("dungeon: one arrow of ours, the game's picture, 16 units, in the middle of the marks, shown",
    #made == 1 and arrow._tex == selfTex and arrow._size == 16 and arrow._x == 112 and arrow._y == 112 and arrow._canvas == Map.Marks
    and arrow._tree == "tree" and arrow._vis == 3)
check("dungeon: the arrow points up for a body that faces north", arrow._deg == 0)
local before = writes
Step(0.06) Step(0.06) Step(1.1)
check("dungeon: steps with no turn write nothing", writes == before)
pawn._yaw = -89.5 Step(0.06)
check("dungeon: a turn of half a degree writes nothing", writes == before)
pawn._yaw = 0 Step(0.06)
check("dungeon: a turn to the east writes once, a quarter to the right", writes == before + 1 and arrow._deg == 90)
Map.Set.North = false view._yaw = 0 Step(0.06)
check("dungeon: on a map that turns with the camera, the same body points up", arrow._deg == 0)
Map.Set.North = true Step(0.06)

-- out again
pawn._at = ENTRANCE
Step()
check("out: the sea picture has its own colour back", A.sea.ColorAndOpacity.R == 0.9 and A.sea.ColorAndOpacity.A == 1)
check("out: the land has its own visibility back", A.land._vis == 4)
check("out: the arrow is off, and kept", arrow._vis == 1 and #made == 1)
pawn._at = DUNGEON Step()
check("in again on the same map: the same arrow shows, no second one", arrow._vis == 3 and #made == 1 and A.land._vis == 1)

-- a menu: runemap.lua builds a new map and tells us
before = writes
R.NewMap()
check("a new map: no call on the old one", writes == before)
local B = NewMap() Use(B)
Step(0.06)
check("a new map in a dungeon is a radar at the next step, with an arrow of its own",
    B.sea.ColorAndOpacity.R == 0.12 and B.land._vis == 1 and #made == 2 and made[2]._vis == 3)
check("the icon was not searched again", searches == 1)

-- a new world: the icon is not there yet, then it is
R.Forget()
icons = { other }
local D = NewMap() Use(D)
searches = 0
Step(0.5) Step(0.5) Step(0.5) Step(0.5)
check("no icon: nothing changes, and one search in 2 s", D.sea.ColorAndOpacity.R == 0.9 and searches == 1)
icons = { other, icon }
Step(1.1) Step(1.1)
check("the icon is found at a later search, and the dungeon shows", D.sea.ColorAndOpacity.R == 0.12 and searches == 2)

-- a dead body is never read
pawn._alive = false
before = writes
Step() Step()
check("a body that is gone: no write, no error", writes == before)

check("runemap.lua runs the radar while the map shows, and tells it of a new map and a new world",
    string.find(RUNEMAP, "pcall(M.Radar.Tick, ctx, M)", 1, true) ~= nil and string.find(RUNEMAP, "M.Radar.NewMap()", 1, true) ~= nil
    and string.find(RUNEMAP, "M.Radar.Forget()", 1, true) ~= nil and string.find(MAPLOOK, "M.Marks = top", 1, true) ~= nil)
check("wiring.lua loads radar.lua onto the map", string.find(WIRING, 'RuneMap.Radar = LoadPart("radar")', 1, true) ~= nil)
return fails
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('ERROR ' + lua.lua_tojsstring(L, -1)); process.exit(1); }
const fails = lua.lua_tointeger(L, -1);
console.log(fails === 0 ? 'all passed' : fails + ' failed');
process.exit(fails === 0 ? 0 : 1);

// Tests nearby.lua without the game: what a class of the world is (ore, herbs, essence, rare trees, enemy or neutral
// creature), and the two searches that the map and the compass share, run against stand-ins for the game's objects:
// the radius of each search, the creatures of the world's own level only, the three ways to find creatures and the
// way that stays, a dead creature and an empty rock marked and not dropped.
// The class names follow the patterns in nearby.lua; the names of yew and magic trees are guesses there, as in the game's files so far.
// Needs fengari. Run: node tools/test-nearby.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'nearby.lua'), 'utf8');
const test = `
local function check(name, cond) if not cond then error("FAIL " .. name, 2) end print("ok   " .. name) end

---- what a class is
local function Fresh() return load(SRCTEXT)() end
local N = Fresh()
check("ore: a metal rock", N.Decide("BP_OreNode_Copper_C") == "Ore" and N.Decide("BP_OreNode_Iron_C") == "Ore")
check("ore: stone is everywhere, so it is not one", N.Decide("BP_OreNode_Stone_C") == false)
check("essence", N.Decide("BP_RuneEssence_Node_C") == "Essence")
check("salvage: a pile of any kind and the metal one, but not something that only has the word in its name",
    N.Decide("BP_BaseSalvageableResource_Textile_C") == "Salvage" and N.Decide("BP_BaseSalvageableResource_Misc_C") == "Salvage"
    and N.Decide("BP_Spawner_Salvage_Metal_C") == "Salvage" and N.Decide("BP_SalvageBench_C") == false)
check("herbs: the six, and the second spelling of Kwuarm", N.Decide("BP_Herb_Marrentil_C") == "Herbs" and N.Decide("BP_Harralander_C") == "Herbs"
    and N.Decide("BP_Kwuarm_C") == "Herbs" and N.Decide("BP_Kuarm_C") == "Herbs" and N.Decide("BP_Snapdragon_C") == "Herbs"
    and N.Decide("BP_Toadflax_C") == "Herbs" and N.Decide("BP_Irit_C") == "Herbs")
check("trees: the dead tree, yew, magic and anima bark", N.Decide("BP_Tree_Ash_Bare_C") == "Trees" and N.Decide("BP_Tree_Yew_C") == "Trees"
    and N.Decide("BP_Tree_Magic_C") == "Trees" and N.Decide("BP_AnimaInfusedBark_C") == "Trees")
check("trees: an oak is common, so it is not one", N.Decide("BP_Tree_Oak_C") == false)
check("nothing else: a chest, an empty name", N.Decide("BP_BaseBuilding_Chest_C") == false and N.Decide("") == false)
check("neutral: animals by name", N.IsNeutral("BP_Deer_C") and N.IsNeutral("BP_Chicken_C") and N.IsNeutral("BP_Frog_C"))
check("neutral: a goblin is not", not N.IsNeutral("BP_Goblin_C") and not N.IsNeutral("BP_GiantSpider_C"))

---- the game: stand-ins
local function Cls(name) return { IsValid = function() return true end, Name = name } end
local creatureCls, worldCls = Cls("creature"), Cls("world")
local stock = { creature = {}, world = {} }   -- what the game holds near the player, by class
local calls, overlapWorks, overlapEmpty, listWorks, placeReads = {}, true, false, true, 0
local function Actor(cls, full, opts)
    opts = opts or {}
    local a = { Full = full }
    function a:IsValid() return true end
    function a:GetFullName() return full end
    function a:GetClass() return { GetFName = function() return { ToString = function() return cls end } end } end
    function a:IsDead() return opts.dead == true end
    a.PopulatedSpawnComponents = { GetArrayNum = function() return opts.empty and 0 or 3 end }
    function a:K2_GetActorLocation()
        placeReads = placeReads + 1
        return opts.at or { X = 1, Y = 2, Z = 3 }
    end
    return a
end
local outs = {}   -- each table the game was given to fill, and whether it still held something then
local function Fill(out, list)
    outs[#outs + 1] = { T = out, Held = next(out) ~= nil }
    for i, a in ipairs(list) do out[i] = a end
end
local KSL = {}
function KSL:SphereOverlapActors(pawn, at, radius, types, cls, ignore, out)
    calls[#calls + 1] = { Radius = radius, Types = #types, Cls = cls.Name }
    if not overlapWorks then error("no such call") end
    if overlapEmpty then return true end
    Fill(out, cls == creatureCls and stock.creature or stock.world)
    return true
end
local GS = {}
function GS:GetAllActorsOfClass(pawn, cls, out)
    calls[#calls + 1] = { Via = "game list" }
    if not listWorks then error("no such call") end
    Fill(out, stock.creature)
end
local objects = { ["/Script/Engine.Default__KismetSystemLibrary"] = KSL, ["/Script/Engine.Default__GameplayStatics"] = GS,
    ["/Script/Dominion.DominionAICharacter"] = creatureCls, ["/Script/Dominion.WorldActor"] = worldCls }
StaticFindObject = function(path) return objects[path] end
FindAllOf = function() calls[#calls + 1] = { Via = "walk" } return stock.creature end
local logs = {}
local ctx = { Log = function(m) logs[#logs + 1] = m end }
local pawn = { K2_GetActorLocation = function() return { X = 0, Y = 0, Z = 0 } end }

---- creatures
local world = ":PersistentLevel."
stock.creature = { Actor("BP_Goblin_C", "BP_Goblin_C /Game/Map." .. world .. "BP_Goblin_C_1"),
    Actor("BP_Deer_C", "BP_Deer_C /Game/Map." .. world .. "BP_Deer_C_2"),
    Actor("BP_Wolf_C", "BP_Wolf_C /Game/Map." .. world .. "BP_Wolf_C_3", { dead = true }),
    Actor("BP_Goblin_C", "BP_Goblin_C /Game/BP_Goblin.Default__BP_Goblin_C"),
    Actor("BP_Goblin_C", "BP_Goblin_C /Engine/Transient.BP_Goblin_C_9") }
local list = N.Creatures(ctx, pawn)
check("creatures: the overlap query, 100 m, the pawn object type, the creature class", calls[1].Radius == 10000 and calls[1].Types == 1 and calls[1].Cls == "creature")
check("creatures: only the world's own level, a default object and a transient one are left out", #list == 3)
check("creatures: enemy and calm", list[1].Group == "Enemy" and list[2].Group == "Calm")
check("creatures: a dead one stays in the list, marked", list[3].Dead == true and list[1].Dead == false and list[2].Dead == false)
check("creatures: the name is the key the map keeps", list[1].Name:find("BP_Goblin_C_1", 1, true) and list[1].A == stock.creature[1])
check("creatures: the way is logged once", #logs == 1 and logs[1]:find("overlap query"))
N.Creatures(ctx, pawn)
check("creatures: ...and not again", #logs == 1)

-- the first way fails: the next one is used, and stays
N = Fresh() logs, calls = {}, {}
overlapWorks = false
list = N.Creatures(ctx, pawn)
check("ways: the overlap query fails, the game's list is used", #list == 3 and calls[2].Via == "game list")
check("ways: the failure and the new way are logged", #logs == 2 and logs[1]:find("failed") and logs[2]:find("game's list"))
calls = {}
N.Creatures(ctx, pawn)
check("ways: the way that works stays; the failed one is not tried again", #calls == 1 and calls[1].Via == "game list")
N.Forget()
calls = {}
N.Creatures(ctx, pawn)
check("ways: a new world tries the first way again", calls[1].Cls == "creature" and calls[2].Via == "game list")

-- an overlap with an empty table is an error, not an empty world
N = Fresh() calls, logs = {}, {}
overlapWorks, overlapEmpty = true, true
list = N.Creatures(ctx, pawn)
check("ways: an overlap that gives no actors falls through to the next way", #list == 3 and calls[2].Via == "game list")
overlapEmpty = false

-- the game's list and the walk give the whole world: a creature farther than 100 m is left out, as the overlap query does
local function Far(cls, id, at, opts)
    opts = opts or {}
    opts.at = at
    return Actor(cls, cls .. " /Game/Map." .. world .. cls .. "_" .. id, opts)
end
stock.creature = { Far("BP_Goblin_C", 1, { X = 6000, Y = 8000, Z = 0 }),         -- 100 m exactly: stays
    Far("BP_Goblin_C", 2, { X = 6000, Y = 8001, Z = 0 }),                        -- just past 100 m
    Far("BP_Deer_C", 3, { X = -5000, Y = 5000, Z = 100 }),                        -- near, behind the player
    Far("BP_Wolf_C", 4, { X = 500000, Y = 0, Z = 0 }),                            -- the other end of the world
    Far("BP_Goblin_C", 5, { X = 100, Y = 0, Z = 0 }) }
stock.creature[5].K2_GetActorLocation = function() error("freed") end             -- a place that cannot be read
N = Fresh() calls, logs, placeReads = {}, {}, 0
overlapWorks = false
list = N.Creatures(ctx, pawn)
check("far: the game's list gives only the creatures within 100 m", #list == 2 and list[1].Name:find("Goblin_C_1", 1, true) and list[2].Name:find("Deer_C_3", 1, true))
check("far: the same, the way that stays", #N.Creatures(ctx, pawn) == 2)
N = Fresh() calls, logs = {}, {}
listWorks = false
list = N.Creatures(ctx, pawn)
check("far: the walk gives only the creatures within 100 m", #list == 2 and calls[#calls].Via == "walk" and list[1].Group == "Enemy" and list[2].Group == "Calm")
listWorks = true

-- the overlap query is limited by the game: no creature is asked for its place
stock.creature = { Far("BP_Goblin_C", 6, { X = 500000, Y = 0, Z = 0 }) }
N = Fresh() calls, logs, placeReads = {}, {}, 0
overlapWorks = true
list = N.Creatures(ctx, pawn)
check("far: the overlap query is trusted, and costs no call per creature", #list == 1 and placeReads == 0)
check("far: the distance is a straight line in three axes", N.IsNear({ X = 0, Y = 0, Z = 0 }, { X = 6000, Y = 6000, Z = 6000 }, 10000) == false
    and N.IsNear({ X = 0, Y = 0, Z = 0 }, { X = 5000, Y = 5000, Z = 5000 }, 10000) == true)

---- resources
N = Fresh() calls, logs = {}, {}
stock.world = { Actor("BP_OreNode_Copper_C", "ore1"), Actor("BP_OreNode_Stone_C", "stone"), Actor("BP_OreNode_Tin_C", "ore2", { empty = true }),
    Actor("BP_Marrentil_C", "herb"), Actor("BP_RuneEssence_Node_C", "ess"), Actor("BP_Tree_Ash_Bare_C", "tree"), Actor("BP_Tree_Oak_C", "oak") }
local found, queried = N.Resources(ctx, pawn)
check("resources: 60 m, every object type, the world actor class", calls[1].Radius == 6000 and calls[1].Types == 16 and calls[1].Cls == "world")
check("resources: the count is every actor the query found", queried == 7)
check("resources: only the things of a group", #found == 5)
check("resources: group and name", found[1].Group == "Ore" and found[1].Name == "ore1" and found[3].Group == "Herbs" and found[4].Group == "Essence" and found[5].Group == "Trees")
check("resources: an empty rock stays in the list, marked", found[2].Name == "ore2" and found[2].Empty == true and found[1].Empty == false)

objects["/Script/Dominion.WorldActor"] = nil
objects["/Script/Engine.Actor"] = Cls("actor")
calls, logs = {}, {}
N.Resources(ctx, pawn) N.Resources(ctx, pawn)
check("resources: with no world actor class every actor is searched, and the log says so once", calls[1].Cls == "actor" and #logs == 1 and logs[1]:find("no WorldActor"))

---- UE4SS keeps every table it is given to fill, for the whole run: a new table per search was a leak
outs = {}
N.Resources(ctx, pawn) N.Creatures(ctx, pawn) N.Resources(ctx, pawn)
check("the game fills one table in every search, and gets it empty", #outs == 3 and outs[1].T == outs[2].T and outs[2].T == outs[3].T
    and not (outs[1].Held or outs[2].Held or outs[3].Held))
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

// Tests when RuneMap is built, shown, hidden, taken off and built new (runemap.lua), against stand-ins for its four
// other files and for the engine. A menu with the map shown brings a new map. A menu with the map hidden or faded takes
// the old map off at once and builds only when the map is to show again (the bug of 10-10-2026: the old map stayed and
// kept the markers of every visit to the big map). Also: a world that is not up yet, the map off in F8 and on again, a
// new body, three failed builds, a respawn and a new world.
// Needs npm install once. Run: node tools/test-runemap.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
if (lauxlib.luaL_dostring(L, to_luastring(require('./fake-runemap'))) !== 0) { console.log('ERROR ' + lua.lua_tojsstring(L, -1)); process.exit(1); }
const test = `
local now = 100
os.clock = function() return now end

-- an engine object: a call that it does not know gives a new object, so the widget building runs through
local function Thing(name, known)
    local t = { _name = name, _alive = true }
    function t.IsValid(s) return s._alive end
    function t.GetFullName(s) return s._name end
    for k, v in pairs(known or {}) do t[k] = v end
    return setmetatable(t, { __index = function(_, k) return function() return Thing(k) end end })
end

-- the maps of ours that were made: OnScreen, Vis (1 collapsed, 3 shown), Removes
local maps = {}
local function OnScreen() local n = 0 for _, m in ipairs(maps) do if m.OnScreen then n = n + 1 end end return n end
FName = function(s) return s end
FindFirstOf = function(c) return Thing(c) end
StaticFindObject = function(p) return Thing(p) end
StaticConstructObject = function(_, _, name)
    if not string.match(name, "^RuneUIMap%d+$") then return Thing(name) end
    local m = Thing(name, { OnScreen = false, Removes = 0,
        AddToViewport = function(s) s.OnScreen = true end,
        RemoveFromParent = function(s) s.OnScreen, s.Removes = false, s.Removes + 1 end,
        SetVisibility = function(s, v) s.Vis = v end })
    maps[#maps + 1] = m
    return m
end

-- the player and the game's HUD
local function Controller(body)
    return Thing("PC", { Pawn = Thing(body), IsLocalController = function() return true end })
end
local PC = Controller("Body1")
FindAllOf = function() return { PC } end
local hudShown = true
local V = Thing("Vitals", { IsVisible = function() return hudShown end })
local E = { vitals = { Instances = { V } }, runemap = { Visible = true, Opacity = 1, Center = { X = 1700, Y = 150 } },
    creatures = { Visible = true } }
local logs, fade, scans, editing, failScan = {}, 1, 0, false, false
local function Logged(text) for _, m in ipairs(logs) do if string.find(m, text, 1, true) then return true end end return false end
local ctx = { Log = function(m) logs[#logs + 1] = m end, ById = function(id) return E[id] end, Asset = function() return Thing("class") end,
    Editing = function() return editing end, Fade = function() return fade end, Scan = function() scans = scans + 1 if failScan then error("no scan today") end end }

-- the four other files of the map, and its helpers from wiring.lua: each call is counted
local n = setmetatable({}, { __index = function() return 0 end })
local function Count(name, f) return function(...) n[name] = n[name] + 1 if f then return f(...) end end end
local views, classReady, failMap = {}, true, false
local R
R = NewRuneMap({
    Look = { Init = function(M) M.H = { BOX = 224 } end, BuildRing = Count("ring", function() return Thing("ring") end),
        UpdateNorth = Count("north"), ApplyOpacity = Count("opacity"), Clock = Count("clock") },
    Widget = { Init = function() end, ClassReady = function() return classReady end, SetUpAgain = Count("setup"),
        MakeView = Count("view", function()
            local v = Thing("view", { Destroyed = false, K2_DestroyComponent = function(s) s.Destroyed = true end })
            views[#views + 1] = v
            return v
        end),
        MakeMap = Count("map", function() if failMap then error("no map today") end return Thing("map") end) },
    Creatures = { Init = function() end, Scan = Count("creatures"), Drop = Count("creatures drop"),
        Forget = Count("creatures forget"), HideAll = Count("creatures hide") },
    Settings = { Init = function(M) M.Set = { Map = true } end, Step = Count("settings"), Apply = Count("apply"),
        ApplyZoom = Count("zoom", function() R.PendingZoom = false end) } })
R.Res = { Scan = Count("res"), Drop = Count("res drop"), Forget = Count("res forget"), HideAll = Count("res hide") }
R.Radar = { Tick = Count("radar"), NewMap = Count("radar new map"), Forget = Count("radar forget") }
R.Near = { Forget = Count("near forget") }

local function Step(dt) now = now + (dt or 0.06) R.Tick(ctx) end
local function Steps(k, dt) for _ = 1, k do Step(dt) end end
-- the big map or another screen that takes the HUD away, opened and closed
local function Menu() hudShown = false Steps(3) hudShown = true Step() end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end

-- before the world is up
E.vitals.Instances = {}
Steps(3, 2.1)
check("no HUD yet: nothing is built", n.map == 0 and #maps == 0)
E.vitals.Instances = { V }
classReady = false
Steps(3, 2.1)
check("no minimap class yet: nothing is built", n.map == 0)
classReady = true

-- the first build
Step(2.1)
check("the world is up: one map, on the screen, collapsed for one step, and a scan asked for",
    n.map == 1 and #maps == 1 and OnScreen() == 1 and maps[1].Vis == 1 and scans == 1 and R.UW == maps[1])
check("a new map tells the radar", n["radar new map"] == 1)
Step()
check("the next step shows it", maps[1].Vis == 3 and R.Visible == true and R.Shown == true)
check("no scan of creatures or resources in the step that shows it", n.creatures == 0 and n.res == 0)
Step()
check("shown: the creatures are searched, the radar and the north mark run", n.creatures == 1 and n.radar >= 1 and n.north >= 1)
check("one search in a step: the resources wait for the next", n.res == 0)
Step()
check("the next step searches the resources", n.creatures == 1 and n.res == 1)
R.NextCreatures, R.NextRes = 0, 0
Step(1.1)
check("the second set-up comes a second after the build, once", n.setup == 1)
check("the step of the set-up holds no search", n.creatures == 1 and n.res == 1)
Steps(2)
check("the searches follow, one in each step", n.creatures == 2 and n.res == 2)
Steps(20)
check("steps at rest: no new map, no second set-up", n.map == 1 and n.setup == 1 and OnScreen() == 1)

-- a menu with the map shown
hudShown = false Step()
check("the HUD goes: the map is collapsed, the icons are hidden at once", maps[1].Vis == 1 and R.Visible == false
    and n["creatures hide"] == 1 and n["res hide"] == 1)
Steps(5)
check("in the menu: no build", n.map == 1 and OnScreen() == 1)
hudShown = true Step()
check("back from the menu: the old map stays collapsed, it never flashes", maps[1].Vis == 1 and n.map == 1)
Step()
check("map shown: a menu builds a new map in the next step", n.map == 2 and #maps == 2)
check("the old map is off the screen and its view is gone", maps[1].OnScreen == false and views[1].Destroyed == true and OnScreen() == 1)
check("the icons stay on their creatures and things through a menu", n["creatures drop"] == 0 and n["res drop"] == 0)
local creatures, res = n.creatures, n.res
Step()
check("the new map shows", maps[2].Vis == 3 and R.Visible == true and R.UW == maps[2])
Steps(2)
check("after a menu both searches run in the next two steps, not 2 and 10 s later", n.creatures == creatures + 1 and n.res == res + 1)

-- a menu with the map hidden in the editor (the bug of 10-10-2026)
E.runemap.Visible = false Step()
check("hidden in the editor: collapsed, not taken off", maps[2].Vis == 1 and OnScreen() == 1 and n.map == 2)
Menu() Step()
check("map hidden: a menu takes the old map off at once", maps[2].OnScreen == false and OnScreen() == 0 and views[2].Destroyed == true)
check("map hidden: and no new map is built", n.map == 2 and R.UW == nil)
for _ = 1, 5 do Menu() Steps(4) end
check("map hidden: five more menus build nothing and leave nothing on the screen", n.map == 2 and OnScreen() == 0)
R.PendingZoom = 1.25 Step()
check("map hidden: a zoom key still changes the saved zoom", n.zoom == 1)
E.runemap.Visible = true Step()
check("the map is to show again: one new map", n.map == 3 and OnScreen() == 1 and R.UW == maps[3])
Step()
check("and it shows", maps[3].Vis == 3 and R.Visible == true)

-- the same with the map faded out by the immersive mode
fade = 0 Step()
check("fully faded: collapsed, not taken off", maps[3].Vis == 1 and OnScreen() == 1)
Menu() Step()
check("map faded: a menu takes the old map off at once, and builds nothing", OnScreen() == 0 and n.map == 3)
hudShown = false Steps(3) fade = 1 Steps(3)
check("the fade ends inside a menu: still no map", n.map == 3)
hudShown = true Steps(2)
check("the fade is over and the HUD is back: one new map", n.map == 4 and OnScreen() == 1)
Step()

-- the big map opened while a menu's new map is still owed must not use a view of ours that is gone
check("every view but the live one is gone", views[1].Destroyed and views[2].Destroyed and views[3].Destroyed and not views[4].Destroyed)

-- the map turned off in F8, and on again
logs = {}
local drops = n["creatures drop"]
R.Set.Map = false Step()
check("off in F8: the map is off the screen with its view, the icons come off", OnScreen() == 0 and views[4].Destroyed
    and n["creatures drop"] == drops + 1 and n["res drop"] == 1 and R.Visible == nil and Logged("runemap: off"))
Steps(10, 2.1)
check("off in F8: nothing is built", n.map == 4 and #logs == 1)
R.PendingZoom = 0.8 Step()
check("off in F8: a zoom key still changes the saved zoom", n.zoom == 2)
R.Set.Map = true Step(2.1)
check("on again: one new map", n.map == 5 and OnScreen() == 1)
Step()
check("and it shows", maps[5].Vis == 3 and R.Visible == true)

-- another body in the same world
PC.Pawn = Thing("Body2")
Step(2.1)
check("a new body: the old map and its view go, the icons come off, a new map is built", Logged("new body") and maps[5].OnScreen == false
    and views[5].Destroyed and n["creatures drop"] == drops + 2 and n.map == 6 and OnScreen() == 1)
Step()

-- a respawn (the same world)
R.Forget(true)
check("a respawn: the map comes off the screen, the icons come off", maps[6].OnScreen == false and R.UW == nil
    and n["creatures drop"] == drops + 3 and n["res drop"] == 3 and n["radar forget"] == 1)

-- three failed builds
failMap = true
Step(2.1)
check("a failed build: logged with its step, its view is taken off the body", Logged("runemap failed at step 'map'") and views[7].Destroyed and R.UW == nil)
Step(5)
check("no new try within 10 s", n.view == 7)
Steps(2, 10.1)
check("three tries", n.view == 9)
Steps(5, 10.1)
check("then no more in this round", n.view == 9)
failMap = false
R.Forget(true)
Step(10.1)
check("a new round builds again", n.view == 10 and R.UW == maps[#maps] and OnScreen() == 1)
Step()

-- a new world: the engine took the old widgets, ours is never touched
local old, removes = R.UW, R.UW.Removes
R.Forget(false)
check("a new world: no call on the old map, every handle dropped", old.Removes == removes and R.UW == nil and R.Map == nil and R.Pawn == nil
    and n["creatures forget"] == 1 and n["res forget"] == 1)
PC = Controller("Body3")
Step(2.1)
check("a new world: a new map on the new body", n.view == 11 and R.UW == maps[#maps] and R.UW ~= old and R.Pawn == PC.Pawn)
Step()
check("and it shows", R.UW.Vis == 3 and R.Visible == true)

-- a map hidden in the editor shows while the editor (F9 or F8) is open
E.runemap.Visible = false Step()
Menu() Step()
local built = n.view
check("hidden, after a menu: no map", R.UW == nil)
editing = true Step()
check("the editor opens: the map is built, to be found and moved", n.view == built + 1 and R.UW ~= nil and R.UW.OnScreen)
Step()
check("and it shows while the editor is open", R.UW.Vis == 3)
editing = false Step()
check("the editor closes: the map is collapsed, not taken off", R.UW.Vis == 1 and R.UW.OnScreen and n.view == built + 1)

-- a hidden map is not set up: the set-up needs a map on the screen, and showing the map asks for it again
local setups = n.setup
R.SetUpAt = now
Steps(3)
check("hidden: no set-up", n.setup == setups)
E.runemap.Visible = true
Steps(8)
check("shown again: one set-up", n.setup == setups + 1)

-- a build that fails after the map is on the screen
R.Forget(true)
local on = OnScreen()   -- the old world's map: the engine took it, the stand-in does not
failScan = true
Step(2.1)
check("a build that fails late: logged, and its widget comes off the screen", Logged("runemap failed at step 'screen'") and OnScreen() == on and R.UW == nil)
failScan = false
R.Forget(true)
Step()
check("a respawn ends the wait of a failed build", R.UW == maps[#maps] and OnScreen() == on + 1)
return fails
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('ERROR ' + lua.lua_tojsstring(L, -1)); process.exit(1); }
const fails = lua.lua_tointeger(L, -1);
console.log(fails === 0 ? 'all passed' : fails + ' failed');
process.exit(fails === 0 ? 0 : 1);

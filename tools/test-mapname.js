// Tests the map setting "Player name" (mapname.lua) against fake markers shaped like the game's
// (WBP_Dominion_MinimapInternal_Icon_C: MapIconComp, IconLabel). Off hides only the label of a marker whose component belongs
// to your body or player state, never another player's (also under the same name). A marker that cannot be read is left alone
// and looked at again. On puts each label back once and then calls nothing. A label at 0 with no record comes back at 1.
// Also covers a new world and a restart.
// Needs npm install once. Run: node tools/test-mapname.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'mapname.lua'), 'utf8');
const test = `
local function check(name, cond) if not cond then error("FAIL " .. name, 2) end print("ok   " .. name) end
local function Obj(addr) local o = { Addr = addr, Valid = true } function o:IsValid() return self.Valid end function o:GetAddress() return self.Addr end return o end

local pawn = Obj(700)   -- the picture of the local player (T_NavIcons_Player_Self)
local state = pawn
local found = true   -- StaticFindObject finds the picture once the game has loaded it
function StaticFindObject(path) assert(path == "/Game/Art/UI/NavIcons/T_NavIcons_Player_Self.T_NavIcons_Player_Self") if found then return pawn end end
local calls = 0   -- every opacity call on a label
local function Label(text)
    local l = Obj(0) l.Text, l.Op = text, 1
    function l:GetRenderOpacity() calls = calls + 1 return self.Op end
    function l:SetRenderOpacity(o) calls = calls + 1 self.Op = o end
    return l
end
-- a marker on a map: its component's owner, and the label beside it
local function Marker(addr, owner, text)
    local W = Obj(addr)
    W.MapIconComp = Obj(addr + 1)
    W.MapIconComp.IconTexture = owner
    W.IconLabel = Label(text)
    function W:GetFullName() return "Marker " .. self.Addr end
    return W
end
local other = Obj(701)   -- the friend arrow, the picture of another player
local list, keys = {}, {}
local function Add(key, W) list[#list + 1], keys[#keys + 1] = W, key return W end
local mine = Add("mini.mine", Marker(10, pawn, "Player"))
local friend = Add("mini.friend", Marker(20, other, "Player"))   -- a co-op friend under the same name
local herb = Add("mini.herb", Marker(30, Obj(400), ""))
local broken = Add("mini.broken", Marker(40, pawn, "Player"))
broken.MapIconComp.Valid = false   -- a component that reads as a wrapper of null
local early = Add("mini.early", Marker(50, pawn, "Player"))
early.MapIconComp = nil   -- not set up yet by the blueprint
local byState = Add("mini.state", Marker(60, state, "Player"))

clock = 100
os.clock = function() return clock end
local M = load(SRCTEXT)()
local on, logs, finds = true, {}, 0
local arrivals   -- the markers that the game reported since the last step (finder.lua's Arrivals)
local ctx = { Log = function(m) logs[#logs + 1] = m end, On = function() return on end,
    Arrived = function(c) assert(c == "WBP_Dominion_MinimapInternal_Icon_C") local a = arrivals arrivals = nil return a end,
    Find = function(c) finds = finds + 1 assert(c == "WBP_Dominion_MinimapInternal_Icon_C") return list, keys end }

-- on: nothing is searched or called
M.Tick(ctx) M.Scan(ctx) M.Scan(ctx)
check("on: no search and no call on a label", finds == 0 and calls == 0)

-- off: at once on the switch, without waiting for a scan
on = false
found = false   -- the game has not loaded the picture yet (a world loading): nothing is done
M.Tick(ctx)
check("picture not found: nothing is searched or called", finds == 0 and calls == 0 and #logs == 0)
found = true
clock = clock + 10   -- the scan of every marker runs every 10 s
M.Scan(ctx)
check("off: your label is hidden at once", finds == 1 and mine.IconLabel.Op == 0)
check("off: a label of your player state's marker too", byState.IconLabel.Op == 0)
check("off: another player's label stays, even under your name", friend.IconLabel.Op == 1)
check("off: a marker of something else stays", herb.IconLabel.Op == 1)
check("off: a component that cannot be read is left alone", broken.IconLabel.Op == 1)
check("off: a marker not set up yet is left alone", early.IconLabel.Op == 1)
check("off: a log line with the count", #logs == 1 and string.find(logs[1], "2 of 6", 1, true))

-- the next scans: the marker set up since is found; the ones looked at are not looked at again
early.MapIconComp = Obj(51)
early.MapIconComp.IconTexture = pawn
local looks = 0
friend.MapIconComp.IconTexture = nil
setmetatable(friend.MapIconComp, { __index = function(_, k) if k == "IconTexture" then looks = looks + 1 return other end end })
clock = clock + 10   -- the scan of every marker runs every 10 s
M.Scan(ctx)
check("a marker set up since is found on the next scan", early.IconLabel.Op == 0)
check("a marker is looked at once", looks == 0 and friend.IconLabel.Op == 1)
M.Tick(ctx)
check("off: the step does not search again", finds == 2)

-- the game shows the label again: the next scan hides it again
mine.IconLabel.Op = 1
clock = clock + 10   -- the scan of every marker runs every 10 s
M.Scan(ctx)
check("a label shown again is hidden again", mine.IconLabel.Op == 0)
check("the first 3 scans of a round are logged, then no more", #logs == 3)

-- a new marker on the big map
local pause = Add("pause.mine", Marker(70, pawn, "Player"))
clock = clock + 10   -- the scan of every marker runs every 10 s
M.Scan(ctx)
check("your marker on another map is hidden on the next scan", pause.IconLabel.Op == 0)

-- a freed slot: the same name on another widget is looked at as a new marker
local reused = Marker(80, pawn, "Player")
list[1] = reused
clock = clock + 10   -- the scan of every marker runs every 10 s
M.Scan(ctx)
check("the same name on another widget is a new marker", reused.IconLabel.Op == 0)
reused.IconLabel.Op = 1
list[1] = mine

-- a map opens: the game makes new markers and reports them; the next step hides yours, with no search and no wait for the scan
local function Reported(...) arrivals = { ... } end
local fresh = Marker(100, pawn, "Player")
local friendNew = Marker(101, other, "Player")
local late = Marker(102, pawn, "Player")
local lateComp = late.MapIconComp
late.MapIconComp = nil   -- the blueprint has not set it up when the game reports the widget
Reported(fresh, friendNew, late)
local findsBefore = finds
logs = {}
M.Tick(ctx)
check("a new marker of yours is hidden at the next step", fresh.IconLabel.Op == 0)
check("a new marker of another player stays", friendNew.IconLabel.Op == 1)
check("a new marker not set up yet stays for now", late.IconLabel.Op == 1)
check("no search for it", finds == findsBefore)
check("a log line says what was done", #logs == 2 and string.find(logs[1], "hidden 0 ms", 1, true) and string.find(logs[2], "looked at 3 new markers, 1 yours", 1, true))
late.MapIconComp = lateComp
lateComp.IconTexture = pawn
clock = clock + 0.05
M.Tick(ctx)
check("a look at most every 0.1 s", late.IconLabel.Op == 1)
clock = clock + 0.1
M.Tick(ctx)
check("a marker set up a moment later is hidden at the look after", late.IconLabel.Op == 0)

-- one that is never ready is given up after 1.5 s: the scan has it
local never = Marker(110, pawn, "Player")
local neverComp = never.MapIconComp
never.MapIconComp = nil
Reported(never)
for _ = 1, 20 do clock = clock + 0.1 M.Tick(ctx) end
never.MapIconComp = neverComp
clock = clock + 0.1
M.Tick(ctx)
check("a marker that was not ready for 1.5 s is left to the scan", never.IconLabel.Op == 1)
clock = clock + 10   -- the scan of every marker runs every 10 s
M.Scan(ctx)   -- (the scan only knows what is in the list)

-- many new markers: 100 are looked at in a step, the rest at the steps after
local reads = 0
local crowd = {}
for i = 1, 250 do
    local W = Obj(1000 + i)
    local comp = Obj(2000 + i)
    setmetatable(comp, { __index = function(_, k) if k == "IconTexture" then reads = reads + 1 return other end end })
    W.MapIconComp = comp
    W.IconLabel = Label("")
    crowd[i] = W
end
arrivals = crowd
clock = clock + 0.1
M.Tick(ctx)
check("250 new markers: 100 are looked at in the first step", reads == 100)
clock = clock + 0.1
M.Tick(ctx)
clock = clock + 0.1
M.Tick(ctx)
check("... and all of them in three", reads == 250)
clock = clock + 0.1
M.Tick(ctx)
check("... and then none again", reads == 250)

-- 150 markers not readable yet come first, then a marker of yours that is readable: it is not held up behind them
local blocked = {}
for i = 1, 150 do
    local W = Obj(3000 + i)
    W.MapIconComp = nil
    W.IconLabel = Label("")
    blocked[i] = W
end
local after = Marker(130, pawn, "Player")
local rest = {}
for i = 1, #blocked do rest[i] = blocked[i] end
rest[#rest + 1] = after
arrivals = rest
clock = clock + 0.1
M.Tick(ctx)   -- the first 100 are looked at and wait; the 51 not looked at yet are first in line
check("the first look: 100 markers not readable, your marker is still waiting", after.IconLabel.Op == 1)
clock = clock + 0.1
M.Tick(ctx)
check("the second look takes the ones not looked at before the ones not readable", after.IconLabel.Op == 0)

-- the markers are in the game's list from the next search on
Add("map.fresh", fresh) Add("map.late", late)

-- on: each label gets its own opacity back, once
clock = clock + 10   -- the scan of every marker runs every 10 s
M.Scan(ctx)
mine.IconLabel.Op = 0
on = true
M.Tick(ctx)
check("on: the labels of the new markers are back", fresh.IconLabel.Op == 1 and late.IconLabel.Op == 1)
check("on: your labels are back", mine.IconLabel.Op == 1 and byState.IconLabel.Op == 1 and early.IconLabel.Op == 1 and pause.IconLabel.Op == 1)
check("on: the others were never touched", friend.IconLabel.Op == 1 and broken.IconLabel.Op == 1)
local before = calls
local nsearch = finds
for _ = 1, 5 do M.Tick(ctx) M.Scan(ctx) end
check("on: nothing is called or searched afterwards", calls == before and finds == nsearch)
-- on: the reports are still taken at each step, and nothing is done with them
Reported(Marker(120, pawn, "Player"))
M.Tick(ctx)
check("on: a new marker is left alone, and the report is taken", arrivals == nil and calls == before)
-- the switch goes off while a marker waits, and on again: it is not looked at later
local waiting = Marker(121, pawn, "Player")
local waitingComp = waiting.MapIconComp
waiting.MapIconComp = nil
on = false
Reported(waiting)
M.Tick(ctx)
on = true
M.Tick(ctx)
on = false
M.Tick(ctx)
waiting.MapIconComp = waitingComp
clock = clock + 0.1
M.Tick(ctx)
check("a waiting marker is dropped when the switch goes on", waiting.IconLabel.Op == 1)
on = true
M.Tick(ctx)
before = calls

-- a label that holds 0 with no record (ours from a lost round) comes back at 1; one of its own opacity keeps it
local lost = Add("mini.lost", Marker(90, pawn, "Player"))
lost.IconLabel.Op = 0
mine.IconLabel.Op = 0.8
on = false
M.Tick(ctx)
on = true
M.Tick(ctx)
check("a label at 0 with no record comes back at 1", lost.IconLabel.Op == 1)
check("a label with an opacity of its own gets it back", mine.IconLabel.Op == 0.8)

-- a player restart while off: the records stay, and on puts the labels back
on = false
M.Tick(ctx)
M.Forget(true)
on = true
M.Tick(ctx)
check("restart, then on: the labels are back", mine.IconLabel.Op == 0.8 and lost.IconLabel.Op == 1)

-- a new world while off: nothing is called on the old markers
on = false
M.Tick(ctx)
M.Forget(false)
before = calls
on = true
M.Tick(ctx)
check("new world, then on: nothing is called on the old markers", calls == before)
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

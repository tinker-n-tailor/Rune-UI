// Tests immersive.lua without the game: a fake HUD and a fake clock (a fight, a heal, a new buff, low food, F9).
// Needs npm install once. Run: node tools/test-immersive.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'immersive.lua'), 'utf8');
const test = `
local T = 0
os.clock = function() return T end
local M = (function() ${src} end)()

-- every call that writes to the engine counts: in total, and on the widget (n)
local addr, writes = 0, 0
local function Widget(name) addr = addr + 1 return { name = name, op = 1, n = 0, addr = addr, IsValid = function() return true end,
  SetRenderOpacity = function(self, o) writes = writes + 1 self.n = self.n + 1 self.op = o end, GetAddress = function(self) return self.addr end } end
local function Text(s) return { s = s, IsVisible = function(self) return self.s ~= "" end,
  GetText = function(self) return { ToString = function() return self.s end } end } end
-- the column holds the rows; the special bar's parent is the column itself (see FadeRow), so it must never fade
local rowH, rowS, column = Widget("rowH"), Widget("rowS"), Widget("column")
rowS.GetParent = function() return column end
local hpText = Text("200/200")
-- the stamina fill's material numbers (in game: full is 1 minus the blocked part)
local st = { fill = 0.8, blocked = 0.2 }
local function Param(n, v) return { get = function() return { ParameterInfo = { Name = { ToString = function() return n end } }, ParameterValue = v } end } end
local stMat = { ScalarParameterValues = { ForEach = function(self, fn) fn(1, Param("Fill from Avaliable", st.fill)) fn(2, Param("Blocked from avaliable", st.blocked)) end } }
local function Bar(row, txt) local b = Widget("bar") b.GetParent = function() return row end b.txt = txt return b end
local bars = { Bar(rowS, nil), Bar(rowH, hpText), Bar(column, nil) }
bars[1].ProgressBarImage = { Brush = { ResourceObject = stMat } }
-- the particles of a bar that fills: every bar has them
local function Particles() return { vis = 0, IsValid = function() return true end, SetVisibility = function(self, v) writes = writes + 1 self.vis = v end } end
bars[1].NS_UI_StaminaBarIncrease, bars[2].NS_UI_HealthBarIncrease, bars[3].NS_UI_SpecialChargeBarIncrease = Particles(), Particles(), Particles()
local trim = Widget("trim")
-- the three survival rings, as survival.lua gives them: Low is true while the game shows the need in orange or red
local ring, water, rest = { Value = 0.9, Box = Widget("box") }, { Value = 0.9, Box = Widget("water") }, { Value = 0.9, Box = Widget("rest") }
local on, editing, chat, quest, hits = true, false, 0, "Quest_A:1:Objective1|-", 0
local drinks, drink = {}, nil
-- the buff entries: a good one has Arrivals, a debuff none; buffs.lua counts an arrival, the level is what it is told
local function Entry(good, arrivals) return { Positive = good, Arrivals = arrivals } end
local entries = { p1 = Entry(true, 1), p2 = Entry(true, 1) }
local mapStays, compassStays = false, false
local ctx = { Log = function() end, On = function() return on end, Editing = function() return editing end,
  Bars = function() return bars end, Trim = function() return trim end, BuffEntries = function() return entries end,
  BuffLevel = function(d, l) writes = writes + 1 d.level = l end,
  Rings = function() return { ring, water, rest } end, TextsUnder = function(W) return { W.txt } end,
  Wait = function() return 5 end,
  ChatCount = function() return chat end, Drinks = function() return drinks end, QuestSig = function() return quest end,
  PartyHits = function() return hits end,
  MapStays = function() return mapStays end, CompassStays = function() return compassStays end }

local function step() T = T + 0.05 M.Tick(ctx) end
local function run(sec) local stop = T + sec while T < stop - 1e-9 do step() end end
-- the steps of the next sec seconds in which anything was written to the engine
local function writingSteps(sec)
  local stop, count = T + sec, 0
  while T < stop - 1e-9 do local before = writes step() if writes ~= before then count = count + 1 end end
  return count
end
local function F(id) return M.Factor({ Id = id }) end
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end

M.Forget()
run(1)
check("start: everything shown", F("toolbar") == 1 and rowH.op == 1 and ring.Box.op == 1 and entries.p1.level == 1)
run(11.5)   -- the start hold (8 s) plus FADE_OUT, with room
check("idle: tool bar stays", F("toolbar") == 1)
check("idle: map gone", F("runemap") == 0)
check("idle: bars rows and trim gone", rowH.op == 0 and rowS.op == 0 and trim.op == 0)
check("idle: the column that holds the rows stays", column.op == 1)
check("idle: a bar whose row stays keeps its particles", bars[3].NS_UI_SpecialChargeBarIncrease.vis == 0)
check("idle: the particles of a faded bar are hidden", bars[1].NS_UI_StaminaBarIncrease.vis == 2 and bars[2].NS_UI_HealthBarIncrease.vis == 2)
check("idle: menu buttons gone", F("menubtn") == 0)
check("idle: the good buffs, avatar, compass gone; the row itself never fades", entries.p1.level == 0 and entries.p2.level == 0 and F("buffs") == 1 and F("avatar") == 0 and F("compass") == 0)
check("idle: food ring gone", ring.Box.op == 0)
check("never fades: prompts, tool bar, region, survival element", F("prompts") == 1 and F("toolbar") == 1 and F("region") == 1 and F("survival") == 1 and F("vitals") == 1)

-- the engine is written to only when something changed (20 steps a second here)
local quiet = writingSteps(10)
check("idle and faded, 10 s: a write only at the repeat every quarter second (" .. quiet .. " of 200 steps)", quiet >= 38 and quiet <= 42)
rowH.op = 1   -- the game made the row again at full
run(1.1)
check("a row the game makes again is faded again within a second", rowH.op == 0)
local row2 = Widget("row2")
local firstBar, newBar = bars[2], Bar(row2, hpText)
bars[2] = newBar
step()
check("a new handle for a bar: its row is faded at once, not at the repeat", row2.op == 0)
bars[2] = firstBar run(1.1)

hpText.s = "150/200"
repeat step() until rowH.op > 0
check("hit: the fade in has begun, not yet whole", rowH.op > 0 and rowH.op < 1)
local nH, nS, nTrim = rowH.n, rowS.n, trim.n
step()
check("a step that changes the level writes once to each row and the trim", rowH.n == nH + 1 and rowS.n == nS + 1 and trim.n == nTrim + 1)
run(0.5)
check("hit: bars back, exactly 1", rowH.op == 1 and F("avatar") == 1)
local nH2, nS2, nTrim2 = rowH.n, rowS.n, trim.n
run(5)
check("bars shown at 1: the rows and the trim get no more writes, also not at the repeat", rowH.n == nH2 and rowS.n == nS2 and trim.n == nTrim2)
check("hit: the good buffs come with the bars", entries.p1.level == 1 and entries.p2.level == 1)
run(20)
check("health not full: bars stay", rowH.op == 1)
check("health not full: the particles show again", bars[1].NS_UI_StaminaBarIncrease.vis == 0 and bars[2].NS_UI_HealthBarIncrease.vis == 0)
hpText.s = "200/200" run(4)
check("full: bars stay a few seconds", rowH.op == 1)
run(4.5)
check("full: then fade", rowH.op == 0 and entries.p1.level == 0)

st.fill = 0.6 run(0.5)
check("stamina used: bars stay away", rowH.op == 0)
st.fill = 0.8 run(8.5)


-- a new good buff shows for the wait; the others stay away, the bars too
entries.p3 = Entry(true, 1) run(0.5)
check("new good buff: it shows, the others and the bars stay away", entries.p3.level == 1 and entries.p1.level == 0 and rowH.op == 0)
run(2)
check("new good buff: it stays for the wait", entries.p3.level == 1)
run(3.4)
check("new good buff: then it fades smoothly", entries.p3.level > 0 and entries.p3.level < 1)
run(5)
check("new good buff: gone", entries.p3.level == 0)
entries.d1 = Entry(false, 0) run(0.5)
check("a debuff comes: the good buffs stay away, the debuff is not ours to fade", entries.p1.level == 0 and entries.d1.level == nil)
entries.p4 = Entry(true, nil) run(0.5)
check("an entry built again, not arrived: unseen at once", entries.p4.level == 0)
entries.p1.Arrivals = 2 run(0.5)
check("a reused entry or a fill that goes on: it shows again", entries.p1.level == 1 and entries.p2.level == 0)
run(5)
run(1)
check("and it fades by its own timer", entries.p1.level < 1)
run(10)
check("gone again", entries.p1.level == 0)
entries.d1 = nil

chat = 1 run(0.5)
check("chat message: menu buttons back", F("menubtn") == 1)
run(8.5)
check("chat message: then fade", F("menubtn") == 0)

check("idle: quest tracker gone", F("questlist") == 0)
quest = "Quest_A:1:Objective2|-" run(0.5)
check("new quest step: the quest tracker is back, the bars not", F("questlist") == 1 and rowH.op == 0)
run(8.5)
check("new quest step: the quest tracker fades", F("questlist") == 0)
quest = nil run(0.5)
check("no quest read: nothing wakes it", F("questlist") == 0)
mapStays = true run(1)
check("the map stays in the immersive mode: the quest tracker stays with it", F("questlist") == 1)
run(20)
check("and it does not fade while the map stays", F("questlist") == 1)
mapStays = false run(4)
check("the map goes again: the quest tracker fades", F("questlist") == 0)

-- the ammo counter: a change (a new rune or arrow, a bow or staff taken, a shot or cast) brings it for the wait, an aim
-- while it lasts
local swap, aiming = nil, false
ctx.AmmoChange = function() return swap end
ctx.Aiming = function() return aiming end
run(1)
check("idle: the ammo counter gone", F("ammo") == 0)
swap = 1 run(0.5)
check("a swap: the ammo counter is back, the bars not", F("ammo") == 1 and rowH.op == 0)
run(8.5)
check("after the wait: the ammo counter fades", F("ammo") == 0)
aiming = true run(0.5)
check("an aim: the ammo counter is back", F("ammo") == 1)
run(20)
check("and it stays while you aim", F("ammo") == 1)
aiming = false run(9)
check("the aim over: it fades after the wait", F("ammo") == 0)
swap = 2 run(0.5)
check("another swap: back again", F("ammo") == 1)
run(9)
check("the weapon held, no change and no aim: it fades", F("ammo") == 0)
swap = 3 run(0.5)
check("a shot or a cast (a new count): back again", F("ammo") == 1)
run(9)
ctx.AmmoChange, ctx.Aiming = nil, nil
run(1)
check("no ammo part and no camera: nothing wakes it, nothing fails", F("ammo") == 0)

-- the party panel: a friend whose health goes down brings it back; the map does not keep it
check("idle: the party panel is gone", F("party") == 0)
run(1)
check("nothing happens: it stays away", F("party") == 0)
hits = 1 run(0.5)
check("a friend is hurt: the party panel is back, the bars not", F("party") == 1 and rowH.op == 0)
run(4)
check("it stays for the wait", F("party") == 1)
hits = 2 run(4)
check("a friend is hurt again: the wait starts again", F("party") == 1)
run(8)
check("then it fades", F("party") == 0)
hits = nil run(0.5)
check("no count (no panel): nothing wakes it", F("party") == 0)
hits = 2 run(0.5)
check("the first count after none only sets the mark", F("party") == 0)
mapStays = true run(1)
check("the map stays: the party panel does not stay with it", F("party") == 0)
mapStays = false run(4)

-- "Keep in immersive mode" at Compass: the compass stays, the map (and the tracker) do not
check("Nothing: the compass is away", F("compass") == 0)
compassStays = true run(1)
check("Compass: the compass stays", F("compass") == 1)
check("Compass: the map is away (wiring.lua keeps it only for Map)", F("runemap") == 0)
check("Compass: the quest tracker does not stay with it", F("questlist") == 0)
run(20)
check("Compass: it does not fade while it stays", F("compass") == 1)
compassStays = false run(4)
check("Nothing again: the compass fades", F("compass") == 0)
mapStays = true run(1)
check("Map: the compass is away", F("compass") == 0 and F("questlist") == 1)
mapStays = false run(4)

ring.Value = 0.3 run(8.5)
check("food at 30, not yet orange: the ring stays away", ring.Box.op == 0)
ring.Value, ring.Low = 0.25, true run(0.5)
check("food in orange: its ring is back", ring.Box.op == 1)
check("only the ring of that need: water and rest stay away", water.Box.op == 0 and rest.Box.op == 0)
run(30)
check("food stays low: its ring stays, the others stay away", ring.Box.op == 1 and water.Box.op == 0 and rest.Box.op == 0)
ring.Value = 0.08 run(30)
check("food in red: its ring stays", ring.Box.op == 1)
ring.Value, ring.Low = 0.8, false run(0.5)
check("eating: ring stays", ring.Box.op == 1)
run(8.5)
check("fed: ring fades", ring.Box.op == 0)
water.Value = 0.95 run(0.5)
check("drinking with water not low: the water ring shows for the wait, alone", water.Box.op == 1 and ring.Box.op == 0 and rest.Box.op == 0)
run(8.5)
check("then it fades", water.Box.op == 0)
rest.Value, rest.Low = nil, true run(0.5)
check("low with no share read yet: the ring still shows", rest.Box.op == 1)
rest.Value, rest.Low = 0.9, false run(8.5)

drink = { Value = 1, Root = Widget("drink") } drinks.d1 = drink run(0.5)
check("new drink: drink ring shows", drink.Root.op == 1)
run(8.5)
check("drink: then fades", drink.Root.op == 0)
quiet = writingSteps(5)
check("everything faded, a drink ring too: a write only at the repeat every quarter second (" .. quiet .. " of 100 steps)", quiet >= 18 and quiet <= 22)
drink.Value = 0.3 run(0.5)
check("drink runs low: back", drink.Root.op == 1)
run(8.5)
check("drink low: stays", drink.Root.op == 1)
drink.Value = 1 run(8.5)
check("a new drink in the same entry: shown, then fades", drink.Root.op == 0)
drink.Value = 0.9 run(0.3) drink.Value = 1 run(0.5)
check("the seconds jump up again: back", drink.Root.op == 1)
-- the game's spare entry, stale at a low share, must not hold the shown one or be held by it
local spare = { Value = 0.1, Root = Widget("spare") } drinks.d0 = spare
drink = { Value = 1, Root = Widget("drink2") } drinks.d2 = drink run(0.5)
check("another drink, new entry: shows", drink.Root.op == 1)
run(8.5)
check("another drink: fades, a spare entry low does not hold it", drink.Root.op == 0)

editing = true run(0.3)
check("F9 open: drink back", drink.Root.op == 1)
check("F9 open: everything back", F("toolbar") == 1 and F("compass") == 1 and rowH.op == 1 and ring.Box.op == 1)
editing = false run(3)
on = false run(0.3)
check("switched off: drink back", drink.Root.op == 1)
check("switched off: everything back", F("toolbar") == 1 and F("compass") == 1 and F("menuico") == 1 and F("runemap") == 1 and rowH.op == 1 and ring.Box.op == 1)
local calls = 0
rowH.SetRenderOpacity = function(self, o) calls = calls + 1 self.op = o end
run(2)
check("switched off: the good buffs are shown", entries.p1.level == 1 and entries.p4.level == 1)
check("switched off: no more writes", calls == 0)
print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
if fails > 0 then error("tests failed") end
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== lua.LUA_OK) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }

// Tests the switch "Damage numbers" (damagenumbers.lua) against fake objects shaped like the game's: off, the two overlays
// of every pooled WBP_FloatingDamage_C (the number and the word "Critical") go unseen, 20 hits in a row show nothing even
// when the game's animation writes the opacity again, a widget the game made later is hidden within a second, and the status
// words (WBP_FloatingText_C) are never searched or written. On again, every overlay has the opacity it had, also after a
// player restart, a new world, and a record whose widget is not found at first. A widget with one part or none is safe.
// A calm world costs no search. The part never writes the render scale (the pop of combattext.lua does).
// Needs npm install once. Run: node tools/test-damagenumbers.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'damagenumbers.lua'), 'utf8');
const wiring = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'wiring.lua'), 'utf8');
const test = `
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local clock = 0
os.clock = function() return clock end

-- an overlay of a pooled widget: its render opacity, and the number of writes
local function Part()
    local p = { Op = 1, Writes = 0 }
    function p:IsValid() return not self.gone end
    function p:GetRenderOpacity() return self.Op end
    function p:SetRenderOpacity(o) self.Op = o self.Writes = self.Writes + 1 end
    return p
end

local addresses = 0
-- a pooled number: both overlays, and an animation that the game plays on a hit. Play: the game writes opacity 1 on both.
-- As in the game, FloatieOverlay is not a variable of the widget: only its text FloatiesText is. Num is the test's own handle.
local function Number(id, only)
    addresses = addresses + 1
    local W = { Addr = 100 + addresses, Playing = false, Polls = 0, ScaleWrites = 0 }
    if only ~= "word" then
        W.Num = Part()
        local text = { parent = W.Num }
        function text:IsValid() return true end
        function text:GetParent() return self.parent end
        W.FloatiesText = text
    end
    if only ~= "number" then W.CriticalTextOverlay = Part() end
    function W:IsValid() return not self.gone end
    function W:GetAddress() return self.Addr end
    function W:IsAnyAnimationPlaying() self.Polls = self.Polls + 1 return self.Playing end
    function W:SetRenderScale() self.ScaleWrites = self.ScaleWrites + 1 end
    function W:Play() self.Playing = true for _, n in ipairs({ "Num", "CriticalTextOverlay" }) do if self[n] then self[n].Op = 1 end end end
    function W:End() self.Playing = false end
    return W
end
-- a pooled status word: it must never be read or written
local function Word(id)
    local W = { Addr = 900 + id }
    W.TextBackground, W.FloatieShadowText = Part(), Part()
    function W:IsValid() return true end
    function W:GetAddress() return self.Addr end
    return W
end

local pool, keys = { Number(1), Number(2), Number(3) }, { "n1", "n2", "n3" }
local words = { Word(1), Word(2) }
local finds, asked = 0, {}
local shown, logs = true, {}
local ctx = { Log = function(m) logs[#logs + 1] = m end, On = function() return shown end,
    Find = function(class) finds = finds + 1 asked[class] = true return pool, keys end }
local M = load(SRCTEXT)()
local function Tick(dt) clock = clock + (dt or 1.1) M.Tick(ctx) end
local function Op(W) return W.Num.Op == 0 and W.CriticalTextOverlay.Op == 0 end
local function AllHidden() for _, W in ipairs(pool) do if not Op(W) then return false end end return true end
local function Words() for _, W in ipairs(words) do if W.TextBackground.Writes ~= 0 or W.FloatieShadowText.Writes ~= 0 then return false end end return true end
local function Scale() for _, W in ipairs(pool) do if W.ScaleWrites ~= 0 then return false end end return true end

-- on at first: nothing read, nothing written, no search
Tick() Tick()
check("on at first: no search, no write, no log", finds == 0 and #logs == 0 and pool[1].Num.Writes == 0 and pool[1].CriticalTextOverlay.Writes == 0)

-- off: the numbers' overlays go unseen at once, one log line, only the damage pool is searched
pool[2].Num.Op = 0.8   -- a value the game holds, to be given back
shown = false
Tick()
check("off: the number and the word of every pooled number are unseen", AllHidden())
check("off: one log line that names the parts", #logs == 1 and logs[1]:find("3 numbers watched", 1, true) and logs[1]:find("FloatieOverlay and CriticalTextOverlay", 1, true))
check("off: only the pool of the damage numbers is searched, the status words are never asked for", asked.WBP_FloatingDamage_C == true and next(asked) == "WBP_FloatingDamage_C" and next(asked, "WBP_FloatingDamage_C") == nil)
check("off: the status words are not written, and the render scale is not used", Words() and Scale())

-- a calm world: a look once a second, a poll on every step, no writes
local before = finds
Tick(0.05) Tick(0.05) Tick(0.05)
check("calm: no search between two looks, and a poll of every number on each step", finds == before and pool[1].Polls >= 3)
check("calm: nothing written again", pool[1].Num.Writes == 1 and pool[1].CriticalTextOverlay.Writes == 1)

-- 20 hits in a row: the game writes opacity 1 as the animation starts, and the step puts it back
local seenAny = false
for hit = 1, 20 do
    local W = pool[(hit - 1) % 3 + 1]
    W:Play()
    Tick(0.05)
    if not Op(W) then seenAny = true end
    W:End()
    Tick(0.05)
end
check("20 hits: after each step that sees the animation, no number shows", not seenAny and AllHidden() and Words() and Scale())

-- the game made a widget since the last look: hidden at the next look (within a second)
Tick(1.1)   -- a look has just been made
local late = Number(4)
pool[4], keys[4] = late, "n4"
Tick(0.4)
check("a new widget in the pool: not hidden before the look", late.Num.Op == 1)
Tick(0.7)
check("a new widget in the pool: hidden at the next look", Op(late))

-- the switch back on: every overlay has its own opacity again, the records are gone, the status words are untouched
shown = true
finds = 0
Tick(0.05)
check("on again: every overlay has the opacity it had", pool[1].Num.Op == 1 and pool[2].Num.Op == 0.8 and pool[3].CriticalTextOverlay.Op == 1 and late.Num.Op == 1)
check("on again: one log line, the status words untouched", #logs == 2 and logs[2]:find("the numbers are back", 1, true) and Words())
finds = 0
Tick() Tick() Tick()
check("on again: a calm round costs no search", finds == 0)
pool[1].Num.Op = 0.5   -- the game's own business now
Tick()
check("on again: nothing is written any more", pool[1].Num.Op == 0.5)

-- off again later: hidden again, the originals read fresh
shown = false
Tick(0.05)
check("off again: hidden again", AllHidden() and Op(late))
shown = true
Tick(0.05)
check("and on again: the opacity of the second time is back", pool[1].Num.Op == 0.5)

-- a player restart (same widgets) while off: the handles go, the widgets stay hidden, and on gives them back
shown = false
Tick(0.05)
M.Forget(true)
Tick(1.1)
check("restart while off: still hidden", AllHidden())
shown = true
Tick(0.05)
check("restart, then on: the originals are back", pool[1].Num.Op == 0.5 and pool[2].Num.Op == 0.8 and pool[1].CriticalTextOverlay.Op == 1)

-- a new world while off: the old widgets are gone, new ones at the same names are hidden and restored
shown = false
pool[2].Num.Op = 0.8
Tick(0.05)
M.Forget(false)
for i = 1, 4 do pool[i] = Number(i) end
pool[3].Num.Op = 0.6
Tick(1.1)
check("new world while off: the new widgets are hidden", AllHidden())
shown = true
Tick(0.05)
check("new world, then on: the new widgets have their own opacities", pool[3].Num.Op == 0.6 and pool[1].Num.Op == 1 and pool[4].CriticalTextOverlay.Op == 1)

-- a record whose widget is not found at first (the search gives nothing for a moment): kept, restored when it is back
shown = false
Tick(1.1)
local all = pool
pool = {}
shown = true
Tick(0.05) Tick(1.1)
check("on while the pool is empty: nothing to do, the record waits", pool[1] == nil and all[1].Num.Op == 0)
pool = all
Tick(1.1)
check("the pool is back: the widgets get their opacity", all[1].Num.Op == 1 and all[3].Num.Op == 0.6)

-- a part that reads 0 when first seen (a record lost): the game's own 1 comes back
logs = {}
M.Forget(false)
shown = false
pool = { Number(1) } keys = { "z1" }
pool[1].Num.Op = 0
Tick(1.1)
shown = true
Tick(0.05)
check("a part that read 0 gets 1", pool[1].Num.Op == 1)

-- a widget with one part, and one with none: the first is hidden in its one part, the second logged once
M.Forget(false)
logs = {}
shown = false
pool = { Number(1, "number"), Number(2, "word"), Number(3, "none") } keys = { "p1", "p2", "p3" }
pool[3].Num, pool[3].FloatiesText, pool[3].CriticalTextOverlay = nil, nil, nil
Tick(1.1) Tick(1.1) Tick(1.1)
check("one part only: that part is unseen", pool[1].Num.Op == 0 and pool[2].CriticalTextOverlay.Op == 0)
check("a widget with neither part: one log line, not one every second", #logs == 2 and logs[1]:find("not hidden", 1, true) and logs[2]:find("3 numbers watched, hidden in FloatieOverlay", 1, true))
shown = true
Tick(0.05)
check("and on again: those parts are back", pool[1].Num.Op == 1 and pool[2].CriticalTextOverlay.Op == 1)

-- a widget freed between two looks does not stop the others
M.Forget(false)
shown = false
pool = { Number(1), Number(2) } keys = { "f1", "f2" }
Tick(1.1)
pool[1].gone = true
pool[1].Playing = true
pool[2]:Play()
Tick(0.05)
check("a freed widget: the others are still held", Op(pool[2]))

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
let bad = lua.lua_tointeger(L, -1) ? 1 : 0;

// the wiring: the part is loaded with the switch dmgnumbers, apart from the combat text
const line = wiring.match(/AddPart\("damage numbers", DamageNumbers, \{[^\n]*\}\) end/);
if (!line || !line[0].includes('ById("dmgnumbers").Visible') || !line[0].includes('Find = FindClass')) { console.log('FAIL wiring.lua: the part "damage numbers" is added with Find and the switch dmgnumbers'); bad = 1; }
else console.log('ok   wiring.lua loads the part with the switch dmgnumbers');
if (/AddPart\("combat text"[^\n]*\n[^\n]*\n[^\n]*dmgnumbers/.test(wiring)) { console.log('FAIL wiring.lua: the combat text must not read dmgnumbers'); bad = 1; }
process.exit(bad);

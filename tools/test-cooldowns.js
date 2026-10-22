// Tests the spell cooldown tiles (cooldowns.lua) without the game: the order of the tiles (M.Order), and where the
// tiles and the box sit in a column and in a row (the switch "cdhoriz"), also when it flips while tiles are shown.
// The widgets are stand-ins that record what they are told.
// Needs npm install once. Run: node tools/test-cooldowns.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = require('path').join(__dirname, '..', 'RuneUI', 'Scripts');
const src = fs.readFileSync(require('path').join(dir, 'cooldowns.lua'), 'utf8');
const survivalSrc = fs.readFileSync(require('path').join(dir, 'survival.lua'), 'utf8');   // the tiles use its Add
const elementsLua = fs.readFileSync(require('path').join(dir, 'elements.lua'), 'utf8');
// the element in elements.lua that F9 moves: its box is the one cooldowns.lua says, and it turns with the switch
const el = /Id="cooldowns".*\r?\n.*Size=\{X=(\d+), Y=(\d+)\}/.exec(elementsLua);
if (!el || !/Id="cooldowns".*Turn="cdhoriz"/.test(elementsLua) || !/Id="cdhoriz".*Custom="cdhoriz"/.test(elementsLua)) {
  console.log('FAIL elements.lua: the element "cooldowns" must have Turn="cdhoriz", and the switch "cdhoriz" must exist');
  process.exit(1);
}
// the switch row says where to move and resize the tiles: the size keys do nothing on it (seen in the game, 05-10-2026)
// off at first: a layout that never saw the switch keeps the stack vertical
if (!/cdhoriz={Visible=false}/.test(elementsLua)) { console.log('FAIL elements.lua: the defaults must have cdhoriz={Visible=false}'); process.exit(1); }
// the tiles start 140 under the middle for a new layout, as a default move, so a saved layout keeps its own place
if (!/cooldowns=\{Y=140\}/.test(elementsLua) || !/Id="cooldowns"[^\n]*\n\s*A=\{0,0\.5\}, Center=\{X=70, Y=540\}/.test(elementsLua)) { console.log('FAIL elements.lua: the element "cooldowns" must be centred at Y=540, with the default move cooldowns={Y=140}'); process.exit(1); }
const test = `
local M = load(SRCTEXT)()
local function Set(...) local s = {} for _, k in ipairs({ ... }) do s[k] = true end return s end
local function Same(a, b, what) assert(table.concat(a, ",") == table.concat(b, ","), what .. ": " .. table.concat(a, ",")) end
-- slice order is 0..11; the wheel lists them in slice order, not cast order
local o = M.Order({}, Set("s3"), { "s3" })
Same(o, { "s3" }, "first cast")
o = M.Order(o, Set("s1", "s3"), { "s1", "s3" })
Same(o, { "s3", "s1" }, "second cast goes to the bottom")
o = M.Order(o, Set("s1", "s3", "s5"), { "s1", "s3", "s5" })
Same(o, { "s3", "s1", "s5" }, "third cast")
o = M.Order(o, Set("s1", "s5"), { "s1", "s5" })
Same(o, { "s1", "s5" }, "first one ready: the rest move up")
o = M.Order(o, Set("s1", "s3", "s5"), { "s1", "s3", "s5" })
Same(o, { "s1", "s5", "s3" }, "cast again: at the bottom")
o = M.Order(o, {}, {})
Same(o, {}, "all ready")
assert(M.BOX_W == 60 and M.BOX_H == 400, "box " .. M.BOX_W .. "x" .. M.BOX_H)
assert(M.BOX_W == MAINW and M.BOX_H == MAINH, "elements.lua's Size says " .. MAINW .. " x " .. MAINH)
local w, h = M.BoxOf(false)
assert(w == 60 and h == 400, "the column's box")
w, h = M.BoxOf(true)
assert(w == 400 and h == 60, "the row's box is the same numbers turned")

---- stand-ins for the engine: a widget records what it is told; a slot of a canvas records its place
local now = 0
os.clock = function() return now end
FText = function(s) return s end
FName = function(s) return s end
local Any
local function Dummy() return setmetatable({}, { __index = function() return Any end, __newindex = function() end, __call = function() return Any end }) end
Any = Dummy()
FindFirstOf = function() return Any end
StaticFindObject = function(path) return path end
local made = {}
local failBuild = false
local Widget = {}
Widget.__index = function(t, k)
    if k == "IsValid" then return function() return true end end
    if k == "SetText" then return function(self, s) self.Text = s end end
    if k == "SetVisibility" then return function(self, v) self.Vis = v end end
    if k == "SetColorAndOpacity" then return function(self, c) self.Colour = c end end
    if k == "SetWidthOverride" then return function(self, v) self.OverW = v end end
    if k == "SetHeightOverride" then return function(self, v) self.OverH = v end end
    if k == "SetRenderTransformPivot" then return function(self, p) self.Pivot = p end end
    if k == "GetRenderOpacity" then return function() return 1.0 end end
    if k == "AddChildToCanvas" then
        return function(self)
            local slot = { Pos = nil }
            slot.SetAutoSize = function(s, v) s.Auto = v end
            slot.SetAnchors = function(s, a) s.Anchors = a end
            slot.SetPosition = function(s, p) s.Pos = p end
            return slot
        end
    end
    return Any
end
StaticConstructObject = function(cls, _, name)
    if failBuild then error("no class") end
    local w = setmetatable({ Name = name, Class = cls }, Widget)
    made[#made + 1] = w
    return w
end

---- the spell wheel: slices s1 to s8, each with its cooldown parts; a slice recovers while its Vis is 3
local function Part(extra)
    local p = { IsValid = function() return true end }
    for k, v in pairs(extra or {}) do p[k] = v end
    return p
end
local slices, keys, byObj = {}, {}, {}
for i = 1, 8 do
    local tex = Part({ GetAddress = function() return 1000 + i end })
    local cd = Part({ Vis = 1 })
    cd.GetVisibility = function(self) return self.Vis end
    local secs = Part({ GetText = function() return { ToString = function() return "s" .. i end } end })
    local slice = Part({ Brush = { ResourceObject = tex }, Cd = cd })
    byObj[slice] = { CooldownWidget = cd, SliceIcon = slice }
    byObj[cd] = { TimerRing = Part({ Brush = {} }), CooldownText = secs }
    slices[i], keys[i] = slice, "s" .. i
end
local function Recovering(...)
    local on = Set(...)
    for i, s in ipairs(slices) do s.Cd.Vis = on["s" .. i] and 3 or 1 end
end

-- main.lua's MayTry and Failed
local function MayTry(P) return (P.Fails or 0) < 3 and os.clock() >= (P.RetryAt or 0) end
local function Failed(P) P.Fails, P.RetryAt = (P.Fails or 0) + 1, os.clock() + 10 end
local logs, horizontal, editing, on = {}, false, false, true
local vitals = { Instances = { Part({ IsVisible = function() return true end }) } }
local ctx = { Log = function(m) logs[#logs + 1] = m end, Survival = load(SURVIVALTEXT)(),
    ById = function(id) if id == "cooldowns" then return { Center = { X = 70, Y = 680 } } end return vitals end,
    Find = function(o, name) return byObj[o] and byObj[o][name] end,
    Slices = function() return slices, keys end, MayTry = MayTry, Failed = Failed,
    Text = function(_, name) return StaticConstructObject("/Script/UMG.TextBlock", nil, name) end,
    On = function() return on end, Editing = function() return editing end, Horizontal = function() return horizontal end }
local function Tick() now = now + 0.3 M.Tick(ctx) end
local function Settle() Tick() Tick() end   -- the build, and the show

-- the tiles on the screen, as "seconds text at X,Y" in tile order
local function Shown()
    local out = {}
    for _, t in ipairs(M.Tiles) do
        if t.Box.Vis == 4 then out[#out + 1] = t.Text.Text .. "@" .. t.Slot.Pos.X .. "," .. t.Slot.Pos.Y end
    end
    return table.concat(out, " ")
end
-- the point that F9 moves and sizes the box about, on the screen (the widget gives it as a share of its size)
local function Pivot() return M.Slot.Pos.X + M.W.Pivot.X * M.W.OverW, M.Slot.Pos.Y + M.W.Pivot.Y * M.W.OverH + 540 end

---- a column: the box 60 x 400, tiles from the top down, six of them, the box where F9 has it
Recovering()
Settle()
assert(M.W and M.UW and #M.Tiles == 6, "built")
assert(M.W.OverW == 60 and M.W.OverH == 400, "column: the box is 60 x 400")
assert(M.Tiles[1].Slot.Pos.X == 0 and M.Tiles[1].Slot.Pos.Y == 0 and M.Tiles[6].Slot.Pos.X == 0 and M.Tiles[6].Slot.Pos.Y == 340, "column: tiles at 0, 68 ... 340")
for _, t in ipairs(M.Tiles) do assert(t.Slot.Auto == true, "a tile slot takes the tile's own size") end
assert(M.Slot.Pos.X == 40 and M.Slot.Pos.Y == -60, "column: top left of the box, from the middle 70, 680")
local mx, my = Pivot()
assert(mx == 70 and my == 680, "column: the point to move and size it about is the element's centre")
assert(M.W.Pivot.X == 0.5 and M.W.Pivot.Y == 0.5, "column: about the middle, as it always was")
assert(M.Horizontal == false)
assert(Shown() == "", "nothing recovering, nothing shown")
-- the back of each tile is see-through by survival.lua's value, the same as the back of a ring
for _, t in ipairs(M.Tiles) do assert(t.Back.Colour and t.Back.Colour.A == 0.40 and t.Back.Colour.R == 1, "a tile's back is at survival.lua's BACK_ALPHA") end

Recovering("s3")
Tick()
Recovering("s3", "s1")
Tick()
assert(Shown() == "s3@0,0 s1@0,68", "column: the newest is at the bottom: " .. Shown())
Recovering("s1")
Tick()
assert(Shown() == "s1@0,0", "column: a finished tile closes the gap, the one below moves up: " .. Shown())

---- the same tiles in a row: the box 400 x 60, the same middle, the newest at the right end
Recovering("s1", "s3")
Tick()
assert(Shown() == "s1@0,0 s3@0,68", Shown())
horizontal = true
local builds, widget = #made, M.W
Tick()
assert(M.W == widget and #made == builds, "flipped on the screen: the same widget, nothing built again")
assert(M.Horizontal == true and M.W.OverW == 400 and M.W.OverH == 60, "row: the box is 400 x 60")
assert(Shown() == "s1@0,0 s3@68,0", "row: the same tiles in a row, the newest at the right end: " .. Shown())
assert(M.Tiles[6].Slot.Pos.X == 340 and M.Tiles[6].Slot.Pos.Y == 0, "row: tiles at 0, 68 ... 340")
assert(M.Slot.Pos.X == 40 and M.Slot.Pos.Y == 110, "row: the same left edge as the column (40), the same middle height (680)")
assert(M.Slot.Pos.X + M.W.OverW == 440, "row: from 40 to 440, on the screen")
mx, my = Pivot()
assert(mx == 70 and my == 680, "row: the same point to move and size it about as the column: the left end does not jump")
Recovering("s1", "s3", "s6")
Tick()
assert(Shown() == "s1@0,0 s3@68,0 s6@136,0", "row: a third, at the right end: " .. Shown())
Recovering("s3", "s6")
Tick()
assert(Shown() == "s3@0,0 s6@68,0", "row: the first one is ready, the ones to its right move left: " .. Shown())
Recovering("s6")
Tick()
assert(Shown() == "s6@0,0", "row: one left, at the start")
horizontal = false
Tick()
assert(M.W.OverW == 60 and M.W.OverH == 400 and Shown() == "s6@0,0" and M.Slot.Pos.X == 40 and M.Slot.Pos.Y == -60 and M.W.Pivot.X == 0.5, "flipped back: the column again: " .. Shown())

---- six tiles at most: a seventh recovering spell waits, in both
Recovering()
Tick()
Recovering("s1", "s2", "s3", "s4", "s5", "s6", "s7")
Tick()
assert(Shown() == "s1@0,0 s2@0,68 s3@0,136 s4@0,204 s5@0,272 s6@0,340", "column: six tiles, the seventh waits: " .. Shown())
horizontal = true
Tick()
assert(Shown() == "s1@0,0 s2@68,0 s3@136,0 s4@204,0 s5@272,0 s6@340,0", "row: six tiles, the seventh waits: " .. Shown())
Recovering("s2", "s3", "s4", "s5", "s6", "s7")
Tick()
assert(Shown() == "s2@0,0 s3@68,0 s4@136,0 s5@204,0 s6@272,0 s7@340,0", "row: the first is ready, the seventh takes the free tile: " .. Shown())

---- the F9 sample tiles follow the switch
Recovering()
Tick()
editing = true
Tick()
-- the sample tiles show made-up seconds (18, 7, 2) with the first spells' icons
assert(Shown() == "18@0,0 7@68,0 2@136,0", "row: three sample tiles in a row: " .. Shown())
horizontal = false
Tick()
assert(Shown() == "18@0,0 7@0,68 2@0,136", "column: three sample tiles in a column: " .. Shown())
editing = false

---- a new world: the next build is as the switch says, with the box and the tiles in place at once
M.Forget(false)
assert(M.W == nil and M.Slot == nil)
horizontal = true
Settle()
assert(M.W.OverW == 400 and M.W.OverH == 60 and M.Tiles[2].Slot.Pos.X == 68 and M.Tiles[2].Slot.Pos.Y == 0 and M.Slot.Pos.X == 40 and M.Slot.Pos.Y == 110 and M.W.Pivot.X == 0.075, "built as a row")

---- a build that fails: not again on the next step, again after 10 s, 3 tries at most (main.lua MayTry and Failed)
M.Forget(false)
local function Wait(secs) now = now + secs M.Tick(ctx) end
local function Count(pattern) local n = 0 for _, l in ipairs(logs) do if l:find(pattern) then n = n + 1 end end return n end
failBuild = true
logs = {}
for _ = 1, 8 do Wait(0.3) end
assert(Count("cooldowns failed") == 1 and M.Fails == 1, "a failed build is not tried again on the next steps")
Wait(10)
assert(Count("cooldowns failed") == 2 and M.Fails == 2, "it is tried again after 10 s")
Wait(10) Wait(10) Wait(10)
assert(Count("cooldowns failed") == 3 and M.Fails == 3, "three failed tries, then it stops")
failBuild = false
Wait(10)
assert(M.W == nil, "a stopped part stays stopped")
M.Forget(false)
assert(M.Fails == 0 and M.RetryAt == 0, "a new round gives it new tries")
Settle()
assert(M.W ~= nil, "and it builds")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(survivalSrc)); lua.lua_setglobal(L, to_luastring('SURVIVALTEXT'));
lua.lua_pushnumber(L, Number(el[1])); lua.lua_setglobal(L, to_luastring('MAINW'));
lua.lua_pushnumber(L, Number(el[2])); lua.lua_setglobal(L, to_luastring('MAINH'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

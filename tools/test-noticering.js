// Tests the ring in the hunger, thirst and rest warning (noticering.lua) against fake entries (fake-notices.js): each of the
// three needs gets the ring of that need, picked from the glyph's texture; the game's thin arc, back and glyph are hidden
// while it shows and given back when it does not; the ring is built once for the entry; its fill and colours follow the HUD
// ring; no HUD ring, no survival.lua, a back that is not in an Overlay, pictures that do not load, and freed widgets are
// safe. The last part runs survival.lua's real rings and the warning on top of them. It also checks the see-through back and
// centre of every kind of ring.
// Needs npm install once. Run: node tools/test-noticering.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const prelude = require('./fake-notices');
const test = prelude + `
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function Count(pattern) local n = 0 for _, m in ipairs(logs) do if m:find(pattern, 1, true) then n = n + 1 end end return n end
local function Near(a, b) return math.abs(a - b) < 1e-6 end
local function SameColour(a, b) return Near(a.R, b.R) and Near(a.G, b.G) and Near(a.B, b.B) end
Style = load(STYLETEXT)()
load(READTEXT)().Install(Style)
load(RINGTEXT)().Install(Style)

-- the latest widget the mod made whose name ends so; the ring's name is made by ctx.Uniq: RU_WarnRing_7_<n>
local function Mine(pattern) for i = #ringMade, 1, -1 do if ringMade[i].name:find(pattern) then return ringMade[i] end end end
local function Ring() return {
    Box = Mine("^RU_WarnRing_7_%d+$"), Back = Mine("^RU_WarnRing_7_%d+Back$"), Centre = Mine("^RU_WarnRing_7_%d+Centre$"),
    Right = Mine("^RU_WarnRing_7_%d+RImg$"), Left = Mine("^RU_WarnRing_7_%d+LImg$"), Glyph = Mine("^RU_WarnRing_7_%d+Glyph$") } end
local function Boxes() local n = 0 for _, m in ipairs(ringMade) do if m.name:find("^RU_WarnRing_7_%d+$") then n = n + 1 end end return n end
local function Glyph(w, need) local t = Tex("T_Icon_Upkeep_" .. need) w.glyph.Brush.ResourceObject = t return t end
local function Show(M, ctx) Step(M, ctx, 1.1) Step(M, ctx, 1.1) end
local SEEN, HIDDEN, COLLAPSED = 3, 2, 1

-- built once at the first walk, hidden while the glyph is no need; the game's parts are untouched then
local M, ctx = Fresh()
Step(M, ctx) Step(M, ctx, 1.1) Step(M, ctx, 1.1)
local w, r = current, Ring()
local root = w.ring.WidgetTree.RootWidget
check("the ring is made once, in the Overlay of the game's ring back, after the game's parts", Boxes() == 1 and #root.kids == 4 and root.kids[4] == r.Box and r.Box.parent == root)
check("its box is as big as the game's ring back and is centred", r.Box.width == 68 and r.Box.height == 68 and r.Box.slot.h == 2 and r.Box.slot.v == 2)
check("the ring is lifted 10 units, clear of the band and its top line", r.Box.RenderTransform.Translation.Y == -10 and r.Box.RenderTransform.Translation.X == 0)
check("its widgets are in the bar's own tree, named by the mod's name maker", r.Box.outer == w.ring.WidgetTree and r.Box.name:find("^RU_WarnRing_7_%d+$") ~= nil)
check("a glyph that is no need: ours is hidden, the game's back, arc and glyph are left alone", r.Box.vis == HIDDEN and w.ringBack.wrote == nil and w.arc.wrote == nil and w.glyph.wrote == nil)
check("it has the three pictures of the HUD ring, the back and centre see-through, the halves and the glyph picture whole", imports == 3
    and Near(r.Back.ColorAndOpacity.A, 0.40) and Near(r.Centre.ColorAndOpacity.A, 0.25) and r.Right.ColorAndOpacity.A == 1)
check("no log line", #logs == 0)

-- each need gets the ring of its HUD ring: the glyph's texture picks it, the fill and the colours are the HUD ring's
local hud = ctx.Hud()
local survival = ctx.Survival
for i, need in ipairs({ "Hydration", "Sustenance", "Endurance" }) do
    local t = Glyph(w, need)
    Show(M, ctx)
    r = Ring()
    local b = hud[i]
    local p = b.Value
    check(need .. ": the ring is shown, the mouse goes through it", r.Box.vis == SEEN)
    check(need .. ": the glyph is the warning's own texture, in the cream of the HUD icons", r.Glyph.Brush.ResourceObject == t and SameColour(r.Glyph.ColorAndOpacity, survival.ICON_TINT))
    check(need .. ": the ring has the colour of the HUD ring of " .. b.Name, SameColour(r.Right.ColorAndOpacity, b.Colour) and SameColour(r.Left.ColorAndOpacity, b.Colour))
    local right = p <= 0.5 and (p * 360 - 180) or 0
    check(need .. ": the fill is the HUD ring's " .. p, Near(r.Right.angle, right) and r.Left.opacity == (p <= 0.5 and 0 or 1) and (p <= 0.5 or Near(r.Left.angle, p * 360 - 180)))
    check(need .. ": the game's ring back, thin arc and glyph are collapsed", w.ringBack.vis == COLLAPSED and w.arc.vis == COLLAPSED and w.glyph.vis == COLLAPSED)
end
check("three shows with three needs: still one ring, its pictures decoded once, no log line, no write to an entry's visibility or opacity", Boxes() == 1 and #root.kids == 4 and imports == 3 and #logs == 0 and violations == 0)

-- the fill and the colours follow the HUD ring while the warning is shown, and nothing is written when they do not change
hud[3].Value = 0.4
hud[3].Shown = { Ring = { R = 0.9, G = 0.3, B = 0.1, A = 1 }, Icon = { R = 1, G = 0.2, B = 0.1, A = 1 } }   -- the low colours survival.lua's Warn keeps
Step(M, ctx, 1.1)
r = Ring()
check("the HUD ring falls and turns orange: ours turns with it, its ring and its glyph in the HUD ring's low colours", Near(r.Right.angle, 0.4 * 360 - 180) and r.Left.opacity == 0
    and SameColour(r.Right.ColorAndOpacity, hud[3].Shown.Ring) and SameColour(r.Left.ColorAndOpacity, hud[3].Shown.Ring) and SameColour(r.Glyph.ColorAndOpacity, hud[3].Shown.Icon))
local before = writes
Step(M, ctx, 1.1) Step(M, ctx, 1.1)
check("nothing changed: nothing is written", writes == before)
hud[3].Value = 0.7
Step(M, ctx, 1.1)
check("the value rises past the half: the left half comes in", r.Right.angle == 0 and r.Left.opacity == 1 and Near(r.Left.angle, 0.7 * 360 - 180))

-- another need on the next show: the glyph and the fill change, nothing is made
Glyph(w, "Hydration")
Step(M, ctx, 1.1)
check("the next warning is water: its glyph, its colour and its fill", r.Glyph.Brush.ResourceObject.name == "T_Icon_Upkeep_Hydration" and SameColour(r.Right.ColorAndOpacity, hud[1].Colour) and Near(r.Right.angle, 0.25 * 360 - 180) and Boxes() == 1)

-- a glyph that is no need: ours hides and the game's parts come back as they were
w.glyph.Brush.ResourceObject = Tex("T_Icon_Something_Else")
Step(M, ctx, 1.1)
check("another glyph: ours is hidden, the game's back, arc and glyph are visible again as they were", r.Box.vis == HIDDEN and w.ringBack.vis == 4 and w.arc.vis == 4 and w.glyph.vis == 4)
Glyph(w, "Sustenance")
Step(M, ctx, 1.1)
check("a need again: ours is back, the game's parts collapsed again", r.Box.vis == SEEN and w.arc.vis == COLLAPSED)

-- the game shows its parts again while ours shows: the check collapses them again
w.arc.vis = 4
Step(M, ctx, 1.1)
check("the game made its arc visible: it is collapsed again", w.arc.vis == COLLAPSED)

-- the HUD ring of the need is gone, or has no value: the game's look, nothing is called on the gone ring
hud[2].Right.gone = true
Step(M, ctx, 1.1)
check("the HUD ring of this need is gone: ours is hidden, the game's parts are back", r.Box.vis == HIDDEN and w.arc.vis == 4)
hud[2].Right.gone = nil
hud[2].Value = nil
Step(M, ctx, 1.1)
check("the HUD ring has not read its value: the same", r.Box.vis == HIDDEN and w.ringBack.vis == 4)
hud[2].Value = 0.5
Step(M, ctx, 1.1)
check("the value is read: ours is back", r.Box.vis == SEEN and w.ringBack.vis == COLLAPSED)

-- a widget of ours that the engine freed: nothing is written to it, the game's parts come back
local calls = deadCalls
r.Right.gone = true
Step(M, ctx, 1.1) Step(M, ctx, 1.1)
check("a freed half: no call on it, the game's parts come back", deadCalls == calls and w.arc.vis == 4 and #logs == 0)
r.Right.gone = nil
r.Box.id = "reused slot"
local was = r.Right.angle
hud[2].Value = 0.6
Step(M, ctx, 1.1)
check("a widget whose slot holds another object: not written either, the game's parts stay", r.Right.angle == was and w.arc.vis == 4)

-- no HUD ring yet: the walk waits, the game keeps its look, nothing is written; the ring comes with the HUD
M, ctx = Fresh()
local built = ctx.Hud
ctx.Hud = function() return {} end
for _ = 1, 6 do Step(M, ctx, 1.1) end
w = current
check("no HUD ring: no ring made, the game's back, arc and glyph not written, no log line", Boxes() == 0 and #ringMade == 0 and w.ringBack.wrote == nil and w.arc.wrote == nil and w.glyph.wrote == nil and #logs == 0)
ctx.Hud = built
Glyph(w, "Endurance")
Step(M, ctx, 1.1) Step(M, ctx, 1.1)
check("the HUD rings come: the ring is made and shows the rest ring", Boxes() == 1 and Ring().Box.vis == SEEN and w.arc.vis == COLLAPSED)
M, ctx = Fresh()
for _, b in pairs(ctx.Hud()) do b.Right.gone = true end
for _ = 1, 4 do Step(M, ctx, 1.1) end
check("every HUD ring freed: the same, no call on a freed ring", Boxes() == 0 and #logs == 0)

-- the check faults: the watch list drops it, so the game's ring comes back first and ours is hidden
M, ctx = Fresh()
w = current
Glyph(w, "Endurance")
Step(M, ctx) Step(M, ctx, 1.1) Step(M, ctx, 1.1)
r = Ring()
check("before the fault: ours shows, the game's arc is collapsed", r.Box.vis == SEEN and w.arc.vis == COLLAPSED and #logs == 0)
local Look = ctx.Survival.Look
ctx.Survival.Look = function() error("boom") end
Step(M, ctx, 1.1)
check("a fault in the check: one log line, ours hidden, the game's back, arc and glyph visible again", Count("a colour is not kept") == 1 and r.Box.vis == HIDDEN and w.arc.vis == 4 and w.ringBack.vis == 4 and w.glyph.vis == 4)
ctx.Survival.Look = Look
Step(M, ctx, 1.1) Step(M, ctx, 1.1)
check("the check is gone: ours stays hidden, the game's ring stays, nothing more is logged", r.Box.vis == HIDDEN and w.arc.vis == 4 and #logs == 1)

-- no survival.lua: one log line, the game's ring
M, ctx = Fresh()
ctx.Survival = nil
Step(M, ctx) Step(M, ctx, 1.1) Step(M, ctx, 1.1)
w = current
check("no survival.lua: one log line, nothing made, the game's parts left", Count("no rings from survival.lua") == 1 and #logs == 1 and Boxes() == 0 and w.arc.wrote == nil and w.ringBack.wrote == nil)

-- the ring's back is not in an Overlay
M, ctx = Fresh({ ringParent = "HorizontalBox" })
Step(M, ctx) Step(M, ctx, 1.1) Step(M, ctx, 1.1)
w = current
check("a back in another kind of box: one log line, nothing made, the game's parts left", Count("not an Overlay") == 1 and #logs == 1 and Boxes() == 0 and w.arc.wrote == nil)

-- pictures that do not load: the picture is logged once, the ring once, and the game keeps its ring
M, ctx = Fresh()
missingArt = "upkeep_half"
Step(M, ctx) Step(M, ctx, 1.1) Step(M, ctx, 1.1)
w = current
check("a picture missing: two log lines, nothing made, the game's ring stays", #logs == 2 and Count("picture missing") == 1 and Count("keeps the game's ring") == 1 and Boxes() == 0 and #w.ring.WidgetTree.RootWidget.kids == 3)

-- two warnings: each has its own ring and follows its own glyph
M, ctx = Fresh({ twoWarnings = true })
w = current
Glyph(w, "Hydration")
w.glyph2.Brush.ResourceObject = Tex("T_Icon_Upkeep_Endurance")
Step(M, ctx) Step(M, ctx, 1.1) Step(M, ctx, 1.1)
check("two warnings: two rings, each with the need of its own glyph", Boxes() == 2 and imports == 3 and #logs == 0)
local seen = 0
for _, m in ipairs(ringMade) do if m.name:find("^RU_WarnRing_7_%d+RImg$") then seen = seen + 1 end end
check("two warnings: each has its halves", seen == 2)

-- the see-through back and centre of every ring that survival.lua draws: its Ring is the one place, the warning and the HUD rings use it
local Sv = load(SURVTEXT)()
check("survival.lua has the two values", Sv.BACK_ALPHA == 0.40 and Sv.Faint ~= nil)
local tex = Tex("any")
local tree = Base("tree", "WidgetTree")
local ov = Sv.Ring(tree, "RU_T", 68, { Back = tex, Half = tex, Centre = tex }, { R = 1, G = 0, B = 0, A = 1 })
local back, centre, half
for _, m in ipairs(ringMade) do
    if m.name == "RU_TBack" then back = m elseif m.name == "RU_TCentre" then centre = m elseif m.name == "RU_TRImg" then half = m end
end
check("survival.lua's M.Ring: the back is at 0.40, the centre at 0.25, a half has its own colour", back and centre and half and Near(back.ColorAndOpacity.A, 0.40) and Near(centre.ColorAndOpacity.A, 0.25)
    and back.ColorAndOpacity.R == 1 and half.ColorAndOpacity.G == 0 and half.ColorAndOpacity.A == 1)

-- survival.lua's real rings and the warning on top of them
local function Upkeep(prop, need, text)
    local icon = Img("Icon") icon.Brush.ResourceObject = Tex("T_Icon_Upkeep_" .. need)
    local arc = Img("RadialImage")
    local bar = Nested("SegmentedRadialBar", "WBP_Ring_C", Box("BarRoot", "Overlay", { arc, icon }))
    local t = Txt("Value") t.text = text
    local base = Nested(prop, "WBP_SurvivalCore_Upkeep_C", Box("BaseRoot", "Overlay", { bar, Box("SizeBox_1", "SizeBox", { t }) }))
    return base, icon, arc
end
M, ctx = Fresh()
w = current
local U = Nested("Survival", "WBP_Survival_C", Box("USurv", "Overlay", {}))
local icons, arcs = {}, {}
U.WBP_SurvivalCore_Upkeep_Hydration, icons[1], arcs[1] = Upkeep("Water", "Hydration", "75/100")
U.WBP_SurvivalCore_Upkeep_Sustenance, icons[2], arcs[2] = Upkeep("Food", "Sustenance", "50/100")
U.WBP_SurvivalCore_Upkeep_Endurance, icons[3], arcs[3] = Upkeep("Rest", "Endurance", "20/100")
arcs[3].ColorAndOpacity = { R = 0.9, G = 0.35, B = 0.1, A = 1 }   -- the game's orange arc at 25 or less
icons[3].ColorAndOpacity = { R = 0.9, G = 0.1, B = 0.05, A = 1 }   -- and its red icon
local sctx = { Log = function(m) logs[#logs + 1] = m end, ClearOurs = function() end,
    ById = function() return { Instances = { U }, Keys = { "Transient.Survival" } } end }
ctx.Hud = ctx.Survival.Rings
clock = clock + 1
ctx.Survival.Tick(sctx)
check("the HUD rings are built: three of them, with the log line of each", Count("survival: water ring ready") == 1 and Count("survival: rest ring ready") == 1)
local ups = {}
for _, m in ipairs(ringMade) do if m.name:find("^RU_Up%d+_%d+_%dBack$") then ups[#ups + 1] = m end end
check("the survival rings (RU_Up): each back at 0.40", #ups == 3 and Near(ups[1].ColorAndOpacity.A, 0.40) and Near(ups[2].ColorAndOpacity.A, 0.40) and Near(ups[3].ColorAndOpacity.A, 0.40))
local centres = 0
for _, m in ipairs(ringMade) do if m.name:find("^RU_Up%d+_%d+_%dCentre$") and Near(m.ColorAndOpacity.A, 0.25) then centres = centres + 1 end end
check("the survival rings (RU_Up): each centre at 0.25", centres == 3)
check("the survival rings have no diamond", Mine("Dia$") == nil and Mine("Diamond") == nil)
check("low is read from the game's colours: rest in orange is low, water and food are not", ctx.Survival.Rings()[3].Low == true and ctx.Survival.Rings()[1].Low == false and ctx.Survival.Rings()[2].Low == false)
w.glyph.Brush.ResourceObject = icons[3].Brush.ResourceObject
Step(M, ctx, 1.1) Step(M, ctx, 1.1)
r = Ring()
local rest = ctx.Survival.Rings()[3]
check("the warning of rest shows the HUD ring of rest at 20, in the low colours the HUD ring has", rest.Name == "rest" and Near(rest.Value, 0.2) and r.Box.vis == SEEN
    and Near(r.Right.angle, 0.2 * 360 - 180) and SameColour(r.Right.ColorAndOpacity, rest.Right.ColorAndOpacity) and SameColour(r.Left.ColorAndOpacity, rest.Right.ColorAndOpacity)
    and SameColour(r.Glyph.ColorAndOpacity, rest.Icon.ColorAndOpacity) and r.Right.ColorAndOpacity.R > 0.5)
check("the warning's ring has the same see-through back and centre", Near(r.Back.ColorAndOpacity.A, 0.40) and Near(r.Centre.ColorAndOpacity.A, 0.25))
-- the game's food falls to the low colours: the HUD ring changes, the warning of food follows within a second
icons[2].ColorAndOpacity = { R = 0.8, G = 0.05, B = 0.02, A = 1 }
arcs[2].ColorAndOpacity = { R = 0.3, G = 0.01, B = 0, A = 1 }
U.WBP_SurvivalCore_Upkeep_Sustenance.WidgetTree.RootWidget.kids[2].kids[1].text = "8/100"
w.glyph.Brush.ResourceObject = icons[2].Brush.ResourceObject
clock = clock + 1
ctx.Survival.Tick(sctx)
Step(M, ctx, 1.1) Step(M, ctx, 1.1)
local food = ctx.Survival.Rings()[2]
check("food in the game's dark red is low", food.Low == true)
-- a need that is low when the world loads: the game leaves its icon white, and only its ring is red (seen at water 0)
icons[2].ColorAndOpacity = { R = 1, G = 1, B = 1, A = 1 }
clock = clock + 1
ctx.Survival.Tick(sctx)
check("the game's icon is white at 8 of 100: food is still low, by its number", food.Low == true)
check("... and our icon takes the red of the ring, not the white of the game's icon", SameColour(food.Icon.ColorAndOpacity, food.Right.ColorAndOpacity) and food.Icon.ColorAndOpacity.R >= 0.5 - 1e-6 and food.Icon.ColorAndOpacity.G < 0.1)
U.WBP_SurvivalCore_Upkeep_Sustenance.WidgetTree.RootWidget.kids[2].kids[1].text = "80/100"
clock = clock + 1
ctx.Survival.Tick(sctx)
check("a white icon and 80 of 100: food is not low", food.Low == false)
U.WBP_SurvivalCore_Upkeep_Sustenance.WidgetTree.RootWidget.kids[2].kids[1].text = "8/100"
icons[2].ColorAndOpacity = { R = 0.8, G = 0.05, B = 0.02, A = 1 }
clock = clock + 1
ctx.Survival.Tick(sctx)
check("the warning of food follows the HUD ring: 8, the dark red lifted to half brightness", Near(food.Value, 0.08) and Near(r.Right.angle, 0.08 * 360 - 180) and SameColour(r.Right.ColorAndOpacity, food.Right.ColorAndOpacity)
    and math.max(r.Right.ColorAndOpacity.R, r.Right.ColorAndOpacity.G, r.Right.ColorAndOpacity.B) >= 0.5 - 1e-6)

-- the sources: the rings that do not go through survival.lua's Ring take the two values from it, and no file has its own copy
local function Source(f) return SOURCES[f] end
check("menu icons, drinks: drawn with survival.lua's Ring, so they have the see-through back and centre", Source("menubuttons.lua"):find("ctx.Ring(tree, n, RING, art, GOLD)", 1, true) ~= nil
    and Source("wiring.lua"):find("Ring = Survival and Survival.Ring", 1, true) ~= nil and Source("buffs.lua"):find('Survival.Ring(tree, Uniq("RU_DrinkRing")', 1, true) ~= nil)
check("the ammo disk takes the back's value from survival.lua", Source("ammo.lua"):find("ctx.Survival.Faint(Picture(tree, n .. \\"Back\\"", 1, true) ~= nil and Source("ammo.lua"):find("ctx.Survival.BACK_ALPHA", 1, true) ~= nil)
local copies = {}
for f, text in pairs(SOURCES) do
    if f ~= "survival.lua" and (text:find("BACK_ALPHA =", 1, true) or text:find("CENTRE_ALPHA", 1, true)) then copies[#copies + 1] = f end
end
check("no other file has a copy of the two values", #copies == 0)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
const files = ['wiring.lua', 'menubuttons.lua', 'buffs.lua', 'ammo.lua', 'cooldowns.lua', 'survival.lua', 'noticering.lua', 'noticestyle.lua', 'noticelook.lua'];
lua.lua_pushstring(L, to_luastring(read('noticelook.lua'))); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(read('noticestyle.lua'))); lua.lua_setglobal(L, to_luastring('STYLETEXT'));
lua.lua_pushstring(L, to_luastring(read('noticeread.lua'))); lua.lua_setglobal(L, to_luastring('READTEXT'));
lua.lua_pushstring(L, to_luastring(read('noticering.lua'))); lua.lua_setglobal(L, to_luastring('RINGTEXT'));
lua.lua_pushstring(L, to_luastring(read('survival.lua'))); lua.lua_setglobal(L, to_luastring('SURVTEXT'));
lauxlib.luaL_dostring(L, to_luastring('SOURCES = {}'));
for (const f of files) {
  lua.lua_getglobal(L, to_luastring('SOURCES'));
  lua.lua_pushstring(L, to_luastring(read(f)));
  lua.lua_setfield(L, -2, to_luastring(f));
  lua.lua_pop(L, 1);
}
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

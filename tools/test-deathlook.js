// Tests the look of the death screen (deathlook.lua) against a fake WBP_HUD_Death_C shaped like the game's tree (probe of
// 07-10-2026), with the real helpers of combattext.lua: the style class defaults of "You Died" get the red and 1.6 times
// the game's own size once (no growth on a second look, a second world, or a class that loaded again), the text box moves
// up (only on a show that starts with our style) and is written again when the game resets it, the two spark widgets are
// collapsed (and again when the game shows them), nothing else on the screen is written, and a missing style class, a
// style of another name, a missing part, a freed widget and a missing combattext.lua write nothing and log once.
// The style before any death: the mod loads the class with its loader, by two paths, so the first death of a run is ours;
// a freed class is loaded again; a load that gives nothing leaves the first death as the game's own screen.
// Needs npm install once. Run: node tools/test-deathlook.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const scripts = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const SRCTEXT = fs.readFileSync(path.join(scripts, 'deathlook.lua'), 'utf8');
const COMBATTEXT = fs.readFileSync(path.join(scripts, 'combattext.lua'), 'utf8');
const test = `
local function check(name, cond) if not cond then error("FAIL " .. name, 2) end print("ok   " .. name) end
local clock = 0
os.clock = function() return clock end
local dead, made = 0, 0

-- a fake widget: panels hold kids, content widgets hold one child; a call on a freed one is counted
local function Widget(class, name, o)
    made = made + 1
    local w = o or {}
    w.cls, w.name, w.id, w.wrote = class, name, made, 0
    w.RenderTransform = { Translation = { X = 0, Y = 0 } }
    function w:IsValid() return not self.gone end
    local function live(self) if self.gone then dead = dead + 1 end end
    function w:GetFName() live(self) local n = self.name return { ToString = function() return n end } end
    function w:GetClass() live(self) local c = self.cls return { GetFName = function() return { ToString = function() return c end } end } end
    function w:GetFullName() live(self) return "Transient." .. self.id .. "." .. self.name end
    function w:GetChildrenCount() live(self) self.Looked = (self.Looked or 0) + 1 if not self.kids then error("not a panel") end return #self.kids end
    function w:GetChildAt(i) live(self) return self.kids[i + 1] end
    function w:GetContent() live(self) if not self.content then error("no content") end return self.content end
    function w:SetRenderTranslation(t) live(self) self.wrote = self.wrote + 1 self.RenderTransform.Translation = { X = t.X, Y = t.Y } end
    return w
end
local objects = {}
StaticFindObject = function(p) return objects[p] end
local PKG = "/Game/UI/Styles/Texts/CUIS_Death_YouDiedTextStyle"
local GREY = { R = 0.43, G = 0.47, B = 0.45, A = 1 }

-- the style: its class (what the text holds) and its default object, as the game has them
local function Style(name, size)
    name = name or "CUIS_Death_YouDiedTextStyle_C"
    local pkg = name == "CUIS_Death_YouDiedTextStyle_C" and PKG or "/Game/UI/Styles/Texts/" .. name
    local class = Widget("Class", name, { Full = "BlueprintGeneratedClass " .. pkg .. "." .. name })
    class.GetFullName = function(self) return self.Full end
    local cdo = Widget("Object", "Default__" .. name)
    cdo.Font = { Size = size or 24, FontObject = "amiri" }
    cdo.Color = { R = GREY.R, G = GREY.G, B = GREY.B, A = 1 }
    objects[pkg .. ".Default__" .. name] = cdo
    return class, cdo
end

-- the death screen's tree; Other counts everything else (it must stay unwritten)
local function Screen(class, o)
    o = o or {}
    local text = Widget("WBP_DomTextBlock_C", "DeathText", { Style = class })
    local box = Widget("HorizontalBox", "MainTextBox")
    local flourish = function(n) return Widget("ScaleBox", n, { content = Widget("CommonLazyImage", n .. "Pic") }) end
    box.kids = { flourish("ScaleBox_81"), text, flourish("ScaleBox_120") }
    local power = Widget("WBP_EnemyPowerLevelDisplay_C", "PowerLevelDisplay", { kids = { Widget("TextBlock", "DeathText") } })
    local rest = { Widget("Image", "Background"), Widget("CommonLazyImage", "HorizontalBar"), box,
        Widget("Overlay", "KilledBy", { kids = { Widget("TextBlock", "DomTextBlock_74") } }),
        Widget("HorizontalBox", "CauseOfDeathBox", { kids = { power } }),
        Widget("NiagaraSystemWidget", "Niagara_TopLine"), Widget("NiagaraSystemWidget", "Niagara_BottomLine") }
    local sparks = { rest[6], rest[7] }
    for _, sp in ipairs(sparks) do
        sp.vis, sp.hid = 4, 0
        function sp:GetVisibility() if self.gone then dead = dead + 1 end return self.vis end
        function sp:SetVisibility(v) if self.gone then dead = dead + 1 end self.hid = self.hid + 1 self.vis = v end
    end
    if o.NoSparks then table.remove(rest) table.remove(rest) sparks = {} end
    if o.NoBox then box.name = "SomethingElse" end
    local overlay = Widget("Overlay", "Overlay_0", { kids = rest })
    local blur = Widget("BackgroundBlur", "BackgroundBlur_0", { content = overlay })
    local W = Widget("WBP_HUD_Death_C", "WBP_HUD_Death_C_0")
    W.WidgetTree = { RootWidget = blur, IsValid = function() return true end }
    if o.vis then W.vis = o.vis function W:GetVisibility() return self.vis end end   -- without o.vis the visibility cannot be read
    return { W = W, Box = box, Text = text, Power = power, Sparks = sparks, Others = { rest[1], rest[2], rest[4], rest[5], overlay, blur, power, power.kids[1] } }
end
local function OthersWrote(s) for _, o in ipairs(s.Others) do if o.wrote ~= 0 then return true end end return false end

local logs, failed = {}, 0
local list, keys = {}, {}
local Combat = load(COMBATTEXT)()
-- the mod's loader: it gives nothing, as when the path is wrong, until a test sets loads (path -> what the load does)
local loads, asked = {}, {}
local function Asset(p) asked[#asked + 1] = p if loads[p] then return loads[p]() end end
local CDO = PKG .. ".Default__CUIS_Death_YouDiedTextStyle_C"
local function Make(withCombat)
    local M = load(SRCTEXT)()
    local ctx = { Log = function(m) logs[#logs + 1] = m end, Find = function() return list, keys end, Combat = withCombat ~= false and Combat or nil, Asset = Asset,
        MayTry = function(P) return (P.Fails or 0) < 3 and os.clock() >= (P.RetryAt or 0) end,
        Failed = function(P) failed = failed + 1 P.Fails, P.RetryAt = (P.Fails or 0) + 1, os.clock() + 10 end }
    return M, ctx
end
local function Tick(M, ctx) clock = clock + 1 M.Tick(ctx) end
local function Count(pattern) local n = 0 for _, m in ipairs(logs) do if m:find(pattern, 1, true) then n = n + 1 end end return n end
local function Near(a, b) return math.abs(a - b) < 0.001 end
local function IsRed(c) return Near(c.R, 0.64) and Near(c.G, 0.13) and Near(c.B, 0.10) and c.A == 1 end

check("combattext.lua gives the three helpers", type(Combat.Find) == "function" and type(Combat.PathOf) == "function" and type(Combat.Rgba) == "function")

-- no death screen yet: nothing happens
local M, ctx = Make()
Tick(M, ctx) Tick(M, ctx)
check("no death screen: one line says the style did not load, nothing else", #logs == 1 and Count("did not load") == 1 and failed == 0)

-- the first death
local class, cdo = Style()
local s = Screen(class)
list, keys = { s.W }, { "k" }
Tick(M, ctx)
check("the style is red", IsRed(cdo.Color))
check("the style is 1.6 times the game's own size 24", Near(cdo.Font.Size, 38.4) and cdo.Font.FontObject == "amiri")
check("the text box moved up 100 units, X kept", s.Box.RenderTransform.Translation.Y == -100 and s.Box.RenderTransform.Translation.X == 0 and s.Box.wrote == 1)
check("nothing else on the screen is written", not OthersWrote(s) and s.Text.wrote == 0 and s.W.wrote == 0)
check("the power level display is not entered", s.Power.Looked == nil)
check("the two spark widgets are collapsed, once each, and not moved", s.Sparks[1].vis == 1 and s.Sparks[2].vis == 1 and s.Sparks[1].hid == 1 and s.Sparks[2].hid == 1
    and s.Sparks[1].wrote == 0 and s.Sparks[2].wrote == 0)
check("one line says it is set, one says the sparks are off", Count("death look: 'You Died' is red") == 1 and Count("the sparks on the two gold lines are off") == 1 and #logs == 3)

-- a second look, many looks: nothing more is written
Tick(M, ctx) Tick(M, ctx) Tick(M, ctx)
check("a second look writes nothing", Near(cdo.Font.Size, 38.4) and s.Box.wrote == 1 and s.Sparks[1].hid == 1 and #logs == 3)

-- the game shows the sparks again
s.Sparks[2].vis = 4
Tick(M, ctx)
check("sparks the game showed again are collapsed again, the other is not written", s.Sparks[2].vis == 1 and s.Sparks[2].hid == 2 and s.Sparks[1].hid == 1)

-- a look that is too soon is skipped
local before = s.Box.Looked
clock = clock - 0.9 M.Tick(ctx) clock = clock + 0.9
check("a look within half a second does nothing", s.Box.Looked == before)

-- the game puts the box back
s.Box.RenderTransform.Translation = { X = 0, Y = 0 }
Tick(M, ctx)
check("the box is moved again when the game reset it", s.Box.RenderTransform.Translation.Y == -100 and s.Box.wrote == 2)

-- the game writes its own colour or size on the style
cdo.Color = { R = 0.43, G = 0.47, B = 0.45, A = 1 }
Tick(M, ctx)
check("a style the game reset to grey is red again, the size not grown", IsRed(cdo.Color) and Near(cdo.Font.Size, 38.4))

-- a second world: new widgets, the class defaults still ours
M.Forget(false)
local s2 = Screen(class)
list, keys = { s2.W }, { "k2" }
Tick(M, ctx)
check("a second world: the box moves, the size does not grow", s2.Box.RenderTransform.Translation.Y == -100 and Near(cdo.Font.Size, 38.4))
Tick(M, ctx) Tick(M, ctx)
check("and a third look writes nothing", s2.Box.wrote == 1 and s2.Sparks[1].hid == 1 and Near(cdo.Font.Size, 38.4) and Count("is red and") == 2)   -- one line for each world

-- the class loaded again with the game's values at a new address
local class3, cdo3 = Style()
local s3 = Screen(class3)
M.Forget(false)
list, keys = { s3.W }, { "k3" }
Tick(M, ctx)
check("a class that loaded again: red and 1.6 times 24 again, not more", IsRed(cdo3.Color) and Near(cdo3.Font.Size, 38.4))

-- a restart of the mod while the class holds ours: the size is not read as the game's own
do
    local M2, ctx2 = Make()
    local c4, cdo4 = Style() cdo4.Color = { R = 0.64, G = 0.13, B = 0.10, A = 1 } cdo4.Font.Size = 38.4
    local s4 = Screen(c4)
    list, keys = { s4.W }, { "k4" }
    -- the style path is the same as before, so Own is not shared across the two Lua states: a new state knows nothing
    Tick(M2, ctx2)
    check("a new run that finds a red style with an unknown own size leaves its size alone", Near(cdo4.Font.Size, 38.4) and Count("its own size is not known") == 1)
    check("and moves the box: the style is ours already", s4.Box.RenderTransform.Translation.Y == -100)
end

-- a style of another name: not written, logged once; the box stays
do
    local M2, ctx2 = Make()
    local c5, cdo5 = Style("CUIS_Other_TextStyle_C", 20)
    local s5 = Screen(c5)
    objects[CDO] = nil   -- the style of the right name is not loaded, so the early load says so in one line
    list, keys = { s5.W }, { "k5" }
    local n = #logs
    Tick(M2, ctx2) Tick(M2, ctx2) Tick(M2, ctx2)
    check("another style: not written, one line, the line of the sparks and the line of the early load, the box not lifted", cdo5.Color.R == 0.43 and cdo5.Font.Size == 20 and #logs == n + 3 and Count("not CUIS_Death_YouDiedTextStyle_C") == 1 and s5.Box.wrote == 0)
end

-- no style class on the text
do
    local M2, ctx2 = Make()
    local s6 = Screen(nil)
    objects[CDO] = nil
    list, keys = { s6.W }, { "k6" }
    local n = #logs
    Tick(M2, ctx2) Tick(M2, ctx2)
    check("no style class: one line, the line of the sparks and the line of the early load, the box not lifted", #logs == n + 3 and Count("holds no style class") == 1 and s6.Box.wrote == 0)
end

-- the lift follows the style: the game styles the text at the show, so the first death of a run is its own screen
do
    local M2, ctx2 = Make()
    local c, cd = Style()
    local sv = Screen(c, { vis = 4 })
    list, keys = { sv.W }, { "kv" }
    Tick(M2, ctx2) Tick(M2, ctx2)
    check("first death: the style is red and big for the next death, the box is not lifted", IsRed(cd.Color) and Near(cd.Font.Size, 38.4)
        and sv.Box.wrote == 0 and sv.Box.RenderTransform.Translation.Y == 0 and not OthersWrote(sv))
    sv.W.vis = 1 Tick(M2, ctx2) Tick(M2, ctx2)
    check("the screen hides: still not lifted", sv.Box.wrote == 0)
    sv.W.vis = 4 Tick(M2, ctx2)
    check("second death: the box is lifted 100 units, once", sv.Box.RenderTransform.Translation.Y == -100 and sv.Box.wrote == 1)
    Tick(M2, ctx2) Tick(M2, ctx2) Tick(M2, ctx2)
    check("and no write on the next looks", sv.Box.wrote == 1)
    sv.Box.RenderTransform.Translation = { X = 0, Y = 0 }
    Tick(M2, ctx2)
    check("the game reset the box during the show: lifted again", sv.Box.RenderTransform.Translation.Y == -100 and sv.Box.wrote == 2)
    sv.W.vis = 1 Tick(M2, ctx2) sv.W.vis = 4 Tick(M2, ctx2)
    check("third death: still lifted, nothing more written", sv.Box.RenderTransform.Translation.Y == -100 and sv.Box.wrote == 2)
    M2.Forget(false)
    local sw = Screen(c, { vis = 4 })
    list, keys = { sw.W }, { "kw" }
    Tick(M2, ctx2)
    check("a new world with the style ours already: its first death is lifted at once", sw.Box.RenderTransform.Translation.Y == -100 and Near(cd.Font.Size, 38.4))
end

-- a screen that is made hidden: the style is written before its first show, so that show is lifted
do
    local M2, ctx2 = Make()
    local c, cd = Style()
    local sv = Screen(c, { vis = 1 })
    list, keys = { sv.W }, { "kh" }
    Tick(M2, ctx2) Tick(M2, ctx2)
    check("made hidden: the style is red and big, the box is not lifted yet", IsRed(cd.Color) and Near(cd.Font.Size, 38.4) and sv.Box.wrote == 0)
    sv.W.vis = 4 Tick(M2, ctx2)
    check("its first show: lifted", sv.Box.RenderTransform.Translation.Y == -100 and sv.Box.wrote == 1)
end

-- the sparks follow no style: they are off on the first death of a run too, and with a style of another name
do
    local M2, ctx2 = Make()
    local c, cd = Style("CUIS_Other_TextStyle_C", 20)
    local sv = Screen(c, { vis = 4 })
    list, keys = { sv.W }, { "ks" }
    Tick(M2, ctx2)
    check("another style: the sparks are off all the same", sv.Sparks[1].vis == 1 and sv.Sparks[2].vis == 1 and sv.Box.wrote == 0)
end

-- a screen with no spark widgets: one line, the rest works
do
    local M2, ctx2 = Make()
    local c, cd = Style()
    local sn = Screen(c, { NoSparks = true })
    list, keys = { sn.W }, { "kn" }
    local f = failed
    Tick(M2, ctx2) Tick(M2, ctx2) Tick(M2, ctx2)
    check("no spark widgets: one line, no failure, the text is red and lifted", Count("no spark widgets") == 1 and failed == f and IsRed(cd.Color) and sn.Box.RenderTransform.Translation.Y == -100)
end

-- a freed spark widget is not called
do
    local M2, ctx2 = Make()
    local c, cd = Style()
    local sf = Screen(c)
    list, keys = { sf.W }, { "kf" }
    Tick(M2, ctx2)
    sf.Sparks[1].gone = true sf.Sparks[1].vis = 4 sf.Sparks[2].vis = 4
    local d = dead
    Tick(M2, ctx2)
    check("a freed spark widget: no call on it, the other is collapsed again", dead == d and sf.Sparks[1].hid == 1 and sf.Sparks[2].hid == 2)
end

-- the names are not in the tree: a failure is logged, three tries at most
do
    local M2, ctx2 = Make()
    local s7 = Screen(class, { NoBox = true })
    local loaded = objects[CDO]
    objects[CDO] = nil
    list, keys = { s7.W }, { "k7" }
    local f, n = failed, #logs
    for _ = 1, 40 do clock = clock + 11 M2.Tick(ctx2) end
    check("a missing part: three tries, three lines and the line of the early load, then it stops", failed == f + 3 and #logs == n + 4 and M2.Problem() and Count("no MainTextBox") >= 3)
    check("a missing part writes nothing", s7.Box.wrote == 0 and not OthersWrote(s7))
    objects[CDO] = loaded
end

-- a freed widget is not called
do
    local M2, ctx2 = Make()
    local s8 = Screen(class)
    s8.W.gone = true
    list, keys = { s8.W }, { "k8" }
    local d = dead
    Tick(M2, ctx2) Tick(M2, ctx2)
    check("a freed widget: no call on it, nothing written", dead == d and s8.Box.wrote == 0)
end

-- the box freed after it was found: no call on it, found again from the tree is refused as a failure
do
    local M2, ctx2 = Make()
    local s9 = Screen(class)
    list, keys = { s9.W }, { "k9" }
    Tick(M2, ctx2)
    s9.Box.gone = true
    local d = dead
    Tick(M2, ctx2)
    check("a freed box is not written", s9.Box.wrote == 1 and Near(cdo.Font.Size, 38.4))
end

-- combattext.lua did not load
do
    local M2, ctx2 = Make(false)
    local c10, cdo10 = Style()
    local s10 = Screen(c10)
    list, keys = { s10.W }, { "k10" }
    local n = #logs
    Tick(M2, ctx2) Tick(M2, ctx2)
    check("no helper file: one line, nothing written", #logs == n + 1 and Count("combattext.lua did not load") == 1 and cdo10.Color.R == 0.43 and s10.Box.wrote == 0)
end

-- the style before any death: the mod loads the class itself, so the first death of a game run is ours
do
    local M2, ctx2 = Make()
    local c, cd
    objects[CDO], list, keys, asked = nil, {}, {}, {}
    loads[PKG .. ".CUIS_Death_YouDiedTextStyle_C"] = function() c, cd = Style() return c end
    local n, ready = #logs, Count("is ready before a death")
    Tick(M2, ctx2)
    check("no death yet: the class is loaded by its path, red and 1.6 times 24", #asked == 1 and IsRed(cd.Color) and Near(cd.Font.Size, 38.4))
    check("one line says the style is ready", #logs == n + 1 and Count("is ready before a death") == ready + 1)
    Tick(M2, ctx2) Tick(M2, ctx2)
    check("the next looks load nothing and write nothing", #asked == 1 and #logs == n + 1 and Near(cd.Font.Size, 38.4))
    local sv = Screen(c, { vis = 4 })
    list, keys = { sv.W }, { "ka" }
    Tick(M2, ctx2)
    check("the first death of the run: the box is lifted at once", sv.Box.RenderTransform.Translation.Y == -100 and sv.Box.wrote == 1 and Near(cd.Font.Size, 38.4))

    -- the engine freed the class: it is loaded again with the game's values
    list, keys = {}, {}
    local old, d = cd, dead
    old.gone = true objects[CDO] = nil
    Tick(M2, ctx2)
    check("a freed class is loaded again: red and 1.6 times 24, not more, no call on the freed one", #asked == 2 and cd ~= old and IsRed(cd.Color)
        and Near(cd.Font.Size, 38.4) and dead == d)

    -- the game loaded the class again itself, at a death: that screen has the game's look, so it is not lifted
    cd.gone = true
    c, cd = Style()
    local sg = Screen(c, { vis = 4 })
    list, keys = { sg.W }, { "kg" }
    Tick(M2, ctx2)
    check("a class the game loaded at the death: red for the next death, the box not lifted", IsRed(cd.Color) and Near(cd.Font.Size, 38.4) and sg.Box.wrote == 0)
    loads = {}
end

-- the class loads only by the path of its asset
do
    local M2, ctx2 = Make()
    local c, cd
    objects[CDO], list, keys, asked = nil, {}, {}, {}
    loads[PKG .. ".CUIS_Death_YouDiedTextStyle"] = function() c, cd = Style() end
    Tick(M2, ctx2)
    check("the second path loads it", #asked == 2 and IsRed(cd.Color) and Near(cd.Font.Size, 38.4))
    loads = {}
end

-- the load gives nothing: one line, no new try in the same world, a new try in a new world
do
    local M2, ctx2 = Make()
    objects[CDO], list, keys, asked = nil, {}, {}, {}
    local n = #logs
    Tick(M2, ctx2) Tick(M2, ctx2) Tick(M2, ctx2)
    check("no load: both paths asked once, one line", #asked == 2 and #logs == n + 1 and Count("did not load, the first death keeps the game's look") >= 1)
    M2.Forget(true) Tick(M2, ctx2)
    check("a respawn asks nothing again", #asked == 2 and #logs == n + 1)
    M2.Forget(false) Tick(M2, ctx2)
    check("a new world asks again", #asked == 4 and #logs == n + 2)
    local c, cd = Style()
    local sv = Screen(c, { vis = 4 })
    list, keys = { sv.W }, { "kl" }
    Tick(M2, ctx2) Tick(M2, ctx2)
    check("then the first death is the game's own screen: red for the next death, not lifted", IsRed(cd.Color) and sv.Box.wrote == 0)
end
print("done")
`;
const ok = lua.lua_pushstring(L, to_luastring(SRCTEXT)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(COMBATTEXT)); lua.lua_setglobal(L, to_luastring('COMBATTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) {
  console.log(lua.lua_tojsstring(L, -1));
  process.exit(1);
}

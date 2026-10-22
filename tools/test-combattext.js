// Tests the combat text (combattext.lua) against fake objects shaped like the game's: the five style classes get
// their values once (and again in a new world, keeping the first originals), the icon and the glow of each pooled
// number go unseen, the word "Critical" is found by its name among the overlay's children and gets its style once,
// a critical hit pops from 2.5 to 1 in 0.35 s, once for each play of the animation, from the step that sees it,
// a critical number that holds another style gets the critical style on that step (a staff's critical hit was white),
// the chain runs only while a number plays and ends 5 s later, and the switch puts back every original value and
// every number's scale.
// Needs npm install once. Run: node tools/test-combattext.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const scripts = require('path').join(__dirname, '..', 'RuneUI', 'Scripts');
const chain = fs.readFileSync(require('path').join(scripts, 'chain.lua'), 'utf8');
const src = fs.readFileSync(require('path').join(scripts, 'combattext.lua'), 'utf8');
const test = `
local function check(name, cond) if not cond then error("FAIL " .. name, 2) end print("ok   " .. name) end
local clock = 0
os.clock = function() return clock end
collectgarbage = function() return 0 end   -- fengari has no collector

local made = 0
local function Obj(class, name, path)
    made = made + 1
    local addr = made
    return { IsValid = function() return true end, GetAddress = function() return addr end, GetFName = function() return { ToString = function() return name end } end,
        GetFullName = function() return class .. " " .. path end }
end
local STYLES = "/Game/UI/Styles/Texts/CUIS_DamageFloatie_"
local NAMES = { "NumberSmallTextStyle", "NumberNormalTextStyle", "NumberLargeTextStyle", "NumberCriticalTextStyle", "CriticalTextStyle",
    "PoisonTextStyle", "BurnTextStyle", "BleedTextStyle", "SlowedTextStyle", "ImmuneTextStyle" }
local objects = {}
StaticFindObject = function(p) return objects[p] end
local regular, medium = Obj("Font", "Regular", "/Game/UI/Fonts/Poppins-Regular_Font.Poppins-Regular_Font"), Obj("Font", "Medium", "/Game/UI/Fonts/Poppins-Medium_Font.Poppins-Medium_Font")
local gradient = Obj("Material", "Gradient", "/Game/Mat/MI_Font_DamageFloatie_Critical.MI_Font_DamageFloatie_Critical")
objects["/Game/UI/Fonts/Poppins-Regular_Font.Poppins-Regular_Font"] = regular
objects["/Game/UI/Fonts/Poppins-Medium_Font.Poppins-Medium_Font"] = medium
objects["/Game/Mat/MI_Font_DamageFloatie_Critical.MI_Font_DamageFloatie_Critical"] = gradient

-- a style's class defaults as the game has them: Poppins Regular, a thin edge, a gradient on the word
local function Style(name)
    local cdo = Obj("Class", name, "x")
    cdo.Font = { Size = name == "CriticalTextStyle" and 10 or 14, FontObject = regular, FontMaterial = name == "CriticalTextStyle" and gradient or nil,
        OutlineSettings = { OutlineSize = 1, OutlineColor = { R = 0, G = 0, B = 0, A = 0.3 } } }
    cdo.Color = { R = 1, G = 0.86, B = 0, A = 1 }
    cdo.bUsesDropShadow = false
    cdo.ShadowOffset = { X = 0, Y = 0 }
    cdo.ShadowColor = { R = 0, G = 0, B = 0, A = 0 }
    -- FontMaterial = nil is a real write in the game: the field is gone, as in a Lua table
    return cdo
end
local cdos, classes = {}, {}
local function LoadStyles()
    for _, n in ipairs(NAMES) do
        cdos[n], classes[n] = Style(n), Obj("Class", n .. "_C", "c")
        objects[STYLES .. n .. ".Default__CUIS_DamageFloatie_" .. n .. "_C"] = cdos[n]
        objects[STYLES .. n .. ".CUIS_DamageFloatie_" .. n .. "_C"] = classes[n]
    end
end
local function Near(a, b) return math.abs(a - b) < 1e-6 end

-- a pooled number: the icon, the glow, the word among other children, and three animations
local function Number(id)
    local W = Obj("WBP_FloatingDamage_C", "WBP_FloatingDamage_C_" .. id, "/Engine/Transient.W" .. id)
    W.Scales, W.Styles = {}, {}
    for _, a in ipairs({ "FlyUp", "FlyRight", "FlyUpCritical" }) do W[a] = Obj("WidgetAnimation", a, a) end
    W.Playing, W.Addr, W.Polls = {}, 1000 + id, 0
    function W:GetAddress() return self.Addr end
    function W:IsAnimationPlaying(a) return self.Playing[a] == true end
    function W:IsAnyAnimationPlaying() self.Polls = self.Polls + 1 for _, p in pairs(self.Playing) do if p then return true end end return false end
    function W:SetRenderScale(s) self.Scales[#self.Scales + 1] = s.X self.Scale = s.X end
    local function Part() local p = { Op = 1 } p.IsValid = function() return true end function p:GetRenderOpacity() return self.Op end function p:SetRenderOpacity(o) self.Op = o end return p end
    W.FloatiesIcon, W.BackgroundGlow = Part(), Part()
    local other, word = Obj("TextBlock", "SomethingElse", "o"), Obj("TextBlock", "CriticalText", "w")
    function other:SetStyle(c) self.Styled = c end
    function word:SetStyle(c) W.Styles[#W.Styles + 1] = c end
    local kids = { Obj("Image", "Glow", "g"), other, word }
    W.CriticalTextOverlay = { IsValid = function() return true end, GetChildrenCount = function() return #kids end, GetChildAt = function(_, i) return kids[i + 1] end }
    W.Other = other
    return W
end

-- a pooled status word (WBP_FloatingText_C): the word, its faint copy and its band, and the style class the word holds now
local function Word(id, styleName)
    local W = Obj("WBP_FloatingText_C", "WBP_FloatingText_C_" .. id, "/Engine/Transient.T" .. id)
    W.Addr, W.Restyled, W.Vis = 2000 + id, {}, 4
    function W:GetAddress() return self.Addr end
    local function Part() local p = { Op = 1 } p.IsValid = function() return true end function p:GetRenderOpacity() return self.Op end function p:SetRenderOpacity(o) self.Op = o end return p end
    W.TextBackground, W.FloatieShadowText = Part(), Part()
    W.FloatieText = Obj("TextBlock", "FloatieText", "t")
    W.FloatieText.Style = styleName and { IsValid = function() return true end, Name = styleName } or { IsValid = function() return false end }
    function W.FloatieText:SetStyle(c) W.Restyled[#W.Restyled + 1] = c.Name end
    return W
end
local pool, keys = { Number(1), Number(2), Number(3) }, { "k1", "k2", "k3" }
local words, wkeys = { Word(1, "PoisonTextStyle"), Word(2, "BurnTextStyle"), Word(3, nil) }, { "w1", "w2", "w3" }
local queue = {}
local M = load(SRCTEXT)()
local on, logs, failed = false, {}, 0
local ctx = { Log = function(m) logs[#logs + 1] = m end, Chain = load(CHAINTEXT)(),
    Soon = function(_, fn) queue[#queue + 1] = fn end,
    Find = function(class) if class == "WBP_FloatingText_C" then return words, wkeys end return pool, keys end,
    MayTry = function(P) return (P.Fails or 0) < 3 and os.clock() >= (P.RetryAt or 0) end,
    Failed = function(P) failed = failed + 1 P.Fails, P.RetryAt = (P.Fails or 0) + 1, os.clock() + 10 end,
    On = function() return on end }
local function Tick(dt) clock = clock + (dt or 1.1) M.Tick(ctx) end
local function Chain(dt) local fn = table.remove(queue, 1) clock = clock + dt fn() end   -- the next call of the chain

check("the pop: 2.5 at the start, 1 at 0.35 s and after", Near(M.Scale(0), 2.5) and M.Scale(0.35) == 1 and M.Scale(2) == 1 and Near(M.Scale(0.175), 1 + 1.5 * 0.25))

-- off at first: nothing is written, and no chain
Tick() Tick()
check("off at first: nothing read or written", #logs == 0 and pool[1].FloatiesIcon.Op == 1 and #queue == 0)

-- on, but the style classes are not loaded yet: no try spent
on = true
Tick() Tick()
check("not loaded yet: no try spent", failed == 0 and not M.Problem())
check("not loaded yet: the icon and the glow are unseen all the same", pool[1].FloatiesIcon.Op == 0 and pool[1].BackgroundGlow.Op == 0 and #pool[1].Styles == 0)

LoadStyles()
Tick()
local function Has(n, size, color)
    local c = cdos[n]
    return c.Font.Size == size and c.Font.FontObject == medium and c.Font.OutlineSettings.OutlineSize == 2 and Near(c.Font.OutlineSettings.OutlineColor.A, 0.9)
        and Near(c.Color.R, color[1]) and Near(c.Color.G, color[2]) and Near(c.Color.B, color[3]) and c.ShadowOffset.X == 1 and c.ShadowOffset.Y == 1 and Near(c.ShadowColor.A, 0.6)
end
local W1, G1 = { 1, 1, 1 }, { 1.0, 0.638, 0.168 }
check("numbers: 18, 22, 26 white, 30 gold, Poppins Medium, edge 2, shadow", Has("NumberSmallTextStyle", 18, W1) and Has("NumberNormalTextStyle", 22, W1) and Has("NumberLargeTextStyle", 26, W1) and Has("NumberCriticalTextStyle", 30, G1))
check("numbers: the drop shadow is on", cdos.NumberSmallTextStyle.bUsesDropShadow == true and cdos.NumberCriticalTextStyle.bUsesDropShadow == true)
check("word: 16, gold, the same font and edge, no gradient", Has("CriticalTextStyle", 16, G1) and cdos.CriticalTextStyle.Font.FontMaterial == nil)
check("every number: the icon and the glow unseen", pool[1].FloatiesIcon.Op == 0 and pool[3].BackgroundGlow.Op == 0)
check("the word is found by its name among the children, and styled once", #pool[1].Styles == 1 and pool[1].Styles[1] == classes.CriticalTextStyle and #pool[3].Styles == 1 and pool[1].Other.Styled == nil)

-- not on every look
cdos.NumberNormalTextStyle.Font.Size = 99
Tick() Tick()
check("once, not on every look", cdos.NumberNormalTextStyle.Font.Size == 99 and #pool[1].Styles == 1)

-- the pool grows: the new number is dressed
pool[4], keys[4] = Number(4), "k4"
Tick()
check("a new number in the pool is dressed", pool[4].FloatiesIcon.Op == 0 and #pool[4].Styles == 1)
cdos.NumberNormalTextStyle.Font.Size = 22

-- nothing plays: the chain never runs
for _ = 1, 5 do Tick(0.07) end
check("calm: no chain", #queue == 0 and #pool[1].Scales == 0)

-- a critical hit plays: the chain starts, the pop goes 2.5 to 1 in 0.35 s
pool[2].Playing[pool[2].FlyUpCritical] = true
Tick(0.06)
check("a critical hit starts the chain", #queue == 1)
-- the step that sees the hit paints the first size, not a chain call later
check("the pop starts at 2.5 on the step that sees the hit, before the chain's first call", Near(pool[2].Scale or 0, 2.5))
Chain(0.016)
check("the chain's first call goes on from there", Near(pool[2].Scale, M.Scale(0.016)))
for _ = 1, 10 do Chain(0.016) end   -- 0.176 s from the start of the pop
check("in between, an ease-out", pool[2].Scale > 1.3 and pool[2].Scale < 1.45)
for _ = 1, 12 do Chain(0.016) end   -- past 0.35 s
check("settled: exactly 1 after 0.35 s", pool[2].Scale == 1)
local writes = #pool[2].Scales
for _ = 1, 20 do Chain(0.016) end
check("one pop for each play: no more writes while it still plays", #pool[2].Scales == writes and pool[1].Scales[1] == nil)
-- the animation ends and plays again: a second pop
pool[2].Playing[pool[2].FlyUpCritical] = nil
Chain(0.016)
pool[2].Playing[pool[2].FlyUpCritical] = true
Chain(0.016)
check("a new play pops again", Near(pool[2].Scale, 2.5))

-- the chain goes on until 5 s after the last number played
pool[2].Playing[pool[2].FlyUpCritical] = nil
for _ = 1, 40 do Chain(0.016) end   -- 0.64 s later
check("still going a little after the last play", #queue == 1)
Tick(0.1)   -- the main loop goes on
clock = clock + 5.5
Chain(0.016)
check("it ends 5 s after the last play and every number is at scale 1", #queue == 0 and pool[2].Scale == 1)

-- a normal hit plays FlyUp: the chain starts too, and keeps the pop of no number
pool[3].Playing[pool[3].FlyUp] = true
Tick(0.06)
check("a normal hit starts the chain", #queue == 1)
Chain(0.016) Chain(0.016)
check("a normal number does not pop", pool[3].Scale == nil)
pool[3].Playing[pool[3].FlyUp] = nil
-- a pop in the middle, then the switch goes off: scale 1 at once and the chain does nothing more
pool[1].Playing[pool[1].FlyUpCritical] = true
Chain(0.016)
check("a pop is on", pool[1].Scale ~= nil and pool[1].Scale > 2)

-- off: every original is back
on = false
Tick(0.05)
check("off: the numbers' styles are the game's", cdos.NumberSmallTextStyle.Font.Size == 14 and cdos.NumberNormalTextStyle.Font.Size == 14 and cdos.NumberCriticalTextStyle.Font.Size == 14
    and cdos.NumberCriticalTextStyle.Font.FontObject == regular and cdos.NumberSmallTextStyle.Font.OutlineSettings.OutlineSize == 1 and Near(cdos.NumberSmallTextStyle.Font.OutlineSettings.OutlineColor.A, 0.3)
    and Near(cdos.NumberSmallTextStyle.Color.G, 0.86) and cdos.NumberSmallTextStyle.bUsesDropShadow == false and cdos.NumberSmallTextStyle.ShadowOffset.X == 0 and cdos.NumberSmallTextStyle.ShadowColor.A == 0)
check("off: the word's style is the game's, gradient and all", cdos.CriticalTextStyle.Font.Size == 10 and cdos.CriticalTextStyle.Font.FontMaterial == gradient and Near(cdos.CriticalTextStyle.Color.G, 0.86))
check("off: the icon and the glow are back", pool[1].FloatiesIcon.Op == 1 and pool[3].BackgroundGlow.Op == 1 and pool[4].FloatiesIcon.Op == 1)
check("off: the word reads its style again", #pool[1].Styles == 2 and pool[1].Styles[2] == classes.CriticalTextStyle)
check("off: every number is at scale 1", pool[1].Scale == 1 and pool[2].Scale == 1)
local left = #pool[1].Scales
while #queue > 0 do Chain(0.016) end
check("off: the queued call of the chain does nothing", #pool[1].Scales == left)
Tick() Tick()
check("off: nothing is written again", cdos.NumberSmallTextStyle.Font.Size == 14 and #queue == 0)

-- on again: the same values, the originals are still the game's
on = true
Tick()
check("on again: the look is back", Has("NumberSmallTextStyle", 18, W1) and pool[1].FloatiesIcon.Op == 0)

-- a new world, the same classes (they still hold our values): written again, and off still gives the game's values
M.Forget(false)
cdos.NumberLargeTextStyle.Color = { R = 0.5, G = 0.5, B = 0.5, A = 1 }   -- proves the write is made again; the class still holds our size
Tick()
check("new world: written again", cdos.NumberLargeTextStyle.Color.R == 1)
on = false
Tick()
check("new world, the same class: off still gives the game's values, not ours", cdos.NumberLargeTextStyle.Font.Size == 14)
on = true
Tick()
-- a new world, the classes loaded again with the game's values at new addresses
M.Forget(false)
LoadStyles()
cdos.NumberSmallTextStyle.Font.Size = 12   -- this world's game value
Tick()
check("new class: written", Has("NumberSmallTextStyle", 18, W1))
on = false
Tick()
check("new class: off gives back this world's values", cdos.NumberSmallTextStyle.Font.Size == 12 and cdos.CriticalTextStyle.Font.Size == 10)

-- forget: every number is at scale 1 and the chain is stopped
on = true
Tick()
pool[1].Playing[pool[1].FlyUpCritical] = true
Tick(0.06)
Chain(0.016)
M.Forget(true)
check("forget: scale 1, and the queued call does nothing", pool[1].Scale == 1)
local before = #pool[1].Scales
while #queue > 0 do Chain(0.016) end
check("forget: the old chain is stopped", #pool[1].Scales == before)
-- a player restart, then the switch off: the part holds no handles, and the game's values are still put back
M.Forget(false)
for i = 1, 4 do pool[i] = Number(i) end   -- the new world's numbers
on = true
Tick()
check("before the restart: our look", Has("NumberSmallTextStyle", 18, W1) and pool[1].FloatiesIcon.Op == 0 and #pool[1].Styles >= 1)
local styled = #pool[1].Styles
M.Forget(true)
on = false
Tick()
check("restart, then off: the styles are the game's", cdos.NumberSmallTextStyle.Font.Size == 12 and cdos.CriticalTextStyle.Font.Size == 10 and cdos.CriticalTextStyle.Font.FontMaterial == gradient)
check("restart, then off: the icons and glows are back, the word reads its class again", pool[1].FloatiesIcon.Op == 1 and pool[2].BackgroundGlow.Op == 1 and #pool[1].Styles == styled + 1)
local sizes = cdos.NumberSmallTextStyle.Font.Size
Tick() Tick()
check("off: the undo runs once for the round", #pool[1].Styles == styled + 1 and cdos.NumberSmallTextStyle.Font.Size == sizes)

-- a world change with the same numbers alive (they belong to the game instance), then off: the opacities read at the
-- first dressing are the ones that come back, and ours (0) is never taken for an original
on = true
Tick()
check("dressed again: unseen", pool[1].FloatiesIcon.Op == 0 and pool[1].BackgroundGlow.Op == 0)
pool[2].FloatiesIcon.Op = 0.8   -- one with an opacity of its own
M.Forget(false)
pool[2].FloatiesIcon.Op = 0.8
Tick()
on = false
Tick()
check("new world, the same numbers, then off: the game's opacity is back", cdos.NumberSmallTextStyle.Font.Size == 12 and pool[1].FloatiesIcon.Op == 1 and pool[1].BackgroundGlow.Op == 1 and pool[3].FloatiesIcon.Op == 1)

-- a number whose record was lost and that holds our 0: its original is taken as 1, never 0
on = true
M.Forget(false)
for i = 1, 4 do pool[i] = Number(i) pool[i].FloatiesIcon.Op = 0 pool[i].BackgroundGlow.Op = 0 end
Tick()
on = false
Tick()
check("a number that already holds 0: the game's 1 comes back", pool[1].FloatiesIcon.Op == 1 and pool[1].BackgroundGlow.Op == 1)

-- a record of a widget that is another object under the same name is dropped
on = true
M.Forget(false)
for i = 1, 4 do pool[i] = Number(i) end
Tick()
pool[3] = Number(3)
pool[3].Addr = 7777
pool[3].FloatiesIcon.Op = 0.6
Tick()
on = false
Tick()
check("the same name on another object: its own opacity comes back, not the old one's", pool[3].FloatiesIcon.Op == 0.6)

-- a number that is a new widget under an old name is a new entry (the address differs)
on = true
M.Forget(false)
Tick()
local oldWord = pool[2].Styles and #pool[2].Styles
pool[2] = Number(2)
pool[2].Addr = 5000
Tick()
check("the same name on another widget: dressed as a new number", pool[2].FloatiesIcon.Op == 0 and #pool[2].Styles == 1)

-- the poll: one call for each number on a step, and not for a widget that is gone
for _, w in ipairs(pool) do w.Polls = 0 end
Tick(0.05)
check("one poll for each number on a step", pool[1].Polls == 1 and pool[3].Polls == 1)
pool[3].IsValid = function() return false end
Tick(0.05)
check("a number that is gone is not asked", pool[3].Polls == 1)
pool[3].IsValid = function() return true end

-- a pop cut short by a new world: the number that was left big is at scale 1 again, with the switch on and with it off
on = true
M.Forget(false)
pool[1] = Number(1)
pool[1].Addr = 6000
pool[1].RenderTransform = { Scale = { X = 2.5 } }
Tick(1.1)
check('a number left big by a new world is at scale 1 when it is dressed', pool[1].Scale == 1)
pool[1].Scale = 2.5
M.Forget(false)
on = false
Tick(1.1)
check('and the switch off puts it at scale 1 too', pool[1].Scale == 1)
on = true
-- the status words: the five styles at size 18, each in its own colour, white-edged by nothing, black edge, shadow, no gradient
local function Status(n, color) return Has(n, 18, color) and cdos[n].Font.FontMaterial == nil and cdos[n].bUsesDropShadow == true end
on = true
M.Forget(false)
for i = 1, 4 do pool[i] = Number(i) end
cdos.PoisonTextStyle.Font.FontMaterial = gradient
words[1], words[2], words[3] = Word(1, "PoisonTextStyle"), Word(2, "BurnTextStyle"), Word(3, nil)
Tick()
check("status words: the five styles are written", Status("PoisonTextStyle", { 0.30, 0.85, 0.15 }) and Status("BurnTextStyle", { 1.00, 0.35, 0.05 })
    and Status("BleedTextStyle", { 0.90, 0.05, 0.05 }) and Status("SlowedTextStyle", { 0.30, 0.70, 1.00 }) and Status("ImmuneTextStyle", { 0.75, 0.75, 0.75 }))
check("status words: the band and the faint copy are unseen, the visibility is the game's", words[1].TextBackground.Op == 0 and words[2].FloatieShadowText.Op == 0 and words[3].TextBackground.Op == 0 and words[1].Vis == 4)
check("status words: each word reads the class it holds, once; one with no valid class is skipped", #words[1].Restyled == 1 and words[1].Restyled[1] == "PoisonTextStyle" and words[2].Restyled[1] == "BurnTextStyle" and #words[3].Restyled == 0)
Tick() Tick()
check("status words: not again on every look", #words[1].Restyled == 1)
words[4], wkeys[4] = Word(4, "BleedTextStyle"), "w4"
Tick()
check("a new word in the pool is dressed", words[4].TextBackground.Op == 0 and #words[4].Restyled == 1)
check("the numbers are not in the words' list, and no poll goes to a word", pool[1].Polls ~= nil and words[1].IsAnyAnimationPlaying == nil)
words[4].TextBackground.Op, words[4].FloatieShadowText.Op = 1, 1
-- a word that holds 0 with its record lost: the game's 1 comes back
local lost = Word(5, "ImmuneTextStyle")
lost.TextBackground.Op, lost.FloatieShadowText.Op = 0, 0
words[5], wkeys[5] = lost, "w5"
Tick()
-- the switch off: the styles, the opacities and the words' own style are back
on = false
Tick()
check("off: the five status styles are the game's", cdos.PoisonTextStyle.Font.Size == 14 and cdos.PoisonTextStyle.Font.FontMaterial == gradient and cdos.BurnTextStyle.Font.Size == 14
    and cdos.ImmuneTextStyle.Font.OutlineSettings.OutlineSize == 1 and Near(cdos.SlowedTextStyle.Color.G, 0.86) and cdos.BleedTextStyle.bUsesDropShadow == false)
check("off: the bands and the faint copies are back", words[1].TextBackground.Op == 1 and words[2].FloatieShadowText.Op == 1 and words[4].TextBackground.Op == 1)
check("off: a word that held 0 gets 1", lost.TextBackground.Op == 1 and lost.FloatieShadowText.Op == 1)
check("off: the word reads its class again", #words[1].Restyled == 2 and #words[3].Restyled == 0)
-- after a restart, then off
on = true
Tick()
M.Forget(true)
on = false
Tick()
check("restart, then off: the words are the game's too", cdos.PoisonTextStyle.Font.Size == 14 and words[1].TextBackground.Op == 1 and words[2].FloatieShadowText.Op == 1)

-- a critical number that holds another style (a staff's critical hit, 05-10-2026): it gets the critical style on the step
-- that starts its pop, once for each play; one that holds the critical style (a sword) is left alone
local function Text(W, style)
    local t = Obj("TextBlock", "FloatiesText", "n")
    t.Style, t.Styled = style, {}
    function t:SetStyle(c) self.Styled[#self.Styled + 1] = c self.Style = c end
    return t
end
local function Play(W) W.Playing[W.FlyUpCritical] = true Chain(0.016) end
local function End(W) for _ = 1, 25 do Chain(0.016) end W.Playing[W.FlyUpCritical] = nil Chain(0.016) end   -- the pop settles, then the play ends
on = true
M.Forget(false)
for i = 1, 4 do pool[i] = Number(i) end
local crit, large = classes.NumberCriticalTextStyle, classes.NumberLargeTextStyle
pool[1].FloatiesText, pool[2].FloatiesText = Text(pool[1], large), Text(pool[2], crit)
Tick()
pool[1].Playing[pool[1].FlyUpCritical] = true
Tick(0.06)
local staff = pool[1].FloatiesText
check("a critical number in another style gets the critical style on the step that sees it", #staff.Styled == 1 and staff.Styled[1] == crit and Near(pool[1].Scale, 2.5))
for _ = 1, 5 do Chain(0.016) end
check("once for a play", #staff.Styled == 1)
Play(pool[2])
check("a critical number in the critical style is left alone, and still pops", #pool[2].FloatiesText.Styled == 0 and Near(pool[2].Scale, 2.5))
End(pool[1])
staff.Style = large   -- the game gives the number its style again on the next hit
Play(pool[1])
check("the next play is looked at again", #staff.Styled == 2)
-- the number is not a property of the widget: found by its name in FloatieOverlay
local kid = Text(pool[3], large)
local kids = { Obj("Image", "FloatiesIcon", "i"), kid }
pool[3].FloatieOverlay = { IsValid = function() return true end, GetChildrenCount = function() return #kids end, GetChildAt = function(_, i) return kids[i + 1] end }
Play(pool[3])
check("the number is found by its name when it is no property", #kid.Styled == 1 and kid.Styled[1] == crit)
-- a number that cannot take a style: the pop goes on
pool[4].FloatiesText = Text(pool[4], large)
pool[4].FloatiesText.SetStyle = function() error("no") end
Play(pool[4])
check("a failure in the style does not stop the pop", Near(pool[4].Scale, 2.5))
-- a new world, then play after play of other styles: each one still gets the critical style
M.Forget(false)
Tick()
for i = 1, 14 do
    End(pool[1])
    staff.Style = Obj("Class", "Other" .. i, "c")
    Play(pool[1])
    Tick(0.05)   -- the main loop goes on, so the chain does
end
check("each play with another style gets the critical style", staff.Style == crit)
on = false
Tick()
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(chain)); lua.lua_setglobal(L, to_luastring('CHAINTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

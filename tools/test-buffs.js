// Tests the buffs under the bars (buffs.lua) against a fake entry shaped like the game's (probes 13 to 17,
// 02-10-2026): the title, the bar and the shadow under the icon, an entry the game reuses for another buff, a buff
// whose bar is empty (over), a buff without a timer, the immersive mode (the level of a buff), and the icon as the
// timer (bufftime.lua).
// Needs npm install once. Run: node tools/test-buffs.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const read = (file) => fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', file), 'utf8');
const src = read('buffs.lua');
const test = `
local failSet = 0   -- the next SetBrushFromTexture calls that throw
local api = {}
api.__index = api
function api:IsValid() return self.valid end
function api:GetFName() return { ToString = function() return self.name end } end
function api:GetFullName() return self.cls .. " " .. self.name end
function api:GetChildrenCount() return #self.kids end
function api:GetChildAt(i) return self.kids[i + 1] end
function api:GetContent() return self.kids[1] end
function api:GetVisibility() return self.vis or 4 end
function api:SetWidthOverride(w) self.w = w end
function api:SetHeightOverride(h) self.h = h end
function api:SetClipping() end
function api:SetRenderOpacity(o) self.op = o end
function api:GetRenderOpacity() return self.op or 1 end
function api:SetColorAndOpacity(c) self.colour = c end
function api:SetBrush(b) self.size = b.ImageSize end
function api:SetContent(c) self.content = c end
function api:SetRenderTranslation(t) self.moved = t end
function api:SetBrushFromTexture(tex)
    if failSet > 0 then failSet = failSet - 1 error("set failed") end
    self.tex = tex.name
end
local function NewSlot(w)
    local slot = {}
    function slot:SetHorizontalAlignment(a) w.h_align = a end
    function slot:SetVerticalAlignment(a) w.v_align = a end
    function slot:SetPadding(p) w.pad = p.Left end
    w.Slot = slot
end
function api:RemoveFromParent()
    for i, k in ipairs(self.parent.kids) do if k == self then table.remove(self.parent.kids, i) break end end
end
function api:AddChildToOverlay(w)
    self.kids[#self.kids + 1] = w
    w.parent = self
    NewSlot(w)
    return w.Slot
end
local function W(name, cls, kids)
    local w = setmetatable({ name = name, cls = cls, kids = kids or {}, valid = true, op = 1, Brush = {} }, api)
    for _, k in ipairs(w.kids) do k.parent = w NewSlot(k) end
    return w
end
local function Tex(name) return W(name, "Texture2D") end

-- the game's entry: SizeBox > Overlay > [icon, Overlay > [ProgressBarImage, TitleText]]
local icon = W("Icon", "CommonLazyImage")
icon.Brush.ResourceObject = Tex("T_Icon_Sml_Coziness")
local bar, title = W("ProgressBarImage", "Image"), W("TitleText", "DomTextBlock")
local ov = W("Overlay_0", "Overlay", { icon, W("Overlay_1", "Overlay", { bar, title }) })
local entry = W("Entry_1", "WBP_HUD_StatusEffectListEntry_C")
entry.WidgetTree = W("WidgetTree", "WidgetTree")
entry.WidgetTree.RootWidget = W("SizeBox_0", "SizeBox", { ov })

FName = function(s) return s end
StaticFindObject = function(p) return p end
StaticConstructObject = function(_, _, name) return W(name, "Image") end
local made, logs = 0, {}
local ownArt = false
local clock = 1000
os.clock = function() return clock end
-- the retry rule of main.lua
local function MayTry(P) return (P.Fails or 0) < 3 and os.clock() >= (P.RetryAt or 0) end
local function Failed(P) P.Fails, P.RetryAt = (P.Fails or 0) + 1, os.clock() + 10 end
local rows, extra, drinks, drinkText = { Instances = {}, Keys = {} }, {}, {}, nil
local Survival = { Find = function() return drinkText end, Turn = function() end,
    Ring = function() return W("ring", "Image"), W("right", "Image"), W("left", "Image") end }
local M = load(SRCTEXT)()
M.Init({
    Log = function(m) logs[#logs + 1] = m print(m) end,
    G = function(n) made = made + 1 return n .. "_" .. made end,
    ById = function() return rows end, MayTry = MayTry, Failed = Failed, Survival = Survival,
    Uniq = function(n) return n end, BuffTime = load(TIMETEXT)(),
    -- the mod's own pictures load only while ownArt is on; "broken" makes the load fail
    CachedTex = function(cache, key, _, file)
        if not ownArt then return nil end
        if ownArt == "broken" then error("picture missing: " .. file, 0) end
        cache[key] = cache[key] or Tex(key)
        return cache[key]
    end,
    ClassName = function(w) return w.cls end,
    FindClass = function(c)
        if c == "WBP_HUD_StatusEffectListEntry_C" then return { entry, table.unpack(extra) }, { "k", table.unpack(extra.keys or {}) } end
        return {}, {}
    end,
    ClearOurs = function(panel, prefix)   -- as in engine.lua
        for i = panel:GetChildrenCount() - 1, 0, -1 do
            local c = panel:GetChildAt(i)
            if string.find(c:GetFName():ToString(), prefix, 1, true) == 1 then c:RemoveFromParent() end
        end
    end })
local function Tick() M.NextRings = 0 M.Tick() end
-- the faces of the entry (one is right), and the parts of the first: its shadow, faint copy and whole copy
local function Faces()
    local out = {}
    for _, k in ipairs(ov.kids) do if string.find(k.name, "^RU_BuffFace") then out[#out + 1] = k end end
    return out
end
local function Face() return Faces()[1] end
local function Shade() return Face().kids[1] end
local function Spent() return Face().kids[2] end
local function Lit() return Face().kids[3].content end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function said(what) local n = 0 for _, m in ipairs(logs) do if string.find(m, what, 1, true) then n = n + 1 end end return n end

M.Scan()
check("the game's title, bar and icon are unseen", title.op == 0 and bar.op == 0 and icon.op == 0)
check("one face, on top, in the middle, a little up", #Faces() == 1 and ov.kids[#ov.kids] == Face() and Face().v_align == 2 and Face().pad == 0
    and Face().moved.Y == -4)
check("the face has the game's picture and is seen", Shade().tex == "T_Icon_Sml_Coziness" and Spent().tex == "T_Icon_Sml_Coziness"
    and Lit().tex == "T_Icon_Sml_Coziness" and Face().op == 1)

M.Scan() Tick()
check("a second scan adds no second face", #Faces() == 1 and made == 5)
M.Forget(true)
M.Scan()
check("a new round: still one face, on top", #Faces() == 1 and made == 10 and ov.kids[#ov.kids] == Face() and #ov.kids == 3)

icon.Brush.ResourceObject = Tex("T_Icon_Sml_Shelter")   -- the game uses the entry for another buff
Tick()
check("a reused entry: the face takes the new picture", Shade().tex == "T_Icon_Sml_Shelter" and Lit().tex == "T_Icon_Sml_Shelter")

icon.Brush.ResourceObject = nil   -- the picture is not loaded yet
Tick()
check("no picture: the face is unseen", Face().op == 0)
icon.Brush.ResourceObject = Tex("T_Icon_Sml_Poison")
failSet = 1
Tick()
Tick()
check("a set that failed is tried again", Shade().tex == "T_Icon_Sml_Poison" and Lit().tex == "T_Icon_Sml_Poison" and Face().op == 1)

Shade().valid = false   -- the game built the entry's inside again
Tick()
M.Scan()
check("an entry whose parts are gone is placed again, with one face", #Faces() == 1 and Shade().valid and Shade().tex == "T_Icon_Sml_Poison")
-- the bar's material, as the game fills it
local fill, barColour = 0.5, { R = 0.1, G = 0.4, B = 0.05, A = 1 }
local function Param(name, value) return { get = function() return { ParameterInfo = { Name = { ToString = function() return name end } }, ParameterValue = value } end } end
bar.Brush.ResourceObject = setmetatable({ valid = true,
    ScalarParameterValues = { ForEach = function(_, fn) fn(1, Param("Fill", fill)) end },
    VectorParameterValues = { ForEach = function(_, fn) fn(1, Param("Bar Color 1", barColour)) fn(2, Param("Bar Color 2", { R = 1, G = 1, B = 1, A = 1 })) end } }, api)
local box = entry.WidgetTree.RootWidget
Tick()
check("a buff with time left is seen", entry.op == 1 and box.w == 46)
-- the face shows the time and the colour; test-bufftime.js tests the numbers
check("half the time left: the whole copy has lost its top", Lit().moved.Y < 0 and Face().kids[3].moved.Y == -Lit().moved.Y)
check("a debuff takes the bar's colour", Lit().colour.G == 1 and Lit().colour.R < 1)
-- the mod's own picture for a buff that it knows by name
ownArt = true
entry.StatusEffectData = W("STATUS_EFFECT_Poisoned", "StatusEffectData")
Tick()
check("a buff that the mod knows takes the mod's own picture", Lit().tex == "buff_poison.png" and Shade().tex == "buff_poison_edge.png" and Face().op == 1)
entry.StatusEffectData = W("STATUS_EFFECT_SomethingNew", "StatusEffectData")
Tick()
check("a buff that the mod does not know takes the game's picture", Lit().tex == "T_Icon_Sml_Poison")
ownArt = "broken"
entry.StatusEffectData = W("STATUS_EFFECT_Bleeding", "StatusEffectData")
Tick() Tick()
check("a picture of the mod that does not load: the game's picture, logged once", Lit().tex == "T_Icon_Sml_Poison" and said("buff picture:") == 1)
ownArt = false
entry.StatusEffectData = nil
Tick()
fill = 0
Tick()
check("an empty bar: the buff is over, unseen, the row closes", entry.op == 0 and box.w == 1)
entry.op = 1   -- the game shows the entry again, the buff still over
Tick()
check("the game shows it again: unseen again", entry.op == 0 and box.w == 1)
fill = 0.8
Tick()
check("the bar fills again: the buff is back", entry.op == 1 and box.w == 46)
bar.vis = 1   -- a buff without a timer (Encumbered): the game hides the bar and still writes 1, then 0
fill = 1
Tick()
check("no timer, the buff on: seen", entry.op == 1 and box.w == 46)
fill = 0
Tick()
check("no timer, the buff over: unseen, the row closes", entry.op == 0 and box.w == 1)
fill = 1      -- the game uses the entry for another buff without a timer: it writes 1 again (watched, 03-10-2026)
Tick()
check("a reused entry without a timer is seen", entry.op == 1 and box.w == 46)
bar.vis, fill = 4, 0
Tick()
M.Forget(true)
M.Scan()
check("a new round: the buff that is over stays unseen", entry.op == 0 and box.w == 1)
fill = 0.5
Tick()
check("and it is back when its bar fills", entry.op == 1 and box.w == 46)
check("the log: each picture named once, no failure", said("buff icon: T_Icon_Sml_Poison") == 1 and said("failed") == 0)

-- the immersive mode: a debuff stays, a good buff follows its own level, and the row closes when it is gone
local function D() return M.Entries()[entry:GetFullName()] end
local function Kind(name) entry.StatusEffectData = name and W(name, "StatusEffectData") or nil end
local function seen() return entry.op == 1 and box.w == 46 end
local function gone() return entry.op == 0 and box.w == 1 end
local function level(l) M.SetLevel(D(), l) end
fill = 0.5
Kind("STATUS_EFFECT_Poisoned") Tick() level(0)
check("a debuff stays at level 0", seen())
Kind("STATUS_EFFECT_Burning") Tick() level(0)
check("another debuff stays at level 0", seen())
Kind(nil) Tick() level(0)
check("no data object: a debuff, stays", seen())
Kind("STATUS_EFFECT_SomethingNew") Tick() level(0)
check("a name the mod does not know: a debuff, stays", seen())
entry.StatusEffectData = W("STATUS_EFFECT_Cosiness", "StatusEffectData") entry.StatusEffectData.valid = false
Tick() level(0)
check("data that is not valid: a debuff, stays", seen())
for _, name in ipairs({ "STATUS_EFFECT_Cosiness", "STATUS_EFFECT_Sheltered", "STATUS_EFFECT_WellRested", "STATUS_EFFECT_Prayer" }) do
    Kind(name) Tick() level(1)
    check(name .. ": good, seen at level 1", seen())
    level(0)
    check(name .. ": good, gone at level 0 without a look, the row closed", gone())
end
Kind("STATUS_EFFECT_Prayer") Tick() level(0.5)
check("a fading good buff: half seen, its place kept", entry.op == 0.5 and box.w == 46)
level(0)
check("faded: not a sliver, 1 unit wide and unseen", gone())
check("faded: the face is unseen too", Face().op == 0)
level(1)
check("it comes back with the bars: the face too", seen() and Face().op == 1)
level(0)
Kind("STATUS_EFFECT_Poisoned") Tick()
check("a reused entry: good to debuff, seen at level 0", seen() and Face().op == 1)
Kind("STATUS_EFFECT_Sheltered") Tick()
check("a reused entry: debuff to good, gone at level 0", gone())
fill = 0 level(1) Tick()
check("a good buff that is over: unseen at level 1", gone())
Kind("STATUS_EFFECT_Poisoned") Tick()
check("a debuff that is over: unseen", gone())
fill = 0.5 Tick()
check("and it is back with its bar", seen())

-- the game's own writes: a closed entry is hidden by its parts too, and the look puts the entry back at 0
Kind("STATUS_EFFECT_Prayer") Tick() level(0)
entry.op = 1
Tick()
check("the game shows a faded good buff again: unseen again on the look", gone())
check("the log names it once", said("shown again") == 1)
entry.op = 1 Tick()
check("and a second time is not logged again", gone() and said("shown again") == 1)
Face().op = 1
icon.Brush.ResourceObject = Tex("T_Icon_Sml_Prayer")
Tick()
check("a new picture for a closed entry: the face stays unseen", Shade().tex == "T_Icon_Sml_Prayer" and Face().op == 0)
level(1)
check("and it shows when the entry opens", Face().op == 1)
Kind("STATUS_EFFECT_Poisoned") Tick()
entry.op = 0.6   -- the game fades an open entry by itself: the mod leaves it alone
Tick()
check("an open entry that the game fades is not fought", entry.op == 0.6)

-- a debuff does not write when the level moves
local writes = 0
entry.SetRenderOpacity = function(self, o) writes = writes + 1 self.op = o end
entry.op = 1 Tick()
writes = 0
level(0.3) level(0)
check("a debuff: a level writes nothing", writes == 0 and entry.op == 1)

-- the game frees an entry between two looks: a level writes to nothing
Kind("STATUS_EFFECT_Prayer") Tick() level(1)
writes = 0
entry.valid = false
level(0)
check("an entry that is gone: no write", writes == 0 and box.w == 46)
entry.valid = true
box.valid = false
level(0)
check("a box that is gone: no write", writes == 0 and box.w == 46)
box.valid = true
entry.SetRenderOpacity = nil

-- a width that failed is tried again on the next look
local failW = 1
box.SetWidthOverride = function(self, w) if failW > 0 then failW = failW - 1 error("width failed") end self.w = w end
level(0)
check("a width that failed: still 46", box.w == 46)
Tick()
check("the next look sets it", box.w == 1)
box.SetWidthOverride = nil
level(1) fill = 0.5

-- arrival: a good buff that comes, comes back after being over, or is another buff in a reused entry
Kind("STATUS_EFFECT_Cosiness") Tick() Tick()
local n = D().Arrivals or 0
Tick()
check("a good buff that stays on does not arrive again", D().Arrivals == n and n >= 1)
fill = 0 Tick() fill = 1 Tick()
check("the fill goes from 0 to on: it arrives", D().Arrivals == n + 1)
Kind("STATUS_EFFECT_Prayer") Tick()
check("a reused entry with another name: it arrives", D().Arrivals == n + 2)
Kind("STATUS_EFFECT_Poisoned") Tick()
check("a debuff does not arrive", D().Arrivals == n + 2)
Kind("STATUS_EFFECT_Prayer") Tick() Tick()
Shade().valid = false   -- the game built the entry's inside again: a new round of the same buff
Tick() M.Scan()
check("an entry built again for a buff that is on is not an arrival", (D().Arrivals or 0) == 0)

-- a build that fails is not marked built: it is tried again 10 s later, 3 times at most, and each failure is logged
local function Entry(name, withTitle)
    local i, b, t = W("Icon", "CommonLazyImage"), W("ProgressBarImage", "Image"), W("TitleText", "DomTextBlock")
    i.Brush.ResourceObject = Tex("T_Icon_Sml_" .. name)
    local barBox = W("Overlay_1", "Overlay", { b, withTitle and t or nil })
    local e = W(name, "WBP_HUD_StatusEffectListEntry_C")
    e.WidgetTree = W("WidgetTree", "WidgetTree")
    e.WidgetTree.RootWidget = W("SizeBox_0", "SizeBox", { W("Overlay_0", "Overlay", { i, barBox }) })
    return e, barBox, t
end
local late, lateBox, lateTitle = Entry("Late", false)   -- the game has not made its title yet
extra, extra.keys = { late }, { "late" }
local before = said("buff under the bars failed")
M.Scan()
check("an entry that cannot be built yet: logged, not marked built", said("buff under the bars failed") == before + 1 and M.Entries()["WBP_HUD_StatusEffectListEntry_C Late"] == nil)
M.Scan()
check("... not tried again at the next scan, the rule says 10 s", said("buff under the bars failed") == before + 1)
lateTitle.parent, lateBox.kids[#lateBox.kids + 1] = lateBox, lateTitle
clock = clock + 11
M.Scan()
check("... tried again 10 s later: built once its title is there", M.Entries()["WBP_HUD_StatusEffectListEntry_C Late"] ~= nil and lateTitle.op == 0)
local broken = Entry("Broken", false)
extra, extra.keys = { broken }, { "broken" }
before = said("buff under the bars failed")
for _ = 1, 6 do M.Scan() clock = clock + 11 end
check("an entry that never builds: 3 tries, then left alone", said("buff under the bars failed") == before + 3)
M.Forget(false)
M.Scan()
check("a new round gives new tries", said("buff under the bars failed") == before + 4)

-- the drink ring, the same
local item, under = W("ItemImage", "Image"), W("Overlay_1", "Overlay")
local drink = W("Drink_1", "WBP_HUD_DrinkBuffListEntry_C")
drink.WidgetTree = W("WidgetTree", "WidgetTree")
drink.WidgetTree.RootWidget = W("VerticalBox_0", "VerticalBox", { W("Overlay_0", "Overlay", { item }), under })
before = said("drink ring failed")
M.Drinks.Decorate(drink, "drink", { R = 1, G = 1, B = 1, A = 1 })
check("a drink ring that cannot be built: logged, not marked built", said("drink ring failed") == before + 1 and M.Drinks.Deco["drink"] == nil)
drinkText = W("DurationText", "Text")
clock = clock + 11
M.Drinks.Decorate(drink, "drink", { R = 1, G = 1, B = 1, A = 1 })
check("... built 10 s later", M.Drinks.Deco["drink"] and M.Drinks.Deco["drink"].Right ~= nil)

-- the buff row: the list is turned sideways, and the build is tried again when it failed
local listView = W("ListView", "ListView")
local rowOv = W("Overlay", "Overlay", { listView })
listView.Slot.Padding, listView.Slot.HorizontalAlignment, listView.Slot.VerticalAlignment = { Left = 0, Top = 0, Right = 0, Bottom = 0 }, 1, 1
local busy = 1
local removeParent = listView.RemoveFromParent
function listView:RemoveFromParent() if busy > 0 then busy = busy - 1 error("busy") end removeParent(self) end
local rowWidget = W("Row_1", "WBP_HUD_BuffsWidget")
rowWidget.WidgetTree = W("WidgetTree", "WidgetTree")
rowWidget.WidgetTree.RootWidget = rowOv
rows.Instances[1], rows.Keys[1] = rowWidget, "row"
extra, extra.keys = {}, {}
M.Scan()
check("a buff row that failed: logged, the list not turned yet", said("buff row failed") == 1 and said("buffs turned into a row") == 0 and listView.h_align == nil)
clock = clock + 11
M.Scan()
check("... turned 10 s later, once", said("buffs turned into a row") == 1 and listView.h_align == 1)
clock = clock + 11
M.Scan()
check("... and not again", said("buffs turned into a row") == 1)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(read('bufftime.lua'))); lua.lua_setglobal(L, to_luastring('TIMETEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

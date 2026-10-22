// Tests the item pick-up rows (pickups.lua) against a fake row shaped like the game's (probe 21, 02-10-2026): the
// band goes unseen, every text gets the HUD font and the shadow, the count turns gold with the game's alpha kept;
// a row is styled once; the count is gold again after the game writes its own colour; a row the game makes later
// is styled too; a new world starts over. A new item: the loose sparks of its row are switched off (embers.lua) once for
// each row, a component that is not there yet is tried again, a refused call is logged once and does not stop the row's
// other styling; "NEW MATERIAL !" gets room above it, the rest of its padding kept; the colour keys of the new item's
// animation all get the last one, once.
// Needs npm install once. Run: node tools/test-pickups.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'pickups.lua'), 'utf8');
const embers = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'embers.lua'), 'utf8');
const test = `
local fonts = 0
local api = {}
api.__index = api
function api:IsValid() return self.valid end
function api:GetFName() return { ToString = function() return self.name end } end
function api:GetClass() return { GetFName = function() return { ToString = function() return self.cls end } end } end
function api:GetChildrenCount() if self.leaf then error("not a panel") end return #self.kids end
function api:GetChildAt(i) return self.kids[i + 1] end
function api:SetRenderOpacity(o) self.op = o end
function api:SetFont(f) self.font = f.FontObject fonts = fonts + 1 end
function api:SetShadowOffset(o) self.offset = o.X end
function api:SetShadowColorAndOpacity(c) self.shade = c.A end
function api:SetColorAndOpacity(c) self.ColorAndOpacity = c end
function api:GetNiagaraComponent() return self.comp end
function api:SetEmitterEnable(name, on) if self.throws then error("refused") end self.calls[#self.calls + 1] = name .. ":" .. tostring(on) end
function FName(s) return s end
local function W(name, cls, kids)
    return setmetatable({ name = name, cls = cls, kids = kids or {}, valid = true, op = 1, leaf = kids == nil,
        Slot = { Padding = { Left = 2, Top = 0, Right = 5, Bottom = 1 }, SetPadding = function(_, p) _.top, _.left, _.right = p.Top, p.Left, p.Right end },
        Font = { Size = 14 }, ColorAndOpacity = { SpecifiedColor = { R = 0.9, G = 0.3, B = 0.2, A = 0.7 } } }, api)
end
local function Row(n)
    local r = { band = W("CommonLazyImage_83", "CommonLazyImage"), item = W("ItemText", "WBP_DomTextBlock_C"),
        count = W("ItemCountText", "WBP_DomTextBlock_C"), bag = W("InventoryCount", "WBP_DomTextBlock_C"),
        new = W("NewItemText", "WBP_DomTextBlock_C"), icon = W("ItemImage", "WBP_IconImage_C") }
    r.nia = W("NS_UI_NewItemFound", "NiagaraSystemWidget")
    r.nia.comp = setmetatable({ valid = true, calls = {} }, api)
    r.sparks = W("SizeBox_2", "SizeBox", { r.nia })
    local ov = W("Overlay_2", "Overlay", { r.sparks, r.band,
        W("Overlay_0", "Overlay", { W("SizeBox_0", "SizeBox", { r.icon }), W("ItemHighlightImage", "Border"), r.bag }),
        W("TextVerticalBox", "VerticalBox", { W("ItemNameQuantityBox", "HorizontalBox", { r.item, W("Spacer_567", "Spacer"), r.count }), r.new }) })
    r.W = W("Row_" .. n, "WBP_ItemPickups_Item_C")
    r.W.WidgetTree = setmetatable({ RootWidget = W("SizeBox_1", "SizeBox", { ov }), valid = true }, api)
    return r
end
local rows = { Row(1), Row(2) }
-- the colour keys of the new item's animation: near black, then the light colour
local function Curve(a, b) return { Values = { { Value = a }, { Value = a }, { Value = b } } } end
local section = setmetatable({ name = "MovieSceneColorSection_0", valid = true, RedCurve = Curve(0.018, 0.788),
    GreenCurve = Curve(0.017, 0.667), BlueCurve = Curve(0.018, 0.435), AlphaCurve = Curve(0, 1) }, api)
local finds = 0
function StaticFindObject(p) finds = finds + 1 if p:find("InAnimationNewMaterial") then return section end end
local clock, logs = 0, {}
os.clock = function() return clock end
local M = load(SRCTEXT)()
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, Font = function() return "Poppins" end, Embers = load(EMBERS)(),
    Find = function()
        local list, keys = {}, {}
        for i, r in ipairs(rows) do list[i], keys[i] = r.W, "Transient." .. r.W.name end
        return list, keys
    end }
local function Step() clock = clock + 0.6 M.Tick(ctx) end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function IsGold(t) local c = t.ColorAndOpacity.SpecifiedColor return c.R == 1.0 and c.G == 0.638 and c.B == 0.168 end

Step()
local r = rows[1]
check("the band is unseen, the icon stays", r.band.op == 0 and r.icon.op == 1)
check("every text in the HUD font, with the shadow", r.item.font == "Poppins" and r.bag.font == "Poppins" and r.new.font == "Poppins"
    and r.item.offset == 1.5 and r.count.shade == 0.85 and r.item.Font.Size == 14)
check("the count is gold, the game's alpha kept", IsGold(r.count) and r.count.ColorAndOpacity.SpecifiedColor.A == 0.7)
check("the item's name keeps the game's colour", r.item.ColorAndOpacity.SpecifiedColor.R == 0.9)
check("the sparks: Embers_Box is switched off once on the row's component, the box itself is not hidden", r.nia.comp.calls[1] == "Embers_Box:false" and #r.nia.comp.calls == 1 and r.sparks.op == 1)
check("the second row too", rows[2].nia.comp.calls[1] == "Embers_Box:false" and #rows[2].nia.comp.calls == 1)
check("room above NEW MATERIAL, its other padding kept", r.new.Slot.top == 3 and r.new.Slot.left == 2 and r.new.Slot.right == 5)
check("the new item's word is light from the start", section.RedCurve.Values[1].Value == 0.788 and section.GreenCurve.Values[2].Value == 0.667
    and section.AlphaCurve.Values[1].Value == 1 and section.BlueCurve.Values[3].Value == 0.435)
check("the second row too", rows[2].band.op == 0 and IsGold(rows[2].count))
local before = fonts
Step()
check("a row is styled once", fonts == before and #r.nia.comp.calls == 1 and #rows[2].nia.comp.calls == 1)
check("the animation is changed once", finds == 1)
r.count.ColorAndOpacity = { SpecifiedColor = { R = 0.9, G = 0.3, B = 0.2, A = 1 } }   -- the game writes its red again
Step()
check("the count is gold again", IsGold(r.count) and r.count.ColorAndOpacity.SpecifiedColor.A == 1)
rows[3] = Row(3)
Step()
check("a row the game makes later is styled, its sparks too", rows[3].band.op == 0 and rows[3].item.font == "Poppins" and #rows[3].nia.comp.calls == 1)
M.Forget()
before = fonts
Step()
check("a new world: every row is styled again, the sparks too", fonts == before + 12 and #r.nia.comp.calls == 2 and #rows[3].nia.comp.calls == 2)
check("the log: one line that the sparks are set in each world, no failure", #logs == 2 and logs[1]:find("pick-ups: Embers_Box (the loose sparks) is off, the streaks stay", 1, true) == 1 and logs[2] == logs[1])

-- the component is not there yet: tried again on each look, one log line, then set
M.Forget()
logs = {}
rows = { Row(4) }
rows[1].nia.comp.valid = false
Step() Step()
check("no valid component: nothing called, the row is styled, one log line", #rows[1].nia.comp.calls == 0 and rows[1].band.op == 0 and #logs == 1 and logs[1]:find("is not off yet: the sparks widget has no component yet", 1, true))
rows[1].nia.comp.valid = true
Step()
check("the component comes: set once, and one more log line", #rows[1].nia.comp.calls == 1 and #logs == 2 and logs[2]:find("Embers_Box (the loose sparks) is off", 1, true))
Step()
check("and not again", #rows[1].nia.comp.calls == 1 and #logs == 2)

-- the call is refused: one log line, the row's styling is not stopped, the next look tries again
M.Forget()
logs = {}
rows = { Row(5) }
rows[1].nia.comp.throws = true
Step() Step()
check("a refused call: one log line with the reason, the texts and the gold are done", #logs == 1 and logs[1]:find("is not off yet: ", 1, true) and logs[1]:find("refused", 1, true)
    and rows[1].item.font == "Poppins" and IsGold(rows[1].count) and rows[1].band.op == 0)
rows[1].nia.comp.throws = false
Step()
check("the engine takes the call at a later look", #rows[1].nia.comp.calls == 1)

-- a row with no tree yet: nothing is called on the sparks, one log line for them; the tree comes and the sparks are set
M.Forget()
logs = {}
rows = { Row(7) }
local tree7 = rows[1].W.WidgetTree
rows[1].W.WidgetTree = nil
Step() Step()
check("no tree yet: one log line for the sparks (and the old one for the row's styling), no call", #logs == 2 and logs[2]:find("is not off yet: the row has no tree yet", 1, true) and #rows[1].nia.comp.calls == 0)
rows[1].W.WidgetTree = tree7
Step()
check("the tree comes: the sparks are set", #rows[1].nia.comp.calls == 1)
check("the tree comes: the row that failed to style is styled at a later look", rows[1].band.op == 0 and rows[1].item.font == "Poppins" and IsGold(rows[1].count))

-- a row without the sparks box: logged once, the row is styled
M.Forget()
logs = {}
rows = { Row(6) }
table.remove(rows[1].W.WidgetTree.RootWidget.kids[1].kids, 1)
Step() Step()
check("no sparks box: one log line, the row is styled", #logs == 1 and logs[1]:find("no SizeBox_2 in the row", 1, true) and rows[1].band.op == 0)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(embers)); lua.lua_setglobal(L, to_luastring('EMBERS'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

// Tests the number on the stamina bar (staminatext.lua) against fake bars shaped like the game's: the health bar's
// ValueText with its font and place, the stamina bar's Overlay_0, the pawn's StaminaComponent.
// Needs npm install once. Run: node tools/test-staminatext.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'staminatext.lua'), 'utf8');
const test = `
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local clock = 100
os.clock = function() return clock end
local addr = 0
local function Obj(name) addr = addr + 1 local o = { Name = name, Valid = true, Addr = addr }
    function o:IsValid() return self.Valid end
    function o:GetAddress() return self.Addr end
    function o:GetFName() local n = self.Name return { ToString = function() return n end } end
    return o end
function FName(s) return s end
function FText(s) return s end
function StaticFindObject(p) return { Path = p } end
function StaticConstructObject(cls, outer, name)
    local T = Obj(name) T.Class = cls.Path T.Op = 1 T.Sets = 0
    function T:SetFont(f) self.Font = f end
    function T:SetColorAndOpacity(c) self.Color = c end
    function T:SetShadowOffset(o) self.Shadow = o end
    function T:SetShadowColorAndOpacity(c) self.ShadowColor = c end
    function T:SetRenderOpacity(o) self.Op = o end
    function T:SetText(s) self.Text = s self.Sets = self.Sets + 1 end
    return T
end
local function Panel(name, kids)
    local P = Obj(name) P.Kids = kids or {}
    function P:GetChildrenCount() return #self.Kids end
    function P:GetChildAt(i) return self.Kids[i + 1] end
    function P:AddChildToOverlay(T)
        self.Kids[#self.Kids + 1] = T
        local slot = {}
        function slot:SetHorizontalAlignment(a) self.H = a end
        function slot:SetVerticalAlignment(a) self.V = a end
        function slot:SetPadding(p) self.Pad = p end
        T.Slot = slot
        return slot
    end
    return P
end
local function StaminaBar()
    local box = Panel("Overlay_0", { Obj("SizeBox_3") })
    local bar = Obj("WBP_HUD_Vitals_StaminaBar_C")
    bar.WidgetTree = { RootWidget = Panel("HorizontalBox_2", { Obj("StaminaIcon"), box }) }
    return bar, box
end
local health = Obj("WBP_HUD_Vitals_HealthBar_C")
local srcSlot = Obj("OverlaySlot") srcSlot.HorizontalAlignment, srcSlot.VerticalAlignment, srcSlot.Padding = 2, 2, { Left = 4 }
health.ValueText = Obj("ValueText")
health.ValueText.Font, health.ValueText.ColorAndOpacity, health.ValueText.Slot = { Size = 12 }, { R = 1 }, srcSlot
health.ValueText.ShadowOffset, health.ValueText.ShadowColorAndOpacity = { X = 1, Y = 1 }, { A = 0.5 }
local stamina, box = StaminaBar()
local comp = Obj("StaminaComponent") comp.Cur, comp.Max = 100, 100
function comp:GetStamina() return self.Cur end
function comp:GetMaxStamina() return self.Max end
local pc = Obj("PC") pc.Pawn = Obj("Pawn") pc.Pawn.StaminaComponent = comp
local on, logs, failed = false, {}, 0
local ctx = { Log = function(m) logs[#logs + 1] = m end, Controller = function() return pc end,
    MayTry = function(P) return (P.Fails or 0) < 3 end, Failed = function(P) failed = failed + 1 P.Fails = (P.Fails or 0) + 1 end,
    ClearOurs = function(panel, prefix)
        for i = #panel.Kids, 1, -1 do if panel.Kids[i].Name:find(prefix, 1, true) == 1 then table.remove(panel.Kids, i) end end
    end,
    Uniq = function(n) addr = addr + 1 return n .. "_" .. addr end,
    Bars = function() return { stamina, health } end, On = function() return on end }
local M = load(SRCTEXT)()
local function Tick(sec) clock = clock + (sec or 0.25) M.Tick(ctx) end
local function Ours(b) for _, k in ipairs(b.Kids) do if k.Name:find("RU_StamNum", 1, true) then return k end end end

Tick()
check("off at first: nothing is made", #box.Kids == 1)
on = true Tick()
local T = Ours(box)
check("on: one text in the stamina bar's Overlay_0", T ~= nil and #box.Kids == 2 and T.Class == "/Script/UMG.TextBlock")
check("in the health text's font, colour and shadow", T.Font.Size == 12 and T.Color.R == 1 and T.Shadow.X == 1 and T.ShadowColor.A == 0.5)
check("at the health text's place", T.Slot.H == 2 and T.Slot.V == 2 and T.Slot.Pad.Left == 4)
check("the stamina as the health shows it", T.Text == "100/100" and T.Op == 1)
comp.Cur = 62.6 Tick()
check("a new value is written, rounded", T.Text == "63/100")
local sets = T.Sets
Tick() Tick()
check("the same value is not written again", T.Sets == sets)
comp.Cur = 62.8 Tick()
check("a change that rounds to the same number is not written", T.Sets == sets)
on = false Tick()
check("off: see-through, still there", T.Op == 0 and Ours(box) == T)
comp.Cur = 10 Tick()
check("off: not written", T.Text == "63/100")
on = true Tick()
check("on again: shown with the value now", T.Op == 1 and T.Text == "10/100")
clock = clock + 0.05 comp.Cur = 20 M.Tick(ctx)
check("5 reads a second, not more", T.Text == "10/100")

-- a new HUD: a new stamina bar gets its own text, and the old one is not touched
local stamina2, box2 = StaminaBar()
stamina = stamina2 Tick()
check("a new stamina bar: a text in it", Ours(box2) ~= nil and Ours(box2) ~= T)
-- a player restart: the component is new
M.Forget()
local comp2 = Obj("StaminaComponent2") comp2.Cur, comp2.Max = 5, 120
function comp2:GetStamina() return self.Cur end
function comp2:GetMaxStamina() return self.Max end
comp.Valid = false pc.Pawn.StaminaComponent = comp2
Tick()
check("after a restart: the new component, the text made once more in the same bar", Ours(box2).Text == "5/120" and #box2.Kids == 2)

-- a health bar with no ValueText: 3 tries, a line each, then no more
local stamina3, box3 = StaminaBar()
stamina = stamina3 health.ValueText = nil
M.Forget() logs = {}
for _ = 1, 6 do Tick(11) end
check("no ValueText: 3 tries, then it stops, nothing made", failed == 3 and #logs == 3 and #box3.Kids == 1)
if fails > 0 then error(fails .. " failed") end
print("ALL PASS")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL ' + lua.lua_tojsstring(L, -1)); process.exit(1); }

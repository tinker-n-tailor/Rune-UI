// Tests the readable letters (letters.lua) against fake widgets shaped like the game's panels (probes of 30-09 and
// 01-10-2026): every text gets the shadow but the key letters, the panel's own words turn white with the game's alpha
// kept, the red "inventory full" keeps its colour, the build title loses its tapered shadow. It also tests the cost:
// no walk and few engine reads while nothing changes, a walk when the widget is new, shows again or has another count
// of children at its root, the slow rescan for a row deep in a panel, a big panel read in small steps, and the
// colour the game wrote read again within a second.
// Needs npm install once. Run: node tools/test-letters.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'letters.lua'), 'utf8');
const test = `
collectgarbage = function() return 0 end
local calls = {}   -- engine reads by name, since the last Reset
local function Reset() calls = {} end
local function Reads() local n = 0 for _, v in pairs(calls) do n = n + v end return n end
local function Count(name, f) return function(...) calls[name] = (calls[name] or 0) + 1 return f(...) end end

local function W(name, cls, kids, color)
    local w = { name = name, cls = cls, kids = kids or {}, visible = true,
        _c = color or { R = 1, G = 1, B = 1, A = 0.8 } }
    if string.find(cls, "^WBP_") and kids then w.WidgetTree = { RootWidget = { name = "Root", cls = "CanvasPanel", kids = kids } } w.kids = {} end
    local api = {
        IsValid = Count("IsValid", function(self) return not self.gone end),
        IsVisible = Count("IsVisible", function(self) return self.visible end),
        GetFName = Count("GetFName", function(self) return { ToString = function() return self.name end } end),
        GetClass = Count("GetClass", function(self) return { GetFName = function() return { ToString = function() return self.cls end } end } end),
        GetChildrenCount = Count("GetChildrenCount", function(self) return #self.kids end),
        GetChildAt = Count("GetChildAt", function(self, i) return self.kids[i + 1] end),
        SetShadowOffset = function(self, o) self.offset = o.X end,
        SetShadowColorAndOpacity = function(self, c) self.shade = c.A end,
        SetDefaultShadowOffset = function(self, o) self.offset = o.X end,
        SetDefaultShadowColorAndOpacity = function(self, c) self.shade = c.A end,
        SetColorAndOpacity = function(self, c) self._c = c.SpecifiedColor end,
        SetBrushColor = function(self, c) self.brushA = c.A end,
    }
    local function index(t, k)
        if k == "ColorAndOpacity" then calls.Color = (calls.Color or 0) + 1 return { SpecifiedColor = t._c } end
        return api[k]
    end
    setmetatable(w, { __index = index })
    if w.WidgetTree then setmetatable(w.WidgetTree.RootWidget, { __index = index }) end
    return w
end
local function Paint(w, c) w._c = c end
local function Colour(w) return w._c end

-- the pick-up prompt
local name, label = W("ItemNameTextBlock", "TextBlock"), W("LabelRichText", "DomRichTextBlock")
local full = W("InventoryStateTextBlock", "TextBlock", nil, { R = 0.8, G = 0.1, B = 0.1, A = 1 })
local keyText = W("KeyText", "TextBlock")
local key = W("InputActionWidget", "WBP_DomInputIconWidget_C", { W("IconBorder", "CommonBorder", { keyText }) })
local prompt = W("Prompt", "WBP_HUD_InteractionPrompt_C", {
    W("VerticalBox_0", "VerticalBox", { full, name, W("PromptInput", "WBP_InputLegend_RichText_InputEntry_C", { label, key }) }) })
-- the build panel: a gold title with the tapered shadow, one action row, a red cost
local title = W("TooltipTitle", "WBP_DomTextBlock_C", nil, { R = 0.9, G = 0.7, B = 0.3, A = 0.9 })
local nameBorder = W("NameBorder", "Border", { title })
local desc = W("InputDescription", "DomTextBlock", nil, { R = 0.5, G = 0.9, B = 0.5, A = 1 })
local cost = W("CostText", "TextBlock", nil, { R = 0.9, G = 0.2, B = 0.2, A = 1 })
local rows = W("PromptsContainer", "VerticalBox", { W("Row1", "WBP_Building_WorldTooltip_Input_C", { desc }) })
local build = W("Build", "WBP_Building_WorldTooltip_C", { nameBorder, cost, rows })
local clock = 0
os.clock = function() return clock end
local M = load(SRCTEXT)()
local hosts = { WBP_HUD_InteractionPrompt_C = { { prompt }, { "Transient.Prompt_1" } }, WBP_Building_WorldTooltip_C = { { build }, { "Transient.Build_1" } } }
local finds = 0
local ctx = { Log = function(m) print(m) end, Find = function(c) finds = finds + 1 local h = hosts[c] if h then return h[1], h[2] end return {}, {} end }
-- one step of the timer: dt seconds pass first
local function Step(dt) clock = clock + (dt or 0.6) M.Tick(ctx) end
-- enough steps for any walk of these small panels, and for the first look
local function Settle() for _ = 1, 4 do Step(0.6) end end

Settle()
for _, t in ipairs({ name, label, full, title, desc, cost }) do assert(t.offset == 1.5 and t.shade == 0.85, "no shadow on " .. t.name) end
assert(keyText.offset == nil, "shadow on the key letters")
assert(nameBorder.brushA == 0, "tapered shadow still there")
local function IsWhite(t) local c = Colour(t) return c.R == 1 and c.G == 1 and c.B == 1 end
assert(IsWhite(title) and Colour(title).A == 0.9, "title not white or alpha lost")
assert(IsWhite(desc), "action words not white")
assert(Colour(full).R == 0.8 and Colour(cost).G == 0.2, "a meaningful colour painted white")

-- nothing changed: a look reads a handful of values, no widget tree, no search for a panel that is held
Step(0.6)
Reset() finds = 0
Step(0.6)
assert(calls.GetClass == nil and calls.GetFName == nil and calls.GetChildAt == nil, "walked with nothing changed")
assert(finds == 1, "searched for a held panel (only the absent repair panel is searched): " .. finds)
local idle = Reads()
assert(idle <= 14, "too many engine reads in an idle look: " .. idle)
print("engine reads in an idle look: " .. idle)
-- between two looks nothing is read at all
Reset() finds = 0
Step(0.05)
assert(Reads() == 0 and finds == 0, "reads between two looks")

-- the game paints the title gold again: white at the next read of colours (within a second), no walk needed
Paint(title, { R = 0.9, G = 0.7, B = 0.3, A = 0.5 })
Reset()
Step(1.1)
assert(IsWhite(title) and Colour(title).A == 0.5, "not white again")
assert(calls.GetClass == nil, "walked to turn a colour white")

-- the game adds a row deep in the panel: the count at the root is the same, so only the slow rescan finds it
local desc2 = W("InputDescription", "DomTextBlock")
table.insert(rows.kids, W("Row2", "WBP_Building_WorldTooltip_Input_C", { desc2 }))
Step(1) Step(1) Step(1)
assert(desc2.offset == nil, "walked on every look")
clock = clock + 30 Settle()
assert(desc2.offset == 1.5, "a new row without the shadow after the slow rescan")

-- the game adds a text at the root: another count of children, so a walk at the next look
local rootText = W("GenericBuildModeText", "TextBlock", nil, { R = 0.4, G = 0.4, B = 0.4, A = 1 })
table.insert(build.WidgetTree.RootWidget.kids, rootText)
Reset()
Step(0.6) Step(0.05)
assert(calls.GetClass, "no walk for another count of children")
Settle()
assert(rootText.offset == 1.5 and IsWhite(rootText), "text at the root without shadow or white")

-- the panel is hidden and shows again with a row that the game added while it was hidden
prompt.visible = false
Step(0.6) Step(0.6)
local label2 = W("LabelRichText", "DomRichTextBlock")
table.insert(prompt.WidgetTree.RootWidget.kids[1].kids, label2)
Reset() Step(0.6) Step(0.05)
assert(calls.GetClass == nil, "walked while hidden")
prompt.visible = true
Step(0.6) Settle()
assert(label2.offset == 1.5, "a panel that shows again not read")

-- a new world: the old panel is gone and a new widget stands there, read again at once
local name2 = W("ItemNameTextBlock", "TextBlock")
local prompt2 = W("Prompt", "WBP_HUD_InteractionPrompt_C", { name2 })
prompt.gone = true
hosts.WBP_HUD_InteractionPrompt_C = { { prompt2 }, { "Transient.Prompt_2" } }
Step() Settle()
assert(name2.offset == 1.5, "new prompt not read")
-- and a new widget behind a panel that still stands is found at the slow rescan
local name3 = W("ItemNameTextBlock", "TextBlock")
hosts.WBP_HUD_InteractionPrompt_C = { { W("Prompt", "WBP_HUD_InteractionPrompt_C", { name3 }) }, { "Transient.Prompt_3" } }
clock = clock + 30 Settle()
assert(name3.offset == 1.5, "new prompt behind a standing one not read")
M.Forget()
assert(next(M.Hosts) == nil, "Forget kept a panel")

-- a big panel is read in small steps, and every text gets the shadow in the end
local many = {}
for i = 1, 120 do many[i] = W("Row" .. i, "TextBlock") end
hosts.WBP_ReticleRepair_C = { { W("Repair", "WBP_ReticleRepair_C", many) }, { "Transient.Repair_1" } }
local most = 0
for _ = 1, 40 do
    Reset() Step(0.6)
    most = math.max(most, calls.GetClass or 0)
end
assert(most > 0 and most <= 25, "a step read too many widgets: " .. most)
for i = 1, 120 do assert(many[i].offset == 1.5, "text " .. i .. " without the shadow") end
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

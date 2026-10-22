// Tests the quest tracker's look (questlook.lua) against fake widgets named as the game's (WBP_HUD_QuestList, seen
// 14-10-2026): an item loses its dark band, gets our gold line under its name (between the name and the steps) and a
// gold name in normal case; an entry's step is white; both in the HUD
// font with the shadow; each widget is dressed once, by its full name; nothing happens before the fonts are found; a
// new step changes Sig (the immersive mode wakes on it), no quest at all gives none; a new world dresses again.
// Needs npm install once. Run: node tools/test-questlook.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'questlook.lua'), 'utf8');
const test = `
local api = {}
api.__index = api
function api:IsValid() return true end
function api:SetRenderOpacity(o) self.op = o end
function api:SetColorAndOpacity(c) self.colour = c.SpecifiedColor or c end
function api:SetFont(f) self.font = f.FontObject self.fontSets = (self.fontSets or 0) + 1 end
function api:SetShadowOffset(o) self.offset = o.X end
function api:SetShadowColorAndOpacity(c) self.shade = c.A end
function api:GetText() local t = self.text return { ToString = function() return t end } end
function api:SetTextTransformPolicy(p) self.policy = p end
function api:SetVisibility(v) self.vis = v end
function api:SetHeightOverride(h) self.height = h end
function api:SetContent(c) self.content = c end
function api:GetParent() return self.parent end
-- a vertical box: its children in order; a slot of its own for each, with a padding and an alignment
function api:GetChildAt(i) return self.kids[i + 1] end
function api:GetChildrenCount() return #self.kids end
function api:GetFName() local n = self.name return { ToString = function() return n end } end
function api:GetChildIndex(w) for i, k in ipairs(self.kids) do if k == w then return i - 1 end end return -1 end
local slotApi = {} slotApi.__index = slotApi
function slotApi:IsValid() return true end
function slotApi:SetPadding(p) self.Padding = p end
function slotApi:SetHorizontalAlignment(h) self.HorizontalAlignment = h end
function api:AddChildToVerticalBox(w) self.kids[#self.kids + 1] = w w.parent = self w.Slot = setmetatable({ Padding = { Left = 0, Top = 0, Right = 0, Bottom = 0 }, HorizontalAlignment = 0 }, slotApi) return w.Slot end
function api:RemoveFromParent() local p = self.parent for i, k in ipairs(p.kids) do if k == self then table.remove(p.kids, i) break end end self.parent, self.Slot = nil, nil end
-- the engine: a made widget is a plain fake, named for the check
function StaticFindObject(path) return path end
function StaticConstructObject(cls, tree, name) local w = setmetatable({ cls = cls, name = name, kids = {} }, api) return w end
local made = 0
local function W(t) made = made + 1 t = t or {} t.name = "Widget" .. made return setmetatable(t, api) end
local function Text(s) return W({ Font = { LetterSpacing = 200 }, text = s }) end
-- an item: its column holds the name row, the underline and the steps, as in the game
local function Item(title)
    local it = W({ Background = W({ op = 1 }), Seperator = W(), QuestTitle = Text(title), WidgetTree = {} })
    local column = W({ kids = {} })
    for _, k in ipairs({ W(), it.Seperator, W() }) do column:AddChildToVerticalBox(k) end
    column.kids[3].Slot.Padding = { Left = 0, Top = 5, Right = 0, Bottom = 0 }
    column.kids[3].Slot.HorizontalAlignment = 2
    it.column, it.steps = column, column.kids[3]
    return it
end
local function Entry(step) return W({ SubobjectiveDescription = Text(step) }) end

local items, entries = { Item("Quest A") }, { Entry("Find the key") }
local clock, logs, fonts = 0, {}, true
os.clock = function() return clock end
local M = load(SRCTEXT)()
local ctx = { Log = function(m) logs[#logs + 1] = m end,
    Find = function(class)
        local l, k = {}, {}
        for i, w in ipairs(class == "WBP_HUD_QuestListItem_C" and items or entries) do l[i], k[i] = w, w.name end
        return l, k
    end,
    Font = function() return fonts and "body" end, TitleFont = function() return fonts and "title" end,
    Line = function() return "T_Trim_Line_Gold" end, G = function(name) return name end,
    GoldLine = { Row = function(make, tex, name) local r = make("HorizontalBox", name .. "Row") r.tex = tex return r end } }
local function Step() clock = clock + 1.1 M.Tick(ctx) end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end

fonts = false
Step()
check("no font found yet: nothing is dressed, no Sig", items[1].Background.op == 1 and items[1].QuestTitle.font == nil and M.Sig == nil)
fonts = true
Step()
local item, entry = items[1], entries[1]
check("the dark band is unseen", item.Background.op == 0)
local c = item.column.kids
check("our gold line sits between the name and the steps, the game's underline collapsed", #c == 4 and c[2] == item.Seperator and item.Seperator.vis == 1
    and c[3].height == 9 and c[3].content.tex == "T_Trim_Line_Gold" and c[3].Slot.Padding.Top == 4 and c[4] == item.steps)
check("the steps keep their padding and alignment", item.steps.Slot.Padding.Top == 5 and item.steps.Slot.HorizontalAlignment == 2)
check("the name in normal case, its letters not spread", item.QuestTitle.policy == 0 and item.QuestTitle.Font.LetterSpacing == 0)
check("the name is gold, in the title font, with the shadow", item.QuestTitle.colour.G == 0.638 and item.QuestTitle.font == "title" and item.QuestTitle.offset == 1.5 and item.QuestTitle.shade == 0.85)
check("the step is white, in the body font, with the shadow", entry.SubobjectiveDescription.colour.B == 1 and entry.SubobjectiveDescription.font == "body" and entry.SubobjectiveDescription.offset == 1.5)
Step() Step()
check("each widget is dressed once, one line only", item.QuestTitle.fontSets == 2 and entry.SubobjectiveDescription.fontSets == 1 and #item.column.kids == 4)
local first = M.Sig
check("Sig holds the name and the step", first ~= nil and first:find("Quest A", 1, true) and first:find("Find the key", 1, true))
Step()
check("the same texts: the same Sig", M.Sig == first)
entry.SubobjectiveDescription.text = "Open the door"
Step()
check("a new step: Sig changes", M.Sig ~= first)
local second = Entry("Talk to Bob")
entries[2] = second
Step()
check("a new entry is dressed, the old one not again", second.SubobjectiveDescription.font == "body" and entry.SubobjectiveDescription.fontSets == 1)
check("a new entry: Sig changes", M.Sig:find("Talk to Bob", 1, true) ~= nil)
items[1] = nil entries = {}
Step()
check("no quest left: no Sig, so nothing wakes the HUD", M.Sig == nil)
check("nothing went wrong", #logs == 0)
local lone = W({ Background = W({ op = 1 }), QuestTitle = Text("Quest B") })
items[1] = lone   -- a game patch took the line away
Step()
check("a part that is missing: the rest is dressed, no error", lone.Background.op == 0 and lone.QuestTitle.font == "title" and #logs == 0)
M.Forget()
check("a new world: no Sig left", M.Sig == nil)
items[1] = item
Step()
check("and a widget is dressed again, its line not twice", item.QuestTitle.fontSets == 4 and M.Sig ~= nil and #item.column.kids == 4)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

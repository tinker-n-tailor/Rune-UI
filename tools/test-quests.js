// Tests the quests panel (quests.lua) against a fake panel named as the game's (seen in the game, 02-10-2026): the row's
// master copy gets the HUD font and the shadow; every text under the panel gets them once (the walk of letters.lua),
// rich text with its own setters and the size of its style in use, the key letters not; nothing before the font is
// found; a new text the game adds later is styled on the next walk; a new world styles again. An unlock row has the sparks of a
// new item: its loose sparks (Embers_Box) are switched off once for each row, also before the font is found, the sparks' box
// is found by name (it comes last in one row and first in another), and a refused call is logged once.
// Needs npm install once. Run: node tools/test-quests.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'quests.lua'), 'utf8');
const letters = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'letters.lua'), 'utf8');
const embers = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'embers.lua'), 'utf8');
const test = `
local sets = 0
local api = {}
api.__index = api
function api:IsValid() return not self.invalid end
function api:GetNiagaraComponent() return self.comp end
function api:SetEmitterEnable(name, on) if self.throws then error("refused") end self.calls[#self.calls + 1] = name .. ":" .. tostring(on) end
function FName(s) return s end
function api:GetFName() return { ToString = function() return self.name end } end
function api:GetClass() return { GetFName = function() return { ToString = function() return self.cls end } end } end
function api:GetFullName() return self.cls .. " /Engine/Transient." .. self.name end
function api:GetChildrenCount() if not self.kids then error("not a panel") end return #self.kids end
function api:GetChildAt(i) return self.kids[i + 1] end
function api:GetContent() return self.content end
function api:SetFont(f) self.font = f.FontObject sets = sets + 1 end
function api:SetShadowOffset(o) self.offset = o.X end
function api:SetShadowColorAndOpacity(c) self.shade = c.A end
function api:SetDefaultFont(f) self.font = f.FontObject self.size = f.Size sets = sets + 1 end
function api:SetDefaultShadowOffset(o) self.offset = o.X end
function api:SetDefaultShadowColorAndOpacity(c) self.shade = c.A end
local function W(name, cls, kids)
    return setmetatable({ name = name, cls = cls, kids = kids, Font = { Size = 12 }, DefaultTextStyleOverride = { Font = { Size = 10 } } }, api)
end
local title = W("TitleText", "WBP_DomTextBlock_C")
local perk = W("PerkDescriptionText", "DomRichTextBlock")
perk.bOverrideDefaultStyle, perk.DefaultTextStyle = false, { Font = { Size = 9 } }   -- the style in use, not the override
local label = W("LabelText", "TextBlock")
local key = W("KeyText", "TextBlock")
local slotText = W("SlotText", "WBP_DomTextBlock_C")
local prompt = W("PromptInput", "WBP_InputLegend_InputEntry_C")
prompt.WidgetTree = { RootWidget = W("HorizontalBox_0", "HorizontalBox", { label, W("Key", "WBP_DomInputIconWidget_C") }) }
prompt.WidgetTree.RootWidget.kids[2].WidgetTree = { RootWidget = W("Overlay_42", "Overlay", { key }) }
-- an unlock row: SizeBox_0 > Overlay_1 > [..., SizeBox_2 > the sparks]; the box comes last here and first in a later row
local function Row(name, text, boxFirst)
    local row = W(name, "WBP_QuestAndUnlocks_Item_Slot_C")
    local nia = W("NS_UI_NewItemFound", "NiagaraSystemWidget")
    nia.comp = setmetatable({ calls = {} }, api)
    local box = W("SizeBox_2", "SizeBox", { nia })
    local overlay = W("Overlay_1", "Overlay", boxFirst and { box, text } or { text, box })
    row.WidgetTree = setmetatable({ RootWidget = W("SizeBox_0", "SizeBox", { overlay }) }, api)
    row.WidgetTree.RootWidget.content = overlay
    row.nia = nia
    return row
end
local row = Row("Row_1", slotText)
local rows = W("UnlockedItemBox", "VerticalBox", { row })
local entry = W("Entry_1", "WBP_QuestAndUnlocks_Item_C")
entry.WidgetTree = { RootWidget = W("RootBox", "SizeBox") }
entry.WidgetTree.RootWidget.content = W("UnlockedBox", "VerticalBox", { title, rows, perk, prompt })
local queue = W("Queue_1", "WBP_QuestAndUnlocks_C")
queue.WidgetTree = { RootWidget = W("NotificationQueueWidget", "WBP_Notifications_VerticalPanelContainer_C") }
queue.WidgetTree.RootWidget.WidgetTree = { RootWidget = W("NotificationQueueWidget", "VerticalBox", { entry }) }
local master = W("SlotText", "WBP_DomTextBlock_C")
function StaticFindObject(p) if p:find("WBP_QuestAndUnlocks_Item_Slot_C:WidgetTree.SlotText", 1, true) then return master end end
local clock, logs, font = 0, {}, nil
os.clock = function() return clock end
local M = load(SRCTEXT)()
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, Font = function() return font end, Embers = load(EMBERS)(),
    Find = function(class)
        if class == "WBP_QuestAndUnlocks_Item_Slot_C" then
            local list, keys = {}, {}
            for i, r in ipairs(rows.kids) do list[i], keys[i] = r, "Transient." .. r.name end
            return list, keys
        end
        return { queue }, { "Transient.Queue_1" }
    end, Collect = load(LETTERS)().Collect }
local function Step() clock = clock + 0.6 M.Tick(ctx) end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end

Step()
check("no font found yet: nothing styled", sets == 0)
check("but the sparks of the unlock row are done at once: Embers_Box off, once", #row.nia.comp.calls == 1 and row.nia.comp.calls[1] == "Embers_Box:false"
    and #logs == 1 and logs[1]:find("unlocks: Embers_Box (the loose sparks) is off, the streaks stay", 1, true) == 1)
font = "Poppins"
Step()
check("the row's master copy: the HUD font and the shadow", master.font == "Poppins" and master.offset == 1.5 and master.shade == 0.85)
check("the title, the row and the key row's words", title.font == "Poppins" and slotText.font == "Poppins" and label.font == "Poppins"
    and title.offset == 1.5 and label.shade == 0.85)
check("the description with the rich text setters, at the size of its style", perk.font == "Poppins" and perk.offset == 1.5 and perk.size == 9)
check("the key letters stay the game's", key.font == nil)
check("the size stays the game's", title.Font.Size == 12)
local before = sets
Step()
check("each text once, the sparks once", sets == before and #row.nia.comp.calls == 1)
local second = W("SlotText_2", "WBP_DomTextBlock_C")
row.WidgetTree.RootWidget.content.kids[3] = second   -- the game adds a text
Step()
check("not before the next walk", second.font == nil)
clock = clock + 5
Step()
check("a text added later is styled on the next walk", second.font == "Poppins" and sets == before + 1)
-- a row that the game makes for a new notice, the sparks' box first in it: set at the next look
local row2 = Row("Row_2", W("SlotText_3", "WBP_DomTextBlock_C"), true)
rows.kids[#rows.kids + 1] = row2
Step()
check("a new row: its sparks off at the next look, the first row's not again", #row2.nia.comp.calls == 1 and #row.nia.comp.calls == 1)
M.Forget()
before = sets
Step()
check("a new world styles everything again: the master copy and six texts, the sparks of both rows", sets == before + 7 and #row.nia.comp.calls == 2 and #row2.nia.comp.calls == 2)
check("the log: one line per world that the sparks are set, no failure", #logs == 2 and logs[2] == logs[1])

-- a refused call: one log line, the font work goes on; the next look tries again
M.Forget()
logs = {}
local row3 = Row("Row_3", W("SlotText_4", "WBP_DomTextBlock_C"))
row3.nia.comp.throws = true
rows.kids = { row3 }
Step() Step()
check("a refused call: one log line with the reason, the master copy is styled", #logs == 1 and logs[1]:find("is not off yet: ", 1, true) and logs[1]:find("refused", 1, true) and master.font == "Poppins")
row3.nia.comp.throws = false
row3.nia.comp.invalid = true
Step()
check("a component that is not valid is waited for: its reason is a new one, logged once", #row3.nia.comp.calls == 0 and #logs == 2)
Step() Step()
check("and not logged again", #logs == 2)
row3.nia.comp.invalid = false
Step()
check("then set once", #row3.nia.comp.calls == 1 and #logs == 3)

-- a fresh row with no tree yet: no call on it, tried again, one log line for that reason; a real failure after it still logs
M.Forget()
logs = {}
local row4 = Row("Row_4", W("SlotText_5", "WBP_DomTextBlock_C"))
local tree4 = row4.WidgetTree
row4.WidgetTree = nil
rows.kids = { row4 }
Step() Step()
check("no tree yet: no failure, one log line", #row4.nia.comp.calls == 0 and #logs == 1 and logs[1]:find("the row has no tree yet", 1, true))
row4.WidgetTree = setmetatable({ RootWidget = W("SizeBox_0", "SizeBox", { W("Overlay_1", "Overlay", {}) }) }, api)
Step()
check("the tree comes without the box: a different reason, logged once", #logs == 2 and logs[2]:find("no SizeBox_2 in the row", 1, true))
row4.WidgetTree = tree4
Step()
check("then the box is there: set", #row4.nia.comp.calls == 1 and #logs == 3)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(letters)); lua.lua_setglobal(L, to_luastring('LETTERS'));
lua.lua_pushstring(L, to_luastring(embers)); lua.lua_setglobal(L, to_luastring('EMBERS'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

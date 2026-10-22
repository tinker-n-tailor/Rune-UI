// Tests the notice preview of the editor (notices.lua) against fake entries named as the game's (probes N1 and N2,
// 05-10-2026): a selected row shows its entry with sample texts; another row or the close of the editor writes
// everything back; an entry the game took for a real notice (visibility 3, probe Q1) is left alone; a respawn
// restores, a new world drops everything without a call.
// Needs npm install once. Run: node tools/test-notices.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'notices.lua'), 'utf8');
const test = `
local calls = 0
function FText(s) return { s = s, ToString = function() return s end } end
local api = {}
api.__index = api
function api:IsValid() return self.alive ~= false end
function api:GetFName() return { ToString = function() return self.name end } end
function api:GetVisibility() return self.vis end
function api:GetRenderOpacity() return self.op end
function api:SetVisibility(v) calls = calls + 1 self.vis = v end
function api:SetRenderOpacity(o) calls = calls + 1 self.op = o end
function api:GetChildrenCount() return #self.kids end
function api:GetChildAt(i) return self.kids[i + 1] end
function api:GetActiveWidgetIndex() return self.idx end
function api:SetActiveWidgetIndex(i) calls = calls + 1 self.idx = i end
function api:SetColorAndOpacity(c) calls = calls + 1 self.colour = c end
function api:SetRenderTranslation(v) calls = calls + 1 self.shift = v end
function api:GetText() return self.text end
function api:SetText(t) calls = calls + 1 self.text = t end
local function W(name, f) f = f or {} f.name = name return setmetatable(f, api) end
local function Item(vis, op)
    return setmetatable({ vis = vis or 1, op = op or 0 }, api)
end
local function Text(s) return W("t", { text = FText(s) }) end
local function Primary()
    local names = { "AchievementNotificationItem", "LevelUpNotificationItem", "NewSkillNotificationItem",
        "MilestoneMaterialNotificationItem", "FishCaughtNotificationItem", "ArenaNotificationItem",
        "LevelUpVendorNotificationItem", "FinalBossExtractionPointUnlockNotificationItem", "FinalBossDefeatedNotificationItem" }
    local kids = {}
    for i, n in ipairs(names) do kids[i] = W(n) end
    local sw = W("Switcher", { kids = kids, idx = 0 })
    local p = Item(1, 1)
    p.WidgetTree = W("Tree", { RootWidget = sw })
    return p, sw
end

local upkeep = Item(1, 0)
local tips = Item(1, 0)
tips.TitleTextBlock, tips.BodyTextBlock = Text("Tutorial Title"), Text("Lorem ipsum")
local quests = Item(1, 1)
local status = Item(1, 1)
status.ColorAndOpacity = { R = 0.2, G = 0.4, B = 0.6, A = 0 }
local band = Item(1, 0)
local pickups, pickups2 = Item(1, 0), Item(1, 0)
pickups.RenderTransform = { Translation = { X = 400, Y = 0 } }
pickups.CommonLazyImage_83 = band
pickups.ItemText, pickups.ItemCountText = Text(""), Text("")
pickups2.RenderTransform = { Translation = { X = 400, Y = 0 } }
local primary, sw = Primary()
local byClass = {
    WBP_PlayerUpkeepNotification_Item_C = upkeep, WBP_TutorialNotifications_Item_C = tips,
    WBP_QuestAndUnlocks_Item_C = quests,
    WBP_PrimaryNotificationQueue_Item_C = primary, WBP_EnvAndPlayerStatus_Item_C = status,
}
local pickupList = { pickups, pickups2 }
local selected, clock, logs = nil, 0, {}
os.clock = function() return clock end
local M = load(SRCTEXT)()
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, Selected = function() return selected end,
    Find = function(cls) if cls == "WBP_ItemPickups_Item_C" then return pickupList, {} end local w = byClass[cls] return w and { w } or {}, {} end }
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function Rest(w, vis, op) return w.vis == vis and w.op == op end

M.Tick(ctx)
check("editor closed: no call", calls == 0)

selected = "upkeep"
M.Tick(ctx)
check("upkeep row: its entry shows", Rest(upkeep, 4, 1))
check("upkeep row: the others stay", Rest(tips, 1, 0) and Rest(quests, 1, 1) and Rest(primary, 1, 1))

selected = "tips"
M.Tick(ctx)
check("another row: the first entry is back", Rest(upkeep, 1, 0))
check("tips row: shown with sample texts", Rest(tips, 4, 1) and tips.TitleTextBlock.text.s == "Tutorial tip"
    and tips.BodyTextBlock.text.s == "A tip of the game shows here.")

selected = "quests"
M.Tick(ctx)
check("tips are back with their own texts", Rest(tips, 1, 0) and tips.TitleTextBlock.text.ToString() == "Tutorial Title"
    and tips.BodyTextBlock.text.ToString() == "Lorem ipsum")
check("quests row: its entry shows", Rest(quests, 4, 1))

selected = "levelup"
M.Tick(ctx)
check("level up row: the primary entry on its page", Rest(primary, 4, 1) and sw.idx == 1)
selected = "area"
M.Tick(ctx)
check("new area row: the other page, the first page's work undone", sw.idx == 0 and Rest(primary, 4, 1) and Rest(quests, 1, 1))

selected = nil
M.Tick(ctx)
check("editor closed: the entry is back, with its page", Rest(primary, 1, 1) and sw.idx == 0)
local before = calls
M.Tick(ctx)
check("idle again: no call", calls == before)

sw.idx = 3   -- a page of its own at rest, to see that the old index is kept
selected = "levelup"
M.Tick(ctx)
selected = nil
M.Tick(ctx)
check("the active index is written back", sw.idx == 3)

-- a real notice plays: not collapsed, not ours
upkeep.vis, upkeep.op = 3, 0.6
selected = "upkeep"
before = calls
M.Tick(ctx)
check("an entry that is not collapsed is left alone", calls == before and Rest(upkeep, 3, 0.6))
selected = nil
M.Tick(ctx)
check("and stays so after the editor closes", calls == before and Rest(upkeep, 3, 0.6))
upkeep.vis, upkeep.op = 1, 0

-- the banners row goes through its pages
sw.idx = 0
selected = "banners"
M.Tick(ctx)
check("banners: the first page is new skill", sw.idx == 2 and Rest(primary, 4, 1))
clock = 1
M.Tick(ctx)
check("banners: no change before 2 s", sw.idx == 2)
clock = 2.1
M.Tick(ctx)
check("banners: the next page after 2 s", sw.idx == 3)
for _ = 1, 6 do clock = clock + 2.1 M.Tick(ctx) end
check("banners: seven pages, then round again", sw.idx == 2)
selected = nil
M.Tick(ctx)
check("banners: the index is back and the entry hidden", sw.idx == 0 and Rest(primary, 1, 1))

-- the group
selected = "notify"
M.Tick(ctx)
check("group: all queues show", Rest(upkeep, 4, 1) and Rest(tips, 4, 1) and Rest(quests, 4, 1)
    and Rest(primary, 4, 1) and sw.idx == 1)
check("group: sample texts", tips.TitleTextBlock.text.s == "Tutorial tip")
selected = nil
M.Tick(ctx)
check("group: all back", Rest(upkeep, 1, 0) and Rest(tips, 1, 0) and Rest(quests, 1, 1)
    and Rest(primary, 1, 1) and sw.idx == 0)

-- a respawn restores, a new world calls nothing
selected = "upkeep"
M.Tick(ctx)
M.Forget(true)
check("same world: restored", Rest(upkeep, 1, 0))
M.Tick(ctx)
check("same world: shown again while the row stays selected", Rest(upkeep, 4, 1))
before = calls
M.Forget(false)
check("new world: no call on the old widgets", calls == before and Rest(upkeep, 4, 1))
selected = nil
M.Tick(ctx)
check("new world: nothing remembered", calls == before)

-- an invalid entry
selected = "upkeep"
M.Tick(ctx)
upkeep.alive = false
before = calls
M.Tick(ctx)
selected = nil
M.Tick(ctx)
check("an invalid entry gets no call", calls == before)
upkeep.alive = true
selected = "tips"
tips.alive = false
M.Tick(ctx)
check("an invalid entry is not shown", calls == before)
tips.alive = true

-- the colour, the translation and the band
selected = "status"
M.Tick(ctx)
check("status: visible, opaque, colour alpha 1 with the same R, G, B", Rest(status, 4, 1) and status.colour.A == 1
    and status.colour.R == 0.2 and status.colour.G == 0.4 and status.colour.B == 0.6)
selected = nil
M.Tick(ctx)
check("status: the remembered colour is back", Rest(status, 1, 1) and status.colour.A == 0 and status.colour.B == 0.6)
selected = "pickups"
M.Tick(ctx)
check("pickups: shown, at home, the band left as pickups.lua has it", Rest(pickups, 4, 1) and pickups.shift.X == 0 and Rest(band, 1, 0))
check("pickups: only the first collapsed one", Rest(pickups2, 1, 0) and pickups2.shift == nil)
check("pickups: a sample name and count, so the row is not empty", pickups.ItemText.text.s == "Bronze Pickaxe" and pickups.ItemCountText.text.s == "x1")
selected = nil
M.Tick(ctx)
check("pickups: the values are back", Rest(pickups, 1, 0) and pickups.shift.X == 400 and Rest(band, 1, 0))
check("pickups: the old texts are back", pickups.ItemText.text.ToString() == "" and pickups.ItemCountText.text.ToString() == "")
pickups.vis = 3   -- a real pick-up plays on the first one: the next one shows
selected = "pickups"
M.Tick(ctx)
check("pickups: a playing one is skipped, the next collapsed one shows", Rest(pickups2, 4, 1) and Rest(pickups, 3, 0))
selected = nil
M.Tick(ctx)
pickups.vis, pickups.op = 1, 0
selected = "notify"
M.Tick(ctx)
check("group has status and pickups too", Rest(status, 4, 1) and Rest(pickups, 4, 1))
selected = nil
M.Tick(ctx)
check("group: status and pickups back", Rest(status, 1, 1) and status.colour.A == 0 and Rest(pickups, 1, 0) and pickups.shift.X == 400)

-- a real notice takes a previewed entry: the game sets another visibility, and nothing is written over it
selected = "upkeep"
M.Tick(ctx)
upkeep.vis, upkeep.op = 3, 0.7
before = calls
selected = nil
M.Tick(ctx)
check("an entry the game took is not written back", calls == before and Rest(upkeep, 3, 0.7))
upkeep.vis, upkeep.op = 1, 0
selected = "banners"
M.Tick(ctx)
primary.vis = 3
before = calls
clock = clock + 2.1
M.Tick(ctx)
check("banners: no page step under a real notice", calls == before)
primary.vis = 1
clock = clock + 1.1
M.Tick(ctx)
check("and the preview comes back when the game collapsed the entry", Rest(primary, 4, 1))
selected = nil
M.Tick(ctx)
-- the first answer for a class can be empty: the row looks again
local held = byClass.WBP_TutorialNotifications_Item_C
byClass.WBP_TutorialNotifications_Item_C = nil
selected = "tips"
M.Tick(ctx)
check("no entry yet: nothing shows", Rest(tips, 1, 0))
byClass.WBP_TutorialNotifications_Item_C = held
clock = clock + 0.5
M.Tick(ctx)
check("not asked again before a second", Rest(tips, 1, 0))
clock = clock + 0.6
M.Tick(ctx)
check("found on the next look: it shows", Rest(tips, 4, 1))
before = calls
clock = clock + 1.1
M.Tick(ctx)
check("an entry that shows is not shown twice", calls == before)
selected = nil
M.Tick(ctx)
check("and it goes back", Rest(tips, 1, 0))

check("the log: no failure", #logs == 0)
print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

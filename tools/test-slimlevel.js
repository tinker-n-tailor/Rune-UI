// Tests the slim level up in xp.lua against stand-ins for the game's objects: the game's banner is hidden by its parts
// and never by the root's opacity (the signal that the notice is on show), the row shows the skill, "Level N" and the
// level while the game's opacity is above zero, with a soft entrance and exit, and everything is put back when the
// switch or Rune XP goes off.
// Needs fengari. Run: node tools/test-slimlevel.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const chain = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'chain.lua'), 'utf8');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'xp.lua'), 'utf8');
const test = `
local M = load(SRCTEXT)()
local function check(name, cond) if not cond then error("FAIL " .. name, 2) end print("ok   " .. name) end

local now = 0
os.clock = function() return now end
collectgarbage = function() return 0 end   -- fengari has no collector
FText = function(s) return s end
FName = function(s) return s end
local Any
local function Dummy() return setmetatable({}, { __index = function() return Any end, __newindex = function() end, __call = function() return Any end }) end
Any = Dummy()
StaticFindObject = function() return Any end
local made = {}
local Widget = {}
Widget.__index = function(t, k)
    if k == "IsValid" then return function() return true end end
    if k == "Text" or k == "Op" then return nil end
    if k == "SetText" then return function(self, s) self.Text = s end end
    if k == "SetRenderOpacity" then return function(self, o) self.Op = o end end
    if k == "Scale" then return nil end
    if k == "SetRenderScale" then return function(self, s) self.Scale = s.X end end
    return Any
end
StaticConstructObject = function(_, _, name)
    local w = setmetatable({ Name = name }, Widget)
    made[name] = w
    return w
end

-- the game's level up widget: its opacity is the game's own, and writing it is an error
local opacity, writes = 0, {}
local function Part(name)
    return { IsValid = function() return true end, RenderTransform = { Scale = { X = 1, Y = 1 } },
        SetRenderScale = function(_, s) writes[#writes + 1] = { name, s.X, s.Y } end }
end
local iconName = "T_Icon_Tag_Skill_Runecrafting"
local tex = { IsValid = function() return true end, GetFName = function() return { ToString = function() return iconName end } end }
local level = { IsValid = function() return true end, GetRenderOpacity = function() return opacity end,
    SetRenderOpacity = function() error("the root's opacity must not be written") end,
    SkillIconImage = Part("SkillIconImage"), LevelTextBlock = Part("LevelTextBlock") }
level.SkillIconImage.Brush = { ResourceObject = tex }
level.LevelTextBlock.GetText = function() return { ToString = function() return "21" end } end
for _, n in ipairs({ "LevelUpOverlay", "IconOverlay", "LevelUpTextBackground", "LevelUpTextBackgroundFrame", "LevelUpTextBackgroundShadow", "InputEntryWidget" }) do
    level[n] = Part(n)
end
-- the two spark effects: the mod collapses them (visibility 1) and shows them again (visibility 0)
for _, n in ipairs({ "NS_UI_LevelUpUpper", "NS_UI_LevelUpLower" }) do
    level[n] = Part(n)
    level[n].SetVisibility = function(_, v) writes[#writes + 1] = { n .. " visibility", v } end
end

local bars = setmetatable({}, Widget)
local on, slim, logs = true, true, {}
local vitals = { Instances = { bars }, Keys = { "vitals-key" } }
local levelup = { Instances = { level }, Keys = { "/Game/x.WBP_PrimaryNotificationQueue_Item_C_1.WidgetTree_1.LevelUpNotificationItem" } }
-- the game's XP box is always there in a world, with its circles collapsed while no XP notice shows
local function Valid() return true end
-- one object stands in for the notice's icon, its text and its ring: the texture's name, "+ 13 XP" and the progress
local xpVis = 1   -- 1: collapsed; 0: an XP notice is on show
local xpRes = { IsValid = Valid, GetFName = function() return { ToString = function() return "T_Notification_Skill_Woodcutting" end } end,
    GetClass = function() return { GetFName = function() return { ToString = function() return "MaterialInstanceDynamic" end } end } end,
    ScalarParameterValues = { ForEach = function(_, fn)
        fn(1, { get = function() return { ParameterInfo = { Name = { ToString = function() return "FillBar" end } }, ParameterValue = 0.4 } end })
    end } }
local xpPart = { IsValid = Valid, Brush = { ResourceObject = xpRes }, GetText = function() return { ToString = function() return "+ 13 XP" end } end }
local xpItem = { IsValid = Valid, GetVisibility = function() return xpVis end }
local xpGrid = { IsValid = Valid, GetChildrenCount = function() return 1 end, SetRenderScale = function() end,
    GetChildAt = function() return { IsValid = Valid, GetContent = function() return xpItem end } end }
local xpBox = { Instances = { { IsValid = Valid, GetAddress = function() return 7 end, WidgetTree = { RootWidget = xpGrid } } }, Keys = { "xp-key" } }
local ctx = { Chain = load(CHAINTEXT)(), Log = function(m) logs[#logs + 1] = m end, G = function(n) return n end, ClearOurs = function() end,
    Asset = function() return Any end, Font = function() return nil end, MayTry = function() return true end, Failed = function() end,
    GoldLine = { PATH = "x", Row = function() return Any end }, Trim = function() return nil end,
    Find = function() return xpPart end,
    On = function() return on end, Slim = function() return slim end,
    ById = function(id)
        if id == "vitals" then return vitals end
        if id == "levelup" then return levelup end
        if id == "xp" then return xpBox end
        return { Instances = {}, Keys = {} }
    end }

local function Tick(seconds) now = now + seconds M.Tick(ctx) end
local function Last(name) for i = #writes, 1, -1 do if writes[i][1] == name then return writes[i][2] end end end
local function Count(name, x) local n = 0 for _, w in ipairs(writes) do if w[1] == name and (x == nil or w[2] == x) then n = n + 1 end end return n end
M.Forget(false)
Tick(0.2)
check("built", made.RU_XpRowBox ~= nil)
Tick(0.2)
check("the banner's parts are unseen from the start, scale 0", Count("LevelUpOverlay", 0) == 1 and Count("InputEntryWidget", 0) == 1 and Count("IconOverlay", 0) == 1)
check("idle: the level text and the icon are not read, the row stays unseen", made.RU_XpName.Text == "" and made.RU_XpRowBox.Op == 0)
local before = #writes
Tick(0.2)
check("parts are not written at every look", #writes == before)
Tick(0.4)
check("the parts are written again after a while, in case the game scales them back", #writes > before)

opacity = 0.17
Tick(0.2)
check("on show: the skill's name in capitals", made.RU_XpName.Text == "RUNECRAFTING")
check("on show: Level N, no XP text", made.RU_XpLevel.Text == "Level 21" and made.RU_XpGain.Text == "")

for _ = 1, 8 do Tick(0.05) end
check("on show: the row is seen", made.RU_XpRowBox.Op == 1)
opacity = 1
for _ = 1, 40 do Tick(0.05) end
check("the row stays while the game shows the notice", made.RU_XpRowBox.Op == 1)
check("a level up is big: the row and the lines", made.RU_XpRowBox.Scale > 1.3 and made.RU_XpTrackBox.Scale > 1.3 and made.RU_XpFillBox.Scale > 1.3)
check("a level up: the line under the fill is bright", made.RU_XpTrackBox.Op == 1)
opacity = 0
for _ = 1, 60 do Tick(0.05) end
check("after the notice the row fades", made.RU_XpRowBox.Op == 0)
check("and it is back at the plain size", made.RU_XpRowBox.Scale == 1 and made.RU_XpTrackBox.Scale == 1)
check("the sparks of the banner are unseen: each is collapsed", Count("NS_UI_LevelUpUpper visibility", 1) >= 1 and Count("NS_UI_LevelUpLower visibility", 1) >= 1)
check("the sparks' own scale is not written: it does not hide them", Count("NS_UI_LevelUpUpper") == 0 and Count("NS_UI_LevelUpLower") == 0)

-- the entrance and the exit move at every frame (1/60 s), softly: the size eases down, the opacity eases up, and
-- on the way out the size does not snap while the row can be seen
level.LevelTextBlock.GetText = function() return { ToString = function() return "22" end } end
local sizes, ops = {}, {}
opacity = 1
for i = 1, 90 do Tick(1 / 60) sizes[i], ops[i] = made.RU_XpRowBox.Scale, made.RU_XpRowBox.Op end
check("a second level up: Level 22", made.RU_XpLevel.Text == "Level 22")
local first
for i = 1, #sizes do if ops[i] and ops[i] > 0 and not first then first = i end end
check("the entrance starts", first ~= nil and sizes[first] > 1.7)
local moving, rising, worst, steps = 0, true, 0, 0
for i = first + 1, first + 18 do
    if sizes[i] ~= sizes[i - 1] then moving = moving + 1 end
    if sizes[i] > sizes[i - 1] + 1e-9 or ops[i] < ops[i - 1] - 1e-9 then rising = false end
    steps = math.max(steps, math.abs(sizes[i] - sizes[i - 1]))
    worst = math.max(worst, ops[i] - ops[i - 1])
end
check("the size moves at every frame, not at every look", moving >= 15)
check("the size only goes down and the opacity only up", rising)
check("no jump between two frames: size " .. steps .. ", opacity " .. worst, steps < 0.06 and worst < 0.15)
check("the opacity is full within the first third of a second", ops[first + 20] == 1)
check("it rests on the big size, 1.6", sizes[#sizes] == sizes[#sizes - 1] and math.abs(sizes[#sizes] - 1.6) < 1e-9)
local big = sizes[#sizes]
opacity = 0
local out, outOps, snap, prev = {}, {}, 0, big
for i = 1, 90 do
    Tick(1 / 60)
    local s, o = made.RU_XpRowBox.Scale, made.RU_XpRowBox.Op
    if o > 0 then
        snap = math.max(snap, math.abs(s - prev))
        assert(s == big, "the size stays while it can be seen: " .. s .. " at opacity " .. o)
    end
    prev = s
end
check("the fade: the size stayed while it was seen", snap == 0)
check("then it is gone and back at the plain size", made.RU_XpRowBox.Op == 0 and made.RU_XpRowBox.Scale == 1)

-- a level up mostly comes over an XP notice that is on show, and the XP notice takes the row back after it: the row
-- can be seen all the time, so the size and the line's brightness must never jump (in game, 04-10-2026)
local function Walk(seconds)   -- the largest change of the size and of the line's opacity between two frames
    local size, line = 0, 0
    for _ = 1, math.floor(seconds * 60 + 0.5) do
        local s, t = made.RU_XpRowBox.Scale, made.RU_XpTrackBox.Op
        Tick(1 / 60)
        assert(made.RU_XpRowBox.Op > 0.3, "the row stays on show")
        size, line = math.max(size, math.abs(made.RU_XpRowBox.Scale - s)), math.max(line, math.abs(made.RU_XpTrackBox.Op - t))
    end
    return size, line
end
xpVis = 0
for _ = 1, 60 do Tick(1 / 60) end
check("an XP notice: the row at the plain size, the line dim", made.RU_XpGain.Text == "+13 XP" and made.RU_XpRowBox.Op == 1 and made.RU_XpRowBox.Scale == 1 and made.RU_XpTrackBox.Op < 0.5)
opacity = 1
local up, upLine = Walk(1)
check("a level up over it: Level 22, big, the line bright", made.RU_XpLevel.Text == "Level 22" and math.abs(made.RU_XpRowBox.Scale - 1.6) < 1e-9 and made.RU_XpTrackBox.Op == 1)
check("it grew with no jump: size " .. up .. ", line " .. upLine, up < 0.04 and upLine < 0.05)
opacity = 0
local down, downLine = Walk(1)
check("the XP notice has the row again, at the plain size, the line dim", made.RU_XpGain.Text == "+13 XP" and made.RU_XpRowBox.Scale == 1 and made.RU_XpTrackBox.Op < 0.5)
check("it went back with no jump: size " .. down .. ", line " .. downLine, down < 0.04 and downLine < 0.05)
xpVis = 1
for _ = 1, 120 do Tick(1 / 60) end
check("the XP notice went: the row is gone", made.RU_XpRowBox.Op == 0)
-- a level up alone, and the next XP comes a third of a second into its fade
opacity = 1
for _ = 1, 90 do Tick(1 / 60) end
opacity = 0
for _ = 1, 20 do Tick(1 / 60) end
xpVis = 0
down, downLine = Walk(1)
-- the line also fades in with the row here, so its opacity may move more in a frame than in the two walks above
check("an XP notice in the level up's fade: back to the plain size, the size with no jump: size " .. down .. ", line " .. downLine,
    made.RU_XpRowBox.Scale == 1 and down < 0.04 and downLine < 0.1)
xpVis = 1
for _ = 1, 120 do Tick(1 / 60) end

-- in the game the mod steps about 16 times a second: while a level up changes size, the chain of delayed calls
-- (ctx.Soon) paints between two steps, one chain at a time, and it ends by itself
local queue, most, calls, moved = {}, 0, 0, 0
ctx.Soon = function(_, fn) queue[#queue + 1] = fn end
local function Run(seconds)   -- a step every 0.06 s, and the chain's calls every 0.01 s between two steps
    for _ = 1, math.floor(seconds / 0.06 + 0.5) do
        Tick(0.01)
        for _ = 1, 5 do
            now = now + 0.01
            most = math.max(most, #queue)
            local run = queue
            queue = {}
            for _, fn in ipairs(run) do
                local was, wasOp = made.RU_XpRowBox.Scale, made.RU_XpRowBox.Op
                fn()
                calls = calls + 1
                if made.RU_XpRowBox.Scale ~= was or made.RU_XpRowBox.Op ~= wasOp then moved = moved + 1 end
            end
        end
    end
end
level.LevelTextBlock.GetText = function() return { ToString = function() return "23" end } end
opacity = 1
Run(0.72)
check("slow steps: the chain painted the pop between them, " .. moved .. " times", made.RU_XpLevel.Text == "Level 23" and moved >= 15)
Run(1.2)
check("at rest on the big size the chain has ended", #queue == 0 and made.RU_XpRowBox.Op == 1)
local atRest = calls
Run(0.6)
check("and no call comes while it rests", calls == atRest)
-- an XP notice takes the row from the level up: the chain paints the way back to the plain size too
xpVis, opacity, moved = 0, 0, 0
Run(0.48)
check("slow steps: the chain painted the way back to the XP row, " .. moved .. " times", made.RU_XpGain.Text == "+13 XP" and made.RU_XpRowBox.Scale == 1 and moved >= 15)
Run(0.6)
check("at rest on the plain size the chain has ended", #queue == 0 and made.RU_XpRowBox.Op == 1)
-- and a level up over that XP row: the chain paints the way up
opacity, moved = 1, 0
Run(0.6)
check("slow steps: the chain painted the way up from the XP row, " .. moved .. " times", math.abs(made.RU_XpRowBox.Scale - 1.6) < 1e-9 and moved >= 15)
xpVis, opacity, moved = 1, 0, 0
Run(1.5)
check("the fade is painted by the chain too, " .. moved .. " times", moved >= 20)
check("it ends when the row is gone", #queue == 0 and made.RU_XpRowBox.Op == 0 and made.RU_XpRowBox.Scale == 1)
check("one chain at a time", most == 1)
-- a stall of more than a second: the chain is taken as lost and a new one starts; the call still queued from the old one
-- does nothing, so two chains never go on together
opacity = 1
ctx.Soon = function(_, fn) queue[#queue + 1] = fn end
Run(0.3)
check("stall: one chain is running", #queue == 1)
now = now + 2.5
opacity = 0   -- the notice goes while the game stalls: the row fades out, which the chain paints
Tick(0.01)
check("stall: the step starts a new chain; the old call still waits", #queue == 2)
local run = queue
queue = {}
for _, fn in ipairs(run) do fn() end
check("stall: the old call does nothing, one chain goes on", #queue == 1)
Run(0.3)
check("stall: and it stays one", #queue <= 1)
Run(2)
check("stall: it ends when the row is gone", #queue == 0)
ctx.Soon = function() error("no game thread hook") end
opacity = 1
for _ = 1, 30 do Tick(0.06) end
check("a UE4SS that refuses the call: the level up still shows, at the slow steps", made.RU_XpRowBox.Op == 1)
opacity = 0
for _ = 1, 40 do Tick(0.06) end
ctx.Soon = nil

-- the switch goes off: the parts are back at their own scale, and nothing is written after that
slim = false
Tick(0.2)
check("switch off: every part is back", Count("LevelUpOverlay", 1) == 1 and Count("InputEntryWidget", 1) == 1 and Count("SkillIconImage", 1) == 1)
check("switch off: the sparks are back", Count("NS_UI_LevelUpUpper visibility", 0) == 1 and Count("NS_UI_LevelUpLower visibility", 0) == 1)
local n = #writes
opacity = 1
for _ = 1, 20 do Tick(0.1) end
check("switch off: nothing hidden, nothing shown", #writes == n and made.RU_XpRowBox.Op == 0)
opacity = 0

-- on again, then Rune XP goes off: the banner is back
slim = true
Tick(0.2)
check("switch on: hidden again", Last("LevelUpOverlay") == 0)
on = false
Tick(0.2)
check("Rune XP off: the banner is back", Last("LevelUpOverlay") == 1)

-- a world change in the same world restores the parts; a new world does not touch the old widget
on = true
Tick(0.2) Tick(0.2)
check("on again: hidden", Last("LevelUpOverlay") == 0)
M.Forget(true)
check("forget in the same world: the banner is back", Last("LevelUpOverlay") == 1)
M.Forget(false)
local w = #writes
Tick(0.2) Tick(0.2)
check("a new world: the widgets are found again", #writes > w)

-- a fresh world: the game's notice sits at full opacity with a sample in it, and no level up happened
M.Forget(false)
opacity = 1
for _ = 1, 40 do Tick(0.05) end
check("a fresh world, the notice full from the start: the row stays unseen", made.RU_XpRowBox.Op == 0)
-- back from the menu into the world: the sample came up from a lower opacity, with an XP notice's picture as its icon
iconName = "T_Notification_Skill_Attack"
opacity = 0.3
for _ = 1, 8 do Tick(0.05) end
opacity = 1
for _ = 1, 40 do Tick(0.05) end
check("the sample that rose to full: the row stays unseen", made.RU_XpRowBox.Op == 0)
check("the sample's icon is told from a real one", not M.LevelIcon("T_Notification_Skill_Attack") and M.LevelIcon("T_Icon_Tag_Skill_Attack") and not M.LevelIcon(nil))
iconName = "T_Icon_Tag_Skill_Runecrafting"
opacity = 0
for _ = 1, 8 do Tick(0.05) end
opacity = 0.3
for _ = 1, 8 do Tick(0.05) end
opacity = 1
for _ = 1, 8 do Tick(0.05) end
check("then a real level up: the row is seen", made.RU_XpRowBox.Op == 1)
local bad = 0 for _, l in ipairs(logs) do if l:find("not read") or l:find("failed") then bad = bad + 1 end end
check("no error was logged, so the root opacity was never written", bad == 0)
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(chain)); lua.lua_setglobal(L, to_luastring('CHAINTEXT'));
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

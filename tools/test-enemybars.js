// Tests the enemy and boss bars (enemybars.lua) against fake objects shaped like the game's (probes E1 to E7, 04-10-2026):
// the class defaults of both bars get one colour once, the master copy of the enemy bar gets the player's fill and the
// width fix once, a bar made before that gets a new fill from the player's material with the game's values (the game's
// own colour for a Wither bar) or the player's texture power once, the boss bar gets one colour and never the player's
// fill, a bar the game freed is forgotten, a class that is not
// loaded yet costs no try, a failing write gives up after 3 tries, a new world writes everything again, and at the main
// menu nothing is looked for.
// Needs npm install once. Run: node tools/test-enemybars.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'enemybars.lua'), 'utf8');
const test = `
local function check(name, cond) if not cond then error("FAIL " .. name, 2) end print("ok   " .. name) end
local clock = 0
os.clock = function() return clock end
FName = function(s) return s end

-- a game list (TArray or TMap): ForEach gives an index and an element whose get() is the value
local function List(items)
    return { ForEach = function(_, fn) for i, v in ipairs(items) do fn(i, { get = function() return v end }) end end }
end
local function Param(name, c) return { ParameterInfo = { Name = { ToString = function() return name end } }, ParameterValue = c } end
local function Named(o, name, class)
    o.IsValid = function() return true end
    o.GetFName = function() return { ToString = function() return name end } end
    o.GetFullName = function() return class .. " /Game/" .. name end
    o.GetClass = function() return { GetFName = function() return { ToString = function() return class end } end } end
    return o
end

-- a class's defaults: two types of bar, each with a main colour and a shadow
local function Defaults()
    local cfgs = { { MainColor = { R = 0.04, G = 0.6, B = 0.06, A = 1 }, ShadowColor = { R = 0.02, G = 0.24, B = 0.03, A = 1 } },
                   { MainColor = { R = 0.9, G = 0.1, B = 0.3, A = 1 }, ShadowColor = { R = 0.4, G = 0.0, B = 0.1, A = 1 } } }
    return { IsValid = function() return true end, HealthBarTypeConfig = List(cfgs), Cfgs = cfgs }
end
local normalCdo, bossCdo = Defaults(), Defaults()
local masterFill = { IsValid = function() return true end, Calls = {} }
function masterFill:SetBrushFromMaterial(m) self.Calls[#self.Calls + 1] = "brush" self.Mat = m end
function masterFill:SetRenderTransformPivot(p) self.Calls[#self.Calls + 1] = "pivot" self.Pivot = p end
function masterFill:SetRenderScale(s) self.Calls[#self.Calls + 1] = "scale" self.Scale = s end
local masterFrame = { IsValid = function() return true end }
function masterFrame:SetClipping(c) self.Calls[#self.Calls + 1] = "clip" self.Clip = c end
masterFrame.Calls = {}
local playerMat = Named({}, "MI_Player_Health_bar", "MaterialInstanceConstant")
local objects = {}
local paths = {
    normal = "/Game/UI/AI/WBP_AI_Healthbar.Default__WBP_AI_Healthbar_C",
    boss = "/Game/UI/AI/WBP_AI_Boss_Healthbar.Default__WBP_AI_Boss_Healthbar_C",
    fill = "/Game/UI/AI/WBP_AI_Healthbar.WBP_AI_Healthbar_C:WidgetTree.ProgressBarImage",
    frame = "/Game/UI/AI/WBP_AI_Healthbar.WBP_AI_Healthbar_C:WidgetTree.Border_0",
    player = "/Game/Materials/UI/VitalsBars/MI_Player_Health_bar.MI_Player_Health_bar" }
local function Load() objects = { [paths.normal] = normalCdo, [paths.boss] = bossCdo, [paths.fill] = masterFill, [paths.frame] = masterFrame, [paths.player] = playerMat } end
local looks, seen = 0, {}
StaticFindObject = function(p) looks, seen[p] = looks + 1, true return objects[p] end

-- the game's fills: a dynamic material with its own colours, over a parent
local function Fill(matName, own, base, scalars)
    local mat = Named({ Writes = {}, Scalars = {}, VectorParameterValues = List(own or {}), ScalarParameterValues = List(scalars or {}),
        Parent = { IsValid = function() return true end, VectorParameterValues = List(base or {}) } }, matName, "MaterialInstanceDynamic")
    function mat:SetVectorParameterValue(n, c) self.Writes[#self.Writes + 1] = { n, c } end
    function mat:SetScalarParameterValue(n, v) self.Scalars[#self.Scalars + 1] = { n, v } end
    return mat
end
local function Bar(mat, scale)
    local frame = { IsValid = function() return true end, Clips = 0 }
    function frame:SetClipping(c) self.Clip = c self.Clips = self.Clips + 1 end
    local overlay = { IsValid = function() return true end, GetParent = function() return frame end }
    local fill = { IsValid = function() return true end, Brush = { ResourceObject = mat }, RenderTransform = { Scale = { X = scale or 1, Y = 1 } },
        GetParent = function() return overlay end, Pivots = 0, Made = 0 }
    function fill:SetRenderTransformPivot() self.Pivots = self.Pivots + 1 end
    function fill:SetRenderScale(s) self.RenderTransform.Scale = { X = s.X, Y = s.Y } end
    function fill:SetBrushFromMaterial(m) self.Brush.ResourceObject = m end
    -- as UImage: a dynamic material made from the brush's material, which takes its place in the brush
    function fill:GetDynamicMaterial()
        self.Made = self.Made + 1
        self.Brush.ResourceObject = Fill("MID_" .. self.Brush.ResourceObject:GetFName():ToString() .. "_new" .. self.Made)
        return self.Brush.ResourceObject
    end
    return { ProgressBarImage = fill, Frame = frame, IsValid = function() return true end, ProgressBarMaterialInstance = mat,
        Op = 1, Sets = 0, GetRenderOpacity = function(self) return self.Op end,
        SetRenderOpacity = function(self, o) self.Op = o self.Sets = self.Sets + 1 end }
end
-- the value last written under a name
local function Last(writes, name) local v for _, w in ipairs(writes) do if w[1] == name then v = w[2] end end return v end

local M = load(SRCTEXT)()
local lists, logs = { WBP_AI_Healthbar_C = { {}, {} }, WBP_AI_Boss_Healthbar_C = { {}, {} } }, {}
local failedCount, inWorld = 0, false
local ctx = { Log = function(m) logs[#logs + 1] = m end, Noise = 1.5, InWorld = function() return inWorld end,
    Find = function(c) return lists[c][1], lists[c][2] end,
    MayTry = function(P) return (P.Fails or 0) < 3 and os.clock() >= (P.RetryAt or 0) end,
    Failed = function(P) failedCount = failedCount + 1 P.Fails, P.RetryAt = (P.Fails or 0) + 1, os.clock() + 10 end }
local function Scan() clock = clock + 11 M.Scan(ctx) end
local function ShadowIsMain(c)
    for _, g in ipairs(c.Cfgs) do
        if g.ShadowColor.R ~= g.MainColor.R or g.ShadowColor.G ~= g.MainColor.G or g.ShadowColor.B ~= g.MainColor.B then return false end
    end
    return true
end

-- the main menu: no HUD, so no object is looked for and no bar is read
Scan() Scan() Scan()
check("the main menu: nothing is looked for", looks == 0 and #logs == 0)
inWorld = true

-- no bar listed yet: the classes are not looked for (a look for an unloaded class walks every object), nothing written
Scan() Scan() Scan()
check("no bar yet: nothing is looked for, no try spent, nothing logged", looks == 0 and failedCount == 0 and #logs == 0 and not M.Problem())
check("no bar yet: the defaults are as they were", not ShadowIsMain(normalCdo))
-- a bar is listed but its class does not resolve yet: no try spent, asked again on the next scan
lists.WBP_AI_Healthbar_C = { { {} }, { "stub" } }
Scan()
check("not loaded yet: no try spent, nothing logged", looks > 0 and failedCount == 0 and #logs == 0 and not M.Problem())
check("only enemy bars listed: the boss bar's class is never looked for", seen[paths.normal] and not seen[paths.boss])

-- the first creature is near: the classes resolve. A bar of each class is listed (with no fill yet: nothing to dress)
Load()
lists.WBP_AI_Boss_Healthbar_C = { { {} }, { "bossstub" } }
Scan()
check("defaults: every type's shadow is its main colour, on both bars", ShadowIsMain(normalCdo) and ShadowIsMain(bossCdo) and normalCdo.Cfgs[2].ShadowColor.R == 0.9)
check("master: the player's fill, the pivot at the left end, 1 / 0.9 wide, the frame does not clip (it would cut the name)",
    masterFill.Mat == playerMat and masterFill.Pivot.X == 0 and masterFill.Pivot.Y == 0.5 and math.abs(masterFill.Scale.X - 1 / 0.9) < 1e-9 and masterFill.Scale.Y == 1 and masterFrame.Clip == nil)
normalCdo.Cfgs[1].ShadowColor = { R = 0, G = 0, B = 0, A = 1 }   -- a later scan must not write it again
masterFill.Calls, masterFrame.Calls = {}, {}
Scan() Scan()
check("once, not on every scan", normalCdo.Cfgs[1].ShadowColor.R == 0 and #masterFill.Calls == 0 and #masterFrame.Calls == 0)

-- a bar made before the master copy had the player's fill (a creature that loaded with the world, probe of 15-10-2026):
-- the game's enemy fill (a Wither bar, red, hurt) is replaced by a new one from the player's material
local wither = Fill("MID_MI_Enemy_Health_Bar_1",
    { Param("Health Bar Main Color", { R = 0.9, G = 0.1, B = 0.3, A = 1 }), Param("Health Bar Shadows Color", { R = 0.4, G = 0, B = 0.1, A = 1 }),
      Param("Bubbles Color", { R = 0.9, G = 0.7, B = 0.15, A = 1 }) }, nil,
    { Param("Available health/stamina", 0.45), Param("Fill from Avaliable", 1) })
local old = Bar(wither)
-- one with no colours of its own: the parent's main colour
local green = Fill("MID_MI_Enemy_Health_Bar_2", {}, { Param("Health Bar Main Color", { R = 0.04, G = 0.6, B = 0.06, A = 1 }) })
local old2 = Bar(green)
lists.WBP_AI_Healthbar_C = { { old, old2 }, { "bar1", "bar2" } }
Scan()
local mid = old.ProgressBarImage.Brush.ResourceObject
check("old bar: a new dynamic material from the player's, and the bar's handle points at it",
    old.ProgressBarImage.Made == 1 and mid.GetFName():ToString() == "MID_MI_Player_Health_bar_new1" and old.ProgressBarMaterialInstance == mid)
check("old bar: the game's colours, in one colour, and its other colours", Last(mid.Writes, "Health Bar Main Color").R == 0.9
    and Last(mid.Writes, "Health Bar Shadows Color").R == 0.9 and Last(mid.Writes, "Bubbles Color").G == 0.7)
check("old bar: the game's health values and the texture power", Last(mid.Scalars, "Available health/stamina") == 0.45
    and Last(mid.Scalars, "Fill from Avaliable") == 1 and Last(mid.Scalars, "Bar Noise Power") == 1.5)
check("old bar: widened once, the frame does not clip", old.ProgressBarImage.Pivots == 1 and old.Frame.Clips == 0
    and math.abs(old.ProgressBarImage.RenderTransform.Scale.X - 1 / 0.9) < 1e-9)
check("old bar: nothing written into the game's old material", #wither.Writes == 0 and #wither.Scalars == 0)
local mid2 = old2.ProgressBarImage.Brush.ResourceObject
check("old bar: no colours of its own, the parent's", Last(mid2.Writes, "Health Bar Main Color").G == 0.6 and Last(mid2.Writes, "Health Bar Shadows Color").G == 0.6)
local writes = #mid.Writes + #mid.Scalars
Scan() Scan()
check("old bar: the new material is not dressed again", old.ProgressBarImage.Made == 1 and #mid.Writes + #mid.Scalars == writes)

-- a bar with the player's material: noise 1.5 once; made before the master's fix it is widened once
local pm = Fill("MID_MI_Player_Health_bar_1")
local pbar = Bar(pm, 1)
local pm2 = Fill("MID_MI_Player_Health_bar_2")
local pbar2 = Bar(pm2, 1 / 0.9)   -- made after the fix: it came with it
lists.WBP_AI_Healthbar_C = { { pbar, pbar2 }, { "bar4", "bar5" } }
Scan() Scan() Scan()
check("player's fill: the texture power is 1.5, once", #pm.Scalars == 1 and pm.Scalars[1][1] == "Bar Noise Power" and pm.Scalars[1][2] == 1.5 and #pm2.Scalars == 1)
check("player's fill: a bar made before the fix is widened once", pbar.ProgressBarImage.Pivots == 1 and pbar.Frame.Clips == 0
    and math.abs(pbar.ProgressBarImage.RenderTransform.Scale.X - 1 / 0.9) < 1e-9)
check("player's fill: a bar that came with the fix is left alone", pbar2.ProgressBarImage.Pivots == 0 and pbar2.Frame.Clips == 0)

-- a bar with no fill of its own yet: tried again on the next scan
local pending = Bar(nil)
lists.WBP_AI_Healthbar_C = { { pending }, { "bar6" } }
Scan()
local lateMat = Fill("MID_MI_Player_Health_bar_3")
pending.ProgressBarImage.Brush.ResourceObject = lateMat
Scan()
check("no fill yet: dressed when it comes", #lateMat.Scalars == 1)
Scan()
check("the same fill is not dressed again", #lateMat.Scalars == 1)
local newMat = Fill("MID_MI_Player_Health_bar_4")
pending.ProgressBarImage.Brush.ResourceObject = newMat
Scan()
check("a bar that gets a new fill is dressed again", #newMat.Scalars == 1 and #lateMat.Scalars == 1)

-- a fill with no parent that is valid: the colour is not found, and the bar is not tried again with that fill
local orphan = Fill("MID_MI_Enemy_Health_Bar_7")
orphan.Parent.IsValid = function() return false end
lists.WBP_AI_Healthbar_C = { { Bar(orphan) }, { "bar7" } }
local failedBefore = failedCount
Scan() Scan()
check("a null parent is not read, the failure is counted once", failedCount == failedBefore + 1)
failedCount = failedBefore
M.Forget(false)
Load()
Scan()

-- the boss bar: its own material, one colour, never the player's texture or the width fix
local boss = Fill("MID_MI_Boss_Health_bar_1", { Param("Health Bar Main Color", { R = 0.8, G = 0.7, B = 0.1, A = 1 }) })
local bossBar = Bar(boss)
lists.WBP_AI_Healthbar_C = { {}, {} }
lists.WBP_AI_Boss_Healthbar_C = { { bossBar }, { "boss1" } }
Scan() Scan()
check("boss bar: one colour once, no texture power, no width fix", #boss.Writes == 1 and boss.Writes[1][2].R == 0.8 and #boss.Scalars == 0 and bossBar.ProgressBarImage.Pivots == 0)

-- a bar the game freed is forgotten: a new bar under the same name is dressed
lists.WBP_AI_Boss_Healthbar_C = { {}, {} }
Scan()
local boss2 = Fill("MID_MI_Boss_Health_bar_2", { Param("Health Bar Main Color", { R = 0.8, G = 0.7, B = 0.1, A = 1 }) })
lists.WBP_AI_Boss_Healthbar_C = { { Bar(boss2) }, { "boss1" } }
Scan()
check("a freed bar is dropped from the handled ones", #boss2.Writes == 1)

-- the switch "Enemy health bars": off, every bar is see-through; on, each gets its opacity back
local shown = true
ctx.On = function() return shown end
local bossBar2 = lists.WBP_AI_Boss_Healthbar_C[1][1]
local mob = Bar(Fill("MID_MI_Player_Health_bar_7"), 1)
mob.Op = 0.8
lists.WBP_AI_Healthbar_C = { { mob }, { "mob1" } }
Scan()
check("switch on: the bars are left as the game has them", mob.Op == 0.8 and mob.Sets == 0 and bossBar2.Sets == 0)
shown = false
Scan()
check("switch off: every bar is see-through, the boss bar too", mob.Op == 0 and bossBar2.Op == 0)
mob.Op = 0.5
Scan()
check("switch off: a bar the game shows again is see-through again", mob.Op == 0)
local sets = mob.Sets
Scan()
check("switch off: a see-through bar is not written again", mob.Sets == sets)
local late = Bar(Fill("MID_MI_Player_Health_bar_8"), 1)
lists.WBP_AI_Healthbar_C = { { mob, late }, { "mob1", "mob2" } }
Scan()
check("switch off: a bar made later is see-through at the next scan", late.Op == 0)
shown = true
Scan()
check("switch on again: each bar gets the opacity it had first", mob.Op == 0.8 and late.Op == 1 and bossBar2.Op == 1)
sets = mob.Sets
Scan()
check("switch on: nothing more is written", mob.Sets == sets)
-- a respawn in the same world keeps the bars: off, a respawn, on again gives each its opacity back
shown = false
Scan()
M.Forget(true)
Scan()
shown = true
Scan()
check("off, a respawn, on again: each bar gets the opacity it had first", mob.Op == 0.8 and late.Op == 1)
ctx.On = nil

-- a new world: written again
normalCdo.Cfgs[1].ShadowColor = { R = 0, G = 0, B = 0, A = 1 }
masterFill.Calls = {}
M.Forget(false)
local again = Fill("MID_MI_Player_Health_bar_9")
lists.WBP_AI_Healthbar_C = { { Bar(again, 1) }, { "bar4" } }
Scan()
check("new world: the defaults, the master and the bar again", normalCdo.Cfgs[1].ShadowColor.R == 0.04 and #masterFill.Calls == 3 and #again.Scalars == 1)

-- a write that fails: 3 tries, then it gives up, and the others go on
normalCdo.HealthBarTypeConfig = { ForEach = function() error("no map") end }
bossCdo.Cfgs[1].ShadowColor = { R = 0, G = 0, B = 0, A = 1 }
M.Forget(false)
failedCount, logs = 0, {}
lists.WBP_AI_Healthbar_C = { { {} }, { "stub" } }
for _ = 1, 6 do Scan() end
check("a failing write: 3 tries, a line for each, then it gives up", failedCount == 3 and #logs >= 3 and M.Problem())
check("a failing write does not stop the boss bar's defaults", ShadowIsMain(bossCdo))
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

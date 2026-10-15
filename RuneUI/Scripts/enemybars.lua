-- Enemy and boss health bars in the look of the player's bars (probes of 04-10-2026): one colour per bar, and for a normal enemy the player's bar material, with the player's texture.
-- The game makes one bar widget for each creature when the creature loads, from the class defaults and a master copy of
-- the widget. So most of the work is a write to those, once per world:
--  - the class defaults of both bars: in each entry of HealthBarTypeConfig the shadow colour takes the main colour, so
--    every bar made after it shows one colour (the boss bar too; it keeps its own material, frame, notches and sparks);
--  - the master copy of the normal bar: its fill takes the player's material (MI_Player_Health_bar).
-- A bar that exists already is dressed once (Dress): a normal bar with the enemy material gets the player's material
-- (PlayerFillOn), a boss bar one colour on its own fill, and a bar with the player's material the texture power of the
-- player's bars (bars.lua, ctx.Noise) and the width fix below. The classes may not be loaded until
-- the first creature is near, so a missing object is asked for again on the next scan and costs no try. The game frees
-- a bar when its creature goes, so Handled keeps only the bars that are still listed.
-- main.lua loads this file with pcall and runs its Scan; there is no switch, as for the player's bars.

local M = {}

local DEFAULTS = { Normal = "/Game/UI/AI/WBP_AI_Healthbar.Default__WBP_AI_Healthbar_C",
    Boss = "/Game/UI/AI/WBP_AI_Boss_Healthbar.Default__WBP_AI_Boss_Healthbar_C" }
local MASTER = "/Game/UI/AI/WBP_AI_Healthbar.WBP_AI_Healthbar_C:WidgetTree."   -- + ProgressBarImage (the fill)
local PLAYER_FILL = "/Game/Materials/UI/VitalsBars/MI_Player_Health_bar.MI_Player_Health_bar"
local PLAYER_NAME, ENEMY_NAME = "MI_Player_Health_bar", "MI_Enemy_Health_Bar"
local MAIN, SHADOW, NOISE = "Health Bar Main Color", "Health Bar Shadows Color", "Bar Noise Power"
-- The game writes "Available health/stamina" = 0.9 into a full bar, and the player's material draws only that share of
-- the width (the enemy material ignores the value). The fill is drawn wider by 1 / 0.9 from its left end, so a full
-- bar is full. The material draws nothing in the extra tenth, at full health and on a hurt bar (probes of 06-10-2026).
-- The frame (Border_0) must not clip: the name sits above it, in the same box as the fill, and is cut with it.
local AVAILABLE = 0.9
local WIDGETS = { "WBP_AI_Healthbar_C", "WBP_AI_Boss_Healthbar_C" }

-- one entry for each thing done once per world: Done, and Fails and RetryAt for MayTry
local Steps = { Normal = {}, Boss = {}, Master = {}, Widgets = {} }
-- a bar's full name -> the full name of the fill that was dressed (or failed, and is not tried again): a bar that gets a new
-- fill is dressed again, as bars.lua does for the player's bars
local Handled = {}

local function Find(path)
    local o = StaticFindObject(path)
    if o and o:IsValid() then return o end
end

-- Runs write for a step once. write returns false when its objects are not loaded yet (no try spent); an error in it
-- spends one (MayTry: 3 at most in a round).
local function Once(ctx, step, name, write)
    if step.Done or not ctx.MayTry(step) then return end
    local ok, result = pcall(write)
    if ok and result == false then return end
    if ok then
        step.Done = true
        ctx.Log("enemy bars: " .. name .. " done")
    else
        ctx.Failed(step)
        ctx.Log("enemy bars: " .. name .. " failed: " .. tostring(result))
    end
end

local function WidenFill(fill)
    fill:SetRenderTransformPivot({ X = 0, Y = 0.5 })
    fill:SetRenderScale({ X = 1 / AVAILABLE, Y = 1 })
end

local function OneColorDefaults(path)
    return function()
        local cdo = Find(path)
        if not cdo then return false end
        cdo.HealthBarTypeConfig:ForEach(function(_, v)
            local cfg = v:get()
            local main = cfg.MainColor
            cfg.ShadowColor = { R = main.R, G = main.G, B = main.B, A = main.A }
        end)
    end
end

local function PlayerFill()
    local fill, mat = Find(MASTER .. "ProgressBarImage"), Find(PLAYER_FILL)
    if not (fill and mat) then return false end
    fill:SetBrushFromMaterial(mat)
    WidenFill(fill)
end

-- a material's own values, by name: every colour (Colors) or every number (Scalars)
local function Colors(mat)
    local into = {}
    mat.VectorParameterValues:ForEach(function(_, e)
        local p = e:get()
        local c = p.ParameterValue
        into[p.ParameterInfo.Name:ToString()] = { R = c.R, G = c.G, B = c.B, A = c.A }
    end)
    return into
end

local function Scalars(mat)
    local into = {}
    mat.ScalarParameterValues:ForEach(function(_, e)
        local p = e:get()
        into[p.ParameterInfo.Name:ToString()] = p.ParameterValue
    end)
    return into
end

local function Near(a, b) return math.abs(a.R - b.R) < 0.01 and math.abs(a.G - b.G) < 0.01 and math.abs(a.B - b.B) < 0.01 end

-- The game writes the bar's colours into the fill itself (a Wither bar is red); the parent's list is the fallback, as
-- in bars.lua.
local function MainOf(mat, own)
    local main = own[MAIN]
    local parent = mat.Parent
    if not main and parent and parent:IsValid() then main = Colors(parent)[MAIN] end
    if not main then error("no main colour on " .. mat:GetFullName()) end
    return main
end

-- one colour on a bar made before the class defaults were written (the boss bar)
local function OneColor(mat)
    local own = Colors(mat)
    local main = MainOf(mat, own)
    if own[SHADOW] and Near(own[SHADOW], main) then return end   -- already one colour
    mat:SetVectorParameterValue(FName(SHADOW), main)
end

-- A normal bar made before the master copy had the player's fill keeps the enemy material: the creatures that load
-- with the world, before the HUD is up, so the first bars a player meets. The bar keeps its dynamic material in
-- ProgressBarMaterialInstance and writes the health into it, so a new one is made from the player's material, takes
-- the game's values in one colour, and replaces that handle (probe of 15-10-2026).
local function PlayerFillOn(W, fill, old, player)
    local colors, scalars = Colors(old), Scalars(old)
    local main = MainOf(old, colors)
    colors[MAIN], colors[SHADOW] = main, main
    fill:SetBrushFromMaterial(player)
    local mid = fill:GetDynamicMaterial()
    for name, c in pairs(colors) do mid:SetVectorParameterValue(FName(name), c) end
    for name, v in pairs(scalars) do mid:SetScalarParameterValue(FName(name), v) end
    W.ProgressBarMaterialInstance = mid
    return mid
end

-- a bar's fill and its dynamic material; nothing while it has none of its own yet
local function FillOf(W)
    local fill = W.ProgressBarImage
    if not (fill and fill:IsValid()) then return end
    local mat = fill.Brush.ResourceObject
    if mat and mat:IsValid() and mat:GetClass():GetFName():ToString() == "MaterialInstanceDynamic" then return fill, mat end
end

-- returns the fill's material after the dressing: a new one when the bar got the player's material here
local function Dress(ctx, W, fill, mat)
    local name = mat:GetFName():ToString()
    local player = string.find(name, ENEMY_NAME, 1, true) and Find(PLAYER_FILL)
    if player then
        mat = PlayerFillOn(W, fill, mat, player)
    elseif not string.find(name, PLAYER_NAME, 1, true) then
        OneColor(mat)
        return mat
    end
    if not ctx.Noise then error("no texture power given") end
    mat:SetScalarParameterValue(FName(NOISE), ctx.Noise)
    -- a bar made before the master copy had its fix is drawn at 90%; one made after it comes with the fix
    if math.abs(fill.RenderTransform.Scale.X - 1 / AVAILABLE) > 0.01 then WidenFill(fill) end
    return mat
end

-- Handled is set before the dressing, so a bar that fails is not tried again with the same fill
local function Handle(ctx, W, key)
    local fill, mat = FillOf(W)
    if not mat then return false end
    local name = mat:GetFullName()
    if Handled[key] == name then return false end
    Handled[key] = name
    Handled[key] = Dress(ctx, W, fill, mat):GetFullName()
    return true
end

local function DressAll(ctx)
    local step = Steps.Widgets
    local live = {}
    for _, class in ipairs(WIDGETS) do
        local list, keys = ctx.Find(class)
        for i, W in ipairs(list) do
            local key = keys[i]
            live[key] = true
            if ctx.MayTry(step) then
                local ok, done = pcall(Handle, ctx, W, key)
                if ok and done and not step.Logged then step.Logged = true ctx.Log("enemy bars: the first bar dressed (" .. class .. ")") end
                if not ok then
                    ctx.Failed(step)
                    ctx.Log("enemy bars: a bar failed (" .. class .. "): " .. tostring(done))
                end
            end
        end
    end
    for key in pairs(Handled) do if not live[key] then Handled[key] = nil end end
end

-- Once per widget scan (main.lua). Not at the main menu: the classes are not loaded there, and a look for an object
-- that the game has not loaded walks every object, 30 to 43 ms a scan (09-10-2026). ctx.InWorld: the HUD is there.
function M.Scan(ctx)
    if not ctx.InWorld() then return end
    Once(ctx, Steps.Normal, "class defaults of the enemy bar", OneColorDefaults(DEFAULTS.Normal))
    Once(ctx, Steps.Boss, "class defaults of the boss bar", OneColorDefaults(DEFAULTS.Boss))
    Once(ctx, Steps.Master, "the player's fill in the enemy bar", PlayerFill)
    DressAll(ctx)
end

-- a new world or a player restart: a blueprint class can load again at a new address, so everything is written again
function M.Forget()
    for _, step in pairs(Steps) do step.Done, step.Logged, step.Fails, step.RetryAt = nil, nil, 0, 0 end
    Handled = {}
end

-- for the F9 panel's warning line: one of the builds gave up (see MayTry)
function M.Problem()
    for _, step in pairs(Steps) do if (step.Fails or 0) >= 3 then return true end end
    return false
end

return M

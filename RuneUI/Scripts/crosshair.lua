-- The setting "Crosshair" (F6 and Mod Menu): Show, Aim + tools, Aim only or Nothing. In the immersive mode and out of
-- it, with or without the immersive camera, the dots of the game's crosshair are unseen as camerarules'
-- CrosshairHides says. At Show, the game's crosshair stays as it is.
-- Aim only keeps the dot while you aim a bow or hold a staff: without the lock-on, it is the only aim of a cast or a
-- bow shot. Aim + tools keeps it too while a tool is in a hand (camera.lua's Hands): a tree or a rock is hit where the
-- dot is. Nothing hides the dot of an aim too. The bow's ring and stamina arc, the staff's ring and the lock-on mark
-- stay at every setting.
-- The marks are the ones aim.lua paints gold, found with its Collect (ctx.Collect), and of those the ones named in DOT:
-- the dots of an aim's reticle (Aim) apart from the others.
-- Each is made fully see-through, not collapsed: the game shows and hides them by their visibility, and the arrow and
-- rune count in the same widget stays. The game's own opacity is kept and put back.
-- Nothing runs while no dot is hidden. main.lua loads this file with pcall, so an error here leaves the rest of the mod running.

local M = {}

-- the marks that are hidden, by widget name. "Crosshair" is the dot: aim.lua names it the dot of every weapon, and the
-- aim widget has one in each weapon's reticle (10 of the 14 marks in the log of 05-10-2026). The rings are SightRing
-- (bow), StaminaProgressBar (bow) and MagicIcon (staff).
local DOT = { Crosshair = true }

-- Whether a mark sits in the reticle of an aim: the bow's aim, the staff's cast or the aimed utility spell. The full
-- name of a mark holds the reticle child of the aim widget, as in
-- "...WBP_HUD_ReticleWidget_C_2147471152.WidgetTree_1.ReticleMagic.WidgetTree_2.Crosshair" (the ammo log line). The child's
-- name is checked with the camera's rule (camerarules AimReticle: "RangedADS", "Magic"), so the zoom and the dot agree.
-- A mark with no reticle child in its name counts as an aim: an unknown reticle never loses its aim but at Nothing.
local function Aim(ctx, key)
    local child = string.match(key, "WBP_HUD_ReticleWidget_C[%w_]*%.WidgetTree[%w_]*%.([%w_]+)%.")
    return child == nil or ctx.Rules.AimReticle(child)
end

-- the game's opacity of each mark, by the mark's full name: plain numbers, no handles. Kept through a new world, as
-- the aim widget belongs to the game instance and outlives a world (aim.lua, probe of 29-09-2026).
local Saved = {}
M.Marks, M.AimDots, M.Host, M.Hidden = {}, {}, nil, nil
local Logged = {}
local function Once(ctx, key, msg) if not Logged[key] then Logged[key] = true ctx.Log(msg) end end

-- the dots of the aim widget R, found again when it is another widget
local function Marks(ctx, R)
    local host = R:GetAddress()
    if host == M.Host then return end
    local all = {}
    ctx.Collect(R, all, 0)
    M.Host, M.Marks, M.AimDots = host, {}, {}
    for _, m in ipairs(all) do
        if DOT[m.Name] then
            if Aim(ctx, m.Key) then
                M.AimDots[#M.AimDots + 1] = m
                -- an aim dot left at opacity 0 by a restart of the mods is shown again; Nothing hides it once more
                pcall(function() if Saved[m.Key] == nil and m.W:GetRenderOpacity() == 0 then m.W:SetRenderOpacity(1) end end)
            else M.Marks[#M.Marks + 1] = m end
        end
    end
    Once(ctx, "marks" .. #M.Marks .. "/" .. #M.AimDots, "crosshair: " .. #M.Marks .. " dots, " .. #M.AimDots .. " aim dots of " .. #all .. " aim marks")
end

local function Hide(m)
    if not m.W:IsValid() then return end
    local o = m.W:GetRenderOpacity()
    if o > 0 then
        if Saved[m.Key] == nil then Saved[m.Key] = o end
        m.W:SetRenderOpacity(0)
    end
end

-- the game's opacity back on one mark that was hidden
local function Show(m)
    local o = Saved[m.Key]
    if o == nil then return end
    Saved[m.Key] = nil
    if m.W:IsValid() then m.W:SetRenderOpacity(o) end
end

-- every dot back; false while the aim widget is not found (tried again on the next step)
local function Restore(ctx)
    local R = ctx.Reticle()
    if not (R and R:IsValid()) then return false end
    Marks(ctx, R)
    for _, list in ipairs({ M.Marks, M.AimDots }) do
        for _, m in ipairs(list) do pcall(Show, m) end
    end
    return true
end

function M.Forget() M.Marks, M.AimDots, M.Host, Logged = {}, {}, nil, {} end

local SAY = { dots = "crosshair: the dot hidden, kept while you aim", all = "crosshair: every dot hidden" }

function M.Tick(ctx)
    local okH, right, left = pcall(function() if ctx.Hands then return ctx.Hands() end end)
    if not okH then Once(ctx, "hand", "crosshair: the hands not read: " .. tostring(right)) right, left = nil, nil end
    local okB, building = pcall(function() return ctx.Building and ctx.Building() end)
    if not okB then Once(ctx, "build", "crosshair: the build mode not read: " .. tostring(building)) building = false end
    local hide = ctx.Rules.CrosshairHides(right, left, building)
    if not hide then
        if M.Hidden then
            local ok, done = pcall(Restore, ctx)
            if ok and done then M.Hidden = nil Once(ctx, "back", "crosshair: the game's crosshair back (the setting, or a tool in hand)") end
            if not ok then Once(ctx, "restore", "crosshair: not put back: " .. tostring(done)) end
        end
        return
    end
    if M.Hidden ~= hide then Once(ctx, "hidden " .. hide, SAY[hide]) end
    M.Hidden = hide
    local R = ctx.Reticle()
    if not (R and R:IsValid()) then return end
    Marks(ctx, R)
    -- every step: the game may show a mark again
    for _, m in ipairs(M.Marks) do pcall(Hide, m) end
    for _, m in ipairs(M.AimDots) do pcall(hide == "all" and Hide or Show, m) end
end

return M

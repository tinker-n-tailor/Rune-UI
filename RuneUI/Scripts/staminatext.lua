-- The number on the stamina bar ("80/100"), with the switch of the health numbers (elements.lua "barnumbers", off at
-- first). The game's health bar has its number text (ValueText, "100/100"); its stamina bar has none, no ValueText and
-- no text at all (probe of 18-10-2026). So the number is a text of ours in the stamina bar's Overlay_0, the box that
-- holds the health text in the health bar, in the health text's font, colour, shadow and place. Its value is the
-- player's StaminaComponent, GetStamina and GetMaxStamina, read 5 times a second and written when it changes.
-- Off, ours is see-through, as the health numbers are (bars.lua). The immersive mode fades it with its row.
-- main.lua loads this file with pcall and runs its Tick.

local M = {}

local PREFIX = "RU_StamNum"
local EVERY = 0.2   -- seconds between two reads of the stamina

local S = { Next = 0 }   -- Text: ours; Host: the stamina bar it sits in; Comp: the stamina component; Said: the text written

local function Alive(o) return o and o:IsValid() end

local function Child(panel, name)
    for i = 0, panel:GetChildrenCount() - 1 do
        local c = panel:GetChildAt(i)
        if Alive(c) and c:GetFName():ToString() == name then return c end
    end
end

-- ours in the stamina bar, styled as the health bar's ValueText
local function Build(ctx, stamina, health)
    local src = health.ValueText
    if not Alive(src) then error("the health bar has no ValueText") end
    local root = stamina.WidgetTree.RootWidget
    local box = Alive(root) and Child(root, "Overlay_0")
    if not box then error("no Overlay_0 in the stamina bar") end
    ctx.ClearOurs(box, PREFIX)
    local T = StaticConstructObject(StaticFindObject("/Script/UMG.TextBlock"), stamina.WidgetTree, FName(ctx.Uniq(PREFIX)))
    T:SetFont(src.Font)
    T:SetColorAndOpacity(src.ColorAndOpacity)
    pcall(function()
        T:SetShadowOffset(src.ShadowOffset)
        T:SetShadowColorAndOpacity(src.ShadowColorAndOpacity)
    end)
    local slot = box:AddChildToOverlay(T)
    local from = src.Slot
    if Alive(from) then
        slot:SetHorizontalAlignment(from.HorizontalAlignment)
        slot:SetVerticalAlignment(from.VerticalAlignment)
        slot:SetPadding(from.Padding)
    end
    S.Text, S.Host, S.Said, S.Op = T, stamina, nil, nil
    ctx.Log("stamina numbers: the text is made")
end

local function Comp(ctx)
    if Alive(S.Comp) then return S.Comp end
    local pc = ctx.Controller()
    local pawn = Alive(pc) and pc.Pawn
    local c = Alive(pawn) and pawn.StaminaComponent
    S.Comp = Alive(c) and c or nil
    return S.Comp
end

local function Step(ctx)
    local on = ctx.On()
    local bars = ctx.Bars()
    local stamina, health = bars[1], bars[2]
    if not (Alive(stamina) and Alive(health)) then return end
    local built = Alive(S.Text) and Alive(S.Host) and S.Host:GetAddress() == stamina:GetAddress()
    if not built then
        if not on or not ctx.MayTry(S) then return end   -- made only when it is to show
        local ok, err = pcall(Build, ctx, stamina, health)
        if not ok then ctx.Failed(S) ctx.Log("stamina numbers: not made: " .. tostring(err)) return end
    end
    local op = on and 1 or 0
    if op ~= S.Op then S.Op = op S.Text:SetRenderOpacity(op) end
    if not on then return end
    local c = Comp(ctx)
    if not c then return end
    local s = string.format("%d/%d", math.floor(c:GetStamina() + 0.5), math.floor(c:GetMaxStamina() + 0.5))
    if s ~= S.Said then S.Said = s S.Text:SetText(FText(s)) end
end

function M.Tick(ctx)
    local now = os.clock()
    if now < S.Next then return end
    S.Next = now + EVERY
    local ok, err = pcall(Step, ctx)
    if not ok and not S.Logged then S.Logged = true ctx.Log("stamina numbers: failed: " .. tostring(err)) end
end

-- a new world or a player restart: the bar and the component may be new; ours is made again in the bar found
function M.Forget() S = { Next = 0 } end

return M

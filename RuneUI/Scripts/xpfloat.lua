-- The game's floating XP over a hit enemy ("+15 XP", game 1.0.1), shown or not: the Rune Skin switch "Floating XP"
-- (elements.lua "floatxp", off at first, as the XP under the bars shows it). Off, each live container of the floating
-- XP is collapsed; on, it gets the visibility it had back. The game keeps a container for the game instance, so the
-- look is made once a second and costs nothing while nothing changed. Its own look stays the game's: a restyle
-- squeezed its skill icon and left a shadow after its fade (14-10-2026). main.lua loads this file with pcall.

local M = {}

local CLASS = "WBP_FloatingExperienceContainer_C"
local COLLAPSED = 1
local EVERY = 1   -- seconds between two looks

local S = { Next = 0, Was = {} }   -- Was: full name of a container we collapsed -> its visibility before

local function Alive(o) return o and o:IsValid() end

local function Step(ctx)
    local on = ctx.On()
    local list, keys = ctx.Find(CLASS)
    for i, W in ipairs(list) do
        local key = keys[i]
        if Alive(W) then
            if not on and W:GetVisibility() ~= COLLAPSED then
                if S.Was[key] == nil then S.Was[key] = W:GetVisibility() end
                W:SetVisibility(COLLAPSED)
            elseif on and S.Was[key] ~= nil then
                W:SetVisibility(S.Was[key])
                S.Was[key] = nil
            end
        end
    end
end

function M.Tick(ctx)
    local now = os.clock()
    if now < S.Next then return end
    S.Next = now + EVERY
    local ok, err = pcall(Step, ctx)
    if not ok and not S.Failed then S.Failed = true ctx.Log("floating xp: failed: " .. tostring(err)) end
end

-- a new world: the containers may be new; one we collapsed and that stays keeps its old visibility in Was
function M.Forget() S.Next, S.Failed = 0, nil end

return M

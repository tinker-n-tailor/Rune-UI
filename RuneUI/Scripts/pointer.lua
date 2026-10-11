-- The mouse pointer: a gold arrow in the look of Rune Map's, in place of the Windows arrow that the game shows in its
-- menus and on the big map. No setting: it is always on.
-- The engine can take the picture of a pointer from a file (WidgetBlueprintLibrary:SetHardwareCursor). It looks for the
-- file under the game's Content folder, so the picture is named by its way from there to the mod's Art folder, without
-- ".png". The call returns false when the engine did not take the file. The engine keeps the pointer for the whole run
-- of the game, so the mod sets it once, and tries TRIES times when it does not take.
-- The same picture goes on the arrow, the cross, the hand and the two grab hands; the text beam stays.
-- main.lua loads this file with pcall and runs its Tick.

local M = {}

local LIB = "/Script/UMG.Default__WidgetBlueprintLibrary"
local SHAPES = { 1, 8, 9, 10, 11 }      -- EMouseCursor: Default, Crosshairs, Hand, GrabHand, GrabHandClosed
local HOTSPOT = { X = 0.08, Y = 0.07 }  -- the tip of the arrow, as a share of the picture
local TRIES, TRY_EVERY = 3, 10
local DIR = (RUNEUI_DIR or "ue4ss/Mods/RuneUI/")   -- the short path counts from Binaries/Win64, where the game starts

local Done, Tries, NextTry = false, 0, 0

-- The picture's name for the engine, from the mod's folder (RUNEUI_DIR): the way from the game's Content folder, which
-- sits beside Binaries. A short path counts from Binaries/Win64.
function M.Path(dir)
    local d = string.gsub(dir, "\\", "/")
    if string.sub(d, -1) ~= "/" then d = d .. "/" end
    local at = string.find(string.lower(d), "/binaries/", 1, true)
    if not at then return "../Binaries/Win64/" .. d .. "Art/pointer" end
    return ".." .. string.sub(d, at) .. "Art/pointer"
end

function M.Tick(ctx)
    if Done or Tries >= TRIES then return end
    local now = os.clock()
    if now < NextTry then return end
    local pc = ctx.Controller()
    if not (pc and pc:IsValid()) then return end
    NextTry, Tries = now + TRY_EVERY, Tries + 1
    local lib = StaticFindObject(LIB)
    local name = ctx.Name(M.Path(DIR))
    local set = 0
    for _, shape in ipairs(SHAPES) do
        if lib:SetHardwareCursor(pc, shape, name, HOTSPOT) then set = set + 1 end
    end
    Done = set == #SHAPES
    if Done then ctx.Log("pointer: the gold arrow is set")
    elseif Tries == TRIES then ctx.Log("pointer: the game did not take the picture, " .. set .. " of " .. #SHAPES .. " shapes set; the Windows arrow stays") end
end

-- the engine keeps the pointer across worlds: nothing to drop
function M.Forget() end

return M

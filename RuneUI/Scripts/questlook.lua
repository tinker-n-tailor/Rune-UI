-- The game's own quest tracker (game 1.0.1, WBP_HUD_QuestList_C) in the look of Rune UI: no dark band behind a quest,
-- our gold line under its name, the name in gold in normal case and its steps in white, in the HUD font with the
-- letters' shadow (letters.lua). The owner picked this look in the game on 14-10-2026, after the mod's old tracker. The game makes an item for each tracked quest (WBP_HUD_QuestListItem_C) and an entry for each of its
-- steps (WBP_HUD_QuestListItem_Entry_C), and fills them again when a quest moves on: each is dressed once, by its full
-- name. The parts are variables of those widgets (seen 14-10-2026). It replaces the mod's own tracker, which read the
-- quest data that 1.0.1 changed. The list moves as the F9 element "questlist" (elements.lua). Sig is the text of the
-- quests and their steps, for the immersive mode: a change brings the list back (immersive.lua).

local M = {}

local GOLD = { R = 1.0, G = 0.638, B = 0.168, A = 1.0 }   -- the pick-up count's gold (pickups.lua)
local WHITE = { R = 1, G = 1, B = 1, A = 1 }
local OFFSET, SHADE = { X = 1.5, Y = 1.5 }, { R = 0, G = 0, B = 0, A = 0.85 }   -- as letters.lua
local EVERY = 1   -- seconds between two looks
local LINE, LINE_GAP = 9, 4   -- units: the gold line's height (as the old tracker's), and its gap under the name
local ITEM, ENTRY = "WBP_HUD_QuestListItem_C", "WBP_HUD_QuestListItem_Entry_C"

M.Done = {}   -- full name of a dressed item or entry -> true (an address can come back for a new object)

local function Ok(w) return w and w:IsValid() end

local function Letters(T, font, colour)
    local fi = T.Font
    fi.FontObject = font
    T:SetFont(fi)
    T:SetColorAndOpacity({ SpecifiedColor = colour, ColorUseRule = 0 })
    T:SetShadowOffset(OFFSET)
    T:SetShadowColorAndOpacity(SHADE)
end

-- Our gold line (goldline.lua) in place of the game's underline (Seperator), which draws no picture of ours: it is a
-- lazy image (seen 14-10-2026). The line goes into the quest's column; the steps (the child after the underline) are
-- taken out and added again after it, as a vertical box adds at its end only.
local function Underline(W, look)
    local sep = W.Seperator
    local column = Ok(sep) and sep:GetParent()
    if not Ok(column) then return end
    -- the list belongs to the game instance and outlives a world, so an item dressed again may hold our line already
    for i = 0, column:GetChildrenCount() - 1 do
        local c = column:GetChildAt(i)
        if Ok(c) and string.find(c:GetFName():ToString(), "^RU_QuestLine") then return end
    end
    local steps = column:GetChildAt(column:GetChildIndex(sep) + 1)
    local was = Ok(steps) and steps.Slot
    if not Ok(was) then return end
    local pad, h = was.Padding, was.HorizontalAlignment
    pad = { Left = pad.Left, Top = pad.Top, Right = pad.Right, Bottom = pad.Bottom }
    local tree = W.WidgetTree
    local function Make(cls, name) return StaticConstructObject(StaticFindObject("/Script/UMG." .. cls), tree, look.G(name)) end
    local box = Make("SizeBox", "RU_QuestLine")
    box:SetHeightOverride(LINE)
    box:SetContent(look.GoldLine.Row(Make, look.Line, "RU_QuestLineHalf"))
    sep:SetVisibility(1)   -- collapsed
    local s = column:AddChildToVerticalBox(box)
    s:SetPadding({ Left = 0, Top = LINE_GAP, Right = 0, Bottom = 0 })
    steps:RemoveFromParent()
    s = column:AddChildToVerticalBox(steps)
    s:SetPadding(pad)
    s:SetHorizontalAlignment(h)
end

local function Item(W, look)
    if Ok(W.Background) then W.Background:SetRenderOpacity(0) end
    local T = W.QuestTitle
    if Ok(T) then
        T:SetTextTransformPolicy(0)   -- the game's title style writes it in capitals: heavy, the owner's word
        local fi = T.Font
        fi.LetterSpacing = 0          -- and the style's 200 spreads the letters
        T:SetFont(fi)
        Letters(T, look.Title, GOLD)
    end
    if look.Line and look.GoldLine then Underline(W, look) end
end

local function Entry(W, look)
    if Ok(W.SubobjectiveDescription) then Letters(W.SubobjectiveDescription, look.Step, WHITE) end
end

local function TextOf(W, part)
    if not (Ok(W) and Ok(W[part])) then return "" end
    local ok, s = pcall(function() return W[part]:GetText():ToString() end)
    return ok and s or ""
end

local function Dress(ctx, class, how, look)
    local list, keys = ctx.Find(class)
    for i, W in ipairs(list) do
        local key = keys[i]
        if not M.Done[key] and Ok(W) then
            M.Done[key] = true
            local ok, err = pcall(how, W, look)
            if not ok and not M.Logged then M.Logged = true ctx.Log("quest list: " .. class .. " not dressed: " .. tostring(err)) end
        end
    end
end

function M.Tick(ctx)
    local now = os.clock()
    if now < (M.Next or 0) then return end
    M.Next = now + EVERY
    local look = { Title = ctx.TitleFont(), Step = ctx.Font(), Line = ctx.Line and ctx.Line(), GoldLine = ctx.GoldLine, G = ctx.G }
    if not (look.Title and look.Step) then return end
    Dress(ctx, ITEM, Item, look)
    Dress(ctx, ENTRY, Entry, look)
    local texts = {}
    for _, W in ipairs((ctx.Find(ITEM))) do texts[#texts + 1] = TextOf(W, "QuestTitle") end
    for _, W in ipairs((ctx.Find(ENTRY))) do texts[#texts + 1] = TextOf(W, "SubobjectiveDescription") end
    M.Sig = #texts > 0 and table.concat(texts, "|") or nil
end

-- a new world: everything is dressed again, and its first error is logged again
function M.Forget() M.Done, M.Logged, M.Next, M.Sig = {}, nil, 0, nil end

return M

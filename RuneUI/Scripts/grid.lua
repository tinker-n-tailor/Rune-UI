-- The grid of the F9 editor: faint lines over the game screen, and a red line through the middle each way. Lines only,
-- nothing snaps to them. editor.lua makes the grid's panel under its own (Build) and hands the view's Grid to Update.
-- The lines are placed when the screen's size changes, not at every step; with the editor closed nothing here runs.

local M = {}

M.CELL = 40   -- HUD units between two lines: 48 across a 16:9 screen (the owner's pick, 11-10-2026)
local FAINT = { R = 1, G = 1, B = 1, A = 0.16 }
local RED = { R = 1, G = 0.07, B = 0.05, A = 0.9 }
local COLLAPSED, UNTOUCHABLE = 1, 3   -- ESlateVisibility; 3: seen, and the mouse goes through it

-- Where the lines of one axis sit, the middle first and then out from it, so a line is always on the middle of the
-- screen. No line on the screen's edge.
function M.Offsets(size, cell)
    local mid = size / 2
    local out = { mid }
    local k = 1
    while k * cell < mid do
        out[#out + 1] = mid - k * cell
        out[#out + 1] = mid + k * cell
        k = k + 1
    end
    return out
end

-- make(class): a new widget in the editor's tree. The grid's panel covers the screen and starts collapsed.
function M.Build(make, canvas)
    local panel = make("CanvasPanel")
    local slot = canvas:AddChildToCanvas(panel)
    slot:SetAutoSize(false)
    panel:SetVisibility(COLLAPSED)
    return { Make = make, Panel = panel, Slot = slot, Down = {}, Across = {}, Key = "" }
end

-- The lines of one axis at their places: at, from Offsets; long, the line's length. A line is made when it is first
-- needed and kept; one that a smaller screen has no place for is collapsed. The first line is the red one, 2 thick.
local function Place(G, lines, at, long, down)
    for i, o in ipairs(at) do
        local L = lines[i]
        if not L then
            local B = G.Make("Border")
            B:SetBrushColor(i == 1 and RED or FAINT)
            L = { W = B, S = G.Panel:AddChildToCanvas(B) }
            L.S:SetAutoSize(false)
            if i == 1 then L.S:SetZOrder(1) end   -- over the faint lines that cross it
            lines[i] = L
        end
        local thick = i == 1 and 2 or 1
        local from = o - thick / 2
        L.S:SetPosition(down and { X = from, Y = 0 } or { X = 0, Y = from })
        L.S:SetSize(down and { X = thick, Y = long } or { X = long, Y = thick })
        L.W:SetVisibility(UNTOUCHABLE)
    end
    for i = #at + 1, #lines do lines[i].W:SetVisibility(COLLAPSED) end
end

-- g: { W, H (the screen, in viewport units), Cell }, or nil for no grid
function M.Update(G, g)
    G.Panel:SetVisibility(g and UNTOUCHABLE or COLLAPSED)
    if not g then return end
    local key = g.W .. "x" .. g.H .. "x" .. g.Cell
    if key == G.Key then return end
    G.Slot:SetPosition({ X = 0, Y = 0 })
    G.Slot:SetSize({ X = g.W, Y = g.H })
    Place(G, G.Down, M.Offsets(g.W, g.Cell), g.H, true)
    Place(G, G.Across, M.Offsets(g.H, g.Cell), g.W, false)
    G.Key = key
end

return M

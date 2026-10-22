// Tests the radial wheels (wheels.lua, wheelparts.lua, wheelspells.lua) against the fake widgets of fake-wheels.js:
// the look is set once, nothing is written while the wheels are closed, the R and Q wheels are watched while open,
// and the row off puts every value back. Needs npm install once. Run: node tools/test-wheels.js
require('./fake-wheels').run(`
local Q, R, H = world.wheels.Q, world.wheels.R, world.wheels.H
local state0 = State(world)
for _, c in ipairs({ Q.cls, R.cls, H.cls }) do hidden[c] = true end
Step()
check("no wheel yet: no search of the images, nothing written", sweeps == 0 and writes == 0)
hidden = {}
R.vis = 4   -- open before their look is on: they must wait for it
Open("Q", true)
local function Looks() local n = 0 for _, W in ipairs({ Q, R, H }) do if File(W.parts.CenterBg) then n = n + 1 end end return n end
Step()
check("the step that first sees the wheels does not search their parts", sweeps == 0 and writes == 0)
Step(0.11)
check("the step that searches the parts reads no picture; an open wheel waits for its look, nothing is written", sweeps == 4 and imports == 0 and writes == 0
    and not Logged("reads open"))
R.vis = 1
Open("Q", false)
Step(0.11)
check("the next step comes after 0.1 s and gives one wheel its look", Looks() == 1)
Step(0.11)
check("one wheel in a step", Looks() == 2)
Step(0.11)
check("the wheels found: one search of images, borders, texts and spacers", sweeps == 4 and Looks() == 3)
local s3 = Q.slices[3]
check("Q: the slot pictures, at the slice's own size", File(s3.Background) == "wheel_q_ring.png" and File(s3.Highlight) == "wheel_q_on.png"
    and File(s3.HighlightDisabled) == "wheel_q_on.png" and s3.Background.match == false and s3.Background.Brush.ImageSize.X == 100)
check("a picture is loaded once for a wheel, with the wheel as its owner", imports == 11 and s3.Background.Brush.ResourceObject.outer == Q
    and Q.slices[7].Background.Brush.ResourceObject == s3.Background.Brush.ResourceObject)
check("Q: the ring's colour is full, its tint stays the game's", s3.Background.ColorAndOpacity.A == 1 and s3.Background.Brush.TintColor.SpecifiedColor.A == 0.3)
check("R and H: unpicked rings at full strength", R.slices[1].Background.Brush.TintColor.SpecifiedColor.A == 1 and H.slices[1].Background.Brush.TintColor.SpecifiedColor.A == 1)
check("nothing behind the rings, the colour kept", Q.parts.RadialBase.ColorAndOpacity.A == 0 and Q.parts.RadialBase.ColorAndOpacity.R == 0.9
    and Q.parts.Pointer.ColorAndOpacity.A == 0 and R.parts.RadialBase.ColorAndOpacity.A == 0 and H.parts.RadialBase.ColorAndOpacity.A == 0)
check("Q: all three dividers of the middle are gone, the book stays", Q.parts.LineImage_Top.ColorAndOpacity.A == 0 and Q.parts.LineImage_Middle.ColorAndOpacity.A == 0
    and Q.parts.LineImage_Bottom.ColorAndOpacity.A == 0 and Q.book.ColorAndOpacity.A == 0.8 and File(Q.book) == nil)
check("Q: each page arrow has our picture at full strength, at the game's size, moved towards the middle", File(Q.arrowL.pic) == "wheel_arrow.png" and File(Q.arrowR.pic) == "wheel_arrow.png"
    and Q.arrowL.button.op == 1 and Q.arrowR.button.op == 1 and Q.arrowL.pic.Brush.ImageSize.X == 64 and Q.arrowL.pic.match == false
    and Q.arrowL.op == 1 and Q.arrowL.RenderTransform.Translation.X == 130 and Q.arrowR.RenderTransform.Translation.X == -130)
check("Q: the key boxes are unseen through their overlay; only the first box is read, for its parent", Q.keyHolder.op == 0 and Q.keys[2].n == 0 and Q.keys[8].n == 0
    and Q.keys[4].RenderTransform.Translation.X == 285)
check("the middle ring, solid on Q", File(Q.parts.CenterBg) == "wheel_c_q.png" and Q.parts.CenterBg.enabled == true and Q.parts.CenterBg.ColorAndOpacity.A == 0.8
    and File(R.parts.CenterBg) == "wheel_c_r.png" and File(H.parts.CenterBg) == "wheel_c_h.png")
check("Q: the shade under the wheel, the header bar unseen", File(Q.shade) == "wheel_q_shade.png" and Q.shade.BrushColor.A == 1 and Q.shade.BrushColor.R == 1
    and Q.head.BrushColor.A == 0 and File(Q.head) == nil)
check("the game's sparks are not written", Q.sparks.vis == 3 and Q.fuse.vis == 3 and Q.slotSparks[1].vis == 3 and world.otherSparks.vis == 3 and #Q.sparks.MaterialRemapList.list == 1)
check("the names keep the game's title font; the spell name stands still", Q.SpellName.Font.FontObject == amiri and Q.SpellName.bIsScrollingEnabled == false
    and R.ItemName.Font.FontObject == amiri and H.EmoteName.Font.FontObject == amiri and R.ItemName.RenderTransform.Scale.X == 1)
check("Q: a long spell name is not cut: a wider box, a smaller text", Q.nameBox.WidthOverride == 232 and math.abs(Q.SpellName.RenderTransform.Scale.X - 158 / 230) < 0.001
    and Q.SpellName.RenderTransform.Scale.Y == Q.SpellName.RenderTransform.Scale.X and Q.SpellName.RenderTransformPivot.X == 0.5)
check("Q: the small texts in the HUD font, their size kept", Q.NoCostTextBlock.Font.FontObject == poppins and Q.NoCostTextBlock.Font.Size == 18
    and Q.label.Font.FontObject == poppins and Q.label.Font.Size == 20 and Q.req.Font.FontObject == poppins and Q.req.Font.Size == 15)
check("Q: the label is smaller, the requirement fits as it is, the game's colours stay", Q.label.RenderTransform.Scale.X == 0.75 and Q.label.RenderTransformPivot.Y == 0.5
    and Q.req.RenderTransform.Scale.X == 0.82 and Q.req.ColorAndOpacity.SpecifiedColor.G == 0.2 and Q.label.ColorAndOpacity.SpecifiedColor.A == 1)
check("Q: the middle is tighter, the other sides of each padding kept", Q.nameBox.Slot.Padding.Bottom == 137 and Q.nameBox.Slot.Padding.Left == 1
    and Q.reqBox.Slot.Padding.Top == 122 and Q.reqBox.Slot.Padding.Bottom == 145)
check("Q: the rune cost widget is never read, nothing under CostBox is walked", Q.cost.n == 0 and walks == 0)
check("Q: the rune cost row is smaller and 5 units down; the dash keeps its size", Q.costBox.RenderTransform.Scale.X == 0.72 and Q.costBox.RenderTransform.Scale.Y == 0.72
    and Q.costBox.RenderTransformPivot.X == 0.5 and Q.costBox.RenderTransformPivot.Y == 0.5
    and Q.costBox.RenderTransform.Translation.X == 0 and Q.costBox.RenderTransform.Translation.Y == 5
    and math.abs(Q.NoCostTextBlock.RenderTransform.Scale.X * 0.72 - 1) < 1e-9 and Q.NoCostTextBlock.RenderTransformPivot.Y == 0.5)
check("Q: the dash stays where it was: its own move cancels the box's move in the box's scaled space",
    math.abs(Q.NoCostTextBlock.RenderTransform.Translation.Y * 0.72 + Q.costBox.RenderTransform.Translation.Y) < 1e-9 and Q.NoCostTextBlock.RenderTransform.Translation.X == 0)
check("Q: the numbers of the rune cost in the HUD font, their size kept", Q.amounts[1].Font.FontObject == poppins and Q.amounts[2].Font.FontObject == poppins and Q.amounts[1].Font.Size == 14)
local function Under(v) for _, T in ipairs(Q.under) do if T.vis ~= v then return false end end return true end
check("Q: the cooldown words under the wheel are collapsed, nothing else", Under(1) and Q.otherSpacer.vis == 4 and Q.RadialSlice_3.CooldownWidget.CooldownText.vis == 4)
local cd = Q.RadialSlice_3.CooldownWidget
check("Q: the cooldown is a gold arc on the slot's ring", cd.RenderTransform.Scale.X == 2.6 and cd.RenderTransform.Translation.X == 35.75 and cd.RenderTransform.Translation.Y == 32
    and cd.RenderTransformPivot.X == 0.5 and cd.TimerRing.ColorAndOpacity.R == 0.76 and cd.TimerRing.op == 1
    and cd.BackgroundRing.op == 0 and cd.IconImage.op == 0 and cd.CooldownText.op == 0)
check("Q: the game still shows and hides the cooldown itself", cd.vis == 1)
check("R: a long item name goes to a second line inside the ring; the other names keep the game's width", R.ItemName.WrapTextAt == 160 and H.EmoteName.WrapTextAt == 0 and Q.SpellName.WrapTextAt == 0)
check("H: smaller icons; Q: icons as they are", H.slices[2].SliceIcon.RenderTransform.Scale.X == 0.58 and s3.SliceIcon.RenderTransform.Scale.X == 1)
check("R: no orange frame on the item in hand", R.slots[2].EquippedImage.ColorAndOpacity.A == 0 and R.slots[2].EquippedImage.ColorAndOpacity.R == 0.9)
check("the spell book's wheel is not touched", world.book.n == 0 and world.bookSlice.Brush.ResourceObject.full == "Texture2D /Game/UI/T_Slice")

local w0, i0 = writes, imports
for _ = 1, 5 do Step() end
check("closed wheels: nothing written, no search, no picture read", writes == w0 and sweeps == 4 and imports == i0)
Open("Q", true)
Q.SpellName.want, Q.req.want = 150, 200
Q.under[2].vis = 4   -- the game shows one of the words again
Step() Step(0.11)
check("Q open: a cooldown word that the game showed again is collapsed", Under(1))
check("Q open: a short name at full size in the game's box, a long requirement made smaller", Q.SpellName.RenderTransform.Scale.X == 1 and Q.nameBox.WidthOverride == 175
    and Q.req.RenderTransform.Scale.X == 0.8 and Logged("the Q wheel reads open"))
local nums = Q.keyHost.added or {}
local function Num(i) return nums[i] and nums[i].child end
check("Q open: eight number badges where the key boxes were, on top of each ring", #nums == 8 and Num(1).RenderTransform.Translation.Y == -244
    and Num(4).RenderTransform.Translation.X == 247 and Num(8).RenderTransform.Translation.X == -131 and Num(1).vis == 3 and Num(8).vis == 3 and nums[1].HorizontalAlignment == 2)
local txt = Num(1).added[2].child
check("Q open: a badge is our picture with the slot's number in dark ink, in the HUD font", File(Num(1).added[1].child) == "wheel_key.png" and txt.text == "1"
    and Num(8).added[2].child.text == "8" and txt.ColorAndOpacity.SpecifiedColor.G == 0.0176 and txt.Font.FontObject == poppins and txt.Font.Size == 10 and txt.justify == 1
    and txt.RenderTransform.Translation.X == 0.6 and Num(4).added[2].child.RenderTransform.Translation.X == 0.2)
w0 = writes
for _ = 1, 4 do Step(0.11) end
check("Q open, the same spell: nothing written", writes == w0)
Q.keyHolder.op = 1   -- the game shows the key boxes again
Step(0.11)
check("Q open: key boxes that the game showed again are unseen within a fast step, nothing else written", Q.keyHolder.op == 0 and writes == w0 + 1)
pad = true
Step(0.11)
check("Q open on a gamepad: no number badges, as the keys 1 to 8 are no buttons there", Num(1).vis == 1 and Num(8).vis == 1)
pad = false
Step(0.11)
check("back on the keyboard: the number badges again", Num(1).vis == 3 and Num(8).vis == 3 and #nums == 8)
w0 = writes
Open("Q", false)
Q.SpellName.want = 230
Step(0.11) Step()
check("Q closed: the texts are not looked at", writes == w0 and Q.SpellName.RenderTransform.Scale.X == 1)
Q.SpellName.want, Q.req.want = 150, 200
check("closed: the dark squares are the game's", R.slots[0].ItemImage.Brush.ResourceObject.scalars["Background Opacity"] == 1)

local function Zero(i) for _, name in ipairs(SQUARE) do if R.slots[i].ItemImage.Brush.ResourceObject.scalars[name] ~= 0 then return false end end return true end
R.vis = 4
Step()
check("R open: no dark square behind an item", Zero(0) and Zero(1) and Zero(2) and File(R.slots[3].ItemImage) == nil)
check("R open: the ring of the item in hand", File(R.slices[2].Background) == "wheel_r_hand.png" and R.slices[2].Background.match == false
    and R.slices[2].Background.Brush.ResourceObject.outer == R.slices[2].Background and File(R.slices[1].Background) == "wheel_r_ring.png")
w0, i0 = writes, imports
for _ = 1, 4 do Step(0.11) end
check("R open, nothing new: nothing written", writes == w0 and imports == i0)
R.slots[0].ItemImage.Brush.ResourceObject.scalars["Background Opacity"] = 1
Step(0.11)
check("R open: a square the game drew again is gone within a fast step", Zero(0) and writes == w0 + 5)
R.slices[6].Background.Brush.TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 0.3 }, ColorUseRule = 1 }
Step(0.11)
check("R open: a ring the game made faint is at full strength again", R.slices[6].Background.Brush.TintColor.SpecifiedColor.A == 1)
R.slots[2].EquippedImage.vis, R.slots[5].EquippedImage.vis = 1, 4
Step(0.11)
check("R open: another item in hand moves the ring", File(R.slices[2].Background) == "wheel_r_ring.png" and File(R.slices[5].Background) == "wheel_r_hand.png")
check("the ring of the hand is read from the disk once: the move reads nothing", imports == i0
    and R.slices[2].Background.Brush.ResourceObject == R.slices[1].Background.Brush.ResourceObject)
-- no item in hand: no brush holds the picture, and the engine frees it
local freed = R.slices[5].Background.Brush.ResourceObject
R.slots[5].EquippedImage.vis = 1
Step(0.11)
freed.valid = false
R.slots[5].EquippedImage.vis = 4
Step(0.11)
check("a picture that the engine freed is read again, not put on a brush", imports == i0 + 1 and File(R.slices[5].Background) == "wheel_r_hand.png"
    and R.slices[5].Background.Brush.ResourceObject ~= freed)
R.vis = 1
for i = 0, 2 do for k, name in ipairs(SQUARE) do R.slots[i].ItemImage.Brush.ResourceObject.scalars[name] = k == 1 and 1 or 0.5 end end
w0 = writes
Step(0.11) Step()
check("R closed again: nothing written", writes == w0 and not Zero(0))

R.slots[2].EquippedImage.vis, R.slots[5].EquippedImage.vis = 4, 1   -- the game's own state as at the start
R.vis = 4
Step()
R.vis, on = 1, false
Step()
check("the row off: every value is the game's again", State(world) == state0 and Logged("the game's look is back"))
check("the row off: the item name wraps at the game's width again", R.ItemName.WrapTextAt == 220)
check("the row off: the page arrows have the game's picture and strength again, the number badges are not seen", Q.arrowL.pic.Brush.ResourceObject.full == "Texture2D /Game/UI/T_Arrow_Big"
    and Q.arrowR.pic.Brush.ResourceObject.full == "Texture2D /Game/UI/T_Arrow_Big" and Q.arrowL.button.op == 0.8 and Q.arrowR.button.op == 0.8 and Num(1).vis == 1 and Num(8).vis == 1)
check("the row off: the three dividers of the middle are the game's again", Q.parts.LineImage_Top.ColorAndOpacity.A == 0.8 and Q.parts.LineImage_Middle.ColorAndOpacity.A == 0.8 and Q.parts.LineImage_Bottom.ColorAndOpacity.A == 0.8)
check("the row off: the rune cost row and the dash are at the game's scale and place again", Q.costBox.RenderTransform.Scale.X == 1 and Q.NoCostTextBlock.RenderTransform.Scale.X == 1 and Q.costBox.RenderTransformPivot.X == 0
    and Q.costBox.RenderTransform.Translation.Y == 0 and Q.NoCostTextBlock.RenderTransform.Translation.Y == 0)
check("the row off: a box that had no picture has none again", Q.shade.Background.ResourceObject == nil)
w0 = writes
Step() Step()
check("the row off: nothing more is written", writes == w0)
on = true
Build()
check("the row on again: our look, without a new search", File(s3.Background) == "wheel_q_ring.png" and cd.BackgroundRing.op == 0 and sweeps == 4)
R.vis = 4
Step()
check("the row on again: the ring of the item in hand comes back", File(R.slices[2].Background) == "wheel_r_hand.png" and Zero(1))
R.vis = 1

w0 = writes
M.Forget(true)
Step() Step()
check("a respawn keeps the widgets and the look: nothing written, no search", writes == w0 and sweeps == 4)

local old, calls = world, Calls(world)
M.Forget(false)
world = World(2)
local state2 = State(world)
Build() Step()
check("a new world: no call on the old widgets", Calls(old) == calls)
check("a new world: its wheels get the look", File(world.wheels.Q.slices[0].Background) == "wheel_q_ring.png" and sweeps == 8)
-- the game makes one wheel anew: the two that live on are found again and must not keep our values as the game's
world.wheels.R.valid = false
Step() Build(11)
check("a wheel that is gone: the others get the look again, no error", File(world.wheels.Q.slices[0].Background) == "wheel_q_ring.png" and not Logged("failed"))
on = false
Step()
check("a wheel that is gone: the row off still gives the game's values", State(world) == state2)
on = true

-- a wheel that the game does not have, and a picture that is not on the disk
M.Forget(false)
world, logs = World(3), {}
hidden[world.wheels.H.cls], missing["wheel_r_on.png"] = true, true
sweeps = 0
Step()
check("a missing wheel: the others wait for it", sweeps == 0 and File(world.wheels.Q.slices[0].Background) == nil)
Build(11)
check("a missing wheel: the others get the look after the wait", File(world.wheels.Q.slices[0].Background) == "wheel_q_ring.png"
    and File(world.wheels.R.slices[0].Background) == "wheel_r_ring.png" and File(world.wheels.H.slices[0].Background) == nil)
check("a missing picture: its image keeps the game's, with one log line", File(world.wheels.R.slices[0].Highlight) == nil
    and world.wheels.R.slices[0].Highlight.Brush.ResourceObject.full == "Texture2D /Game/UI/T_SliceOn" and Logged("picture missing")
    and Logged("wheels: Q: the switcher of the panel comes from the search of the parts") and #logs == 3)
local function PictureLine() for _, m in ipairs(logs) do if m:find("picture missing", 1, true) then return m end end end
check("a missing picture: the log line names the file and carries no line number of main.lua", PictureLine() and PictureLine():find("wheel_r_on.png", 1, true) and not PictureLine():find("%.lua:%d+") and not PictureLine():find("%]:%d+:"))
hidden = {}
Step()
check("a wheel that comes late waits: two searches are 5 s apart at least", sweeps == 4)
Build(6)
check("a wheel that comes late gets the look, with one more search", File(world.wheels.H.slices[0].Background) == "wheel_h_ring.png" and sweeps == 6)
for _ = 1, 20 do Step() end
check("no search after that", sweeps == 6)

-- slots that the game has not built yet, and the HUD font not loaded yet
M.Forget(false)
world, logs, font, sweeps = World(4), {}, nil, 0
Q, R, H = world.wheels.Q, world.wheels.R, world.wheels.H
world.veil = "EmoteRadialWidget.WidgetTree_2.RadialSlice"
Build(6)
check("a wheel with no slot yet is not taken", Logged("H 0 slots") and File(H.parts.CenterBg) == nil and File(Q.slices[0].Background) == "wheel_q_ring.png")
world.veil = nil
Build(6)
check("its slots come: it gets the look", File(H.slices[0].Background) == "wheel_h_ring.png" and File(H.parts.CenterBg) == "wheel_c_h.png")
check("no font yet: the small texts wait, the rest of the middle has its look", Q.label.Font.FontObject == amiri and Q.label.RenderTransform.Scale.X == 0.75)
font = poppins
Step()
check("the font is not asked for on every step", Q.label.Font.FontObject == amiri)
Step(10)
check("the font came: the small texts get it", Q.label.Font.FontObject == poppins and Q.req.Font.FontObject == poppins and Q.NoCostTextBlock.Font.FontObject == poppins)
w0 = writes
Step(11) Step(11)
check("the texts are not written again", writes == w0)

-- one slot of the R wheel fails: the other slots still get their look
R.slots[0].EquippedImage.boom = true
R.vis = 4
Step()
check("R open: an error on one slot does not stop the others", R.slots[1].ItemImage.Brush.ResourceObject.scalars["Background Opacity"] == 0
    and File(R.slices[2].Background) == "wheel_r_hand.png" and Logged("a slot of the R wheel failed"))
R.slots[0].EquippedImage.boom, R.vis = nil, 1

-- the place of a widget went to another object: the row off does not write into it
Q.parts.Pointer.full = "Image /Engine/Transient.GameEngine_0:Another.WidgetTree_0.Image_7"
on = false
Step()
check("the row off: no write into an object of another name", Q.parts.Pointer.ColorAndOpacity.A == 0 and Q.parts.RadialBase.ColorAndOpacity.A == 0.8)
on = true

-- a wheel whose name never holds: the searches stay 5 s apart, 3 in a world at most
M.Forget(false)
world, logs = World(5), {}
local function Searches() local n = 0 for _, m in ipairs(logs) do if string.find(m, "parts searched", 1, true) then n = n + 1 end end return n end
Step()
for n = 1, 6 do world.wheels.R.full = world.wheels.R.full .. "x" Step() end
check("lost wheels: no second search within 5 s", Searches() == 1)
for n = 1, 60 do world.wheels.R.full = world.wheels.R.full .. "x" Step() end
check("lost wheels: 3 searches in a world at most", Searches() == 3)

-- Q and H keep visibility 4 closed or open. Their panel and its switcher tell which is open (probe of 07-10-2026).
local function Count(text) local n = 0 for _, m in ipairs(logs) do if string.find(m, text, 1, true) then n = n + 1 end end return n end
local function Fresh(n, setup)
    M.Forget(false)
    world, logs, hidden, switchSearches = World(n), {}, {}, 0
    if setup then setup(world) end
    Q = world.wheels.Q
    Q.SpellName.want, Q.req.want = 150, 200
    Build()
    Q.under[2].vis = 4   -- the game shows a cooldown word: an open Q wheel is looked at, and it is collapsed again
end
local function Looked() Step(0.6) return Q.under[2].vis == 1 end
Fresh(6)
check("the panel is collapsed, Q at visibility 4: Q is closed, no look, no log line", Q.vis == 4 and world.panel.vis == 1 and not Looked() and not Logged("reads open"))
Open("Q", true)
check("the panel shows, the switcher on page 0: Q is open, one log line", Looked() and Logged("reads open") and Count("reads open") == 1)
Q.under[2].vis = 4
Step(0.11)
check("Q open: the next look comes after 0.1 s", Q.under[2].vis == 1)
Open("H", true)
Q.under[2].vis = 4
check("the panel shows, the switcher on page 1: that is H, Q is closed", not Looked() and Q.vis == 4)
Open("Q", false)
check("the panel collapsed again with page 0 kept: Q is closed", not Looked())
Open("Q", true)
check("Q opens again, the log line is not repeated", Looked() and Count("reads open") == 1)
check("the switcher came from the search of the parts, once, and the search ran once", Count("comes from the search of the parts") == 1 and switchSearches == 1)

Fresh(12, function(w) table.remove(w.wheels.Q.CenterBox.kids, 1) end)
check("no CostBox: its name is in the log, nothing else of the middle is lost", Logged("Q: not found: CostBox") and Q.NoCostTextBlock.RenderTransform.Scale.X == 1
    and Q.nameBox.Slot.Padding.Bottom == 137 and walks == 0)

Fresh(13, function(w) w.wheels.Q.costBox.noScale = true end)
check("the game refuses the scale of CostBox: logged, the row and the dash stay at the game's scale, the dash's move follows the box's move at scale 1, the rest of the middle is done",
    Logged("Scale of Q/CostBox") and Q.costBox.RenderTransform.Scale.X == 1 and Q.NoCostTextBlock.RenderTransform.Scale.X == 1 and Q.NoCostTextBlock.RenderTransformPivot.X == 0
    and Q.costBox.RenderTransform.Translation.Y == 5 and Q.NoCostTextBlock.RenderTransform.Translation.Y == -5
    and Q.nameBox.Slot.Padding.Bottom == 137 and Q.NoCostTextBlock.Font.FontObject == poppins)

Fresh(15, function(w) w.wheels.Q.costBox.noMove = true end)
check("the game refuses the move of CostBox: logged, the row is smaller, the dash's scale follows the box's scale, the dash gets no move",
    Logged("Move of Q/CostBox") and Q.costBox.RenderTransform.Scale.X == 0.72 and Q.costBox.RenderTransform.Translation.Y == 0
    and math.abs(Q.NoCostTextBlock.RenderTransform.Scale.X * 0.72 - 1) < 1e-9 and Q.NoCostTextBlock.RenderTransform.Translation.Y == 0 and Q.NoCostTextBlock.RenderTransformPivot.X == 0.5
    and Q.nameBox.Slot.Padding.Bottom == 137)

Fresh(14, function(w) w.wheels.Q.NoCostTextBlock = nil end)
check("no dash: its name is in the log, the row is still made smaller", Logged("Q: not found: NoCostTextBlock") and Q.costBox.RenderTransform.Scale.X == 0.72 and not Logged("not found: CostBox")
    and Q.nameBox.Slot.Padding.Bottom == 137)

Fresh(7, function(w) w.wheels.Q.outer = nil end)
Open("Q", true)
check("no panel above the wheel: Q is closed, one log line, nothing looked at", not Looked() and not Looked() and Count("panel of the wheel was not found") == 1 and not Logged("reads open"))

Fresh(8, function(w) w.panel.WidgetSwitcher, w.veil = nil, "WidgetSwitcher" end)
Open("Q", true)
check("no switcher in the search or on the panel: Q is closed, one log line", not Looked() and not Looked() and Count("switcher of the panel was not found") == 1 and not Logged("reads open"))

Fresh(9, function(w) w.panel.WidgetSwitcher = nil end)
Open("Q", true)
check("the switcher from the search alone: Q is open", Looked() and Logged("comes from the search of the parts"))

Fresh(10, function(w) w.veil = "WidgetSwitcher" end)
Open("Q", true)
check("the switcher from the panel's variable alone: Q is open", Looked() and Logged("comes from the panel's variable") and not Logged("search of the parts"))

Fresh(11)
Open("Q", true)
Looked()
local path = string.match(world.panel.full, "^%S+%s+(.*)$")
world.panel.full = "WBP_Spellcasting_MainPanel_C /Engine/Transient.GameEngine_0:Another.WidgetTree_0.Panel_9"
Q.under[2].vis = 4
check("the panel is another object now: Q is closed, one log line", not Looked() and Count("panel of the wheel was not found") == 1)
local panel2 = Obj("WBP_Spellcasting_MainPanel_C", path, { vis = 4 })
panel2.WidgetSwitcher = world.switcher
world.panelTree.outer = panel2
Q.under[2].vis = 4
check("a new panel of the right name above the wheel is found again: Q is open", Looked())
world.switcher.full = "WidgetSwitcher /Engine/Transient.GameEngine_0:Another.WidgetTree_0.WidgetSwitcher_9"
Q.under[2].vis = 4
check("the switcher is another object now: Q is closed, one log line", not Looked() and Count("switcher of the panel was not found") == 1)
panel2.WidgetSwitcher = Obj("WidgetSwitcher", path .. ".WidgetTree_1.WidgetSwitcher", { idx = 0 })
Q.under[2].vis = 4
check("a new switcher of the right name on the panel is found again: Q is open", Looked() and Count("comes from the panel's variable") == 1)

-- the walk counter sees every way into the rune cost widgets, so the test "nothing under CostBox is walked" guards what it says
local before = walks
local _ = Q.costBox.WidgetTree
Q.costBox:GetContent()
Q.cost:GetChildrenCount()
Q.cost:GetChildAt(0)
check("the walk counter counts a read of .WidgetTree, GetContent, GetChildrenCount and GetChildAt", walks == before + 4)

`);

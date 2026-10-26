// Tests the four spellbook diamonds in the header of the Q wheel (wheelbooks.lua, and the search for their marks in
// wheels.lua and wheelparts.lua) against the fake widgets of fake-wheels.js. Needs npm install once.
// Run: node tools/test-wheelbooks.js
require('./fake-wheels').run(`
local state0 = State(world)
local Q = world.wheels.Q
Build()
local function Count(text) local n = 0 for _, m in ipairs(logs) do if string.find(m, text, 1, true) then n = n + 1 end end return n end
-- the pictures made since from, without the diamonds of the key numbers that the Q wheel also makes
local function Books(from) local n = 0 for _, o in ipairs(Made("Image", from)) do if not string.find(o.full, "Made.RU_WheelKey", 1, true) then n = n + 1 end end return n end
-- the row of a Q wheel: its box, and its diamonds in use and not in use, by the book they stand for
local function Row(W)
    local box = W.headBox.added[#W.headBox.added].child
    local ins, outs = {}, {}
    for _, s in ipairs(box.content.added) do
        local k = s.Padding.Left // 22 + 1
        if File(s.child) == "wheel_book_on.png" then ins[k] = s.child else outs[k] = s.child end
    end
    return box, ins, outs
end
-- the books as the row shows them: X for the book in use (its gold diamond seen), - for the others
local function Seen(box, ins, outs)
    local t = {}
    for k = 1, 4 do t[k] = (ins[k].vis == 3 and outs[k].vis == 1 and "X") or (ins[k].vis == 1 and outs[k].vis == 3 and "-") or "?" end
    return box.vis == 3 and table.concat(t) or "row not seen"
end
local function Marks(a, b, c, d) Q.marks[1].vis, Q.marks[2].vis, Q.marks[3].vis, Q.marks[4].vis = a, b, c, d end

check("Q closed: no diamonds are made, the header is not touched", Books() == 0 and Q.headBox.added == nil)
Open("Q", true)
Step()
Step(0.11)
local box, ins, outs = Row(Q)
check("the Q wheel opens: a row of four diamonds in use and four not in use, in the header's overlay", Books() == 8 and #Q.headBox.added == 1
    and #box.content.added == 8 and ins[4] and outs[4] and box.outer == Q.headTree and ins[1].outer == Q.headTree)
check("the row is centred in the header and moved by its constant; the places are 22 apart", Q.headBox.added[1].HorizontalAlignment == 2 and Q.headBox.added[1].VerticalAlignment == 2
    and box.RenderTransform.Translation.Y == 78 and box.RenderTransform.Translation.X == 0 and box.WidthOverride == 82 and box.HeightOverride == 16
    and box.content.added[1].Padding.Left == 0 and box.content.added[8].Padding.Left == 66)
check("each diamond is 16 units with its picture on the brush; one texture for each picture", ins[1].Brush.ImageSize.X == 16 and outs[1].Brush.ImageSize.Y == 16
    and ins[1].Brush.ResourceObject == ins[4].Brush.ResourceObject and outs[1].Brush.ResourceObject == outs[3].Brush.ResourceObject
    and ins[1].Brush.ResourceObject ~= outs[1].Brush.ResourceObject and ins[1].Brush.ResourceObject.outer == Q.headTree and imports == 14)
check("the leftmost diamond is the button with the highest number, so the book in use (visibility 0) is the first: gold, the others small",
    Seen(box, ins, outs) == "X---")
check("one log line with the marks, highest number first, although the buttons were made in another order",
    Count("4 spellbook marks, in the order of their names, highest number first: WBP_DomSpellWheelNavButton_C_2147470346, WBP_DomSpellWheelNavButton_C_2147470343, WBP_DomSpellWheelNavButton_C_2147470340, WBP_DomSpellWheelNavButton_C_2147470337") == 1)

Marks(1, 0, 1, 1)
Step(0.11)
check("the book in use follows the mark with visibility 0", Seen(box, ins, outs) == "-X--")
Marks(2, 1, 3, 2)
Step(0.11)
check("a hidden mark is not shown, the hit-test-invisible kind is", Seen(box, ins, outs) == "--X-")
Marks(1, 2, 1, 2)
Step(0.11)
check("no mark shows (hidden 2 and collapsed 1): no book in use, all four diamonds small", Seen(box, ins, outs) == "----")
Marks(0, 0, 1, 1)
Step(0.11)
check("two marks show: the first is the book in use", Seen(box, ins, outs) == "X---")
check("the first good read is logged once, with the book; a count other than one is logged once, the first time",
    Count("the spellbook mark 1 of 4 shows, WBP_DomSpellWheelNavButton_C_2147470346") == 1 and Count("0 spellbook marks show") == 1 and Count("spellbook marks show") == 1)
Marks(1, 1, 1, 0)
Step(0.11)
check("visibility 0 on the lowest number is the fourth book", Seen(box, ins, outs) == "---X")
local w0, made0 = writes, #made
for _ = 1, 5 do Step(0.11) end
check("nothing changed: nothing written, nothing made", writes == w0 and #made == made0)

-- the row off: ours collapsed, the game's values as they were; on again: the same row shows the book in use now
Marks(0, 1, 1, 1)
Open("Q", false)
on = false
Step()
check("the row off: our row is collapsed, every value of the game is as it was", box.vis == 1 and not box.removed and State(world) == state0)
Marks(1, 1, 1, 0)
on = true
Open("Q", true)
Step()
Step(0.11)
check("the row on again: the same row shows the book in use now, none is made twice", Seen(box, ins, outs) == "---X" and Books() == 8 and #Q.headBox.added == 1)
Marks(0, 1, 1, 1)
Step(0.11)

-- the place of one of our widgets went to another object: no write into it, the rest goes, a new row is made
local impostor = box.content.added[3].child
impostor.vis = 2
impostor.full = "Image /Engine/Transient.GameEngine_0:Another.WidgetTree_0.Image_9"
Step(0.11)
local box2, ins2, outs2 = Row(Q)
check("a changed full name: no write into that object, the old row is taken out, one new row with the right state", impostor.vis == 2 and box.removed and #Q.headBox.added == 2
    and box2 ~= box and Seen(box2, ins2, outs2) == "X---" and Books() == 16)
Step(0.11)
check("then it stays: nothing made", #Q.headBox.added == 2 and Books() == 16)
check("the row is made again: the line with the order of the marks is not logged again", Count("in the order of their names") == 1)

-- a wheel is gone while the others live on: our row is taken out of the wheel that lives on; found again, one new row
world.wheels.H.valid = false
Step()
check("a wheel that lives on: our row is taken out of it", box2.removed)
world.wheels.H.valid = true
Open("Q", false)
Step(11)
Open("Q", true)
Step()
Step(0.11)
local live = 0
for _, s in ipairs(Q.headBox.added) do if not s.child.removed then live = live + 1 end end
check("the wheels are found again: one new row, no second set", live == 1 and #Q.headBox.added == 3 and Seen(Row(Q)) == "X---")

-- the Q wheel itself is gone: its widgets and ours on it went with it, and nothing is called on them
local last = Row(Q)
local ours, calls = {}, 0
for _, o in ipairs(made) do if o.outer == Q.headTree then ours[#ours + 1] = o calls = calls + o.n end end
Q.valid = false
Step()
Step(0.6)
local after = 0
for _, o in ipairs(ours) do after = after + o.n end
check("the Q wheel is gone: no call on its row", after == calls and not last.removed)

-- a new world with only three marks: no diamonds, one log line, the rest of the wheel has its look
M.Forget(false)
world, logs = World(2), {}
local count = #made
world.veil = "NavButton_C_2147470337"
Step()
Open("Q", true)
Step()
for _ = 1, 6 do Step(0.11) end
check("three marks: no diamonds, the header is not touched, one log line with the names", Books(count) == 0 and world.wheels.Q.headBox.added == nil
    and Count("no spellbook diamonds: 3 spellbook marks found, not 4: WBP_DomSpellWheelNavButton_C_2147470346, WBP_DomSpellWheelNavButton_C_2147470343, WBP_DomSpellWheelNavButton_C_2147470340") == 1)
check("three marks: the rest of the wheel has its look", File(world.wheels.Q.slices[0].Background) == "wheel_q_ring.png")

-- five marks are not four either
M.Forget(false)
world, logs = World(3), {}
count = #made
local first = world.wheels.Q.marks[1]
local extra = setmetatable({}, getmetatable(first))
for k, v in pairs(first) do extra[k] = v end
extra.full = string.gsub(first.full, "_C_2147470346", "_C_2147470349")
table.insert(world.byClass.Image, extra)
Step()
Open("Q", true)
Step() Step(0.11)
check("five marks: no diamonds, one log line", Books(count) == 0 and Count("5 spellbook marks found, not 4") == 1)

-- the header cannot take our row: logged once, tried once
M.Forget(false)
world, logs = World(4), {}
count = #made
world.wheels.Q.headBox.AddChildToOverlay = function() error("the game refused the call") end
Step()
Open("Q", true)
Step()
for _ = 1, 5 do Step(0.11) end
check("a row that cannot be added: one log line, one try", Count("no spellbook diamonds: ") == 1 and #Made("SizeBox", count) == 1 and world.wheels.Q.headBox.added == nil)

-- the switch constant
M.Forget(false)
world, logs = World(5), {}
count = #made
ctx.Books = load((string.gsub(BOOKSTEXT, "local BOOKS = true", "local BOOKS = false")))()
Step()
Open("Q", true)
Step()
for _ = 1, 3 do Step(0.11) end
check("BOOKS = false: no diamonds, no log line", Books(count) == 0 and world.wheels.Q.headBox.added == nil and Count("spellbook") == 0)
ctx.Books = load(BOOKSTEXT)()
ctx.Books.Init(ctx.Parts)

-- Q open in a new world, its row built
local function Fresh(n, setup)
    M.Forget(false)
    world, logs = World(n), {}
    count = #made
    if setup then setup(world.wheels.Q) end
    Step()
    Open("Q", true)
    Step() Step(0.11)
    return world.wheels.Q
end

-- a mark went to another object: the row is taken out, one log line, and no new row from the same marks
local Q6 = Fresh(6)
local box6 = Row(Q6)
Q6.marks[2].full = "Image /Engine/Transient.GameEngine_0:Another.WidgetTree_0.Image_7"
for _ = 1, 4 do Step(0.11) end
check("a mark that is another object: the row is taken out, one log line, no new row", box6.removed and #Q6.headBox.added == 1 and Books(count) == 8 and Count("another object now") == 1)

-- a diamond and a mark are other objects together: Build checks the marks too, so no new row
local Q7 = Fresh(7)
local box7 = Row(Q7)
box7.content.added[3].child.full = "Image /Engine/Transient.GameEngine_0:Another.WidgetTree_0.Image_9"
Q7.marks[3].full = "Image /Engine/Transient.GameEngine_0:Another.WidgetTree_0.Image_8"
Step(0.11)
check("a diamond and a mark that are other objects: the old row is out, no new row is made from a stale mark, one log line", box7.removed and #Q7.headBox.added == 1
    and Books(count) == 8 and Count("another object now") == 1)

-- a write that fails halfway is tried again on the next look
local Q8 = Fresh(8)
local box8, ins8, outs8 = Row(Q8)
Q8.marks[1].vis, Q8.marks[2].vis = 1, 0
ins8[2].SetVisibility = function() error("the game refused the call") end
Step(0.11)
ins8[2].SetVisibility = nil
Step(0.11)
check("a diamond that refused a write: the next look writes the book in use again", Seen(box8, ins8, outs8) == "-X--")

-- the header bar is in no overlay, or in no widget tree: one clear log line, nothing made
local Q9 = Fresh(9, function(Q) Q.head.parent = Obj("Border", "/Engine/Transient.GameEngine_0:Other.WidgetTree_0.Border_3", {}) end)
check("a header bar that is not in an overlay: one clear log line, nothing made", Count("the header bar is not in an overlay") == 1 and Books(count) == 0 and #Made("SizeBox", count) == 0)
Fresh(10, function(Q) Q.head.outer = nil end)
check("a header bar with no widget tree: one clear log line, nothing made", Count("the header bar has no widget tree") == 1 and Books(count) == 0 and #Made("SizeBox", count) == 0)
`);

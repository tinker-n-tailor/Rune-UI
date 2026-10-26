// Tests the widgets that the mod makes on the wheels (wheelmeters.lua) against the fake widgets of fake-wheels.js: the
// durability meter of an R slot and the sparks around the middle ring of R and H. Needs npm install once.
// Run: node tools/test-wheelmeters.js
const fs = require('fs'), path = require('path');
// the pictures of the wheels: each is there, at its size in pixels, and together they stay small
const art = path.join(__dirname, '..', 'RuneUI', 'Art');
const SIZES = { wheel_q_ring: [275, 525], wheel_q_on: [275, 525], wheel_r_ring: [504, 356], wheel_r_on: [504, 356], wheel_r_hand: [504, 356],
  wheel_h_ring: [482, 476], wheel_h_on: [482, 476], wheel_c_q: [945, 945], wheel_c_r: [945, 945], wheel_c_h: [297, 297], wheel_q_shade: [1767, 332],
  wheel_meter_track: [152, 152], wheel_meter_fill: [152, 152], wheel_book_on: [64, 64], wheel_book_off: [64, 64], wheel_key: [136, 136], wheel_arrow: [128, 128] };
// The budget grew from 310,000 for the bag's texture on every disc (14-10-2026): noise packs badly.
const BUDGET = 540000;
let total = 0, bad = 0;
for (const [name, [w, h]] of Object.entries(SIZES)) {
  const file = path.join(art, name + '.png');
  const b = fs.existsSync(file) && fs.readFileSync(file);
  if (!b || b.readUInt32BE(16) !== w || b.readUInt32BE(20) !== h) { console.log('FAIL picture ' + name + ': missing, or not ' + w + ' x ' + h); bad++; } else total += b.length;
}
const others = fs.readdirSync(art).filter(n => /^wheel_.*\.png$/.test(n) && !(n.slice(0, -4) in SIZES));
if (others.length) { console.log('FAIL pictures with no size in this test: ' + others.join(', ')); bad++; }
if (total > BUDGET) { console.log('FAIL the wheel pictures are ' + total + ' bytes together, more than ' + BUDGET); bad++; }
if (bad) process.exit(1);
console.log('ok   ' + Object.keys(SIZES).length + ' wheel pictures at their sizes, ' + total + ' bytes together');

require('./fake-wheels').run(`
local Q, R, H = world.wheels.Q, world.wheels.R, world.wheels.H
local state0 = State(world)
Build()
local function Bar(i) return R["RadialSlice" .. i].QuickAccessSlot.DurabilityBar end
local function Root(i) return R["RadialSlice" .. i].WidgetTree.RootWidget end
check("closed: no meter is made, the game's bar is as it was", #Made("SizeBox") == 0 and Bar(0).op == 1)

-- D: sparks around the middle ring of R and H
local sparks = Made("NiagaraSystemWidget")
check("sparks: two effects each on R and H, none made on Q", #sparks == 4 and #(R.middle.added or {}) == 2 and #(H.middle.added or {}) == 2 and Q.middle.added == nil)
local first = R.middle.added[1]
check("sparks: the game's two effects, switched on, in the wheel's tree, in the middle", first.child.NiagaraSystemReference.full == "NiagaraSystem /Game/Art/VFX/UI/NS_UI_RadialLoop.NS_UI_RadialLoop"
    and R.middle.added[2].child.NiagaraSystemReference.full == "NiagaraSystem /Game/Art/VFX/UI/NS_UI_RadialLoop_Upper.NS_UI_RadialLoop_Upper"
    and first.child.AutoActivate == true and first.child.active == true and first.child.outer == R.tree and first.HorizontalAlignment == 2 and first.VerticalAlignment == 2)
local function Materials(N) local t = {} for _, e in ipairs(N.MaterialRemapList.list) do t[#t + 1] = e[1] .. ">" .. e[2] end return table.concat(t, " ") end
check("sparks: each has the HUD materials of the game's widget of the same effect", Materials(first.child) == "M_VFX_UI_Embers>M_VFX_UI_Embers_UI"
    and Materials(R.middle.added[2].child) == "M_VFX_UI_Embers>M_VFX_UI_Embers_UI M_VFX_UI_SmokeSubUV>M_VFX_UI_SmokeSubUV_UI"
    and Materials(H.middle.added[2].child) == Materials(R.middle.added[2].child) and #Q.fuse.MaterialRemapList.list == 2)
check("sparks: one search of the spark widgets for each wheel that gets them", sparkSearches == 2)
check("sparks: scaled to the middle ring", first.child.RenderTransform.Scale.X == 0.82 and H.middle.added[1].child.RenderTransform.Scale.X == 0.70
    and first.child.RenderTransformPivot.X == 0.5 and first.child.vis == 4)

-- B: the durability meter, made when the R wheel is open and a slot has an item with a durability
local w0 = writes
for _ = 1, 4 do Step() end
check("closed wheels: nothing written", writes == w0)
R.vis = 4
Step()
local boxes = {}
for i = 0, 7 do boxes[i] = Root(i).added and Root(i).added[1] end
check("R open: a meter on each slot with a durability, none on the others", boxes[0] and boxes[1] and not boxes[2] and not boxes[7])
local b0 = boxes[0]
check("the meter sits on the ring's middle and stands upright", b0.Padding.Left == 70 - 38 and b0.Padding.Top == 89 - 38 and b0.HorizontalAlignment == 1 and b0.VerticalAlignment == 1
    and b0.child.WidthOverride == 76 and b0.child.RenderTransformPivot.X == 0.5 and b0.child.RenderTransform.Angle == -90 and boxes[1].child.RenderTransform.Angle == -135)
check("the meter is seen and lets the mouse through; the game's bar is unseen, not collapsed", b0.child.vis == 3 and Bar(0).op == 0 and Bar(0).vis == 4 and Bar(1).op == 0)
local function Fill(i) local list = {} for _, o in ipairs(Made("Image")) do if o.outer == R["RadialSlice" .. i].WidgetTree and o.RenderTransform.Angle ~= 0 then list[#list + 1] = o end end return list[1] end
local f0, f1 = Fill(0), Fill(1)
check("the fill shows the share: turned by what is missing, in a box that cuts it", f0 and math.abs(f0.RenderTransform.Angle - 18) < 0.001 and f1 and math.abs(f1.RenderTransform.Angle - 144) < 0.001
    and #Made("CanvasPanel") == 2)
check("gold, and red under a quarter", f0.ColorAndOpacity.G > 0.4 and f1.ColorAndOpacity.G < 0.1 and f1.ColorAndOpacity.R > 0.6)
check("our pictures are on the brushes, owned by the slice's tree", f0.Brush.ResourceObject.file == "wheel_meter_fill.png" and f0.Brush.ResourceObject.outer == R.RadialSlice0.WidgetTree
    and f0.Brush.ImageSize.X == 76)
check("a picture is read from the disk once for the wheel: the next meter takes the same texture", f1.Brush.ResourceObject == f0.Brush.ResourceObject)
w0 = writes
local made0 = #Made("SizeBox")
for _ = 1, 4 do Step(0.11) end
check("R open, nothing new: nothing written, nothing made", writes == w0 and #Made("SizeBox") == made0)
Bar(0).ProgressBar.Percent = 0.5
Step(0.11)
check("the item wears: the fill follows", math.abs(f0.RenderTransform.Angle - 90) < 0.001 and writes == w0 + 1)
Bar(1).vis, Bar(2).vis = 1, 4
Bar(2).ProgressBar.Percent = 1
Step(0.11)
check("another item in a slot: its meter goes, the new slot gets one", boxes[1].child.vis == 1 and Root(2).added and Root(2).added[1].child.vis == 3 and Fill(1).RenderTransform.Angle == 144)
check("the game's bar is never collapsed and its value never written", Bar(1).vis == 1 and Bar(0).vis == 4 and Bar(0).ProgressBar.Percent == 0.5)

-- the row off: ours out of sight, the game's values back
Bar(0).ProgressBar.Percent, Bar(1).vis, Bar(2).vis, Bar(2).ProgressBar.Percent = 0.9, 4, 1, 0.2
R.vis, on = 1, false
Step()
check("the row off: every value of the game is back", State(world) == state0 and Bar(0).op == 1)
check("the row off: the meters and the sparks are collapsed", b0.child.vis == 1 and Root(2).added[1].child.vis == 1 and first.child.vis == 1 and H.middle.added[2].child.vis == 1)
on = true
Step()
R.vis = 4
Step()
check("the row off and on, and the looks between: no new search of the spark widgets", sparkSearches == 2)
check("the row on again: the same widgets show, none is made twice", b0.child.vis == 3 and Bar(0).op == 0 and first.child.vis == 4 and #Made("NiagaraSystemWidget") == 4
    and #Root(0).added == 1 and boxes[1].child.vis == 3)
R.vis = 1

-- a new world: nothing is called on the old widgets, ours included
local old, calls, count = world, Calls(world), #made
local function OurCalls() local n = 0 for k = 1, count do n = n + made[k].n end return n end
local ours = OurCalls()
M.Forget(false)
world = World(2)
Build() Step()
world.wheels.R.vis = 4
Step()
check("a new world: no call on the old widgets or on our old ones", Calls(old) == calls and OurCalls() == ours)
check("a new world: new sparks and a new meter", #Made("NiagaraSystemWidget", count) == 4 and #Made("SizeBox", count) == 4)
check("a new world: the sparks copy from the game's widgets, not from our old ones", sparkSearches == 4 and #world.wheels.R.middle.added[2].child.MaterialRemapList.list == 2)

-- the game's widget of one effect is not there: no sparks at all on R and H, one log line each, the look still set
M.Forget(false)
world, logs, count = World(4), {}, #made
world.veil = "NS_UI_Radial_Fuse"
Build() Step() Step()
local lines = 0
for _, m in ipairs(logs) do if string.find(m, "no game spark widget to copy the materials from", 1, true) then lines = lines + 1 end end
check("no source for the materials: no spark widget is made, one log line for each wheel", #Made("NiagaraSystemWidget", count) == 0 and lines == 2 and world.wheels.R.middle.added == nil)
check("no source for the materials: the wheels still get their look, and it is not tried on every step", world.wheels.R.slices[0].Background.Brush.ResourceObject.file == "wheel_r_ring.png"
    and world.wheels.H.parts.CenterBg.Brush.ResourceObject.file == "wheel_c_h.png" and sparkSearches == 6)
world.veil = nil
Step(10)
check("the game's sparks come late: ours are made on a later try", #Made("NiagaraSystemWidget", count) == 4 and sparkSearches == 8 and lines == 2)
for _ = 1, 5 do Step(10) end
check("once made, no more search of the spark widgets", sparkSearches == 8)
M.Forget(false)
world, count = World(5), #made
world.veil = "NS_UI_Radial_Fuse"
local before = sparkSearches
for _ = 1, 100 do Step(2) end
check("the game's sparks never come: 5 tries for each wheel, then none", sparkSearches == before + 10 and #Made("NiagaraSystemWidget", count) == 0)

-- One wheel is gone, the others live on. The old one gets no call on our widgets. On the others ours are taken
-- out before they are made anew, so no second set stays behind.
M.Forget(false)
world, count = World(6), #made
local R6, H6 = world.wheels.R, world.wheels.H
Build()
R6.vis = 4
Step()
local meter, rSparks, hSparks = R6.RadialSlice0.WidgetTree.RootWidget.added[1].child, R6.middle.added, H6.middle.added
check("before: a meter and sparks on R, sparks on H", meter.vis == 3 and #rSparks == 2 and #hSparks == 2)
R6.valid = false
local function Sum(list) local n = 0 for _, o in ipairs(list) do n = n + o.n end return n end
local rOurs = {}
for k = count + 1, #made do if made[k].outer ~= H6.tree then rOurs[#rOurs + 1] = made[k] end end
local calls6 = Sum(rOurs)
Step()
check("a wheel that is gone: no call on its old meters and sparks", Sum(rOurs) == calls6 and meter.vis == 3 and not rSparks[1].child.removed)
check("a wheel that lives on: our sparks are taken out of it", hSparks[1].child.removed and hSparks[2].child.removed)
Build(11)
check("a wheel that lives on: one new set of sparks, the old one gone", #H6.middle.added == 4 and H6.middle.added[3].child.vis == 4 and not H6.middle.added[3].child.removed)
-- the place of one of our widgets went to another object: it gets no write
H6.middle.added[3].child.full = "Image /Engine/Transient.GameEngine_0:Another.WidgetTree_0.Image_9"
on = false
Step()
check("the row off: no write into an object that took the place of ours", H6.middle.added[3].child.vis == 4 and H6.middle.added[4].child.vis == 1)
on = true

-- a slot whose root does not take our meter: logged once, the other slots go on
M.Forget(false)
world, logs = World(3), {}
world.wheels.R.RadialSlice0.WidgetTree.RootWidget.AddChildToOverlay = function() error("the game refused the call") end
Build() Step()
world.wheels.R.vis = 4
count = #made
Step() Step(0.11) Step(0.11)
local slot1 = world.wheels.R.RadialSlice1.WidgetTree.RootWidget
check("a meter that cannot be made: tried once, the next slot has its meter", Logged("a slot of the R wheel failed") and slot1.added and slot1.added[1].child.vis == 3
    and #Made("SizeBox", count) == 4)
check("a meter that cannot be made: the game's bar of that slot is still seen", world.wheels.R.RadialSlice0.QuickAccessSlot.DurabilityBar.op == 1
    and world.wheels.R.RadialSlice1.QuickAccessSlot.DurabilityBar.op == 0)

-- The place of a widget of ours went to another object (its full name is another one): it gets no write. The meter
-- or the sparks are made anew, and the game's bar is hidden only while a meter of ours is there.
M.Forget(false)
world, logs, count = World(8), {}, #made
local R8 = world.wheels.R
local function Root8(i) return R8["RadialSlice" .. i].WidgetTree.RootWidget end
local function Bar8(i) return R8["RadialSlice" .. i].QuickAccessSlot.DurabilityBar end
local function Fills8(i) local list = {} for _, o in ipairs(Made("Image", count)) do if o.outer == R8["RadialSlice" .. i].WidgetTree and o.RenderTransform.Angle ~= 0 then list[#list + 1] = o end end return list end
local function Other(o) o.full = o.cls .. " /Engine/Transient.GameEngine_0:Another.WidgetTree_0." .. o.cls .. "_9" end
Build()
R8.vis = 4
Step()
local box0, box1, fill1 = Root8(0).added[1].child, Root8(1).added[1].child, Fills8(1)[1]
local tex = fill1.Brush.ResourceObject
Other(tex)
Bar8(2).vis = 4
Step(0.11)
local fill2 = Fills8(2)[1]
check("a texture whose place went to another object is not taken for a new meter", fill2 and fill2.Brush.ResourceObject ~= tex and fill2.Brush.ResourceObject.file == "wheel_meter_fill.png")
Other(box0)
box0.vis = 2
Bar8(0).vis = 1
Step(0.11)
check("a meter box that is another object now: no write, the game's bar is shown again", box0.vis == 2 and not box0.removed and Bar8(0).op == 1)
Bar8(0).vis = 4
Step(0.11)
check("the item has a durability again: a new meter, the other object untouched, the bar hidden for the new one", #Root8(0).added == 2 and Root8(0).added[2].child.vis == 3
    and box0.vis == 2 and Bar8(0).op == 0)
Other(fill1)
fill1.RenderTransform.Angle = 144
Bar8(1).ProgressBar.Percent = 0.9
Step(0.11)
local new1 = Fills8(1)
check("a fill that is another object now: no write, the old box is taken out, one new meter with the new value", fill1.RenderTransform.Angle == 144 and box1.removed
    and #Root8(1).added == 2 and Root8(1).added[2].child.vis == 3 and #new1 == 2 and math.abs(new1[2].RenderTransform.Angle - 18) < 0.001)
Other(R8.middle.added[1].child)
R8.middle.added[1].child.vis = 2
on = false
Step()
on = true
Build()
check("sparks: one of them is another object now: no write, the other goes, a new pair is made", R8.middle.added[1].child.vis == 2 and R8.middle.added[2].child.removed
    and #R8.middle.added == 4 and R8.middle.added[3].child.vis == 4 and R8.middle.added[4].child.vis == 4 and not R8.middle.added[4].child.removed)

-- a meter that is made anew cannot be made: the game's bar stays seen
Other(Root8(2).added[1].child)
Root8(2).AddChildToOverlay = function() error("the game refused the call") end
Bar8(2).vis = 1
Step(0.11)
Bar8(2).vis = 4
Step(0.11)
check("a meter that is another object and cannot be made again: the game's bar is shown", Bar8(2).op == 1 and Logged("a slot of the R wheel failed"))

-- a wheel lives on while another is gone: the meters of the one that lives on are taken out for good
M.Forget(false)
world, count = World(9), #made
local R9, H9 = world.wheels.R, world.wheels.H
Build()
R9.vis = 4
Step()
local mine = {}
for i = 0, 1 do mine[i] = R9["RadialSlice" .. i].WidgetTree.RootWidget.added[1].child end
H9.valid = false
Step()
check("a wheel that lives on: its meters are taken out of the game's widgets", mine[0].removed and mine[1].removed)
Build(11)
check("a wheel that lives on: one new meter for each slot, the old ones gone", #R9.RadialSlice0.WidgetTree.RootWidget.added == 2 and R9.RadialSlice0.WidgetTree.RootWidget.added[2].child.vis == 3
    and not R9.RadialSlice0.WidgetTree.RootWidget.added[2].child.removed)

-- the game's sparks do not come at first: the tries are the timed ones, a row on and off does not use them up
M.Forget(false)
world, count = World(10), #made
world.veil = "NS_UI_Radial_Fuse"
local before2 = sparkSearches
Build()
for _ = 1, 5 do   -- 5 s in all, less than the 10 s to the next try
    on = false
    Step(0.5)
    on = true
    Step(0.5)
end
check("a row on and off while the sparks wait: no new try", sparkSearches == before2 + 2)
for _ = 1, 12 do
    Step(10)
    on = false
    Step()
    on = true
    Build()
end
check("five tries in all for each wheel, then none, with the row switched on and off between", sparkSearches == before2 + 10 and #Made("NiagaraSystemWidget", count) == 0)
world.veil = nil
for _ = 1, 3 do Step(10) end
check("after the five tries a wheel gets no more", #Made("NiagaraSystemWidget", count) == 0 and sparkSearches == before2 + 10)

-- the second spark cannot be made: no half set, the next try makes both
M.Forget(false)
world, logs, count = World(11), {}, #made
local H11 = world.wheels.H
local adds = 0
H11.middle.AddChildToOverlay = function(self, c) adds = adds + 1 if adds == 2 then error("the game refused the call") end return api.AddChildToOverlay(self, c) end
Build()
local function Live(list) local n = 0 for _, e in ipairs(list or {}) do if not e.child.removed then n = n + 1 end end return n end
check("the second spark fails: the first is taken out again, one log line", Live(H11.middle.added) == 0 and H11.middle.added[1].child.removed and Logged("H: no sparks"))
Step(11)
check("the next try makes two sparks", Live(H11.middle.added) == 2 and H11.middle.added[2].child.vis == 4)

-- the game's bar of a slot is another object, and so is our meter: no write into either, the parts are found again from
-- the live slot, a new meter hides the new bar, and the row off gives the new bar its opacity back
M.Forget(false)
world, logs, count = World(12), {}, #made
local R12 = world.wheels.R
Build()
R12.vis = 4
Step()
local slot12 = R12.RadialSlice0.QuickAccessSlot
local oldBar, oldBox = slot12.DurabilityBar, R12.RadialSlice0.WidgetTree.RootWidget.added[1].child
local barPath = string.match(oldBar.full, "^%S+%s+(.*)$")
Other(oldBar)
Other(oldBox)
local newBar = Obj("WBP_DurabilityBar_C", barPath, { vis = 4, ProgressBar = Obj("ProgressBar", barPath .. "_Prog", { Percent = 0.5 }) })
slot12.DurabilityBar = newBar
local oldWrites = 0
oldBar.SetRenderOpacity = function() oldWrites = oldWrites + 1 end
Step(0.11)
local boxes12 = R12.RadialSlice0.WidgetTree.RootWidget.added
check("a bar and a meter that are other objects: no write into either", oldWrites == 0 and oldBox.vis == 3 and not oldBox.removed)
check("a bar that is another object: a new meter on the new bar, with its value, and the new bar unseen", #boxes12 == 2 and boxes12[2].child.vis == 3 and newBar.op == 0
    and math.abs(boxes12[2].child.content.added[2].child.content.added[1].child.RenderTransform.Angle - 90) < 0.001)
on = false
Step()
check("the row off: the new bar has its opacity again, the old object is not written", newBar.op == 1 and oldWrites == 0)
on = true

-- only the slice went to another object, the bar and our meter did not: the parts are found again and a new meter is made
M.Forget(false)
world, logs, count = World(13), {}, #made
local R13 = world.wheels.R
Build()
R13.vis = 4
Step()
local slice13 = R13.RadialSlice0
local bar13, box13 = slice13.QuickAccessSlot.DurabilityBar, slice13.WidgetTree.RootWidget.added[1].child
Other(slice13)
Step(0.11)
check("a slice that is another object alone: the old meter goes, a new one is made, the bar is unseen again", box13.removed and #slice13.WidgetTree.RootWidget.added == 2
    and slice13.WidgetTree.RootWidget.added[2].child.vis == 3 and bar13.op == 0)

-- the parts of a slot are not found after a stale drop: the slot is not given up, the next look finds them again
M.Forget(false)
world, logs, count = World(14), {}, #made
local R14 = world.wheels.R
Build()
R14.vis = 4
Step()
local slice14 = R14.RadialSlice0
local bar14, box14 = slice14.QuickAccessSlot.DurabilityBar, slice14.WidgetTree.RootWidget.added[1].child
Other(slice14)
R14.RadialSlice0 = nil
Step(0.11)
check("the slice is gone after a stale drop: the old meter is out, the game's bar shows, no new meter", box14.removed and bar14.op == 1 and #slice14.WidgetTree.RootWidget.added == 1)
Step(0.11)
check("still gone: the slot is not given up, the other slots go on", #slice14.WidgetTree.RootWidget.added == 1 and R14.RadialSlice1.WidgetTree.RootWidget.added[1].child.vis == 3)
R14.RadialSlice0 = slice14
Step(0.11)
check("the slice is back: the next look builds the meter and hides the bar", #slice14.WidgetTree.RootWidget.added == 2 and slice14.WidgetTree.RootWidget.added[2].child.vis == 3 and bar14.op == 0)

-- a slot whose parts were never found is not searched again on every look
M.Forget(false)
world, logs, count = World(15), {}, #made
local R15 = world.wheels.R
local slice15 = R15.RadialSlice0
R15.RadialSlice0 = nil
Build()
R15.vis = 4
Step()
R15.RadialSlice0 = slice15
Step(0.11)
Step(0.11)
check("a slot that never had its parts: no meter, even when they show up later", slice15.WidgetTree.RootWidget.added == nil and R15.RadialSlice1.WidgetTree.RootWidget.added[1].child.vis == 3)
local said = 0
for _, m in ipairs(logs) do if m:find("slot 0 has no durability bar", 1, true) then said = said + 1 end end
check("a slot that never had its parts is logged once, not on each look", said == 1)

-- the wheel record is made again inside one world (another wheel is gone): the line is not said again
M.Forget(false)
world, logs, count = World(16), {}, #made
local R16, H16 = world.wheels.R, world.wheels.H
R16.RadialSlice0.QuickAccessSlot.DurabilityBar = nil
Build()
R16.vis = 4
Step()
Step(0.11)
local function Said() local n = 0 for _, m in ipairs(logs) do if m:find("slot 0 has no durability bar", 1, true) then n = n + 1 end end return n end
check("a slot with no durability bar is logged", Said() == 1)
H16.valid = false
Step()
Build(11)
Step(0.11)
check("the wheel record is made again in the same world: the line is not said again", Said() == 1 and R16.RadialSlice1.WidgetTree.RootWidget.added ~= nil)
`);

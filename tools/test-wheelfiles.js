// Tests that each helper file of the wheels (wheelspells.lua, wheelmeters.lua, wheelbooks.lua) fails alone: when wiring.lua
// could not load one, wheels.lua still gives the others their Init, and the rest of the look stays. Needs npm install once.
// Run: node tools/test-wheelfiles.js
const { run } = require('./fake-wheels');
const clean = `check("no log line of an error", not (Logged("failed") or Logged("no sparks") or Logged("not styled") or Logged("attempt") or Logged("no spellbook")))`;
const diamonds = (what) => `check("${what}: the four spellbook diamonds are made in the header of Q", Q.headBox.added ~= nil and #Q.headBox.added == 1 and Q.headBox.added[1].child.vis == 3)`;

const noSpells = run(`
ctx.Spells = nil
local Q, R, H = world.wheels.Q, world.wheels.R, world.wheels.H
local state0 = State(world)
Build()
R.vis = 4
Open("Q", true)
Step() Step(0.11)
${diamonds("no wheelspells.lua")}
check("no wheelspells.lua: the sparks of R and H are made", #Made("NiagaraSystemWidget") == 4 and #R.middle.added == 2 and #H.middle.added == 2)
check("no wheelspells.lua: the durability meters are made", R.RadialSlice0.WidgetTree.RootWidget.added ~= nil and R.RadialSlice0.WidgetTree.RootWidget.added[1].child.vis == 3)
check("no wheelspells.lua: the rings of all three wheels have their look", File(Q.slices[0].Background) == "wheel_q_ring.png" and File(R.slices[0].Background) == "wheel_r_ring.png" and File(H.slices[0].Background) == "wheel_h_ring.png")
check("no wheelspells.lua: the middle of Q is as the game has it", Q.SpellName.bIsScrollingEnabled == true and Q.under[1].vis == 4 and Q.RadialSlice_3.CooldownWidget.TimerRing.ColorAndOpacity.R == 0.9)
${clean}
R.vis, on = 1, false
Open("Q", false)
Step()
check("no wheelspells.lua: the row off puts the game's values back", State(world) == state0)
`, true);

const noMeters = run(`
ctx.Meters = nil
local Q, R, H = world.wheels.Q, world.wheels.R, world.wheels.H
local state0 = State(world)
Build()
R.vis = 4
Open("Q", true)
Step() Step(0.11)
${diamonds("no wheelmeters.lua")}
check("no wheelmeters.lua: the middle of Q has its look", Q.SpellName.bIsScrollingEnabled == false and Q.label.RenderTransform.Scale.X == 0.75 and Q.under[1].vis == 1)
check("no wheelmeters.lua: the cooldown arc and the rings are there", Q.RadialSlice_3.CooldownWidget.TimerRing.ColorAndOpacity.R == 0.76 and File(R.slices[0].Background) == "wheel_r_ring.png")
check("no wheelmeters.lua: no meter and no spark is made, the game's bar stays", R.RadialSlice0.WidgetTree.RootWidget.added == nil and #Made("NiagaraSystemWidget") == 0 and R.RadialSlice0.QuickAccessSlot.DurabilityBar.op == 1)
${clean}
R.vis, on = 1, false
Open("Q", false)
Step()
check("no wheelmeters.lua: the row off puts the game's values back", State(world) == state0)
`, true);

const noBooks = run(`
ctx.Books = nil
local Q, R, H = world.wheels.Q, world.wheels.R, world.wheels.H
local state0 = State(world)
Build()
R.vis = 4
Open("Q", true)
Step() Step(0.11)
check("no wheelbooks.lua: the header of Q is not touched", Q.headBox.added == nil)
check("no wheelbooks.lua: the meters and the sparks are made", R.RadialSlice0.WidgetTree.RootWidget.added ~= nil and #Made("NiagaraSystemWidget") == 4)
check("no wheelbooks.lua: the middle of Q and the rings have their look", Q.SpellName.bIsScrollingEnabled == false and Q.label.RenderTransform.Scale.X == 0.75 and File(R.slices[0].Background) == "wheel_r_ring.png")
${clean}
R.vis, on = 1, false
Open("Q", false)
Step()
check("no wheelbooks.lua: the row off puts the game's values back", State(world) == state0)
`, true);

process.exit(noSpells + noMeters + noBooks ? 1 : 0);

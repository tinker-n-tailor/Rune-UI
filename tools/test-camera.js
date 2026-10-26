// Tests the immersive camera without the game. camerarules.lua: the settings (read, saved, reset, defaults, bad values,
// an old file with the gone easing rows), what is in the hands, the aim reticles, walk, the sprint view and its hold, the
// melee zoom in a fight, the ranged zoom while a bow aims or a staff casts (and with the combat switch), their hold, every
// distance kept in the range of the rows, the glide's curve, the walk distance with a weapon out of a fight, a shield, a
// torch and the tools, the camera off, and the F6 panel with the two rows of the immersive mode.
// camera.lua is tested in test-cameraarm.js.
// crosshair.lua against fake aim marks with the game's full names (found with aim.lua's own Collect): the dots hidden, the dots of an aim
// kept, the rings kept, and put back.
// Needs npm install once. Run: node tools/test-camera.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const editor = read('editor.lua');
const [, rows, , keys] = (editor.match(/M\.ROWS, M\.BOXES, M\.KEYS, M\.CAPS = (\d+), (\d+), (\d+), (\d+)/) || []).map(Number);
if (!rows) { console.log('FAIL editor.lua: no M.ROWS line'); process.exit(1); }

const test = `
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end
local clock = 0
os.clock = function() return clock end
local function Fresh(src) return load(src)() end
local Settings = Fresh(SETTINGS)
local R = Fresh(RULES)

---------------------------------------------------------------- settings
check("defaults", R.Set.on == false and R.Set.walk == 300 and R.Set.side == 90 and R.Set.sprint == 900 and R.Set.melee == 200
    and R.Set.ranged == 500 and R.Set.hold == 8 and R.Set.crosshair == "Show")
check("nine camera rows, the crosshair and the tool bar first, no easing row", #R.ROWS == 9 and R.ROWS[1].Label == "Crosshair" and R.ROWS[2].Label == "Fade the tool bar"
    and R.ROWS[3].Label == "Immersive camera" and R.ROWS[4].Label == "Walk distance" and R.ROWS[5].Label == "Side offset" and R.ROWS[6].Label == "Sprint distance"
    and R.ROWS[7].Label == "Melee distance" and R.ROWS[8].Label == "Ranged distance" and R.ROWS[9].Label == "Hold after a fight" and R.Set.zoomease == nil)
check("the tool bar does not fade at first", R.Set.toolbar == false)
check("the panel: the two rows of the immersive mode, then the camera rows", #R.PANEL == 11 and R.PANEL[1].Label == "Immersive mode"
    and R.PANEL[2].Label == "Wait before the fade" and R.PANEL[3] == R.ROWS[1] and R.PANEL[11] == R.ROWS[9])
local saves = 0
-- an old file with zoomease and returnease lines: they load without an error and are not settings
local store = Settings.Parse("[camera]\\non=1\\nwalk=310\\nside=-40\\nsprint=99999\\nmelee=abc\\nhold=12.6\\nzoomease=4.6\\nreturnease=19\\ncrosshair=hide\\n").camera
local okOld = pcall(R.Attach, store, function() saves = saves + 1 end)
check("read: an old file with zoomease= and returnease= loads", okOld and R.Set.zoomease == nil and R.Set.returnease == nil)
check("read: on, a walk between two steps snaps, side and sprint clamp", R.Set.on == true and R.Set.walk == 300 and R.Set.side == 0 and R.Set.sprint == 1500)
check("read: a bad number and a missing line give the default", R.Set.melee == 200 and R.Set.ranged == 500)
check("read: whole seconds, and the old crosshair value hide reads as Aim only", R.Set.hold == 13 and R.Set.crosshair == "Aim only")
check("read: a value in any case", (function() R.Attach({ crosshair = "AIM ONLY" }, function() end) local a = R.Set.crosshair R.Attach({ crosshair = "HIDE" }, function() end) return a == "Aim only" and R.Set.crosshair == "Aim only" end)())
R.Attach(store, function() saves = saves + 1 end)
R.Dirty = true R.Commit()
check("save: the old easing lines leave the file, the old Hide is written as Aim only", saves == 1 and store.zoomease == nil and store.returnease == nil and store.walk == 300 and store.on == 1
    and store.crosshair == "Aim only")
check("read: a word that is not an option is the default", (function() R.Attach({ crosshair = "maybe", on = "yes" }, function() end) return R.Set.crosshair == "Show" and R.Set.on == false end)())
local file = {}
R.Attach(Settings.Parse("").camera or file, function() saves = saves + 1 end)
check("read: no [camera] section gives every default", R.Set.on == false and R.Set.walk == 300 and R.Set.crosshair == "Show")
R.Set.on, R.Set.crosshair, R.Dirty = true, "Aim only", true
R.Commit()
check("save: once, a switch as 1, a choice as its word", saves == 2 and file.on == 1 and file.crosshair == "Aim only" and file.walk == 300 and file.hold == 8
    and file.toolbar == 0)
R.Commit()
check("save: nothing new, no save", saves == 2)
local text = Settings.Format({ map = { zoom = 2 }, camera = file, keys = { editor = "F9" } })
check("file: [camera] after [map] and before [keys]", string.find(text, "[map]", 1, true) < string.find(text, "[camera]", 1, true)
    and string.find(text, "[camera]", 1, true) < string.find(text, "[keys]", 1, true))
check("file: the section reads back the same", (function()
    local back = Settings.Parse(text).camera
    R.Attach(back, function() end)
    return R.Set.on == true and R.Set.crosshair == "Aim only" and R.Set.walk == 300
end)())
R.Attach(file, function() saves = saves + 1 end)
R.Set.walk, R.Set.on = 1000, true
R.ResetWanted = true
R.Commit()
check("reset: every row back to its default, and saved", R.Set.walk == 300 and R.Set.on == false and R.Set.crosshair == "Show" and file.on == 0 and file.walk == 300 and saves == 3)

-- Mod Menu
R.MenuSet("on", true) R.MenuSet("toolbar", true) R.MenuSet("walk", 312.0) R.MenuSet("hold", 99) R.MenuSet("crosshair", "Hide") R.MenuSet("nope", 1) R.MenuSet("zoomease", 5)
check("Mod Menu: a toggle, a slider snapped, clamped, an old choice value as the new one, an unknown key ignored", R.MenuGet("on") == true and R.MenuGet("toolbar") == true and R.MenuGet("walk") == 300
    and R.MenuGet("hold") == 30 and R.MenuGet("crosshair") == "Aim only" and R.Set.nope == nil and R.Set.zoomease == nil and R.Dirty == true)
R.Commit()
check("Mod Menu: saved like a key", file.walk == 300 and file.hold == 30 and file.toolbar == 1)

-- the panel's keys
R.ResetWanted = true R.Commit()
R.Sel = 4 R.Change(1)
check("keys: left or right switches the tool bar fade", R.Set.toolbar == true and R.Dirty)
R.Pick(1) R.Change(1)
check("keys: left or right switches the camera", R.Set.on == true and R.Dirty)
R.Pick(1) R.Change(1) R.Change(1)
check("keys: a distance goes 25 a step", R.Set.walk == 350)
for _ = 1, 100 do R.Change(1) end
check("keys: a distance stops at 1500", R.Set.walk == 1500)
R.Pick(1) for _ = 1, 30 do R.Change(-1) end
check("keys: the side stops at 0", R.Set.side == 0)
R.Sel = 11 for _ = 1, 40 do R.Change(-1) end
check("keys: the hold goes down to 0 s", R.Set.hold == 0)
R.Pick(1)
check("keys: down from the last row goes to the first", R.Sel == 1)
R.Pick(-1)
check("keys: up from the first goes to the last", R.Sel == 11)
R.Sel = 3 R.Change(1)
check("keys: the crosshair goes to Aim + tools", R.Set.crosshair == "Aim + tools")
R.Change(1) R.Change(1)
check("keys: then Aim only and Nothing", R.Set.crosshair == "Nothing")
R.Change(1)
check("keys: and back to Show", R.Set.crosshair == "Show")
-- the two rows of the immersive mode: their values are the layout's immersive element, not the [camera] section
local element = { Visible = false, Wait = 8 }
R.AttachMode(element, { Visible = false, Wait = 8 })
R.Commit()
local savedCamera = saves
R.Sel = 1 R.Change(1)
check("keys: the first row switches the immersive mode in the layout's element", element.Visible == true and R.LayoutDirty == true and R.Dirty == false)
R.Commit()
check("keys: a row of the mode does not write the [camera] section", saves == savedCamera and file.immersive == nil and file.wait == nil)
R.Sel = 2 for _ = 1, 40 do R.Change(1) end
check("keys: the wait stops at 30 s", element.Wait == 30)
for _ = 1, 40 do R.Change(-1) end
check("keys: and at 3 s", element.Wait == 3)
R.Reset() R.LayoutDirty = false R.Commit()
check("reset: the rows of the mode go back too, and the layout is asked to save", element.Visible == false and element.Wait == 8 and R.LayoutDirty == true and R.Set.on == false)
R.LayoutDirty = false

-- the panel
local K = { editor = "F9", camera = "F6" }
R.Sel = 6
local v = R.View(K, nil)
check("panel: eleven rows under two group titles", #v.Rows == 13 and v.Rows[1].Head and v.Rows[1].Text == "Immersive mode" and v.Rows[2].Text == "Immersive mode"
    and v.Rows[3].Text == "Wait before the fade" and v.Rows[4].Text == "Crosshair" and v.Rows[5].Text == "Fade the tool bar" and v.Rows[6].Head
    and v.Rows[6].Text == "Immersive camera" and v.Rows[7].Text == "Immersive camera" and v.Rows[13].Text == "Hold after a fight")
check("panel: the keys fit its " .. EDKEYS .. " cells", #v.Keys <= EDKEYS)
check("panel: title, the name line and the selected row", v.Mode == "camera" and v.Title == "IMMERSIVE MODE" and v.Name == "Walk distance:  300 cm" and v.Rows[8].Sel and not v.Rows[7].Sel)
check("panel: values with units, a number between < >", v.Rows[2].Note == "Off" and v.Rows[3].Note == "< 8 s >" and v.Rows[4].Note == "Show" and v.Rows[5].Note == "Off" and v.Rows[7].Note == "Off"
    and v.Rows[8].Note == "< 300 cm >" and v.Rows[13].Note == "< 8 s >")
check("panel: the keys name F9 and F6", v.Keys[4][1][1] == "F9" and v.Keys[5][1][1] == "F6")
local hints = true
for i = 1, #R.PANEL do R.Sel = i if (R.View(K).Hint or "") == "" then hints = false end end
check("panel: every row has a hint", hints)
R.Sel = 4
check("panel: the tool bar hint says what it does, off and on", R.View(K).Hint == "The tool bar stays on the screen in the immersive mode."
    and (function() R.Set.toolbar = true local h = R.View(K).Hint R.Set.toolbar = false return string.find(h, "A tool swap, an aim or a hit", 1, true) ~= nil end)())
R.Sel = 10
check("panel: the ranged hint names the aim and the staff in the hand", R.View(K).Hint == "The distance while you aim a bow or hold a staff. It holds for a few seconds.")
R.Sel = 5 R.Set.on = true
check("panel: on with the immersive mode off, the hint says the camera works without it", string.find(R.View(K).Hint, "With or without the immersive mode", 1, true))
check("panel: the state changes with a value and with the immersive mode", (function() local a = R.State() element.Visible = true local b = R.State() R.Set.walk = 325 return a ~= b and b ~= R.State() end)())
element.Visible = false
R.ResetWanted = true R.Commit()

---------------------------------------------------------------- what is in the hands, and the aim reticles
local C = R.Classify
check("hands: sword and other right-hand weapons are melee", C("BP_Sword_Bronze_C", nil) == "melee" and C("BP_Mace_Iron_C", "BP_Shield_Wood_C") == "melee")
check("hands: staff and wand are ranged", C("BP_Staff_Oak_C", nil) == "ranged" and C("BP_Wand_Iron_C", nil) == "ranged")
check("hands: the bows and the crossbow (left hand) are ranged", C(nil, "BP_Longbow_Ulvs_C") == "ranged" and C(nil, "BP_Shortbow_CrystalBow_C") == "ranged" and C(nil, "BP_Crossbow_Iron_C") == "ranged")
check("hands: a shield or a torch alone is not ranged", C(nil, "BP_Shield_Wood_C") == "none" and C(nil, "BP_Torch_C") == "none")
check("hands: a torch with a sword is melee", C("BP_Sword_Bronze_C", "BP_Torch_C") == "melee")
check("hands: the tools are not weapons", C("BP_Pickaxe_Bronze_C", nil) == "tool" and C("BP_Logging_Axe_Iron_C", nil) == "tool" and C("BP_FishingRodV2_Basic_C", nil) == "tool")
check("hands: empty", C(nil, nil) == "none" and C("", "") == "none")
-- the class names of the reticle switcher's children (probe of 29-09-2026)
local A = R.AimReticle
check("reticle: the bow's aim, the staff's cast and the aimed utility spell are an aim", A("WBP_ReticleRangedADS_C") and A("WBP_ReticleMagic_C") and A("WBP_ReticleAimingUtilityMagic_C"))
check("reticle: the default, stealth, repair, container, fishing, turret and hunter's sense reticles are not",
    not A("WBP_ReticleDefault_C") and not A("WBP_ReticleStealth_C") and not A("WBP_ReticleRepair_C") and not A("WBP_ReticleEquippedContainer_C")
    and not A("WBP_FishingReticle_C") and not A("WBP_PilotableTurretReticle_C") and not A("WBP_ReticleHuntersSense_C"))
check("reticle: no name is not an aim", not A(nil) and not A("none") and not A(""))

---------------------------------------------------------------- the rules, step by step (20 steps a second)
local mem = R.NewMemory()
local s = {}
local function Step(dt) clock = clock + (dt or 0.05) return R.Step(mem, s, clock) end
local function Run(seconds) local o for _ = 1, math.floor(seconds / 0.05 + 0.5) do o = Step() end return o end
R.Set.on = false
check("camera off: the game's camera", Step().Active == false)
R.Set.on = true
local o = Step()
check("walk: close, the character on the left, a glide of 0.9 s", o.Active and o.Distance == 300 and o.Side == 90 and o.View == "walk" and o.Glide == 0.9)
check("the lock-on view is the game's: the rules give it no distance", o.Lock == nil)
-- a sprint: far while the sprint signal is on, kept 0.5 s after it, then back in with the slower glide
R.Set.sprint = 1200
s.Sprinting = true
o = Step()
check("sprint: the Sprint distance, a glide of 0.9 s", o.View == "sprint" and o.Distance == 1200 and o.Side == 90 and o.Glide == 0.9)
s.Sprinting = false
o = Run(0.4)
check("sprint: kept just after the signal drops", o.View == "sprint" and o.Distance == 1200)
s.Sprinting = true Step() s.Sprinting = false
o = Run(0.4)
check("sprint: a break shorter than 0.5 s keeps it", o.View == "sprint")
local steps = 0
repeat o = Step() steps = steps + 1 until o.View ~= "sprint" or steps > 4
check("sprint: then the walk distance with the slower glide back of 1.6 s", steps <= 3 and o.View == "walk" and o.Distance == 300 and o.Glide == 1.6)
o = Step()
check("sprint: the step after that has the plain glide again", o.Glide == 0.9)
R.Set.sprint = 900
mem = R.NewMemory() s.Right, s.Combat, s.Sprinting = "BP_Sword_Bronze_C", true, true
o = Step()
check("sprint in a melee fight: the fight's view wins", o.View == "melee" and o.Distance == 200)
s.Combat = false
o = Step()
check("sprint after a melee fight, in its hold: the sprint", o.View == "sprint" and o.Distance == 900)
s.Sprinting = false
o = Run(9)
check("sprint in a melee fight: after the hold the walk distance", o.View == "walk" and o.Distance == 300)
mem = R.NewMemory() s.Right, s.Aiming, s.Sprinting = "BP_Wand_Master_C", true, true
o = Step()
check("sprint with a staff in the hand (an aim all the time): the sprint", o.View == "sprint" and o.Distance == 900)
s.Sprinting = false
o = Run(1)
check("after the sprint with a staff: back to the ranged distance, the slow glide", o.View == "ranged" and o.Distance == 500)
s.Right, s.Aiming = nil, false

-- the glide: an ease-out curve from where the camera is to the target, a new target starts a new glide
local g = {}
check("glide: a new target starts a glide", R.Glide(g, 300, 90, 0.6, 10, 700, 20) == true)
check("glide: the same target again does not start it again", R.Glide(g, 300, 90, 0.6, 10.3, 500, 50) == false and g.Start == 10)
local a0, y0, t0 = R.GlideAt(g, 10)
local a1, y1, t1 = R.GlideAt(g, 10.3)
local a2, y2, t2 = R.GlideAt(g, 10.61)
check("glide: starts where the camera was, 7/8 of the way at half the time, there at the end", a0 == 700 and y0 == 20 and not t0
    and math.abs(a1 - 350) < 0.01 and math.abs(y1 - 81.25) < 0.01 and not t1 and a2 == 300 and y2 == 90 and t2)
local aE, aL = R.GlideAt(g, 10.06), R.GlideAt(g, 10.54)
check("glide: answers at once, faster than a straight line at the start", aE < 700 - 400 * 0.1)
check("glide: settles softly, the last tenth of the time moves less than a tenth of the way", aL - 300 < 400 * 0.1 and aL > 300)
check("glide: after the end it stays there", (function() local a, y, t = R.GlideAt(g, 99) return a == 300 and y == 90 and t end)())
check("glide: a glide of 0 s is there at once", (function() local h = {} R.Glide(h, 400, 0, 0, 5, 700, 20) local a, y, t = R.GlideAt(h, 5) return a == 400 and y == 0 and t end)())

-- a melee fight: closer at once, held after the fight, then the walk distance at once
mem = R.NewMemory() s.Right = "BP_Sword_Bronze_C"
o = Step()
check("sword drawn, no fight: walk", o.Distance == 300 and o.View == "walk" and o.Kind == "melee")
s.Combat = true
o = Step()
check("melee fight: the melee zoom at once", o.View == "melee" and o.Distance == 200)
s.Combat = false
o = Run(7.9)
check("melee fight: the zoom holds after the enemy dies", o.View == "melee" and o.Distance == 200)
o = Run(0.15)
check("melee fight: after 8 s the walk distance at once", o.View == "walk" and o.Distance == 300)
s.Aiming = true
o = Run(1)
check("melee weapon: an aim reticle is not a fight", o.View == "walk" and o.Distance == 300)
s.Aiming = false
R.Set.hold = 0
s.Combat = true
o = Run(1)
check("hold 0 s: the zoom is on through the fight", o.View == "melee")
s.Combat = false
o = Step()
check("hold 0 s: back at once", o.View == "walk" and o.Distance == 300)
R.Set.hold = 8
-- sheathed in the fight: the hold counts from then
s.Combat = true Step() s.Right = nil
o = Run(5)
check("sheathed in a fight: the zoom holds", o.View == "melee")
o = Run(3.1)
check("sheathed in a fight: and ends 8 s after", o.View == "walk")
s.Combat = false
-- the combat switch or an aim reticle with a tool or empty hands is not a fight
mem = R.NewMemory() s.Right, s.Combat, s.Aiming = "BP_Pickaxe_Bronze_C", true, true
o = Step()
check("tool with the combat switch or an aim reticle: no zoom", o.View == "walk" and o.Distance == 300)
s.Right = nil
o = Step()
check("empty hands with the combat switch or an aim reticle: no zoom", o.View == "walk")
s.Combat, s.Aiming = false, false

-- ranged: the walk distance while it is only in the hands, farther while it aims or casts
mem = R.NewMemory() s.Right = "BP_Staff_Oak_C"
o = Step()
check("staff, no aim: the walk distance", o.View == "walk" and o.Distance == 300 and o.Kind == "ranged")
s.Right, s.Left = nil, "BP_Longbow_Ulvs_C"
o = Run(1)
check("bow, no aim: the walk distance", o.View == "walk" and o.Distance == 300)
s.Aiming = true
o = Step()
check("bow aimed: the ranged zoom at once", o.View == "ranged" and o.Distance == 500)
s.Aiming = false
o = Run(7.9)
check("after the aim: the ranged zoom holds", o.View == "ranged" and o.Distance == 500)
o = Run(0.15)
check("after the aim: then the walk distance at once", o.View == "walk" and o.Distance == 300)
-- a staff that casts again in the hold: the hold counts from the last cast
s.Left, s.Right, s.Aiming = nil, "BP_Staff_Oak_C", true
o = Step()
check("staff cast: the ranged zoom", o.View == "ranged" and o.Distance == 500)
s.Aiming = false Run(5)
s.Aiming = true Step() s.Aiming = false
o = Run(7.9)
check("a second cast in the hold: the hold counts from it", o.View == "ranged")
o = Run(0.15)
check("a second cast in the hold: and ends 8 s after it", o.View == "walk")
-- the combat switch still counts for a ranged weapon, in case the game sets it
s.Combat = true
o = Step()
check("staff with the combat switch: the ranged zoom", o.View == "ranged")
s.Combat = false
Run(9)
s.Left, s.Right, s.Combat = nil, "BP_Sword_Bronze_C", true
o = Step()
check("sword in a fight: melee", o.View == "melee")
s.Right, s.Left, s.Aiming = nil, "BP_Shortbow_CrystalBow_C", true
o = Step()
check("a bow aimed in the same fight: ranged", o.View == "ranged" and o.Distance == 500)
s.Combat, s.Aiming = false, false
s.Left = nil s.Right = "BP_Sword_Bronze_C"
o = Run(2)
check("a weapon changed in the hold: the fight's view stays", o.View == "ranged")
s.Right = nil
Run(7)
s.Left, s.Aiming = "BP_Shield_Wood_C", true
check("shield with an aim reticle: no zoom", Step().View == "walk")
s.Left = "BP_Torch_C"
check("torch with an aim reticle: no zoom", Step().View == "walk")
s.Left, s.Aiming = nil, false

-- the distance stays in the range of the rows, also for a value that did not come through the settings
s.Right, s.Aiming = "BP_Staff_Oak_C", true
R.Set.ranged = 2000
check("clamp: a ranged zoom over 1500 gives 1500", Step().Distance == 1500)
R.Set.ranged = 50
check("clamp: under 100 gives 100", Step().Distance == 100)
R.Set.ranged, s.Right, s.Aiming = 500, nil, false
Run(9)

-- off again: the fight is forgotten, the next start is the walk view
R.Set.on = false
check("camera off again: the game's camera, the fight forgotten", Step().Active == false and mem.FightUntil == -1 and mem.FightView == nil)
R.Set.on = true

-- the crosshair setting
R.Set.crosshair = "Show"
local H = R.CrosshairHides
check("crosshair Show: never hidden", H() == nil and H("BP_Sword_Iron_C") == nil)
R.Set.crosshair = "Aim only"
check("crosshair Aim only: the dots hidden, a tool changes nothing", H() == "dots" and H(nil, "BP_Logging_Axe_Iron_C") == "dots")
R.Set.crosshair = "Aim + tools"
check("crosshair Aim + tools: no dot hidden with a tool in either hand", H("BP_Pickaxe_Bronze_C") == nil and H(nil, "BP_Logging_Axe_Adamant_C") == nil
    and H("BP_Spade_Wood_C") == nil and H("BP_Secateurs_Iron_C") == nil and H("BP_FishingRodV2_C") == nil)
check("crosshair Aim + tools: the dots hidden with a weapon or empty hands", H("BP_Sword_Iron_C") == "dots" and H(nil, nil) == "dots")
check("crosshair Aim + tools: no dot hidden in the build mode", H(nil, nil, true) == nil and H(nil, nil, false) == "dots")
R.Set.crosshair = "Nothing"
check("crosshair Nothing: every dot hidden, a tool too", H() == "all" and H("BP_Pickaxe_C") == "all")
R.Set.on = false
check("crosshair: also with the game's camera", H() == "all")
R.ResetWanted = true R.Commit()

---------------------------------------------------------------- fakes for crosshair.lua (camera.lua: test-cameraarm.js)
local addr = 0
local function Obj(t) addr = addr + 1 local a = addr t = t or {}
    function t:IsValid() return true end
    function t:GetAddress() return a end
    function t:GetFullName() return "Obj " .. a end
    return t end

---------------------------------------------------------------- crosshair.lua
local Aim = Fresh(AIM)
-- a mark with the full name the game gives it: the reticle child of the aim widget is in the path (UE4SS.log, 05-10-2026)
local HUD = "/Engine/Transient.DomGameEngine_1:BP_DominionGameInstance_C_2.WBP_HUD_ReticleWidget_C_2147471422.WidgetTree_2147471421."
local function Mark(name, o, child)
    local m = Obj({ Op = o }) function m:GetFName() return { ToString = function() return name end } end
    local full = child and ("Image " .. HUD .. child .. ".WidgetTree_2147471417." .. name) or ("Image /Game/UI/Unknown." .. name)
    function m:GetFullName() return full end
    function m:GetRenderOpacity() return self.Op end
    function m:SetRenderOpacity(v) self.Op = v self.Sets = (self.Sets or 0) + 1 end
    return m end
-- the default reticle's dot, the bow's aim (its ring, the arrow count, its dot), the staff's cast (its dot), the aimed
-- utility spell (its ring and dot), the stealth reticle's dot, and a dot in a reticle of no known path
local dot, sight, ammo = Mark("Crosshair", 1, "ReticleDefault"), Mark("SightRing", 0.8, "ReticleRangedADS"), Mark("VerticalBox_0", 1, "ReticleRangedADS")
local bowDot, staffDot, utilDot = Mark("Crosshair", 1, "ReticleRangedADS"), Mark("Crosshair", 0.75, "ReticleMagic"), Mark("Crosshair", 1, "ReticleAimedUtilityMagic")
local dot2, staffRing, stamina = Mark("Crosshair", 0.9, "ReticleStealth"), Mark("MagicIcon", 1, "ReticleAimedUtilityMagic"), Mark("StaminaProgressBar", 1, "ReticleRangedADS")
local oddDot = Mark("Crosshair", 1, nil)
local panel = Mark("CanvasPanel_0", 1)
local kids = { dot, sight, ammo, bowDot, staffDot, utilDot, dot2, staffRing, stamina, oddDot }
function panel:GetChildrenCount() return #kids end
function panel:GetChildAt(i) return kids[i + 1] end
local reticle = Mark("WBP_HUD_ReticleWidget_C", 1) reticle.WidgetTree = { RootWidget = panel }
local XH = Fresh(CROSSHAIR)
local xlogs = {}
local xctx = { Log = function(m) xlogs[#xlogs + 1] = m end, Rules = R, Collect = Aim.Collect,
    Reticle = function() return reticle end }
local looked = 0
local realReticle = xctx.Reticle
xctx.Reticle = function() looked = looked + 1 return realReticle() end
R.Set.crosshair = "Show"
for _ = 1, 5 do XH.Tick(xctx) end
check("crosshair Show: nothing runs", looked == 0 and dot.Op == 1 and (dot.Sets or 0) == 0)
R.Set.crosshair = "Aim only"
-- an aim dot that an older test build hid (a restart of the mods leaves it at 0): shown again when the marks are found
bowDot.Op, dot.Op = 0, 1
XH.Tick(xctx)
check("crosshair Aim only: the dot of the default and the stealth reticle is see-through", dot.Op == 0 and dot2.Op == 0)
check("crosshair Aim only: the dot of the bow's aim, the staff's cast and the aimed spell stays (seen in the game, 05-10-2026)", bowDot.Op == 1 and staffDot.Op == 0.75 and utilDot.Op == 1
    and (staffDot.Sets or 0) == 0 and (staffDot.Sets or 0) == 0 and (utilDot.Sets or 0) == 0)
check("crosshair Aim only: an aim dot left at 0 by an older build shows again, once", bowDot.Op == 1 and bowDot.Sets == 1)
check("crosshair Aim only: a dot with no reticle in its name is kept, so an unknown reticle keeps its aim", oddDot.Op == 1 and (oddDot.Sets or 0) == 0)
check("crosshair Aim only: one line with the count", (function() for _, l in ipairs(xlogs) do if l == "crosshair: 2 dots, 4 aim dots of 9 aim marks" then return true end end end)())
check("crosshair Aim only: the aim rings of the bow and the staff stay (seen in the game, 05-10-2026)", sight.Op == 0.8 and staffRing.Op == 1 and stamina.Op == 1
    and (sight.Sets or 0) == 0 and (staffRing.Sets or 0) == 0 and (stamina.Sets or 0) == 0)
check("crosshair Aim only: the arrow and rune count stays", ammo.Op == 1 and reticle.Op == 1)
dot.Op = 1
XH.Tick(xctx)
check("crosshair Aim only: a mark the game shows again is hidden again", dot.Op == 0)
local hands = { nil, "BP_Logging_Axe_Adamant_C" }   -- the axe in the left hand, as the game holds it
local handReads, buildReads = 0, 0
xctx.Hands = function() handReads = handReads + 1 return hands[1], hands[2] end
xctx.Building = function() buildReads = buildReads + 1 return false end
XH.Tick(xctx)
check("crosshair Aim only: a tool changes nothing", dot.Op == 0 and dot2.Op == 0)
check("crosshair Aim only: the hands and the build mode are not read", handReads == 0 and buildReads == 0)
R.Set.crosshair = "Aim + tools"
XH.Tick(xctx)
check("crosshair Aim + tools: an axe in the left hand gives the game's dots back", dot.Op == 1 and dot2.Op == 0.9 and bowDot.Op == 1)
check("crosshair Aim + tools: the hands and the build mode are read", handReads == 1 and buildReads == 1)
hands = { "BP_Sword_Iron_C", nil }
XH.Tick(xctx)
check("crosshair Aim + tools: a weapon hides the dots again, the aim dots stay", dot.Op == 0 and dot2.Op == 0 and bowDot.Op == 1 and staffDot.Op == 0.75)
R.Set.crosshair = "Nothing"
XH.Tick(xctx)
check("crosshair Nothing: the aim dots hidden too", dot.Op == 0 and bowDot.Op == 0 and staffDot.Op == 0 and utilDot.Op == 0 and oddDot.Op == 0)
check("crosshair Nothing: the rings and the count stay", sight.Op == 0.8 and staffRing.Op == 1 and stamina.Op == 1 and ammo.Op == 1)
R.Set.crosshair = "Aim only"
XH.Tick(xctx)
check("crosshair Nothing to Aim only: the aim dots at the game's opacity again", bowDot.Op == 1 and staffDot.Op == 0.75 and utilDot.Op == 1 and dot.Op == 0)
xctx.Hands, xctx.Building = nil, nil
R.Set.crosshair = "Show"
XH.Tick(xctx)
check("crosshair back at Show: the game's opacity back", dot.Op == 1 and dot2.Op == 0.9 and sight.Op == 0.8 and (sight.Sets or 0) == 0
    and staffDot.Op == 0.75)
looked = 0
XH.Tick(xctx)
check("crosshair back at Show: then nothing runs", looked == 0)
R.Set.crosshair = "Aim only" XH.Tick(xctx)
XH.Forget(false)
R.Set.crosshair = "Show"
XH.Tick(xctx)
check("after a new world: put back through the widget found again", dot.Op == 1 and sight.Op == 0.8)
R.ResetWanted = true R.Commit()

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
if fails > 0 then error("tests failed") end
`;
const set = (name, v) => { lua.lua_pushstring(L, to_luastring(v)); lua.lua_setglobal(L, to_luastring(name)); };
set('RULES', read('camerarules.lua')); set('CROSSHAIR', read('crosshair.lua'));
set('SETTINGS', read('settings.lua')); set('AIM', read('aim.lua'));
lua.lua_pushinteger(L, rows); lua.lua_setglobal(L, to_luastring('EDROWS'));
lua.lua_pushinteger(L, keys); lua.lua_setglobal(L, to_luastring('EDKEYS'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== lua.LUA_OK) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }

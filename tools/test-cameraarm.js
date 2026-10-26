// Tests camera.lua against a fake player without the game: the camera arm glided every frame (ctx.Loop) to the
// distances of camerarules.lua, nothing read while off, the game's values kept and glided back, the lock-on view left to
// the game, the sprint, a value the game writes left alone, a new world, a new player, a restart of the mods, the reticle
// found once and read once a step, its log lines (at most 40), and a missing or broken reticle or sprint signal.
// Needs npm install once. Run: node tools/test-cameraarm.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

const test = `
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end
local clock = 0
os.clock = function() return clock end
local function Fresh(src) return load(src)() end
local R = Fresh(RULES)
local saves = 0
local file = {}
R.Attach(file, function() saves = saves + 1 end)

local addr = 0
local function Obj(t) addr = addr + 1 local a = addr t = t or {}
    function t:IsValid() return true end
    function t:GetAddress() return a end
    function t:GetFullName() return "Obj " .. a end
    return t end
local function V3(x, y, z) return { X = x, Y = y, Z = z } end
local function NewArm() return Obj({ TargetArmLength = 700, SocketOffset = V3(0, 20, 3) }) end
local function Actor(cls) return Obj({ GetClass = function() return { GetFName = function() return { ToString = function() return cls end } end } end }) end
local SPRINT = "/Game/Gameplay/Character/Components/BP_Components_Sprint.BP_Components_Sprint_C"
local combatC = Obj({ bIsInCombatMode = false })
local equipC = Obj({})
local sprinting = false
local sprintC = Obj({})
function sprintC:IsSprinting() return sprinting end
local lockArm = Obj({ TargetArmLength = 550, SocketOffset = V3(0, 20, 0) })
local lockC = Obj({ LockOnCameraActor = Obj({ SpringArm = lockArm }) })
local comps = { ["/Script/Dominion.PlayerCombatModeComponent"] = combatC, ["/Script/Dominion.PlayerEquipmentComponent"] = equipC,
    [SPRINT] = sprintC, ["/Script/Dominion.LockOnTargetingComponent"] = lockC }
local arm = NewArm()
local pawn = Obj({ CameraBoom = arm })
function pawn:K2_GetComponentsByClass(cls) return { comps[cls.Path] } end
local finds = 0
StaticFindObject = function(p)
    finds = finds + 1
    if comps[p] then return Obj({ Path = p }) end
end
-- the HUD reticle: WBP_HUD_ReticleWidget_C and its switcher, with the children in the game's order (probe of 29-09-2026)
local RETICLES = { "WBP_ReticleDefault_C", "WBP_ReticleStealth_C", "WBP_ReticleRangedADS_C", "WBP_ReticleMagic_C", "WBP_ReticleRepair_C",
    "WBP_ReticleAimingUtilityMagic_C", "WBP_ReticleEquippedContainer_C", "WBP_FishingReticle_C", "WBP_PilotableTurretReticle_C" }
local active, indexReads, childReads, reticleLooks = 0, 0, 0, 0
local reticleKids = {}
for i, cls in ipairs(RETICLES) do reticleKids[i] = Actor(cls) end
local function NewSwitcher()
    local sw = Obj({})
    function sw:GetActiveWidgetIndex() indexReads = indexReads + 1 return active end
    function sw:GetChildAt(i) childReads = childReads + 1 return reticleKids[i + 1] end
    return sw
end
local switcher = NewSwitcher()
local hudReticle = Obj({})
-- main.lua's MayTry and Failed
local function MayTry(P) return (P.Fails or 0) < 3 and os.clock() >= (P.RetryAt or 0) end
local function Failed(P) P.Fails, P.RetryAt = (P.Fails or 0) + 1, os.clock() + 10 end
-- LoopInGameThreadWithDelay: the loop's function, called by Frame as the game calls it every frame
local loops, loopFn = 0, nil
local shared, logs, controllers = {}, {}, 0
local ctx = { Log = function(m) logs[#logs + 1] = m end, Rules = R,
    Controller = function() controllers = controllers + 1 return { Pawn = pawn } end,
    Reticle = function() reticleLooks = reticleLooks + 1 return hudReticle end,
    -- Survival.Find by name: the switcher is the widget named ReticleSwitcher under the reticle
    Find = function(W, name) if W == hudReticle and name == "ReticleSwitcher" then return switcher end end,
    MayTry = MayTry, Failed = Failed,
    Loop = function(ms, fn) loops = loops + 1 loopFn = fn end,
    Shared = function(name, v) if v == nil then return shared[name] end shared[name] = v end }
local function Lines(from, pattern) local n = 0 for i = from + 1, #logs do if string.find(logs[i], pattern, 1, true) then n = n + 1 end end return n end
local Cam = Fresh(CAMERA)
-- a step of the mod (50 ms) with the frames in it (60 a second); GameFrame: the game's camera controller, after the mod
local GameFrame = nil
local function Tick(dt)
    dt = dt or 0.05
    local frames = math.max(1, math.floor(dt * 60 + 0.5))
    for _ = 1, frames do clock = clock + dt / frames if loopFn then loopFn() end if GameFrame then GameFrame() end end
    Cam.Tick(ctx)
end
local function Run(seconds) for _ = 1, math.floor(seconds / 0.05 + 0.5) do Tick() end end
local function Near(a, b) return math.abs(a - b) < 0.5 end
local function At(a, y) return Near(arm.TargetArmLength, a) and Near(arm.SocketOffset.Y, y) end

---------------------------------------------------------------- off and on
R.Set.on = false
for _ = 1, 20 do Tick() end
check("off: nothing is read or found (cost 0), no loop", finds == 0 and controllers == 0 and reticleLooks == 0 and indexReads == 0 and loops == 0
    and arm.TargetArmLength == 700)
R.Set.on = true
local logs0 = #logs
Tick()
check("on: the game's values kept for a restart of the mods", shared.arm == "700.000,0.000,20.000,3.000"
    and Lines(logs0, "camera: the game's camera kept, distance 700, side 20") == 1)
check("on: one loop for the frames", loops == 1 and loopFn ~= nil)
check("on: the glide starts where the camera is", arm.TargetArmLength > 690 and arm.TargetArmLength <= 700)
Run(0.25)
check("on: most of the way after about 0.3 s (ease-out), the steps do not start the glide again",
    arm.TargetArmLength < 460 and arm.TargetArmLength > 380)
Run(R.GLIDE - 0.25)
check("on: close and to the side after the glide", At(300, 90))
check("on: the side offset's other parts kept", arm.SocketOffset.X == 0 and arm.SocketOffset.Z == 3)
check("on: the lock-on view stays the game's", lockArm.TargetArmLength == 550 and lockArm.SocketOffset.Y == 20)
check("on: the view line", Lines(logs0, "camera: walk, distance 300 (right hand nil, left hand nil)") == 1)
check("reticle: a line with the active reticle's class", Lines(logs0, "camera: reticle WBP_ReticleDefault_C") == 1)
local looks0, index0 = reticleLooks, indexReads
for _ = 1, 20 do Tick() end
check("reticle: found once, the active index read once a step, a child's class read once", looks0 == 1 and indexReads == index0 + 20 and childReads == 1)
check("reticle: no new line while it stays the same", Lines(logs0, "camera: reticle") == 1)
-- the game writes the arm: left alone until the next new distance
arm.TargetArmLength = 650
Run(1)
check("a value the game writes is left alone", arm.TargetArmLength == 650)
arm.TargetArmLength = 300

---------------------------------------------------------------- fights, aim, sprint
equipC.HeldEquipmentActorRight = Actor("BP_Sword_Bronze_C") combatC.bIsInCombatMode = true
Tick() Run(R.GLIDE)
check("melee fight: glided to 200", At(200, 90))
check("melee fight: the lock-on view stays the game's", lockArm.TargetArmLength == 550)
combatC.bIsInCombatMode = false equipC.HeldEquipmentActorRight = nil
Run(9)
check("after the hold: back at the walk distance", At(300, 90) and Cam.View == "walk")
equipC.HeldEquipmentActorLeft = Actor("BP_Longbow_Ulvs_C")
Tick()
check("bow in the hand, default reticle: the walk distance", At(300, 90) and Cam.View == "walk")
logs0 = #logs
active = 2
Tick() Run(R.GLIDE)
check("bow aimed (WBP_ReticleRangedADS_C): glided to the ranged distance", At(500, 90) and Cam.View == "ranged")
check("bow aimed: the reticle line and the view line", Lines(logs0, "camera: reticle WBP_ReticleRangedADS_C") == 1
    and Lines(logs0, "camera: ranged, distance 500 (right hand nil, left hand BP_Longbow_Ulvs_C)") == 1)
active = 0
Run(9)
check("the aim ends: after the hold the walk distance", At(300, 90))
equipC.HeldEquipmentActorLeft, equipC.HeldEquipmentActorRight = nil, Actor("BP_Staff_Oak_C")
active = 3 Tick() Run(R.GLIDE)
check("staff cast (WBP_ReticleMagic_C): the ranged distance", At(500, 90))
active = 7 Run(9)
check("fishing reticle: no zoom", At(300, 90) and Cam.View == "walk")
check("reticle: a child's class read once for each index", childReads == 4)
active = 0 equipC.HeldEquipmentActorRight = nil
-- a sprint: out to the Sprint distance, back in with the slower glide
sprinting = true
Tick() Run(R.GLIDE)
check("sprint: glided out to the Sprint distance", At(900, 90) and Cam.View == "sprint")
sprinting = false
Run(0.5)
Run(R.GLIDE_FROM_SPRINT / 2)
check("after a sprint: still on the way back half way through the slower glide", arm.TargetArmLength < 450 and arm.TargetArmLength > 300)
Run(R.GLIDE_FROM_SPRINT / 2 + 0.1)
check("after a sprint: at the walk distance after the slower glide", At(300, 90))
-- the switcher goes away (a new HUD): found again, no error
local looksBefore = reticleLooks
switcher.IsValid = function() return false end
switcher = NewSwitcher()
check("reticle: an invalid switcher is found again, no error", pcall(Tick) and reticleLooks == looksBefore + 1 and At(300, 90))

---------------------------------------------------------------- off, worlds, players, restarts
equipC.HeldEquipmentActorRight = Actor("BP_Sword_Bronze_C") combatC.bIsInCombatMode = true Tick()
combatC.bIsInCombatMode = false equipC.HeldEquipmentActorRight = nil
R.Set.on = false
logs0 = #logs
Tick()
check("camera off: the line", Lines(logs0, "camera: the game's camera back") == 1)
Run(R.GLIDE)
check("camera off: glided back to the game's distance and side", At(700, 20) and arm.SocketOffset.Z == 3)
finds, controllers, indexReads = 0, 0, 0
Run(1)
check("off again: nothing runs", finds == 0 and controllers == 0 and indexReads == 0 and loops == 1)
R.Set.on = true Tick() Run(R.GLIDE)
check("on again: the walk distance, not the fight's", At(300, 90))
-- off and on again in the middle of the glide back: from where the camera is
R.Set.on = false Tick() Run(0.3)
local mid = arm.TargetArmLength
R.Set.on = true Cam.Tick(ctx)
clock = clock + 1 / 60 loopFn()
check("on in the middle of the glide back: no jump, one frame of the ease-out's quick start",
    mid > 450 and mid < 650 and math.abs(arm.TargetArmLength - mid) < 25)
Run(R.GLIDE)
check("and back close", At(300, 90))
-- a new world: a new player with a new arm at the game's values; the camera glides in from there
Cam.Forget(false)
arm = NewArm() pawn.CameraBoom = arm
Tick()
check("new world: the glide starts at the new arm's values", arm.TargetArmLength > 690)
Run(R.GLIDE)
check("new world: close again", At(300, 90))
-- a new player in the same world (Forget(true)), and a new arm that the camera finds by itself
Cam.Forget(true)
arm = NewArm() pawn.CameraBoom = arm
Tick() Run(R.GLIDE)
check("player restart: close again", At(300, 90))
arm = NewArm() pawn.CameraBoom = arm
Tick() Run(R.GLIDE)
check("a new arm found by the step: close again", At(300, 90))
-- a restart of the mods: the arm still holds the old run's values; the game's come from the shared variable
local Cam2 = Fresh(CAMERA)
Cam, loopFn = Cam2, nil
R.Set.on = true Tick() Run(R.GLIDE)
R.Set.on = false Tick() Run(R.GLIDE)
check("restart of the mods: the game's values come back, not the old run's", At(700, 20))
-- a restart of the mods that starts with the camera off: the old run's values go back at once
arm.TargetArmLength, arm.SocketOffset = 300, V3(0, 90, 3)
Cam, loopFn = Fresh(CAMERA), nil
Tick()
check("restart of the mods, camera off: the game's values back at the first step", At(700, 20))
arm.TargetArmLength = 123
Tick()
check("restart of the mods: put back once, not at every step", arm.TargetArmLength == 123)
arm.TargetArmLength = 700
-- no loop (an old UE4SS): the steps move the glide
ctx.Loop = nil
Cam, loopFn = Fresh(CAMERA), nil
R.Set.on = true Tick() Run(R.GLIDE)
check("no loop: the steps glide the camera", At(300, 90))
R.Set.on = false Tick() Run(R.GLIDE)
check("no loop: and back", At(700, 20))
ctx.Loop = function(ms, fn) loops = loops + 1 loopFn = fn end
Cam, loopFn = Fresh(CAMERA), nil
R.Set.on = true
-- the settings are saved by step.lua's step, not by the camera's: a step of the camera leaves them dirty
R.Set.hold, R.Dirty = 9, true
local savedBefore = saves
Tick()
check("save: the camera's step does not commit", saves == savedBefore and R.Dirty == true)
R.Commit()
check("save: the commit of step.lua's step saves them", saves == savedBefore + 1 and file.hold == 9 and R.Dirty == false)
R.Set.hold = 8
-- an actor that takes the address of the one before it, in a hand that was empty in between
local sword, staff = Actor("BP_Sword_Bronze_C"), Actor("BP_Staff_Oak_C")
staff.GetAddress = sword.GetAddress
combatC.bIsInCombatMode = true
equipC.HeldEquipmentActorRight = sword Tick()
equipC.HeldEquipmentActorRight = nil Tick()
equipC.HeldEquipmentActorRight = staff Tick() Tick() Tick()
check("hands: an empty hand forgets the class, a new actor at the same address is read again", Cam.View == "ranged")
combatC.bIsInCombatMode = false
equipC.HeldEquipmentActorRight = nil
Run(13)
-- the perf line: the steps alone
local before = #logs
Tick(61)
local perf = false
for i = before + 1, #logs do if string.find(logs[i], "^perf: camera %d+ steps, avg [%d%.]+ ms, max [%d%.]+ ms$") then perf = true end end
check("a perf line every minute while on", perf)
R.Set.on = false Tick() Run(R.GLIDE)

---------------------------------------------------------------- reticle and sprint failures
-- at most 40 reticle lines a game start
do
    Cam, loopFn = Fresh(CAMERA), nil
    R.Set.on = true
    logs0 = #logs
    for i = 1, 100 do active = (i % 2 == 0) and 3 or 0 Tick() end
    check("reticle: at most 40 lines a game start", Lines(logs0, "camera: reticle") == 40)
    Cam.Forget(false)
    for i = 1, 10 do active = (i % 2 == 0) and 3 or 0 Tick() end
    check("reticle: a new world does not start the count again", Lines(logs0, "camera: reticle") == 40)
    active = 0
    R.Set.on = false Tick() Run(9)
end
-- no switcher: three searches 10 s apart, then one line, and the ranged zoom follows the combat switch
do
    Cam, loopFn = Fresh(CAMERA), nil
    local realFind = ctx.Find
    local searches = 0
    ctx.Find = function() searches = searches + 1 return nil end
    R.Set.on = true
    logs0 = #logs
    equipC.HeldEquipmentActorLeft = Actor("BP_Longbow_Ulvs_C")
    active = 2
    local okN = true
    for _ = 1, 700 do okN = okN and pcall(Tick) end
    check("no switcher: no error, three searches 10 s apart, then none", okN and searches == 3)
    check("no switcher: one line in the log", Lines(logs0, "camera: no reticle switcher, ranged zoom follows the combat switch") == 1)
    check("no switcher: a bow with no combat switch keeps the walk distance", At(300, 90) and Cam.View == "walk")
    combatC.bIsInCombatMode = true
    Tick() Run(R.GLIDE)
    check("no switcher: the combat switch still gives the ranged zoom", At(500, 90) and Cam.View == "ranged")
    combatC.bIsInCombatMode = false
    -- no Find at all (survival.lua did not load): the same line, once, and no search
    Cam, loopFn = Fresh(CAMERA), nil
    ctx.Find = nil
    logs0 = #logs
    Run(1)
    check("no Find: one line, no error", Lines(logs0, "camera: no reticle switcher") == 1)
    ctx.Find = realFind
    -- a switcher that fails to read: one line, the camera goes on, and after three failures the reticle is let go
    Cam, loopFn = Fresh(CAMERA), nil
    local broken = NewSwitcher()
    function broken:GetActiveWidgetIndex() error("the game refused the call") end
    ctx.Find = function(W, name) if name == "ReticleSwitcher" then return broken end end
    logs0 = #logs
    local okE = true
    R.Set.walk = 325
    equipC.HeldEquipmentActorLeft, active = nil, 0
    for _ = 1, 700 do okE = okE and pcall(Tick) end
    check("broken reticle: no error, one line, the camera still moves", okE and Lines(logs0, "camera: reading the reticle failed") == 1 and At(325, 90))
    check("broken reticle: let go after three failures, with the fallback line", Lines(logs0, "camera: no reticle switcher") == 1)
    ctx.Find = realFind
    R.Set.walk = 300
    -- a sprint signal that fails to read: one line, the walk distance stays
    Cam, loopFn = Fresh(CAMERA), nil
    function sprintC:IsSprinting() error("the game refused the call") end
    logs0 = #logs
    local okS = true
    for _ = 1, 40 do okS = okS and pcall(Tick) end
    check("broken sprint signal: no error, one line, the walk distance", okS and Lines(logs0, "camera: reading the sprint failed") == 1 and At(300, 90))
    function sprintC:IsSprinting() return sprinting end
    -- no sprint component: one line, the camera works
    Cam, loopFn = Fresh(CAMERA), nil
    comps[SPRINT] = nil
    logs0 = #logs
    local okC = true
    for _ = 1, 100 do okC = okC and pcall(Tick) end
    check("no sprint component: no error, one line, the walk distance", okC and Lines(logs0, "camera: no Sprint component on the pawn") == 1 and At(300, 90))
    comps[SPRINT] = sprintC
    R.Set.on = false Tick() Run(R.GLIDE)
end

---------------------------------------------------------------- the game's bow zoom
-- Game 1.0.1: a bow draw wakes the camera controller, and from then on its tick writes the game's arm and its zoom every
-- frame, blended (probes of 20-10-2026): socket X 420, Y 70, Z -25, field of view 68, lag speed 30; out of the draw the
-- game's 700, side 20, field of view 75, lag 8. The fake does the same: 20 % of the way a frame.
do
    Cam, loopFn = Fresh(CAMERA), nil
    local ticking, woken, tickCalls = true, false, 0
    local ctl = Obj({})
    function ctl:SetComponentTickEnabled(on) tickCalls = tickCalls + 1 ticking = on end
    local cam = Obj({ FieldOfView = 75 })
    function cam:SetFieldOfView(v) self.FieldOfView = v end
    arm.CameraLagSpeed = 8
    local drawing = false
    pawn.PlayerCameraController, pawn.FollowCamera = ctl, cam
    function pawn:IsAiming() return drawing end
    local function Toward(v, to) local n = v + (to - v) * 0.2 return math.abs(n - to) < 0.01 and to or n end
    GameFrame = function()
        if not ticking then return end
        if drawing then woken = true end
        if not woken then return end
        local so = arm.SocketOffset
        arm.TargetArmLength = 700
        arm.SocketOffset = V3(Toward(so.X, drawing and 420 or 0), Toward(so.Y, drawing and 70 or 20), Toward(so.Z, drawing and -25 or 0))
        cam.FieldOfView = Toward(cam.FieldOfView, drawing and 68 or 75)
        arm.CameraLagSpeed = Toward(arm.CameraLagSpeed, drawing and 30 or 8)
    end
    local function Rested() local so = arm.SocketOffset
        return At(300, 90) and Near(so.X, 0) and Near(so.Z, 3) and Near(cam.FieldOfView, 75) and Near(arm.CameraLagSpeed, 8) end
    R.Set.on = true
    logs0 = #logs
    Tick() Run(R.GLIDE)
    check("bow zoom: the controller's tick off while the camera applies, one line", ticking == false and At(300, 90)
        and Lines(logs0, "camera: the game's camera controller paused, but in a bow draw") == 1)
    drawing = true
    Tick()
    check("bow zoom: a draw lets the controller run", ticking == true)
    Run(0.5)
    check("bow zoom: the game's zoom shows during the draw, no fight with the glide", At(700, 70) and arm.SocketOffset.X > 419
        and Near(cam.FieldOfView, 68) and Near(arm.CameraLagSpeed, 30))
    drawing = false
    Tick()
    check("bow zoom: after the draw the controller's tick off at once", ticking == false)
    -- one move: the side goes from the zoom's 70 straight to 90, never back through the game's 20; the zoom goes out with it
    local side, straight = arm.SocketOffset.Y, true
    for _ = 1, math.floor(R.GLIDE / 0.05 + 0.5) do
        Tick()
        if arm.SocketOffset.Y < side - 0.01 then straight = false end
        side = arm.SocketOffset.Y
    end
    check("bow zoom: the way back is one move, the side never swings back", straight)
    check("bow zoom: back at the walk view after one glide: distance, side, socket, field of view, lag", Rested())
    Run(3)
    check("bow zoom: and it stays there (the bug of 1.13: the game's 700 every frame)", Rested())
    -- a draw in the middle of the way back, then the way back again: to the values from before the first draw
    drawing = true Tick() Run(0.5)
    drawing = false Tick() Run(0.3)
    drawing = true Tick() Run(0.5)
    drawing = false Tick() Run(R.GLIDE)
    check("bow zoom: a draw in the middle of the way back: back to the view from before the first draw", Rested())
    -- camera off: the controller as the game had it
    R.Set.on = false
    Tick() Run(R.GLIDE)
    check("bow zoom: camera off: the controller's tick back on, the game's values", ticking == true and At(700, 20))
    local calls = tickCalls
    drawing = true Run(0.5) drawing = false Run(1)
    check("bow zoom: camera off: a draw is the game's alone", tickCalls == calls and ticking == true)
    -- a new world in the middle of a draw: the new player's controller starts with its tick on, and goes off
    R.Set.on = true Tick() Run(R.GLIDE)
    drawing = true Tick()
    Cam.Forget(false)
    woken, drawing = false, false
    arm = NewArm() pawn.CameraBoom = arm
    local ctl2 = Obj({ SetComponentTickEnabled = ctl.SetComponentTickEnabled })
    pawn.PlayerCameraController = ctl2
    ticking = true
    Tick() Run(R.GLIDE)
    check("bow zoom: new world: the new controller paused, close again", ticking == false and At(300, 90))
    -- a controller that refuses the call: one line, the camera still moves
    Cam, loopFn = Fresh(CAMERA), nil
    function ctl2:SetComponentTickEnabled() error("the game refused the call") end
    R.Set.walk = 325
    logs0 = #logs
    local okT = true
    for _ = 1, 40 do okT = okT and pcall(Tick) end
    check("bow zoom: a refused tick switch: no error, one line, the camera moves", okT and At(325, 90)
        and Lines(logs0, "camera: the game's camera controller failed") == 1)
    R.Set.walk = 300
    R.Set.on = false Tick() Run(R.GLIDE)
    GameFrame, pawn.PlayerCameraController, pawn.FollowCamera, pawn.IsAiming = nil, nil, nil, nil
end

-- the aim for the ammo counter: the game's own IsAiming on the character, not the aim reticle
local drawing = false
function pawn:IsAiming() return drawing end
active = 2 Tick()
check("ammo aim: the bow's aim reticle alone is no aim", Cam.Aiming() == false)
drawing = true
check("ammo aim: the game's IsAiming is the aim", Cam.Aiming() == true)
function pawn:IsAiming() error("not there") end
check("ammo aim: a read that fails is no aim", Cam.Aiming() == false)
pawn.IsAiming, active = nil, 0

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
if fails > 0 then error("tests failed") end
`;
const set = (name, v) => { lua.lua_pushstring(L, to_luastring(v)); lua.lua_setglobal(L, to_luastring(name)); };
set('RULES', read('camerarules.lua')); set('CAMERA', read('camera.lua'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== lua.LUA_OK) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }

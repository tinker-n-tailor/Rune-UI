-- The immersive camera: reads what the player does and moves the camera's distance and side. The rules and the
-- settings are in camerarules.lua (ctx.Rules); this file only talks to the game.
-- Game 1.0.1 left the player's camera controller off, so the game no longer moves the camera to its profile data
-- assets, not even for its own sprint, and nothing writes the camera arm (CameraBoom) any more: a value written there
-- stays (probes of 15-10-2026). So the mod glides the arm's TargetArmLength and side offset itself, on a loop that runs
-- every frame while a glide is on (ctx.Loop); a glide on the 50 ms step alone would show the steps. The game's values
-- are kept and glided back when the camera goes off; a new world has a new arm with the game's values. The lock-on view
-- is its own camera and stays the game's.
-- The signals: the combat switch, the actors in the hands, the HUD reticle (a bow's aim or a staff's cast: the combat
-- switch never went on with those) and the game's sprint signal.
-- Nothing runs while the camera is off, but a glide back and Hands and Building when crosshair.lua asks. main.lua loads
-- this file with pcall, so an error here leaves the rest of the mod running.

local M = {}

local CLASSES = { Combat = "/Script/Dominion.PlayerCombatModeComponent", Equip = "/Script/Dominion.PlayerEquipmentComponent",
    -- IsSprinting() is a clean true or false (probe of 05-10-2026)
    Sprint = "/Game/Gameplay/Character/Components/BP_Components_Sprint.BP_Components_Sprint_C" }
local NO_RETICLE = "camera: no reticle switcher, ranged zoom follows the combat switch"
local RETICLE_LINES = 40   -- "camera: reticle" lines a game start, at most

local Mem = nil          -- camerarules' memory, made on first use
local Comp = {}          -- the pawn's components: Combat, Equip, Sprint; the pawn's address
local Hands = {}         -- the last class name read for each hand's actor, by address: a name is not read every step
-- the HUD reticle's switcher: Switcher, Names (a child's class name by index: the children never change), Name (the
-- active one), and Fails and RetryAt for ctx.MayTry
local Ret = { Names = {} }
local ReticleLines = 0   -- not reset by a new world: the cap is per game start
local Orig = nil         -- the game's arm: { Arm, X, Y, Z }
local Arm = nil          -- the camera arm the glide writes
local G = {}             -- the glide (camerarules Glide); Moving while it is not there yet
local State = {}   -- the readings of a step, one table for the whole session
local Logged = {}
local function Once(ctx, key, msg) if not Logged[key] then Logged[key] = true ctx.Log(msg) end end
local function Ok(o) return o ~= nil and o:IsValid() end

M.Applied = false
-- the perf line: the steps in its minute; From 0 until the camera runs
local function NewPerf(now) return { From = now, N = 0, Sum = 0, Max = 0 } end
M.Perf = NewPerf(0)

-- the component of the class at path on the pawn; the list is a table or the game's array, as in the preview
local function Component(pawn, path)
    local cls = StaticFindObject(path)
    if not Ok(cls) then return nil end
    local list, found = pawn:K2_GetComponentsByClass(cls), nil
    local function Take(e)
        local C = e
        if not pcall(function() return e:GetFullName() end) then C = e:get() end
        if C and C:IsValid() then found = C end
    end
    if type(list) == "table" then for _, e in ipairs(list) do Take(e) end
    elseif list then list:ForEach(function(_, e) Take(e) end) end
    return found
end

-- the components again when the pawn changed or one went away; at most every 2 s while one is missing
local function Find(ctx, pawn, now)
    local addr = pawn:GetAddress()
    if Comp.Addr == addr and Ok(Comp.Combat) and Ok(Comp.Equip) and Ok(Comp.Sprint) then return end
    if Comp.Addr == addr and now < (Comp.Next or 0) then return end
    Comp = { Addr = addr, Next = now + 2 }
    for k, path in pairs(CLASSES) do
        local ok, c = pcall(Component, pawn, path)
        if ok then Comp[k] = c end
        if not (ok and c) then Once(ctx, "no" .. k, "camera: no " .. k .. " component on the pawn") end
    end
end

local function Held(A, hand)
    if not Ok(A) then Hands[hand .. "A"], Hands[hand] = nil, nil return nil end   -- an empty hand: a new actor may take the old address
    local addr = A:GetAddress()
    if Hands[hand .. "A"] ~= addr then Hands[hand .. "A"], Hands[hand] = addr, A:GetClass():GetFName():ToString() end
    return Hands[hand]
end

-- The switcher of the HUD reticle (WBP_HUD_ReticleWidget_C, its child ReticleSwitcher), found once and checked before
-- each use. A search that finds nothing tries again 10 s later, 3 times a world (ctx.MayTry); then the ranged zoom
-- follows the combat switch alone, and the log says so once.
local function Switcher(ctx)
    if Ok(Ret.Switcher) then return Ret.Switcher end
    Ret.Switcher, Ret.Names, Ret.Name = nil, {}, nil
    if (Ret.Fails or 0) >= 3 or not (ctx.Reticle and ctx.Find) then Once(ctx, "noreticle", NO_RETICLE) return nil end
    if not ctx.MayTry(Ret) then return nil end
    local ok, S = pcall(function() return ctx.Find(ctx.Reticle(), "ReticleSwitcher") end)
    if ok and Ok(S) then Ret.Switcher = S return S end
    ctx.Failed(Ret)
    if Ret.Fails >= 3 then Once(ctx, "noreticle", NO_RETICLE) end
end

-- True while the reticle of a bow's aim or a staff's cast shows: one call a step for the active index, and the class
-- name of a child read once. A line in the log when the active reticle changes.
local function Aiming(ctx)
    local S = Switcher(ctx)
    if not S then return false end
    local i = S:GetActiveWidgetIndex()
    local name = Ret.Names[i]
    if not name then
        local W = S:GetChildAt(i)
        name = Ok(W) and W:GetClass():GetFName():ToString() or "none"
        Ret.Names[i] = name
    end
    if name ~= Ret.Name then
        Ret.Name = name
        if ReticleLines < RETICLE_LINES then ReticleLines = ReticleLines + 1 ctx.Log("camera: reticle " .. name) end
    end
    return ctx.Rules.AimReticle(name)
end

-- one step's readings into State; the pawn, or nil when there is none yet
local function Read(ctx, now)
    local pc = ctx.Controller()
    local pawn = pc and pc.Pawn
    if not Ok(pawn) then return nil end
    Find(ctx, pawn, now)
    local s = State
    s.Combat = Ok(Comp.Combat) and Comp.Combat.bIsInCombatMode == true
    s.Right, s.Left = nil, nil
    if Ok(Comp.Equip) then
        s.Right = Held(Comp.Equip.HeldEquipmentActorRight, "R")
        s.Left = Held(Comp.Equip.HeldEquipmentActorLeft, "L")
    end
    -- its own pcall each: a reticle or a sprint signal that cannot be read must not stop the camera
    local okS, sprint = pcall(function() return Ok(Comp.Sprint) and Comp.Sprint:IsSprinting() end)
    if not okS then Once(ctx, "sprint", "camera: reading the sprint failed: " .. tostring(sprint)) end
    s.Sprinting = okS and sprint == true
    local ok, aim = pcall(Aiming, ctx)
    if not ok then   -- counts as a failed search
        Once(ctx, "reticle", "camera: reading the reticle failed: " .. tostring(aim))
        Ret.Switcher = nil
        ctx.Failed(Ret)
    end
    s.Aiming = ok and aim == true
    return pawn
end

-- The game's arm values, once per session. Kept in a shared variable of UE4SS too: a restart of the mods while the game
-- runs starts this file again with the arm still as the old run left it, and that must not pass as the game's.
local function Saved(ctx)
    local saved = ctx.Shared and ctx.Shared("arm")
    local a, x, y, z = string.match(tostring(saved), "^(%-?[%d%.]+),(%-?[%d%.]+),(%-?[%d%.]+),(%-?[%d%.]+)$")
    if a then return { Arm = tonumber(a), X = tonumber(x), Y = tonumber(y), Z = tonumber(z) } end
end

local function Keep(ctx, A)
    Orig = Saved(ctx)
    if Orig then return end
    local so = A.SocketOffset
    Orig = { Arm = A.TargetArmLength, X = so.X, Y = so.Y, Z = so.Z }
    if ctx.Shared then ctx.Shared("arm", string.format("%.3f,%.3f,%.3f,%.3f", Orig.Arm, Orig.X, Orig.Y, Orig.Z)) end
    ctx.Log(string.format("camera: the game's camera kept, distance %.0f, side %.0f", Orig.Arm, Orig.Y))
end

local function Write(A, a, y)
    A.TargetArmLength = a
    local so = A.SocketOffset
    A.SocketOffset = { X = so.X, Y = y, Z = so.Z }
end

-- the glide's place now on the arm; called every frame by ctx.Loop, and by the step without it
local function Move()
    if not G.Moving then return end
    if not Ok(Arm) then G.Moving = false return end
    local a, y, there = M.Rules.GlideAt(G, os.clock())
    if not pcall(Write, Arm, a, y) then G.Moving = false return end
    if there then G.Moving = false end
end

-- a glide of the arm to (a, y) from where it is now, when that is a new target
local function GlideTo(ctx, a, y, secs)
    local so = Arm.SocketOffset
    if ctx.Rules.Glide(G, a, y, secs, os.clock(), Arm.TargetArmLength, so.Y) then G.Moving = true end
    if not M.Looping and ctx.Loop then
        M.Looping = true
        ctx.Loop(1, function() pcall(Move) return false end)
    end
end

-- the game's camera back: a glide to the game's values, finished by the loop
local function Restore(ctx)
    if Ok(Arm) and Orig then pcall(GlideTo, ctx, Orig.Arm, Orig.Y, ctx.Rules.GLIDE) end
    M.Applied, M.View, M.Perf, M.Checked = false, nil, NewPerf(0), true
    Mem = nil   -- forgets the fight
    ctx.Log("camera: the game's camera back")
end

-- A run that started while the arm still held the values of an earlier run (a restart of the mods) and does not apply
-- (camera off): the game's values saved by that run are written back, once. True when done.
local function Leftover(ctx)
    local o = Saved(ctx)
    if not o then return true end
    local pc = ctx.Controller()
    local A = pc and Ok(pc.Pawn) and pc.Pawn.CameraBoom
    if not Ok(A) then return false end   -- no player yet: looked for again
    pcall(Write, A, o.Arm, o.Y)
    ctx.Log("camera: the game's camera put back after a restart of the mods")
    return true
end

function M.Forget(sameWorld)
    Comp, Hands, Ret = {}, {}, { Names = {} }
    -- the arm goes with the player; a new one has the game's values, and the camera glides from there
    Arm, G = nil, {}
    if not sameWorld then
        M.Applied, M.View, Mem = false, nil, nil
        Logged = {}
    end
end

-- The class names of the actors in the right and the left hand, for crosshair.lua: read also while the camera is
-- off. nil before the camera's first step, without a pawn, or for an empty hand.
function M.Hands()
    local ctx = M.Ctx
    local pc = ctx and ctx.Controller()
    local pawn = pc and pc.Pawn
    if not Ok(pawn) then return nil, nil end
    Find(ctx, pawn, os.clock())
    if not Ok(Comp.Equip) then return nil, nil end
    return Held(Comp.Equip.HeldEquipmentActorRight, "R"), Held(Comp.Equip.HeldEquipmentActorLeft, "L")
end

-- Whether the player draws a bow, for immersive.lua (the ammo counter): the game's own IsAiming on the character, read
-- also while the camera is off. Not the reticle, as the zoom: the bow's and the staff's aim reticles show the whole time
-- the weapon is in hand, and a staff never aims (probes of 19-10-2026). False before the camera's first step.
-- named, so a pcall of it makes no closure (4 calls a second)
local function PawnAims()
    local pc = M.Ctx.Controller()
    local pawn = pc and pc.Pawn
    return Ok(pawn) and pawn:IsAiming()
end
function M.Aiming()
    if not M.Ctx then return false end
    local ok, aim = pcall(PawnAims)
    return ok and aim == true
end

-- Whether the player is in the build mode, for crosshair.lua: the controller's BuildModeComponent (ADominionPlayerController)
-- has CurrentBuildMode, an EBuildMode: 0 None, 1 Selection, 2 Placement, 3 RepairAndEdit (class dump of 14-10-2026).
function M.Building()
    local pc = M.Ctx and M.Ctx.Controller()
    local B = Ok(pc) and pc.BuildModeComponent
    return Ok(B) and (B.CurrentBuildMode or 0) ~= 0
end

function M.Tick(ctx)
    M.Ctx, M.Rules = ctx, ctx.Rules
    if not ctx.Loop then Move() end
    local R = ctx.Rules
    if not R.Set.on then
        if M.Applied then Restore(ctx)
        elseif not M.Checked then M.Checked = Leftover(ctx) end
        return
    end
    local now = os.clock()
    Mem = Mem or R.NewMemory()
    if M.Perf.From == 0 then M.Perf.From = now end   -- the minute of the perf line starts with the camera
    local ok, pawn = pcall(Read, ctx, now)
    if not ok then Once(ctx, "read", "camera: reading the player failed: " .. tostring(pawn)) return end
    if not pawn then return end   -- no pawn yet
    local A = pawn.CameraBoom
    if not Ok(A) then Once(ctx, "arm", "camera: no camera arm on the player") return end
    -- a new arm (a new player) starts from its own values
    if Arm == nil or A:GetAddress() ~= Arm:GetAddress() then Arm, G = A, {} end
    local out = R.Step(Mem, State, now)
    if not out.Active then return end
    if not Orig then Keep(ctx, A) end
    M.Applied = true
    GlideTo(ctx, out.Distance, out.Side, out.Glide)
    -- a log line when the view changes: with the reticle lines it shows what starts the ranged view
    local view = out.View
    if view ~= M.View then
        M.View = view
        ctx.Log(string.format("camera: %s, distance %.0f (right hand %s, left hand %s)", view, out.Distance, tostring(State.Right), tostring(State.Left)))
    end
    local P, took = M.Perf, os.clock() - now
    P.N, P.Sum, P.Max = P.N + 1, P.Sum + took, math.max(P.Max, took)
    if now - P.From > 60 then
        ctx.Log(string.format("perf: camera %d steps, avg %.3f ms, max %.2f ms", P.N, P.Sum / math.max(1, P.N) * 1000, P.Max * 1000))
        M.Perf = NewPerf(now)
    end
end

return M

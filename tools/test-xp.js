// Tests Rune XP's state (xp.lua) without the game: the fade, the fill that sweeps in and glides, a new level, another
// skill while the bar shows, and that the result does not depend on the length of a step. Needs fengari.
// Run: node tools/test-xp.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'xp.lua'), 'utf8');
const test = `
local M = load(SRCTEXT)()
local function run(S, seconds, dt) for _ = 1, math.floor(seconds / dt + 0.5) do M.Step(S, dt) end end
local function near(a, b, e) return math.abs(a - b) <= (e or 0.01) end

-- a first notice: from unseen the fill starts at the left end, then glides to the progress
local S = M.New()
M.Take(S, "T_Notification_Skill_Woodcutting", 0.6)
assert(S.Cur == 0 and S.Target == 0.6 and S.Want == 1, "the fill sweeps in from empty")
local before = S.Cur
M.Step(S, 0.05)
assert(S.Cur > before and S.Cur < 0.6, "one step moves the fill, not all the way")
run(S, 0.3, 0.05)
assert(S.Alpha == 1, "seen after a third of a second, alpha " .. S.Alpha)
run(S, 4, 0.05)
assert(S.Cur == 0.6, "the fill ends on the progress, " .. S.Cur)

-- more XP in the same skill while it shows: the fill goes on from where it is
M.Take(S, "T_Notification_Skill_Woodcutting", 0.7)
assert(S.Cur == 0.6 and S.Target == 0.7, "a second gain glides on from the first")

-- a new level: the progress is lower than the fill, so the bar starts again from empty
run(S, 4, 0.05)
M.Take(S, "T_Notification_Skill_Woodcutting", 0.05)
assert(S.Cur == 0 and S.Target == 0.05, "a new level starts from empty")

-- another skill while the bar shows: from where that skill stood last time, or a little before its value
M.Take(S, "T_Notification_Skill_Mining", 0.5)
assert(near(S.Cur, 0.42), "an unknown skill starts a little before its value, " .. S.Cur)
run(S, 4, 0.05)
M.Take(S, "T_Notification_Skill_Woodcutting", 0.2)
assert(near(S.Cur, 0.05), "a known skill starts where it stood, " .. S.Cur)

-- the notice ends: a soft fade, and nothing below 0
M.Rest(S)
run(S, 0.2, 0.05)
assert(S.Alpha > 0 and S.Alpha < 1, "the fade out takes more than a fifth of a second")
run(S, 1, 0.05)
assert(S.Alpha == 0, "unseen after the fade")
run(S, 3, 0.05)   -- the fill ends its glide
local fade, fill = M.Step(S, 0.05)
assert(not fade and not fill, "at rest a step changes nothing")

-- the same motion with long and short steps
local A, B = M.New(), M.New()
M.Take(A, "x", 0.8) M.Take(B, "x", 0.8)
run(A, 0.6, 0.05) run(B, 0.6, 0.02)
assert(near(A.Cur, B.Cur, 0.02), "steps of 50 ms and 20 ms give the same fill: " .. A.Cur .. " and " .. B.Cur)

-- a progress out of range is held to 0..1
local C = M.New()
M.Take(C, "x", 1.7)
assert(C.Target == 1, "above 1 is 1")
M.Take(C, "x", -0.3)
assert(C.Target == 0, "below 0 is 0")

-- two notices at once: each has its turn, then round again; one notice is always the first
assert(M.Pick(1, 99) == 1 and M.Pick(2, 0) == 1 and M.Pick(2, 1.4) == 1 and M.Pick(2, 1.6) == 2 and M.Pick(2, 3.1) == 1, "two skills take turns")
assert(M.Pick(3, 3.1) == 3, "three skills too")

assert(M.SkillName("T_Notification_Skill_Woodcutting") == "WOODCUTTING")
assert(M.SkillName("T_Notification_Skill_Rune_Crafting") == "RUNE CRAFTING")
-- the level up notice's icons have another prefix (probe of 04-10-2026)
assert(M.SkillName("T_Icon_Tag_Skill_Runecrafting") == "RUNECRAFTING", "the level up icon's name")
assert(M.SkillName("T_Icon_Tag_Skill_Attack") == "ATTACK")

-- the slim level up: on show while the game's own opacity is above zero
assert(not M.LevelShown(0) and not M.LevelShown(0.0) and not M.LevelShown(nil), "idle: not on show")
assert(M.LevelShown(0.17) and M.LevelShown(1) and M.LevelShown(0.53), "rising, full and fading: on show")
-- a fresh world: the notice sits at full opacity with a sample in it; it counts only after it was seen below full
assert(not M.LevelArmed(false, 1) and not M.LevelArmed(false, nil), "full from the start: not armed")
assert(M.LevelArmed(false, 0) and M.LevelArmed(false, 0.17) and M.LevelArmed(true, 1), "seen below full once: armed, and it stays")
-- a level up is bigger than an XP notice: a pop at the start, then it holds; no level up is the plain size
local Z = M.New()
assert(M.SizeNow(Z, 0) == 1 and not M.Moving(Z, 0), "no level up: the plain size, at rest")
M.LevelIn(Z, 10)   -- the row is unseen (Alpha 0)
local function Grow(seconds) return M.SizeNow(Z, 10 + seconds) end
local BIG = Grow(3)
assert(BIG > 1.3 and Grow(0) > BIG, "a pop, then big")
-- the pop: it only goes down, it ends exactly on BIG and stays there, and no frame (1/60 s) moves it by much
local prev, maxStep = Grow(0), 0
for i = 1, 180 do
    local g = Grow(i / 60)
    assert(g <= prev + 1e-12, "the pop never grows again, at frame " .. i)
    maxStep = math.max(maxStep, prev - g)
    prev = g
end
assert(prev == BIG and Grow(0.3) == BIG and Grow(1000) == BIG, "it ends exactly on BIG, after a third of a second")
assert(maxStep < 0.06, "no jump between two frames, the largest step is " .. maxStep)
assert(Grow(0) - Grow(1 / 60) > 0.02, "fast at first")
assert(Grow(0.27) - Grow(0.3) < 0.002, "slow into its rest: no visible stop")
assert(M.Moving(Z, 10.1) and not M.Moving(Z, 10.3), "it is moving only while it pops")
-- nothing makes it smaller at the end (test-slimlevel.js walks the fade), and a second call does not start it again
M.LevelIn(Z, 12)
assert(Grow(5) == BIG and Grow(5.5) == BIG, "long after the pop the size is still BIG")
-- an XP notice takes the row from the level up: from the size it has to the plain size, soft at both ends, no jump
local function Soft(S, from, to, at, name)
    local last, step = M.SizeNow(S, at), 0
    assert(last == from, name .. ": it starts at the size the row has")
    for i = 1, 60 do
        local g = M.SizeNow(S, at + i / 60)
        assert((to - from) * (g - last) >= -1e-12, name .. ": one way only, at frame " .. i)
        step = math.max(step, math.abs(g - last))
        last = g
    end
    assert(last == to and step < 0.04, name .. ": it ends on its size, the largest step is " .. step)
    assert(math.abs(M.SizeNow(S, at + 1 / 60) - from) < 0.01 and math.abs(M.SizeNow(S, at + 0.38) - to) < 0.01, name .. ": a soft start and a soft end")
    assert(M.Moving(S, at + 0.2) and not M.Moving(S, at + 0.5), name .. ": moving only while it changes size")
end
M.LevelOut(Z, 20)
assert(Z.LevelAt == nil, "the level up is over")
Soft(Z, BIG, 1, 20, "back to the XP row")
M.LevelOut(Z, 20.2)
assert(M.SizeNow(Z, 20.2) > 1.1, "a second XP look does not start the way back again")
-- a level up over an XP row on show: it grows from the plain size, with no pop above the big size
Z.Alpha = 1
M.LevelIn(Z, 30)
Soft(Z, 1, BIG, 30, "a level up over an XP row")
-- an XP notice in the middle of that: from where the size is
M.LevelOut(Z, 40) M.LevelIn(Z, 40.2) M.LevelOut(Z, 40.4)
local mid = M.SizeNow(Z, 40.4)
assert(mid > 1 and mid < BIG, "a change half way starts from the size the row has")
-- the line under the fill is as bright as the row is big
assert(M.Bright(1) < 0.5 and M.Bright(BIG) == 1 and M.Bright(BIG + 0.3) == 1 and M.Bright(1.3) > M.Bright(1) and M.Bright(1.3) < 1, "the line gets bright with the size")
-- the row unseen: the plain size again, at once
M.LevelGone(Z)
assert(M.SizeNow(Z, 50) == 1 and not M.Moving(Z, 50) and Z.LevelAt == nil, "gone: the plain size")
-- the opacity of a level up: soft at both ends, only up, and 1 well within the pop; an XP notice keeps its own rate
assert(M.LevelFade(0, 0) == 0 and M.LevelFade(1, 0) == 1 and M.LevelFade(-1, 0) == 0, "from nothing to full")
local fade, fstep = 0, 0
for i = 1, 30 do
    local a = M.LevelFade(i / 60, 0)
    assert(a >= fade - 1e-12, "the level up opacity never falls, at frame " .. i)
    fstep = math.max(fstep, a - fade)
    fade = a
end
assert(fade == 1 and fstep < 0.12, "full within a third of a second, the largest step is " .. fstep)
assert(M.LevelFade(1 / 60, 0) < 0.05, "a soft start")
assert(M.LevelFade(0, 0.4) == 0.4 and M.LevelFade(1, 0.4) == 1, "it takes over from the opacity the row had")
-- who has the row: a level up wins, the XP goes on after it
assert(M.Owner(true, true) == "level" and M.Owner(true, false) == "level", "a level up wins over an XP notice")
assert(M.Owner(false, true) == "xp" and M.Owner(false, false) == nil, "the XP row goes on after it")
assert(M.LevelLabel("21") == "Level 21" and M.LevelLabel(" 5 ") == "Level 5" and M.LevelLabel("") == nil and M.LevelLabel(nil) == nil, "the level text")

-- a level up in the row over time (fake clock): the line fills full and thick, holds while the game shows the notice,
-- fades after it, and an XP notice after that starts again from empty
local V = M.New()
M.Take(V, "level:T_Icon_Tag_Skill_Attack", 1)
run(V, 0.3, 0.05)
assert(V.Alpha == 1 and V.Cur > 0.4, "the level up shows within a third of a second, the fill on its way")
run(V, 3, 0.05)
assert(V.Cur == 1 and V.Alpha == 1, "the line is full while the notice shows")
M.Rest(V)
run(V, 3, 0.05)
assert(V.Alpha == 0, "gone after the notice")
M.Take(V, "T_Notification_Skill_Attack", 0.3)
assert(V.Cur == 0 and V.Target == 0.3, "the XP row starts again from empty")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

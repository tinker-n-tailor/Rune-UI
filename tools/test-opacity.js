// Tests how apply.lua remembers the game's opacity of a widget that the editor or the immersive mode writes to
// (SetOpacity, RestoreOpacity), without the game. The game's opacity is read once, at the first write: the game fades its
// notices by its own animation, so a later read can be a point of a fade. Only the level up notice, whose fade ends at the
// value we write, has an idle value (Idle=0 in its element) that is written back instead. The second half drives the
// whole file (ApplyAll) and counts the calls into the engine: an idle step calls nothing, a held value is read back
// four times a second, and at every step once the game has written over it.
// Needs npm install once. Run: node tools/test-opacity.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const apply = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'apply.lua'), 'utf8');
const START = "-- Keyed by the widget's full name", END = '-- The F9 opacity.';
const code = apply.slice(apply.indexOf(START), apply.indexOf(END));
if (apply.indexOf(START) < 0 || apply.indexOf(END) < apply.indexOf(START)) { console.log('FAIL apply.lua: the opacity memory was not found between its two comment lines'); process.exit(1); }
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const test = `
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local writes = 0
-- a widget as the game has it: the opacity is read back as a 32-bit number
local function Widget(op)
  local W = { op = op }
  function W:GetRenderOpacity() return self.op end
  function W:SetRenderOpacity(v) writes = writes + 1 self.op = v end
  return W
end
${code}
local function near(a, b) return math.abs(a - b) < 0.001 end

-- the notice sits at 1 in a fresh world (seen in the game, 05-10-2026), F9 opens and closes, a real level up fades it to 0
local up = Widget(1.0)
SetOpacity(up, "up", 0.3) SetOpacity(up, "up", 0.3)   -- F9 open: the editor dims it, step after step
RestoreOpacity(up, "up")                               -- F9 closed
check("F9 once: the notice is back at the game's 1", near(up.op, 1.0))
up.op = 0.0                                            -- the real level up played and the game faded it out
SetOpacity(up, "up", 1.0)                              -- F9 open again
RestoreOpacity(up, "up", 0)                            -- F9 closed again (the level up element: Idle=0)
check("F9 again after a level up: the notice stays at the game's 0, not the old 1", near(up.op, 0.0))

-- the game fades a notice out while F9 is open: the editor writes over every step, the game writes in between
local fade = Widget(0.6)
SetOpacity(fade, "fade", 1.0)
fade.op = 0.3 SetOpacity(fade, "fade", 1.0)
fade.op = 0.0 SetOpacity(fade, "fade", 1.0)            -- the last write of the game's fade
RestoreOpacity(fade, "fade", 0)
check("a level up notice that faded out while F9 was open: gone after it, not at the 0.6 of the open", near(fade.op, 0.0))

-- F9 closes while the notice still fades: the game's value stands
local going = Widget(0.6)
SetOpacity(going, "going", 1.0)
going.op = 0.45                                        -- the game wrote after the editor's last step
RestoreOpacity(going, "going")
check("F9 closes during a fade: the game's own value is left", near(going.op, 0.45))
check("... and the editor no longer holds the widget", Written["going"] == nil)

-- a hidden element is written at 0 on every step: one write, and the game's opacity comes back with the switch
local hid = Widget(1.0)
writes = 0
for _ = 1, 5 do SetOpacity(hid, "hid", 0.0) end
check("hidden for 5 steps: at 0", near(hid.op, 0.0))
check("hidden for 5 steps: the game's opacity is kept", near(OrigOpacity["hid"], 1.0))
RestoreOpacity(hid, "hid")
check("shown again: back to 1", near(hid.op, 1.0))
-- the game writes while it is hidden: the first value still comes back, never a point of a fade
SetOpacity(hid, "hid", 0.0)
hid.op = 0.8
SetOpacity(hid, "hid", 0.0)
RestoreOpacity(hid, "hid")
check("the game wrote while it was hidden: the opacity from before the first write comes back", near(hid.op, 1.0))

-- an element that has the immersive fade: written at 0.5, then back
local imm = Widget(1.0)
SetOpacity(imm, "imm", 0.5)
check("the fade is written", near(imm.op, 0.5))
SetOpacity(imm, "imm", 0.25)
RestoreOpacity(imm, "imm")
check("the fade ends: the game's 1 comes back", near(imm.op, 1.0))

-- the level up notice hidden in F9: the editor writes 0 on every step, a real level up plays, and the game's fade ends at
-- exactly 0, our own value, so the last value that a step caught is a point in the middle of the fade.
-- Showing it again must not bring that back: the slim row feeds on any opacity above 0.02. The element says that the game
-- leaves the widget at 0 when idle (Idle in elements.lua), and that is what comes back.
local IDLE = 0
local hidden = Widget(1.0)
for _ = 1, 3 do SetOpacity(hidden, "hidden", 0.0) end
hidden.op = 0.8 SetOpacity(hidden, "hidden", 0.0)
hidden.op = 0.4 SetOpacity(hidden, "hidden", 0.0)
hidden.op = 0.12 SetOpacity(hidden, "hidden", 0.0)    -- the last step that caught the fade
hidden.op = 0.0 SetOpacity(hidden, "hidden", 0.0)     -- the end of the fade is our own value
RestoreOpacity(hidden, "hidden", IDLE)
check("a level up notice hidden in F9, shown again: not above 0.02", hidden.op <= 0.02)
-- the game still fades it when F9 closes: its own value stays, as before
local mid = Widget(1.0)
SetOpacity(mid, "mid", 0.0)
mid.op = 0.3
RestoreOpacity(mid, "mid", IDLE)
check("an idle value is not written over a notice that is fading now", near(mid.op, 0.3))
-- the other elements have no idle value: the saved original comes back
local plain = Widget(0.9)
SetOpacity(plain, "plain", 0.0)
RestoreOpacity(plain, "plain", nil)
check("no idle value: the game's saved opacity comes back", near(plain.op, 0.9))

-- the picked-up items (WBP_ItemPickups_C, seen in the game, 05-10-2026): the game fades the notice by its own animation of the
-- render opacity. It rests at 1. While F9 is open the editor writes over it every step, and the game's animation writes
-- between two steps: a value from the middle of a fade must not become what comes back at the close.
local pick = Widget(1.0)
SetOpacity(pick, "pick", 0.3)
pick.op = 0.2 SetOpacity(pick, "pick", 0.3)   -- the game's fade in, a step later
pick.op = 0.45 SetOpacity(pick, "pick", 0.3)
RestoreOpacity(pick, "pick", nil)              -- F9 closes while the editor still holds it
check("picked-up items: after F9 the notice is at the game's resting 1, not at a point of its fade", near(pick.op, 1.0))

-- a widget that was never written to is left alone, also when the editor closes
local never = Widget(0.7)
writes = 0
RestoreOpacity(never, "never")
check("never touched: no write", writes == 0 and near(never.op, 0.7))

-- a held opacity is written once; the game's write over it is written back at the next look
local held = Widget(1.0)
writes = 0
for _ = 1, 5 do SetOpacity(held, "held", 0.4) end
check("a value held for 5 steps: one write", writes == 1 and near(held.op, 0.4))
held.op = 0.9 SetOpacity(held, "held", 0.4)
check("the game wrote over it: written back, once", writes == 2 and near(held.op, 0.4))
SetOpacity(held, "held", 0.3)
check("a new value: one write", writes == 3 and near(held.op, 0.3))

-- ApplyOne through ApplyAll, with the whole file: how many calls a step makes into the engine
local writes2, reads2, redraws, valids = 0, 0, 0, 0
local function Wid(op, isUW)
  local W = { op = op, tint = nil, kids = {} }
  function W:IsValid() valids = valids + 1 return true end
  function W:GetRenderOpacity() reads2 = reads2 + 1 return self.op end
  function W:SetRenderOpacity(v) writes2 = writes2 + 1 self.op = v end
  function W:SetRenderTranslation() writes2 = writes2 + 1 end
  function W:SetRenderScale() writes2 = writes2 + 1 end
  function W:SetRenderTransformPivot() writes2 = writes2 + 1 end
  function W:SetColorAndOpacity(c) writes2 = writes2 + 1 self.tint = c.A end
  function W:IsA() return isUW end
  function W:GetFName() return { ToString = function() return self.name or "" end } end
  function W:GetChildrenCount() return #self.kids end
  function W:GetChildAt(i) return self.kids[i + 1] end
  return W
end
StaticFindObject = function() return { IsValid = function() return true end } end
local imm = {}   -- by element id: the immersive share
local Elements2 = {}
local function Elem(id, extra)
  local E = { Id = id, Visible = true, Opacity = 1, X = 0, Y = 0, Scale = 1, Instances = {}, Keys = {}, Last = {}, PartsW = {}, PartsOp = {} }
  for k, v in pairs(extra or {}) do E[k] = v end
  E.Instances[1], E.Keys[1] = E.W, id
  Elements2[#Elements2 + 1] = E
  return E
end
local Layout2 = { ById = function(id) for _, E in ipairs(Elements2) do if E.Id == id then return E end end end,
  LocalTransform = function() return 0, 0, 1 end, Pivot = function() return 0.5, 0.5 end }
local clock, logs = 100, {}
os.clock = function() return clock end
local A = (function() ${apply} end)()
A.Init({ Elements = Elements2, Layout = Layout2, Log = function(m) logs[#logs + 1] = m end })
local legendPages = { Wid(1.0), Wid(1.0) }
local switcher = Wid(1.0) switcher.kids = legendPages
A.Attach({ Immersive = { Factor = function(E) return imm[E.Id] or 1.0 end },
  Survival = { Find = function() return switcher end } })
local shown = Elem("shown", { W = Wid(1.0, true) })
local hidden = Elem("hidden", { W = Wid(1.0), Visible = false })
local faded = Elem("faded", { W = Wid(1.0) })
local dimmed = Elem("dimmed", { W = Wid(1.0, true), Opacity = 0.5 })
local solid = Elem("solid", { W = Wid(1.0), Opaque = true })
local legend = Elem("legend", { W = Wid(1.0), Parts = true, Visible = false })
local dial = Elem("dial", { W = Wid(1.0), Redraw = "Box" })
dial.W.Box = { IsValid = function() return true end, RequestRender = function() redraws = redraws + 1 end }
Elem("toolbar")
for _, E in ipairs(Elements2) do if E.W then E.Instances[1] = E.W E.Keys[1] = E.Id E.W.name = E.Id end end
for _, p in ipairs(legendPages) do p.name = "page" end
imm.faded = 0.5
-- one step of the mod, 50 ms after the last; quarter: a quarter second and one step more, so every held value is read back
local function look(edit) clock = clock + 0.05 A.All(false, edit or false, false, 1) end
local function quarter(edit) for _ = 1, 6 do look(edit) end end
local function Said(id) for _, m in ipairs(logs) do if m:find(id .. ": the game writes its opacity", 1, true) then return true end end return false end
A.All(true, false, false, 1)   -- the scan step writes it all
check("first step: hidden element at 0, faded at 0.5, parts at 0", hidden.W.op == 0 and faded.W.op == 0.5 and legendPages[1].op == 0 and legendPages[2].op == 0)
check("first step: the user widget gets its colour once", dimmed.W.tint == 0.5)
writes2 = 0 redraws = 0 reads2 = 0 valids = 0
for _ = 1, 20 do look() end
check("20 idle steps with a hidden element, a faded one, hidden parts and a dimmed one: no write to the engine", writes2 == 0)
check("... and the dial is not drawn again while its opacity is the same", redraws == 0)
-- 20 steps are a second: 4 looks. Held: hidden, faded, solid and the two parts (5 reads a look); the dial is read at every step.
check("... the held values are read back 3 or 4 times in that second, the dial at every step (" .. reads2 .. " reads)", reads2 >= 3 * 5 + 20 and reads2 <= 4 * 5 + 20)
check("... and a widget with nothing held gets no call at all (" .. valids .. " validity calls)", valids <= 4 * 6 + 20)
hidden.W.op = 0.7 look()
quarter()
check("the game fades a hidden element in for the first time: written back within a quarter second, once", hidden.W.op == 0 and writes2 == 1 and Said("hidden"))
hidden.W.op = 0.7 writes2 = 0 look()
check("... and from then on at the next step", hidden.W.op == 0 and writes2 == 1)
legendPages[2].op = 0.6 writes2 = 0 quarter()
check("the game fades a prompt in while the legend is hidden: written back, only that one", legendPages[2].op == 0 and legendPages[1].op == 0 and writes2 == 1 and Said("legend"))
legendPages[1].op = 0.6 writes2 = 0 look()
check("... and from then on at the next step", legendPages[1].op == 0 and writes2 == 1)
imm.faded = 0.4 writes2 = 0 look()
check("the immersive share changes: one write", faded.W.op == 0.4 and writes2 == 1)
dial.W.op = 0.5 redraws = 0 look() look()
check("the dial changes opacity: drawn again once", redraws == 1)
solid.W.op = 0.8 writes2 = 0 quarter()
check("the solid dial is faded by the game: written back", solid.W.op == 1.0 and writes2 == 1 and Said("solid"))
dimmed.Opacity = 0.25 writes2 = 0 look() look()
check("the F9 opacity changes: the colour is written once", dimmed.W.tint == 0.25 and writes2 == 1)
imm.faded = 1.0 writes2 = 0 look()
check("the immersive share is whole again: the game's opacity comes back, once", faded.W.op == 1.0 and writes2 == 1)
writes2 = 0
for _ = 1, 5 do look() end
check("... and no more", writes2 == 0)
legend.Visible = true look()
check("the legend shown again: its parts come back", legendPages[1].op == 1 and legendPages[2].op == 1)
writes2 = 0
for _ = 1, 5 do look() end
check("... and are left alone", writes2 == 0)
-- the mod's own writes are not the game's: F9 over an element that was never written over does not mark it
local calm = Elem("calm", { W = Wid(1.0), Opaque = true })
calm.Instances[1], calm.Keys[1], calm.W.name = calm.W, "calm", "calm"
A.All(true, false, false, 1)
quarter(true) quarter() quarter(true) quarter()
check("F9 opened and closed twice over a solid element: not taken for a write of the game", calm.W.op == 1.0 and not Said("calm"))
-- a scan brings a new widget under the old name: it holds the game's value, and that is no write of the game either
local fresh = Elem("fresh", { W = Wid(1.0), Visible = false })
fresh.Instances[1], fresh.Keys[1], fresh.W.name = fresh.W, "fresh", "fresh"
A.All(true, false, false, 1)
fresh.W = Wid(1.0) fresh.Instances[1] = fresh.W
A.All(true, false, false, 1)
check("a new widget under an old name is hidden at the scan and not taken for a write of the game", fresh.W.op == 0 and not Said("fresh"))
calm.Visible, fresh.Visible = true, true
Elements2[#Elements2], Elements2[#Elements2 - 1] = nil, nil
-- the editor: every element is dimmed once and held
writes2 = 0
for _ = 1, 5 do look(true) end
check("F9 open for 5 steps: each element and part dimmed once (" .. writes2 .. " writes)", writes2 == 9)
writes2 = 0
for _ = 1, 5 do look() end
check("F9 closed: the game's opacity comes back once per element and part (" .. writes2 .. " writes), then no more", writes2 == 9)
writes2 = 0
for _ = 1, 5 do look() end
check("... and no more", writes2 == 0)

-- one widget that throws does not stop the elements after it, and its first error is logged once
local boom = Elem("boom", { W = Wid(1.0) })
function boom.W:SetRenderTranslation() error("bad widget") end
local after = Elem("after", { W = Wid(1.0) })
local moved = false
function after.W:SetRenderTranslation() moved = true end
logs = {}
A.All(true, false, false, 1)
A.All(true, false, false, 1)
local boomLogs = 0
for _, m in ipairs(logs) do if m:find("boom", 1, true) and m:find("bad widget", 1, true) then boomLogs = boomLogs + 1 end end
check("an element that throws: the element after it still gets its layout", moved)
check("... and the error is logged once (" .. boomLogs .. ")", boomLogs == 1)
Elements2[#Elements2], Elements2[#Elements2 - 1] = nil, nil

print(fails == 0 and "all passed" or (fails .. " failed"))
if fails > 0 then error("failed") end
`;
lauxlib.luaL_loadstring(L, to_luastring(test));
const status = lua.lua_pcall(L, 0, 0, 0);
if (status !== 0) { console.log(lua.lua_tojsstring(L, -1)); process.exit(1); }

// Tests the party panel (party.lua) without the game. The players are stand-ins for the game's objects, shaped as the
// probe of 05-10-2026 found them: a game state with PlayerArray, a player state with GetPlayerName and GetPawn, a pawn of
// the class BP_PlayerCharacter_C with a health component that has GetNormalizedHealth.
// Covers the menu, one to five friends, the limit, a friend with no pawn (far), a pawn of another class, friends who leave
// and join, health changes, the hit count the immersive mode reads, the F9 preview, the switch, the read rate, a failing
// read, a failing build, Forget, and the numbers of the switch "Party numbers" (M.Number and the taller bar).
// Needs fengari. Run: node tools/test-party.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = require('path').join(__dirname, '..', 'RuneUI', 'Scripts');
const src = fs.readFileSync(require('path').join(dir, 'party.lua'), 'utf8');
const test = `
local M = load(SRCTEXT)()
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end

---- stand-ins for the engine: a widget records what it is told; a slot of a canvas records its place
local now = 0
os.clock = function() return now end
FText = function(s) return s end
FName = function(s) return s end
local Any
local function Dummy() return setmetatable({}, { __index = function() return Any end, __newindex = function() end, __call = function() return Any end }) end
Any = Dummy()
FindFirstOf = function() return Any end
StaticFindObject = function(path) return path end
local failBuild = false
local Widget = {}
Widget.__index = function(t, k)
    if k == "IsValid" then return function() return true end end
    if k == "SetText" then return function(self, s) self.Text = s end end
    if k == "SetVisibility" then return function(self, v) self.Vis = v end end
    if k == "SetWidthOverride" then return function(self, v) self.Over = v end end
    if k == "SetHeightOverride" then return function(self, v) self.HOver = v end end
    if k == "SetColorAndOpacity" then return function(self, c) self.Color = c end end
    if k == "RemoveFromParent" then return function(self) self.Removed = true end end
    if k == "AddToViewport" then return function(self, z) self.Z = z end end
    if k == "AddChildToCanvas" then
        return function(self)
            local slot = { Anchors = nil, Pos = nil }
            slot.SetAutoSize = function() end
            slot.SetAnchors = function(s, a) s.Anchors = a end
            slot.SetPosition = function(s, p) s.Pos = p end
            self.Slot = slot
            return slot
        end
    end
    return Any
end
local made = {}
StaticConstructObject = function(cls, _, name)
    if failBuild then error("no class") end
    local w = setmetatable({ Name = name }, Widget)
    made[#made + 1] = w
    return w
end

---- the game: a world with players
local function Named(class) return { GetClass = function() return { GetFName = function() return { ToString = function() return class end } end } end } end
local addr = 100
local function Pawn(class, health)
    local p = Named(class)
    p.IsValid = function() return true end
    -- cur and max: what GetAuthoritativeHealth and GetMaxHealth give; "fail" makes the call fail, nil a call that is missing
    local function Call(k) if health[k] == "fail" then error("no " .. k) end return health[k] end
    local hc = { IsValid = function() return true end, GetNormalizedHealth = function() return health.v end,
        GetAuthoritativeHealth = function() return Call("cur") end, GetMaxHealth = function() return Call("max") end }
    p.GetHealthComponent = function() return hc end
    return p
end
-- a player state; pawn is nil for a friend whose character is not loaded here (the game gives nothing, or a dead wrapper)
local function Player(name, pawn)
    addr = addr + 1
    local a = addr
    local ps = { IsValid = function() return true end, GetAddress = function() return a end, Name = name, Pawn = pawn }
    ps.GetPlayerName = function(self) return { ToString = function() return self.Name end } end
    ps.GetPawn = function(self) return self.Pawn end
    return ps
end
local me = Player("Me", nil)
local mypawn = Pawn("BP_PlayerCharacter_C", { v = 1 })
local players = { me }
local reads = 0
local pc, world
local function Array()
    local arr = { GetArrayNum = function(self) return #players end }
    return setmetatable(arr, { __index = function(_, i) return players[i] end })
end
world = { IsValid = function() return true end, GameState = { IsValid = function() return true end } }
world.GameState.PlayerArray = nil
pc = { IsValid = function() return true end, Pawn = mypawn, PlayerState = me }
pc.GetWorld = function() reads = reads + 1 world.GameState.PlayerArray = Array() return world end

local function Friend(name, hp) return Player(name, Pawn("BP_PlayerCharacter_C", { v = hp })) end
local function Set(...) players = { me, ... } end

-- main.lua's MayTry and Failed
local function MayTry(P) return (P.Fails or 0) < 3 and os.clock() >= (P.RetryAt or 0) end
local function Failed(P) P.Fails, P.RetryAt = (P.Fails or 0) + 1, os.clock() + 10 end
local logs, on, preview, numbers = {}, true, false, false
local vitals = { Instances = { { IsValid = function() return true end, IsVisible = function() return true end } } }
local ctx = { Log = function(m) logs[#logs + 1] = m end,
    ById = function(id) if id == "party" then return { Center = { X = 154.5, Y = 301 } } end return vitals end,
    Controller = function() return pc end,
    Text = function(_, name) return StaticConstructObject("/Script/UMG.TextBlock", nil, name) end,
    On = function() return on end, Numbers = function() return numbers end, Preview = function() return preview end, MayTry = MayTry, Failed = Failed }
local function Tick(seconds) now = now + seconds M.Tick(ctx) end
-- the rows as they show: name, bar width, bar colour, name colour
local function Shown()
    local out = {}
    for i, r in ipairs(M.Rows or {}) do if r.Box.Vis == 4 then out[#out + 1] = r end end
    return out
end
local function Count(pattern) local n = 0 for _, l in ipairs(logs) do if l:find(pattern) then n = n + 1 end end return n end
local function Names()
    local out = {}
    for _, r in ipairs(Shown()) do out[#out + 1] = r.Text.Text end
    return table.concat(out, ",")
end
local function Settle() Tick(0.3) Tick(0.3) Tick(0.3) end   -- a read, the build, and the show

M.Forget(false)

---- alone: nothing on the screen, and no widget is made
Set()
Settle()
check("alone: no widget is made", M.W == nil and #made == 0 and Count("ready") == 0)
check("alone: no friend", #M.List == 0)

---- the main menu and the lobby: a pawn of another class (a friend there has no pawn): nothing, no widget
pc.Pawn = Pawn("DefaultPawn", { v = 1 })
Set(Player("Wren", nil), Friend("Aldric", 1))
Settle()
check("menu: the local pawn is not a character, nothing shows", #M.List == 0 and M.W == nil)
pc.Pawn = nil
Settle()
check("no local pawn (loading, dead): nothing shows", #M.List == 0 and M.W == nil)
pc.Pawn = mypawn
local ownState = pc.PlayerState
pc.PlayerState = nil
Settle()
check("no local player state: nothing shows, so nobody mistakes themselves for a friend", #M.List == 0)
pc.PlayerState = ownState

---- one friend, full health
Set(Friend("Aldric", 1))
Settle()
check("one friend: the widget is made", M.W ~= nil and Count("party panel ready") == 1)
check("one friend: one row, with the name", #Shown() == 1 and Names() == "Aldric")
check("one friend: a full bar", Shown()[1].FillBox.Over == 225)
check("one friend: the widget is on the screen", M.Visible == true and M.UW.Vis == 3)

---- one to five friends
local five = { "Aldric", "Wren", "Tamsin", "Bram", "Isolde" }
for n = 1, 5 do
    local list = {}
    for i = 1, n do list[i] = Friend(five[i], 1) end
    Set(table.unpack(list))
    Settle()
    check(n .. " friend(s): " .. n .. " row(s) in the game's order", #Shown() == n and Names() == table.concat(five, ",", 1, n))
end
-- a world of six players holds the five friends; a seventh player (not possible, but the panel must hold) is not shown
Set(Friend("A1", 1), Friend("A2", 1), Friend("A3", 1), Friend("A4", 1), Friend("A5", 1), Friend("A6", 1), Friend("A7", 1))
Settle()
check("the limit: five friends are read, never more than five rows", #M.List == 5 and #Shown() == 5 and #M.Rows == 5)
-- the local player in the middle of the list is skipped, by the player state
players = { Friend("A1", 1), me, Friend("A2", 1) }
Settle()
check("the local player is skipped wherever it sits in the list", Names() == "A1,A2")

---- a friend with no pawn: far. No distance, a dimmed name and a grey bar
Set(Friend("Aldric", 0.5), Player("Tamsin", nil))
Settle()
local near, far = Shown()[1], Shown()[2]
check("far: the row shows", #Shown() == 2 and far.Text.Text == "Tamsin")
check("far: a full bar in grey, the name dimmed", far.FillBox.Over == 225 and far.Far == true and far.Text.Color.SpecifiedColor.A < 1)
check("far: the near friend keeps the red bar and the white name", near.Far == false and near.Fill.Color.R > 0.8 and near.Text.Color.SpecifiedColor.A == 1)
check("far: the grey is not red", far.Fill.Color.R < 0.4 and math.abs(far.Fill.Color.R - far.Fill.Color.G) < 0.05)
check("far: no number in the name", far.Text.Text == "Tamsin")
Set(Friend("Aldric", 0.5), Player("Tamsin", { IsValid = function() return false end }))
Settle()
check("far: a pawn that does not read as valid counts as not loaded", #Shown() == 2 and Shown()[2].Far == true)
-- the friend walks into range: the bar is red and as full as the health
players[3].Pawn = Pawn("BP_PlayerCharacter_C", { v = 0.25 })
Settle()
check("far to near: the red bar, a quarter full", Shown()[2].Far == false and Shown()[2].FillBox.Over == 56)

---- a pawn of another class: that friend is not shown
Set(Friend("Aldric", 1), Player("Lobby", Pawn("DefaultPawn", { v = 1 })))
Settle()
check("a pawn of another class: no row for it", Names() == "Aldric")
Set(Player("", nil), Friend("Aldric", 1))
Settle()
check("no name yet: no row", Names() == "Aldric")

---- a friend leaves and joins
Set(Friend("Aldric", 1), Friend("Wren", 1), Friend("Tamsin", 1))
Settle()
Set(Friend("Aldric", 1), Friend("Tamsin", 1))
Settle()
check("a friend leaves: the rows close up", Names() == "Aldric,Tamsin" and #Shown() == 2 and M.Rows[3].Box.Vis == 1)
Set(Friend("Aldric", 1), Friend("Tamsin", 1), Friend("Bram", 1))
Settle()
check("a friend joins: a row at the end", Names() == "Aldric,Tamsin,Bram")
Set()
Settle()
check("the last friend leaves: nothing on the screen", #Shown() == 0 and M.Visible == false and M.UW.Vis == 1)

---- health changes, and the count that the immersive mode reads
local hp = { v = 1 }
local aldric = Player("Aldric", Pawn("BP_PlayerCharacter_C", hp))
Set(aldric)
Settle()
local hits = M.Hits
hp.v = 0.5
Settle()
check("health 50%: the bar is half", Shown()[1].FillBox.Over == 113)
check("health down: counted once", M.Hits == hits + 1)
Settle()
check("the same health again: not counted", M.Hits == hits + 1)
hp.v = 0.8
Settle()
check("healing: the bar grows and it is not counted", Shown()[1].FillBox.Over == 180 and M.Hits == hits + 1)
hp.v = 0
Settle()
check("dead: an empty bar", Shown()[1].FillBox.Over == 0 and M.Hits == hits + 2)
hp.v = 1.4
Settle()
check("above full: never wider than the box", Shown()[1].FillBox.Over == 225)
hp.v = -0.2
Settle()
check("below zero: never negative", Shown()[1].FillBox.Over == 0)
hp.v = 0 / 0
Settle()
check("not a number: the friend reads as far, no width of nan", Shown()[1].Far == true and Shown()[1].FillBox.Over == 225)
hp.v = 1
Settle()
local before = M.Hits
Set(Player("Aldric", nil))
Settle()
Set(aldric)
hp.v = 0.4
Settle()
check("a friend who comes into range hurt is not a hit: he has nothing to be lower than", M.Hits == before)

---- the switch and the F9 preview
Set(Friend("Aldric", 1))
Settle()
on = false
Settle()
check("switched off: nothing shows", #Shown() == 0 and M.Visible == false)
local r0 = reads
for _ = 1, 20 do Tick(0.3) end
check("switched off: the players are not read", reads == r0)
on = true
Settle()
check("switched on again: it shows", Names() == "Aldric" and M.Visible == true)

Set()
Settle()
local hitsBefore = M.Hits
preview = true
Settle()
check("alone, F9 with the row selected: three made-up rows", #Shown() == 3 and Names() == "Aldric,Wren,Tamsin" and M.Visible == true)
check("preview: full, hurt at about a third, and far", Shown()[1].FillBox.Over == 225 and Shown()[2].FillBox.Over == 77 and Shown()[3].Far == true)
check("preview: the widget is made for it", M.W ~= nil)
check("preview: the made-up rows count no hit", M.Hits == hitsBefore)
on = false
Settle()
check("the element hidden but its row selected: the preview still shows", #Shown() == 3)
on = true
preview = false
Settle()
check("another row selected or F9 closed: the preview goes", #Shown() == 0 and M.Visible == false)
Set(Friend("Aldric", 1), Friend("Wren", 1))
preview = true
Settle()
check("friends in the world: F9 shows them, not the made-up rows", Names() == "Aldric,Wren")
preview = false

---- the read rate: four a second at most, one a second alone
Set(Friend("Aldric", 1))
Settle()
r0 = reads
for _ = 1, 200 do Tick(0.05) end   -- ten seconds in steps of the game's 50 ms
check("with a friend: at most four reads a second", reads - r0 <= 41 and reads - r0 >= 30)
Set()
Settle()
r0 = reads
for _ = 1, 200 do Tick(0.05) end
check("alone: one read a second", reads - r0 <= 11 and reads - r0 >= 8)

---- a read that fails is said once, and the next read tries again
local good = players
players = { me, { IsValid = function() return true end, GetAddress = function() return 999 end, GetPlayerName = function() error("boom") end } }
Settle() Settle()
check("a failed read: nothing shows, said once", #Shown() == 0 and Count("not read") == 1)
Set(Friend("Aldric", 1))
Settle()
check("the read recovers", Names() == "Aldric")

---- the numbers (switch "Party numbers"): current/max when it looks right, else the percent, never a wrong number
check("number: current/max", M.Number(140, 350, 0.4) == "140/350")
check("number: rounded to whole points", M.Number(139.6, 350.2, 0.4) == "140/350")
check("number: full and dead", M.Number(250, 250, 1) == "250/250" and M.Number(0, 250, 0) == "0/250")
check("number: max 0 gives the percent", M.Number(0, 0, 0.4) == "40%")
check("number: max below 0 gives the percent", M.Number(10, -5, 0.4) == "40%")
check("number: a current of -1 gives the percent", M.Number(-1, 350, 0.4) == "40%")
check("number: a max of -1 gives the percent", M.Number(140, -1, 0.4) == "40%")
check("number: current above max gives the percent", M.Number(400, 350, 1) == "100%")
check("number: a pair that tells another health than the bar gives the percent", M.Number(350, 350, 0.4) == "40%" and M.Number(0, 350, 0.4) == "40%")
check("number: a small gap to the bar still shows the numbers", M.Number(150, 350, 0.4) == "150/350")
check("number: not numbers give the percent", M.Number(nil, nil, 0.34) == "34%" and M.Number("no", 350, 0.34) == "34%")
check("number: not a number gives the percent", M.Number(0 / 0, 350, 0.5) == "50%" and M.Number(140, 0 / 0, 0.5) == "50%")
check("number: an endless max gives the percent", M.Number(140, math.huge, 0.5) == "50%")
check("number: a max far too big gives the percent, no error", M.Number(1e30, 1e30, 1) == "100%")
check("number: the percent stays within 0 and 100", M.Number(nil, nil, 1.3) == "100%" and M.Number(nil, nil, -0.2) == "0%")
check("number: no health, no number", M.Number(140, 350, nil) == nil and M.Number(140, 350, 0 / 0) == nil)

local fhp = { v = 0.4, cur = 140, max = 350 }
Set(Player("Frizzbe", Pawn("BP_PlayerCharacter_C", fhp)), Player("Dexter", nil))
Settle()
local fr, dx = Shown()[1], Shown()[2]
check("numbers off: the bars stay thin, no number", fr.Bar.HOver == 10 and dx.Bar.HOver == 10 and fr.Num.Vis == 1)
check("numbers off: the values are not read", M.List[1].Number == nil)
numbers = true
Tick(0.3)
check("numbers on: the tall bar has its number in the same step", fr.Bar.HOver == 20 and fr.Num.Text == "140/350")
Settle()
check("numbers on: the bars are taller", fr.Bar.HOver == 20 and dx.Bar.HOver == 20)
check("numbers on: current/max in the bar", fr.Num.Vis == 4 and fr.Num.Text == "140/350")
check("numbers on: a far friend has a tall grey bar and no number", dx.Far == true and dx.Num.Vis == 1)
fhp.v, fhp.cur = 0.2, 70
Settle()
check("health down: the number follows", fr.Num.Text == "70/350")
fhp.cur = -1
Settle()
check("a current of -1: the percent", fr.Num.Text == "20%")
fhp.cur, fhp.max = 70, 0
Settle()
check("a max of 0: the percent", fr.Num.Text == "20%")
fhp.cur, fhp.max = 500, 350
Settle()
check("current above max: the percent", fr.Num.Text == "20%")
fhp.cur, fhp.max = 350, 350
Settle()
check("a value that did not come (full while the bar is a fifth): the percent", fr.Num.Text == "20%")
fhp.cur, fhp.max = "fail", "fail"
Settle()
check("the calls fail: the percent, the bar stays", fr.Num.Text == "20%" and fr.Far == false and fr.FillBox.Over == 45)
fhp.cur, fhp.max = nil, nil
Settle()
check("no values at all: the percent", fr.Num.Text == "20%")
fhp.cur, fhp.max = 70, 350
Settle()
check("right values again: the numbers again", fr.Num.Text == "70/350")
Set(Player("Frizzbe", nil), Player("Dexter", nil))
Settle()
check("the friend goes far: the number goes", fr.Far == true and fr.Num.Vis == 1)
Set(Player("Frizzbe", Pawn("BP_PlayerCharacter_C", fhp)))
Settle()
check("back in range: the number is back", fr.Num.Vis == 4 and fr.Num.Text == "70/350")
numbers = false
Settle()
check("numbers off again: thin bar, no number", fr.Bar.HOver == 10 and fr.Num.Vis == 1)
Set()
numbers, preview = true, true
Settle()
check("F9 preview with numbers: in the made-up rows too", Shown()[1].Num.Text == "250/250" and Shown()[2].Num.Text == "119/350"
    and Shown()[3].Num.Vis == 1 and Shown()[1].Bar.HOver == 20)
numbers, preview = false, false
Set(Friend("Aldric", 1))
Settle()

---- the box
local canvasSlot
for _, w in ipairs(made) do if rawget(w, "Slot") then canvasSlot = w.Slot end end
check("the slot is tied to the top left", canvasSlot.Anchors.Minimum.X == 0 and canvasSlot.Anchors.Minimum.Y == 0 and canvasSlot.Anchors.Maximum.X == 0)
check("its top left corner is at 42 and 146 units", canvasSlot.Pos.X == 42 and canvasSlot.Pos.Y == 146)
check("its box holds five rows", M.W.Over == 225 and M.BOX_H == 310)

---- a new world: the handles go, and the panel is built again when there is a friend
local uw = M.UW
M.Forget(true)
check("the same world: the old widget is taken off the screen", uw.Removed == true)
check("forget: handles gone, the count starts again", M.W == nil and M.Rows == nil and #M.List == 0 and M.Hits == 0)
Settle()
check("forget: built again", M.W ~= nil and M.UW ~= uw and Names() == "Aldric")
uw = M.UW
M.Forget(false)
check("a new world: the old widget is not touched", rawget(uw, "Removed") == nil and M.W == nil)

---- a build that fails: not again on the next step, again after 10 s, 3 tries at most (main.lua MayTry and Failed)
failBuild = true
logs = {}
for _ = 1, 8 do Tick(0.3) end
check("a failed build is not tried again on the next steps", Count("party panel failed") == 1 and M.Fails == 1)
Tick(10)
check("it is tried again after 10 s", Count("party panel failed") == 2 and M.Fails == 2)
Tick(10) Tick(10) Tick(10)
check("three failed tries, then it stops", Count("party panel failed") == 3 and M.Fails == 3)
failBuild = false
Tick(10)
check("a stopped part stays stopped", M.W == nil)
M.Forget(false)
check("a new round gives it new tries", M.Fails == 0 and M.RetryAt == 0)
Settle()
check("and it builds", M.W ~= nil)

print(fails == 0 and "ALL OK" or (fails .. " FAILED"))
if fails > 0 then error("failed") end
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

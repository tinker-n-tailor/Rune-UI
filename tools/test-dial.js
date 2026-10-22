// Tests the day and night icon (dial.lua) against a fake dial named as the game's (probe of 09-10-2026): the four phases
// show the right picture, only a change of phase writes, a hidden dial with the editor closed makes no engine call, the
// switch Off gives the game's two images their opacity back and takes ours out, a new world drops the handles with no call,
// a player restart still gives the opacity back, the dial made again by the game is built anew, a failed build follows the
// retry rule and leaves the game's dial alone, each picture sits on an Image of its own, and maplook.lua's ReadClock
// (the one reader of the clock) still reads the game's material while ours shows. The file checks cover elements.lua,
// layout.lua and wiring.lua.
// Needs npm install once. Run: node tools/test-dial.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const scripts = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(scripts, f), 'utf8').replace(/\r\n/g, '\n');
const engine = read('engine.lua');
const clearOurs = (engine.match(/local function ClearOurs[\s\S]*?\nend\n/) || [])[0];
if (!clearOurs) { console.log('FAIL engine.lua: ClearOurs was not found'); process.exit(1); }
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const set = (name, text) => { lua.lua_pushstring(L, to_luastring(text)); lua.lua_setglobal(L, to_luastring(name)); };
set('DIAL', read('dial.lua')); if (lauxlib.luaL_dostring(L, to_luastring(require('./fake-runemap'))) !== 0) { console.log('ERROR ' + lua.lua_tojsstring(L, -1)); process.exit(1); }
set('CACHED', require('./fake-cachedtex')); set('CLEAR', clearOurs);
set('ELEMENTS', read('elements.lua')); set('LAYOUT', read('layout.lua')); set('WIRING', read('wiring.lua'));
const test = `
local calls, writes = 0, 0   -- every method looked up or property read on a fake engine object; every write to one
local methods = {}
local function W(class, name, props)
    local w = { _class = class, _name = name, _props = props or {}, _kids = {}, _alive = true, _op = 1, _vis = 0 }
    return setmetatable(w, { __index = function(t, k)
        calls = calls + 1
        return methods[k] or t._props[k]
    end })
end
function methods.IsValid(s) return s._alive end
function methods.GetFName(s) return { ToString = function() return s._name end } end
function methods.GetFullName(s) return s._class .. " /Engine/Transient." .. s._name end
function methods.GetRenderOpacity(s) return s._op end
function methods.SetRenderOpacity(s, v) writes = writes + 1 s._op = v end
function methods.SetVisibility(s, v) writes = writes + 1 s._vis = v end
function methods.SetBrushFromTexture(s, tex) writes = writes + 1 s._tex = tex end
function methods.SetBrush(s, b) writes = writes + 1 s._brush = b end
function methods.GetChildrenCount(s) return #s._kids end
function methods.GetChildAt(s, i) return s._kids[i + 1] end
function methods.SetHorizontalAlignment() end
function methods.SetVerticalAlignment() end
function methods.SetLayout(s, l) s._layout = l end
function methods.SetAutoSize(s, b) s._auto = b end
local function Add(s, w) w._parent = s s._kids[#s._kids + 1] = w return W("Slot", "Slot") end
function methods.AddChildToOverlay(s, w) return Add(s, w) end
function methods.AddChildToCanvas(s, w) local slot = Add(s, w) w._slot = slot return slot end
function methods.RemoveFromParent(s)
    local p = s._parent
    if p then for i, k in ipairs(p._kids) do if k == s then table.remove(p._kids, i) break end end end
    s._parent = nil
end

-- the game's engine calls the dial makes
local textures, imports = {}, 0
local KRL = { ImportFileAsTexture2D = function(_, outer, file)
    imports = imports + 1
    if NOFILES then return nil end
    local t = W("Texture2D", "Tex" .. imports)
    t._outer, t._file = outer, file
    textures[#textures + 1] = t
    return t
end }
local classes = {}
StaticFindObject = function(p)
    if p == "/Script/Engine.Default__KismetRenderingLibrary" then return KRL end
    local cls = string.match(p, "^/Script/UMG%.(%w+)$")
    if cls then classes[cls] = classes[cls] or { cls = cls } return classes[cls] end
end
StaticConstructObject = function(cls, outer, name) return W(cls.cls, name, cls.cls == "Image" and { Brush = { ImageSize = { X = 32, Y = 32 } } } or nil) end
FName = function(s) return s end
io.open = function() return nil end   -- no picture files: CachedTex says "picture missing" when the import gives nothing

local now = 0
os.clock = function() return now end

-- the game's dial: the root canvas holds the ring (an Image with the clock's material) and the pointer
local clock = { fill = 0.3, ns = 0.795 }
local reads = 0   -- the material's scalars read
local function Material()
    return { ScalarParameterValues = { ForEach = function(_, f)
        reads = reads + 1
        f(1, { get = function() return { ParameterInfo = { Name = { ToString = function() return "Fill Amount" end } }, ParameterValue = clock.fill } end })
        f(2, { get = function() return { ParameterInfo = { Name = { ToString = function() return "Night Start" end } }, ParameterValue = clock.ns } end })
    end } }
end
local function Dial(n, ringOp)
    local ring = W("Image", "Image", { Brush = { ImageSize = { X = 66, Y = 66 }, ResourceObject = Material() },
        Slot = W("CanvasPanelSlot", "Slot", { LayoutData = { Offsets = { Left = 7, Top = 9, Right = 66, Bottom = 66 } }, bAutoSize = false }) })
    ring._op = ringOp or 1
    local pointer = W("Image", "CursorImage", { RenderTransform = { Angle = 100 } })
    local root = W("CanvasPanel", "CanvasPanel_73")
    root._kids = { ring, pointer }
    ring._parent, pointer._parent = root, root
    local dn = W("WBP_HUD_DayAndNight_C", "WBP_HUD_DayAndNight_C_" .. n, { WidgetTree = { RootWidget = root } })
    return { W = dn, Ring = ring, Pointer = pointer, Root = root, Name = "WBP_HUD_DayAndNight_C /Engine/Transient.WBP_HUD_DayAndNight_C_" .. n }
end

local Map = NewRuneMap()
local M = load(DIAL)()
local CachedTex = load(CACHED .. "\\nreturn CachedTex")()
local ClearOurs = load(CLEAR .. "\\nreturn ClearOurs")()
local names = 0
local function MayTry(P) return (P.Fails or 0) < 3 and os.clock() >= (P.RetryAt or 0) end
local function Failed(P) P.Fails, P.RetryAt = (P.Fails or 0) + 1, os.clock() + 10 end
local D = Dial(1, 0.85)
local E = { Id = "daynight", Visible = true, Instances = { D.W }, Keys = { D.Name } }
local skin, editing, logs = true, false, {}
local ctx = { Log = function(m) logs[#logs + 1] = m end, ById = function() return E end,
    Uniq = function(n) names = names + 1 return n .. "_1_" .. names end, ClearOurs = ClearOurs, CachedTex = CachedTex,
    MayTry = MayTry, Failed = Failed, ReadClock = Map.ReadClock,
    On = function() return skin end, Editing = function() return editing end }
local function Step() now = now + 0.6 M.Tick(ctx) end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function Stack(d) for _, k in ipairs(d.Root._kids) do if string.find(k._name, "^RU_Dial") then return k end end end
-- the picture shown by our images now: its phase, or nil when none or more than one is shown
local function Shown(d)
    local st, found = Stack(d), nil
    if not st then return nil end
    for _, img in ipairs(st._kids) do
        if img._vis == 3 then if found then return nil end found = string.match(img._tex._file, "clock_(%w+)%.png$") end
    end
    return found
end

-- the four phases, each with its own picture; the game's ring and pointer unseen once ours shows
for _, c in ipairs({ { 0.02, "dawn" }, { 0.4, "day" }, { 0.73, "dusk" }, { 0.9, "night" }, { 0.795, "night" }, { 0.0, "dawn" }, { 0.08, "day" }, { 0.714, "day" }, { 0.72, "dusk" } }) do
    clock.fill = c[1]
    Step() Step()   -- the clock is looked at twice a second at most, so two steps of 0.6 s are two looks
    check("fill " .. c[1] .. " shows " .. c[2], Shown(D) == c[2] and M.Phase(c[1], 0.795) == c[2])
end
check("the game's ring and pointer are unseen, the way back kept", D.Ring._op == 0 and D.Pointer._op == 0)

-- each picture on an Image of its own, put there by the dial's tree
local imgs, held = Stack(D)._kids, {}
for _, img in ipairs(imgs) do held[img._tex] = (held[img._tex] or 0) + 1 end
local distinct = 0
for _ in pairs(held) do distinct = distinct + 1 end
check("four images, each holding its own picture from the Art folder, made in the dial's tree", #imgs == 4 and distinct == 4 and #textures == 4
    and textures[1]._outer == D.W.WidgetTree and string.find(textures[1]._file, "Art/clock_dawn.png", 1, true) ~= nil
    and string.find(textures[4]._file, "Art/clock_night.png", 1, true) ~= nil)
check("each image is 66 units and a new name was made for it", imgs[1]._brush.ImageSize.X == 66 and imgs[4]._brush.ImageSize.Y == 66 and string.find(imgs[1]._name, "^RU_Dial_dawn_1_%d+$") ~= nil)
local slot = Stack(D)._slot
check("the stack takes the place and size of the game's ring", slot._layout == D.Ring.Slot.LayoutData and slot._auto == false)

-- the game's material stays readable while ours shows
clock.fill = 0.4
now = now + 5
local fill, ns = Map.ReadClock(ctx)
check("ReadClock still returns the time while ours shows and the game's images are unseen", fill == 0.4 and ns == 0.795 and D.Ring._op == 0)

-- one reader: a look soon after another is served from the first
now = now + 1
local r0 = reads
Map.ReadClock(ctx) Map.ReadClock(ctx)
check("two asks within a moment read the material once", reads == r0 + 1)
now = now + 0.5
Map.ReadClock(ctx)
check("a half second later it reads again", reads == r0 + 2)

-- only a change of phase writes
clock.fill = 0.4 now = now + 1 Step()
local w0 = writes
for _ = 1, 6 do Step() end
check("the same phase again and again: no write at all", writes == w0 and Shown(D) == "day")
clock.fill = 0.73 now = now + 1 Step()
check("a new phase: two writes, the old picture out and the new one in", writes == w0 + 2 and Shown(D) == "dusk")

-- looked at no more than twice a second
now = now + 1
local r1 = reads
for _ = 1, 20 do now = now + 0.05 M.Tick(ctx) end   -- a second in steps of 0.05
check("a second of steps looks at the clock at most twice", reads - r1 <= 2)

-- hidden in F9 with the editor closed: no engine call; the editor open: it looks again
E.Visible = false
now = now + 1
calls = 0
M.Tick(ctx)
check("hidden and the editor closed: no engine call", calls == 0)
editing = true
now = now + 1
M.Tick(ctx)
check("hidden, with the editor open: it looks", calls > 0)
editing = false
E.Visible = true

-- the switch Off: the game's images get their own opacity back, ours is out of the dial, then no more calls
skin = false
Step()
check("Off: the ring and the pointer have the opacity they had", D.Ring._op == 0.85 and D.Pointer._op == 1)
check("Off: our images are out of the dial", Stack(D) == nil and #D.Root._kids == 2)
now = now + 1 calls = 0 writes = 0
for _ = 1, 5 do Step() end
check("Off and done: no engine call and no write", calls == 0 and writes == 0)
E.Visible = false
skin = true
calls = 0
Step()
check("On again while hidden: still no engine call", calls == 0)
E.Visible = true

-- On again: ours is built anew, the game's images are unseen again, and they come back to what they were
Step() Step()
check("On again: our icon shows, the game's images are unseen", Shown(D) ~= nil and D.Ring._op == 0 and D.Pointer._op == 0 and #D.Root._kids == 3)
skin = false
Step()
check("and Off again: the opacity of the ring is again the one it had", D.Ring._op == 0.85 and #D.Root._kids == 2)

-- a new world: the handles are dropped with no call
skin = true
Step() Step()
calls = 0
M.Forget(false)
check("a new world drops the handles with no engine call", calls == 0)
local D2 = Dial(2)
E.Instances, E.Keys = { D2.W }, { D2.Name }
Step() Step()
check("the new world's dial gets our icon", Shown(D2) ~= nil and D2.Ring._op == 0 and D2.Pointer._op == 0)

-- a player restart: the game keeps its dial with its images unseen; the switch is Off now
M.Forget(true)
skin = false
Step()
check("a player restart with the switch Off: the opacity comes back, our old icon is taken out", D2.Ring._op == 1 and D2.Pointer._op == 1 and Stack(D2) == nil)
-- ... and On: ours is built again at the same dial, the first opacity is kept
skin = true
Step() Step()
M.Forget(true)
Step() Step()
check("a player restart with the switch On: one icon, built again", Shown(D2) ~= nil and #D2.Root._kids == 3 and D2.Ring._op == 0)
skin = false
Step()
check("and the opacity is still the game's own after that", D2.Ring._op == 1 and #D2.Root._kids == 2)

-- the game made the dial again
skin = true
Step() Step()
local D3 = Dial(3)
E.Instances, E.Keys = { D3.W }, { D3.Name }
local oldKids = #D2.Root._kids
Step() Step()
check("the game made the dial again: our icon is in the new one, the old one is not touched", Shown(D3) ~= nil and D3.Ring._op == 0 and #D2.Root._kids == oldKids)

-- the clock cannot be read: the game's dial stays as it is
local D4 = Dial(4)
D4.Ring._props.Brush.ResourceObject = nil
D4.Pointer._props.RenderTransform = nil   -- the pointer's angle is the fallback; without both nothing is read
E.Instances, E.Keys = { D4.W }, { D4.Name }
M.Forget(false)
logs = {}
Step() Step() Step()
check("no time read: the game's ring and pointer stay as they are, one line in the log", D4.Ring._op == 1 and D4.Pointer._op == 1 and Shown(D4) == nil and #logs == 2 and string.find(logs[2], "no time read") ~= nil)

-- a failed build: the game's dial is left alone, one line, three tries 10 s apart
local D5 = Dial(5)
E.Instances, E.Keys = { D5.W }, { D5.Name }
M.Forget(false)
NOFILES = true
logs = {}
now = now + 100
local imports0 = imports
Step() Step()
check("a picture that does not load: the dial stays the game's, one line in the log", D5.Ring._op == 1 and D5.Pointer._op == 1 and #D5.Root._kids == 2 and #logs == 1 and string.find(logs[1], "picture missing") ~= nil)
local tries = imports - imports0
now = now + 11 Step() now = now + 11 Step() now = now + 11 Step() now = now + 11 Step()
check("tried again 10 s later, three times in all", imports - imports0 == 3 and #logs == 1 and tries == 1)
NOFILES = false
M.Forget(false)   -- a new world: new tries
Step() Step()
check("a new world gives new tries", Shown(D5) ~= nil and D5.Ring._op == 0)

-- the files: the switch, its place in the layout, its start value, and the wiring
local elementsText, layoutText, wiringText = ELEMENTS, LAYOUT, WIRING
check("elements.lua: the switch dialskin is called Day and night icon and is on at first",
    string.find(elementsText, 'Id="dialskin",%s*Name="Day and night icon",%s*Custom="dialskin"') ~= nil and not string.find(elementsText, "dialskin={", 1, true))
check("elements.lua: the dial itself is hidden at first, with its widget", string.find(elementsText, 'daynight={X=42, Y=-29, Visible=false}', 1, true) ~= nil
    and string.find(elementsText, 'Id="daynight",%s*Name="Day and night dial",%s*Classes={"WBP_HUD_DayAndNight_C"}') ~= nil)
check("layout.lua: dialskin is a switch with no widget", string.find(layoutText, "dialskin = true", 1, true) ~= nil)
check("wiring.lua: the part reads the switch dialskin, F9 only for the editor, and the map's reader", string.find(wiringText, 'ById("dialskin").Visible', 1, true) ~= nil
    and string.find(wiringText, "Editing = function() return Ed.Edit end", 1, true) ~= nil and string.find(wiringText, "ReadClock = RuneMap.ReadClock", 1, true) ~= nil)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

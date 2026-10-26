// Tests how the two gold lines of the notices (noticestyle.lua, S.Lines) wait for a band image that has a size (one log line for
// each kind of notice), how a lines step that throws, also in the middle, leaves no lone line behind, the one log line that
// measures the shown warning (S.Measure: its own glyph, rings with a hole, a failed read, taken out of the watch list when
// done). The lines themselves are checked in test-noticelook.js.
// Needs npm install once. Run: node tools/test-noticelines.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const prelude = require('./fake-notices');
const test = prelude + `
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function IsGold(c) return math.abs(c.R - 0.76) < 1e-6 and math.abs(c.G - 0.48) < 1e-6 and math.abs(c.B - 0.10) < 1e-6 end
local function Count(pattern) local n = 0 for _, m in ipairs(logs) do if m:find(pattern, 1, true) then n = n + 1 end end return n end
local function IsBand(b) return b.UVRegion.Min.Y == 0.426 and b.UVRegion.Max.Y == 0.574 and b.UVRegion.Min.X == 0 and b.UVRegion.Max.X == 1 and b.UVRegion.bIsValid == 1 end
Style = load(STYLETEXT)()
local Reads = load(READTEXT)()
Reads.Install(Style)


local M, ctx, w, top, bottom
-- the lines wait for a band image that has a size, and then both come, sized, once
M, ctx = Fresh()
current.stBg.Brush.ImageSize = { X = 700, Y = 0 }
Step(M, ctx) Step(M, ctx, 1.2)
w = current
check("a band image of no height: no image made for the status line (only the warning's two), one log line", #w.stRoot.kids == 2 and #made == 2 and Count("no size yet") == 1 and #logs == 1
    and IsBand(w.stBg.lastBrush) and w.stText.fontSet == fontObj)
w.stBg.Brush.ImageSize = { X = 700, Y = 57 }
Step(M, ctx, 1.2) Step(M, ctx, 1.2)
top, bottom = w.stRoot.kids[3], w.stRoot.kids[4]
check("the size is known on a later walk: both lines come, once, with their size (half the height, the width of the band, the top one turned over)", #w.stRoot.kids == 4 and #made == 4
    and top.lastBrush.ImageSize.X == 700 and top.lastBrush.ImageSize.Y == 28.5 and bottom.lastBrush.ImageSize.X == 700 and bottom.lastBrush.ImageSize.Y == 28.5
    and top.RenderTransform.Scale.X == 1 and top.RenderTransform.Scale.Y == -1 and bottom.RenderTransform.Scale == nil
    and top.RenderTransform.Translation.Y == -0.75 and bottom.RenderTransform.Translation.Y == -0.75 and top.slot.v == 1 and bottom.slot.v == 3 and #logs == 1)
Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("the walks after that add nothing", #w.stRoot.kids == 4 and #made == 4)
M, ctx = Fresh()
current.stBg.Brush.ImageSize = { X = 0, Y = 57 }
Step(M, ctx) Step(M, ctx, 1.2)
check("a band image of no width waits too", #current.stRoot.kids == 2 and #made == 2)

-- a lines step that throws: no image at all, the band and the text are done, one log line
local realLines = Style.Lines
Style.Lines = function() error("boom") end
M, ctx = Fresh()
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
Style.Lines = realLines
w = current
check("the lines step throws: no image on the status line or the warning, one log line, the band and the text are done", #w.stRoot.kids == 2 and #w.upRoot.kids == 4 and #made == 0 and Count("Background not styled: ") == 1 and Count("boom") == 1
    and IsBand(w.stBg.lastBrush) and w.stText.fontSet == fontObj)


-- a kind of notice that waits says which: one log line for each
M, ctx = Fresh()
current.stBg.Brush.ImageSize = { X = 700, Y = 0 }
current.upBg.Brush.ImageSize = { X = 775, Y = 0 }
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("two kinds wait for a band size: one log line for each, each names its kind",
    #logs == 2 and Count("gold lines of WBP_EnvAndPlayerStatus_Item_C wait") == 1 and Count("gold lines of WBP_PlayerUpkeepNotification_Item_C wait") == 1)

-- the second image fails in the middle of a lines step: the first one is not left alone in the tree
M, ctx = Fresh()
breakImage = 2
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
check("the warning's second image fails: neither is added, its band and text are done, the status line has both, one log line",
    #w.upRoot.kids == 4 and #w.stRoot.kids == 4 and Count("Background not styled: ") == 1 and Count("boom") == 1 and #logs == 1
    and IsBand(w.upBg.lastBrush) and w.upLabel.fontSet == fontObj)

-- the second of the two images cannot be added: the first is taken out again, the status line has both
M, ctx = Fresh()
breakAdd = 2
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
check("the warning's second add fails: no lone line stays, its band and text are done, the status line has both, one log line",
    #w.upRoot.kids == 4 and #w.stRoot.kids == 4 and Count("Background not styled: ") == 1 and Count("add refused") == 1 and #logs == 1
    and IsBand(w.upBg.lastBrush) and w.upLabel.fontSet == fontObj)

-- without noticeread.lua the read-only step is left out; with ctx.Reads it is installed before the recipes
Style = load(STYLETEXT)()
M, ctx = Fresh()
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("no read-only file: no error, no log line, the rest is styled", #logs == 0 and Style.Measure == nil and IsBand(current.upBg.lastBrush) and #current.stRoot.kids == 4)
Style = load(STYLETEXT)()
M, ctx = Fresh()
ctx.Reads = Reads
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("with ctx.Reads the step is installed", Style.Measure ~= nil and #logs == 0)
Style = load(STYLETEXT)()
Reads.Install(Style)

-- the warning measured: nothing while it is collapsed, one line when shown, nothing written
M, ctx = Fresh()
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
check("the warning is collapsed: no measure line", Count("shown: the band's brush") == 0 and #logs == 0)
local before = writes
local watching = #M.Watch
w.upkeep.WidgetTree.RootWidget.want = { X = 775, Y = 57 }
w.upBg.want = { X = 700, Y = 50 }
Step(M, ctx, 1.2) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("the warning is shown: one line with the band's brush, what it and its Overlay want, the ring's glyph and the HUD rings' glyphs", #logs == 1
    and Count("Background shown: the band's brush 775.0 x 57.0, it wants 700.0 x 50.0, its Overlay wants 775.0 x 57.0; the ring's glyph ") == 1
    and Count("game glyph") == 1 and Count("1 water ") == 1 and Count("hud water") == 1 and Count("3 rest ") == 1 and Count("hud rest") == 1)
check("the measure writes nothing", writes == before)
Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w.upBg.want = { X = 10, Y = 10 }
Step(M, ctx, 1.2)
check("the measure is done after its line: taken out of the watch list, no second read", Count("shown: the band's brush") == 1 and #M.Watch == watching - 1 and #logs == 1)

-- two warnings: each reads its own glyph; rings with a hole are all listed; a read that fails says so once and is done
M, ctx = Fresh({ twoWarnings = true })
ctx.Hud = function() return { [1] = { Name = "water", GameIcon = setmetatable({ Brush = { ResourceObject = Tex("hud water") } }, api) }, [3] = { Name = "rest", GameIcon = setmetatable({ Brush = { ResourceObject = Tex("hud rest") } }, api) } } end
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
w.upkeep.WidgetTree.RootWidget.want = { X = 775, Y = 57 } w.upBg.want = { X = 700, Y = 50 }
w.upkeep2.WidgetTree.RootWidget.want = { X = 775, Y = 57 } w.upBg2.want = { X = 700, Y = 50 }
Step(M, ctx, 1.2) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
local own, second = 0, 0
for _, m in ipairs(logs) do
    if m:find("ring's glyph ", 1, true) and m:find("game glyph", 1, true) and not m:find("second glyph", 1, true) then own = own + 1 end
    if m:find("second glyph", 1, true) then second = second + 1 end
end
check("two warnings: one line names the game glyph of the first, one the second glyph of the second", #logs == 2 and own == 1 and second == 1)
check("rings with a hole (1 and 3): both are listed", Count("1 water ") == 2 and Count("3 rest ") == 2 and Count("2 food") == 0)
M, ctx = Fresh()
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
w.upkeep.WidgetTree.RootWidget.want = { X = 775, Y = 57 }
w.upBg.GetDesiredSize = function() error("no size") end
watching = #M.Watch
Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("a read that throws: one line that says so, no colour line, the check is taken out", Count("could not be measured: ") == 1 and Count("a colour is not kept") == 0 and #M.Watch == watching - 1 and #logs == 1)

-- the warning's parent is gone: nothing is read on it, no measurement is logged, the check keeps waiting; a ring whose icon is gone is listed without one
M, ctx = Fresh()
ctx.Hud = function() return { [1] = { Name = "water", GameIcon = (function() local g = Tex("gone icon") g.gone = true return g end)() } } end
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
local deadParent = Box("Dead", "Overlay", {})
deadParent.gone = true
w.upBg.parent = deadParent
local calls = deadCalls
watching = #M.Watch
Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("an invalid parent: nothing is called on it, no line, no error, the check stays in the watch list", deadCalls == calls and #logs == 0 and #M.Watch == watching)
deadParent.gone = false
deadParent.want = { X = 775, Y = 57 }
Step(M, ctx, 1.2)
check("the parent comes back: one line, the ring without an icon is 'none', no call on the gone icon", Count("shown: the band's brush") == 1 and Count("1 water none") == 1 and deadCalls == calls and #M.Watch == watching - 1)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(read('noticelook.lua'))); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(read('noticestyle.lua'))); lua.lua_setglobal(L, to_luastring('STYLETEXT'));
lua.lua_pushstring(L, to_luastring(read('noticeread.lua'))); lua.lua_setglobal(L, to_luastring('READTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

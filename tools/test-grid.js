// Tests grid.lua without the game: where the lines of the F9 grid sit, that they are made once and placed only when
// the screen changes, and that G's "off" hides them. Needs fengari. Run: node tools/test-grid.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'grid.lua'), 'utf8');
const test = `
local M = load(SRCTEXT)()
local function check(name, ok) if not ok then error("FAIL " .. name, 0) end print("ok   " .. name) end

local at = M.Offsets(1920, 40)
check("offsets: the middle first, then out from it in pairs", at[1] == 960 and at[2] == 920 and at[3] == 1000)
check("offsets: 47 lines down a 16:9 screen, none on its edge", #at == 47 and at[#at - 1] == 40 and at[#at] == 1880)
local across = M.Offsets(1080, 40)
check("offsets: the middle of the height is a line though 540 is not a multiple of 40", across[1] == 540 and #across == 27)

local made, writes = {}, 0
local function make(class)
    local w = { Class = class, Kids = {} }
    function w:SetVisibility(v) self.Vis = v writes = writes + 1 end
    function w:SetBrushColor(c) self.Colour = c end
    function w:AddChildToCanvas(child)
        self.Kids[#self.Kids + 1] = child
        local slot = {}
        function slot:SetAutoSize(a) child.Auto = a end
        function slot:SetZOrder(z) child.Z = z end
        function slot:SetPosition(p) child.At = p writes = writes + 1 end
        function slot:SetSize(s) child.Size = s writes = writes + 1 end
        return slot
    end
    made[#made + 1] = w
    return w
end
local canvas = make("CanvasPanel")
local G = M.Build(make, canvas)
local panel = canvas.Kids[1]
check("build: one panel on the editor's canvas, collapsed, and no line yet", #canvas.Kids == 1 and panel.Vis == 1 and #panel.Kids == 0)

M.Update(G, { W = 1920, H = 1080, Cell = 40 })
check("shown: the panel covers the screen and lets the mouse through", panel.Vis == 3 and panel.Size.X == 1920 and panel.Size.Y == 1080)
check("shown: 47 lines down and 27 across", #panel.Kids == 74 and #G.Down == 47 and #G.Across == 27)
local red, faint = G.Down[1].W, G.Down[2].W
check("shown: the middle line down is red, 2 thick, on the middle, over the others", red.Colour.R == 1 and red.Colour.G < 0.2
    and red.At.X == 959 and red.Size.X == 2 and red.Size.Y == 1080 and red.Z == 1)
check("shown: the next line is faint, 1 thick, 40 to the left", faint.Colour.A < 0.2 and faint.At.X == 919.5 and faint.Size.X == 1 and faint.Z == nil)
local mid = G.Across[1].W
check("shown: the middle line across is red, the whole width", mid.Colour.G < 0.2 and mid.At.Y == 539 and mid.Size.X == 1920 and mid.Size.Y == 2)

local count, before = #made, writes
M.Update(G, { W = 1920, H = 1080, Cell = 40 })
check("same screen: nothing is made and no line is placed again", #made == count and writes == before + 1)
M.Update(G, nil)
check("G off: the panel is collapsed, the lines are kept", panel.Vis == 1 and #made == count)
M.Update(G, { W = 1280, H = 720, Cell = 40 })
check("a smaller screen: the lines it has no place for are collapsed, none is made", #made == count and G.Down[31].W.Vis == 3 and G.Down[32].W.Vis == 1
    and G.Down[1].W.At.X == 639)
M.Update(G, { W = 2560, H = 1080, Cell = 40 })
check("a wide screen: more lines are made", #G.Down == 63 and G.Down[63].W.Vis == 3 and G.Down[1].W.At.X == 1279)
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

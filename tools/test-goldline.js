// Tests goldline.lua without the game: the line is a row of two halves that each fill half of the box, the left one
// mirrored, with the names the callers give. Needs fengari. Run: node tools/test-goldline.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'goldline.lua'), 'utf8');
const test = `
local M = load(SRCTEXT)()
local made, kids = {}, {}
local function make(class, name)
    local w = { Class = class, Name = name, Brush = { UVRegion = { Min = {}, Max = {} } } }
    function w:SetBrushFromTexture(tex, flag) self.Tex = tex end
    function w:SetBrush(b) self.Brush = b end
    function w:AddChildToHorizontalBox(img) kids[#kids + 1] = img return { SetSize = function(_, s) img.Size = s end } end
    made[#made + 1] = w
    return w
end
local row = M.Row(make, "tex", "RU_Line")
assert(row.Class == "HorizontalBox" and row.Name == "RU_LineRow", "the row is named name .. Row")
assert(#kids == 2 and kids[1].Name == "RU_Line" and kids[2].Name == "RU_Line", "two halves, named name")
assert(kids[1].Tex == "tex" and kids[2].Tex == "tex", "both halves draw the picture")
assert(kids[1].Brush.Mirroring == 1 and kids[2].Brush.Mirroring == nil, "only the left half is mirrored")
for i = 1, 2 do
    local uv = kids[i].Brush.UVRegion
    assert(uv.Min.X > 0.3 and uv.Min.X < 0.4 and uv.Min.Y == 0 and uv.Max.X == 1 and uv.Max.Y == 1 and uv.bIsValid == 1,
        "each half draws the picture without its first third, which has no glow")
end
assert(kids[1].Size.SizeRule == 1 and kids[1].Size.Value == 1 and kids[2].Size.SizeRule == 1, "each half fills half the box")
assert(M.PATH == "/Game/Art/UI/Loading/T_Trim_Line_Gold.T_Trim_Line_Gold", "the picture of the loading screen")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

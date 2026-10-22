// Tests the face of a buff (bufftime.lua) with fake widgets: how far the whole copy is cut for a share of time, for
// the mod's picture and for the game's, the colour of a debuff and of a good buff, and the pictures of the mod.
// Needs npm install once. Run: node tools/test-bufftime.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'bufftime.lua'), 'utf8');
const test = `
local api = {}
api.__index = api
function api:IsValid() return self.valid end
function api:GetVisibility() return self.vis or 4 end
function api:SetWidthOverride(w) self.w = w end
function api:SetHeightOverride(h) self.h = h end
function api:SetClipping(c) self.clip = c end
function api:SetRenderOpacity(o) self.op = o end
function api:SetColorAndOpacity(c) self.colour = c end
function api:SetBrush(b) self.size = b.ImageSize end
function api:SetContent(c) self.content = c end
function api:SetRenderTranslation(t) self.moved = t self.moves = (self.moves or 0) + 1 end
function api:SetBrushFromTexture(tex) self.tex = tex end
function api:AddChildToOverlay(w)
    self.kids[#self.kids + 1] = w
    return { SetHorizontalAlignment = function() end, SetVerticalAlignment = function() end }
end
local function W(name) return setmetatable({ name = name, kids = {}, valid = true, Brush = {} }, api) end
StaticFindObject = function(p) return p end
StaticConstructObject = function(_, _, name) return W(name) end
local T = load(SRCTEXT)()
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function near(a, b) return math.abs(a - b) < 0.001 end

-- the bar of the entry, with the material that the game fills
local barColour = { R = 0.1, G = 0.4, B = 0.05, A = 1 }
local bar = W("ProgressBarImage")
bar.Brush.ResourceObject = setmetatable({ valid = true, VectorParameterValues = { ForEach = function(_, fn)
    for _, p in ipairs({ { "Bar Color 2", { R = 1, G = 1, B = 1, A = 1 } }, { "Bar Color 1", barColour } }) do
        fn(1, { get = function() return { ParameterInfo = { Name = { ToString = function() return p[1] end } }, ParameterValue = p[2] } end })
    end
end } }, api)
local d = { Bar = bar }
T.Build(W("tree"), function(n) return n end, d, 42, -4)
check("the face: three copies, the whole one in a box that cuts it", #d.Face.kids == 3 and d.Face.kids[1] == d.Shade
    and d.Face.kids[2] == d.Spent and d.Face.kids[3] == d.Cut and d.Cut.content == d.Lit and d.Cut.clip == 1 and d.Cut.w == 42 and d.Cut.h == 42)
check("the face is moved up and unseen until it has a picture", d.Face.moved.Y == -4 and d.Face.op == 0)
check("alive while every part is", T.Alive(d))
d.Lit.valid = false
check("not alive when a part is gone", not T.Alive(d))
d.Lit.valid = true

-- the game's picture: the art is 27 of the 42 units, 5 from the top
T.SetPicture(d, "game", nil)
check("the three copies take the picture", d.Shade.tex == "game" and d.Spent.tex == "game" and d.Lit.tex == "game")
check("each copy is as large as the icon: a smaller copy showed behind the whole one", d.Shade.size.X == 42 and d.Shade.size.Y == 42
    and d.Spent.size.X == 42 and d.Spent.size.Y == 42 and d.Lit.size.X == 42 and d.Lit.size.Y == 42)
check("the game's picture: the dark copy is a shadow, a little right and down", d.Shade.colour.A == 0.85 and d.Shade.colour.R == 0
    and d.Shade.moved.X == 1.5 and d.Shade.moved.Y == 1.5)
T.Show(d, nil, 42)
check("no time known: the whole copy is whole", d.Cut.moved.Y == 0 and d.Lit.moved.Y == 0)
T.Show(d, 0.5, 42)
check("the game's picture, half the time: the box is 18.5 units down, the copy as much up", near(d.Cut.moved.Y, 18.5) and near(d.Lit.moved.Y, -18.5))
check("a debuff takes the bar's colour, as bright as it goes", near(d.Lit.colour.R, 0.25) and d.Lit.colour.G == 1 and near(d.Lit.colour.B, 0.125)
    and d.Lit.colour.A == 1 and near(d.Spent.colour.R, 0.25) and d.Spent.colour.A == 0.38)
T.Show(d, 0.25, 42)
check("the game's picture, a quarter left: 25.25 units are cut", near(d.Cut.moved.Y, 25.25))
T.Show(d, 1, 42)
check("all the time left: the whole copy is whole", d.Cut.moved.Y == 0 and d.Lit.moved.Y == 0)
local moves = d.Lit.moves
T.Show(d, 1, 42)
check("nothing changed: nothing is written", d.Lit.moves == moves)

-- the mod's picture: the art is the middle half of the picture
T.SetPicture(d, "ours", "ours_edge")
check("the mod's picture: the dark copy takes the grown picture and is an edge all around", d.Shade.tex == "ours_edge" and d.Spent.tex == "ours"
    and d.Lit.tex == "ours" and d.Shade.moved.X == 0 and d.Shade.moved.Y == 0 and d.Shade.colour.A == 0.92 and d.Shade.colour.R > 0)
T.Show(d, 1, 42)
check("a new picture is shown again, also with the same time", d.Lit.moves == moves + 1)
check("the mod's picture: the time that is over is a plain grey, not the debuff's colour", d.Spent.colour.A == 1 and near(d.Spent.colour.R, 0.275)
    and near(d.Spent.colour.G, 0.251) and d.Lit.colour.G == 1)
T.Show(d, 0.5, 42)
check("the mod's picture, half the time: 21 units are cut", near(d.Cut.moved.Y, 21) and near(d.Lit.moved.Y, -21))
T.Show(d, 0.02, 42)
check("the mod's picture, almost over: 31.08 units are cut", near(d.Cut.moved.Y, 31.08))

-- the colour
d.Positive = true
T.Show(d, 0.5, 42)
check("a good buff with the mod's picture is cream", near(d.Lit.colour.R, 0.896) and near(d.Lit.colour.G, 0.791) and near(d.Lit.colour.B, 0.552))
d.Positive = false
bar.vis = 1
T.Show(d, 0.5, 42)
check("a bar that the game hides: its colour is not taken", near(d.Lit.colour.R, 0.896))
bar.vis = 4
barColour.R, barColour.G, barColour.B = 0, 0, 0
T.Show(d, 0.5, 42)
check("a black bar colour is not taken", near(d.Lit.colour.G, 0.791))
T.SetPicture(d, "game", nil)
d.Positive = true
T.Show(d, 0.5, 42)
check("a good buff with the game's picture keeps the picture's colours", d.Lit.colour.R == 1 and d.Lit.colour.G == 1 and d.Lit.colour.B == 1)

-- the mod's pictures
local loads, broken, logs = 0, false, {}
local function CachedTex(cache, key, _, file)
    if broken then error("picture missing: " .. file, 0) end
    if not cache[key] then loads = loads + 1 cache[key] = file end
    return cache[key]
end
local function Log(m) logs[#logs + 1] = m end
check("a known name gives the mod's picture", T.Picture("STATUS_EFFECT_Poisoned", nil, CachedTex, Log) == "ue4ss/Mods/RuneUI/Art/buff_poison.png")
check("with it comes the grown picture, for the edge", select(2, T.Picture("STATUS_EFFECT_Poisoned", nil, CachedTex, Log)) == "ue4ss/Mods/RuneUI/Art/buff_poison_edge.png")
check("Chilled and Cold share one picture and one edge", T.Picture("STATUS_EFFECT_Chilled", nil, CachedTex, Log) == T.Picture("STATUS_EFFECT_Cold", nil, CachedTex, Log) and loads == 4)
check("a name that the mod does not know, and no name, give none", T.Picture("STATUS_EFFECT_New", nil, CachedTex, Log) == nil and T.Picture(nil, nil, CachedTex, Log) == nil)
broken = true
check("a picture that does not load gives none", T.Picture("STATUS_EFFECT_Bleeding", nil, CachedTex, Log) == nil and #logs == 1)
broken = false
check("and is not tried again in this world", T.Picture("STATUS_EFFECT_Bleeding", nil, CachedTex, Log) == nil and #logs == 1)
T.Forget()
check("a new world tries it again", T.Picture("STATUS_EFFECT_Bleeding", nil, CachedTex, Log) == "ue4ss/Mods/RuneUI/Art/buff_bleed.png")

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

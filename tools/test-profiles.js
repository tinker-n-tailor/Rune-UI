// Tests profiles.lua without the game: loading a layout profile gives every element its saved row, and an element that
// the profile has no row for (a part newer than the profile) gets its starting values, never what the profile before it left.
// Needs npm install once. Run: node tools/test-profiles.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

const test = `
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end
local Real = load(SETTINGS)()
local cfg = {
    general = { profile = 1 },
    ["layout 1"] = {
        bars = { x = 500, y = 20, scale = 1.5, visible = 1, opacity = 0.5, edgex = 1, edgey = 0 },
        late = { x = 30, y = 40, scale = 2, visible = 1, opacity = 0.8, edgex = 0, edgey = 0, wait = 20 },
    },
    -- a profile saved before the part "late" existed
    ["layout 2"] = { bars = { x = -5, y = 0, scale = 1, visible = 1, opacity = 1, edgex = 0.5, edgey = 0.5 } },
}
-- the file is not touched: Load gives the table, Save says it worked
local Settings = setmetatable({ Load = function() return cfg end, Save = function() return true end }, { __index = Real })
local function Element(id) return { Id = id, Center = { X = 0, Y = 0 }, Instances = {}, Keys = {}, Last = {} } end
local bars, late = Element("bars"), Element("late")
late.Wait = 8
local Elements = { bars, late }
local Defaults = { bars = { X = 10, Scale = 0.9 }, late = { Visible = false, Wait = 8, Y = 140 } }
local Layout = { Third = function() return 0.5 end, Retarget = function() end, TargetFromSpot = function(E) E.TX, E.TY = 0.5, 0.5 end }
local P = load(PROFILES)()
P.Init({ Log = function() end, VERSION = "test", Elements = Elements, Settings = Settings, Layout = Layout, Defaults = Defaults })
P.LoadLayout()
check("profile 1: a row is read", bars.X == 500 and bars.Scale == 1.5 and bars.Opacity == 0.5)
check("profile 1: the part with a row is read, wait included", late.Y == 40 and late.Visible == true and late.Opacity == 0.8 and late.Wait == 20)
P.Prof.Next()
check("profile 2: the row it has is read", P.Prof.N == 2 and bars.X == -5)
check("profile 2: a part without a row gets its starting values, not the ones of profile 1",
    late.X == 0 and late.Y == 140 and late.Scale == 1.0 and late.Visible == false and late.Opacity == 1.0 and late.Wait == 8)
P.Prof.Next()
P.Prof.Next()
check("back at profile 1: the saved values stand", P.Prof.N == 1 and late.Y == 40 and late.Wait == 20 and late.Visible == true)

print(fails == 0 and "all passed" or (fails .. " failed"))
if fails > 0 then error("failed") end
`;
lua.lua_pushstring(L, to_luastring(read('settings.lua'))); lua.lua_setglobal(L, to_luastring('SETTINGS'));
lua.lua_pushstring(L, to_luastring(read('profiles.lua'))); lua.lua_setglobal(L, to_luastring('PROFILES'));
lauxlib.luaL_loadstring(L, to_luastring(test));
const status = lua.lua_pcall(L, 0, 0, 0);
if (status !== 0) { console.log(lua.lua_tojsstring(L, -1)); process.exit(1); }

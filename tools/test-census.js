// Tests census.lua without the game: the walk finds a big table behind a module's field and behind a function's
// upvalue, names each with its path, counts the registry by type, and a census that fails logs why.
// Needs npm install once. Run: node tools/test-census.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const read = f => fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', f), 'utf8');

const test = `
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end
local Census = load(CENSUS)()

-- a module with a list of 40 in a field, and a function that holds a list of 100 in an upvalue
local cache, hidden = {}, {}
for i = 1, 40 do cache[i] = "name " .. i end
for i = 1, 100 do hidden[i] = {} end
local function Reader() return hidden end
local finder = { Cache = cache, Read = Reader }
local c = Census.Count({ [1] = Reader, Named = {} }, { finder = finder }, {})
check("the biggest table first, behind the upvalue of a function", c.Top[1].N == 100 and string.find(c.Top[1].Path, "^finder%.Read%(.+:%d+%)%.%^hidden$") ~= nil)
check("the second, by its module and field", c.Top[2].N == 40 and c.Top[2].Path == "finder.Cache")
check("a table under 16 entries is not listed", #c.Top == 2)
-- finder, cache, hidden and its 100, the globals, the registry and its Named
check("every table counted once", c.Total.table == 106)
check("the function counted once, though the registry holds it too", c.Total["function"] == 1)
check("the strings and their bytes", c.Total.string >= 40 and c.Bytes >= 40 * 6)

local n, refs, names = Census.Registry({ [1] = Reader, [2] = Reader, [3] = 7, Named = {} })
check("the registry by type: references and named entries apart", n == 4 and refs["function"] == 2 and refs.number == 1 and names.table == 1)

local logs = {}
debug.getregistry = function() error("no registry") end
Census.Write(function(m) logs[#logs + 1] = m end)
check("a census that fails logs why", #logs == 1 and string.find(logs[1], "^perf: census failed: .*no registry") ~= nil)
print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(read('census.lua'))); lua.lua_setglobal(L, to_luastring('CENSUS'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

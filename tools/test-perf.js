// Tests the cost by part in perf.lua without the game: Add sums the time and the memory of a part, the two "by part"
// lines name the top parts in order, the counters start again after a write, and chain.lua counts its calls under the
// chain's name. Needs npm install once. Run: node tools/test-perf.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

const test = `
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end
local clock = 0
os.clock = function() return clock end
-- fengari has no collector: the count is a number the test sets
local count = 1000
collectgarbage = function(what) return count end
local logs = {}
local Perf = load(PERF)()
local vitals = { Instances = {} }
Perf.Init({ Log = function(m) logs[#logs + 1] = m end, ById = function() return vitals end, Elements = {},
    Finder = { Searches = { N = 0, Sum = 0, Max = 0, Why = {} }, Found = {}, Reports = { Wanted = {}, Seen = 0, Kept = 0, Time = 0, Max = 0, Quick = 0 } } })

-- Add: the time is the clock since t0, the memory only when the count grew
clock = 0.010
Perf.Add("buffs", 0, 1000)
clock = 0.030
Perf.Add("buffs", 0.025, 990)   -- 10 KB made
clock = 0.031
Perf.Add("runemap", 0.001, 1500)   -- the count fell: no memory counted
clock = 0.100
Perf.Add("runemap", 0.000, 950)   -- 50 KB made
Perf.Write(61)
local byTime, byMem, byMax
for _, l in ipairs(logs) do
    byTime = byTime or string.match(l, "^perf: by time: (.*)$")
    byMem = byMem or string.match(l, "^perf: by memory made: (.*)$")
    byMax = byMax or string.match(l, "^perf: by longest run: (.*)$")
end
check("a line by the longest single run", byMax == "runemap 130 ms (max 100.0, 50 KB); buffs 15 ms (max 10.0, 10 KB)")
check("a line by time, the slowest part first", byTime == "runemap 130 ms (max 100.0, 50 KB); buffs 15 ms (max 10.0, 10 KB)")
check("a line by memory, the part that made the most first, growth only", byMem == "runemap 130 ms (max 100.0, 50 KB); buffs 15 ms (max 10.0, 10 KB)")
local full = false
for _, l in ipairs(logs) do if string.find(l, "^perf: full collection") then full = true end end
check("no full collection unless the measuring switch is on", not full)

-- after a write the counters start again: no parts, no lines
logs = {}
Perf.Write(122)
local again = false
for _, l in ipairs(logs) do if string.find(l, "^perf: by ") then again = true end end
check("no part lines when no part ran since the last write", not again)

-- chain.lua: every call of a chain is counted under its name
local C = load(CHAIN)()
local counted = {}
C.Add = function(name, t0, m0) counted[#counted + 1] = name end
local queued = nil
local ctx = { Soon = function(_, fn) queued = fn return true end }
local chain = { Name = "xp chain" }
local calls = 0
C.Run(chain, ctx, 8, function() calls = calls + 1 end, function() return calls < 2 end)
queued() queued()
check("two calls of the chain, two counts under its name", calls == 2 and #counted == 2 and counted[1] == "xp chain" and counted[2] == "xp chain")
counted = {}
C.Run({}, ctx, 8, function() end, function() return #counted == 0 end)
queued()
check("a chain without a name counts as chain", #counted == 1 and counted[1] == "chain")
C.Add = nil
C.Run({ Name = "x" }, ctx, 8, function() calls = calls + 1 end, function() return calls < 3 end)
queued()
check("without Add the chain still runs", calls == 3)
print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(read('perf.lua'))); lua.lua_setglobal(L, to_luastring('PERF'));
lua.lua_pushstring(L, to_luastring(read('chain.lua'))); lua.lua_setglobal(L, to_luastring('CHAIN'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

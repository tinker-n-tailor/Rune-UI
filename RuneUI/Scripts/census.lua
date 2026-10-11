-- The census of the measuring build: what the Lua state holds, counted once a minute after perf.lua's full
-- collection (FULL_COLLECT). Two census lines some minutes apart name a leak's holder: the registry type or the
-- table whose count grew. It walks everything that can be reached from the loaded modules, the globals and the
-- registry: the fields of a table, its metatable, and the upvalues of a function. The stack of a thread is not
-- walked: Lua cannot read it from outside. Memory that climbs while no count here does is held there, or in UE4SS.

local M = {}

local TOP = 10      -- the biggest tables listed
local DEPTH = 14    -- the longest path written

local function Key(k)
    local t = type(k)
    if t == "string" then return #k > 28 and string.sub(k, 1, 28) .. "~" or k end
    if t == "number" or t == "boolean" then return tostring(k) end
    return "<" .. t .. ">"
end

-- A function as "file:line", so a path through an upvalue says whose upvalue it is.
local function Where(f)
    local i = debug.getinfo(f, "S")
    if i.what == "C" then return "C" end
    return string.match(i.short_src, "[^/\\]*$") .. ":" .. i.linedefined
end

-- "name 12, name 3", the biggest count first
local function ByCount(counts)
    local list = {}
    for name, n in pairs(counts) do list[#list + 1] = { Name = name, N = n } end
    table.sort(list, function(a, b) return a.N > b.N or (a.N == b.N and a.Name < b.Name) end)
    local out = {}
    for i = 1, math.min(8, #list) do out[i] = list[i].Name .. " " .. list[i].N end
    return #out > 0 and table.concat(out, ", ") or "none"
end

-- The walk. Returns the counts by type (Total), the bytes of all strings, the entries of all tables, the userdata
-- by the name of their metatable (Kinds), and the TOP biggest tables as { N, Path }.
function M.Count(registry, loaded, globals)
    local seen, from, step = {}, {}, {}   -- from: the object that holds this one; step: the name of that hold
    local queue, head, tail = {}, 1, 0   -- tail is counted: the length of a list emptied from its start is not its end
    local total = { table = 0, ["function"] = 0, userdata = 0, thread = 0, string = 0 }
    local bytes, entries, kinds, sizes = 0, 0, {}, {}

    local function Reach(v, holder, name)
        local t = type(v)
        if total[t] == nil or seen[v] then return end
        seen[v], total[t] = true, total[t] + 1
        if t == "string" then bytes = bytes + #v return end
        from[v], step[v] = holder, name
        if t ~= "thread" then tail = tail + 1 queue[tail] = v end
    end

    -- the modules first: a table of a module then gets the module's name in its path, not a registry number
    for name, m in next, loaded do Reach(m, nil, Key(name)) end
    Reach(globals, nil, "_G")
    Reach(registry, nil, "registry")

    while queue[head] do
        local v = queue[head]
        queue[head], head = nil, head + 1
        local t = type(v)
        local mt = debug.getmetatable(v)
        if mt then Reach(mt, v, "<metatable>") end
        if t == "table" then
            local n = 0
            for k, x in next, v do
                n = n + 1
                Reach(k, v, "<key>")
                Reach(x, v, Key(k))
            end
            entries = entries + n
            if n >= 16 then sizes[#sizes + 1] = { T = v, N = n } end
        elseif t == "function" then
            local i = 1
            while true do
                local name, x = debug.getupvalue(v, i)
                if not name then break end
                Reach(x, v, "^" .. (name ~= "" and name or i))
                i = i + 1
            end
        else
            local name = type(mt) == "table" and rawget(mt, "__name")
            name = type(name) == "string" and name or (mt and "unnamed" or "no metatable")
            kinds[name] = (kinds[name] or 0) + 1
        end
    end

    table.sort(sizes, function(a, b) return a.N > b.N end)
    local top = {}
    for i = 1, math.min(TOP, #sizes) do
        local parts, v = {}, sizes[i].T
        while v ~= nil and #parts < DEPTH do
            local name = step[v]
            if type(v) == "function" then name = name .. "(" .. Where(v) .. ")" end
            table.insert(parts, 1, name)
            v = from[v]
        end
        if v ~= nil then table.insert(parts, 1, "...") end
        top[i] = { N = sizes[i].N, Path = table.concat(parts, ".") }
    end
    return { Total = total, Bytes = bytes, Entries = entries, Kinds = kinds, Top = top }
end

-- The registry's own entries by type. A number key is a reference that C code took (luaL_ref): a delayed call, a
-- hook. A number value under a number key is a freed reference.
function M.Registry(registry)
    local refs, names, n = {}, {}, 0
    for k, v in next, registry do
        n = n + 1
        local into = type(k) == "number" and refs or names
        into[type(v)] = (into[type(v)] or 0) + 1
    end
    return n, refs, names
end

local function Write(Log)
    local t0 = os.clock()
    local registry = debug.getregistry()
    local n, refs, names = M.Registry(registry)
    Log(string.format("perf: census: registry %d entries; references: %s; named: %s", n, ByCount(refs), ByCount(names)))
    local c = M.Count(registry, package.loaded, _G)
    Log(string.format("perf: census: reached %d tables with %d entries, %d functions, %d userdata, %d threads, %d strings of %.0f KB; userdata: %s",
        c.Total.table, c.Entries, c.Total["function"], c.Total.userdata, c.Total.thread, c.Total.string, c.Bytes / 1024, ByCount(c.Kinds)))
    for i, s in ipairs(c.Top) do Log(string.format("perf: census: table %d: %d entries at %s", i, s.N, s.Path)) end
    Log(string.format("perf: census: took %.0f ms", (os.clock() - t0) * 1000))
end

-- A census that fails must not stop the step: it says why in the log.
function M.Write(Log)
    local ok, err = pcall(Write, Log)
    if not ok then Log("perf: census failed: " .. tostring(err)) end
end

return M

// Tests how pictures.lua writes the pictures into Art, also when the Art folder is missing (a mod manager can
// drop it, as its only file in the zip is a readme). Needs fengari. Run: node tools/test-pictures.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const code = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'pictures.lua'), 'utf8');
const test = `
local Pictures = load(CODE)()
local DIR = "C:/Games/Win64/ue4ss/Mods/RuneUI/"
-- folder: does Art exist; mkdirWorks: does mkdir make it; disk: the pictures already in Art
local function run(folder, mkdirWorks, disk)
    local logs, commands = {}, {}
    disk = disk or {}
    io = { open = function(file, mode)
        if mode == "wb" then
            if not folder then return nil end
            return { write = function(_, d) disk[file] = d end, close = function() end }
        end
        if disk[file] == nil then return nil end
        return { read = function() return disk[file] end, close = function() end }
    end }
    os = { execute = function(c) commands[#commands + 1] = c if mkdirWorks then folder = true end end }
    local art = { ["a.png"] = "QUJD", ["b.png"] = "QUI=" }   -- "ABC" and "AB" as base64
    Pictures.Write(function() return art end, function(m) logs[#logs + 1] = m end, DIR)
    return disk, table.concat(logs, "|"), commands
end

local disk, logs, commands = run(true, true)
assert(disk[DIR .. "Art/a.png"] == "ABC" and disk[DIR .. "Art/b.png"] == "AB", "written into Art")
assert(#commands == 0, "no folder made when Art is there")
assert(logs:find("pictures written: 2"), "the log counts the pictures: " .. logs)

disk, logs, commands = run(false, true)
assert(disk[DIR .. "Art/a.png"] == "ABC" and disk[DIR .. "Art/b.png"] == "AB", "written after the folder is made")
assert(#commands == 1, "the folder is made once: " .. #commands)
assert(commands[1] == 'mkdir "C:\\\\Games\\\\Win64\\\\ue4ss\\\\Mods\\\\RuneUI\\\\Art" 2>nul', "mkdir with backslashes: " .. commands[1])
assert(logs:find("pictures written: 2"), "the log counts the pictures: " .. logs)

disk, logs, commands = run(false, false)
assert(#commands == 1, "mkdir is tried once, not for every picture: " .. #commands)
assert(logs:find("cannot write"), "the log says a picture could not be written: " .. logs)

disk, logs, commands = run(false, true, { [DIR .. "Art/a.png"] = "ABC", [DIR .. "Art/b.png"] = "AB" })
assert(#commands == 0, "pictures already in place: nothing written, no folder made")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(code)); lua.lua_setglobal(L, to_luastring('CODE'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

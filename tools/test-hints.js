// Tests that no hint under the selected row of the F9, F5, F8 and F6 panels is longer than the room the panel gives it:
// two lines of about 46 characters (editor.lua reserves 36 units; measured in a screenshot, 05-10-2026), so 84 characters,
// and a word wrap on spaces at 46 characters must fit in two lines (a long word at a break can need a third line).
// The lists are built from the real tables:
// F8 from mappanel.lua's rows and Hint (run in Lua, with long key names), F6 from camerarules.lua's panel rows and
// Hint (every value, and the immersive mode on and off), F5 from the On and Off hints of skinpanel.lua's rows, F9 from the
// hint strings of EditView in overlay.lua (read from their text: that part of overlay.lua needs the game to run).
// Needs npm install once. Run: node tools/test-hints.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const MAX = 84, LINE = 46;   // characters: a line of 46, and two lines
const scripts = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const overlay = fs.readFileSync(path.join(scripts, 'overlay.lua'), 'utf8').replace(/\r\n/g, '\n');
const elements = fs.readFileSync(path.join(scripts, 'elements.lua'), 'utf8').replace(/\r\n/g, '\n');
const rules = fs.readFileSync(path.join(scripts, 'camerarules.lua'), 'utf8');
const mapPanel = fs.readFileSync(path.join(scripts, 'mappanel.lua'), 'utf8'), skinPanel = fs.readFileSync(path.join(scripts, 'skinpanel.lua'), 'utf8');
let bad = 0, count = 0;
// the lines of a text wrapped on spaces at LINE characters (a word longer than a line takes its own line, cut)
function wrap(text) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > LINE) { lines.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  lines.push(line);
  return lines;
}
function check(where, text) {
  count++;
  if (typeof text !== 'string') { console.log('FAIL ' + where + ': not a text'); bad++; return; }
  if (text.length > MAX) { console.log('FAIL ' + where + ' (' + text.length + ' characters, at most ' + MAX + '): ' + text); bad++; }
  const lines = wrap(text);
  if (lines.length > 2 || lines.some(l => l.length > LINE)) { console.log('FAIL ' + where + ' (' + lines.length + ' lines of ' + LINE + ' characters, at most 2): ' + text); bad++; }
}

// F9: the hint of an element, and the hints of EditView
const f9 = [];
for (const text of [elements, overlay]) for (const m of text.matchAll(/\bHint\s*=\s*"((?:[^"\\]|\\.)*)"/g)) f9.push(m[1]);
for (const m of overlay.matchAll(/\bHint or "((?:[^"\\]|\\.)*)"/g)) f9.push(m[1]);
if (f9.length < 2) { console.log('FAIL F9: found only ' + f9.length + ' hints in elements.lua and overlay.lua, the search is broken'); process.exit(1); }
f9.forEach(t => check('F9 ' + t.slice(0, 20), t.replace(/\\"/g, '"')));

// F8, F6 and F5, in Lua
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const test = `
local KEY = { editor = "Backspace", map = "Backspace", camera = "Backspace", zoomin = "Backspace", zoomout = "Backspace", profile = "Backspace" }
local Map = load(MAPTEXT)()
local out = {}
local values = { "On", "Off", "All", "Enemies only", "Every frame", "Every 2nd frame", "Every 4th frame", "Nothing", "Map", "Compass", "1", "100%" }
for i, row in ipairs(Map.ROWS) do
    for _, v in ipairs(values) do out[#out + 1] = "F8 " .. row .. " = " .. v .. "\\t" .. Map.Hint(i, v, KEY) end
end
for _, r in ipairs(load(SKINTEXT)().ROWS) do
    out[#out + 1] = "F5 " .. r.Id .. " on\\t" .. tostring(r.On)
    out[#out + 1] = "F5 " .. r.Id .. " off\\t" .. tostring(r.Off)
end
local Cam = load(CAMTEXT)()
local crossValues
for _, r in ipairs(Cam.ROWS) do if r.Key == "crosshair" then crossValues = r.Options end end
for i, r in ipairs(Cam.PANEL) do
    for _, immersive in ipairs({ true, false }) do
        for _, on in ipairs({ true, false }) do
            for _, cross in ipairs(crossValues) do
                Cam.Set.on, Cam.Set.crosshair, Cam.Mode.Visible = on, cross, immersive
                out[#out + 1] = "F6 " .. r.Label .. " (on " .. tostring(on) .. ", immersive " .. tostring(immersive) .. ", crosshair " .. cross .. ")\\t"
                    .. tostring(Cam.Hint(i))
            end
        end
    end
end
return table.concat(out, "\\n")
`;
lua.lua_pushstring(L, to_luastring(rules)); lua.lua_setglobal(L, to_luastring('CAMTEXT'));
lua.lua_pushstring(L, to_luastring(mapPanel)); lua.lua_setglobal(L, to_luastring('MAPTEXT'));
lua.lua_pushstring(L, to_luastring(skinPanel)); lua.lua_setglobal(L, to_luastring('SKINTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
const lines = lua.lua_tojsstring(L, -1).split('\n');
let f8 = 0, f6 = 0, f5 = 0;
const seen = new Set();
for (const line of lines) {
  const [where, text] = line.split('\t');
  if (where.startsWith('F8')) { if (text === '') continue; f8++; } else if (where.startsWith('F5')) f5++; else f6++;
  if (seen.has(text)) continue;   // the same hint under many values: said once
  seen.add(text);
  check(where, text);
}
// the Mod Menu tooltip of a camera choice row: one text for every value, kept to the size of an F6 hint (a number row's
// tooltip is its F6 hint, test-modmenu.js; other Mod Menu tooltips have more room and are not measured)
const menu = JSON.parse(fs.readFileSync(path.join(scripts, '..', 'modmenu.txt'), 'utf8'));
for (const s of menu.settings) if (/^camera_/.test(s.key || '') && s.type === 'choice') check('Mod Menu ' + s.key, s.tooltip);
if (f8 < 15 || f6 < 20 || f5 < 16) { console.log('FAIL: too few hints found (F8 ' + f8 + ', F6 ' + f6 + ', F5 ' + f5 + ')'); process.exit(1); }
console.log((bad ? bad + ' FAILED' : 'ALL OK') + ': ' + count + ' different hints checked (F9 ' + f9.length + '; F8, F6 and F5 ' + (f8 + f6 + f5) + ' cases), at most ' + MAX + ' characters and two lines of ' + LINE);
process.exit(bad ? 1 : 0);

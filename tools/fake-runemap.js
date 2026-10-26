// The Lua text that joins RuneMap from its five files as wiring.lua does, for the tests that need the real map:
// NewRuneMap() gives a fresh one. NewRuneMap(parts) takes a stand-in for any of the four other files (Look, Widget,
// Creatures, Settings), so a test of runemap.lua alone gives all four.
// NewMapSettings() gives mapsettings.lua alone, for a test of what it sends to a map.
// Run it in the Lua state before the test: lauxlib.luaL_dostring(L, to_luastring(require('./fake-runemap')))
const fs = require('fs'), path = require('path');
const scripts = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const file = name => {
  const text = fs.readFileSync(path.join(scripts, name + '.lua'), 'utf8').replace(/\r\n/g, '\n');
  if (text.includes(']===]')) throw new Error(name + '.lua holds ]===], the end mark of the text here');
  return 'load([===[\n' + text + ']===], "=' + name + '.lua")()';
};
module.exports = `
function NewRuneMap(parts)
    parts = parts or {}
    local R = ${file('runemap')}
    R.Init({ Look = parts.Look or ${file('maplook')}, Widget = parts.Widget or ${file('mapwidget')},
        Creatures = parts.Creatures or ${file('mapcreatures')}, Settings = parts.Settings or ${file('mapsettings')} })
    return R
end
function NewMapSettings() return ${file('mapsettings')} end
`;

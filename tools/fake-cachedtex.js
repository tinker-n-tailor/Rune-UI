// The text of engine.lua's own CachedTex, cut out as Lua source, for the fakes of the notice and wheel tests. The fakes
// paste it into their Lua world, so the tests run the real function and not a copy that can drift.
const fs = require('fs'), path = require('path');
const text = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'engine.lua'), 'utf8').replace(/\r\n/g, '\n');
const cached = (text.match(/local function CachedTex[\s\S]*?\nend\n/) || [])[0];
if (!cached) { console.log('FAIL engine.lua: CachedTex was not found'); process.exit(1); }
module.exports = cached;

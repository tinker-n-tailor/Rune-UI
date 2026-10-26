// Tests aim.lua without the game: fake aim widgets and a fake lock-on orb. On: gold with the game's alpha kept, gold
// again after the game paints white, the diamond on the orb and in the target ring template. Off: every colour and the orb picture back.
// Needs npm install once. Run: node tools/test-aim.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'aim.lua'), 'utf8');
const harness = `
local clock = 0
os.clock = function() clock = clock + 1 return clock end
local nextAddr = 1
local function Obj(name, extra)
  local o = extra or {}
  o._name = name; o._addr = nextAddr; nextAddr = nextAddr + 1
  function o:IsValid() return true end
  function o:GetFName() local n = self._name return { ToString = function() return n end } end
  function o:GetFullName() return "X /Engine/Transient." .. self._name end
  function o:GetAddress() return self._addr end
  return o
end
local function Img(name, c) local o = Obj(name, { ColorAndOpacity = c, Brush = { ImageSize = { X = 64, Y = 64 }, TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 1 } } } })
  function o:SetColorAndOpacity(v) self.ColorAndOpacity = v end
  function o:SetBrushTintColor(t) self.Brush.TintColor = t end
  return o end
local function Panel(name, kids) local o = Obj(name)
  function o:GetChildrenCount() return #kids end
  function o:GetChildAt(i) return kids[i + 1] end
  return o end
local white = { R = 1, G = 1, B = 1, A = 0.75 }
local cross = Img("Crosshair", { R = 1, G = 1, B = 1, A = 0.75 })
cross.Brush.TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 0.75 } }   -- the staff's dot (WBP_ReticleMagic)
local bar = Obj("StaminaProgressBar", { FillColorAndOpacity = { R = 1, G = 1, B = 1, A = 1 } })
function bar:SetFillColorAndOpacity(v) self.FillColorAndOpacity = v end
local mat = Obj("MI_Ring", { VectorParameterValues = { ForEach = function(_, f)
  f(1, { get = function() return { ParameterInfo = { Name = { ToString = function() return "Glow Color and Opacity" end } }, ParameterValue = { R = 1, G = 1, B = 1, A = 0.7 } } end }) end } })
local ring = Img("SightRing", white); ring.Brush.ResourceObject = mat
local mid = Obj("MID", {}); function mid:SetVectorParameterValue(n, v) self.Last = v end
function ring:GetDynamicMaterial() return mid end
local staff = Img("MagicIcon", { R = 1, G = 1, B = 1, A = 1 })
staff.Brush.TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 0.9 } }
function staff:SetBrushTintColor(t) self.Brush.TintColor = t end
-- the mark of an aimed spell: the game's two arcs, which become our diamond; the size and the tint stay
local arcsTex = Obj("T_Arcs"); arcsTex._addr = "arcs"
function arcsTex:GetFullName() return "Texture2D /Game/UI/T_Arcs.T_Arcs" end
staff.Brush.ResourceObject = arcsTex
function staff:SetBrushFromTexture(t) self.Brush.ResourceObject = t end
local ads = Obj("ReticleRangedADS", { WidgetTree = { RootWidget = Panel("CanvasPanel_0", { ring, cross, bar, staff }) } })
-- the staff's ring round a target: its class template's Image, a /Game object among the game's live images
local ringTex = Obj("T_HUD_Reticle_Magic")
function ringTex:GetFullName() return "Texture2D /Game/UI/T_HUD_Reticle_Magic.T_HUD_Reticle_Magic" end
local icon = Img("Image", { R = 1, G = 1, B = 1, A = 1 })
icon.Brush = { ResourceObject = ringTex, TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 1 } } }
function icon:GetFullName() return "Image /Game/UI/WBP_TargetIcon.WBP_TargetIcon_C:WidgetTree.Image" end
local live = Img("Image", { R = 1, G = 1, B = 1, A = 1 })
function live:GetFullName() return "Image /Engine/Transient.GameEngine.WBP_TargetIcon_C_1.WidgetTree.Image" end
FindAllOf = function(c) assert(c == "Image") return { live, icon } end
local reticle = Obj("WBP_HUD_ReticleWidget_C", { WidgetTree = { RootWidget = Panel("Canvas", { ads }) } })
local origTex = Obj("T_Reticule_Asset")
function origTex:GetFullName() return "Texture2D /Game/UI/T_Reticule_Asset.T_Reticule_Asset" end   -- a game picture
local orbImg = Img("Orb", { R = 1, G = 1, B = 1, A = 1 }); orbImg.Brush.ResourceObject = origTex
function orbImg:SetBrushFromTexture(t) self.Brush = { ResourceObject = t, ImageSize = { X = 1, Y = 1 } } end
function orbImg:SetBrush(b) self.Brush = b end
function orbImg:SetRenderScale(s) self.Scale = s.X end
function orbImg:SetRenderTranslation(t) self.Move = t end
local sizeBox = Obj("SizeBox_1"); function sizeBox:GetContent() return orbImg end
local orb = Obj("WBP_LockOnTargetOrb_C", { WidgetTree = { RootWidget = sizeBox } })
local diamondTex = Obj("diamond")
local ringLost = false
local orbImports = 0   -- the loads of the lock-on's diamond: its texture is held by the orb's tree
StaticFindObject = function(p)
  if p == "/Game/UI/T_Reticule_Asset.T_Reticule_Asset" then return origTex end
  if p == "/Game/UI/T_Arcs.T_Arcs" then return arcsTex end
  if p == "/Game/UI/T_HUD_Reticle_Magic.T_HUD_Reticle_Magic" then return not ringLost and ringTex or nil end
  return { ImportFileAsTexture2D = function(_, outer) if outer == orb.WidgetTree then orbImports = orbImports + 1 end return diamondTex end }
end
FName = function(s) return s end
local on = true
local logs = {}
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, On = function() return on end,
  Reticle = function() return reticle end, Orb = function() return orb end }
local Aim = load(SRC)()
Aim.Tick(ctx)
assert(staff.Brush.TintColor.SpecifiedColor.R < 1, "the game's arcs not gold before our mark is on")
Aim.Tick(ctx)   -- our gold mark is on the aimed spell now: its tint goes white
assert(math.abs(cross.ColorAndOpacity.R - 0.7678) < 0.01, "crosshair not gold " .. cross.ColorAndOpacity.R)
assert(cross.ColorAndOpacity.A == 0.75, "alpha not kept")
assert(cross.Brush.TintColor.SpecifiedColor.A == 1 and cross.Brush.TintColor.SpecifiedColor.R == 1, "the staff's dot still dimmer than a tool's")
assert(bar.FillColorAndOpacity.R < 1, "bar not gold")
assert(mid.Last and mid.Last.A == 0.7, "ring material not gold")
assert(ring.ColorAndOpacity.R < 1, "ring tint not gold")
assert(staff.Brush.TintColor.SpecifiedColor.R == 1 and staff.Brush.TintColor.SpecifiedColor.A == 0.9, "the aimed spell's gold mark tinted gold again")
assert(staff.ColorAndOpacity.R == 1, "staff ring gold twice")
assert(staff.Brush.ResourceObject == diamondTex and staff.Brush.ImageSize.X == 64, "the aimed spell's mark is not our diamond at the game's size")
assert(icon.ColorAndOpacity.R == 1 and icon.Brush.ResourceObject == diamondTex and icon.Brush.TintColor.SpecifiedColor.R == 1, "target ring template not ours, or tinted over its gold picture")
assert(live.ColorAndOpacity.R == 1 and live.Brush.ResourceObject == nil, "a live ring touched")
assert(orbImg.Brush.ResourceObject == diamondTex and orbImg.Scale == 0.45 and orbImg.Brush.ImageSize.X == 64 and orbImg.Move.Y < 0, "no diamond")
cross.ColorAndOpacity = { R = 1, G = 1, B = 1, A = 0.5 }   -- the game paints it white again
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R < 1 and cross.ColorAndOpacity.A == 0.5, "not gold again")
-- the game puts its arcs back, the engine frees our diamond, and its slot holds another object: a new diamond is loaded
local freed = diamondTex
freed._name = "another object"
diamondTex = Obj("diamond")
staff.Brush.ResourceObject = arcsTex
orbImg.Brush.ResourceObject = origTex   -- the lock-on too
Aim.Tick(ctx)
assert(staff.Brush.ResourceObject == diamondTex, "the aimed spell's mark got the object in the freed slot")
assert(orbImg.Brush.ResourceObject == diamondTex, "the lock-on got the object in the freed slot")
on = false
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R == 1 and cross.ColorAndOpacity.A == 0.75, "crosshair not restored")
assert(cross.Brush.TintColor.SpecifiedColor.A == 0.75, "the staff dot's brush tint not restored")
assert(bar.FillColorAndOpacity.R == 1, "bar not restored")
assert(mid.Last.R == 1 and mid.Last.A == 0.7, "ring not restored")
assert(ring.ColorAndOpacity.R == 1, "ring tint not restored")
assert(staff.Brush.TintColor.SpecifiedColor.R == 1 and staff.Brush.TintColor.SpecifiedColor.A == 0.9, "staff ring not restored")
assert(staff.Brush.ResourceObject == arcsTex, "the aimed spell's mark has not the game's picture back")
assert(icon.ColorAndOpacity.R == 1 and icon.Brush.ResourceObject == ringTex, "target ring template not restored")
assert(orbImg.Brush.ResourceObject == origTex and orbImg.Scale == 1 and orbImg.Brush.ImageSize.X == 64 and orbImg.Move.Y == 0, "orb not restored")
on = true
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R < 1 and orbImg.Brush.ResourceObject == diamondTex, "not gold after on again")
assert(icon.Brush.ResourceObject == diamondTex, "ring template not ours after on again")
-- a player restart: the handles go, the widgets stay gold; off must still bring the white back
Aim.Forget()
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R < 1 and orbImg.Brush.ResourceObject == diamondTex, "not gold after a restart")
Aim.Forget()
on = false
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R == 1 and bar.FillColorAndOpacity.R == 1 and mid.Last.R == 1, "white not back after a restart")
assert(orbImg.Brush.ResourceObject == origTex and orbImg.Scale == 1, "orb not back after a restart")
assert(icon.Brush.ResourceObject == ringTex and icon.ColorAndOpacity.R == 1, "ring template not back after a restart")
-- off while the game's ring picture cannot be found: the diamond stays, but the game's picture is still remembered
on = true
Aim.Tick(ctx)
assert(icon.Brush.ResourceObject == diamondTex, "ring template not ours before the lost picture")
ringLost = true
on = false
Aim.Tick(ctx)
assert(icon.Brush.ResourceObject == diamondTex, "ring template changed while the picture was lost")
ringLost = false
on = true
Aim.Tick(ctx)
on = false
Aim.Tick(ctx)
assert(icon.Brush.ResourceObject == ringTex and icon.ColorAndOpacity.R == 1, "ring template stays a diamond after a lost picture")
-- the diamond picture does not load: one try, not a read from disk at every step
Aim.Forget()
diamondTex = nil
orbImports = 0
on = true
for _ = 1, 5 do Aim.Tick(ctx) end
assert(orbImports == 1, "the lock-on's diamond was loaded " .. orbImports .. " times, not once")
print("ALL OK")
`;
const full = harness.replace('load(SRC)', 'load(SRCTEXT)');
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(full)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }


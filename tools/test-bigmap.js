// Tests the big map (bigmap.lua) against fake markers shaped like the game's (WBP_Dominion_MinimapInternal_Icon_C:
// MapIconComp, Image_Icon, WidgetTree.RootWidget). Every marker loses the cross pointer. A quest area goes faint, lets the
// mouse through and gets one shield at its own place, however many maps draw it; the shield comes off when the game hides
// the circle. A marker that cannot be read is left alone and looked at again. The wheel moves the zoom one level a notch,
// the gamepad's stick one level a push.
// Also covers a new world and a restart.
// Needs npm install once. Run: node tools/test-bigmap.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'bigmap.lua'), 'utf8');
const test = `
local function check(name, cond) if not cond then error("FAIL " .. name, 2) end print("ok   " .. name) end
local nextAddr = 1000
local function Obj() nextAddr = nextAddr + 1 local o = { Addr = nextAddr, Valid = true }
    function o:IsValid() return self.Valid end function o:GetAddress() return self.Addr end return o end

-- the game's pictures and classes
local primary, secondary, tertiary, lodestone = Obj(), Obj(), Obj(), Obj()
local iconClass, imported = Obj(), {}
local krl = Obj()
function krl:ImportFileAsTexture2D(outer, file) local t = Obj() t.File = file imported[#imported + 1] = file return t end
function StaticFindObject(p)
    if p == "/Game/Art/UI/Map/T_Map_Primary_Quest_Outline.T_Map_Primary_Quest_Outline" then return primary end
    if p == "/Game/Art/UI/Map/T_Map_Secondary_Quest_Outline.T_Map_Secondary_Quest_Outline" then return secondary end
    if p == "/Game/Art/UI/Map/T_Map_Tertiary_Quest_Outline.T_Map_Tertiary_Quest_Outline" then return tertiary end
    if p == "/Script/MinimapPlugin.MapIconComponent" then return iconClass end
    if p == "/Script/Engine.Default__KismetRenderingLibrary" then return krl end
end

-- an actor that can take a map icon; Icons: the icons on it that stand
local function Actor(name)
    local a = Obj() a.Icons = {}
    function a:GetFullName() return name end
    function a:AddComponentByClass(cls, manual, at, deferred)
        local icon = Obj() icon.IconSize, icon.IconFogInteraction, icon.Deferred = 40, 2, deferred
        -- the map reads the fog setting when the icon registers: at once, or at FinishAddComponent when deferred
        if not deferred then icon.FogAtStart = icon.IconFogInteraction end
        function icon:SetIconTexture(t) self.IconTexture = t end
        function icon:SetIconSize(w, h) self.Size = w end
        function icon:K2_SetWorldLocation(v) self.At = v end
        function icon:K2_DestroyComponent() self.Valid = false for i, x in ipairs(a.Icons) do if x == self then table.remove(a.Icons, i) end end end
        a.Icons[#a.Icons + 1] = icon
        return icon
    end
    function a:FinishAddComponent(icon) icon.FogAtStart = icon.IconFogInteraction end
    return a
end
-- a component of the game on an actor, and a marker of it on one map
local function Comp(owner, picture, x)
    local c = Obj() c.IconTexture, c.Visible, c.At, c.IconFogInteraction = picture, true, { X = x or 0, Y = 5, Z = 7 }, 3
    function c:GetOwner() return owner end
    function c:GetFullName() return "Comp " .. self.Addr end
    function c:K2_GetComponentLocation() return self.At end
    function c:IsIconVisible() return self.Visible end
    return c
end
-- a map with its two icon panels; a marker sits in one of them
local function Map(iconScale)
    local m = Obj() m.IconScale, m.Canvas_IconsAboveFog, m.Canvas_IconsBelowFog = iconScale, Obj(), Obj()
    return m
end
local big, small = Map(1), Map(0.4)
local markers = 0
local function Marker(comp, panel)
    markers = markers + 1
    local W = Obj() W.MapIconComp, W.Cursor, W.Name = comp, 8, "Marker " .. markers
    W.Panel = panel or big.Canvas_IconsAboveFog
    function W:GetParent() return self.Panel end
    W.Image_Icon = Obj() W.Image_Icon.Op = 1
    function W.Image_Icon:GetRenderOpacity() return self.Op end
    function W.Image_Icon:SetRenderOpacity(o) self.Op = o end
    local arrow = Obj() arrow.RenderTransform = { Scale = { X = 1, Y = 1 }, Translation = { X = 0, Y = 0 } }
    arrow.Op = 1
    function arrow:SetRenderOpacity(o) self.Op = o end
    function arrow:SetRenderScale(v) self.RenderTransform.Scale = v end
    function arrow:SetRenderTranslation(v) self.RenderTransform.Translation = v end
    W.Image_Arrow_Overlay = arrow
    local root = Obj() root.Vis = 0
    function root:GetVisibility() return self.Vis end
    function root:SetVisibility(v) self.Vis = v end
    W.WidgetTree = { RootWidget = root }
    function W:ResetCursor() self.Cursor = nil end
    function W:GetVisibility() return 4 end
    function W:GetFullName() return self.Name end
    return W
end
local function Faint(W) return math.abs(W.Image_Icon.Op - 0.3) < 0.001 end
local function Through(W) return W.WidgetTree.RootWidget.Vis == 3 end
local function Beside(W) local t = W.Image_Arrow_Overlay.RenderTransform return t.Scale.X == 0.6 and t.Translation.X == 20 end

clock = 100
os.clock = function() return clock end
local M = load(SRCTEXT)()
local list, logs, arrivals, finds = {}, {}, nil, 0
local view = Obj() view.Zoom, view.Sets = 3, 0
function view:GetZoomScale() return self.Zoom end
function view:SetZoomScale(z) self.Zoom = z self.Sets = self.Sets + 1 end
local pc = Obj() pc.Pawn = Obj() pc.Pawn.MapView = view
local ctx = { Log = function(m) logs[#logs + 1] = m end, Controller = function() return pc end,
    SmallMap = function() return small end,
    Arrived = function(c) assert(c == "WBP_Dominion_MinimapInternal_Icon_C") local a = arrivals arrivals = nil return a end,
    Find = function(c) finds = finds + 1 assert(c == "WBP_Dominion_MinimapInternal_Icon_C") return list, {} end }
local function Step(seconds) clock = clock + (seconds or 1.1) M.Tick(ctx) end

-- the markers that stand when the mod starts: the scan finds them
local place = Actor("QuestLocation 1")
local area = Comp(place, primary, 300)
local onMini, stone = Marker(area), Marker(Comp(Actor("Lodestone"), lodestone))
list = { onMini, stone }
M.Scan(ctx)
check("scan: every marker loses the cross, so the game's pointer shows", onMini.Cursor == nil and stone.Cursor == nil)
check("scan: a quest area is faint and lets the mouse through", Faint(onMini) and Through(onMini))
check("scan: another marker keeps its look and takes the mouse", stone.Image_Icon.Op == 1 and not Through(stone))
check("scan: the triangle of a quest area is small and beside the middle, that of another marker stays", Beside(onMini) and stone.Image_Arrow_Overlay.RenderTransform.Scale.X == 1)
Step()
check("a shield for the area, the gold one", #place.Icons == 1 and place.Icons[1].IconTexture.File:find("mark_quest.png", 1, true) ~= nil)
check("the shield stands at the place of the circle", place.Icons[1].At.X == 300 and place.Icons[1].At.Y == 5)
check("the shield is 0.9 of the icon's own size", place.Icons[1].Size == 36)
check("the shield registers with its circle's fog setting, so it shows in fog as the circle does", place.Icons[1].Deferred == true and place.Icons[1].FogAtStart == 3)

-- the big map opens: the game makes the markers new, the area a second time
local onBig = Marker(area)
arrivals = { onBig }
Step()
check("a new marker of the area is faint at once", Faint(onBig) and Through(onBig) and onBig.Cursor == nil)
check("two markers of one area: still one shield", #place.Icons == 1)
local ours = Marker(place.Icons[1])
arrivals = { ours }
Step()
check("the marker of our shield lets the mouse through and keeps its look", Through(ours) and ours.Image_Icon.Op == 1)
check("the marker of our shield shows no triangle; the circle keeps its own", ours.Image_Arrow_Overlay.Op == 0 and onBig.Image_Arrow_Overlay.Op == 1)

-- RuneMap draws its icons smaller, and the triangle goes with them; a marker with no panel yet is asked again
local onSmall, noPanel = Marker(area, small.Canvas_IconsBelowFog), Marker(area)
noPanel.Panel = nil
arrivals = { onSmall, noPanel }
Step()
local function Small(W) local t = W.Image_Arrow_Overlay.RenderTransform return math.abs(t.Scale.X - 0.24) < 0.001 and math.abs(t.Translation.X - 8) < 0.001 end
check("on RuneMap the triangle has the icon scale of the map", Small(onSmall) and Beside(onBig))
check("a marker with no panel yet keeps the big map's triangle", Beside(noPanel))
noPanel.Panel = small.Canvas_IconsAboveFog
Step()
check("in a panel of RuneMap since: the small triangle", Small(noPanel))
onSmall.Valid, noPanel.Valid = false, false

-- a side quest: the blue shield, and the picture of a standing shield is used again
local side1, side2 = Actor("QuestLocation 2"), Actor("QuestLocation 3")
local sideArea = Comp(side1, secondary)
arrivals = { Marker(sideArea), Marker(Comp(side2, secondary)) }
Step()
check("a side quest area gets the blue shield", #side1.Icons == 1 and side1.Icons[1].IconTexture.File:find("mark_side.png", 1, true) ~= nil)
check("a second shield of one colour uses the picture that stands", side2.Icons[1].IconTexture == side1.Icons[1].IconTexture and #imported == 2)

-- a task of the main quest: the green shield
local task = Actor("QuestLocation 4")
arrivals = { Marker(Comp(task, tertiary)) }
Step()
check("a task area gets the green shield", #task.Icons == 1 and task.Icons[1].IconTexture.File:find("mark_task.png", 1, true) ~= nil)

-- a marker that the blueprint has not set up yet is looked at again
local late = Marker(area)
late.MapIconComp = nil
arrivals = { late }
Step(0.2)
check("not set up yet: left alone", late.Cursor == 8 and late.Image_Icon.Op == 1)
late.MapIconComp = area
Step(0.2)
check("set up since: faint on the next look", Faint(late) and late.Cursor == nil)

-- the game undoes the look; the game hides the circle
onBig.Image_Icon.Op, onBig.Image_Arrow_Overlay.RenderTransform.Scale = 1, { X = 1, Y = 1 }
Step()
check("a circle shown at full again goes faint again, and its triangle is small again", Faint(onBig) and Beside(onBig))
area.Visible = false
Step()
check("the game hides the circle: the shield comes off", #place.Icons == 0 and #side1.Icons == 1)
area.Visible = true
Step()
check("the game shows it again: the shield is back, once", #place.Icons == 1)
onMini.Valid, onBig.Valid, late.Valid = false, false, false
Step()
check("every marker of the area is gone: the shield comes off", #place.Icons == 0)

-- the scan runs twice in a round, then no more; a quest area that came with the reports stays and is not taken twice
local known = Marker(sideArea)
arrivals = { known }
Step()
list = { known, stone }
clock = clock + 20 M.Scan(ctx) clock = clock + 20 M.Scan(ctx) clock = clock + 20 M.Scan(ctx)
Step()
check("the scan of every marker runs twice in a round", finds == 2)
check("the scan keeps the quest areas that the reports brought", #side1.Icons == 1 and #side2.Icons == 1)

-- one actor owns the circles of two areas (the game's MinimapPluginMapIcons): a shield for each, at its own place
local shared = Actor("MinimapPluginMapIcons")
arrivals = { Marker(Comp(shared, primary, 10)), Marker(Comp(shared, primary, 20)) }
Step()
check("two areas on one owner: two shields, each at its circle", #shared.Icons == 2 and shared.Icons[1].At.X + shared.Icons[2].At.X == 30)

-- the zoom: one level a notch
check("levels: a notch out from close is the zone", M.NextLevel(1, 3, 3.14) == 2)
check("levels: a notch out from the zone is the whole map", M.NextLevel(2, 6.3, 6.43) == 3)
check("levels: a notch out at the whole map stays", M.NextLevel(3, 20, 20.2) == 3)
check("levels: a notch in from the whole map is the zone", M.NextLevel(3, 20, 19.87) == 2)
check("levels: the game's own start is close, from any level", M.NextLevel(3, 20, 3) == 1)
Step()
check("a zoom that stands is not written", view.Sets == 0)
view.Zoom = 3.14 Step(0.05)
check("the wheel out: the zone", view.Zoom == 6.3)
view.Zoom = 6.43 Step(0.05)
check("the wheel out again: the whole map", view.Zoom == 20)
view.Zoom = 19.87 Step(0.05)
check("the wheel in: the zone", view.Zoom == 6.3)
local sets = view.Sets
view.Zoom = 3 Step(0.05)   -- the map opens again
check("the map opens again: close, and the mod writes nothing", view.Zoom == 3 and view.Sets == sets)
view.Zoom = 3.14 Step(0.05)
check("after that the wheel out is the zone again", view.Zoom == 6.3)

-- a gamepad: the right stick moves the zoom a little at every frame while it is held (IMC_Map: Gamepad_RightY, an
-- axis), so one push is one level
local pad = true
ctx.Pad = function() return pad end
view.Zoom = 3 Step(0.05)   -- the map opens again
for i = 1, 10 do view.Zoom = view.Zoom + 0.02 Step(0.016) end
check("the stick held out: one level, the zone", view.Zoom == 6.3)
Step(0.5)   -- the stick let go
view.Zoom = 6.32 Step(0.016)
check("the stick pushed out again: the whole map", view.Zoom == 20)
for i = 1, 10 do view.Zoom = view.Zoom + 0.02 Step(0.016) end
check("held at the whole map: it stays", view.Zoom == 20)
Step(0.5)
for i = 1, 10 do view.Zoom = view.Zoom - 0.02 Step(0.016) end
check("the stick held in: one level, the zone", view.Zoom == 6.3)
pad = false
Step(0.5)
view.Zoom = 6.43 Step(0.016) view.Zoom = 20.2 Step(0.016)
check("the mouse: two quick notches are two levels, as before", view.Zoom == 20)
view.Zoom = 3 Step(0.05)

-- a restart of the player: the shields come off and come back once; a new world: nothing of the old one is called
local n = #side1.Icons
M.Forget(true)
check("restart: the shields come off", #side1.Icons == 0 and n == 1)
arrivals = { Marker(Comp(side1, secondary)) }
Step()
check("after a restart the shield comes back once", #side1.Icons == 1)
M.Forget(false)
check("new world: nothing is called on the old shields", #side1.Icons == 1)
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

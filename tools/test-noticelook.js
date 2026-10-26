// Tests the notices' look (noticelook.lua and noticestyle.lua) against fake entries named as the game's: each notice
// gets its look; the band is the banner picture's strip drawn as a plain picture; an entry is walked once and styled
// once; a colour the game wrote back is set again; a part that waits for the font or for the banner picture is
// styled later; the perk flag off, the master copy of a quest row, colours whose fields are not numbers, the name
// check of a freed slot, a missing page, a band in a box that is not an Overlay, and the sparkle and new skill strip
// constants; the strip of the gold lines; the two lines of the status line and the warning (the top one half as wide, both made once, placed where
// one image put them, not with a wrong parent); the new area banner's
// shadow (hidden as the symbol is, a missing part logged once with the images seen); the mod's pictures decoded
// once for all notices (the ring in the warning is in test-noticering.js); the tint hide and the collapse check; an entry that runs again on each show
// holds no Move or Lines step; a new world makes no call on the old widgets.
// Needs npm install once. Run: node tools/test-noticelook.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const prelude = require('./fake-notices');
const test = prelude + `
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function IsGold(c) return math.abs(c.R - 0.76) < 1e-6 and math.abs(c.G - 0.48) < 1e-6 and math.abs(c.B - 0.10) < 1e-6 end
local function Count(pattern) local n = 0 for _, m in ipairs(logs) do if m:find(pattern, 1, true) then n = n + 1 end end return n end
local function IsBand(b) return b.UVRegion.Min.Y == 0.426 and b.UVRegion.Max.Y == 0.574 and b.UVRegion.Min.X == 0 and b.UVRegion.Max.X == 1 and b.UVRegion.bIsValid == 1 end
Style = load(STYLETEXT)()
load(READTEXT)().Install(Style)
load(RINGTEXT)().Install(Style)

-- every notice gets its look
local M, ctx = Fresh()
Step(M, ctx)
local w = current
check("new area: the name and the lines are gold", IsGold(w.name.ColorAndOpacity.SpecifiedColor) and w.name.ColorAndOpacity.SpecifiedColor.A == 1 and IsGold(w.hl.ColorAndOpacity))
check("new area: symbol, FX and top texture are see-through", w.fx.ColorAndOpacity.A == 0 and w.sym.ColorAndOpacity.A == 0 and w.top.ColorAndOpacity.A == 0 and w.fx.ColorAndOpacity.R == 1)
check("new area: the brush tint of symbol, FX and top texture is see-through too, its red, green and blue kept",
    w.fx.Brush.TintColor.SpecifiedColor.A == 0 and w.sym.Brush.TintColor.SpecifiedColor.A == 0 and w.top.Brush.TintColor.SpecifiedColor.A == 0
    and w.fx.Brush.TintColor.SpecifiedColor.R == 1 and w.fx.Brush.TintColor.ColorUseRule == 0 and w.hl.Brush.TintColor.SpecifiedColor.A == 1 and w.bg.wrote == nil)
check("new area: the shadow is see-through by its colour and by its brush tint, its red, green and blue kept", w.shadow.ColorAndOpacity.A == 0 and w.shadow.ColorAndOpacity.R == 1
    and w.shadow.Brush.TintColor.SpecifiedColor.A == 0 and w.shadow.Brush.TintColor.SpecifiedColor.R == 1 and w.shadow.Brush.TintColor.ColorUseRule == 0)
check("new area: the band and the sub text are left", w.bg.wrote == nil and w.sub.wrote == nil)
check("new area: the power level goes 20 up from where it was", w.power.RenderTransform.Translation.Y == -15 and w.power.RenderTransform.Translation.X == 0)
check("new area: the sparkles are collapsed", w.spark.vis == 1 and w.spark.wrote == 1)
check("the level up page is not touched", w.levelText.wrote == nil)
check("tip: the icon and the title are gold, the title by its default colour", IsGold(w.tipIcon.ColorAndOpacity) and IsGold(w.tipTitle.DefaultColorAndOpacity.SpecifiedColor) and w.tipTitle.ColorAndOpacity.SpecifiedColor.R == 0.9 and w.tipBody.wrote == nil)
check("tip: the progress line is gold, 2 high, its fill percent and visibility not written", IsGold(w.bar.FillColorAndOpacity) and w.bar.FillColorAndOpacity.A == 1 and w.barBox.height == 2
    and w.bar.Percent == 0.5 and w.bar.vis == nil and w.barBox.vis == nil)
check("tip: the progress line sits on the bottom edge of its band: the slot's bottom padding is 0, the other sides kept, written once",
    w.barSlot.Padding.Bottom == 0 and w.barSlot.Padding.Left == 0 and w.barSlot.Padding.Top == 0 and w.barSlot.Padding.Right == 0 and w.barSlot.sets == 1)
check("tip: the shadow image is see-through", w.tipShadow.ColorAndOpacity.A == 0)
check("tip: the band is the banner picture's strip, a plain picture, its own size", w.tipBand.Brush.ResourceObject == w.texBg and IsBand(w.tipBand.lastBrush) and w.tipBand.lastBrush.DrawAs == 3
    and w.tipBand.Brush.ImageSize.X == 628 and w.tipBand.Brush.ImageSize.Y == 87)
check("perk: the bands and the symbol are see-through, also in a row", w.q[1].ColorAndOpacity.A == 0 and w.q[2].ColorAndOpacity.A == 0 and w.q[3].ColorAndOpacity.A == 0
    and w.q[4].ColorAndOpacity.A == 0 and w.rowBand.ColorAndOpacity.A == 0)
check("perk: the title border has no colour, the texts are left to quests.lua",
    w.qBorder.BrushColor.A == 0 and w.qBorder.BrushColor.R == 1 and w.qTitle.wrote == nil and w.rowText.wrote == nil)
check("perk: the master copy of the row has no band, so a new row is born without it", w.master.ColorAndOpacity.A == 0 and w.master.ColorAndOpacity.R == 1)
check("event: the black panel is the band, 600 wide, its height kept, not drawn as a plain picture",
    w.panel.Brush.ResourceObject == w.texBg and IsBand(w.panel.lastBrush) and w.panel.lastBrush.ImageSize.X == 600 and w.panel.lastBrush.ImageSize.Y == 115 and w.panel.lastBrush.DrawAs == 0)
check("event: the texts are in Poppins", w.started.fontSet == fontObj and w.timer.fontSet == fontObj and w.completed.fontSet == fontObj and w.started.Font.Size == 14)
check("vendor: Poppins, the counter 6 left and 3 up from where it was", w.vName.fontSet == fontObj and w.vLevel.fontSet == fontObj
    and w.vLevel.RenderTransform.Translation.X == -4 and w.vLevel.RenderTransform.Translation.Y == -2)
check("vendor: the circle and the bar 6 left", w.circle.RenderTransform.Translation.X == -6 and w.repBar.RenderTransform.Translation.X == -6 and w.circle.RenderTransform.Translation.Y == 0)
check("new skill, milestone, fish: every text in Poppins, nothing else", w.skillA.fontSet == fontObj and w.skillB.fontSet == fontObj and w.mile.fontSet == fontObj
    and w.fish.fontSet == fontObj and w.strip.wrote == nil and w.skillA.ColorAndOpacity.SpecifiedColor.R == 0.9)
check("upkeep: the ring's pictures are decoded with the ring's tree as owner and held by the ring's brushes", loaded and loaded.outer == w.ring.WidgetTree and loaded.path:find("Art/upkeep_centre.png", 1, true))
check("upkeep: the glow is see-through, the band is on the item's own Background only", w.glow.ColorAndOpacity.A == 0 and w.upBg.Brush.ResourceObject == w.texBg and IsBand(w.upBg.lastBrush)
    and w.ringBack.lastBrush == nil and w.ringBack.Brush.DrawAs == 0 and w.upBg.Brush.ResourceObject ~= artTex and w.ringBack.wrote == nil)
-- where the picture's line at Y sits, in units from the middle of the band, for one of our images (a turned-over one counts from its bottom edge)
local function LineAt(img, line)
    local u, h = img.lastBrush.UVRegion, img.lastBrush.ImageSize.Y
    local down = (line - u.Min.Y) / (u.Max.Y - u.Min.Y) * h
    -- the image is half the band's height, pinned to the band's top (slot v 1) or bottom (3): its middle is h / 2 from the band's
    local mid = (img.slot.v == 1 and -h / 2 or h / 2) + img.RenderTransform.Translation.Y
    if img.RenderTransform.Scale and img.RenderTransform.Scale.Y == -1 then return mid + h / 2 - down end
    return mid - h / 2 + down
end
local function Near(a, b) return math.abs(a - b) < 0.05 end
local utop, ubottom = w.upRoot.kids[5], w.upRoot.kids[6]
local top, bottom = w.stRoot.kids[3], w.stRoot.kids[4]
check("upkeep and status: two images of ours each in the Overlay after the band and the text, named by the mod's name maker, in their own tree",
    #w.upRoot.kids == 6 and #w.stRoot.kids == 4 and utop.cls == "Image" and ubottom.cls == "Image" and top.cls == "Image" and bottom.cls == "Image"
    and utop.name == "RU_NoticeLinesTop_7_1" and ubottom.name == "RU_NoticeLinesBottom_7_2" and top.name == "RU_NoticeLinesTop_7_4" and bottom.name == "RU_NoticeLinesBottom_7_5"
    and utop.outer == w.upkeep.WidgetTree and ubottom.outer == w.upkeep.WidgetTree and top.outer == w.status.WidgetTree and bottom.outer == w.status.WidgetTree
    and utop.parent == w.upRoot and top.parent == w.stRoot and bottom.parent == w.stRoot)
check("both are gold, the lines picture, a plain picture, seen and the mouse goes through", IsGold(top.ColorAndOpacity) and IsGold(bottom.ColorAndOpacity) and IsGold(utop.ColorAndOpacity) and IsGold(ubottom.ColorAndOpacity)
    and top.Brush.ResourceObject == w.texLines and bottom.Brush.ResourceObject == w.texLines and utop.Brush.ResourceObject == w.texLines and ubottom.Brush.ResourceObject == w.texLines
    and top.lastBrush.DrawAs == 3 and bottom.lastBrush.DrawAs == 3 and utop.lastBrush.DrawAs == 3 and top.vis == 3 and bottom.vis == 3 and ubottom.vis == 3)
check("status: each image is half the band's height and the band's width; the top one is turned over about its centre (scale -1 down), the bottom one not, none is narrowed",
    top.lastBrush.ImageSize.X == 700 and top.lastBrush.ImageSize.Y == 25 and bottom.lastBrush.ImageSize.X == 700 and bottom.lastBrush.ImageSize.Y == 25
    and top.RenderTransform.Scale.X == 1 and top.RenderTransform.Scale.Y == -1 and top.pivot.X == 0.5 and top.pivot.Y == 0.5 and bottom.RenderTransform.Scale == nil and bottom.pivot == nil)
check("upkeep: the same, for its band of 775 by 57", utop.lastBrush.ImageSize.X == 775 and utop.lastBrush.ImageSize.Y == 28.5 and ubottom.lastBrush.ImageSize.X == 775 and ubottom.lastBrush.ImageSize.Y == 28.5
    and utop.RenderTransform.Scale.X == 1 and utop.RenderTransform.Scale.Y == -1 and ubottom.RenderTransform.Scale == nil)
check("both images draw the same lower half of the strip, the whole width of the picture",
    top.lastBrush.UVRegion.Min.Y == 0.499 and top.lastBrush.UVRegion.Max.Y == 0.578 and bottom.lastBrush.UVRegion.Min.Y == 0.499 and bottom.lastBrush.UVRegion.Max.Y == 0.578
    and top.lastBrush.UVRegion.Min.X == 0 and top.lastBrush.UVRegion.Max.X == 1 and bottom.lastBrush.UVRegion.Min.X == 0 and bottom.lastBrush.UVRegion.Max.X == 1 and top.lastBrush.UVRegion.bIsValid == 1 and bottom.lastBrush.UVRegion.bIsValid == 1)
check("both fill across; the top one is pinned to the top of the band and the bottom one to its bottom, with no gap, both 0.75 up (the pixel)",
    top.slot.h == 0 and bottom.slot.h == 0 and top.slot.v == 1 and bottom.slot.v == 3 and top.RenderTransform.Translation.Y == -0.75 and bottom.RenderTransform.Translation.Y == -0.75
    and top.RenderTransform.Translation.X == 0 and bottom.RenderTransform.Translation.X == 0 and utop.slot.h == 0 and ubottom.slot.h == 0)
check("the picture's bottom line (0.574) sits under the band's lower edge and, turned over, above its upper edge: the same distance each side, the line's own 1.3 units inside the band's edge",
    Near(LineAt(bottom, 0.574), 25 - 0.025 * 50 - 0.75) and Near(LineAt(top, 0.574), -25 + 0.025 * 50 - 0.75) and Near(LineAt(ubottom, 0.574), 28.5 - 0.025 * 57 - 0.75)
    and Near(LineAt(utop, 0.574), -28.5 + 0.025 * 57 - 0.75))   -- 0.75: both lines are lifted by the pixel the band's picture is drawn off by
check("only the ring's three pictures are decoded (back, half, centre)", loaded and imports == 3)
check("upkeep: a gap between the ring and the band, the texts in Poppins", w.ring.RenderTransform.Translation.X == -8 and w.upLabel.fontSet == fontObj)
check("status: the band, gold lines, Poppins", w.stBg.Brush.ResourceObject == w.texBg and IsBand(w.stBg.lastBrush) and #w.stRoot.kids == 4 and IsGold(w.stRoot.kids[3].ColorAndOpacity) and w.stText.fontSet == fontObj)
check("no write of an entry's or a page's visibility or opacity", violations == 0)
check("no log line", #logs == 0)
check("the font is looked for once in a step", fontCalls == 1)

-- an entry is styled once
local before = writes
Step(M, ctx, 1.2) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("a second look writes nothing new: no second lines images", writes == before and #w.upRoot.kids == 6 and #w.stRoot.kids == 4 and #made == 4)

-- a value that the game wrote back is set again, once the check comes round
w.fx.ColorAndOpacity = { R = 1, G = 1, B = 1, A = 1 }
w.name.ColorAndOpacity = { SpecifiedColor = { R = 0.9, G = 0.3, B = 0.2, A = 0.5 }, ColorUseRule = 0 }
w.hl.ColorAndOpacity = { R = 1, G = 0, B = 0, A = 1 }
w.qBorder.BrushColor = { R = 1, G = 1, B = 1, A = 1 }
w.bar.FillColorAndOpacity = { R = 1, G = 0.98, B = 0.93, A = 0.6 }
w.tipTitle.DefaultColorAndOpacity = { SpecifiedColor = { R = 0.9, G = 0.3, B = 0.2, A = 1 }, ColorUseRule = 0 }
before = writes
Step(M, ctx, 0.3)
check("the check waits for its second", writes == before)
Step(M, ctx, 1.1)
check("the six values are set again, the game's alpha of a text and of the line kept", writes == before + 6 and IsGold(w.bar.FillColorAndOpacity) and w.bar.FillColorAndOpacity.A == 0.6 and w.fx.ColorAndOpacity.A == 0 and IsGold(w.name.ColorAndOpacity.SpecifiedColor)
    and w.name.ColorAndOpacity.SpecifiedColor.A == 0.5 and IsGold(w.hl.ColorAndOpacity) and w.qBorder.BrushColor.A == 0 and IsGold(w.tipTitle.DefaultColorAndOpacity.SpecifiedColor))
before = writes
Step(M, ctx, 1.2)
check("and then nothing more", writes == before)

-- a glyph that is no need: the game's ring, its back and its glyph are not written (test-noticering.js has the rings that match)
check("upkeep: the game's glyph colour and ring back are left, the glyph is still the one the read-only step keeps", w.glyph.wrote == nil and w.ringBack.wrote == nil
    and w.glyph.Brush.ResourceObject ~= nil and #logs == 0)

-- the brush tint and the sparkles, written again by the game: the check puts them back
w.sym.Brush.TintColor = { SpecifiedColor = { R = 0.5, G = 0.6, B = 0.7, A = 1 }, ColorUseRule = 0 }
w.top.ColorAndOpacity = { R = 1, G = 1, B = 1, A = 1 }
w.top.Brush.TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 0.4 }, ColorUseRule = 0 }
w.spark.vis = 4
before = writes
Step(M, ctx, 1.2)
check("the game put a tint back: it is see-through again with its colour, the sparkle is collapsed again, the colour check writes its own",
    writes == before + 4 and w.sym.Brush.TintColor.SpecifiedColor.A == 0 and w.sym.Brush.TintColor.SpecifiedColor.R == 0.5 and w.sym.Brush.TintColor.ColorUseRule == 0
    and w.sym.ColorAndOpacity.A == 0 and w.sym.wrote == 3 and w.top.Brush.TintColor.SpecifiedColor.A == 0 and w.top.ColorAndOpacity.A == 0 and w.spark.vis == 1)
before = writes
Step(M, ctx, 1.2)
check("and then nothing more: no write while the tint and the sparkle are as set", writes == before)
w.top.Brush.TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 0.005 }, ColorUseRule = 0 }
before = writes
Step(M, ctx, 1.2)
check("a tint that is already almost see-through is left", writes == before)

-- a row that the game makes new for a notice comes from the master copy: no timed walk, no font look when nothing waits
w.qRoot.kids[#w.qRoot.kids + 1] = Nested("Row_2", "WBP_QuestAndUnlocks_Item_Slot_C", Box("RowRoot", "Overlay", { Img("CommonLazyImage_83", 10, 10, "CommonLazyImage"), Txt("SlotText") }))
before, fontCalls = writes, 0
Step(M, ctx, 2.1) Step(M, ctx, 2.1)
check("no timed walk of the perk entry, and no font read", writes == before and fontCalls == 0)

-- the tip: the game sets its own picture and colour when it shows a tip
check("the tip is collapsed at rest, and nothing writes its visibility", w.tip.vis == 1 and violations == 0)
local titleWrites = w.tipTitle.wrote
w.tipBand.Brush.ResourceObject = Tex("T_FTUE_Notification_Bg_V2")
w.tipBand.Brush.UVRegion.bIsValid = 0
w.tipTitle.DefaultColorAndOpacity = { SpecifiedColor = { R = {}, G = {}, B = {}, A = {} }, ColorUseRule = 0 }
w.tip.vis = 4
w.barBox.height = 5
local watches = #M.Watch
Step(M, ctx, 0.6)
check("a tip shown: the band, the gold title and the see-through shadow come again",
    w.tipBand.Brush.ResourceObject == w.texBg and IsBand(w.tipBand.lastBrush) and IsGold(w.tipTitle.DefaultColorAndOpacity.SpecifiedColor) and w.tipTitle.wrote == titleWrites + 1)
check("and no check is added twice, the entry's visibility is not written", #M.Watch == watches and violations == 0)
check("a tip shown: the progress line is 2 high again", w.barBox.height == 2)
check("and its slot is not written again while it holds 0", w.barSlot.sets == 1)
w.barSlot.Padding = { Left = 0, Top = 0, Right = 0, Bottom = -3 }
w.tip.vis = 1
Step(M, ctx, 0.6)
w.tip.vis = 4
Step(M, ctx, 0.6)
check("a second show: the game's -3 is put back to 0 (a written value, not an added one)", w.barSlot.Padding.Bottom == 0 and w.barSlot.sets == 2)
w.tip.vis = 1
Step(M, ctx, 0.6)
w.tip.vis = 4
Step(M, ctx, 0.6) Step(M, ctx, 0.6)
check("a tip that stays shown is not styled again", w.tipTitle.wrote == titleWrites + 1)
w.tip.vis = 1
Step(M, ctx, 0.6)
w.tipTitle.DefaultColorAndOpacity = { SpecifiedColor = { R = {}, G = {}, B = {}, A = {} }, ColorUseRule = 0 }
w.tip.vis = 4
Step(M, ctx, 0.6)
check("a tip shown a second time gets the look again", w.tipTitle.wrote == titleWrites + 2)
w.tipBand.Brush.ResourceObject = Tex("T_FTUE_Notification_Bg_V2")
before = writes
Step(M, ctx, 0.3)
check("the check waits for its second", writes == before)
Step(M, ctx, 1.1)
check("a band that the game replaced is put back by the check", w.tipBand.Brush.ResourceObject == w.texBg and w.tipTitle.wrote == titleWrites + 2)

-- a name that a freed slot now holds for another object: the check writes nothing to it
w.fx.id = "another"
w.fx.ColorAndOpacity = { R = 1, G = 1, B = 1, A = 1 }
before = writes
Step(M, ctx, 1.2)
check("the full name differs: the check does not write, and drops the widget", writes == before and w.fx.ColorAndOpacity.A == 1)

-- the font comes later
M, ctx = Fresh()
fontOn = false
Step(M, ctx)
w = current
check("no font yet: the colours and the band are done, the texts wait", IsGold(w.name.ColorAndOpacity.SpecifiedColor) and IsBand(w.tipBand.lastBrush) and w.started.fontSet == nil and w.upLabel.fontSet == nil
    and w.panel.lastBrush.ImageSize.X == 600)
fontOn = true
Step(M, ctx, 1.1)
check("the font is there: the texts get it, the rest is not written again", w.started.fontSet == fontObj and w.upLabel.fontSet == fontObj
    and w.name.wrote == 1 and w.panel.wrote == 2 and #w.upRoot.kids == 6)

-- a font that comes late: the entries are walked more slowly, never given up
M, ctx = Fresh()
fontOn = false
for _ = 1, 25 do Step(M, ctx, 1.1) end
w = current
check("the font is late: one log line each for the entries that wait, the texts still wait", Count("is not fully styled yet") == 3 and w.started.fontSet == nil)
fontOn = true
Step(M, ctx, 5.1)
check("the font comes after 25 seconds: the texts get it", w.started.fontSet == fontObj and w.upLabel.fontSet == fontObj)

-- the band's picture comes from the new area banner, which can be found later than the others
M, ctx = Fresh({ noPrimary = true })
Step(M, ctx)
w = current
check("without the banner: the tip has its gold, no band; the upkeep no band, no lines", IsGold(w.tipIcon.ColorAndOpacity) and w.tipBand.wrote == nil and w.upBg.wrote == nil and #w.upRoot.kids == 4 and #w.stRoot.kids == 2
    and #w.ring.WidgetTree.RootWidget.kids == 4 and w.upLabel.fontSet == fontObj)
w.entries[PRIMARY] = { w.primary }
Step(M, ctx, 1.1)
check("with the banner: the bands and the lines follow, once", IsBand(w.tipBand.lastBrush) and IsBand(w.upBg.lastBrush) and IsBand(w.stBg.lastBrush) and #w.upRoot.kids == 6 and #w.stRoot.kids == 4 and #made == 4
    and w.tipBand.wrote == 2)

-- the perk flag off
M, ctx = Fresh()
M.PerkLook = false
Step(M, ctx)
w = current
check("perk flag off: the entry is left as the game has it", w.q[1].wrote == nil and w.qBorder.wrote == nil and w.qTitle.wrote == nil and w.rowBand.wrote == nil and w.rowText.wrote == nil and w.master.wrote == nil)
check("perk flag off: the other notices have their look", IsGold(w.name.ColorAndOpacity.SpecifiedColor) and IsBand(w.tipBand.lastBrush))

-- a missing page and a missing part do not stop the rest
M, ctx = Fresh({ noVendor = true, noPanel = true })
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
check("a missing page: logged once, the other pages and entries styled", Count("page LevelUpVendorNotificationItem not found") == 1 and IsGold(w.name.ColorAndOpacity.SpecifiedColor)
    and w.skillA.fontSet == fontObj and w.fish.fontSet == fontObj and IsBand(w.tipBand.lastBrush))
check("a missing part: the page's other parts are styled", w.started.fontSet == fontObj and w.timer.fontSet == fontObj)
check("a missing entry class is not an error", #logs == 1)
M, ctx = Fresh()
current.entries.WBP_PlayerUpkeepNotification_Item_C, current.entries.WBP_EnvAndPlayerStatus_Item_C = nil, nil
Step(M, ctx)
check("no upkeep and no status entry: the rest is styled", IsBand(current.tipBand.lastBrush) and #logs == 0)

-- the band in a box that is not an Overlay
M, ctx = Fresh({ statusParent = "HorizontalBox" })
Step(M, ctx) Step(M, ctx, 1.2)
w = current
check("a band not in an Overlay: no lines, one log line, the rest of the status is done", #w.stRoot.kids == 2 and Count("HorizontalBox") == 1 and #logs == 1 and IsBand(w.stBg.lastBrush)
    and w.stText.fontSet == fontObj and #made == 2)

-- the ring's picture: missing, or not taken by the engine
M, ctx = Fresh()
missingArt = "upkeep_back"
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
check("the ring's picture is missing: the game keeps its ring, one log line for the picture and one for the ring, the lines of both notices and the rest are done", #w.stRoot.kids == 4 and #made == 4 and Count("picture missing") == 1 and #logs == 2
    and Count("upkeep_back.png") == 1 and Count("keeps the game's ring") == 1 and IsGold(w.stRoot.kids[3].ColorAndOpacity) and #w.ring.WidgetTree.RootWidget.kids == 3 and w.arc.vis == nil)
M, ctx = Fresh()
importFails = true
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
check("the engine does not take the ring's picture: one log line for it and one for the ring, the lines and the rest done", #w.stRoot.kids == 4 and #made == 4 and Count("picture not loaded") == 1 and #logs == 2
    and IsBand(w.stBg.lastBrush) and w.stText.fontSet == fontObj)

-- the sparkles and the strip of the new skill banner
M, ctx = Fresh()
M.Sparkles = false
M.NewSkillStrip = "UnlockStrip"
Step(M, ctx)
w = current
w.spark.vis = 4
Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("sparkles flag off: the Niagara widget is left as the game has it, also when the game shows it", w.spark.vis == 4 and w.spark.wrote == nil)
check("strip name set: the strip is see-through", w.strip.ColorAndOpacity.A == 0 and w.skillA.fontSet == fontObj)

-- a respawn keeps the look; a new world drops everything without a call on the old widgets
M, ctx = Fresh()
Step(M, ctx)
local old = current
before = writes
M.Forget(true)
Step(M, ctx, 1.2) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("a respawn: the look is kept, nothing is written again", writes == before and #old.upRoot.kids == 6)
for _, o in ipairs(all) do o.gone = true end
M.Forget(false)
check("a new world: every handle is dropped at once", #M.Watch == 0 and next(M.Done) == nil and next(M.Src) == nil and next(M.Scopes) == nil)
current = World()
writes = 0
Step(M, ctx, 1.2)
check("a new world: no call on an old widget", deadCalls == 0)
check("a new world: the new entries are styled", IsGold(current.name.ColorAndOpacity.SpecifiedColor) and IsBand(current.tipBand.lastBrush) and current.started.fontSet == fontObj and #current.upRoot.kids == 6)
before = writes
Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("a new world: its entries are styled once", writes == before and deadCalls == 0)

-- colours whose fields are not numbers: gold or see-through is written once, no arithmetic, no log, no watch
M, ctx = Fresh({ oddColours = true })
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
check("odd colours: the title is gold by its default colour, the FX image see-through, the move skipped",
    IsGold(w.tipTitle.DefaultColorAndOpacity.SpecifiedColor) and w.tipTitle.wrote == 1 and w.fx.ColorAndOpacity.A == 0 and w.fx.wrote == 2 and w.fx.Brush.TintColor.SpecifiedColor.A == 0 and w.power.wrote == nil)
check("odd colours: one log line, for the move, and the rest is styled", #logs == 1 and Count("PowerLevelDisplay not moved") == 1 and IsGold(w.name.ColorAndOpacity.SpecifiedColor) and IsBand(w.tipBand.lastBrush))
before = writes
w.fx.ColorAndOpacity = { R = {}, G = {}, B = {}, A = {} }
w.fx.Brush.TintColor = { SpecifiedColor = { R = {}, G = {}, B = {}, A = {} }, ColorUseRule = 0 }
Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("odd colours: they are not watched, the tint included", writes == before)

-- an entry that runs its steps again on each show must not hold a step that adds up or makes a widget (Move, Lines)
local function HoldsOnce(E)
    local function Has(steps) for _, step in ipairs(steps or {}) do if Style.Once[step] then return true end end return false end
    for _, steps in pairs(E.Parts) do if Has(steps) then return true end end
    return Has(E.Texts) or Has(E.Sparks)
end
M, ctx = Fresh()
Step(M, ctx)
local held = false
for _, E in ipairs(M.Recipes) do if E.OnShow and HoldsOnce(E) then held = true end end
check("the recipes: no entry that runs again on each show holds Move or Lines", not held and Count("must run once") == 0)
check("the steps Move and Lines are marked, also inside Only", Style.Once[Style.Lines] and Style.Once[Style.Only(nil, Style.Lines)] and Style.StatusLines == nil and Style.LinesAndDiamond == nil and not Style.Once[Style.Unseen] and not Style.Once[Style.Collapse] and Style.Once[Style.Move(1, 1)] and Style.Once[Style.Only(nil, Style.Lines)] and not Style.Once[Style.Band()])
M, ctx = Fresh()
ctx.Style = setmetatable({ Band = function() return Style.Move(5, 5) end }, { __index = Style })
Step(M, ctx)
w = current
w.tip.vis = 4
Step(M, ctx)
w.tip.vis = 1
Step(M, ctx)
w.tip.vis = 4
Step(M, ctx)
check("a Move in a recipe that runs on each show: refused, the tip's band is not moved, one log line for it", w.tipBand.wrote == nil and Count("each show of WBP_TutorialNotifications_Item_C") == 1 and Count("must run once") == 1)

-- the pages of such an entry are cleaned of those steps too
M, ctx = Fresh()
local entry = { Class = "PagedEntry", OnShow = true, Parts = {}, Pages = {
    One = { Parts = { A = { Style.Move(1, 1), Style.Band(), Style.Lines, Style.Unseen } }, Texts = { Style.Move(2, 2) }, Sparks = { Style.Move(3, 3) } },
    Two = { Parts = {}, Sparks = false } } }
M.Refuse(ctx, Style, entry)
check("an entry that runs again on each show: its pages lose the steps that must run once (Lines too), one log line", #entry.Pages.One.Parts.A == 2
    and #entry.Pages.One.Texts == 0 and #entry.Pages.One.Sparks == 0 and entry.Pages.Two.Sparks == false and Count("must run once") == 1)

-- without a name maker in ctx the lines get a name of their own
M, ctx = Fresh()
ctx.Uniq = nil
Step(M, ctx)
check("no name maker: the four lines images still get names, each its own", #made == 4 and made[1].name:find("RU_NoticeLinesTop", 1, true) == 1 and made[2].name:find("RU_NoticeLinesBottom", 1, true) == 1
    and made[3].name:find("RU_NoticeLinesTop", 1, true) == 1 and made[4].name:find("RU_NoticeLinesBottom", 1, true) == 1
    and made[1].name ~= made[3].name and made[2].name ~= made[4].name and made[1].name ~= made[2].name)

-- the new area banner's shadow: not found, one log line with the images seen, nothing else written
M, ctx = Fresh({ noShadow = true })
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
w = current
check("no shadow part: one log line that names it and lists the images of that page, the other parts are styled",
    Count("part ShadowImage not found in AchievementNotificationItem") == 1 and Count("images seen: ") == 1 and #logs == 1
    and logs[1]:find("FXImage, SymbolImage, TopTextureImage", 1, true) ~= nil and logs[1]:find("BgImage", 1, true) ~= nil and w.fx.ColorAndOpacity.A == 0 and IsGold(w.name.ColorAndOpacity.SpecifiedColor))

-- a page whose tree is not there yet: no "not found" line and no spent key, the entry is walked again; the part really missing is logged once then
M, ctx = Fresh({ noShadow = true })
local area = current.primary.WidgetTree.RootWidget.kids[1]
local areaRoot = area.WidgetTree.RootWidget
area.WidgetTree.RootWidget = nil
Step(M, ctx) Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("a page with no tree yet: no log line", Count("not found") == 0 and #logs == 0 and current.vName.fontSet == fontObj)
area.WidgetTree.RootWidget = areaRoot
Step(M, ctx, 1.2) Step(M, ctx, 1.2)
check("the tree comes: the missing part is logged once, the page is styled", Count("part ShadowImage not found in AchievementNotificationItem") == 1 and #logs == 1 and current.fx.ColorAndOpacity.A == 0)

-- the picture is decoded once for all the notices; a picture that is freed or whose slot holds another object is decoded again
M, ctx = Fresh()
Step(M, ctx)
w = current
check("the first ring decodes its three pictures", imports == 3)
local function Back() for i = #ringMade, 1, -1 do if ringMade[i].name:find("Back$") then return ringMade[i] end end end
local function MoreRing()
    local ring = Nested("SegmentedRadialBar", "WBP_Ring_C", Box("RingRoot", "Overlay", { Img("Background", 68, 68), Img("RadialImage"), Img("Icon") }))
    local root = Box("UpRoot", "Overlay", { Img("Background", 775, 57), Img("RadialGlow"), ring, Txt("LabelText") })
    table.insert(current.entries.WBP_PlayerUpkeepNotification_Item_C, Entry("WBP_PlayerUpkeepNotification_Item_C", root))
    Step(M, ctx, 1.2)
    return Back()
end
local second = MoreRing()
check("a second ring has its pictures from the same decode", second.Brush.ResourceObject == artTex and imports == 3)
artTex.id = "reused slot"
local third = MoreRing()
check("the pictures' slot holds another object now: the pictures are decoded again", imports == 6 and third.Brush.ResourceObject == artTex)
local before_tex = artTex
artTex.gone = true
local fourth = MoreRing()
check("the engine freed the pictures: they are decoded again, the new texture is on the brush", imports == 9 and artTex ~= before_tex and fourth.Brush.ResourceObject == artTex)

-- no picture loader in ctx (an old main.lua): one log line, no picture added, the rest is done
M, ctx = Fresh()
ctx.CachedTex = nil
Step(M, ctx) Step(M, ctx, 1.2)
w = current
check("no picture loader: the game keeps its ring, one log line for the loader and one for the ring, the lines and the band are done", #w.stRoot.kids == 4 and w.ringBack.Brush.ResourceObject ~= artTex and Count("no picture loader") == 1 and #logs == 2
    and #made == 4 and IsBand(w.stBg.lastBrush) and IsGold(w.stRoot.kids[3].ColorAndOpacity))

-- no style file: logged once, no error
M, ctx = Fresh()
ctx.Style = nil
Step(M, ctx) Step(M, ctx)
check("no style file: one log line, nothing written", Count("no style file") == 1 and writes == 0)

-- the tip's progress line: a slot that is gone waits, a padding that is not a number is logged once and left, the band and the gold are done
M, ctx = Fresh()
local gone = current.barSlot
gone.gone = true
Step(M, ctx) Step(M, ctx, 0.6)
check("a slot that is not valid: no call on it, no log line, the rest of the tip is done", gone.sets == 0 and #logs == 0 and current.barBox.height == 2 and IsBand(current.tipBand.lastBrush))
gone.gone = nil
Step(M, ctx, 1.2)
check("the slot is valid at a later walk: hung", gone.Padding.Bottom == 0 and gone.sets == 1)
M, ctx = Fresh()
current.barSlot.Padding = { Left = {}, Top = {}, Right = {}, Bottom = {} }
Step(M, ctx) Step(M, ctx, 0.6)
check("a padding that is not numbers: left alone, one log line, the gold line is done", current.barSlot.sets == 0 and Count("ProgressBarSizeBox not hung under its band") == 1 and #logs == 1 and IsGold(current.bar.FillColorAndOpacity))

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(read('noticelook.lua'))); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(read('noticestyle.lua'))); lua.lua_setglobal(L, to_luastring('STYLETEXT'));
lua.lua_pushstring(L, to_luastring(read('noticeread.lua'))); lua.lua_setglobal(L, to_luastring('READTEXT'));
lua.lua_pushstring(L, to_luastring(read('noticering.lua'))); lua.lua_setglobal(L, to_luastring('RINGTEXT'));
lua.lua_pushstring(L, to_luastring(read('survival.lua'))); lua.lua_setglobal(L, to_luastring('SURVTEXT'));
lua.lua_pushstring(L, to_luastring(read('main.lua'))); lua.lua_setglobal(L, to_luastring('MAINTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);

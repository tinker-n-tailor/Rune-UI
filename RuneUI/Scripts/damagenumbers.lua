-- Damage numbers: the Rune Skin switch "Damage numbers" (elements.lua "dmgnumbers", on at first). Off hides every damage
-- number over an enemy and the word "Critical". "Combat text" can be on or off, the result is the same.
-- The status words (Poison, Burn, Bleed, Slowed, Immune) are WBP_FloatingText_C, a second pool: this file never touches it.
-- combattext.lua stops all its work while "Combat text" is off, so the hiding cannot live there. This is its own part.
-- The game keeps a pool of WBP_FloatingDamage_C, made once and used for every hit. The pool may grow.
-- One widget shows the number in FloatieOverlay and the word "Critical" in CriticalTextOverlay.
-- Hidden is render opacity 0 on those two overlays. The render scale is not used: the pop of combattext.lua writes it.
-- The game plays an animation on each hit, and an animation can write the property we write. So a widget that plays an
-- animation gets its opacity 0 again on every step of the main loop (about 16 steps a second, 16 calls in a calm world).
-- The rest of the pool is looked at once a second: a widget the game made since is hidden within that second.
-- The opacities before the first write are kept (Seen, by the widget's name and address), so On gives them back.
-- A new world or a player restart drops the handles but not Seen: the widgets belong to the game instance and may stay.
-- The resource numbers are WBP_FloatingText_C too (combattext.lua, vault notes of 04-10-2026), so Off leaves them.
-- main.lua loads this file with pcall and runs its Tick.

local M = {}

local CLASS = "WBP_FloatingDamage_C"
local PARTS = { "FloatieOverlay", "CriticalTextOverlay" }
local EVERY = 1   -- seconds between two looks at the pool

local function Alive(o) return o and o:IsValid() end   -- a property or a call can give a wrapper of null: pcall does not catch it

-- A part of a widget by its name. FloatieOverlay is in the widget's tree but is not a variable of it (seen in the game,
-- 03-11-2026): it is reached as the parent of its text, FloatiesText, which is one.
local function Part(W, name)
    local part = W[name]
    if Alive(part) then return part end
    if name == "FloatieOverlay" then
        local text = W.FloatiesText
        part = Alive(text) and text:GetParent()
        if Alive(part) then return part end
    end
end

-- Seen: name of a widget -> { Addr = its address, <part name> = its opacity before our first write }. Kept over a world change.
-- Pool: name -> { W, Key, Parts, Names }, List: the same in order. Was: the switch at the last Tick, so a change is looked at at once.
local S
local function Fresh(keep) return { Seen = keep and keep.Seen or {}, Pool = {}, List = {}, Next = 0 } end
S = Fresh()

-- The opacities a widget had before we wrote, by its name and its address. A record for another object under the same
-- name is dropped.
local function Record(key, W)
    local seen = S.Seen[key]
    if seen and seen.Addr ~= W:GetAddress() then seen = nil S.Seen[key] = nil end
    return seen
end

-- A part that reads 0 holds what we wrote, whose record was lost: the game's own opacity is 1, so it is not taken as one.
local function Original(part) local o = part:GetRenderOpacity() return o > 0 and o or 1 end

-- Opacity 0 on the parts, only where it is not 0 already: the game may have written it since.
local function Hold(e)
    for _, part in ipairs(e.Parts) do
        if Alive(part) and part:GetRenderOpacity() ~= 0 then part:SetRenderOpacity(0) end
    end
end

-- Once for each pooled widget: its parts, their opacities kept, then hidden. A widget that has neither part is an error.
local function Hide(e)
    local parts, names = {}, {}
    for _, name in ipairs(PARTS) do
        local part = Part(e.W, name)
        if part then parts[#parts + 1] = part names[#names + 1] = name end
    end
    if #parts == 0 then error("no " .. table.concat(PARTS, " or ") .. " in " .. e.Key) end
    if not Record(e.Key, e.W) then
        local rec = { Addr = e.W:GetAddress() }
        for i, part in ipairs(parts) do rec[names[i]] = Original(part) end
        S.Seen[e.Key] = rec
    end
    e.Parts, e.Names = parts, table.concat(names, " and ")
    Hold(e)
end

local function Look(ctx)
    local list, keys = ctx.Find(CLASS)
    local kept, order = {}, {}
    for i, W in ipairs(list) do
        local key = keys[i]
        local e = S.Pool[key]
        -- the same name can come back on another widget (a freed slot): it is the same widget only at the same address
        if e and not (Alive(e.W) and e.W:GetAddress() == W:GetAddress()) then e = nil end
        if not e then e = { W = W, Key = key } end
        kept[key] = e
        order[#order + 1] = e
        if e.Parts then
            Hold(e)
        elseif not e.Bad then
            local ok, err = pcall(Hide, e)
            if not ok then
                e.Bad = true   -- once for this widget: the log must not fill with the same line every second
                ctx.Log("damage numbers: a " .. CLASS .. " not hidden: " .. tostring(err))
            end
        end
    end
    S.Pool, S.List = kept, order
    if #order > 0 then for key in pairs(S.Seen) do if not kept[key] then S.Seen[key] = nil end end end
    if not S.Logged then
        for _, e in ipairs(order) do
            if e.Parts then
                S.Logged = true
                ctx.Log("damage numbers: " .. #order .. " numbers watched, hidden in " .. e.Names)
                break
            end
        end
    end
end

-- On: every widget that has a record gets its opacities back, and the record goes. A record whose widget is not found
-- stays and is looked for again once a second, but only while the pool is empty: when the pool is there and the widget
-- is not, the widget is gone and so is its record.
local function Restore(ctx)
    local list, keys = ctx.Find(CLASS)
    local found = {}
    for i, W in ipairs(list) do
        local key = keys[i]
        if Alive(W) then
            found[key] = true
            pcall(function()
                local seen = Record(key, W)
                if not seen then return end
                for _, name in ipairs(PARTS) do
                    local part = Part(W, name)
                    if part and seen[name] then part:SetRenderOpacity(seen[name]) end
                end
            end)
            S.Seen[key] = nil   -- one try: a restore that failed must not search again every second
        end
    end
    if #list > 0 then for key in pairs(S.Seen) do if not found[key] then S.Seen[key] = nil end end end
    if not next(S.Seen) then
        ctx.Log("damage numbers: on, the numbers are back")
        S = Fresh(S)
    end
end

function M.Tick(ctx)
    local now = os.clock()
    local shown = ctx.On()
    -- a change of the switch is looked at now; the next Off takes every record again, as the last On may have dropped some
    if shown ~= S.Was then S.Was, S.Next, S.Pool, S.List = shown, 0, {}, {} end
    if shown then
        -- nothing of ours to take back in a calm round: no search
        if next(S.Seen) and now >= S.Next then
            S.Next = now + EVERY
            Restore(ctx)
        end
        return
    end
    if now >= S.Next then
        S.Next = now + EVERY
        local ok, err = pcall(Look, ctx)
        if not ok and not S.Failed then S.Failed = true ctx.Log("damage numbers: failed: " .. tostring(err)) end
    end
    -- one call for each number, no closure: a handle that went invalid since the last look is skipped
    for _, e in ipairs(S.List) do
        local W = e.W
        if e.Parts and Alive(W) and W:IsAnyAnimationPlaying() then pcall(Hold, e) end
    end
end

-- A new world or a player restart: every handle is dropped. The records stay (Record), as the widgets may stay.
function M.Forget() S = Fresh(S) end

return M

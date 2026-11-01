# OG cards design

## Why

Shared survev links all show the same static preview. Player profiles, leaderboards and team invites should each show a card with their own live data, so a pasted link says what it is and looks like the game.

## Approved look

The renders in `/home/dev/code/survev-og-spike/out9` are the visual reference, and `gen9.tsx` there is their source. The user approved `r-desert.png`, `b-desert.png`, `p-cobalt.png` and `r-duo.png`: "this is exactly what i want. for all of them."

All cards are 1200x630 PNGs in the same layout:

- **Vivid side fade:** map splash art is sharp on the right. Going left it melts into a blurred, saturated copy (`blur(34px) brightness(.72) saturate(1.8)`) under a wash of that map's dark tint. The gradients are the `V == "c"` branch of `side()` in `gen9.tsx`.
- **Left column:** title, subtitle and content on the blurred side.
- **Right corners:** map name top right when a map applies, `SURVEV.IO / stats` (or `/ invite`) bottom right over a dark corner scrim.
- **Type:** Phantom Guardians. Names shrink to fit rather than clip. Accent is `#ffdb00`.

Cards:

- **Player:** emote icon, name, interval; large kills; wins, KPG and games.
- **Leaderboard:** stat title, `MODE · INTERVAL`; #1 larger in yellow, then #2–5 with hairline rows. Team-mode rows join names with ` + `.
- **Team (Roster):** `JOIN <leader>`, `MODE · REGION`; one row per slot where the leaderboard's rows sit, with a sprite or dashed circle; the first open slot says `YOU?` in yellow, others `OPEN`; `survev.io/t/<code>` bottom left. A full room drops `JOIN` and adds `· FULL` to the subtitle.

## Behaviour

- **Filters are props.** Cards follow the same URL params as the stats pages: leaderboard `type`, `team`, `t`, `mapId`; player `slug`, `time`, `mapId`. Invalid values fall back to the page defaults (`most_kills`, `solo`, `daily`, map `0`; `alltime`, all maps).
- **Team links move off the hash.** Hashes never reach a server, so the share link becomes `survev.io/t/<code>`. Old `/#<code>` links keep working.
- **Tags are server-rendered.** Crawlers don't run JS, so the API serves the page HTML with per-link `og:*` and `twitter:*` tags.
- **Unknown or dead data gets a generic card.** Missing player, banned player, empty leaderboard, dead room: never an error image.

## Non-goals

- Translated card text (English only for now).
- Match or game-result cards.
- New art capture. Maps without a splash use the fallback table; better art can replace it later.

## Anti-goals

Hard-edged art strips, a black slab beside a screenshot, sprite-built scenes, and in-match HUD panels were all shown and rejected.

## Constraints

- Settings are env vars, no config files.
- Domain constants have one source; import rather than re-type them.
- No browser, no runtime network fetches for fonts.

## Builder's calls (not user decisions)

- `/t/<code>` over a query param, with the address bar returning to `/#<code>` after load so existing hash logic stays untouched.
- Native Takumi backend, not WASM.
- Fallback art: Potato uses `potato_spring`; 50v50 Potato uses `faction`; Woods, Savannah, Beach and Birthday use `main_spring` with their own tint and map name.
- Bundled fallback fonts: Noto Sans (Latin, Cyrillic, Greek, Vietnamese), JP, KR, SC, Thai, Arabic.

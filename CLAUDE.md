# Rules for any Claude window working on this repo (PlayCraft)

Several Claude windows (local and cloud) change these games. Two people give instructions. Follow these rules so nobody's work is lost.

## 1. One inbox per game: Admin → Game requests
- Every change to a published game is a **request** in the Admin page's "Game requests" list (Supabase table `game_requests`).
- Before you change a game, read its open requests. When you finish, mark each one `done` with a one-line result (or `declined` with why).
- If someone asks you for a change directly in chat, write it down as a request first (`add`), then do it.
- Each game has **one owner window** (shown as "Looked after by" in Admin). If you are not the owner, do not edit that game: add a request and tell the user.

With the worker key (local Mac: `~/projects/seonjun-games/.secrets/worker_key`, or env `PLAYCRAFT_WORKER_KEY`):
```
python3 ~/projects/seonjun-games/tools/requests.py list <slug>
python3 ~/projects/seonjun-games/tools/requests.py start <id> --by "<your window name>"
python3 ~/projects/seonjun-games/tools/requests.py done <id> "what changed" --by "<your window name>"
python3 ~/projects/seonjun-games/tools/requests.py add <slug> "request text" --author luke|hugo
```
No key (for example a cloud window)? Ask the user to paste the open requests from Admin, and at the end tell them which ones to mark done and the one-line results. Never ask for the key in chat, and never print it.

## 2. Always start from the live file
- `git pull --rebase` first. Change `games/<slug>/index.html` **as it is in the repo now**.
- Never rebuild a game from your own older copy, an artifact or a local source; if you keep a source, first bring the live file's changes into it.
- Check `git log -3 -- games/<slug>` right before you push; if someone else pushed in between, merge their change, do not overwrite it.

## 3. Publishing
- Bump the game's `version` in `games.json` (a whole number, used to load fresh files) **and** its `ver` (what players see, like `1.7`): a normal update adds 0.1 (`1.7` → `1.8`, `1.9` → `1.10`), a big update goes to the next whole number (`1.8` → `2.0`). Then set `"updated": "YYYY-MM-DD"` and a short `notes`. `notes` is shown to kids on the home page ("What's new"): one short, friendly sentence a kid understands (no word lists, dates or technical details).
- Players see **nicknames**, never sign-in IDs: leaderboards use `data.nick` (the server adds it to every `rank` row), ideas show `nickname`.
- After changing `preview/app.css|app.js|account.js|index.html`, run `./stamp.sh`. It also rebuilds the top `index.html` (the site opens straight at zanycade.com/ from it): never edit the top `index.html` by hand.
- `git add` files by name (not `-A`; there is an untracked workflow file).

## 4. Privacy and rights (this repo is public)
- No real names of children or family in files, commit messages or game text. Use account names (hugo, luke) only.
- No patient or personal data.
- No real brands, leagues, clubs, players or test names as game content; no text copied from textbooks or prep books. Write definitions and examples fresh. Never invent meanings.

## 5. Study Arcade starter decks
- `games/study-arcade/decks.js` is made by `python3 ~/projects/seonjun-games/tools/study_decks/build.py` (Mac Studio): every Word League word, and Math Space War questions by grade. After Word League's words change, re-run it and push `decks.js` with the change (no key? tell the user it needs re-running).

# Zane — setup steps (about 15 minutes)

Do these in order whenever you're back at the computer. Nothing here needs to be pasted into chat.

## 1. Cloudflare: the web address (do this FIRST — the security certificate can take a few hours)

1. Log in to Cloudflare → **zanesorenson.com** → **DNS** → **Records** → **Add record**.
2. Type **CNAME** · Name **`kodiak`** · Target **`zsoren.github.io`**.
3. Make sure the cloud icon is **grey ("DNS only")**, not orange. (Same as `h2c`. With the orange proxy on, GitHub can't issue the HTTPS certificate.)
4. **Save**, then tell me "Cloudflare done" — I'll point GitHub at kodiak.zanesorenson.com and turn on HTTPS.

## 2. Firebase: the shared database (same steps as H2C, new project)

1. Go to https://console.firebase.google.com → **Create a project**.
   - Name: `kodiak-tracker`. Turn **off** Google Analytics. Create.
2. Left menu → **Build → Firestore Database** → **Create database**.
   - Location: **us-west1 (Oregon)** (or whatever US option it offers).
   - **Start in production mode**. Create.
3. Firestore → **Rules** tab → delete everything there → paste the entire contents of [`firebase/firestore.rules`](../firebase/firestore.rules) → **Publish**.
4. **Gear (Project settings) → General → Your apps → `</>` (Web)**.
   - Nickname `kodiak`. Leave "Firebase Hosting" unchecked. **Register app**.
   - Copy the whole `const firebaseConfig = { … };` block it shows.

## 3. GitHub: hand the Firebase config to the build

1. Open https://github.com/Zsoren/kodiak-tracker-3f98/settings/secrets/actions
2. **New repository secret** → Name: `VITE_FIREBASE_CONFIG` → Secret: paste the block → **Add secret**.
3. Tell me "Firebase secret added" — I'll rebuild, connect sharing, and run the live two-phone test.

(The config is the kind of key that ships inside every website anyway; the Firestore rules you published are what protect the data. It never appears in a chat or terminal.)

## 4. Check the course table (5 min)

Open [`docs/COURSE-CHECK.md`](COURSE-CHECK.md) and confirm every station, mile, cut-off and crew note. Wrong cut-offs are worse than no app — tell me anything that's off.

## 5. Phone check with me (after steps 1–3)

- **iPhone:** open **https://kodiak.zanesorenson.com** in **Safari** → **Share ⬆** → **Add to Home Screen** → open it from the icon, then pick "I'm running" → Zane.
- **Android:** open it in **Chrome** → **⋮** → **Install app**.
- Try typing a time on the Plans screen (digits only, e.g. `1030`) and tell me it works on your keyboard.
- Try **Ask crew → Also send as text** — it should open Messages with the text filled in.

## Friday night checklist (everyone)

- Open the app on Wi-Fi; check **More → Version** matches what Zane announces.
- It says **✓ Ready offline** (More → Install).
- Runners: **More → crew chief's phone** filled in.
- iPhone runners: **Settings → Messages → Send as SMS** turned **on**.
- Test mode is **off** (no red bar at the top).

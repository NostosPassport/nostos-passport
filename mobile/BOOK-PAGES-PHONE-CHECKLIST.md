# Real-phone checklist: book-page fix

Use `/Users/charlesjinn/nostos-codex` only. Mac and iPhone should be on the same Wi-Fi. Start the isolated backend with `(cd backend && pnpm dev)` on port 3001, then `(cd mobile && npx expo start --go --port 8082)` and scan the QR code in Expo Go. If overriding the API URL, use the Mac's LAN address on port 3001, not the phone's localhost. Do not reset or reseed an existing database just for this checklist.

- [ ] **Backend connection:** sign in, open your passport and load nearby places. Confirm there is no connection error and requests reach the backend on 3001.
- [ ] **Camera:** open Stamp, take a photo inside the app, confirm the preview, remove one and take it again. Capture up to six; a seventh must be blocked. Return to the composer and confirm the photos remain.
- [ ] **Stamp creation:** at a place marked Here, add a caption or song and submit with photos. Confirm the landing, then reopen the passport and confirm the new stamp persists.
- [ ] **Every book page:** use an account with at least four visible stamps. Open the book: inside cover on the left, bearer page on the right. Turn through every spread forwards and backwards, using buttons and edge gestures; check both faces each time. On the final spread, page 2 (and later final right pages for a larger passport) must render. Next must stop at the end.
- [ ] **Open stamps:** tap a stamp on the first stamp page and the fourth stamp on page 2. Each must open the correct stamp with its caption/song/photos; return and repeat from the final spread.
- [ ] **Reduce Motion:** enable Settings > Accessibility > Motion > Reduce Motion on iPhone, relaunch Expo Go, and repeat the first/last-spread and stamp-opening checks. Both faces must remain visible and tappable during the reduced-motion transition.

Record iPhone model, iOS/Expo Go versions, Reduce Motion setting, and pass/fail for each item. Screenshots or a short recording of the first and final spreads help review failures. No device result has been recorded yet.

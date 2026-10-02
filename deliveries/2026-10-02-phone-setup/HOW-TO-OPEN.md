# Open Nostos on your iPhone

The backend and Expo server are running on your Mac now. Keep the Mac awake and connected to Wi-Fi.

1. Install **Expo Go** from the iPhone App Store (SDK 57 compatible version).
2. Put the iPhone on the same Wi-Fi as this Mac. Allow Expo Go **Local Network**, Camera and Location access when prompted.
3. In iPhone Safari, open **http://10.19.108.26:3001/api/health**. You should see `"ok":true` and `"db":"up"`. This proves your phone can reach the backend.
4. Use the iPhone Camera to scan **OPEN-APP-QR.png** displayed on the Mac. Tap the banner to open Expo Go. The app address is **exp://10.19.108.26:8082**. Allow the first load to finish.
5. Sign in with **maya_r@lastcall.dev**, password **lastcall-dev**. This demo account has a populated passport for checking the book pages.
6. For stamp creation away from the seeded places, sign out and use **appreview@lastcall.dev**, password **lastcall-dev**. This test account is exempt from the location restriction. Its new stamps are visible only to itself.

The app is already configured to call **http://10.19.108.26:3001**. You do not need to enter a backend address inside the app.

## Quick phone check

- Open the passport and turn through every page forward and backward. Check the inside cover and the last right page.
- Tap a stamp, including one on the last right page. It should open the correct details.
- On the App Review account, open Stamp, choose a place, capture a photo inside the app, add a caption and save. Reopen the passport and confirm it stays saved.
- Repeat first/last pages and stamp taps with iPhone Settings > Accessibility > Motion > Reduce Motion enabled.

## If it does not connect

If Safari cannot open the health address, the phone is not reaching your Mac. Check that both use the same Wi-Fi, temporarily disconnect a VPN if applicable, and allow Node incoming connections if macOS asks. Guest/work Wi-Fi may block connections between devices; use a Wi-Fi network that permits them.
If health works but Expo does not open, check Expo Go's Local Network permission under iPhone Settings > Apps > Expo Go and retry the QR code. If Expo Go reports an incompatible SDK, record its exact message; this project requires SDK 57.

## Restart later

Only if the servers have stopped, open two Terminal tabs and run these commands:

Backend:
```sh
cd /Users/charlesjinn/nostos-codex
(cd backend && pnpm dev)
```
App:
```sh
cd /Users/charlesjinn/nostos-codex
(cd mobile && EXPO_PUBLIC_API_URL=http://10.19.108.26:3001 npx expo start --go --lan --port 8082)
```
If Docker stopped, start Docker Desktop, then run from the repository root:
```sh
(cd backend && docker compose -p nostos-codex up -d db)
```
Do not reset or reseed the database. The address above is the Mac's current Wi-Fi IP. If it changes, replace it in the Expo command and use the new QR code printed by Expo.

Phone execution is not yet verified; the Mac-side connection and bundle checks passed.

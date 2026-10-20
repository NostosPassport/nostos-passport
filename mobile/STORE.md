# App Store listing: Nostos (working draft)

This is current product copy, but legal/privacy fields remain drafts until final review. Replace every `REPLACE` value before submission.

## Basics

| Field | Value |
|---|---|
| Name | Nostos |
| Subtitle | Passport for places you go |
| Bundle ID | `com.nostospassport.nostos` |
| Primary category | REPLACE after final product decision |
| Secondary category | Travel |
| Age rating | REPLACE after legal/App Store review |
| Price | Free |
| Availability | United States |
| Privacy Policy URL | `https://nostospassport.com/privacy` |
| Terms URL | `https://nostospassport.com/terms` |
| Support URL | `https://nostospassport.com/support` |

## Promotional text

Go somewhere. Make a stamp. Build a personal passport of the places and moments you want to remember, at home or while traveling.

## Description draft

Go somewhere. Get a stamp.

Nostos is a personal passport for the places you go. Visit a restaurant or bar, add the memory, and keep it in your passport.

A stamp can include up to six photos, a caption, a song, or a combination. For a current visit, Nostos can use your location to mark the visit verified when the server confirms you are near the selected place. Location is optional, and you can also add unverified current visits or Past memories.

Your master Passport is personal and private by default. There is no public feed or guest browsing experience. If you want to share, you can create a collection and explicitly enable a revocable, unlisted read-only web link for that collection.

For photos, you can take a new picture with the iPhone camera or choose a photo from your library. Photo Library images are memories attached to the visit and are not treated as proof of location. Images sent to the server are re-encoded so their original EXIF/GPS metadata does not remain in the uploaded file.

## Keywords draft

`passport,stamps,places,travel,trips,restaurants,bars,photos,music,memories`

## Privacy label working notes

These are implementation notes, not final legal answers.

- Email and account identifiers are used for account functionality.
- Precise location is used when the user requests nearby places or submits location for current-visit verification. Raw verification coordinates are not retained on the stamp; the durable trust artifact is verification status/time.
- Nearby restaurant/bar discovery is provided through the backend using Google Places. The location supplied for a nearby request may be sent to Google through the Nostos backend.
- User content includes photos, captions, and attached song metadata.
- Photo Library selections are not rejected based on EXIF/source/time/location/screenshot/editing metadata. The prepared uploaded image is re-encoded and has EXIF/GPS stripped.
- The app may request add access to Photos to save a copy of an accepted camera capture.
- Sentry is optional/off unless configured. If enabled, review the Diagnostics privacy label and processing terms.

## App Review information

- **Sign-in required:** Yes for the current app experience. Authentication is passwordless by email verification code. The old `Look around first` guest preview has been removed.
- **Review access:** REPLACE with a reviewer-accessible passwordless sign-in path before submission. Do not provide or document a password because production accounts do not use passwords.
- **Geofence review behavior:** the designated review account may be configured as geofence-exempt so an Apple reviewer can exercise stamp creation without satisfying the normal proximity check. Its behavior must match the current backend implementation.

Suggested reviewer note:

> Nostos is a personal passport for places you visit. Sign in using the review access instructions, open Stamp, choose a restaurant or bar, then add a photo, caption, song, or combination. The designated review account may be configured so the stamp flow can be exercised without satisfying the normal location-verification check. Take Photo opens the native iPhone camera. Choose from Photo Library attaches an existing memory and does not claim to verify where that photo was taken. Uploaded images are re-encoded and original EXIF/GPS metadata is stripped.

## Before submission

1. Verify production backend/domain deployment and legal-page URLs.
2. Establish and test a reviewer-accessible passwordless sign-in path and designated review account.
3. Resolve the current legal/privacy questions in `../OPEN-QUESTIONS.md`.
4. Confirm App Store privacy labels match actual production configuration, including Google Places data use and diagnostics if enabled.
5. Decide whether App Store availability remains United States-only at launch even though place discovery works worldwide.
6. Set final App Store Connect IDs/metadata in EAS configuration.
7. Run a real-device pass using `DEVICE-CHECKLIST.md`.
8. Capture screenshots from the current Figma/runtime direction, not historical social or black/brass screens.

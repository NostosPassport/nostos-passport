# App Store listing: Nostos (working draft)

This is current product copy, but legal/privacy fields remain drafts until final review. Replace every `REPLACE` value before submission.

## Basics

| Field | Value |
|---|---|
| Name | Nostos |
| Subtitle | A passport for New York |
| Bundle ID | `com.charlesjinn.nostos` |
| Primary category | REPLACE after final product decision |
| Secondary category | Travel |
| Age rating | REPLACE after legal/App Store review |
| Price | Free |
| Availability | United States |
| Privacy Policy URL | `https://nostospassport.com/privacy` |
| Terms URL | `https://nostospassport.com/terms` |
| Support URL | `https://nostospassport.com/support` |

## Promotional text

Go somewhere in New York. Make a stamp. Build a personal passport of the places and moments you want to remember.

## Description draft

Go somewhere. Get a stamp.

Nostos is a personal passport for New York. Visit a place, add the memory, and keep it in your passport.

A stamp can include photos, a caption, a song, or a combination. Nostos checks your location when you stamp so the server can confirm that you are at the place.

Your passport is personal in the current version. There is no public feed or guest browsing experience.

For photos, you can take a new picture with the iPhone camera or choose an eligible photo from your library. Library photos are checked against available metadata so Nostos can verify that they fit the place and time of the stamp. Images sent to the server are re-encoded so their original EXIF/GPS metadata does not remain in the uploaded file.

## Keywords draft

`passport,stamps,nyc,new york,places,travel,photos,music,memories`

## Privacy label working notes

These are implementation notes, not final legal answers.

- Email and account identifiers are used for account functionality.
- Precise location is used to find/verify places. The backend currently retains submitted stamp coordinates as an audit record; see `../OPEN-QUESTIONS.md`.
- User content includes photos, captions, and attached song metadata.
- For a Photo Library selection, the app may read available EXIF/source/time/location metadata locally to validate the selection. The prepared uploaded image is re-encoded and has EXIF/GPS stripped.
- The app may request add access to Photos to save a copy of an accepted camera capture.
- Sentry is optional/off unless configured. If enabled, review the Diagnostics privacy label and processing terms.

## App Review information

- **Sign-in required:** Yes for the current app experience. Authentication is passwordless by email verification code. The old `Look around first` guest preview has been removed.
- **Review access:** REPLACE with a reviewer-accessible passwordless sign-in path before submission. Do not provide or document a password because production accounts do not use passwords.
- **Geofence review behavior:** the designated review account may be configured as geofence-exempt so an Apple reviewer outside New York can exercise stamp creation. Its behavior must match the current backend implementation.

Suggested reviewer note:

> Nostos is a personal passport for places you visit in New York. Sign in using the review access instructions, open Stamp, choose a place, then add a photo, caption, song, or combination. The review account is configured so the stamp flow can be exercised outside New York. Take Photo opens the native iPhone camera. Choose from Photo Library accepts only photos that pass Nostos's local validation for the selected place/time. Uploaded images are re-encoded and original EXIF/GPS metadata is stripped.

## Before submission

1. Verify production backend/domain deployment and legal-page URLs.
2. Establish and test a reviewer-accessible passwordless sign-in path and designated review account.
3. Resolve the current legal/privacy questions in `../OPEN-QUESTIONS.md`.
4. Confirm App Store privacy labels match actual production configuration, including diagnostics if enabled.
5. Set final App Store Connect IDs/metadata in EAS configuration.
6. Run a real-device pass using `DEVICE-CHECKLIST.md`.
7. Capture screenshots from the current Figma/runtime direction, not historical social or black/brass screens.

# Open questions

Only unresolved current questions belong here. Historical questions that depended on the old guest/social UI or obsolete design direction have been removed. Legal questions must be decided by the user and qualified counsel, not by a builder.

## Product

1. **Place catalog coverage.** What place categories and geographic coverage should the launch catalog include, and who may add or correct a place?
2. **Stamp frequency.** Keep the existing cooldown/rate-limit behavior, or move to a different repeat-visit rule such as once per place per day?
3. **Location trust.** Server geofence checks trust the coordinates submitted by the phone. Is stronger anti-spoofing or anomaly detection needed later?
4. **Legacy social data/code.** Social implementation remains behind feature flags while the current product is owner-only. Should that code/data remain available for a future product mode or be removed before launch?
5. **Legacy fields.** Rating/reputation-era fields remain in parts of the schema for compatibility. Decide whether they have a future use or should be removed by a later forward migration.
6. **Unused `expo-camera` dependency.** The current stamp flow launches the native camera with `expo-image-picker`, but `expo-camera` still exists in `mobile/package.json`. Remove it in a dedicated dependency cleanup once the lockfile and Expo config are updated together.

## Legal and privacy

1. **Song metadata.** Stamps can store song title, artist, artwork URL and source metadata from Apple's search API. Confirm licensing, artwork display, attribution, and API-term requirements.
2. **Age gate.** Confirm the current 21+ eligibility policy, wording, data-minimization behavior, and any federal/state requirements.
3. **Stored stamp coordinates.** The backend currently retains the submitted stamp coordinates as an audit record of the geofence check while normal viewer payloads do not expose them. Confirm disclosure, retention period, deletion policy, and whether coordinates should instead be discarded after verification.
4. **Photo Library validation metadata.** When a user selects a library photo, the app may read available EXIF/source/time/location metadata on-device to decide whether the photo is viable for the selected stamp. The prepared upload is re-encoded and has EXIF/GPS stripped. Confirm the privacy copy and App Store privacy answers accurately describe this local processing.
5. **Saving camera captures to Photos.** The app attempts to save accepted native-camera captures to the user's Photos library when add permission is granted. Confirm user-facing disclosure and whether this should remain automatic after capture or become an explicit preference.
6. **Sentry.** Error reporting remains optional/off unless enabled and configured. If enabled, confirm App Store privacy labels, DPA/data region, and final scrubbing configuration.
7. **Privacy Policy and Terms.** Final legal pages must describe the current personal owner-only product, account-required flow, precise-location use, Photo Library validation, account deletion, and any enabled diagnostics. Old social/guest wording must not ship.

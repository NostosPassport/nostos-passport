# Current real-iPhone checklist

These checks cover behavior that unit tests, lint, and bundle export cannot prove. This checklist replaces the old social/guest/custom-camera checklist.

Record the iPhone model, iOS version, app build/Expo Go version, text-size setting, and Reduce Motion setting when doing a formal pass.

## Account and startup

- [ ] Signed out: only Sign in and Create account flows are reachable. There is no `Look around first` guest preview.
- [ ] Sign in and sign up handle slow/offline states without blank screens.
- [ ] Age eligibility behaves as intended at the 21-year boundary.
- [ ] Terms-update flow appears only when the account requires it.

## Navigation

- [ ] Main production tabs are Passport, Stamp, and Map.
- [ ] Stamp center action opens the composer reliably.
- [ ] Settings opens from the current Passport UI.
- [ ] Feed/Activity do not appear in normal personal mode.

## Native camera and photo management

- [ ] In a new stamp, Add Photo offers Take Photo and Choose from Photo Library.
- [ ] Take Photo opens Apple's native camera UI, not a custom Nostos camera preview.
- [ ] Canceling the native camera does not add or remove a draft photo.
- [ ] Accepting a camera photo adds it to the photo list.
- [ ] Camera photos show the Nostos watermark at the intended subtle opacity.
- [ ] When Photos add permission is granted, an accepted camera capture is saved to Photos.
- [ ] If Photos add permission is denied, the stamp photo remains accepted and the app explains only that saving the extra copy failed.
- [ ] Camera permission denial offers the appropriate Settings path.
- [ ] On a simulator/no-camera environment, the flow fails calmly rather than presenting a broken preview.
- [ ] Tapping an accepted draft photo opens the viewer.
- [ ] Removing any draft photo updates the list/count correctly.
- [ ] Six photos are allowed and a seventh cannot be added.
- [ ] Done returns to the composer with the draft intact.

## Photo Library validation

- [ ] Choose from Photo Library opens the native library picker.
- [ ] A normal recent photo with metadata consistent with the selected place/time can be accepted.
- [ ] A screenshot is rejected with the screenshot-specific message.
- [ ] A geotagged photo far outside the allowed distance is rejected.
- [ ] A photo whose capture timestamp is outside the allowed time window is rejected.
- [ ] A photo without complete metadata can still be accepted when the overall validation score remains sufficient.
- [ ] Rejected library photos are not added to the draft.
- [ ] Accepted library photos are uploaded without original EXIF/GPS metadata.

## Stamp creation

- [ ] Nearby/Here place state matches the real location.
- [ ] The server, not only the client, rejects an out-of-geofence stamp.
- [ ] Caption and song attachment still work with zero or more photos.
- [ ] At least one content item is required.
- [ ] Submission cannot be accidentally repeated while uploading.
- [ ] Server failures preserve the draft for retry.
- [ ] Successful submission reaches the current stamp landing/passport flow.

## Passport and memories

- [ ] Passport opens and closes correctly on the device.
- [ ] 3D cover/open transition, if enabled in the current screen, hands off to the readable page view without clipping or a blank frame.
- [ ] First and final book faces render correctly.
- [ ] Page navigation and stamp taps open the correct memory.
- [ ] Photo viewer paging, pinch zoom, double-tap zoom, and close behavior work.
- [ ] Photo arrangement/edit behavior persists where currently supported.
- [ ] Pinned stamp limits behave correctly.
- [ ] Long place names/captions remain legible at normal and large text sizes.

## Map and place pages

- [ ] Current location and place pins render correctly without stale simulated-location state.
- [ ] Pan/zoom remains responsive with many places.
- [ ] Place sheet/page shows correct distance and stamp history.
- [ ] Geofence eligibility shown by the UI agrees with server acceptance at the boundary.
- [ ] Required OpenStreetMap attribution appears for imported data.

## Accessibility and motion

- [ ] VoiceOver reaches all primary controls and reads meaningful labels.
- [ ] Touch targets remain usable at larger text sizes.
- [ ] Keyboard does not obscure sign-in, sign-up, composer, or edit forms.
- [ ] Reduce Motion removes or simplifies decorative motion without breaking navigation.
- [ ] Background/resume does not corrupt the current passport page, photo draft, or pending composer state.

## Permissions and privacy

- [ ] Camera, Photo Library, Photos add, and Location permission prompts use current copy.
- [ ] Denying any permission leaves a recoverable UI.
- [ ] No uploaded stamp image preserves EXIF/GPS.
- [ ] Precise location is never accidentally shown in viewer-facing UI.

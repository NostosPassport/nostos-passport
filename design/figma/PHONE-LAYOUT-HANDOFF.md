# Phone layout handoff

User report: the last running build appeared too large, with buttons at the top-left and top-right corners. This is reported behavior, not a reproduced diagnosis. Figma changes do not fix or verify the app.

## Current design

Frame: https://www.figma.com/design/9mMDIaJQrcPMYxofELYwAj?node-id=2-2

Reference viewport: 393 × 852 points. Bottom bar: 300 × 64, centered at x=46.5, y=746. Three equally spaced controls use 84 × 52 touch regions. Icon slots are 32 × 32, with 18-point side icons and a 32-point visible Stamp circle. Labels center independently in each control. The central passport region remains blank.

## Implementation after authorization

1. Record the user's phone model, OS, build identifier, text size and screenshot; reproduce the reported layout on that build. Compare portrait and rotated orientation if supported.
2. Inspect the actual root viewport and safe-area insets, parent container sizes, and any transforms or fixed design-canvas dimensions. Use logical points, not screenshot pixels. Do not scale the whole screen from the 393 × 852 reference.
3. Inspect `mobile/src/app/(app)/(tabs)/_layout.tsx`, `passport.tsx`, `features/book/PassportBook.tsx`, `dimensions.ts` and `book-state.ts`. Check absolute-positioned Settings and book layers against their intended parent, plus any imported UI placement. These are relevant candidates, not established causes.
4. Center the bar in the usable viewport with width `min(300, availableWidth - 48)`. Anchor its bottom to the safe-area bottom plus a comfortable gap, rather than a fixed y coordinate. Preserve at least 44 × 44 touch regions even when chrome shrinks. Header controls retain consistent edge insets and sit below the top safe area.
5. Use layout containers to center each icon slot and label independently. Avoid manually positioning Map's label using Passport's text width, or floating the Stamp icon outside its control. Let text reflow or adjust the arrangement for large accessibility sizes.
6. Verify on the user's real phone: no overflow or clipped controls, equal margins, correct touch regions and navigation, blank future passport stage, large text, safe-area changes and Reduce Motion. Record device evidence before calling the app defect fixed.

No app source was edited for this handoff.

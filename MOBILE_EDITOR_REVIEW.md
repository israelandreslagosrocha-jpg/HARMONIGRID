# Mobile overview and focused editing

Development branch: codex/security-performance. Desktop breakpoint: 768 CSS pixels.

## Experience

The mobile editor opens a lightweight map with two measures per row (three from 560 px). Each card shows its original measure number, chord names and a short lyric preview. It is a navigation summary, not a replacement for exact rhythmic engraving. Touching a card mounts the existing ScoreSystem for that measure, with previous/next navigation and a return button that restores overview scroll and keyboard focus. Editing uses the original reactive measure, not a copied document.

A fixed toolbar directly below the compact command rows exposes Play/Stop, Audio, Voicings, and Lyrics/more. Each settings section reuses the original controls and can be collapsed. Numeric audio controls use 16 px text and 44 px height on mobile. The overview avoids mounting every detailed score row; only the selected detailed measure mounts. No new library, musical engine, payment feature or PRO entitlement is introduced.

Desktop retains its existing sidebar and score rows. Range selection and ordering deliberately retain the original score interface, preserving existing repeat operations. Account workspace changes and project hydration reset mobile navigation. The PDF layout remains independent of the mobile map.

## Verification

- Production build and regression suite.
- Browser viewports: 320, 375, 390, 640 and 1280 px. No document horizontal overflow in the mobile overview; two/three columns confirmed.
- Interactive flow: open measure 2, assign Fmaj7, return to map, reopen and navigate to measure 3. Chord retained and shown on the correct card.
- Enable lyrics, enter text in measure 2, return to map and resize to desktop: text retained in both views.
- Audio panel exposes continuity and inversion settings; voicings shows the selected Fmaj7 notes. Final build numeric audio controls confirmed at 16 px / 44 px.
- Range-selection mode retains the original measure view. Desktop displays two detailed score rows for the eight-measure test composition; mobile summary is absent at 1280 px.

These are browser viewport checks, not physical iOS/Android keyboard, audio or screen-reader acceptance tests. Complex measures retain horizontal scrolling within the focused editor if their existing rhythmic layout requires more width. The existing large-bundle warning remains.

## Design references

IA MarkeTIA instructions and its public tool vault were consulted; design entries include Frontend Design and UI design repositories. No paid AI service or new external runtime was added.

- Vault: https://shimmering-horse-26068d.netlify.app/
- Frontend Design: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- W3C target sizing: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum/

## Compact header follow-up

The account launcher now lives in the green title header (and the setup header) as a 44 px icon. One existing cloud controller remains mounted; Vue Teleport moves only its launcher. The account menu provides login/registration, the existing account/composition dialog and manual saving for authenticated users. Save status is available inside the menu and through an accessible live region; authenticated status has a visual dot. Autosave, ownership rules, recovery, Google/email authentication and document snapshots are unchanged.

Mobile announcement/caption strips no longer consume editor space; the upcoming-tools notice is available in the account menu. The mobile command area occupies two 44 px rows plus padding (101 px measured). Groove remains available when Lyrics/more is expanded. The playback toolbar is outside the scrolling score area, contiguous with the commands and main scroll container, so no sticky offset opens a gap while scrolling. Desktop retains its command layout, with its account launcher integrated into the title header as well.

Browser verification at 320 and 375 px confirmed no document horizontal overflow, one account icon and identical tool-bottom/play-top coordinates (157 px), with play-bottom/main-top at 210 px, including after 159 px of score scrolling. Guest menu and existing Google/email/recovery dialog were exercised without signing into an account. The previous roughly 470 px first-card position at 375 px is reduced to roughly 254 px. Physical-device keyboard/audio and authenticated remote saving still require device acceptance; cloud regression tests cover the existing save pipeline.

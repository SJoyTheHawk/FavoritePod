# Phase 6 Manual Test

The automated tests cover URL rewriting, per-device settings, permission
handling, and availability states. Run these checks in Chrome with the built
extension to verify browser permission and local filesystem behavior.

## Permission And Opening

1. Build and load `dist/` as an unpacked extension. Add a `file://` favorite
   whose file exists, then turn off **Allow access to file URLs** in the
   extension details.
2. Reopen the launcher. Confirm the warning appears with the settings URL and
   copy and dismiss controls. Confirm the local-file card reports **Unknown**.
3. Open the favorite. Confirm the warning reappears and Chrome does not open a
   tab. Enable **Allow access to file URLs**, return to the launcher, and
   confirm the warning clears and the favorite opens in a new tab.
4. Add a `file://` favorite pointing to a nonexistent file. Confirm its status
   is **Missing** while an existing file reports **Available**.

## Per-Device Path Overrides

1. Save a favorite under a source folder, for example
   `file:///Users/alice/tools/sample.html`.
2. In Settings, map `file:///Users/alice/tools/` to the existing folder on this
   device. Confirm the card status checks the mapped path and opening the item
   navigates to the mapped file.
3. Remove the mapping and confirm opening uses the original saved URL again.
4. Repeat on another device with a different local folder. Confirm its mapping
   does not replace the first device's mapping.

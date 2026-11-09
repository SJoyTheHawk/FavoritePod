# FavoritePod: Chrome Web Store Screenshot Checklist

Phase 11.1 — Release preparation  
Prepared: November 9, 2026

**Goal:** Prepare five screenshots using one realistic demo library, plus the
separate store icon and promotional artwork. Complete the first dashboard image
before moving on to the remaining four.

## 1. Set up the demo environment

- [ ] Create a dedicated Chrome profile for the demo.
- [ ] Load the FavoritePod build intended for release.
- [ ] Pin FavoritePod to the Chrome toolbar.
- [ ] Use sample content without personal emails, private documents, or account details.
- [ ] Set Chrome page zoom to **100%**.
- [ ] Select **Light** appearance in FavoritePod for a consistent main image set.
- [ ] Close unrelated tabs and dismiss notifications before capturing browser context.

## 2. Set the screenshot dimensions

| Setting | Target |
| --- | --- |
| Final image dimensions | **1280 × 800 pixels** |
| Aspect ratio | **16:10** |
| Recommended file format | PNG |
| Dashboard framing | App content fills the image |
| Image edges | Square corners; no added padding |
| Number of screenshots | Five planned; Chrome accepts 1–5 |

Chrome also accepts 640 × 400 screenshots. Use 1280 × 800 for this release.
You do not need to change your Mac's display resolution.

### Dashboard capture method

1. Open FavoritePod's launcher.
2. Open Chrome DevTools and toggle the **Device toolbar**.
3. Select **Responsive** and enter **1280** width and **800** height.
4. In the device toolbar menu, show **Device type** and **Device pixel ratio** if hidden.
5. Select **Desktop** and set **DPR to 1**.
6. Arrange the app using the checklist below and wait for previews to load.
7. From the device toolbar menu, choose **Capture screenshot**.
8. Verify that the saved image is exactly **1280 × 800 pixels**.

- [ ] Capture the visible viewport, rather than a full scrolling page.
- [ ] Keep desktop wallpaper, the Dock, DevTools, and browser tabs outside dashboard images.
- [ ] Inspect the final image at full size and at half size for readability.

## 3. Build the demo library

### Understand the three types of entries

- **Group:** A top-level folder in the sidebar, such as **Design inspiration**.
- **Subgroup:** A folder inside another folder, such as **Visual ideas** inside Design inspiration.
- **Bookmark:** A saved website or local file, such as **Unsplash** inside Visual ideas.

For example: **Design inspiration (group) → Visual ideas (subgroup) → Unsplash (bookmark)**.

### Step A — Create the folders first

**Every name in this tree is a folder, not a bookmark.** Unindented names are
top-level groups; indented names are their subgroups.

```text
Daily essentials
Design inspiration
├── Visual ideas
└── Design resources
Learning
├── Web development
└── General knowledge
Local tools
├── Productivity
└── Development
Projects
└── Website refresh
```

- [ ] Create the five top-level groups in the order shown.
- [ ] Inside Design inspiration, create Visual ideas and Design resources.
- [ ] Inside Learning, create Web development and General knowledge.
- [ ] Inside Local tools, create Productivity and Development.
- [ ] Inside Projects, create Website refresh.

Create each subgroup under its parent. Name it **Visual ideas**, for example;
do not name one folder "Design inspiration → Visual ideas". The arrow indicates
the folder path, not text to type into the name field.

### Step B — Add bookmarks to their destination folders

**The Destination folder column tells you where to save the bookmarks listed
in Bookmark titles to add.** Check a row after adding all of
its bookmarks. These are suggested demo titles; substitute suitable content
you actually have.

| Done | Destination folder | Bookmark titles to add |
| --- | --- | --- |
| ☐ | Daily essentials | Google Calendar; Google Drive; Notion; GitHub |
| ☐ | Design inspiration → Visual ideas | Figma Community; Unsplash |
| ☐ | Design inspiration → Design resources | Google Fonts; Coolors |
| ☐ | Learning → Web development | MDN Web Docs; freeCodeCamp |
| ☐ | Learning → General knowledge | Wikipedia; TED |
| ☐ | Local tools → Productivity | Focus Timer; Project Dashboard |
| ☐ | Local tools → Development | Markdown Previewer; Color Palette |
| ☐ | Projects → Website refresh | Design Brief; Wireframes; Launch Checklist |

Daily essentials holds its four bookmarks directly. The other top-level groups
hold subgroups; save their bookmarks inside those subgroups. Each bookmark only
needs to be saved once, in the destination shown.

**Local tools:** Use actual working local HTML files. The four titles above are
examples of your own tools, not tools bundled with FavoritePod.

**Website refresh:** Use real sample documents, design pages, or local files for
Design Brief, Wireframes, and Launch Checklist. The titles alone are not links.

- [ ] Enable **Allow access to file URLs** in FavoritePod's Chrome extension details.
- [ ] Confirm that each saved local tool opens successfully.
- [ ] Check the finished library: **5 top-level groups, 7 subgroups, 19 bookmarks**.

### Step C — Make the subgroups visible in screenshots

- [ ] For the main dashboard, expand **Design inspiration** and **Projects** in the sidebar.
- [ ] Keep Learning and Local tools collapsed in that first image to leave space.
- [ ] Confirm Visual ideas, Design resources, and Website refresh are visibly indented under their parents.
- [ ] For the local-tools image, expand **Local tools** to show Productivity and Development.
- [ ] For the organization image, expand **Projects** and select **Website refresh**.

### Prepare the previews

- [ ] Keep bookmark names short enough to display without truncation.
- [ ] Use varied previews: a photo, font specimen, documentation, dashboard, and colorful tool.
- [ ] Open each page and wait for it to finish loading before capturing its preview.
- [ ] Dismiss cookie banners, advertisements that obscure content, and unrelated dialogs.
- [ ] Use public pages or demo accounts with sample content.
- [ ] Avoid previews dominated by sign-in screens or loading placeholders.
- [ ] Use the sidebar expansion choices in Step C so the subgroup structure is visible.

## 4. Arrange the main dashboard

- [ ] Select **All favorites**.
- [ ] Select **Grid view → Medium cards** as the starting point.
- [ ] Keep the sidebar visible with the groups in the order above.
- [ ] Expand Design inspiration and Projects so their subgroups appear in the first image.
- [ ] Hide **Frequently visited** for this image.
- [ ] Clear the search field.
- [ ] Deselect all cards and close menus and dialogs.
- [ ] Move the pointer away from cards to dismiss hover previews and tooltips.
- [ ] Aim for approximately **8–12 fully visible cards**, depending on the layout.
- [ ] Switch to **Large cards** if the previews feel too small.
- [ ] Check that the composition looks populated, balanced, and readable at half size.

The card count is a composition target, not a requirement. Keep the interface at
its natural proportions and prioritize readable previews.

## 5. Capture the five screenshots

The messages below describe what each image should communicate. They do not need
to be added as text overlays.

### Screenshot 1 — Visual home

**Show:** The populated All favorites dashboard prepared above.  
**Message:** Your favorite websites in one visual home.  
**Filename:** `01-visual-home.png`

- [ ] Capture and inspect the image.
- [ ] Confirm the sidebar, previews, and main controls are clear.
- [ ] Confirm the expanded sidebar shows subgroups under Design inspiration and Projects.
- [ ] Confirm final dimensions are 1280 × 800.

### Screenshot 2 — Local tools

**Show:** The Local tools group with working preview cards.  
**Message:** Keep local tools close to your websites.  
**Filename:** `02-local-tools.png`

- [ ] Select Local tools and choose a card size that gives the previews enough space.
- [ ] Expand Local tools in the sidebar so Productivity and Development are visible.
- [ ] Confirm there are no missing-file or permission warnings.
- [ ] Confirm visible file paths contain no private information.
- [ ] Capture and verify the 1280 × 800 image.

### Screenshot 3 — Save a page

**Show:** The actual Add bookmark toolbar popup over an attractive public page.  
**Message:** Save a page with its preview and chosen folder.  
**Filename:** `03-save-a-page.png`

- [ ] Open a public page with a useful, recognizable preview.
- [ ] Open FavoritePod and select Add bookmark.
- [ ] Use a short bookmark title and select its destination subgroup; for example, save Unsplash in Design inspiration → Visual ideas.
- [ ] Capture the popup together with enough browser context to explain the action.
- [ ] Crop the composition to 16:10 and export at 1280 × 800 without stretching it.
- [ ] Keep the popup readable and fully visible.

**Capture note:** Use an operating-system screenshot for the actual toolbar popup.
The dashboard's DevTools screenshot method captures page content.

### Screenshot 4 — Project organization

**Show:** Projects → Website refresh in list view, with the sidebar branch expanded.  
**Message:** Keep projects organized with folders and flexible views.  
**Filename:** `04-project-organization.png`

- [ ] Select Website refresh and switch to List view.
- [ ] Keep Projects expanded so the parent/subgroup relationship is visible.
- [ ] Show Design Brief, Wireframes, and Launch Checklist with readable names.
- [ ] Capture and verify the 1280 × 800 image.

### Screenshot 5 — Optional sync

**Show:** The Google Drive sign-in dialog over the populated library.  
**Message:** Connect Google Drive when you want to sync.  
**Filename:** `05-optional-drive-sync.png`

- [ ] Open the Google Drive connection dialog.
- [ ] Keep the populated library visible behind it.
- [ ] Use the sign-in prompt; show a connected state only if a demo account is connected.
- [ ] Check that no personal email address or account information is visible.
- [ ] Capture and verify the 1280 × 800 image.

## 6. Prepare the separate store artwork

| Asset | Dimensions | Purpose |
| --- | --- | --- |
| Extension icon | 128 × 128 | Store/extension identity |
| Small promotional image | 440 × 280 | Brand artwork for store promotion |
| Optional marquee image | 1400 × 560 | Larger promotional placement |

- [ ] Prepare the extension icon.
- [ ] Prepare a small promotional image that communicates the FavoritePod brand.
- [ ] Keep promotional artwork simple and recognizable at smaller sizes.
- [ ] Prepare the optional marquee image if desired.

**Plan terminology correction:** The 128 × 128 asset is the extension icon, not
a separate small promotional tile. The small promotional image is 440 × 280.
Google recommends brand-focused artwork rather than simply reusing a screenshot
for promotional images.

## 7. Final review before uploading

- [ ] All five screenshots show the actual release interface and supported behavior.
- [ ] All screenshots are exactly 1280 × 800, with consistent appearance.
- [ ] No stretched images, added outer padding, or decorative rounded corners.
- [ ] No personal data, private URLs, unrelated tabs, or desktop clutter.
- [ ] No broken thumbnails, unfinished loading states, or accidental tooltips.
- [ ] Main controls and previews remain understandable at half size.
- [ ] Images are ordered: visual home, local tools, saving, organization, optional sync.
- [ ] Review the current upload requirements in the Chrome Web Store dashboard.

## Reference documents

- [Project release plan: Phase 11.1](IMPLEMENTATION_PLAN.md#111-chrome-web-store-submission)
- [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images)
- [Chrome DevTools device mode and screenshots](https://developer.chrome.com/docs/devtools/device-mode)

## Notes while preparing

Capture date: ____________________    Build/version: ____________________

Changes needed: _______________________________________________________

______________________________________________________________________

______________________________________________________________________

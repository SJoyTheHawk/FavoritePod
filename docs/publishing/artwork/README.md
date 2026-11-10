# FavoritePod store artwork

Prepared November 10, 2026. These are separate store assets, not screenshots.
Open [preview.html](preview.html) to compare the designs at full and half size.

## Upload files

| Asset | File | Dimensions | Format |
| --- | --- | --- | --- |
| Extension icon | [extension-icon-128.png](extension-icon-128.png) | 128 × 128 | RGBA PNG |
| Small promotional image | [small-promo-440x280.png](small-promo-440x280.png) | 440 × 280 | RGB PNG |
| Optional marquee image | [marquee-1400x560.png](marquee-1400x560.png) | 1400 × 560 | RGB PNG |

The primary promotional images use the **detailed general brand mark** from
[icon_light.jpg](../../../public/icons/icon_light.jpg). Its picture, folder, document,
and web-card symbols communicate the product's visual organization. A white
medallion preserves the original JPEG artwork against a saturated blue-to-teal
background. Subtle orbit lines and colored cards echo the icon without adding
interface detail. There is no text in the primary promotional artwork.

The extension icon uses the **simplified small-size mark** from
[favoritepod-icon.png](../../../public/icons/favoritepod-icon.png), with a 96 × 96
mark centered on a transparent 128 × 128 canvas. The existing app icons and
manifest are unchanged; this folder contains the prepared store assets.

## English-language alternatives

- [Small promotional image with copy](alternates/small-promo-440x280-en.png)
- [Marquee image with copy](alternates/marquee-1400x560-en.png)

These also use the detailed brand mark. The copy is “FavoritePod”, “Your favorites.
One visual home.” and a short websites/local-tools descriptor. Use the primary
text-free artwork for the store's language-neutral promotional slots; the English
alternates are also available for other marketing placements.

## Sources and regeneration

Editable SVG compositions are in [sources](sources/). Each SVG embeds its source
image, so it can be opened independently. Text in the English alternatives remains
editable. These are compositions of the project's existing artwork, not AI-generated
illustrations; no image-generation model or API was used.

On macOS with Google Chrome and Swift installed, run from the repository root:

```sh
python3 docs/publishing/artwork/sources/render.py
```

The renderer exports the SVGs at 2× resolution, downsamples to the exact upload
dimensions, and recreates the padded extension icon. It replaces only the five
generated PNGs in this folder. Set `CHROME_BIN` if Chrome is installed elsewhere.

## Design reference

Google's [Supplying Images](https://developer.chrome.com/docs/webstore/images)
guidance was read on November 10, 2026. It specifies 440 × 280 and 1400 × 560
promotional sizes and recommends brand-focused images, avoiding text, saturated
colors, and checking recognition at half size. These are design recommendations;
store review and upload are separate steps.

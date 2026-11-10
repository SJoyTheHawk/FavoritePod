# Local demo pages

Seven self-contained pages for the FavoritePod screenshot demo library. Each HTML
file includes its own styles and any scripts, uses sample content, and works offline.
No build, server, account, installation, or external assets are needed.

The pages use different layouts, typography, and colors so their bookmark
previews are easy to tell apart. [Compare all seven designs](preview.png).

| Page                                          | What works                                                                                                      | FavoritePod destination    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------- |
| [Focus Timer](focus-timer.html)               | Start, pause, resume, and reset; 25-minute focus, 5-minute break, and 15-minute break; completed-session count. | Local tools → Productivity |
| [Project Dashboard](project-dashboard.html)   | Check off tasks, add tasks, and see progress update. Reset board restores the sample tasks.                     | Local tools → Productivity |
| [Markdown Previewer](markdown-previewer.html) | Edit Markdown and see a live preview. Restore example resets the document.                                      | Local tools → Development  |
| [Color Palette](color-palette.html)           | Cycle through four palettes, lock colors, edit individual colors, and export CSS.                               | Local tools → Development  |
| [Design Brief](design-brief.html)             | Read a sample website brief covering goals, audience, visual direction, and scope.                              | Projects → Website refresh |
| [Wireframes](wireframes.html)                 | Switch between desktop and mobile homepage wireframe layouts.                                                   | Projects → Website refresh |
| [Launch Checklist](launch-checklist.html)     | Check off launch tasks, track progress, filter remaining tasks, and restore the sample checklist.               | Projects → Website refresh |

## Open and bookmark

1. Open any of the HTML files in Chrome. You can drag the file from Finder into a
   Chrome tab, or use **File → Open File**.
2. In `chrome://extensions`, open FavoritePod's **Details** and enable
   **Allow access to file URLs**.
3. Save each open page using FavoritePod's **Add bookmark** popup. The page title
   matches the title in the screenshot checklist; choose the destination above.
4. Wait for each preview to load before arranging the Local tools or Website
   refresh screenshot. If you already saved these pages, reload them and refresh
   their FavoritePod thumbnails to capture the updated designs.

Keep the HTML files in a stable location after bookmarking: moving them changes
their `file://` paths. Copy them to another folder before adding bookmarks if you
prefer shorter paths for screenshots.

Existing bookmarks that point to the old `docs/demo-tools/` location need to be
saved again from `docs/assets/demo-tools/`, or adjusted using File Locations Remap.

These are lightweight demo pages. Changes live only in the open page and reset
when you reload. The Markdown preview supports a small subset: headings, flat
lists, quotes, bold, italic, inline and fenced code, horizontal rules, and HTTP(S)
links. Typed HTML stays plain text. The palette's **Export CSS** button downloads
the current five colors as CSS variables.

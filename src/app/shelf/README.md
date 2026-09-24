# The game shelf (`/shelf`)

A client-side CSS 3D model of the photographed 5 × 5 IKEA KALLAX. Each board and
game box is a six-sided cuboid, not a hotspot layered over a flat photograph.
There are no added runtime dependencies and no WebGL requirement.

## Files

- `shelf-layout.ts`: manually matched box IDs, positions, colors, and texture crops.
  Coordinates use a 1200 × 1200 rectified shelf face. Top-box crops use the original
  image's 2000 × 1500 reference coordinate system.
- `shelf-model.tsx`: cuboid geometry, drag/pinch/keyboard rotation and zoom, selection.
- `shelf-explorer.tsx`: details, collection search/filter/sort, random selection, photo dialog.
- `data/games.json`: 186 distinct records from the supplied BGG export, including 150
  currently owned games/expansions. Non-owned records remain available under
  “All dataset records” and for boxes visible in the photo.
- `data/source.json`: source attribution and export date.
- `public/shelf/`: generated WebP reference photo and perspective-corrected texture atlas.
- `data/publisher-spines.json` and `public/shelf/publisher/`: traced sources and
  perspective-rectified real box sides from official publisher product renders.

## Updating the data and textures

From the repository root:

```sh
node scripts/prepare-shelf.mjs /path/to/beezer25-bgg
node scripts/prepare-publisher-spines.mjs
```

The import script reads `games.json`, `collection.json`, and `manifest.json` from
that directory, plus `src/app/board_game_shelf.jpeg`. Generated files are checked
in so deployment never depends on files in Downloads. Sharp is available through
the existing Next.js installation. Image output strips source metadata.

The second command downloads official product renders from the publisher and
extracts real printed side panels (and box faces for a few games on top). Crop
coordinates are annotated in that script. Regeneration requires network access,
but serving the page does not. If a box has no verified publisher image, it uses
the original photograph instead. The photograph-derived atlas is generated at
2× layout resolution; the top-box fallback uses a separate 3200px image.

Only game information and collection-level play counts are included. Individual
play records, players, scores, locations, and profile information are not copied.
The additional Downloads exports were checked: the 145 supplemental stats match
the consolidated game records, all 608 plays match the consolidated play export,
and the remaining stats file is empty.

Box matching is manual and approximate. A null `gameId` means the box isn't
confidently identified or is absent from the export; selecting it explains the
missing match instead of inventing metadata. Storage boxes may link to the base
game they hold (for example, the Wingspan Nesting Box). Change `shelf-layout.ts`
to refine a placement or identification. The collection list remains the source
of truth for all imported records, including games not located in the photograph.

Cover art is loaded from the BGG URLs in the export, with a local text/icon
fallback if an image fails. The 3D model's textures are entirely local.

## Controls and accessibility

- Drag to rotate; pinch or use +/− controls to zoom; reset returns the initial view.
- Focus the scene and use arrow keys, +/−, or 0 to rotate, zoom, or reset.
- Every box is a native, labeled button reachable with Tab and Enter/Space.
- The collection list is an alternative to picking small 3D boxes.
- The photo uses a native dialog with Escape dismissal and focus restoration.
- Reduced-motion preferences disable transitions and animated scrolling.

Validation: `npm run lint`, `npx tsc --noEmit`, and `npm run build`.

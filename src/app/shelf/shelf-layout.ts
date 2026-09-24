// Hand-matched to board_game_shelf.jpeg. Rectangles are measured on the
// perspective-corrected 1200px atlas, not guessed from the order of the export.
// Null IDs deliberately leave ambiguous/unlisted boxes unmatched.
export type ShelfBox = {
  key: string;
  gameId: number | null;
  label?: string;
  rect: [number, number, number, number];
  displayX?: number;
  color: string;
  location: string;
  top?: boolean;
  photoRect?: [number, number, number, number];
};

type Placement = [number | null, number, number, number, number, string, string?];
const rows: Placement[][] = [
  [
    [329465, 25, 48, 46, 195, "#6f3341"],
    [305668, 74, 47, 59, 196, "#ad7077"],
    [204583, 137, 70, 36, 174, "#408fa5"],
    [232043, 176, 81, 41, 163, "#57adaf"],
    [null, 221, 91, 21, 153, "#355e52", "Unidentified small box"],
    [39856, 260, 65, 35, 180, "#818e93"],
    [296108, 301, 82, 58, 163, "#8c6d62"],
    [328871, 363, 83, 59, 162, "#547979"],
    [266524, 430, 104, 44, 141, "#5f6a69"],
    [163412, 302, 49, 132, 30, "#835b48"],
    [350184, 499, 50, 51, 194, "#607557"],
    [382229, 556, 74, 41, 170, "#bb7055"],
    [115105, 600, 89, 27, 155, "#b57e65"],
    [null, 632, 99, 30, 145, "#aa7d8a", "Fort — not in the export"],
    [188834, 668, 146, 37, 98, "#c2534f"],
    [null, 683, 49, 27, 95, "#927887", "Unidentified tall box"],
    [312804, 728, 50, 46, 194, "#79737d"],
    [316090, 779, 50, 48, 194, "#bd8fa1"],
    [217085, 832, 69, 46, 175, "#b6948c"],
    [426796, 892, 57, 47, 102, "#bdaa79"],
    [305682, 893, 161, 46, 83, "#ad9e71"],
    [286096, 960, 52, 67, 193, "#92926b"],
    [283155, 1030, 86, 45, 159, "#bc9b9b"],
    [274533, 1105, 81, 48, 164, "#82b4ae"],
    [null, 1158, 113, 21, 132, "#b7ad95", "Unidentified small box"],
  ],
  [
    [256226, 34, 307, 48, 170, "#b388a4"],
    [287954, 84, 307, 61, 170, "#ba8ea5"],
    [230802, 151, 307, 43, 170, "#82a7b5"],
    [346965, 198, 309, 43, 168, "#87a8a6"],
    [253185, 259, 281, 53, 196, "#bec7b6"],
    [218603, 322, 284, 65, 193, "#4c7a89"],
    [333372, 393, 284, 46, 193, "#849378"],
    [369898, 444, 302, 33, 175, "#536a73"],
    [299372, 498, 295, 37, 182, "#b0b69b"],
    [237182, 539, 283, 32, 194, "#7f8261"],
    [241386, 575, 283, 44, 194, "#848568"],
    [170042, 625, 284, 36, 193, "#65858c"],
    [210164, 666, 347, 22, 130, "#75828f"],
    [210163, 693, 347, 20, 130, "#728394"],
    [296043, 791, 286, 48, 190, "#5896a1"],
    [265736, 844, 283, 48, 193, "#749aa6"],
    [258036, 897, 282, 44, 194, "#528392"],
    [400314, 960, 283, 45, 193, "#5599a8"],
    [410201, 1010, 283, 53, 193, "#6494a4"],
    [356033, 1069, 287, 45, 189, "#83b1bd"],
    [277611, 1118, 333, 34, 143, "#466077"],
  ],
  [
    [161317, 37, 502, 35, 204, "#437f99"],
    [120677, 78, 502, 57, 204, "#3e6c88"],
    [280885, 153, 511, 66, 194, "#507480"],
    [160851, 226, 554, 18, 151, "#ac9253"],
    [158408, 271, 530, 28, 63, "#a9ad9a"],
    [null, 307, 502, 46, 90, "#b14e46", "Merry Dismas — not in the export"],
    [135779, 359, 507, 28, 85, "#b95981"],
    [null, 398, 527, 77, 65, "#bfa263", "Party-game boxes — not identified"],
    [391084, 269, 617, 30, 92, "#7ac6c0"],
    [159581, 302, 638, 30, 71, "#c5b748"],
    [169654, 336, 644, 23, 65, "#3c9796"],
    [355433, 364, 647, 22, 62, "#528298"],
    [291453, 391, 635, 28, 74, "#bda842"],
    [361212, 423, 635, 20, 74, "#465b5f"],
    [null, 447, 617, 29, 92, "#448b9a", "Small game pouch"],
    [null, 731, 526, 30, 69, "#c5b993", "Unidentified small white box"],
    [null, 765, 515, 23, 80, "#ae9368", "Unidentified card game"],
    [274960, 794, 518, 31, 77, "#be884a"],
    [218028, 828, 514, 24, 81, "#b39e62"],
    [null, 856, 525, 26, 70, "#ac8b38", "Anarchy Pancakes — not in the export"],
    [284083, 885, 518, 23, 77, "#46809b"],
    [295607, 912, 510, 27, 85, "#577a51"],
    [183394, 747, 617, 26, 92, "#5b515c"],
    [287821, 778, 617, 32, 92, "#595c4e"],
    [null, 814, 617, 28, 92, "#716265", "Unidentified small black box"],
    [269618, 847, 617, 26, 92, "#514854"],
    [264241, 877, 617, 29, 92, "#b2c2c4"],
    [181810, 911, 617, 28, 92, "#7b885b"],
    [436126, 959, 516, 46, 193, "#70a9b1"],
    [290448, 1012, 517, 51, 192, "#99b6bf"],
    [366161, 1068, 525, 29, 184, "#a2aeae"],
    [295947, 1102, 552, 43, 157, "#547e91"],
  ],
  [
    [379078, 33, 737, 51, 199, "#5a8ba1"],
    [null, 92, 776, 68, 160, "#479f92", "Game storage cases"],
    [305682, 171, 801, 78, 135, "#81b5c4"],
    [252929, 267, 761, 58, 177, "#548fa3"],
    [133848, 331, 761, 47, 177, "#777e9a"],
    [314491, 385, 759, 47, 179, "#567480"],
    [244228, 438, 774, 42, 164, "#518498"],
    [338479, 501, 759, 52, 179, "#806d94"],
    [293981, 560, 761, 47, 177, "#4f7589"],
    [null, 612, 771, 29, 167, "#817d7a", "Stored boards and inserts"],
    [251412, 649, 778, 30, 160, "#737575"],
    [null, 685, 750, 29, 186, "#b17492", "Jigsaw puzzle"],
    [334986, 730, 746, 48, 192, "#79b8bc"],
    [255363, 785, 767, 48, 171, "#89a8a6"],
    [70919, 842, 753, 48, 185, "#7b9a94"],
    [null, 896, 734, 44, 80, "#8c7482", "Unidentified small box"],
    [347883, 914, 821, 24, 117, "#8e7959"],
    [199792, 961, 751, 42, 192, "#686b4c"],
    [297978, 1011, 760, 49, 183, "#726e74"],
    [122298, 1071, 766, 35, 177, "#675b49"],
    [368609, 1112, 757, 65, 186, "#3d4842"],
  ],
  [
    [199561, 41, 985, 82, 184, "#a69462"],
    [244262, 148, 977, 40, 192, "#7d9a85"],
    [197376, 195, 978, 59, 191, "#b7c6b8"],
    [301561, 260, 1008, 28, 162, "#c5ae88"],
    [263695, 291, 998, 20, 172, "#b3c496"],
    [359142, 313, 1000, 15, 170, "#bfcbb1"],
    [231302, 335, 1008, 63, 162, "#c6c9b3"],
    [290236, 404, 1020, 31, 150, "#c8cbba"],
    [null, 438, 1014, 42, 156, "#c2b39c", "Ticket to Ride box — not in the export"],
    [null, 500, 970, 50, 200, "#a8b5ac", "Unidentified adventure game"],
    [367375, 558, 997, 41, 173, "#bbc5b9"],
    [332290, 731, 980, 55, 190, "#a1ad84"],
    [155731, 793, 978, 52, 192, "#b4c2b3"],
    [284742, 852, 1000, 47, 170, "#c4baa2"],
    [272380, 905, 974, 35, 196, "#c3c5b6"],
    [318084, 961, 986, 39, 184, "#bfbda4"],
    [307561, 1004, 978, 45, 192, "#bbbba9"],
    [39856, 1055, 994, 42, 176, "#c8c7b4"],
    [null, 1101, 978, 47, 192, "#b7c5b5", "Unidentified large white box"],
    [null, 1154, 1043, 27, 129, "#cbcdbf", "Unidentified white box"],
  ],
];

// The atlas includes perspective and small gaps between spines. Keep its rects
// for sampling the photograph, but pack the rendered boxes inside each opening.
const cubbyEdges = [[20, 244], [256, 481], [493, 716], [728, 947], [959, 1182]];
const packedX = new Map<string, number>();
rows.forEach((row, rowIndex) => {
  for (const [left, right] of cubbyEdges) {
    const groups = new Map<number, { index: number; x: number; w: number }[]>();
    row.forEach(([, x, y, w], index) => {
      if (x < left || x >= right) return;
      // These boxes sit above or below their neighbors, rather than beside them.
      const lane = rowIndex === 0 && [9, 15, 20].includes(index) ? index + 1
        : rowIndex === 2 && y >= 600 ? 1
        : rowIndex === 3 && index === 16 ? 1 : 0;
      const group = groups.get(lane) ?? [];
      group.push({ index, x, w });
      groups.set(lane, group);
    });
    for (const group of groups.values()) {
      group.sort((a, b) => a.x - b.x);
      const gap = 2;
      const width = group.reduce((sum, box) => sum + box.w, 0) + gap * (group.length - 1);
      let position = Math.max(left + 3, Math.min(group[0].x, right - 3 - width));
      for (const box of group) {
        packedX.set(`r${rowIndex}-${box.index}`, position);
        position += box.w + gap;
      }
    }
  }
});

export const shelfBoxes: ShelfBox[] = rows.flatMap((row, rowIndex) =>
  row.map(([gameId, x, y, w, h, color, label], index) => ({
    key: `r${rowIndex}-${index}`,
    gameId,
    label,
    rect: [x, y, w, h],
    displayX: packedX.get(`r${rowIndex}-${index}`),
    color,
    location: `Row ${rowIndex + 1} · cubby ${Math.min(5, Math.floor(x / 240) + 1)}`,
  })),
);

// Top boxes sample the original photo at its 2000 x 1500 reference size.
export const topBoxes: ShelfBox[] = [
  { key: "top-mars", gameId: 311247, rect: [20, -150, 191, 145], photoRect: [321, 245, 175, 112], color: "#344d4d", location: "On top", top: true },
  { key: "top-wingspan", gameId: 266192, label: "Wingspan (Nesting Box)", rect: [221, -170, 199, 165], photoRect: [511, 219, 180, 136], color: "#c7a69b", location: "On top · Nesting Box", top: true },
  { key: "top-ark", gameId: 368966, rect: [221, -231, 199, 58], photoRect: [495, 159, 190, 43], color: "#70a17d", location: "On top", top: true },
  { key: "top-cats", gameId: 281259, rect: [432, -145, 196, 140], photoRect: [716, 230, 187, 120], color: "#c4c2a0", location: "On top", top: true },
  { key: "top-vantage", gameId: 420033, rect: [432, -226, 196, 78], photoRect: [710, 149, 191, 65], color: "#344742", location: "On top", top: true },
  { key: "top-canopy", gameId: 295607, rect: [432, -303, 196, 74], photoRect: [704, 68, 198, 70], color: "#689179", location: "On top", top: true },
  { key: "top-scythe", gameId: 169786, rect: [642, -169, 208, 164], photoRect: [922, 197, 199, 140], color: "#867a65", location: "On top", top: true },
  { key: "top-crate", gameId: null, label: "Wooden collector’s box — not identified", rect: [860, -169, 210, 164], photoRect: [1140, 194, 201, 132], color: "#907143", location: "On top", top: true },
  { key: "top-contagion", gameId: 157789, rect: [860, -218, 112, 46], photoRect: [1135, 142, 104, 37], color: "#706937", location: "On top", top: true },
  { key: "top-canvas", gameId: 290236, rect: [1081, -218, 30, 213], photoRect: [1365, 132, 21, 194], color: "#698175", location: "On top", top: true },
  { key: "top-reflections", gameId: 335172, rect: [1113, -218, 30, 213], photoRect: [1391, 131, 22, 193], color: "#b17861", location: "On top", top: true },
  { key: "top-finishing", gameId: 371924, rect: [1145, -218, 30, 213], photoRect: [1423, 130, 22, 193], color: "#ac6c68", location: "On top", top: true },
];

export const allBoxes = [...shelfBoxes, ...topBoxes];

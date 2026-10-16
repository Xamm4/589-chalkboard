// Scene layout in logical pixels (540×960 portrait canvas).

export const W = 540;
export const H = 960;

export const BOARD = { x: 8, y: 34, w: 416, h: 508 }; // outer frame
export const INNER = { x: 22, y: 48, w: 388, h: 480 }; // writing surface
export const ROWS = { top: 110, h: 32, count: 11, left: 34, baseline: 25 };
export const PUNISH = { top: 470, x: 196, baseline: 508, tallyX: 350 };
export const TRAY = { x: 0, y: 538, w: 438, h: 18 };
export const FLOOR_Y = 706;

export const CLOCK = { x: 484, y: 98, r: 42 };
export const PORTRAIT = { x: 437, y: 160, w: 94, h: 106 };
export const SWITCH = { x: 445, y: 286, w: 18, h: 28 };
export const DOOR = { x: 440, y: 326, w: 98, h: 380, win: { x: 459, y: 348, w: 60, h: 92 } };

export const MASCOT = { x: 6, y: 496, h: 456 };
export const HAND = { x: 206, y: 516 }; // chalk tip of the mascot sprite
export const TEACHER = { x: 432, headY: 600, faceW: 150 };
export const DESK = { x: 300, y: 790, w: 240, h: 170 };
export const BEAR = { x: 262, y: 704 };
export const TRASH = { x: 232, y: 876, w: 50, h: 72 };
export const PLANE_BTN = { x: 372, y: 598, r: 38 };
export const EYE = { x: 216, y: 79 };

export const rowTop = (row) => ROWS.top + row * ROWS.h;
export const rowBaseline = (row) => rowTop(row) + ROWS.baseline;

export const ROW_HEIGHT = 48;
export const HEADER_HEIGHT = 72;
export const LIST_WIDTH = 570;
export const OVERSCAN = 6;
export const ZOOMS = { day: 44, week: 26, month: 12 } as const;
export type Zoom = keyof typeof ZOOMS;
export const BAR_PADDING = 4;

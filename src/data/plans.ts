import { pt } from './course.ts'

/**
 * Starting plans (planned ARRIVAL clock time per station), from the "Runner Plans" tab of
 * Kodiak_2026_Crew_Timeline.xlsx (all four runners, as of Oct 6).
 * Edits made in the app are events and always win over these seeds.
 */
export const SEED_PLANS: Record<string, Record<string, number>> = {
  zane: {
    start: pt(10, 6, 0),
    bm1: pt(10, 7, 3),
    sl1: pt(10, 8, 18),
    bh: pt(10, 11, 13),
    sl2: pt(10, 12, 17),
    bm2: pt(10, 13, 55),
    ss: pt(10, 16, 20),
    hg: pt(10, 17, 52),
    bl: pt(10, 19, 54),
    co: pt(10, 21, 49),
    ag: pt(10, 23, 17),
    fin: pt(11, 2, 0),
  },
  john: {
    start: pt(10, 6, 0),
    bm1: pt(10, 6, 49),
    sl1: pt(10, 7, 48),
    bh: pt(10, 10, 26),
    sl2: pt(10, 11, 22),
    bm2: pt(10, 12, 42),
    ss: pt(10, 14, 32),
    hg: pt(10, 15, 28),
    bl: pt(10, 16, 46),
    co: pt(10, 18, 4),
    ag: pt(10, 18, 56),
    fin: pt(10, 21, 0),
  },
  // Kevy (Runner Plans tab, updated Oct 6)
  kevy: {
    start: pt(10, 6, 0),
    bm1: pt(10, 7, 20),
    sl1: pt(10, 8, 53),
    bh: pt(10, 11, 53),
    sl2: pt(10, 13, 14),
    bm2: pt(10, 15, 5),
    ss: pt(10, 17, 19),
    hg: pt(10, 18, 43),
    bl: pt(10, 20, 25),
    co: pt(10, 22, 11),
    ag: pt(10, 23, 28),
    fin: pt(11, 2, 3),
  },
  // Ryan, 50K (Runner Plans tab, updated Oct 6)
  ryan: {
    start: pt(10, 7, 30),
    ss: pt(10, 8, 58),
    hg: pt(10, 9, 36),
    bl: pt(10, 10, 31),
    co: pt(10, 11, 39),
    ag: pt(10, 12, 26),
    fin: pt(10, 14, 0),
  },
}

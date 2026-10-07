import { pt } from './course.ts'

/**
 * Starting plans (planned ARRIVAL clock time per station), from the "Runner Plans" tab of
 * Kodiak_2026_Crew_Timeline.xlsx. Only Zane's is filled in; John, Kevy and Ryan enter theirs in the app.
 * Edits made in the app are events and always win over these seeds.
 */
export const SEED_PLANS: Record<string, Record<string, number>> = {
  zane: {
    start: pt(10, 6, 0),
    bm1: pt(10, 6, 59),
    sl1: pt(10, 8, 10),
    bh: pt(10, 11, 4),
    sl2: pt(10, 12, 8),
    bm2: pt(10, 13, 44),
    ss: pt(10, 16, 6),
    hg: pt(10, 17, 42),
    bl: pt(10, 19, 49),
    co: pt(10, 21, 44),
    ag: pt(10, 23, 12),
    fin: pt(11, 2, 0),
  },
  john: {},
  // Kevy (sheet updated Oct 6). The sheet's Finish "2:03 PM" is read as Sun 2:03 AM (first time after Aspen Glen).
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
  // Ryan, 50K (sheet updated Oct 6). The sheet's Aspen Glen "12:26 AM" is read as 12:26 PM (between Camp Osito and the Finish).
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

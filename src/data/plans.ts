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
  kevy: {},
  ryan: {},
}

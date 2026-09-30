import type { Meeting, Schedule } from "./generate";
import { parseWeeks } from "./weeks";

// A drawn meeting: `lane` of `lanes` columns within its day, so meetings at
// the same time in different weeks sit side by side instead of overlapping.
export type Block = Meeting & { lane: number; lanes: number };
export type OneOff = Meeting & { weekList: number[] };

export type WeekLayout = {
  days: number[];
  startMin: number;
  endMin: number;
  blocks: Block[];
  oneOffs: OneOff[];
};

// Meetings that run this few weeks (assessments, one-off labs) would clutter
// a typical week, so they're listed under the grid instead.
export const ONE_OFF_MAX_WEEKS = 2;
const WEEKDAYS = [0, 1, 2, 3, 4];
const HOUR = 60;

export function layoutWeek(schedule: Schedule): WeekLayout {
  const recurring: Meeting[] = [];
  const oneOffs: OneOff[] = [];
  for (const meeting of schedule.flatMap((option) => option.meetings)) {
    const weeks = parseWeeks(meeting.weeks);
    if (weeks.size > 0 && weeks.size <= ONE_OFF_MAX_WEEKS) {
      oneOffs.push({ ...meeting, weekList: [...weeks].sort((a, b) => a - b) });
    } else {
      recurring.push(meeting);
    }
  }

  const days = [...new Set([...WEEKDAYS, ...recurring.map((m) => m.day)])].sort((a, b) => a - b);
  const startMin = Math.min(9 * HOUR, ...recurring.map((m) => Math.floor(m.startMin / HOUR) * HOUR));
  const endMin = Math.max(17 * HOUR, ...recurring.map((m) => Math.ceil(m.finishMin / HOUR) * HOUR));

  const blocks: Block[] = [];
  for (const day of days) {
    const today = recurring
      .filter((m) => m.day === day)
      .sort((a, b) => a.startMin - b.startMin || a.finishMin - b.finishMin);
    const placed: Block[] = [];
    let laneEnds: number[] = [];
    let cluster: Block[] = [];
    let clusterEnd = -Infinity;
    for (const meeting of today) {
      if (meeting.startMin >= clusterEnd) {
        for (const block of cluster) block.lanes = laneEnds.length;
        placed.push(...cluster);
        cluster = [];
        laneEnds = [];
        clusterEnd = -Infinity;
      }
      let lane = laneEnds.findIndex((end) => end <= meeting.startMin);
      if (lane === -1) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = meeting.finishMin;
      clusterEnd = Math.max(clusterEnd, meeting.finishMin);
      cluster.push({ ...meeting, lane, lanes: 0 });
    }
    for (const block of cluster) block.lanes = laneEnds.length;
    placed.push(...cluster);
    blocks.push(...placed);
  }

  oneOffs.sort((a, b) => a.weekList[0] - b.weekList[0] || a.day - b.day || a.startMin - b.startMin);
  return { days, startMin, endMin, blocks, oneOffs };
}

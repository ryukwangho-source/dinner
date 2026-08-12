import type { VoteDuration } from "@/types/vote";

/** 제한시간 선택지를 기준 시각으로부터의 마감 시각으로 변환한다. "tomorrow"는 다음 날 자정 직전(23:59:59)까지. */
export function computeDeadline(duration: VoteDuration, now: Date): Date {
  const deadline = new Date(now);
  switch (duration) {
    case "30m":
      deadline.setMinutes(deadline.getMinutes() + 30);
      return deadline;
    case "1h":
      deadline.setHours(deadline.getHours() + 1);
      return deadline;
    case "3h":
      deadline.setHours(deadline.getHours() + 3);
      return deadline;
    case "tomorrow": {
      deadline.setDate(deadline.getDate() + 1);
      deadline.setHours(23, 59, 59, 999);
      return deadline;
    }
  }
}

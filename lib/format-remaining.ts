/** 마감까지 남은 시간을 "1시간 24분 남음" 형식으로. 이미 지났으면 "마감". */
export function formatRemaining(deadlineAt: string, now: Date): string {
  const diffMs = new Date(deadlineAt).getTime() - now.getTime();
  if (diffMs <= 0) return "마감";

  const totalMinutes = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 남음`;
}

/** 마감 절대 시각을 "8월 13일 21:00 마감" 형식으로. */
export function formatDeadline(deadlineAt: string): string {
  const d = new Date(deadlineAt);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month}월 ${date}일 ${hh}:${mm} 마감`;
}

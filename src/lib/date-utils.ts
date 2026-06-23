// Date options: today through the next 6 days (7 entries total)

export interface DateOption {
  value: string; // YYYY-MM-DD
  label: string; // e.g. "오늘", "내일", "6/9 (월)"
  short: string; // e.g. "오늘", "내일", "월"
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getDateOptions(base: Date = new Date()): DateOption[] {
  const opts: DateOption[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const wd = WEEKDAYS[d.getDay()];
    const md = `${d.getMonth() + 1}/${d.getDate()}`;
    let label = `${md} (${wd})`;
    let short = wd;
    if (i === 0) {
      label = "오늘";
      short = "오늘";
    } else if (i === 1) {
      label = "내일";
      short = "내일";
    }
    opts.push({ value: toYmd(d), label, short });
  }
  return opts;
}

export function defaultDate(): string {
  return toYmd(new Date());
}

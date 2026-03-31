export interface LotteryWinner {
  guestId: string;
  name: string;
  timeUtc: string;
}

function key(banquetId: string) {
  return `wedding-ledger.lottery.${banquetId}`;
}

export function loadLotteryWinners(banquetId: string): LotteryWinner[] {
  try {
    const raw = localStorage.getItem(key(banquetId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.guestId === "string");
  } catch {
    return [];
  }
}

export function saveLotteryWinners(banquetId: string, winners: LotteryWinner[]) {
  localStorage.setItem(key(banquetId), JSON.stringify(winners));
}

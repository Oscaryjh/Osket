export function countBillableCheckIns(guests: { checkIn?: { status?: string } }[]) {
  return guests.filter((g) => g.checkIn?.status === "checked_in").length;
}

export function calcAmountRm(billableCount: number, rateRm: number) {
  const v = billableCount * rateRm;
  return Math.round(v * 100) / 100;
}

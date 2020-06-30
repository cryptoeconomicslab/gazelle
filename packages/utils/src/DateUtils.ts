export function getCurrentDate(): number {
  return Math.round(new Date().getTime() / 1000)
}

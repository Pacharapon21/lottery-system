export function formatTicketNumber(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 99_999) {
    throw new RangeError("Ticket number must be an integer from 1 to 99999.");
  }
  return String(value).padStart(5, "0");
}

export function isValidTicketNumber(value: string): boolean {
  return /^(?!00000)\d{5}$/.test(value);
}

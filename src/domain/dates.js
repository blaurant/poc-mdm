/**
 * Date helpers of the domain (technical, hence in English).
 *
 * Dates are kept as ISO strings without time zone:
 *  - calendar dates: 'YYYY-MM-DD'
 *  - date-times: 'YYYY-MM-DDTHH:mm:ss' (local time of the hospital)
 * Strings in this format can be compared lexicographically.
 *
 * Source date formats are named in the domain language:
 *  - 'date-iso': YYYY-MM-DD
 *  - 'date-heure-iso': YYYY-MM-DDTHH:mm[:ss]
 *  - 'date-francaise': DD/MM/YYYY
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const FRENCH_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function pad(number) {
  return String(number).padStart(2, '0');
}

/**
 * Parses a raw calendar date.
 * @param {unknown} raw
 * @param {'date-iso' | 'date-francaise'} format
 * @returns {string | null} 'YYYY-MM-DD' or null when the value cannot be parsed
 */
export function parseDate(raw, format) {
  if (raw === null || raw === undefined || raw === '') return null;
  const text = String(raw).trim();
  let year;
  let month;
  let day;
  if (format === 'date-iso') {
    const match = ISO_DATE.exec(text) ?? ISO_DATE_TIME.exec(text);
    if (!match) return null;
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if (format === 'date-francaise') {
    const match = FRENCH_DATE.exec(text);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  return isCalendarDate(year, month, day) ? `${year}-${pad(month)}-${pad(day)}` : null;
}

/**
 * Parses a raw date-time. A calendar date is accepted and set to midnight.
 * @param {unknown} raw
 * @param {'date-heure-iso' | 'date-iso' | 'date-francaise'} format
 * @returns {string | null} 'YYYY-MM-DDTHH:mm:ss' or null
 */
export function parseDateTime(raw, format) {
  if (raw === null || raw === undefined || raw === '') return null;
  const text = String(raw).trim();
  if (format === 'date-heure-iso') {
    const match = ISO_DATE_TIME.exec(text);
    if (!match) return parseDateTime(text, 'date-iso');
    const date = parseDate(text, 'date-iso');
    if (!date) return null;
    return `${date}T${match[4]}:${match[5]}:${match[6] ?? '00'}`;
  }
  const date = parseDate(text, format);
  return date ? `${date}T00:00:00` : null;
}

/**
 * Turns a point in time given as a date or a date-time into a comparable date-time.
 * A calendar date means the end of that day.
 * @param {string} value
 * @returns {string}
 */
export function endOfDayInstant(value) {
  return ISO_DATE.test(value) ? `${value}T23:59:59` : parseDateTime(value, 'date-heure-iso');
}

/** @param {string} dateTime @returns {string} the 'YYYY-MM-DD' part */
export function datePart(dateTime) {
  return dateTime.slice(0, 10);
}

/**
 * Number of whole days from `from` to `to` (both 'YYYY-MM-DD').
 * @returns {number}
 */
export function daysBetween(from, to) {
  const toUtc = (date) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

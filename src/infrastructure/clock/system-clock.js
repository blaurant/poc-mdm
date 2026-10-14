/** Clock reading the system time, formatted as a local date-time 'YYYY-MM-DDTHH:mm:ss'. Implements the Horloge port. */
export class SystemClock {
  maintenant() {
    const date = new Date();
    const pad = (number) => String(number).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  }
}

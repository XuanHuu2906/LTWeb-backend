/**
 * Parse a duration string like '30d', '7d', '24h', '15m' to milliseconds
 */
export const parseDuration = (duration: string): number => {
  const match = duration.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000; // Default: 7 days in ms
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
};

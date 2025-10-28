import moment from 'moment-timezone';
import { config } from '../config.js';

moment.defaultFormat = 'YYYY-MM-DD HH:mm:ss';

export function getNow(): string {
  let m = moment();
  
  if (config.timezone && config.timezone !== '') {
    try {
      m = m.tz(config.timezone);
    } catch (e) {
      // invalid timezone — fall back to local moment
    }
  }

  return m.format('YYYY-MM-DD HH:mm:ss');
}

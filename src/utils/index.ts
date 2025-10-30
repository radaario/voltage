import { config } from '../config';

import os from 'os';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment-timezone';

moment.defaultFormat = 'YYYY-MM-DD HH:mm:ss';

const networkInterfaces = os.networkInterfaces();

export function createInstanceKey(): string {
  if(config.instances.key_method === 'IP_ADDRESS'){
    const ipAddress = getInstanceLocalIpAddress();
    return hash(ipAddress || uuid());
  }

  return uukey();
}

export function getInstanceSystemInfo(): any{
  return {
    hostname: os.hostname(),
    ip_address: getInstanceLocalIpAddress(),
    port: config.port,
    os_platform: os.platform(),
    os_release: os.release(),
    cpu_core_count: os.cpus().length,
    cpu_frequency_mhz: getInstanceCpuFrequencyMHz(),
    cpu_usage_percent: getInstanceCpuUsagePercent(),
    memory_total: os.totalmem(),
    memory_free: os.freemem(),
    memory_usage_percent: getInstanceMemoryUsagePercent(),
  };
}

export function getInstanceLocalIpAddress(): string | null {
  for (const iface of Object.values(networkInterfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      const family = String((addr as any).family);
      if (family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }

  return null;
}

export function getInstanceCpuFrequencyMHz(): number {
  try {
    const cpus = os.cpus();
    if (cpus.length === 0) return 0;
    const totalSpeed = cpus.reduce((acc, cpu) => acc + cpu.speed, 0);
    return totalSpeed / cpus.length;
  } catch (e) {
  }
  
  return 0;
}

export function getInstanceCpuUsagePercent(): number {
  try {
    const cpus = os.cpus();
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0);
    const idlePercentage = (totalIdle / totalTick) * 100;
    return parseFloat((100 - idlePercentage).toFixed(2)); // Return CPU usage percentage as a two decimal float
  } catch (e) {
  }
  
  return 0;
}

export function getInstanceMemoryUsagePercent(): number {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return parseFloat(((usedMemory / totalMemory) * 100).toFixed(2)); // Return memory usage percentage
  } catch (e) {
  }
  
  return 0;
}

export function uuid(): string {
  return uuidv4();
}

export function uukey(): string {
  return hash(uuidv4());
}

export function hash(data: string, algorithm: 'MD5' | 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
}

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

export function addNow(amount: number, unit: moment.unitOfTime.DurationConstructor): string {
  let m = moment();
  if (config.timezone && config.timezone !== '') {
    try {
      m = m.tz(config.timezone);
    } catch (e) {
      // invalid timezone — fall back to local moment
    }
  }

  return m.add(amount, unit).format('YYYY-MM-DD HH:mm:ss');
}

export function subtractNow(amount: number, unit: moment.unitOfTime.DurationConstructor): string {
  let m = moment();

  if (config.timezone && config.timezone !== '') {
    try {
      m = m.tz(config.timezone);
    } catch (e) {
      // invalid timezone — fall back to local moment
    }
  }

  return m.subtract(amount, unit).format('YYYY-MM-DD HH:mm:ss');
}

// Sanitize sensitive fields from objects
export function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  const sensitiveFields = ['password', 'key', 'secret'];
  
  // Remove sensitive fields
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }

  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = sanitized[key].map((item: any) => sanitizeData(item));
    }
  }
  
  return sanitized;
}
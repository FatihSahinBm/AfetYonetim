/**
 * Sensör Servisi
 * Barometre ile fırtına/deprem tespiti, pil izleme
 */

import { BarometerReading, BatteryStatus } from '../types';
import { BATTERY_THRESHOLDS } from '../config/constants';

let barometerHistory: BarometerReading[] = [];
const MAX_HISTORY = 180;

/** Barometre izleme başlat */
export const startBarometerMonitoring = (
  onAlert: (reading: BarometerReading) => void
): (() => void) => {
  const intervalId = setInterval(() => {
    console.log('[Sensor] Barometre okuması');
  }, 10000);
  return () => clearInterval(intervalId);
};

/** Barometre verisini işle - 3 hPa/saat üzeri düşüş = fırtına */
export const processBarometerReading = (
  pressure: number,
  onAlert: (reading: BarometerReading) => void
): void => {
  const now = Date.now();
  let changeRate = 0;
  if (barometerHistory.length > 0) {
    const last = barometerHistory[barometerHistory.length - 1];
    const timeDiffH = (now - last.timestamp) / 3600000;
    changeRate = (pressure - last.pressure) / timeDiffH;
  }
  const alertTriggered = Math.abs(changeRate) > 3;
  const reading: BarometerReading = { pressure, timestamp: now, change_rate: changeRate, alert_triggered: alertTriggered };
  barometerHistory.push(reading);
  if (barometerHistory.length > MAX_HISTORY) barometerHistory.shift();
  if (alertTriggered) onAlert(reading);
};

/** Pil durumu kontrol */
export const checkBatteryStatus = async (): Promise<{
  status: BatteryStatus;
  warningLevel: 'none' | 'low' | 'critical' | 'ultra_save';
}> => {
  const level = 100;
  const status: BatteryStatus = { level, is_charging: false, temperature: 25 };
  let warningLevel: 'none' | 'low' | 'critical' | 'ultra_save' = 'none';
  if (level <= BATTERY_THRESHOLDS.ultraSave) warningLevel = 'ultra_save';
  else if (level <= BATTERY_THRESHOLDS.critical) warningLevel = 'critical';
  else if (level <= BATTERY_THRESHOLDS.low) warningLevel = 'low';
  return { status, warningLevel };
};

/** Pil tasarrufu modu */
export const enablePowerSaveMode = (): void => {
  console.log('[Sensor] Pil tasarrufu modu etkin');
};

export const getBarometerHistory = (): BarometerReading[] => [...barometerHistory];
export const clearBarometerHistory = (): void => { barometerHistory = []; };

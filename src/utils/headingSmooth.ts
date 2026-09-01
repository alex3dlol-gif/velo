/** Кратчайшая разница углов в градусах [-180, 180]. */
export function angleDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Экспоненциальное сглаживание угла с ограничением скорости поворота. */
export class HeadingSmoother {
  private value: number | null = null;

  reset(heading?: number | null) {
    this.value = heading != null && !Number.isNaN(heading) ? normalizeAngle(heading) : null;
  }

  update(raw: number, dtSec: number, speedKmh: number): number {
    const target = normalizeAngle(raw);
    if (this.value === null) {
      this.value = target;
      return target;
    }

    let diff = angleDelta(this.value, target);
    const deadZone = speedKmh < 4 ? 4 : 2;
    if (Math.abs(diff) < deadZone) return this.value;

    // При движении быстрее доверяем GPS-курсу, на месте — компасу.
    const tau = speedKmh > 12 ? 0.12 : speedKmh > 5 ? 0.2 : 0.35;
    const alpha = 1 - Math.exp(-Math.max(dtSec, 0.001) / tau);
    const maxRate = speedKmh > 5 ? 120 : 45;
    const maxStep = maxRate * Math.max(dtSec, 0.001);
    if (Math.abs(diff) > maxStep) diff = Math.sign(diff) * maxStep;

    this.value = normalizeAngle(this.value + diff * alpha);
    return this.value;
  }
}

/** Сглаживание координат маркера — как в навигаторах (EMA по lat/lng). */
export class PositionSmoother {
  private lat: number | null = null;
  private lng: number | null = null;

  reset(lat?: number, lng?: number) {
    this.lat = lat ?? null;
    this.lng = lng ?? null;
  }

  update(lat: number, lng: number, dtSec: number, speedKmh: number, accuracyM: number): { lat: number; lng: number } {
    if (this.lat === null || this.lng === null) {
      this.lat = lat;
      this.lng = lng;
      return { lat, lng };
    }

    const noisy = accuracyM > 80;
    const tau = noisy ? 0.9 : speedKmh > 20 ? 0.25 : speedKmh > 8 ? 0.4 : 0.55;
    const alpha = 1 - Math.exp(-Math.max(dtSec, 0.001) / tau);
    this.lat += (lat - this.lat) * alpha;
    this.lng += (lng - this.lng) * alpha;
    return { lat: this.lat, lng: this.lng };
  }
}

/** Выбор источника курса: компас на месте, GPS-курс в движении. */
export function pickHeadingSource(
  compass: number | null,
  gpsCourse: number | null,
  speedKmh: number,
): number | null {
  if (speedKmh > 6 && gpsCourse != null) return gpsCourse;
  if (compass != null) return compass;
  return gpsCourse;
}

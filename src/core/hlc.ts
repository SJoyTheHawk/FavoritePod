import type { HLC } from './types';

const WALL_WIDTH = 16;
const COUNTER_WIDTH = 8;
const MAX_COUNTER = 10 ** COUNTER_WIDTH - 1;

interface ParsedHLC {
  wallMs: number;
  counter: number;
  deviceId: string;
}

function parse(value: HLC): ParsedHLC {
  const firstSeparator = value.indexOf('-');
  const secondSeparator = value.indexOf('-', firstSeparator + 1);
  if (firstSeparator < 1 || secondSeparator < 0) {
    throw new Error(`Invalid hybrid logical clock: ${value}`);
  }

  const wallMs = Number(value.slice(0, firstSeparator));
  const counter = Number(value.slice(firstSeparator + 1, secondSeparator));
  const deviceId = value.slice(secondSeparator + 1);
  if (!Number.isSafeInteger(wallMs) || !Number.isSafeInteger(counter) || !deviceId) {
    throw new Error(`Invalid hybrid logical clock: ${value}`);
  }

  return { wallMs, counter, deviceId };
}

export function createHLC(wallMs: number, counter: number, deviceId: string): HLC {
  if (!Number.isSafeInteger(wallMs) || wallMs < 0) {
    throw new Error('HLC wall time must be a non-negative integer.');
  }
  if (!Number.isSafeInteger(counter) || counter < 0 || counter > MAX_COUNTER) {
    throw new Error('HLC counter is outside the supported range.');
  }
  if (!deviceId) throw new Error('HLC device ID cannot be empty.');

  return `${String(wallMs).padStart(WALL_WIDTH, '0')}-${String(counter).padStart(COUNTER_WIDTH, '0')}-${deviceId}`;
}

export function compareHLC(left: HLC, right: HLC): number {
  parse(left);
  parse(right);
  return left === right ? 0 : left < right ? -1 : 1;
}

export function tickHLC(
  previous: HLC | undefined,
  deviceId: string,
  now = Date.now(),
): HLC {
  if (!Number.isSafeInteger(now) || now < 0)
    throw new Error('HLC time must be a non-negative integer.');
  if (!previous) return createHLC(now, 0, deviceId);

  const last = parse(previous);
  if (now > last.wallMs) return createHLC(now, 0, deviceId);
  if (last.counter === MAX_COUNTER) return createHLC(last.wallMs + 1, 0, deviceId);
  return createHLC(last.wallMs, last.counter + 1, deviceId);
}

export function receiveHLC(
  previous: HLC | undefined,
  remote: HLC,
  deviceId: string,
  now = Date.now(),
): HLC {
  if (!Number.isSafeInteger(now) || now < 0)
    throw new Error('HLC time must be a non-negative integer.');
  const remoteClock = parse(remote);
  const localClock = previous ? parse(previous) : undefined;
  const wallMs = Math.max(now, remoteClock.wallMs, localClock?.wallMs ?? 0);

  let counter = 0;
  if (localClock?.wallMs === wallMs && remoteClock.wallMs === wallMs) {
    counter = Math.max(localClock.counter, remoteClock.counter) + 1;
  } else if (localClock?.wallMs === wallMs) {
    counter = localClock.counter + 1;
  } else if (remoteClock.wallMs === wallMs) {
    counter = remoteClock.counter + 1;
  }

  if (counter > MAX_COUNTER) return createHLC(wallMs + 1, 0, deviceId);
  return createHLC(wallMs, counter, deviceId);
}

export function latestHLC(clocks: readonly HLC[]): HLC {
  if (clocks.length === 0) throw new Error('At least one HLC is required.');
  return clocks.reduce((latest, value) =>
    compareHLC(value, latest) > 0 ? value : latest,
  );
}

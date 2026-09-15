import { describe, expect, it, vi } from "vitest";
import { watchLocation, type LocationEvent } from "../src/geo/location";

function fakeGeolocation() {
  let onSuccess: PositionCallback = () => {};
  let onError: PositionErrorCallback = () => {};
  const watchPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
    onSuccess = success;
    onError = error ?? (() => {});
    return 7;
  });
  const clearWatch = vi.fn();
  return {
    geolocation: { watchPosition, clearWatch, getCurrentPosition: vi.fn() } as unknown as Geolocation,
    watchPosition,
    clearWatch,
    emit(latitude: number, longitude: number, accuracy: number) {
      onSuccess({ coords: { latitude, longitude, accuracy } } as GeolocationPosition);
    },
    fail(code: number) {
      onError({ code, message: "" } as GeolocationPositionError);
    },
  };
}

describe("watchLocation", () => {
  it("emits position events", () => {
    const fake = fakeGeolocation();
    const events: LocationEvent[] = [];
    watchLocation(fake.geolocation, (event) => events.push(event));

    fake.emit(45.8131, 15.9772, 12);

    expect(events).toEqual([{ type: "position", lat: 45.8131, lon: 15.9772, accuracyM: 12 }]);
  });

  it("requests high accuracy with a 10 s timeout", () => {
    const fake = fakeGeolocation();
    watchLocation(fake.geolocation, () => {});

    expect(fake.watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ])("maps error code %d to %s", (code, reason) => {
    const fake = fakeGeolocation();
    const events: LocationEvent[] = [];
    watchLocation(fake.geolocation, (event) => events.push(event));

    fake.fail(code);

    expect(events).toEqual([{ type: "error", reason }]);
  });

  it("stops watching when the returned function is called", () => {
    const fake = fakeGeolocation();
    const stop = watchLocation(fake.geolocation, () => {});

    stop();

    expect(fake.clearWatch).toHaveBeenCalledWith(7);
  });

  it("reports unavailable when the browser has no geolocation", () => {
    const events: LocationEvent[] = [];
    const stop = watchLocation(undefined, (event) => events.push(event));

    expect(events).toEqual([{ type: "error", reason: "unavailable" }]);
    expect(() => stop()).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { clampCrop, cropGeometry, DEFAULT_CROP, MAX_ZOOM } from "../src/portraits";

describe("portrait crop", () => {
  it("covers the square with the shorter side at zoom 1", () => {
    // A tall 400×800 image in a 200 px square: drawn 200×400, centered horizontally.
    expect(cropGeometry(400, 800, 200, { zoom: 1, x: 0, y: 0 })).toEqual({ left: 0, top: -100, width: 200, height: 400 });
  });

  it("pans from edge to edge", () => {
    expect(cropGeometry(400, 800, 200, { zoom: 1, x: 0, y: 1 }).top).toBe(0); // top edge
    expect(cropGeometry(400, 800, 200, { zoom: 1, x: 0, y: -1 }).top).toBe(-200); // bottom edge
    // Default: a little above the middle, like the portraits shown before cropping existed.
    expect(cropGeometry(400, 800, 200, DEFAULT_CROP).top).toBeCloseTo(-40);
  });

  it("zooms around the middle and never leaves a gap", () => {
    const r = cropGeometry(300, 300, 300, { zoom: 2, x: 0, y: 0 });
    expect(r).toEqual({ left: -150, top: -150, width: 600, height: 600 });
    for (const crop of [{ zoom: 3, x: 1, y: -1 }, { zoom: 1.5, x: -1, y: 1 }, { zoom: 9, x: 5, y: -5 }]) {
      const g = cropGeometry(640, 480, 512, crop);
      expect(g.left).toBeLessThanOrEqual(0);
      expect(g.top).toBeLessThanOrEqual(0);
      expect(g.left + g.width).toBeGreaterThanOrEqual(512);
      expect(g.top + g.height).toBeGreaterThanOrEqual(512);
    }
  });

  it("keeps zoom and pan in range", () => {
    expect(clampCrop({ zoom: 0.2, x: 3, y: -3 })).toEqual({ zoom: 1, x: 1, y: -1 });
    expect(clampCrop({ zoom: 99, x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
  });
});

import { describe, expect, it } from "vitest";
import { convertUnits, formatDistance, formatWeight } from "../src/index.js";

const m = (s: string) => convertUnits(s, "metric");

describe("units", () => {
  it("leaves text alone in imperial", () => {
    expect(convertUnits("within 30 feet", "imperial")).toBe("within 30 feet");
  });

  it("converts distances on the 1.5 m grid", () => {
    expect(m("Each creature in a 20-foot-radius sphere centered on a point within 150 feet")).toBe(
      "Each creature in a 6-meter-radius sphere centered on a point within 45 m",
    );
    expect(m("Self (15-foot cone)")).toBe("Self (4.5-meter cone)");
    expect(m("Speed 40 ft., climb 30 ft.")).toBe("Speed 12 m, climb 9 m");
    expect(m("up to 1,000 feet away")).toBe("up to 300 m away");
    expect(m("a line 100 feet long and 5 feet wide")).toBe("a line 30 m long and 1.5 m wide");
    expect(m("5 to 10 feet")).toBe("1.5 to 3 m");
    expect(m("10–20 feet tall")).toBe("3–6 m tall");
    expect(m("+10 feet at 2nd level")).toBe("+3 m at 2nd level");
    expect(m("2 1/2 feet")).toBe("0.75 m");
    expect(m("They stand well under five feet tall")).toBe("They stand well under 1.5 m tall");
  });

  it("converts other units", () => {
    expect(m("2 lb.")).toBe("1 kg");
    expect(m("1/2 lb.")).toBe("0.25 kg");
    expect(m("up to 500 pounds, not exceeding a volume of 64 cubic feet")).toBe("up to 250 kg, not exceeding a volume of 1.73 m³");
    expect(m("24 miles per day")).toBe("36 km per day");
    expect(m("within half a mile")).toBe("within 0.75 km");
    expect(m("a 6-inch-long blade")).toBe("a 15-centimeter-long blade");
  });

  it("doesn't touch things that aren't measurements", () => {
    for (const s of ["Staying on your feet", "one of the two feet", "level 5 features", "1d8+5 feet", "ice pounds the ground"]) {
      expect(m(s)).toBe(s);
    }
  });

  it("formats numbers from the sheet", () => {
    expect(formatDistance(30, "imperial")).toBe("30 ft.");
    expect(formatDistance(30, "metric")).toBe("9 m");
    expect(formatDistance(35, "metric")).toBe("10.5 m");
    expect(formatWeight(3, "metric")).toBe("1.5 kg");
  });
});

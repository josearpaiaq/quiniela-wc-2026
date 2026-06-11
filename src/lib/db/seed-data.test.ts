import { describe, expect, it } from "vitest";
import { MATCHES, TEAMS, type GroupLetter } from "./seed-data";

const GROUPS: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

describe("seed teams", () => {
  it("has 48 teams with unique codes", () => {
    expect(TEAMS).toHaveLength(48);
    expect(new Set(TEAMS.map((t) => t.code)).size).toBe(48);
  });

  it("has 4 teams per group with draw positions 1-4", () => {
    for (const group of GROUPS) {
      const teams = TEAMS.filter((t) => t.group === group);
      expect(teams, `group ${group}`).toHaveLength(4);
      expect(teams.map((t) => t.drawPosition).sort()).toEqual([1, 2, 3, 4]);
    }
  });

  it("includes the six March 2026 playoff winners", () => {
    const codes = new Set(TEAMS.map((t) => t.code));
    for (const code of ["CZE", "BIH", "SWE", "TUR", "IRQ", "COD"]) {
      expect(codes.has(code), code).toBe(true);
    }
  });
});

describe("seed matches", () => {
  it("has matches 1-104 with no gaps or duplicates", () => {
    expect(MATCHES).toHaveLength(104);
    const ids = MATCHES.map((m) => m.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 104 }, (_, i) => i + 1));
  });

  it("has the right number of matches per phase", () => {
    const byPhase = (phase: string) => MATCHES.filter((m) => m.phase === phase).length;
    expect(byPhase("group")).toBe(72);
    expect(byPhase("r32")).toBe(16);
    expect(byPhase("r16")).toBe(8);
    expect(byPhase("qf")).toBe(4);
    expect(byPhase("sf")).toBe(2);
    expect(byPhase("third")).toBe(1);
    expect(byPhase("final")).toBe(1);
  });

  it("has valid UTC kickoff timestamps within the tournament window", () => {
    for (const m of MATCHES) {
      const date = new Date(m.kickoffAt);
      expect(Number.isNaN(date.getTime()), `match ${m.id}`).toBe(false);
      expect(date.getTime()).toBeGreaterThanOrEqual(Date.parse("2026-06-11T00:00:00Z"));
      expect(date.getTime()).toBeLessThanOrEqual(Date.parse("2026-07-20T00:00:00Z"));
    }
  });

  it("group matches: 6 per group, teams belong to the group, every pair plays once", () => {
    for (const group of GROUPS) {
      const matches = MATCHES.filter((m) => m.phase === "group" && m.group === group);
      expect(matches, `group ${group}`).toHaveLength(6);
      const groupCodes = new Set(TEAMS.filter((t) => t.group === group).map((t) => t.code));
      const pairs = new Set<string>();
      for (const m of matches) {
        expect(groupCodes.has(m.home!), `match ${m.id} home`).toBe(true);
        expect(groupCodes.has(m.away!), `match ${m.id} away`).toBe(true);
        pairs.add([m.home!, m.away!].sort().join("-"));
      }
      expect(pairs.size, `group ${group} unique pairings`).toBe(6);
    }
  });

  it("every team plays exactly 3 group matches", () => {
    const count = new Map<string, number>();
    for (const m of MATCHES.filter((m) => m.phase === "group")) {
      count.set(m.home!, (count.get(m.home!) ?? 0) + 1);
      count.set(m.away!, (count.get(m.away!) ?? 0) + 1);
    }
    expect(count.size).toBe(48);
    for (const [code, n] of count) expect(n, code).toBe(3);
  });

  it("R32 consumes each group winner and runner-up exactly once, plus 8 third-place slots", () => {
    const r32 = MATCHES.filter((m) => m.phase === "r32");
    const sources = r32.flatMap((m) => [m.homeSource!, m.awaySource!]);
    for (const group of GROUPS) {
      expect(sources.filter((s) => s === `${group}1`), `${group}1`).toHaveLength(1);
      expect(sources.filter((s) => s === `${group}2`), `${group}2`).toHaveLength(1);
    }
    const thirdSlots = sources.filter((s) => s.startsWith("3"));
    expect(thirdSlots).toHaveLength(8);
    for (const slot of thirdSlots) {
      expect(slot, slot).toMatch(/^3[A-L]{5}$/);
    }
  });

  it("knockout progression references exist and rounds chain correctly", () => {
    const byId = new Map(MATCHES.map((m) => [m.id, m]));
    const expectWinnersOf = (phase: string, fromPhase: string) => {
      for (const m of MATCHES.filter((m) => m.phase === phase)) {
        for (const source of [m.homeSource!, m.awaySource!]) {
          expect(source, `match ${m.id}`).toMatch(/^[WL]\d+$/);
          const ref = byId.get(Number(source.slice(1)));
          expect(ref, `match ${m.id} -> ${source}`).toBeDefined();
          expect(ref!.phase, `match ${m.id} -> ${source}`).toBe(fromPhase);
        }
      }
    };
    expectWinnersOf("r16", "r32");
    expectWinnersOf("qf", "r16");
    expectWinnersOf("sf", "qf");
    expectWinnersOf("third", "sf");
    expectWinnersOf("final", "sf");
    const r16Sources = MATCHES.filter((m) => m.phase === "r16").flatMap((m) => [
      m.homeSource!,
      m.awaySource!,
    ]);
    expect(new Set(r16Sources).size).toBe(16); // every R32 winner used exactly once
  });
});

import { describe, expect, it } from "vitest";
import { createCoalescer } from "./createCoalescer";

function setup() {
  let time = 1000;
  const coalescer = createCoalescer({ windowMs: 400, now: () => time });
  return {
    coalescer,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("createCoalescer", () => {
  it("treats the first event as a new run", () => {
    expect(setup().coalescer.tick()).toBe(false);
  });

  it("continues a run while gaps stay inside the window", () => {
    const { coalescer, advance } = setup();
    coalescer.tick();
    advance(100);
    expect(coalescer.tick()).toBe(true);
    advance(400);
    expect(coalescer.tick()).toBe(true);
  });

  it("measures the gap from the latest event, not the run start", () => {
    const { coalescer, advance } = setup();
    coalescer.tick();
    for (let i = 0; i < 5; i += 1) {
      advance(300);
      expect(coalescer.tick()).toBe(true);
    }
  });

  it("opens a new run after a gap longer than the window", () => {
    const { coalescer, advance } = setup();
    coalescer.tick();
    advance(401);
    expect(coalescer.tick()).toBe(false);
    advance(10);
    expect(coalescer.tick()).toBe(true);
  });

  it("reset ends the current run", () => {
    const { coalescer, advance } = setup();
    coalescer.tick();
    coalescer.reset();
    advance(10);
    expect(coalescer.tick()).toBe(false);
  });

  it("defaults to the real clock", () => {
    const coalescer = createCoalescer({ windowMs: 10_000 });
    coalescer.tick();
    expect(coalescer.tick()).toBe(true);
  });
});

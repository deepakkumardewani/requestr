/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AliasCollisionWarning } from "./AliasCollisionWarning";

afterEach(cleanup);

describe("AliasCollisionWarning", () => {
  it("renders nothing when there are no collisions", () => {
    const { container } = render(<AliasCollisionWarning collisions={{}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("announces the collision as an alert with the title", () => {
    render(
      <AliasCollisionWarning
        collisions={{
          token: [
            { kind: "start", id: "s1" },
            { kind: "display", id: "d1" },
          ],
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Alias collision detected:",
    );
  });

  it("names the alias, its placeholder and each distinct producer kind", () => {
    render(
      <AliasCollisionWarning
        collisions={{
          token: [
            { kind: "start", id: "s1" },
            { kind: "display", id: "d1" },
          ],
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "token is written by 1 Start input, 1 Display block. {{token}} resolves to whichever runs last",
    );
  });

  it("groups repeated producers of one kind into a single pluralised count", () => {
    render(
      <AliasCollisionWarning
        collisions={{
          id: [
            { kind: "edge", id: "e1" },
            { kind: "edge", id: "e2" },
            { kind: "edge", id: "e3" },
            { kind: "evaluate", id: "v1" },
          ],
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "id is written by 3 edges, 1 Evaluate block.",
    );
  });

  it("renders the loop index producer without a count", () => {
    render(
      <AliasCollisionWarning
        collisions={{
          index: [{ kind: "loopIndex" }, { kind: "loop", id: "l1" }],
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "index is written by Loop index, 1 Loop item alias.",
    );
  });

  it("renders one line per colliding alias", () => {
    render(
      <AliasCollisionWarning
        collisions={{
          a: [
            { kind: "start", id: "s1" },
            { kind: "start", id: "s2" },
          ],
          b: [
            { kind: "loop", id: "l1" },
            { kind: "edge", id: "e1" },
          ],
        }}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("a is written by 2 Start inputs.");
    expect(alert).toHaveTextContent("b is written by 1 Loop item alias, 1 edge.");
  });
});

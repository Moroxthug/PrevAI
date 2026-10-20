import { describe, expect, it } from "vitest";
import { fillTemplate, savedTemplate } from "./savedTemplates.js";

describe("saved message templates", () => {
  it("a saved text replaces the standard one; none, or an empty one, leaves it", () => {
    expect(savedTemplate({ templates: { f1_it: " Buongiorno {first} " } }, "f1")).toBe("Buongiorno {first}");
    expect(savedTemplate({ templates: { f1_it: "  " } }, "f1")).toBeNull();
    expect(savedTemplate({}, "f1")).toBeNull();
    expect(savedTemplate(null, "f2")).toBeNull();
  });
  it("fills the slots and drops an empty one with its space", () => {
    expect(fillTemplate("Buongiorno {first}, ecco {link} {me}", { first: "Dana", link: "https://prevai.it/p/1" })).toBe("Buongiorno Dana, ecco https://prevai.it/p/1");
  });
});

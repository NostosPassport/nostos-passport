import { BIO_MAX, NAME_MAX, profileChanges, profileProblem } from "../edit-profile";

describe("profileChanges", () => {
  const initial = { displayName: "Sam", bio: "hello" };

  it("sends only fields that actually changed and trims them", () => {
    expect(profileChanges(initial, initial)).toEqual({});
    expect(profileChanges(initial, { displayName: "  Sam  ", bio: "hello" })).toEqual({});
    expect(profileChanges(initial, { displayName: "Samuel", bio: "hello" })).toEqual({ displayName: "Samuel" });
    expect(profileChanges(initial, { displayName: "Sam", bio: "  new bio  " })).toEqual({ bio: "new bio" });
    expect(profileChanges(initial, { displayName: " Samuel ", bio: " new bio " })).toEqual({ displayName: "Samuel", bio: "new bio" });
  });
});

describe("profileProblem", () => {
  it("requires a display name", () => {
    expect(profileProblem({ displayName: "", bio: "" })).toBe("Add a display name.");
    expect(profileProblem({ displayName: "   ", bio: "" })).toBe("Add a display name.");
  });

  it("enforces the current name and bio limits", () => {
    expect(profileProblem({ displayName: "x".repeat(NAME_MAX + 1), bio: "" })).toBe(`Keep your name under ${NAME_MAX + 1} characters.`);
    expect(profileProblem({ displayName: "Sam", bio: "x".repeat(BIO_MAX + 1) })).toBe(`Keep your bio to ${BIO_MAX} characters.`);
    expect(profileProblem({ displayName: "Sam", bio: "x".repeat(BIO_MAX) })).toBeNull();
  });
});
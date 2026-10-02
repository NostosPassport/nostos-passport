import { render, screen } from "@testing-library/react-native";

import { BearerPage } from "../BearerPage";
import { bearerFields, bookDate, checkDigit, documentNumber, machineZone } from "../bearer";

const bearer = { displayName: "Ava Álvarez", handle: "avaa", memberSince: "2026-10-03T04:00:00.000Z", bio: "Out late." };

describe("bearer page logic", () => {
  it("prints dates the same everywhere, in UTC", () => {
    expect(bookDate("2026-10-03T23:30:00.000Z")).toBe("03 OCT 2026");
    expect(bookDate("2027-01-01T00:00:00.000Z")).toBe("01 JAN 2027");
    expect(bookDate("nonsense")).toBe("");
  });
  it("makes a stable passport number from the handle alone", () => {
    expect(documentNumber("avaa")).toBe(documentNumber("AVAA"));
    expect(documentNumber("avaa")).toMatch(/^N\d{8}$/);
    expect(documentNumber("avaa")).not.toBe(documentNumber("morgan"));
  });
  it("computes the standard 7-3-1 check digit", () => {
    expect(checkDigit("520727")).toBe(3); // the ICAO 9303 worked example
    expect(checkDigit("L898902C3")).toBe(6);
    expect(checkDigit("<<<")).toBe(0);
  });
  it("builds two 44 character zone lines from A to Z, 0 to 9 and filler, folding accents", () => {
    const [a, b] = machineZone(bearer);
    expect(a).toHaveLength(44);
    expect(b).toHaveLength(44);
    expect(a).toMatch(/^[A-Z0-9<]{44}$/);
    expect(b).toMatch(/^[A-Z0-9<]{44}$/);
    expect(a.startsWith("P<NYCALVAREZ<<AVA")).toBe(true);
    expect(b.startsWith(documentNumber("avaa"))).toBe(true);
  });
  it("copes with names that have no Latin letters, one word, or an unreadable date", () => {
    expect(machineZone({ ...bearer, displayName: "李雷" })[0]).toMatch(/^P<NYCAVAA/);
    expect(machineZone({ ...bearer, displayName: "Cher" })[0].startsWith("P<NYCCHER<")).toBe(true);
    expect(machineZone({ ...bearer, memberSince: "x" })[1]).toHaveLength(44);
  });
  it("lists fields in reading order and leaves out remarks when there is no bio; never the email or an id", () => {
    expect(bearerFields(bearer).map((f) => f.label)).toEqual(["SURNAME AND GIVEN NAMES", "HANDLE", "PASSPORT NO.", "ISSUED", "REMARKS"]);
    expect(bearerFields({ ...bearer, bio: "  " }).map((f) => f.label)).not.toContain("REMARKS");
    expect(JSON.stringify(bearerFields(bearer))).not.toMatch(/\S+@\S+\.\S+/);
  });
});

describe("BearerPage", () => {
  it("reads as one passport page with the holder's details", async () => {
    await render(<BearerPage width={300} height={426} bearer={bearer} avatarUrl={null} />);
    expect(screen.getByLabelText(/Passport of Ava Álvarez, at avaa.*issued: 03 OCT 2026/)).toBeTruthy();
    expect(screen.getByText("NOSTOS PASSPORT")).toBeTruthy();
    expect(screen.getByText("@avaa")).toBeTruthy();
  });
});

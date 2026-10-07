import { flipRows } from "../decode-image";

jest.mock("@shopify/react-native-skia", () => ({ Skia: {}, AlphaType: {}, ColorType: {} }));

describe("flipRows", () => {
  it("reverses row order and keeps the pixels in each row", () => {
    const data = Uint8Array.from([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]); // 2 wide, 2 tall
    const out = flipRows({ data, width: 2, height: 2 });
    expect(Array.from(out.data)).toEqual([3, 3, 3, 3, 4, 4, 4, 4, 1, 1, 1, 1, 2, 2, 2, 2]);
    expect(flipRows(out).data).toEqual(data);
  });
});

import * as SecureStore from "expo-secure-store";

import { tokenStore } from "../token-store";

describe("tokenStore", () => {
  afterEach(async () => {
    await tokenStore.clear();
  });

  it("ignores a dead-token report for a previous account", async () => {
    await tokenStore.set("token-b");
    tokenStore.invalidate("token-a");
    expect(tokenStore.current()).toBe("token-b");
    tokenStore.invalidate("token-b");
    expect(tokenStore.current()).toBeNull();
  });

  it("does not sign in when the keychain write fails", async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error("keychain"));
    await expect(tokenStore.set("token-c")).rejects.toThrow("keychain");
    expect(tokenStore.current()).toBeNull();
  });

  it("returns the cleared token so it can be revoked", async () => {
    await tokenStore.set("token-d");
    await expect(tokenStore.clear()).resolves.toBe("token-d");
  });
});

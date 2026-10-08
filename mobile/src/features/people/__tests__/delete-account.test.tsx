/** Guideline 5.1.1(v): account deletion works end to end from the in-app screen. */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import { ApiError } from "@/api/client";
import DeleteAccount from "@/app/(app)/settings/delete-account";
import { farewellNotice } from "@/auth/auth-context";
import { testQueryClient } from "@/test/query-client";

const mockForget = jest.fn(async () => undefined);
const mockStartDelete = jest.fn();
const mockDelete = jest.fn();
const CHALLENGE = "11111111-1111-4111-8111-111111111111";

jest.mock("@/auth/auth-context", () => {
  const actual = jest.requireActual("@/auth/auth-context");
  return { useAuth: () => ({ forget: mockForget }), farewellNotice: actual.farewellNotice };
});

jest.mock("@/api/email-auth", () => ({
  startDeleteAccountVerification: () => mockStartDelete(),
  deleteAccountWithCode: (challengeId: string, code: string) => mockDelete(challengeId, code),
}));

async function renderScreen() {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <DeleteAccount />
    </QueryClientProvider>,
  );
}

const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
  buttons?.find((b) => b.style === "destructive")?.onPress?.();
});

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

async function beginDeletion() {
  await renderScreen();
  await fireEvent.press(screen.getByLabelText("Email confirmation code"));
  return screen.findByTestId("delete-code");
}

describe("Delete account", () => {
  beforeEach(() => {
    mockForget.mockClear();
    mockStartDelete.mockReset();
    mockDelete.mockReset();
    alert.mockClear();
    farewellNotice.take();
    mockStartDelete.mockResolvedValue({ challengeId: CHALLENGE, expiresAt: "2026-10-07T20:00:00.000Z", resendAfterSeconds: 60 });
  });

  it("explains what happens and starts with an email confirmation step", async () => {
    await renderScreen();
    expect(screen.getByText("Your stamps and their image files are permanently removed.")).toBeTruthy();
    expect(screen.getByLabelText("Email confirmation code")).toBeTruthy();
    expect(screen.queryByTestId("delete-code")).toBeNull();
  });

  it("confirms, calls the API with the email code, then signs out locally", async () => {
    mockDelete.mockResolvedValue({ deleted: true });
    const code = await beginDeletion();
    await fireEvent.changeText(code, "123456");
    await fireEvent.press(screen.getByLabelText("Delete account"));
    await flush();
    expect(alert).toHaveBeenCalledWith("Delete your account?", "This can't be undone.", expect.any(Array));
    expect(mockDelete).toHaveBeenCalledWith(CHALLENGE, "123456");
    await flush();
    expect(mockForget).toHaveBeenCalledTimes(1);
    expect(farewellNotice.take()).toBe("Your account is deleted.");
  });

  it("treats a dead token on retry as already deleted", async () => {
    mockDelete.mockRejectedValue(new ApiError(401, "invalid_token", "Sign in again."));
    const code = await beginDeletion();
    await fireEvent.changeText(code, "123456");
    await fireEvent.press(screen.getByLabelText("Delete account"));
    await flush();
    await flush();
    expect(mockForget).toHaveBeenCalledTimes(1);
  });

  it("says nothing about venues, plans, or social features", async () => {
    await renderScreen();
    expect(screen.queryByText(/venue/i)).toBeNull();
    expect(screen.queryByText(/plans/i)).toBeNull();
    expect(screen.queryByText(/follow/i)).toBeNull();
    expect(screen.queryByText(/like/i)).toBeNull();
  });

  it("shows a wrong code inline and stays signed in", async () => {
    mockDelete.mockRejectedValue(new ApiError(400, "invalid_code", "That code is not correct."));
    const code = await beginDeletion();
    await fireEvent.changeText(code, "000000");
    await fireEvent.press(screen.getByLabelText("Delete account"));
    await flush();
    expect(await screen.findByText("That code is not correct.")).toBeTruthy();
    expect(mockForget).not.toHaveBeenCalled();
  });

  it("does nothing if the destructive confirmation is cancelled", async () => {
    alert.mockImplementationOnce(() => undefined);
    const code = await beginDeletion();
    await fireEvent.changeText(code, "123456");
    await fireEvent.press(screen.getByLabelText("Delete account"));
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

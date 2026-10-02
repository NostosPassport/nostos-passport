/** Guideline 5.1.1(v): account deletion works end to end from the in-app screen. */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import { ApiError } from "@/api/client";
import { farewellNotice } from "@/auth/auth-context";
import DeleteAccount from "@/app/(app)/settings/delete-account";
import { testQueryClient } from "@/test/query-client";

const mockForget = jest.fn(async () => undefined);
const mockDelete = jest.fn();

jest.mock("@/auth/auth-context", () => {
  const actual = jest.requireActual("@/auth/auth-context");
  return { useAuth: () => ({ forget: mockForget }), farewellNotice: actual.farewellNotice };
});
jest.mock("@/api", () => {
  const client = jest.requireActual("@/api/client");
  return { api: { me: { deleteAccount: (pw: string) => mockDelete(pw) } }, ApiError: client.ApiError, errorText: client.errorText };
});

async function renderScreen() {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <DeleteAccount />
    </QueryClientProvider>,
  );
}

/** Press the destructive button in the confirmation alert. */
const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
  buttons?.find((b) => b.style === "destructive")?.onPress?.();
});

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

describe("Delete account", () => {
  beforeEach(() => {
    mockForget.mockClear();
    mockDelete.mockReset();
    alert.mockClear();
  });

  it("explains what happens and needs a password", async () => {
    await renderScreen();
    expect(screen.getByText("Your stamps are removed from every passport, and so are your follows and likes.")).toBeTruthy();
    expect(screen.getByLabelText("Delete account")).toBeDisabled();
  });

  it("confirms, calls the API with the password, then signs out locally", async () => {
    mockDelete.mockResolvedValue({ deleted: true });
    await renderScreen();
    await fireEvent.changeText(screen.getByTestId("delete-password"), "correct horse battery");
    await fireEvent.press(screen.getByLabelText("Delete account"));
    await flush();
    expect(alert).toHaveBeenCalledWith("Delete your account?", "This can't be undone.", expect.any(Array));
    expect(mockDelete).toHaveBeenCalledWith("correct horse battery");
    await flush();
    expect(mockForget).toHaveBeenCalledTimes(1);
    expect(farewellNotice.take()).toBe("Your account is deleted.");
  });

  it("treats a dead token on retry as already deleted", async () => {
    mockDelete.mockRejectedValue(new ApiError(401, "invalid_token", "Sign in again."));
    await renderScreen();
    await fireEvent.changeText(screen.getByTestId("delete-password"), "pw");
    await fireEvent.press(screen.getByLabelText("Delete account"));
    await flush();
    await flush();
    expect(mockForget).toHaveBeenCalledTimes(1);
  });

  it("says nothing about venues or plans (they no longer exist)", async () => {
    await renderScreen();
    expect(screen.queryByText(/venue/i)).toBeNull();
    expect(screen.queryByText(/plans/i)).toBeNull();
  });

  it("shows a wrong password inline and stays signed in", async () => {
    mockDelete.mockRejectedValue(new ApiError(403, "wrong_password", "Password is incorrect"));
    await renderScreen();
    await fireEvent.changeText(screen.getByTestId("delete-password"), "nope");
    await fireEvent.press(screen.getByLabelText("Delete account"));
    await flush();
    expect(await screen.findByText("That password isn't right.")).toBeTruthy();
    expect(mockForget).not.toHaveBeenCalled();
  });

  it("does nothing if the confirmation is cancelled", async () => {
    alert.mockImplementationOnce(() => undefined);
    await renderScreen();
    await fireEvent.changeText(screen.getByTestId("delete-password"), "pw");
    await fireEvent.press(screen.getByLabelText("Delete account"));
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

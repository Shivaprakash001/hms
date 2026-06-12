import { describe, expect, it } from "vitest";
import { parseOwnerExpenseWriteCommand } from "@/lib/services/notifications/owner-whatsapp-assistant";

describe("WhatsApp owner expense parser", () => {
  it("parses template shortcut commands", () => {
    const parsed = parseOwnerExpenseWriteCommand("internet 1000");
    expect(parsed).toMatchObject({
      action: "CREATE_EXPENSE",
      title: "Internet",
      amount: 1000,
      category: "Internet",
      payment_method: "cash",
      template_key: "internet",
    });
  });

  it("parses explicit expense commands", () => {
    const parsed = parseOwnerExpenseWriteCommand("expense internet 1000");
    expect(parsed).toMatchObject({
      title: "Internet",
      amount: 1000,
      category: "Internet",
      payment_method: "cash",
    });
  });

  it("parses vendor and payment method after amount", () => {
    const parsed = parseOwnerExpenseWriteCommand("expense internet 1000 jio upi");
    expect(parsed).toMatchObject({
      title: "Internet - Jio",
      amount: 1000,
      category: "Internet",
      vendor_name: "Jio",
      payment_method: "upi",
    });
  });

  it("parses vendor before amount for salary", () => {
    const parsed = parseOwnerExpenseWriteCommand("salary ravi 15000");
    expect(parsed).toMatchObject({
      title: "Staff Salary - Ravi",
      amount: 15000,
      category: "Staff Salary",
      vendor_name: "Ravi",
      payment_method: "cash",
    });
  });

  it("rejects missing or invalid amounts", () => {
    expect(parseOwnerExpenseWriteCommand("internet")).toBeNull();
    expect(parseOwnerExpenseWriteCommand("internet zero")).toBeNull();
    expect(parseOwnerExpenseWriteCommand("internet -100")).toBeNull();
  });
});

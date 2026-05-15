import { prisma } from "../db";
import { eventSystem } from "../events";

export class ExpenseService {
  async getAllExpenses(ownerId: string, hostelId: string) {
    return prisma.expenses.findMany({
      where: {
        owner_id: ownerId,
        hostel_id: hostelId,
      },
      orderBy: { date: "desc" }
    });
  }

  async createExpense(data: {
    owner_id: string;
    title: string;
    amount: number;
    date: Date | string;
    category: string;
    status?: string;
    hostel_id: string;
  }) {
    if (!data.hostel_id) {
      throw new Error("HOSTEL_CONTEXT_REQUIRED: Expense requires hostel_id");
    }
    // Parse date safely — handle both Date objects and ISO strings
    let parsedDate: Date;
    if (data.date instanceof Date) {
      parsedDate = data.date;
    } else {
      parsedDate = new Date(data.date);
    }

    // Validate the parsed date
    if (isNaN(parsedDate.getTime())) {
      throw new Error("VALIDATION: Invalid date provided");
    }

    const expense = await prisma.expenses.create({
      data: {
        owner_id: data.owner_id,
        title: data.title,
        amount: data.amount,
        date: parsedDate,
        category: data.category,
        status: data.status || "paid",
        hostel_id: data.hostel_id,
      }
    });

    await eventSystem.trigger("expense_created", {
      expense_id: expense.id,
      owner_id: data.owner_id,
      title: data.title,
      amount: data.amount,
    });

    return expense;
  }

  async updateExpense(expenseId: string, ownerId: string, data: any) {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.category !== undefined) updateData.category = data.category;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.date !== undefined) {
      const d = new Date(data.date);
      if (!isNaN(d.getTime())) updateData.date = d;
    }

    return prisma.expenses.update({
      where: { id: expenseId, owner_id: ownerId },
      data: updateData
    });
  }

  async deleteExpense(expenseId: string, ownerId: string) {
    return prisma.expenses.delete({
      where: { id: expenseId, owner_id: ownerId }
    });
  }
}

export const expenseService = new ExpenseService();

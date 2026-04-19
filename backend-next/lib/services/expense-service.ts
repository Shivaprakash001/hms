import { prisma } from "../db";

export class ExpenseService {
  async getAllExpenses(ownerId: string) {
    return prisma.expense.findMany({
      where: { owner_id: ownerId },
      orderBy: { date: "desc" }
    });
  }

  async createExpense(data: {
    owner_id: string;
    title: string;
    amount: number;
    date: Date;
    category: string;
    status?: string;
  }) {
    return prisma.expense.create({
      data: {
        ...data,
        amount: data.amount
      }
    });
  }

  async updateExpense(expenseId: string, ownerId: string, data: any) {
    return prisma.expense.update({
      where: { id: expenseId, owner_id: ownerId },
      data: {
        ...data,
        ...(data.amount && { amount: data.amount })
      }
    });
  }

  async deleteExpense(expenseId: string, ownerId: string) {
    return prisma.expense.delete({
      where: { id: expenseId, owner_id: ownerId }
    });
  }
}

export const expenseService = new ExpenseService();

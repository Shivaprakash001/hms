import { prisma } from "../db";

export class ExpenseService {
  async getAllExpenses(ownerId: string) {
    return prisma.$queryRaw`SELECT * FROM "expenses" WHERE owner_id = ${ownerId}::uuid ORDER BY date DESC` as Promise<any[]>;
  }

  async createExpense(data: any) {
    // Handling dynamic schema fallback like in Python
    const { status, ...rest } = data;
    return prisma.$queryRaw`
      INSERT INTO "expenses" (owner_id, title, amount, date, category)
      VALUES (${rest.owner_id}::uuid, ${rest.title}, ${rest.amount}, ${rest.date}::date, ${rest.category})
      RETURNING *
    `;
  }

  async updateExpense(id: string, data: any) {
    const { owner_id, ...updates } = data;
    // For simplicity with dynamic updates in Raw SQL or Prisma
    return prisma.$executeRaw`
      UPDATE "expenses" 
      SET title = ${updates.title}, amount = ${updates.amount}, date = ${updates.date}::date, category = ${updates.category}
      WHERE id = ${id}::uuid
    `;
  }

  async deleteExpense(id: string) {
    return prisma.$executeRaw`DELETE FROM "expenses" WHERE id = ${id}::uuid`;
  }
}

export const expenseService = new ExpenseService();

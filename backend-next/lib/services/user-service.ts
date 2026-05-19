import { prisma } from "../db";

export class BaseService {
  protected db = prisma;
}

/**
 * Example UserService for handling profile-related operations
 */
export class UserService extends BaseService {
  async getProfile(userId: string) {
    return this.db.profile.findUnique({
      where: { id: userId },
      include: { tenants: true },
    });
  }

  async updateProfile(userId: string, data: any) {
    return this.db.profile.update({
      where: { id: userId },
      data,
    });
  }
}

export const userService = new UserService();

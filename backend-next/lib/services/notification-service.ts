import { prisma } from "../db";

export class NotificationService {
  async getUserNotifications(userId: string) {
    return prisma.notifications.findMany({
      where: { profile_id: userId },
      orderBy: { created_at: "desc" },
      take: 50
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return prisma.notifications.update({
      where: { id: notificationId, profile_id: userId },
      data: { is_read: true }
    });
  }

  async createNotification(userId: string, title: string, message: string, type: string) {
    return prisma.notifications.create({
      data: {
        profile_id: userId,
        title,
        message,
        type: type.toLowerCase()
      }
    });
  }
}

export const notificationService = new NotificationService();

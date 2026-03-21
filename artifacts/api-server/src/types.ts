import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      campaignMember?: {
        id: string;
        campaignId: string;
        userId: string;
        role: string;
        joinedAt: Date | null;
      };
    }
  }
}

export function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

export {};

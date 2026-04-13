import { DefaultSession } from "next-auth";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string;
      role?: UserRole;
      isBlueVerified?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    username?: string | null;
    role?: UserRole;
    isBlueVerified?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    role?: UserRole;
    isBlueVerified?: boolean;
  }
}

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { sendTwoFactorCode } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getSuperAdminEmails } from "@/lib/roles";
import { consumeTwoFactorCode, createTwoFactorCode } from "@/lib/tokens";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      twoFactorCode: { label: "Two Factor Code", type: "text" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: {
          email: credentials.email.toLowerCase()
        },
        include: {
          profile: {
            select: {
              firstName: true
            }
          }
        }
      });

      if (!user?.passwordHash) {
        return null;
      }

      const isValidPassword = await compare(credentials.password, user.passwordHash);

      if (!isValidPassword) {
        return null;
      }

      if (!user.emailVerified) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }

      if (user.twoFactorEnabled) {
        const twoFactorCode = credentials.twoFactorCode?.trim();

        if (!twoFactorCode) {
          const code = await createTwoFactorCode(user.id);
          await sendTwoFactorCode({
            method: user.twoFactorMethod,
            code,
            toEmail: user.email,
            toPhone: user.twoFactorPhone,
            firstName: user.profile?.firstName ?? user.name
          });
          throw new Error("TWO_FACTOR_REQUIRED");
        }

        const validCode = await consumeTwoFactorCode({
          userId: user.id,
          code: twoFactorCode
        });

        if (!validCode.valid) {
          throw new Error("INVALID_TWO_FACTOR_CODE");
        }
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        username: user.username,
        role: user.role,
        isBlueVerified: user.isBlueVerified
      };
    }
  })
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  );
}

if (
  process.env.APPLE_ID &&
  process.env.APPLE_CLIENT_SECRET
) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: {
            email: token.email
          },
          select: {
            id: true,
            username: true,
            name: true,
            image: true,
            role: true,
            isBlueVerified: true
          }
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.username = dbUser.username ?? undefined;
          token.name = dbUser.name ?? token.name;
          token.picture = dbUser.image ?? token.picture;
          token.role = dbUser.role;
          token.isBlueVerified = dbUser.isBlueVerified;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.username = typeof token.username === "string" ? token.username : undefined;
        session.user.image = typeof token.picture === "string" ? token.picture : session.user.image;
        session.user.role = token.role;
        session.user.isBlueVerified = Boolean(token.isBlueVerified);
      }
      return session;
    },
    async signIn({ user, account }) {
      if (user.email) {
        const superAdmins = getSuperAdminEmails();
        const nextRole = superAdmins.includes(user.email.toLowerCase()) ? "SUPER_ADMIN" : undefined;

        await prisma.user.update({
          where: {
            email: user.email
          },
          data: {
            name: user.name ?? undefined,
            ...(nextRole ? { role: nextRole } : {}),
            ...(account?.provider !== "credentials" ? { emailVerified: new Date() } : {})
          }
        });
      }
      return true;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};

export const getServerAuthSession = () => getServerSession(authOptions);

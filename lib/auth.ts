import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "@/lib/prisma";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: {
          email: credentials.email.toLowerCase()
        }
      });

      if (!user?.passwordHash) {
        return null;
      }

      const isValidPassword = await compare(credentials.password, user.passwordHash);

      if (!isValidPassword) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        username: user.username
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
            image: true
          }
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.username = dbUser.username ?? undefined;
          token.name = dbUser.name ?? token.name;
          token.picture = dbUser.image ?? token.picture;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.username = typeof token.username === "string" ? token.username : undefined;
        session.user.image = typeof token.picture === "string" ? token.picture : session.user.image;
      }
      return session;
    },
    async signIn({ user }) {
      if (user.email) {
        await prisma.user.update({
          where: {
            email: user.email
          },
          data: {
            name: user.name ?? undefined
          }
        });
      }
      return true;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};

export const getServerAuthSession = () => getServerSession(authOptions);

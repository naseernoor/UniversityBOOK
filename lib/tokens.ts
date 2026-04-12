import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

const makeToken = () => randomBytes(32).toString("hex");

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

const verifyIdentifier = (email: string) => `verify:${email.toLowerCase()}`;
const resetIdentifier = (email: string) => `reset:${email.toLowerCase()}`;

export const createEmailVerificationToken = async (email: string) => {
  const token = makeToken();
  const identifier = verifyIdentifier(email);

  await prisma.verificationToken.deleteMany({
    where: {
      identifier
    }
  });

  await prisma.verificationToken.create({
    data: {
      identifier,
      token,
      expires: hoursFromNow(24)
    }
  });

  return token;
};

export const createPasswordResetToken = async (email: string) => {
  const token = makeToken();
  const identifier = resetIdentifier(email);

  await prisma.verificationToken.deleteMany({
    where: {
      identifier
    }
  });

  await prisma.verificationToken.create({
    data: {
      identifier,
      token,
      expires: hoursFromNow(1)
    }
  });

  return token;
};

export const parseVerificationToken = async (token: string, type: "verify" | "reset") => {
  const tokenRecord = await prisma.verificationToken.findUnique({
    where: {
      token
    }
  });

  if (!tokenRecord) {
    return {
      valid: false as const,
      reason: "Invalid token"
    };
  }

  const prefix = `${type}:`;
  if (!tokenRecord.identifier.startsWith(prefix)) {
    return {
      valid: false as const,
      reason: "Invalid token"
    };
  }

  if (tokenRecord.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: {
        token
      }
    });

    return {
      valid: false as const,
      reason: "Token expired"
    };
  }

  return {
    valid: true as const,
    email: tokenRecord.identifier.slice(prefix.length).toLowerCase(),
    token
  };
};

export const consumeToken = async (token: string) => {
  await prisma.verificationToken.delete({
    where: {
      token
    }
  });
};

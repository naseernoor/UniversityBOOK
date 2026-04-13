import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

const makeToken = () => randomBytes(32).toString("hex");
const makeNumericCode = () => String(Math.floor(100000 + Math.random() * 900000));

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000);

const verifyIdentifier = (email: string) => `verify:${email.toLowerCase()}`;
const resetIdentifier = (email: string) => `reset:${email.toLowerCase()}`;
const twoFactorIdentifierPrefix = (userId: string) => `2fa:${userId}:`;
const twoFactorIdentifier = (userId: string, code: string) => `${twoFactorIdentifierPrefix(userId)}${code}`;
const emailChangeIdentifier = (userId: string, newEmail: string) =>
  `email-change:${userId}:${newEmail.toLowerCase()}`;

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

export const createTwoFactorCode = async (userId: string) => {
  const code = makeNumericCode();
  const identifier = twoFactorIdentifier(userId, code);
  const token = makeToken();

  await prisma.verificationToken.deleteMany({
    where: {
      identifier: {
        startsWith: twoFactorIdentifierPrefix(userId)
      }
    }
  });

  await prisma.verificationToken.create({
    data: {
      identifier,
      token,
      expires: minutesFromNow(10)
    }
  });

  return code;
};

export const consumeTwoFactorCode = async (params: { userId: string; code: string }) => {
  const tokenRecord = await prisma.verificationToken.findFirst({
    where: {
      identifier: twoFactorIdentifier(params.userId, params.code)
    }
  });

  if (!tokenRecord) {
    return {
      valid: false as const,
      reason: "Invalid code"
    };
  }

  if (tokenRecord.expires < new Date()) {
    await consumeToken(tokenRecord.token);
    return {
      valid: false as const,
      reason: "Code expired"
    };
  }

  await consumeToken(tokenRecord.token);
  return {
    valid: true as const
  };
};

export const createEmailChangeToken = async (params: { userId: string; newEmail: string }) => {
  const token = makeToken();
  const identifier = emailChangeIdentifier(params.userId, params.newEmail);

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

export const parseEmailChangeToken = async (token: string) => {
  const tokenRecord = await prisma.verificationToken.findUnique({
    where: {
      token
    }
  });

  if (!tokenRecord || !tokenRecord.identifier.startsWith("email-change:")) {
    return {
      valid: false as const,
      reason: "Invalid token"
    };
  }

  if (tokenRecord.expires < new Date()) {
    await consumeToken(token);
    return {
      valid: false as const,
      reason: "Token expired"
    };
  }

  const parts = tokenRecord.identifier.split(":");
  if (parts.length < 3) {
    return {
      valid: false as const,
      reason: "Invalid token"
    };
  }

  const userId = parts[1];
  const newEmail = parts.slice(2).join(":");

  return {
    valid: true as const,
    userId,
    newEmail,
    token
  };
};

import { prisma } from "@/lib/prisma";

const mentionRegex = /@([\p{L}\p{N}_.-]{3,30})/gu;

export const extractMentionUsernames = (content: string) => {
  const usernames = new Set<string>();
  for (const match of content.matchAll(mentionRegex)) {
    const username = match[1]?.trim().toLowerCase();
    if (username) {
      usernames.add(username);
    }
  }
  return [...usernames];
};

export const resolveMentionedUsers = async (params: {
  authorId: string;
  content: string;
}) => {
  const usernames = extractMentionUsernames(params.content);
  if (usernames.length === 0) {
    return [];
  }

  const relations = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: params.authorId }, { recipientId: params.authorId }]
    },
    select: {
      senderId: true,
      recipientId: true
    }
  });

  const mentionableIds = new Set([params.authorId]);
  for (const relation of relations) {
    mentionableIds.add(
      relation.senderId === params.authorId ? relation.recipientId : relation.senderId
    );
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: [...mentionableIds]
      },
      username: {
        in: usernames
      }
    },
    select: {
      id: true,
      username: true
    }
  });

  return users;
};


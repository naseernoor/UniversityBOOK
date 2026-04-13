import { prisma } from "@/lib/prisma";

export const getAcceptedFriendIds = async (userId: string): Promise<string[]> => {
  const relationships = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ senderId: userId }, { recipientId: userId }]
    },
    select: {
      senderId: true,
      recipientId: true
    }
  });

  return relationships.map((relationship) =>
    relationship.senderId === userId ? relationship.recipientId : relationship.senderId
  );
};

export const getAcceptedFriends = async (userId: string) => {
  const friendIds = await getAcceptedFriendIds(userId);

  if (friendIds.length === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      id: {
        in: friendIds
      }
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      isBlueVerified: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          university: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
};

export const getRelationshipStatus = async (currentUserId: string, targetUserId: string) => {
  const relationship = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        {
          senderId: currentUserId,
          recipientId: targetUserId
        },
        {
          senderId: targetUserId,
          recipientId: currentUserId
        }
      ]
    }
  });

  if (!relationship) {
    return "NONE" as const;
  }

  if (relationship.status === "ACCEPTED") {
    return "FRIENDS" as const;
  }

  if (relationship.status === "PENDING") {
    if (relationship.senderId === currentUserId) {
      return "PENDING_SENT" as const;
    }
    return "PENDING_RECEIVED" as const;
  }

  return "NONE" as const;
};

export const areUsersFriends = async (userId: string, otherUserId: string) => {
  const relation = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        {
          senderId: userId,
          recipientId: otherUserId
        },
        {
          senderId: otherUserId,
          recipientId: userId
        }
      ]
    },
    select: {
      id: true
    }
  });

  return Boolean(relation);
};

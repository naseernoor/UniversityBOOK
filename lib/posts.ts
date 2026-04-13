import { PostReactionType, PostVisibility, Prisma } from "@prisma/client";

import { calculateSemesterPercentage } from "@/lib/calculations";
import { getAcceptedFriendIds } from "@/lib/friends";
import { prisma } from "@/lib/prisma";

const reactionTypes = Object.values(PostReactionType);

const postInclude = {
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      role: true,
      isBlueVerified: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          university: true
        }
      }
    }
  },
  likes: {
    select: {
      userId: true,
      reactionType: true
    }
  },
  media: {
    orderBy: {
      createdAt: "asc"
    }
  },
  mentions: {
    include: {
      mentionedUser: {
        select: {
          id: true,
          username: true,
          email: true,
          image: true,
          isBlueVerified: true,
          profile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  },
  comments: {
    orderBy: {
      createdAt: "asc"
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          image: true,
          role: true,
          isBlueVerified: true,
          profile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      },
      reactions: {
        select: {
          userId: true,
          reactionType: true
        }
      },
      mentions: {
        include: {
          mentionedUser: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        }
      }
    },
    take: 240
  },
  sharedSemesters: {
    include: {
      semester: {
        include: {
          subjects: {
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      }
    }
  }
} satisfies Prisma.PostInclude;

type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

const buildReactionSummary = (likes: Array<{ reactionType: PostReactionType }>) => {
  const seed = reactionTypes.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {} as Record<PostReactionType, number>);

  return likes.reduce((acc, like) => {
    acc[like.reactionType] = (acc[like.reactionType] ?? 0) + 1;
    return acc;
  }, seed);
};

const mapPost = (post: PostWithRelations, viewerId: string) => {
  const mappedComments = post.comments.map((comment) => {
    const reactionSummary = buildReactionSummary(comment.reactions);

    return {
      id: comment.id,
      postId: comment.postId,
      parentCommentId: comment.parentId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: comment.user,
      myReaction:
        comment.reactions.find((reaction) => reaction.userId === viewerId)
          ?.reactionType ?? null,
      reactions: reactionSummary,
      reactionsCount: comment.reactions.length,
      mentions: comment.mentions.map((mention) => ({
        id: mention.mentionedUser.id,
        username: mention.mentionedUser.username,
        email: mention.mentionedUser.email
      })),
      replies: [] as Array<{
        id: string;
        postId: string;
        parentCommentId: string | null;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        user: (typeof comment.user);
        myReaction: PostReactionType | null;
        reactions: Record<PostReactionType, number>;
        reactionsCount: number;
        mentions: Array<{
          id: string;
          username: string | null;
          email: string | null;
        }>;
      }>
    };
  });

  const commentMap = new Map(mappedComments.map((comment) => [comment.id, comment]));
  const topLevelComments: typeof mappedComments = [];

  for (const comment of mappedComments) {
    if (comment.parentCommentId) {
      const parent = commentMap.get(comment.parentCommentId);
      if (parent) {
        parent.replies.push(comment);
        continue;
      }
    }
    topLevelComments.push(comment);
  }

  for (const comment of topLevelComments) {
    comment.replies.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  topLevelComments.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return {
    id: post.id,
    content: post.content,
    visibility: post.visibility,
    includeOverallPercentage: post.includeOverallPercentage,
    overallPercentageSnapshot: post.overallPercentageSnapshot,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.user,
    likesCount: post.likes.length,
    likedByMe: post.likes.some((like) => like.userId === viewerId),
    myReaction:
      post.likes.find((like) => like.userId === viewerId)?.reactionType ?? null,
    reactions: buildReactionSummary(post.likes),
    commentsCount: post.comments.length,
    comments: topLevelComments,
    mentions: post.mentions.map((mention) => ({
      id: mention.mentionedUser.id,
      username: mention.mentionedUser.username,
      email: mention.mentionedUser.email,
      profile: mention.mentionedUser.profile
    })),
    media: post.media.map((item) => ({
      id: item.id,
      url: item.url,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes
    })),
    sharedSemesters: post.sharedSemesters
      .map((shared) => {
        const semester = shared.semester;
        const percentage = calculateSemesterPercentage(
          semester.subjects.map((subject) => ({
            credits: subject.credits,
            score: subject.score
          }))
        );

        return {
          id: semester.id,
          index: semester.index,
          name: semester.name,
          status: semester.status,
          verificationStatus: semester.verificationStatus,
          percentage,
          subjects: semester.subjects.map((subject) => ({
            id: subject.id,
            name: subject.name,
            credits: subject.credits,
            chance: subject.chance,
            score: subject.score,
            code: subject.code,
            teacherName: subject.teacherName
          }))
        };
      })
      .sort((a, b) => a.index - b.index)
  };
};

export const getFeedPosts = async (viewerId: string) => {
  const friendIds = await getAcceptedFriendIds(viewerId);

  const posts = await prisma.post.findMany({
    where: {
      OR: [
        {
          userId: viewerId
        },
        {
          visibility: "PUBLIC"
        },
        {
          visibility: "FRIENDS",
          userId: {
            in: friendIds
          }
        }
      ]
    },
    include: postInclude,
    orderBy: {
      createdAt: "desc"
    },
    take: 80
  });

  return posts.map((post) => mapPost(post, viewerId));
};

export const canViewPost = async (viewerId: string, postId: string) => {
  const post = await prisma.post.findUnique({
    where: {
      id: postId
    },
    select: {
      id: true,
      userId: true,
      visibility: true
    }
  });

  if (!post) {
    return {
      found: false as const,
      canView: false as const
    };
  }

  if (post.userId === viewerId || post.visibility === PostVisibility.PUBLIC) {
    return {
      found: true as const,
      canView: true as const,
      post
    };
  }

  const accepted = await prisma.friendRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        {
          senderId: viewerId,
          recipientId: post.userId
        },
        {
          senderId: post.userId,
          recipientId: viewerId
        }
      ]
    },
    select: {
      id: true
    }
  });

  return {
    found: true as const,
    canView: Boolean(accepted),
    post
  };
};

export const getPostByIdForViewer = async (postId: string, viewerId: string) => {
  const post = await prisma.post.findUnique({
    where: {
      id: postId
    },
    include: postInclude
  });

  if (!post) {
    return null;
  }

  const access = await canViewPost(viewerId, post.id);
  if (!access.canView) {
    return null;
  }

  return mapPost(post, viewerId);
};


import { PostVisibility, Prisma } from "@prisma/client";

import { calculateSemesterPercentage } from "@/lib/calculations";
import { getAcceptedFriendIds } from "@/lib/friends";
import { prisma } from "@/lib/prisma";

const postInclude = {
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
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
      userId: true
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
          profile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    },
    take: 60
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

const mapPost = (post: PostWithRelations, viewerId: string) => ({
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
  commentsCount: post.comments.length,
  comments: post.comments.map((comment) => ({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: comment.user
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
});

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

import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { getAcceptedFriendIds } from "@/lib/friends";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [me, currentFriendIds, existingRelations] = await Promise.all([
    prisma.profile.findUnique({
      where: {
        userId: session.user.id
      },
      select: {
        university: true,
        faculty: true,
        department: true,
        degreeLevel: true,
        yearOfEnrollment: true
      }
    }),
    getAcceptedFriendIds(session.user.id),
    prisma.friendRequest.findMany({
      where: {
        OR: [{ senderId: session.user.id }, { recipientId: session.user.id }]
      },
      select: {
        senderId: true,
        recipientId: true,
        status: true
      }
    })
  ]);

  const excludedIds = new Set<string>([session.user.id]);
  for (const relation of existingRelations) {
    excludedIds.add(
      relation.senderId === session.user.id ? relation.recipientId : relation.senderId
    );
  }

  const candidates = await prisma.user.findMany({
    where: {
      id: {
        notIn: [...excludedIds]
      },
      profile: {
        isNot: null
      }
    },
    select: {
      id: true,
      username: true,
      email: true,
      image: true,
      isBlueVerified: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          university: true,
          faculty: true,
          department: true,
          degreeLevel: true,
          yearOfEnrollment: true,
          allowFriendRequests: true,
          profileVisibility: true
        }
      },
      createdAt: true
    },
    take: 120
  });

  if (candidates.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const mutualRelations =
    currentFriendIds.length === 0
      ? []
      : await prisma.friendRequest.findMany({
          where: {
            status: "ACCEPTED",
            OR: [
              {
                senderId: {
                  in: candidateIds
                },
                recipientId: {
                  in: currentFriendIds
                }
              },
              {
                senderId: {
                  in: currentFriendIds
                },
                recipientId: {
                  in: candidateIds
                }
              }
            ]
          },
          select: {
            senderId: true,
            recipientId: true
          }
        });

  const mutualCounts = new Map<string, number>();
  for (const relation of mutualRelations) {
    const candidateId = candidateIds.includes(relation.senderId)
      ? relation.senderId
      : relation.recipientId;
    mutualCounts.set(candidateId, (mutualCounts.get(candidateId) ?? 0) + 1);
  }

  const meSafe = me ?? null;
  const normalize = (value: string) => value.trim().toLowerCase();

  const suggestions = candidates
    .map((candidate) => {
      if (!candidate.profile) {
        return null;
      }

      if (
        candidate.profile.profileVisibility === "PRIVATE" &&
        !candidate.profile.allowFriendRequests
      ) {
        return null;
      }

      let score = 0;
      const reasons: string[] = [];

      if (meSafe) {
        if (normalize(candidate.profile.university) === normalize(meSafe.university)) {
          score += 60;
          reasons.push("Same university");
        }

        if (normalize(candidate.profile.faculty) === normalize(meSafe.faculty)) {
          score += 25;
          reasons.push("Same faculty");
        }

        if (normalize(candidate.profile.department) === normalize(meSafe.department)) {
          score += 15;
          reasons.push("Same department");
        }

        if (candidate.profile.degreeLevel === meSafe.degreeLevel) {
          score += 10;
          reasons.push("Same degree level");
        }

        const yearGap = Math.abs(candidate.profile.yearOfEnrollment - meSafe.yearOfEnrollment);
        if (yearGap <= 1) {
          score += 8;
          reasons.push("Similar enrollment year");
        } else if (yearGap <= 3) {
          score += 4;
        }
      }

      const mutual = mutualCounts.get(candidate.id) ?? 0;
      if (mutual > 0) {
        score += Math.min(mutual * 6, 30);
        reasons.push(`${mutual} mutual friend${mutual > 1 ? "s" : ""}`);
      }

      if (!candidate.profile.allowFriendRequests) {
        score -= 50;
      }

      return {
        id: candidate.id,
        username: candidate.username,
        email: candidate.email,
        image: candidate.image,
        isBlueVerified: candidate.isBlueVerified,
        profile: {
          firstName: candidate.profile.firstName,
          lastName: candidate.profile.lastName,
          university: candidate.profile.university,
          faculty: candidate.profile.faculty,
          department: candidate.profile.department
        },
        acceptsRequests: candidate.profile.allowFriendRequests,
        score,
        reasons
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 16);

  return NextResponse.json({ suggestions });
}


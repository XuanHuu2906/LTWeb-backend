import { prisma } from "../../utils/prisma";
import { JOB_STATUS } from "../../types/enums";

export const homeService = {
  async getHomeContent() {
    const now = new Date();
    const activeJobWhere = {
      status: JOB_STATUS.ACTIVE,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    };

    const [
      features,
      testimonials,
      metrics,
      activeJobs,
      recruiters,
      candidates,
      locations,
    ] = await Promise.all([
      prisma.homeFeature.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      }),
      prisma.testimonial.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      }),
      prisma.siteMetric.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      }),
      prisma.jobPosting.count({
        where: activeJobWhere,
      }),
      prisma.user.count({
        where: { role: "recruiter", status: "active", deletedAt: null },
      }),
      prisma.user.count({
        where: { role: "candidate", status: "active", deletedAt: null },
      }),
      prisma.jobPosting.findMany({
        where: { ...activeJobWhere, location: { not: null } },
        distinct: ["location"],
        select: { location: true },
      }),
    ]);

    return {
      features,
      testimonials,
      metrics,
      systemStats: {
        activeJobs,
        recruiters,
        candidates,
        locations: locations.length,
      },
    };
  },

  async getTestimonials(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [testimonials, total] = await Promise.all([
      prisma.testimonial.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        skip,
        take: limit,
      }),
      prisma.testimonial.count({
        where: { isActive: true },
      }),
    ]);

    return {
      testimonials,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};

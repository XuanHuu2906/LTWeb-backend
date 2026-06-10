import { prisma } from "../../utils/prisma";

export const homeService = {
  async getHomeContent() {
    const [features, testimonials, metrics] = await Promise.all([
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
    ]);

    return { features, testimonials, metrics };
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

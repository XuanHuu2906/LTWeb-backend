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
};

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const saltRounds = 10;

async function cleanup() {
  console.log("Cleaning old seed data...");

  await prisma.siteMetric.deleteMany({});
  await prisma.testimonial.deleteMany({});
  await prisma.homeFeature.deleteMany({});

  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});

  await prisma.applicationEvaluation.deleteMany({});
  await prisma.applicationFeedback.deleteMany({});
  await prisma.application.deleteMany({});

  await prisma.savedJob.deleteMany({});
  await prisma.jobView.deleteMany({});
  await prisma.jobPostingSkill.deleteMany({});
  await prisma.jobPosting.deleteMany({});
  await prisma.jobSkill.deleteMany({});
  await prisma.jobCategory.deleteMany({});

  await prisma.notification.deleteMany({});
  await prisma.emailQueue.deleteMany({});

  await prisma.cV.deleteMany({});
  await prisma.cVTemplate.deleteMany({});

  await prisma.refreshToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.candidateProfile.deleteMany({});
  await prisma.recruiterProfile.deleteMany({});
  await prisma.user.deleteMany({});
}

async function createUsers() {
  const adminPasswordHash = await bcrypt.hash("admin123", saltRounds);
  const candidatePasswordHash = await bcrypt.hash("candidate123", saltRounds);
  const recruiterPasswordHash = await bcrypt.hash("recruiter123", saltRounds);

  const admin = await prisma.user.create({
    data: {
      email: "admin@hirearch.com",
      passwordHash: adminPasswordHash,
      role: "admin",
      status: "active",
    },
  });

  const candidate = await prisma.user.create({
    data: {
      email: "candidate@hirearch.com",
      passwordHash: candidatePasswordHash,
      role: "candidate",
      status: "active",
      candidateProfile: {
        create: {
          fullName: "Nguyen Van Candidate",
          phone: "0987654321",
          address: "Thành phố Hồ Chí Minh",
          bio: "React developer looking for a frontend role.",
        },
      },
    },
  });

  const hireArchRecruiter = await prisma.user.create({
    data: {
      email: "recruiter@hirearch.com",
      passwordHash: recruiterPasswordHash,
      role: "recruiter",
      status: "active",
      recruiterProfile: {
        create: {
          companyName: "HireArch Technology",
          contactName: "Tran Recruiter",
          phone: "0912345678",
          address: "Thành phố Hồ Chí Minh",
          website: "https://hirearch.com",
          description: "Technology recruitment and HR platform.",
        },
      },
    },
  });

  const novaRecruiter = await prisma.user.create({
    data: {
      email: "nova.recruiter@hirearch.com",
      passwordHash: recruiterPasswordHash,
      role: "recruiter",
      status: "active",
      recruiterProfile: {
        create: {
          companyName: "Nova Software",
          contactName: "Le Nova",
          phone: "0901111222",
          address: "Hà Nội",
          website: "https://nova.example.com",
          description: "Software outsourcing company.",
        },
      },
    },
  });

  const retailRecruiter = await prisma.user.create({
    data: {
      email: "retail.recruiter@hirearch.com",
      passwordHash: recruiterPasswordHash,
      role: "recruiter",
      status: "active",
      recruiterProfile: {
        create: {
          companyName: "Global Retail Group",
          contactName: "Pham Retail",
          phone: "0903333444",
          address: "Đà Nẵng",
          website: "https://retail.example.com",
          description: "Retail and ecommerce business.",
        },
      },
    },
  });

  console.log("Created users:");
  console.log(`- Admin: ${admin.email} / admin123`);
  console.log(`- Candidate: ${candidate.email} / candidate123`);
  console.log(`- Recruiter: ${hireArchRecruiter.email} / recruiter123`);

  return {
    admin,
    candidate,
    recruiters: [hireArchRecruiter, novaRecruiter, retailRecruiter],
  };
}

async function createCategories() {
  const it = await prisma.jobCategory.create({
    data: { name: "IT / Software", slug: "it-software" },
  });

  const marketing = await prisma.jobCategory.create({
    data: { name: "Marketing", slug: "marketing" },
  });

  const business = await prisma.jobCategory.create({
    data: { name: "Business", slug: "business" },
  });

  const finance = await prisma.jobCategory.create({
    data: { name: "Finance", slug: "finance" },
  });

  return { it, marketing, business, finance };
}

async function createSkills() {
  const skillNames = [
    ["React", "react"],
    ["TypeScript", "typescript"],
    ["Node.js", "nodejs"],
    ["Express", "express"],
    ["PostgreSQL", "postgresql"],
    ["SEO", "seo"],
    ["Content Marketing", "content-marketing"],
    ["Data Analysis", "data-analysis"],
    ["Product Management", "product-management"],
    ["UI/UX", "ui-ux"],
  ];

  const skills = await Promise.all(
    skillNames.map(([name, slug]) =>
      prisma.jobSkill.create({
        data: { name, slug },
      }),
    ),
  );

  return Object.fromEntries(skills.map((skill) => [skill.slug, skill]));
}

async function createJob(data: {
  recruiterId: number;
  categoryId: number;
  title: string;
  description: string;
  requirements: string;
  benefits: string;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryUnit?: string;
  jobType: string;
  experienceLevel: string;
  expiresAt: Date;
  skillIds: number[];
}) {
  return prisma.jobPosting.create({
    data: {
      recruiterId: data.recruiterId,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      benefits: data.benefits,
      location: data.location,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      salaryUnit: data.salaryUnit ?? "month",
      jobType: data.jobType,
      experienceLevel: data.experienceLevel,
      status: "active",
      expiresAt: data.expiresAt,
      skills: {
        create: data.skillIds.map((skillId) => ({
          skill: { connect: { id: skillId } },
        })),
      },
    },
  });
}

async function createJobs(
  recruiters: Awaited<ReturnType<typeof createUsers>>["recruiters"],
  categories: Awaited<ReturnType<typeof createCategories>>,
  skills: Awaited<ReturnType<typeof createSkills>>,
) {
  const [hireArch, nova, retail] = recruiters;
  const expiresAt = new Date("2026-12-31");

  await createJob({
    recruiterId: hireArch.id,
    categoryId: categories.it.id,
    title: "Frontend Developer React",
    description: "Build modern web interfaces for a job matching platform.",
    requirements: "React, TypeScript, REST API, basic UI skills.",
    benefits: "Competitive salary, flexible working hours, training budget.",
    location: "Thành phố Hồ Chí Minh",
    salaryMin: 12000000,
    salaryMax: 22000000,
    jobType: "full_time",
    experienceLevel: "junior",
    expiresAt,
    skillIds: [skills.react.id, skills.typescript.id, skills["ui-ux"].id],
  });

  await createJob({
    recruiterId: nova.id,
    categoryId: categories.it.id,
    title: "Backend Developer Node.js",
    description: "Develop APIs and backend services for ecommerce systems.",
    requirements: "Node.js, Express, PostgreSQL, authentication flow.",
    benefits: "Hybrid working, annual bonus, technical mentoring.",
    location: "Hà Nội",
    salaryMin: 18000000,
    salaryMax: 30000000,
    jobType: "full_time",
    experienceLevel: "mid",
    expiresAt,
    skillIds: [skills.nodejs.id, skills.express.id, skills.postgresql.id],
  });

  await createJob({
    recruiterId: retail.id,
    categoryId: categories.marketing.id,
    title: "Marketing Manager",
    description: "Lead digital campaigns for retail and ecommerce channels.",
    requirements: "SEO, content marketing, campaign planning.",
    benefits: "Performance bonus, leadership training, company trips.",
    location: "Đà Nẵng",
    salaryMin: 20000000,
    salaryMax: 35000000,
    jobType: "full_time",
    experienceLevel: "manager",
    expiresAt,
    skillIds: [skills.seo.id, skills["content-marketing"].id],
  });

  await createJob({
    recruiterId: hireArch.id,
    categoryId: categories.business.id,
    title: "Product Manager",
    description: "Define product roadmap and work with engineering teams.",
    requirements: "Product mindset, user research, agile process.",
    benefits: "Stock option plan, product ownership, remote days.",
    location: "Remote",
    salaryMin: 25000000,
    salaryMax: 45000000,
    jobType: "remote",
    experienceLevel: "senior",
    expiresAt,
    skillIds: [skills["product-management"].id, skills["data-analysis"].id],
  });

  await createJob({
    recruiterId: nova.id,
    categoryId: categories.finance.id,
    title: "Data Analyst",
    description: "Analyze business metrics and build dashboards.",
    requirements: "SQL, reporting, data visualization, business analysis.",
    benefits: "Learning budget, laptop, yearly performance review.",
    location: "Thành phố Hồ Chí Minh",
    salaryMin: 15000000,
    salaryMax: 25000000,
    jobType: "full_time",
    experienceLevel: "mid",
    expiresAt,
    skillIds: [skills["data-analysis"].id, skills.postgresql.id],
  });

  await createJob({
    recruiterId: retail.id,
    categoryId: categories.marketing.id,
    title: "Content Marketing Intern",
    description: "Support content writing and social media activities.",
    requirements: "Good writing skills, creativity, basic SEO knowledge.",
    benefits: "Internship allowance, mentor support, certificate.",
    location: "Thành phố Hồ Chí Minh",
    salaryMin: 3000000,
    salaryMax: 6000000,
    jobType: "internship",
    experienceLevel: "no_exp",
    expiresAt,
    skillIds: [skills.seo.id, skills["content-marketing"].id],
  });
}

async function createHomeContent() {
  await prisma.homeFeature.createMany({
    data: [
      {
        icon: "shield",
        title: "Nhà tuyển dụng xác thực",
        description:
          "Doanh nghiệp được kiểm duyệt trước khi đăng tin, giúp ứng viên yên tâm hơn khi tìm kiếm cơ hội mới.",
        highlight: "100% xác minh",
        color: "blue",
        order: 1,
      },
      {
        icon: "clock",
        title: "Quy trình nhanh chóng",
        description:
          "Ứng viên có thể tìm việc, xem chi tiết và ứng tuyển trong một luồng đơn giản, tiết kiệm thời gian.",
        highlight: "Kết nối trực tiếp",
        color: "amber",
        order: 2,
      },
      {
        icon: "chart",
        title: "Thông tin rõ ràng",
        description:
          "Mức lương, địa điểm, kỹ năng và thời hạn tuyển dụng được trình bày rõ để dễ so sánh.",
        highlight: "Dữ liệu dễ đọc",
        color: "green",
        order: 3,
      },
      {
        icon: "user",
        title: "Hồ sơ thông minh",
        description:
          "Ứng viên có thể xây dựng hồ sơ tốt hơn và tìm các vị trí phù hợp với định hướng nghề nghiệp.",
        highlight: "Gợi ý phù hợp",
        color: "purple",
        order: 4,
      },
    ],
  });

  await prisma.testimonial.createMany({
    data: [
      {
        name: "Nguyễn Minh Trí",
        role: "Frontend Developer",
        avatar: "MT",
        content:
          "Tôi tìm được công việc phù hợp sau vài tuần. Thông tin tuyển dụng rõ ràng và thao tác rất dễ dùng.",
        rating: 5,
        order: 1,
      },
      {
        name: "Trần Thị Lan",
        role: "Marketing Manager",
        avatar: "TL",
        content:
          "HireArch giúp tôi so sánh nhiều cơ hội cùng lúc và kết nối với nhà tuyển dụng nhanh hơn.",
        rating: 5,
        order: 2,
      },
    ],
  });

  await prisma.siteMetric.createMany({
    data: [
      { value: "3x", label: "Nhanh hơn", order: 1 },
      { value: "92%", label: "Phù hợp", order: 2 },
      { value: "24/7", label: "Hỗ trợ", order: 3 },
    ],
  });
}

async function main() {
  await cleanup();

  const { recruiters } = await createUsers();
  const categories = await createCategories();
  const skills = await createSkills();

  await createJobs(recruiters, categories, skills);
  await createHomeContent();

  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

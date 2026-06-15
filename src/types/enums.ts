export const USER_ROLES = ['candidate', 'recruiter', 'admin', 'pending'] as const;
export type UserRole = typeof USER_ROLES[number];
export type UserStatus = 'active' | 'inactive' | 'banned';

export type JobType = 'full_time' | 'part_time' | 'remote' | 'internship' | 'contract';
export const JOB_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'CHO_DUYET',
  ACTIVE: 'DANG_HOAT_DONG',
  CLOSED: 'closed',
  DELETED: 'deleted',
} as const;
export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];
export type SalaryUnit = 'month' | 'year' | 'hour' | 'negotiable';
export type ExperienceLevel = 'no_exp' | 'junior' | 'mid' | 'senior' | 'manager';

export type CVStatus = 'draft' | 'active';
export type CVType = 'built' | 'uploaded';

export type ApplicationStatus = 'pending' | 'reviewing' | 'interview' | 'rejected' | 'cancelled';

export type NotificationType =
  | 'application_submitted'
  | 'new_applicant'
  | 'feedback_received'
  | 'status_updated'
  | 'new_message'
  | 'system';

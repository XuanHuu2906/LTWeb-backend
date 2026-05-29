export const USER_ROLES = ['candidate', 'recruiter', 'admin', 'pending'] as const;
export type UserRole = typeof USER_ROLES[number];
export type UserStatus = 'active' | 'inactive' | 'banned';

export type JobType = 'full_time' | 'part_time' | 'remote' | 'internship' | 'contract';
export type JobStatus = 'draft' | 'active' | 'closed' | 'deleted';
export type SalaryUnit = 'month' | 'year' | 'hour' | 'negotiable';
export type ExperienceLevel = 'no_exp' | 'junior' | 'mid' | 'senior' | 'manager';

export type CVStatus = 'draft' | 'active';
export type CVType = 'built' | 'uploaded';

export type ApplicationStatus = 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'cancelled';

export type NotificationType =
  | 'application_submitted'
  | 'new_applicant'
  | 'feedback_received'
  | 'status_updated'
  | 'new_message'
  | 'system';

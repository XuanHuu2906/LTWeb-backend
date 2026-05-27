type FieldRule = {
  type: 'string' | 'number';
  required: boolean;
};

export const searchSchema: Record<string, FieldRule> = {
  keyword: { type: 'string', required: false },
  location: { type: 'string', required: false },
  salaryMin: { type: 'number', required: false },
  salaryMax: { type: 'number', required: false },
  jobType: { type: 'string', required: false },
  experienceLevel: { type: 'string', required: false },
  categoryId: { type: 'number', required: false },
};

type Validator = (value: any) => string | null;

const optionalString =
  (fieldName: string, maxLength?: number): Validator =>
  (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return `${fieldName} phải là chuỗi`;
    if (maxLength && value.length > maxLength) {
      return `${fieldName} không được vượt quá ${maxLength} ký tự`;
    }
    return null;
  };

const optionalJsonLike =
  (fieldName: string): Validator =>
  (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'object' && typeof value !== 'string') {
      return `${fieldName} phải là object hoặc JSON string`;
    }
    return null;
  };

const optionalNumber =
  (fieldName: string): Validator =>
  (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return `${fieldName} phải là số nguyên`;
    }
    return null;
  };

export const createCVSchema: Record<string, Validator> = {
  title: optionalString('title', 255),
  personalInfo: optionalJsonLike('personalInfo'),
  education: optionalJsonLike('education'),
  experience: optionalJsonLike('experience'),
  skills: optionalJsonLike('skills'),
  certifications: optionalJsonLike('certifications'),
  projects: optionalJsonLike('projects'),
  templateId: optionalNumber('templateId'),
};

export const updateCVSchema: Record<string, Validator> = {
  ...createCVSchema,
};

export const updateCVStatusSchema: Record<string, Validator> = {
  status: (value) => {
    if (value !== 'draft' && value !== 'active') {
      return 'status chỉ được là draft hoặc active';
    }
    return null;
  },
};

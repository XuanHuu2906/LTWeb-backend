type Validator = (value: any) => string | null;

const requiredNumber =
  (fieldName: string): Validator =>
  (value) => {
    if (value === undefined || value === null) {
      return `${fieldName} là bắt buộc`;
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return `${fieldName} phải là số nguyên dương`;
    }
    return null;
  };

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

export const applySchema: Record<string, Validator> = {
  jobPostingId: requiredNumber('jobPostingId'),
  cvId: requiredNumber('cvId'),
  coverLetter: optionalString('coverLetter', 5000),
};

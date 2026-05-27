type Validator = (value: any) => string | null;

const requiredNumber =
  (fieldName: string): Validator =>
  (value) => {
    if (value === undefined || value === null) return `${fieldName} là bắt buộc`;
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return `${fieldName} phải là số nguyên dương`;
    }
    return null;
  };

const optionalNumber =
  (fieldName: string): Validator =>
  (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return `${fieldName} phải là số nguyên dương`;
    }
    return null;
  };

const requiredString =
  (fieldName: string, minLength: number, maxLength: number): Validator =>
  (value) => {
    if (value === undefined || value === null) return `${fieldName} là bắt buộc`;
    if (typeof value !== 'string') return `${fieldName} phải là chuỗi`;
    if (value.trim().length < minLength) {
      return `${fieldName} phải có ít nhất ${minLength} ký tự`;
    }
    if (value.length > maxLength) {
      return `${fieldName} không được vượt quá ${maxLength} ký tự`;
    }
    return null;
  };

export const createConversationSchema: Record<string, Validator> = {
  recruiterProfileId: requiredNumber('recruiterProfileId'),
  jobPostingId: optionalNumber('jobPostingId'),
};

export const sendMessageSchema: Record<string, Validator> = {
  content: requiredString('content', 1, 10000),
};

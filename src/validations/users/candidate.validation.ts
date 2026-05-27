type Validator = (value: any) => string | null;

const requiredString =
  (fieldName: string, maxLength?: number): Validator =>
  (value) => {
    if (value === undefined || value === null || value === '') {
      return `${fieldName} là bắt buộc`;
    }
    if (typeof value !== 'string') return `${fieldName} phải là chuỗi`;
    if (maxLength && value.length > maxLength) {
      return `${fieldName} không được vượt quá ${maxLength} ký tự`;
    }
    return null;
  };

const optionalString =
  (fieldName: string, maxLength?: number): Validator =>
  (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return `${fieldName} phải là chuỗi`;
    if (maxLength && value.length > maxLength) {
      return `${fieldName} không được vượt quá ${maxLength} ký tự`;
    }
    return null;
  };

export const updateCandidateProfileSchema: Record<string, Validator> = {
  fullName: requiredString('fullName', 100),
  phone: optionalString('phone'),
  address: optionalString('address'),
  dateOfBirth: optionalString('dateOfBirth'),
  bio: optionalString('bio', 2000),
};

export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  OPS = 'ops',
}

export interface User {
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  address?: string;
  roles: UserRole[];
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

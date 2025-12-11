import { IsEmail, IsNotEmpty, IsString, IsOptional, MinLength, IsEnum, IsArray } from 'class-validator';
import { UserRole } from '../../../common/interfaces/user.interface';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsArray()
  @IsEnum(UserRole, { each: true })
  @IsOptional()
  roles?: UserRole[];
}

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserRole } from '../../common/interfaces/user.interface';

// This is a mock service - replace with actual database integration
@Injectable()
export class UsersService {
  private users: User[] = [];
  private idCounter = 1;

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = this.users.find(
      (user) => user.email === createUserDto.email,
    );

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const newUser: User = {
      id: this.idCounter++,
      ...createUserDto,
      roles: createUserDto.roles || [UserRole.CUSTOMER],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.push(newUser);
    return newUser;
  }

  async findAll() {
    return this.users.map(({ password, refreshToken, ...user }) => user);
  }

  async findOne(id: number): Promise<User> {
    const user = this.users.find((user) => user.id === id);
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.users.find((user) => user.email === email);
  }

  async update(id: number, updateUserDto: Partial<CreateUserDto>) {
    const userIndex = this.users.findIndex((user) => user.id === id);
    
    if (userIndex === -1) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updateUserDto,
      updatedAt: new Date(),
    };

    const { password, refreshToken, ...result } = this.users[userIndex];
    return result;
  }

  async updateRefreshToken(userId: number, refreshToken: string | null) {
    const userIndex = this.users.findIndex((user) => user.id === userId);
    
    if (userIndex === -1) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    this.users[userIndex] = {
      ...this.users[userIndex],
      refreshToken,
      updatedAt: new Date(),
    };
  }

  async remove(id: number) {
    const userIndex = this.users.findIndex((user) => user.id === id);
    
    if (userIndex === -1) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.users.splice(userIndex, 1);
    return { message: 'User deleted successfully' };
  }
}

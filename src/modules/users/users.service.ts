import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

// This is a mock service - replace with actual database integration
@Injectable()
export class UsersService {
  private users: any[] = [];
  private idCounter = 1;

  async create(createUserDto: CreateUserDto) {
    const existingUser = this.users.find(
      (user) => user.email === createUserDto.email,
    );

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const newUser = {
      id: this.idCounter++,
      ...createUserDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.push(newUser);
    return newUser;
  }

  async findAll() {
    return this.users.map(({ password, ...user }) => user);
  }

  async findOne(id: number) {
    const user = this.users.find((user) => user.id === id);
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = user;
    return result;
  }

  async findByEmail(email: string) {
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

    const { password, ...result } = this.users[userIndex];
    return result;
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

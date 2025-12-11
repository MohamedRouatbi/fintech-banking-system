import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces/user.interface';
import { AuditService, AuditAction } from '../../common/services/audit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPS)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: Partial<CreateUserDto>,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const result = await this.usersService.update(id, updateUserDto);
    this.auditService.logSuccess(
      AuditAction.USER_UPDATED,
      currentUserId,
      { targetUserId: id, changes: updateUserDto },
    );
    return result;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') currentUserId: number,
  ) {
    const result = await this.usersService.remove(id);
    this.auditService.logSuccess(
      AuditAction.USER_DELETED,
      currentUserId,
      { targetUserId: id },
    );
    return result;
  }
}

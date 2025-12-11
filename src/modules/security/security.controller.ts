import { Controller, Get, UseGuards } from '@nestjs/common';
import { SecurityService } from './security.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces/user.interface';

@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('metrics')
  @Roles(UserRole.ADMIN, UserRole.OPS)
  getSecurityMetrics() {
    return this.securityService.getSecurityMetrics();
  }
}

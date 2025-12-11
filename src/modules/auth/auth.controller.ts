import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req, Ip } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtRefreshAuthGuard } from '../../common/guards/jwt-refresh-auth.guard';
import { AuditService, AuditAction } from '../../common/services/audit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Ip() ip: string) {
    const result = await this.authService.register(registerDto);
    this.auditService.logSuccess(
      AuditAction.USER_REGISTERED,
      result.user.id,
      { email: registerDto.email, ip },
    );
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Ip() ip: string) {
    const result = await this.authService.login(loginDto);
    this.auditService.logSuccess(
      AuditAction.USER_LOGIN,
      result.user.id,
      { email: loginDto.email, ip },
    );
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('sub') userId: number) {
    const result = await this.authService.logout(userId);
    this.auditService.logSuccess(AuditAction.USER_LOGOUT, userId);
    return result;
  }

  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @CurrentUser('sub') userId: number,
    @Body() refreshTokenDto: RefreshTokenDto,
  ) {
    return this.authService.refreshTokens(userId, refreshTokenDto.refresh_token);
  }
}

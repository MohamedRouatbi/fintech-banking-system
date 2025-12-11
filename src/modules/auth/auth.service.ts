import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as argon2 from 'argon2';
import { JwtPayload, TokenPair } from '../../common/interfaces/jwt.interface';
import { UserRole } from '../../common/interfaces/user.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const hashedPassword = await argon2.hash(registerDto.password);
    
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
      roles: [UserRole.CUSTOMER], // Default role
    });

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.updateRefreshToken(user.id, tokens.refresh_token);

    const { password, refreshToken, ...result } = user;
    return {
      user: result,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.password, loginDto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.updateRefreshToken(user.id, tokens.refresh_token);
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
      ...tokens,
    };
  }

  async logout(userId: number) {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  async refreshTokens(userId: number, refreshToken: string): Promise<TokenPair> {
    const user = await this.usersService.findOne(userId);
    
    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    const refreshTokenMatches = await argon2.verify(
      user.refreshToken,
      refreshToken,
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.updateRefreshToken(user.id, tokens.refresh_token);

    return tokens;
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    
    if (user && (await argon2.verify(user.password, password))) {
      const { password, refreshToken, ...result } = user;
      return result;
    }
    
    return null;
  }

  private async generateTokens(
    userId: number,
    email: string,
    roles: UserRole[],
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      roles,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d',
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async updateRefreshToken(userId: number, refreshToken: string) {
    const hashedRefreshToken = refreshToken ? await argon2.hash(refreshToken) : null;
    await this.usersService.updateRefreshToken(userId, hashedRefreshToken);
  }
}

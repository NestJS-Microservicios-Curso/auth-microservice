import { HttpStatus, Injectable } from '@nestjs/common';
import { LoginUserDto, RegisterUserDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { RpcException } from '@nestjs/microservices';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { envs } from '../config';

@Injectable()
export class AuthService {
  private readonly passwordOptions = {
    type: argon2.argon2id,
    memoryCost: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerUser(dto: RegisterUserDto) {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new RpcException({
        status: HttpStatus.CONFLICT,
        message: `User with email ${email} already exists`,
      });
    }

    const password = await argon2.hash(dto.password, this.passwordOptions);

    const user = await this.prisma.user.create({
      data: { email, name: dto.name, password },
    });

    const publicUser = this.toPublicUser(user);

    return {
      user: publicUser,
      token: this.jwtService.sign(publicUser),
    };
  }

  async loginUser(dto: LoginUserDto) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const isValid = user && (await argon2.verify(user.password, dto.password));

    if (!isValid) {
      throw new RpcException({
        status: HttpStatus.UNAUTHORIZED,
        message: 'Invalid credentials',
      });
    }

    const publicUser = this.toPublicUser(user);

    return {
      user: publicUser,
      token: this.jwtService.sign(publicUser),
    };
  }

  private toPublicUser(user: { id: string; email: string; name: string }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  async verifyToken(token: string) {
    try {
      const {
        sub: _sub,
        iat: _iat,
        exp: _exp,
        ...user
      } = this.jwtService.verify(token, {
        secret: envs.jwtSecret,
      });

      return {
        user,
        token: await this.signToken(user as JwtPayload),
      };
    } catch (_error: unknown) {
      throw new RpcException({
        status: HttpStatus.UNAUTHORIZED,
        message: 'Invalid token',
      });
    }
  }

  async signToken(payload: JwtPayload) {
    return await this.jwtService.signAsync(payload);
  }
}

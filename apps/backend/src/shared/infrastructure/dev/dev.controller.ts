import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { DomainError } from '@shared/kernel';
import { Public } from '../http/public.decorator';

export class EchoRequestDto {
  @IsString()
  @Length(1, 200)
  message!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  repeat?: number;
}

export class SampleConflictError extends DomainError {
  readonly code = 'SAMPLE_CONFLICT';
  readonly kind = 'CONFLICT';

  constructor() {
    super('Sample conflict raised by the development endpoint.');
  }
}

/**
 * Development-only routes that exercise the HTTP cross-cutting behaviour (validation, problem+json,
 * request ids) before any business module exists. Never registered in production.
 */
@Public()
@ApiTags('dev')
@Controller({ path: '_dev', version: '1' })
export class DevController {
  @Post('echo')
  @HttpCode(200)
  echo(@Body() body: EchoRequestDto): { message: string } {
    return { message: Array.from({ length: body.repeat ?? 1 }, () => body.message).join(' ') };
  }

  @Get('sample-conflict')
  sampleConflict(): never {
    throw new SampleConflictError();
  }
}

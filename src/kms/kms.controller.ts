import { Controller } from '@nestjs/common';
import { KmsService } from './kms.service';

@Controller('kms')
export class KmsController {
  constructor(private readonly kmsService: KmsService) {}
}

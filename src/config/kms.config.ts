import { registerAs } from '@nestjs/config';

export default registerAs('kms', () => ({
  url: process.env.KMS_URL || 'http://localhost:9998',
  apiKey: process.env.KMS_API_KEY || '',
}));

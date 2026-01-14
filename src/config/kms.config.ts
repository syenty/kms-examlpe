import { registerAs } from '@nestjs/config';

export default registerAs('kms', () => ({
  url: process.env.KMS_URL || 'http://localhost:9998',
  symmetricKeyId: process.env.KMS_SYMMETRIC_KEY_ID || null,
  rsaKeyId: process.env.KMS_RSA_KEY_ID || null,
}));

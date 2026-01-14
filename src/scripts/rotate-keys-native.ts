import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { EncryptionService } from '../encryption/encryption.service';
import { KmsService } from '../kms/kms.service';

/**
 * Native KMS Re-Key Script
 *
 * Uses Cosmian KMS's native Re-key operation to generate a replacement key.
 * This is the recommended way to rotate keys in KMS.
 *
 * What happens:
 * 1. KMS generates a new replacement key
 * 2. KMS automatically links the old key to the new key
 * 3. Script re-encrypts all data with the new key
 * 4. Old key can be revoked (but not deleted, for recovery)
 *
 * Usage:
 *   npm run rotate-keys:native
 *
 * No parameters needed - uses current KMS_SYMMETRIC_KEY_ID
 */
async function rotateKeysNative() {
  console.log('🔄 Starting native KMS key rotation...\n');

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const usersService = app.get(UsersService);
    const encryptionService = app.get(EncryptionService);
    const kmsService = app.get(KmsService);

    // Get current key ID
    const oldKeyId = kmsService.getSymmetricKeyId();
    if (!oldKeyId) {
      console.error('❌ Error: No KMS_SYMMETRIC_KEY_ID configured');
      console.error('');
      console.error('Please set KMS_SYMMETRIC_KEY_ID in .env file first.');
      process.exit(1);
    }

    console.log(`🔑 Current Key ID: ${oldKeyId}\n`);

    // Step 1: Use KMS Re-key operation to generate replacement key
    console.log('📝 Step 1: Generating replacement key using KMS Re-key operation...');
    let newKeyId: string;
    try {
      newKeyId = await kmsService.reKeySymmetric(oldKeyId);
      console.log(`✅ New key generated: ${newKeyId}`);
      console.log(`   KMS automatically linked old and new keys\n`);
    } catch (error) {
      console.error(`❌ Failed to generate replacement key: ${error.message}`);
      process.exit(1);
    }

    // Step 2: Get all users and re-encrypt data
    console.log('📝 Step 2: Re-encrypting user data...\n');
    const users = await usersService.findAll();
    console.log(`📊 Found ${users.length} users to re-encrypt\n`);

    if (users.length === 0) {
      console.log('✅ No users to process.');
      console.log('\n📝 Next steps:');
      console.log(`   1. Update .env: KMS_SYMMETRIC_KEY_ID=${newKeyId}`);
      console.log('   2. Restart the application');
      await app.close();
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Set new key temporarily for encryption
    kmsService.setSymmetricKeyId(newKeyId);

    // Process each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`[${i + 1}/${users.length}] Processing user: ${user.name} (${user.id})`);

      try {
        // Decrypt with old key (using stored keyId)
        // Reset to old key for decryption
        kmsService.setSymmetricKeyId(oldKeyId);
        const decryptedEmail = await encryptionService.decryptEmail(
          user.email,
          user.emailKeyId,
        );
        const decryptedPhone = await encryptionService.decryptPhone(
          user.phone,
          user.phoneKeyId,
        );

        // Set new key for encryption
        kmsService.setSymmetricKeyId(newKeyId);

        // Update user in database (will re-encrypt with new key)
        await usersService.update(user.id, {
          email: decryptedEmail,
          phone: decryptedPhone,
        });

        console.log(`  ✅ Successfully re-encrypted`);
        console.log(`     Old key: ${user.emailKeyId || 'local'} → New key: ${newKeyId}\n`);

        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}\n`);
        errorCount++;
        // Restore old key ID for next iteration
        kmsService.setSymmetricKeyId(oldKeyId);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total: ${users.length}\n`);

    if (errorCount === 0) {
      console.log('🎉 Key rotation completed successfully!');
      console.log('');
      console.log('📝 Next steps:');
      console.log(`   1. Update .env: KMS_SYMMETRIC_KEY_ID=${newKeyId}`);
      console.log('   2. Restart the application');
      console.log('');
      console.log('🔐 Security recommendations:');
      console.log(`   - Revoke old key in KMS: cosmian kms sym keys revoke -k ${oldKeyId}`);
      console.log('   - Keep old key for 1-3 months before deletion (for recovery)');
      console.log(`   - Old key can still decrypt existing data even when revoked`);
    } else {
      console.log('⚠️  Key rotation completed with errors.');
      console.log('   Please check the errors above and retry for failed users.');
      console.log('');
      console.log('⚠️  Do NOT update .env or revoke the old key until all data is migrated!');
    }
  } catch (error) {
    console.error('\n❌ Fatal error during key rotation:');
    console.error(error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run the script
rotateKeysNative()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

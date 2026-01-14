import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { EncryptionService } from '../encryption/encryption.service';
import { KmsService } from '../kms/kms.service';

/**
 * Key Rotation Script
 *
 * This script re-encrypts all user data with a new key.
 *
 * Usage:
 *   1. Create a new key in KMS UI
 *   2. Set NEW_KMS_SYMMETRIC_KEY_ID environment variable
 *   3. Run: npm run rotate-keys
 *
 * Example:
 *   NEW_KMS_SYMMETRIC_KEY_ID=new-key-id npm run rotate-keys
 */
async function rotateKeys() {
  console.log('🔄 Starting key rotation...\n');

  // Get new key ID from environment
  const newKeyId = process.env.NEW_KMS_SYMMETRIC_KEY_ID;
  if (!newKeyId) {
    console.error('❌ Error: NEW_KMS_SYMMETRIC_KEY_ID environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error('  NEW_KMS_SYMMETRIC_KEY_ID=your-new-key-id npm run rotate-keys');
    process.exit(1);
  }

  console.log(`📝 New Key ID: ${newKeyId}\n`);

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const usersService = app.get(UsersService);
    const encryptionService = app.get(EncryptionService);
    const kmsService = app.get(KmsService);

    // Get all users
    const users = await usersService.findAll();
    console.log(`📊 Found ${users.length} users to re-encrypt\n`);

    if (users.length === 0) {
      console.log('✅ No users to process. Exiting.');
      await app.close();
      return;
    }

    // Temporarily set the new key ID
    const oldKeyId = kmsService.getSymmetricKeyId();
    console.log(`🔑 Current Key ID: ${oldKeyId || 'None (using local encryption)'}`);
    console.log(`🔑 New Key ID: ${newKeyId}\n`);

    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log(`[${i + 1}/${users.length}] Processing user: ${user.name} (${user.id})`);

      try {
        // Decrypt with old key (using stored keyId)
        const decryptedEmail = await encryptionService.decryptEmail(
          user.email,
          user.id, // This will use the keyId stored in the database
        );
        const decryptedPhone = await encryptionService.decryptPhone(
          user.phone,
          user.id,
        );

        // Set new key temporarily
        kmsService.setSymmetricKeyId(newKeyId);

        // Re-encrypt with new key
        const newEncryptedEmail = await encryptionService.encryptEmail(decryptedEmail);
        const newEncryptedPhone = await encryptionService.encryptPhone(decryptedPhone);

        // Update user in database
        await usersService.update(user.id, {
          email: decryptedEmail, // Service will re-encrypt
          phone: decryptedPhone,
        });

        console.log(`  ✅ Successfully re-encrypted`);
        console.log(`     Old email key: ${user.emailKeyId || 'local'}`);
        console.log(`     New email key: ${newEncryptedEmail.keyId}`);
        console.log(`     Old phone key: ${user.phoneKeyId || 'local'}`);
        console.log(`     New phone key: ${newEncryptedPhone.keyId}\n`);

        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed: ${error.message}\n`);
        errorCount++;
      }

      // Restore old key ID for next iteration
      if (oldKeyId) {
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
      console.log('   3. (Optional) Revoke the old key in KMS UI');
    } else {
      console.log('⚠️  Key rotation completed with errors.');
      console.log('   Please check the errors above and retry for failed users.');
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
rotateKeys()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

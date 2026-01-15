const axios = require('axios');

const KMS_URL = process.env.KMS_URL || 'http://localhost:9998';
const KEY_ID = process.env.KMS_SYMMETRIC_KEY_ID || process.argv[2];

async function reKey() {
  if (!KEY_ID) {
    console.error('❌ Error: KEY_ID is required');
    console.log('Usage: node scripts/re-key.js [KEY_ID]');
    console.log('   or: KMS_SYMMETRIC_KEY_ID=xxx node scripts/re-key.js');
    console.log('\nExample:');
    console.log('   node scripts/re-key.js my-key-id');
    console.log('\n💡 Note: Re-key should only be performed once on a given key.');
    process.exit(1);
  }

  console.log('🔄 Testing Re-Key operation with Cosmian KMS');
  console.log(`KMS URL: ${KMS_URL}`);
  console.log(`Original Key ID: ${KEY_ID}\n`);

  try {
    const reKeyRequest = {
      tag: 'ReKey',
      type: 'Structure',
      value: [
        {
          tag: 'UniqueIdentifier',
          type: 'TextString',
          value: KEY_ID
        }
      ]
    };

    console.log('📤 Sending Re-Key request...');
    console.log(JSON.stringify(reKeyRequest, null, 2));
    console.log();

    const response = await axios.post(`${KMS_URL}/kmip/2_1`, reKeyRequest);

    console.log('📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Extract re-key result
    if (response.data && response.data.value) {
      const newKeyId = response.data.value.find(item => item.tag === 'UniqueIdentifier');

      console.log('\n✅ Re-Key operation successful!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (newKeyId) {
        console.log(`\n🔑 New Replacement Key ID: ${newKeyId.value}`);
        console.log(`🔗 Original Key ID: ${KEY_ID}`);

        console.log('\n📋 Key Relationships:');
        console.log(`   - Original key now has "Replacement Object" link → ${newKeyId.value}`);
        console.log(`   - New key has "Replaced Key" link → ${KEY_ID}`);

        console.log('\n💡 Next Steps:');
        console.log(`   1. Use the new key for future encryption: ${newKeyId.value}`);
        console.log(`   2. Keep the original key for decrypting existing data: ${KEY_ID}`);
        console.log(`   3. Plan migration of encrypted data to the new key`);
      }

      console.log('\n⚠️  Important Notes:');
      console.log('   - The new key inherits attributes from the original key');
      console.log('   - Re-key should only be performed once on a given key');
      console.log('   - Both keys are linked for lifecycle management');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Return re-key data for potential chaining
      return {
        originalKeyId: KEY_ID,
        newKeyId: newKeyId?.value
      };
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

reKey();

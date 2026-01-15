const axios = require('axios');

const KMS_URL = process.env.KMS_URL || 'http://localhost:9998';
const KEY_ID = process.env.KMS_SYMMETRIC_KEY_ID || process.argv[2];
const ENCRYPTED_DATA_HEX = process.argv[3];
const IV_HEX = process.argv[4];
const AUTH_TAG_HEX = process.argv[5];

async function decryptTest() {
  if (!KEY_ID || !ENCRYPTED_DATA_HEX || !IV_HEX || !AUTH_TAG_HEX) {
    console.error('❌ Error: All parameters are required');
    console.log('Usage: node scripts/decrypt.js [KEY_ID] [ENCRYPTED_DATA_HEX] [IV_HEX] [AUTH_TAG_HEX]');
    console.log('   or: KMS_SYMMETRIC_KEY_ID=xxx node scripts/decrypt.js [ENCRYPTED_DATA_HEX] [IV_HEX] [AUTH_TAG_HEX]');
    console.log('\nExample:');
    console.log('   node scripts/decrypt.js my-key-id "abc123..." "def456..." "ghi789..."');
    console.log('\n💡 Tip: You can get these values from the encrypt.js output');
    process.exit(1);
  }

  console.log('🔓 Testing Decrypt operation with Cosmian KMS');
  console.log(`KMS URL: ${KMS_URL}`);
  console.log(`Key ID: ${KEY_ID}\n`);

  try {
    // Display input data
    console.log('📝 Input Data:');
    console.log(`   Encrypted Data (Hex): ${ENCRYPTED_DATA_HEX}`);
    console.log(`   IV (Hex): ${IV_HEX}`);
    console.log(`   Auth Tag (Hex): ${AUTH_TAG_HEX}`);

    // Convert hex to buffers for size info
    const encryptedBuffer = Buffer.from(ENCRYPTED_DATA_HEX, 'hex');
    const ivBuffer = Buffer.from(IV_HEX, 'hex');
    const tagBuffer = Buffer.from(AUTH_TAG_HEX, 'hex');

    console.log(`\n   Sizes:`);
    console.log(`   - Encrypted: ${encryptedBuffer.length} bytes`);
    console.log(`   - IV: ${ivBuffer.length} bytes`);
    console.log(`   - Auth Tag: ${tagBuffer.length} bytes\n`);

    const decryptRequest = {
      tag: 'Decrypt',
      value: [
        {
          tag: 'UniqueIdentifier',
          type: 'TextString',
          value: KEY_ID
        },
        {
          tag: 'CryptographicParameters',
          value: [
            {
              tag: 'BlockCipherMode',
              type: 'Enumeration',
              value: 'GCM'
            },
            {
              tag: 'CryptographicAlgorithm',
              type: 'Enumeration',
              value: 'AES'
            }
          ]
        },
        {
          tag: 'Data',
          type: 'ByteString',
          value: ENCRYPTED_DATA_HEX
        },
        {
          tag: 'IVCounterNonce',
          type: 'ByteString',
          value: IV_HEX
        },
        {
          tag: 'AuthenticatedEncryptionTag',
          type: 'ByteString',
          value: AUTH_TAG_HEX
        }
      ]
    };

    console.log('📤 Sending Decrypt request...');
    console.log(JSON.stringify(decryptRequest, null, 2));
    console.log();

    const response = await axios.post(`${KMS_URL}/kmip/2_1`, decryptRequest);

    console.log('📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Extract decryption results
    if (response.data && response.data.value) {
      const decryptedData = response.data.value.find(item => item.tag === 'Data');
      const uniqueId = response.data.value.find(item => item.tag === 'UniqueIdentifier');

      console.log('\n✅ Decryption successful!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (uniqueId) {
        console.log(`\n🔑 Key ID used: ${uniqueId.value}`);
      }

      if (decryptedData) {
        const decryptedHex = decryptedData.value;
        const decryptedBuffer = Buffer.from(decryptedHex, 'hex');
        const decryptedText = decryptedBuffer.toString('utf8');
        const decryptedBase64 = decryptedBuffer.toString('base64');

        console.log(`\n📄 Decrypted Data:`);
        console.log(`   Plaintext: ${decryptedText}`);
        console.log(`   Hex: ${decryptedHex}`);
        console.log(`   Base64: ${decryptedBase64}`);
        console.log(`   Bytes: ${decryptedBuffer.length} bytes`);
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Return decrypted data for potential chaining
      return {
        keyId: uniqueId?.value,
        plaintext: decryptedData ? Buffer.from(decryptedData.value, 'hex').toString('utf8') : null,
        decryptedDataHex: decryptedData?.value
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

decryptTest();

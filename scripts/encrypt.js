const axios = require('axios');

const KMS_URL = process.env.KMS_URL || 'http://localhost:9998';
const KEY_ID = process.env.KMS_SYMMETRIC_KEY_ID || process.argv[2];
const PLAINTEXT = process.argv[3] || 'Hello, World! This is a test message.';

async function encryptTest() {
  if (!KEY_ID) {
    console.error('❌ Error: KEY_ID is required');
    console.log('Usage: node scripts/encrypt-test.js [KEY_ID] [PLAINTEXT]');
    console.log('   or: KMS_SYMMETRIC_KEY_ID=xxx node scripts/encrypt-test.js');
    console.log('\nExample:');
    console.log('   node scripts/encrypt-test.js my-key-id "Secret message"');
    process.exit(1);
  }

  console.log('🔐 Testing Encrypt operation with Cosmian KMS');
  console.log(`KMS URL: ${KMS_URL}`);
  console.log(`Key ID: ${KEY_ID}`);
  console.log(`Plaintext: ${PLAINTEXT}\n`);

  try {
    // Convert plaintext to hexadecimal (KMIP ByteString format)
    const plaintextHex = Buffer.from(PLAINTEXT, 'utf8').toString('hex');

    console.log('📝 Input Data:');
    console.log(`   Original: ${PLAINTEXT}`);
    console.log(`   Hex: ${plaintextHex}`);
    console.log(`   Bytes: ${Buffer.from(PLAINTEXT, 'utf8').length} bytes\n`);

    const encryptRequest = {
      tag: 'Encrypt',
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
          value: plaintextHex
        }
      ]
    };

    console.log('📤 Sending Encrypt request...');
    console.log(JSON.stringify(encryptRequest, null, 2));
    console.log();

    const response = await axios.post(`${KMS_URL}/kmip/2_1`, encryptRequest);

    console.log('📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Extract encryption results
    if (response.data && response.data.value) {
      const encryptedData = response.data.value.find(item => item.tag === 'Data');
      const ivCounterNonce = response.data.value.find(item => item.tag === 'IVCounterNonce');
      const authTag = response.data.value.find(item => item.tag === 'AuthenticatedEncryptionTag');
      const uniqueId = response.data.value.find(item => item.tag === 'UniqueIdentifier');

      console.log('\n✅ Encryption successful!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (uniqueId) {
        console.log(`\n🔑 Key ID used: ${uniqueId.value}`);
      }

      if (encryptedData) {
        const encryptedHex = encryptedData.value;
        const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
        const encryptedBase64 = encryptedBuffer.toString('base64');

        console.log(`\n📦 Encrypted Data:`);
        console.log(`   Hex: ${encryptedHex}`);
        console.log(`   Base64: ${encryptedBase64}`);
        console.log(`   Bytes: ${encryptedBuffer.length} bytes (${encryptedHex.length} hex chars)`);
      }

      if (ivCounterNonce) {
        const ivHex = ivCounterNonce.value;
        const ivBuffer = Buffer.from(ivHex, 'hex');
        const ivBase64 = ivBuffer.toString('base64');

        console.log(`\n🎲 IV/Counter/Nonce:`);
        console.log(`   Hex: ${ivHex}`);
        console.log(`   Base64: ${ivBase64}`);
        console.log(`   Bytes: ${ivBuffer.length} bytes`);
      }

      if (authTag) {
        const tagHex = authTag.value;
        const tagBuffer = Buffer.from(tagHex, 'hex');
        const tagBase64 = tagBuffer.toString('base64');

        console.log(`\n🔏 Authentication Tag:`);
        console.log(`   Hex: ${tagHex}`);
        console.log(`   Base64: ${tagBase64}`);
        console.log(`   Bytes: ${tagBuffer.length} bytes`);
      }

      console.log('\n💡 Tip: Save these values to decrypt the data later');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Return encrypted data for potential chaining
      return {
        keyId: uniqueId?.value,
        encryptedData: encryptedData?.value,
        iv: ivCounterNonce?.value,
        authTag: authTag?.value
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

encryptTest();

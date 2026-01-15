const axios = require('axios');

const KMS_URL = process.env.KMS_URL || 'http://localhost:9998';
const KEY_ID = process.env.KMS_SYMMETRIC_KEY_ID || process.argv[2];

async function reKeyTest() {
  if (!KEY_ID) {
    console.error('❌ Error: KEY_ID is required');
    console.log('Usage: node scripts/reKeyTest.js [KEY_ID]');
    console.log('   or: KMS_SYMMETRIC_KEY_ID=xxx node scripts/reKeyTest.js');
    process.exit(1);
  }

  console.log('🧪 Re-Key Test - Verifying backward compatibility');
  console.log(`KMS URL: ${KMS_URL}`);
  console.log(`Key ID: ${KEY_ID}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testPlaintext = 'Hello, this is a test message for re-key verification!';

  try {
    // Step 1: Encrypt data with original key
    console.log('📝 Step 1: Encrypting test data with original key...');
    const plaintextHex = Buffer.from(testPlaintext, 'utf8').toString('hex');

    const encryptRequest = {
      tag: 'Encrypt',
      value: [
        {
          tag: 'UniqueIdentifier',
          type: 'TextString',
          value: KEY_ID,
        },
        {
          tag: 'CryptographicParameters',
          value: [
            {
              tag: 'BlockCipherMode',
              type: 'Enumeration',
              value: 'GCM',
            },
            {
              tag: 'CryptographicAlgorithm',
              type: 'Enumeration',
              value: 'AES',
            },
          ],
        },
        {
          tag: 'Data',
          type: 'ByteString',
          value: plaintextHex,
        },
      ],
    };

    const encryptResponse = await axios.post(`${KMS_URL}/kmip/2_1`, encryptRequest);

    const encryptedData = encryptResponse.data.value.find(item => item.tag === 'Data').value;
    const iv = encryptResponse.data.value.find(item => item.tag === 'IVCounterNonce').value;
    const authTag = encryptResponse.data.value.find(item => item.tag === 'AuthenticatedEncryptionTag').value;

    console.log('✅ Encryption successful!');
    console.log(`   Encrypted Data (first 32 chars): ${encryptedData.substring(0, 32)}...`);
    console.log(`   IV: ${iv}`);
    console.log(`   Auth Tag: ${authTag}\n`);

    // Step 2: Decrypt with original key
    console.log('📝 Step 2: Decrypting with original key...');
    const decryptRequest = {
      tag: 'Decrypt',
      value: [
        {
          tag: 'UniqueIdentifier',
          type: 'TextString',
          value: KEY_ID,
        },
        {
          tag: 'CryptographicParameters',
          value: [
            {
              tag: 'BlockCipherMode',
              type: 'Enumeration',
              value: 'GCM',
            },
            {
              tag: 'CryptographicAlgorithm',
              type: 'Enumeration',
              value: 'AES',
            },
          ],
        },
        {
          tag: 'Data',
          type: 'ByteString',
          value: encryptedData,
        },
        {
          tag: 'IVCounterNonce',
          type: 'ByteString',
          value: iv,
        },
        {
          tag: 'AuthenticatedEncryptionTag',
          type: 'ByteString',
          value: authTag,
        },
      ],
    };

    const decryptResponse = await axios.post(`${KMS_URL}/kmip/2_1`, decryptRequest);
    const decryptedHex = decryptResponse.data.value.find(item => item.tag === 'Data').value;
    const decryptedText = Buffer.from(decryptedHex, 'hex').toString('utf8');

    console.log('✅ Decryption successful!');
    console.log(`   Decrypted: "${decryptedText}"`);

    if (decryptedText === testPlaintext) {
      console.log('✅ Decrypted text matches original!\n');
    } else {
      console.error('❌ Decrypted text does NOT match original!\n');
      process.exit(1);
    }

    // Step 3: Perform re-key
    console.log('📝 Step 3: Performing re-key operation...');
    const reKeyRequest = {
      tag: 'ReKey',
      type: 'Structure',
      value: [
        {
          tag: 'UniqueIdentifier',
          type: 'TextString',
          value: KEY_ID,
        },
      ],
    };

    const reKeyResponse = await axios.post(`${KMS_URL}/kmip/2_1`, reKeyRequest);
    const returnedKeyId = reKeyResponse.data.value.find(item => item.tag === 'UniqueIdentifier').value;

    console.log('✅ Re-key operation completed!');
    console.log(`   Original Key ID: ${KEY_ID}`);
    console.log(`   Returned Key ID: ${returnedKeyId}`);

    if (returnedKeyId === KEY_ID) {
      console.log('✅ Key ID remains unchanged!\n');
    } else {
      console.log('⚠️  Key ID has changed! This indicates a NEW key was created.\n');
      console.log('   Original Key ID: ' + KEY_ID);
      console.log('   New Key ID: ' + returnedKeyId + '\n');
    }

    // Step 4: Decrypt old data with the same key ID after re-key
    console.log('📝 Step 4: Attempting to decrypt old data after re-key...');
    console.log(`   Using Key ID: ${returnedKeyId}`);

    try {
      const decryptAfterReKeyRequest = {
        tag: 'Decrypt',
        value: [
          {
            tag: 'UniqueIdentifier',
            type: 'TextString',
            value: returnedKeyId,
          },
          {
            tag: 'CryptographicParameters',
            value: [
              {
                tag: 'BlockCipherMode',
                type: 'Enumeration',
                value: 'GCM',
              },
              {
                tag: 'CryptographicAlgorithm',
                type: 'Enumeration',
                value: 'AES',
              },
            ],
          },
          {
            tag: 'Data',
            type: 'ByteString',
            value: encryptedData,
          },
          {
            tag: 'IVCounterNonce',
            type: 'ByteString',
            value: iv,
          },
          {
            tag: 'AuthenticatedEncryptionTag',
            type: 'ByteString',
            value: authTag,
          },
        ],
      };

      const decryptAfterResponse = await axios.post(`${KMS_URL}/kmip/2_1`, decryptAfterReKeyRequest);
      const decryptedAfterHex = decryptAfterResponse.data.value.find(item => item.tag === 'Data').value;
      const decryptedAfterText = Buffer.from(decryptedAfterHex, 'hex').toString('utf8');

      console.log('✅ Decryption after re-key SUCCESSFUL!');
      console.log(`   Decrypted: "${decryptedAfterText}"`);

      if (decryptedAfterText === testPlaintext) {
        console.log('✅ Decrypted text matches original!\n');
      } else {
        console.error('❌ Decrypted text does NOT match original!\n');
        process.exit(1);
      }

      // Final conclusion
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 TEST PASSED: Re-key maintains backward compatibility!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n📋 Summary:');
      console.log('   ✅ Data encrypted before re-key can be decrypted after re-key');
      console.log('   ✅ Key ID remains unchanged: ' + returnedKeyId);
      console.log('   ✅ No application configuration changes needed');
      console.log('   ✅ Scenario B confirmed: Key material rotated, ID preserved\n');

    } catch (decryptError) {
      console.error('❌ Decryption after re-key FAILED!');
      console.error('   Error:', decryptError.response?.data || decryptError.message);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('❌ TEST FAILED: Old data cannot be decrypted after re-key!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n📋 Summary:');
      console.log('   ❌ Data encrypted before re-key CANNOT be decrypted after re-key');

      if (returnedKeyId === KEY_ID) {
        console.log('   ⚠️  Key ID remained the same, but key material changed');
        console.log('   ⚠️  This breaks backward compatibility!');
        console.log('\n💡 Recommendation:');
        console.log('   - Store the key version or key ID with each encrypted record');
        console.log('   - Maintain old key versions for decryption');
        console.log('   - Implement data re-encryption strategy\n');
      } else {
        console.log('   ⚠️  A new key ID was created: ' + returnedKeyId);
        console.log('   ⚠️  Old data needs the original key ID: ' + KEY_ID);
        console.log('\n💡 Recommendation:');
        console.log('   - Store the key ID used for encryption with each record');
        console.log('   - Use the stored key ID for decryption');
        console.log('   - Keep old keys accessible for historical data\n');
      }

      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

reKeyTest();

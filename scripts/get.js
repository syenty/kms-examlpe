const axios = require('axios');

const KMS_URL = process.env.KMS_URL || 'http://localhost:9998';
const KEY_ID = process.env.KMS_SYMMETRIC_KEY_ID || process.argv[2];
const KEY_FORMAT = process.argv[3] || 'Raw';

async function getKey() {
  if (!KEY_ID) {
    console.error('❌ Error: KEY_ID is required');
    console.log('Usage: node scripts/get.js [KEY_ID] [KEY_FORMAT]');
    console.log('   or: KMS_SYMMETRIC_KEY_ID=xxx node scripts/get.js [KEY_FORMAT]');
    console.log('\nSupported Key Formats: Raw, PKCS8, X509, PKCS12');
    console.log('\nExample:');
    console.log('   node scripts/get.js my-key-id');
    console.log('   node scripts/get.js my-key-id Raw');
    process.exit(1);
  }

  console.log('🔑 Testing Get operation with Cosmian KMS');
  console.log(`KMS URL: ${KMS_URL}`);
  console.log(`Key ID: ${KEY_ID}`);
  console.log(`Key Format: ${KEY_FORMAT}\n`);

  try {
    const getRequest = {
      tag: 'Get',
      value: [
        {
          tag: 'UniqueIdentifier',
          type: 'TextString',
          value: KEY_ID
        },
        {
          tag: 'KeyFormatType',
          type: 'Enumeration',
          value: KEY_FORMAT
        }
      ]
    };

    console.log('📤 Sending Get request...');
    console.log(JSON.stringify(getRequest, null, 2));
    console.log();

    const response = await axios.post(`${KMS_URL}/kmip/2_1`, getRequest);

    console.log('📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Extract key information
    if (response.data && response.data.value) {
      const objectType = response.data.value.find(item => item.tag === 'ObjectType');
      const uniqueId = response.data.value.find(item => item.tag === 'UniqueIdentifier');
      const objectData = response.data.value.find(item => item.tag === 'SymmetricKey' || item.tag === 'PrivateKey' || item.tag === 'PublicKey' || item.tag === 'Certificate');

      console.log('\n✅ Get operation successful!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (objectType) {
        console.log(`\n📦 Object Type: ${objectType.value}`);
      }

      if (uniqueId) {
        console.log(`🔑 Unique Identifier: ${uniqueId.value}`);
      }

      if (objectData) {
        console.log(`\n🔐 Object Data:`);
        console.log(`   Tag: ${objectData.tag}`);

        // Extract KeyBlock information
        const keyBlock = objectData.value?.find(item => item.tag === 'KeyBlock');
        if (keyBlock) {
          const keyFormatType = keyBlock.value?.find(item => item.tag === 'KeyFormatType');
          const keyValue = keyBlock.value?.find(item => item.tag === 'KeyValue');
          const cryptoAlgo = keyBlock.value?.find(item => item.tag === 'CryptographicAlgorithm');
          const cryptoLength = keyBlock.value?.find(item => item.tag === 'CryptographicLength');

          if (keyFormatType) {
            console.log(`   Format: ${keyFormatType.value}`);
          }
          if (cryptoAlgo) {
            console.log(`   Algorithm: ${cryptoAlgo.value}`);
          }
          if (cryptoLength) {
            console.log(`   Length: ${cryptoLength.value} bits`);
          }

          // Extract actual key material
          if (keyValue) {
            const keyMaterial = keyValue.value?.find(item => item.tag === 'KeyMaterial');
            if (keyMaterial) {
              const keyHex = keyMaterial.value;
              const keyBuffer = Buffer.from(keyHex, 'hex');
              const keyBase64 = keyBuffer.toString('base64');

              console.log(`\n🔑 Key Material:`);
              console.log(`   Hex: ${keyHex}`);
              console.log(`   Base64: ${keyBase64}`);
              console.log(`   Bytes: ${keyBuffer.length} bytes`);
            }
          }
        }

        // Extract attributes
        const attributes = keyBlock?.value?.find(item => item.tag === 'Attributes');
        if (attributes && attributes.value) {
          console.log(`\n📋 Attributes:`);
          attributes.value.forEach(attr => {
            if (attr.tag && attr.value !== undefined) {
              console.log(`   ${attr.tag}: ${JSON.stringify(attr.value)}`);
            }
          });
        }
      }

      console.log('\n⚠️  Warning: Keep key material secure and never expose in production!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Return key data for potential chaining
      return {
        objectType: objectType?.value,
        uniqueId: uniqueId?.value,
        object: objectData
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

getKey();

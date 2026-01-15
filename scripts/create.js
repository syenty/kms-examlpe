const axios = require('axios');

const KMS_URL = process.env.KMS_URL || 'http://localhost:9998';
const KEY_TAG = process.argv[2] || null;
const KEY_LENGTH = parseInt(process.argv[3] || process.argv[2]) || 256;

async function createSymmetricKey() {
  if (![128, 192, 256].includes(KEY_LENGTH)) {
    console.error('❌ Error: KEY_LENGTH must be 128, 192, or 256');
    console.log('Usage: node scripts/create.js [KEY_TAG] [KEY_LENGTH]');
    console.log('   or: node scripts/create.js [KEY_LENGTH]');
    console.log('\nExample:');
    console.log('   node scripts/create.js my-symmetric-key 256');
    console.log('   node scripts/create.js 256');
    console.log('   node scripts/create.js');
    console.log('\nDefault key length: 256 bits');
    process.exit(1);
  }

  console.log('🔑 Creating Symmetric Key with Cosmian KMS');
  console.log(`KMS URL: ${KMS_URL}`);
  if (KEY_TAG) {
    console.log(`Key Tag: ${KEY_TAG}`);
  }
  console.log(`Key Length: ${KEY_LENGTH} bits\n`);

  try {
    // Get current ISO 8601 timestamp for activation
    const currentTime = new Date().toISOString();

    // Build attributes array
    const attributes = [
      {
        tag: 'ActivationDate',
        type: 'DateTime',
        value: currentTime,
      },
      {
        tag: 'CryptographicAlgorithm',
        type: 'Enumeration',
        value: 'AES',
      },
      {
        tag: 'CryptographicLength',
        type: 'Integer',
        value: KEY_LENGTH,
      },
      {
        tag: 'CryptographicUsageMask',
        type: 'Integer',
        value: 2108, // Encrypt | Decrypt
      },
      {
        tag: 'KeyFormatType',
        type: 'Enumeration',
        value: 'TransparentSymmetricKey',
      },
      {
        tag: 'ObjectType',
        type: 'Enumeration',
        value: 'SymmetricKey',
      },
    ];

    // Add tag if provided
    if (KEY_TAG) {
      attributes.push({
        tag: 'Attribute',
        value: [
          {
            tag: 'VendorIdentification',
            type: 'TextString',
            value: 'cosmian',
          },
          {
            tag: 'AttributeName',
            type: 'TextString',
            value: 'tag',
          },
          {
            tag: 'AttributeValue',
            type: 'TextString',
            value: JSON.stringify([KEY_TAG]),
          },
        ],
      });
    }

    const createRequest = {
      tag: 'Create',
      value: [
        {
          tag: 'ObjectType',
          type: 'Enumeration',
          value: 'SymmetricKey',
        },
        {
          tag: 'Attributes',
          value: attributes,
        },
      ],
    };

    console.log('📤 Sending Create request...');
    console.log(JSON.stringify(createRequest, null, 2));
    console.log();

    const response = await axios.post(`${KMS_URL}/kmip/2_1`, createRequest);

    console.log('📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Extract creation results
    if (response.data && response.data.value) {
      const objectType = response.data.value.find(item => item.tag === 'ObjectType');
      const uniqueId = response.data.value.find(item => item.tag === 'UniqueIdentifier');

      console.log('\n✅ Symmetric Key created successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (objectType) {
        console.log(`\n📦 Object Type: ${objectType.value}`);
      }

      if (uniqueId) {
        console.log(`🔑 Key ID: ${uniqueId.value}`);
        if (KEY_TAG) {
          console.log(`🏷️  Tag: ${KEY_TAG}`);
        }
        console.log(`📏 Length: ${KEY_LENGTH} bits`);
        console.log(`🔐 Algorithm: AES-${KEY_LENGTH}-GCM`);
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Return key data for potential chaining
      return {
        keyId: uniqueId?.value,
        tag: KEY_TAG,
        length: KEY_LENGTH,
        algorithm: `AES-${KEY_LENGTH}`,
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

createSymmetricKey();

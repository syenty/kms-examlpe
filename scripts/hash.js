const axios = require('axios');

const KMS_URL = process.env.KMS_URL || 'http://localhost:9998';
const ALGORITHM = process.argv[2] || 'SHA256';
const DATA = process.argv[3] || 'Hello, World!';

async function hashTest() {
  if (!DATA) {
    console.error('❌ Error: DATA is required');
    console.log('Usage: node scripts/hash.js [ALGORITHM] [DATA]');
    console.log('   or: node scripts/hash.js [DATA]  (defaults to SHA256)');
    console.log('\nSupported Algorithms: SHA256, SHA384, SHA512');
    console.log('\nExample:');
    console.log('   node scripts/hash.js SHA256 "Hello, World!"');
    console.log('   node scripts/hash.js "test@example.com"');
    process.exit(1);
  }

  console.log('🔐 Testing Hash operation with Cosmian KMS');
  console.log(`KMS URL: ${KMS_URL}`);
  console.log(`Algorithm: ${ALGORITHM}`);
  console.log(`Data: ${DATA}\n`);

  try {
    // Convert data to hexadecimal (KMIP ByteString format)
    const dataHex = Buffer.from(DATA, 'utf8').toString('hex');

    console.log('📝 Input Data:');
    console.log(`   Original: ${DATA}`);
    console.log(`   Hex: ${dataHex}`);
    console.log(`   Bytes: ${Buffer.from(DATA, 'utf8').length} bytes\n`);

    const hashRequest = {
      tag: 'Hash',
      value: [
        {
          tag: 'CryptographicParameters',
          value: [
            {
              tag: 'HashingAlgorithm',
              type: 'Enumeration',
              value: ALGORITHM
            }
          ]
        },
        {
          tag: 'Data',
          type: 'ByteString',
          value: dataHex
        }
      ]
    };

    console.log('📤 Sending Hash request...');
    console.log(JSON.stringify(hashRequest, null, 2));
    console.log();

    const response = await axios.post(`${KMS_URL}/kmip/2_1`, hashRequest);

    console.log('📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Extract hash result
    if (response.data && response.data.value) {
      const hashData = response.data.value.find(item => item.tag === 'Data');

      console.log('\n✅ Hash successful!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (hashData) {
        const hashHex = hashData.value;
        const hashBuffer = Buffer.from(hashHex, 'hex');
        const hashBase64 = hashBuffer.toString('base64');

        console.log(`\n🔐 Hash Result (${ALGORITHM}):`);
        console.log(`   Hex: ${hashHex}`);
        console.log(`   Base64: ${hashBase64}`);
        console.log(`   Bytes: ${hashBuffer.length} bytes (${hashHex.length} hex chars)`);
      }

      console.log('\n💡 Tip: Use this hash for searching encrypted data');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Return hash data for potential chaining
      return {
        algorithm: ALGORITHM,
        hash: hashData?.value,
        hashBase64: hashData ? Buffer.from(hashData.value, 'hex').toString('base64') : null
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

hashTest();

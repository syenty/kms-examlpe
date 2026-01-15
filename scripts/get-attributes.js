const axios = require('axios');

const KMS_URL = process.env.KMS_URL || 'http://localhost:9998';
const KEY_ID = process.env.KMS_SYMMETRIC_KEY_ID || process.argv[2];

async function getKeyDetails() {
  if (!KEY_ID) {
    console.error('❌ Error: KEY_ID is required');
    console.log('Usage: node scripts/get-key-details.js [KEY_ID]');
    console.log('   or: KMS_SYMMETRIC_KEY_ID=xxx node scripts/get-key-details.js');
    process.exit(1);
  }

  console.log('🔍 Getting key details from Cosmian KMS');
  console.log(`KMS URL: ${KMS_URL}`);
  console.log(`Key ID: ${KEY_ID}\n`);

  try {
    const getRequest = {
      tag: 'GetAttributes',
      value: [
        {
          tag: 'UniqueIdentifier',
          type: 'TextString',
          value: KEY_ID
        }
      ]
    };

    console.log('📤 Sending GetAttributes request...');
    console.log(JSON.stringify(getRequest, null, 2));
    console.log();

    const response = await axios.post(`${KMS_URL}/kmip/2_1`, getRequest);

    console.log('📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getKeyDetails();

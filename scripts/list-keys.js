const axios = require('axios');

const KMS_URL = process.env.KMS_URL || 'http://localhost:9998';

async function listKeys() {
  console.log('🔍 Listing all keys from Cosmian KMS');
  console.log(`KMS URL: ${KMS_URL}\n`);

  try {
    const locateRequest = {
      tag: 'Locate',
      value: [
        {
          tag: 'Attributes',
          value: []
        }
      ]
    };

    console.log('📤 Sending Locate request...');
    console.log(JSON.stringify(locateRequest, null, 2));
    console.log();

    const response = await axios.post(`${KMS_URL}/kmip/2_1`, locateRequest);

    console.log('📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));

    // Extract key IDs from response
    if (response.data && response.data.value) {
      const uniqueIdentifiers = response.data.value.filter(item => item.tag === 'UniqueIdentifier');

      if (uniqueIdentifiers.length > 0) {
        console.log(`\n✅ Found ${uniqueIdentifiers.length} keys:`);
        uniqueIdentifiers.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.value}`);
        });
      } else {
        console.log('\n⚠️  No keys found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

listKeys();

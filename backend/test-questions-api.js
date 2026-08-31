const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            rawBody: body
          });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function testCRUD() {
  console.log('--- Testing Admin Question CRUD APIs ---');
  try {
    // 0. Login
    console.log('Logging in to get authentication token...');
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, { username: 'admin', password: 'admin123' });

    console.log('Login API response status:', loginRes.statusCode);
    const token = loginRes.data.token;
    if (!token) {
      throw new Error('Failed to retrieve authentication token from login API');
    }
    console.log('Successfully retrieved token.');

    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 1. Get Questions
    const getRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/questions',
      method: 'GET',
      headers: authHeaders
    });
    console.log('GET questions API response status:', getRes.statusCode);
    const initialCount = getRes.data.questions.length;
    console.log(`Initial count: ${initialCount} questions`);

    // 2. Add Question
    const newQ = {
      subtest: 'produk',
      question_type: 'multiple-choice',
      question_text: 'TEST QUESTION: Siapakah operator telekomunikasi terbesar di Indonesia?',
      option_a: 'Telkomsel',
      option_b: 'Indosat',
      option_c: 'XL',
      option_d: 'Smartfren',
      correct_option: 'A'
    };

    const addRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/questions',
      method: 'POST',
      headers: authHeaders
    }, newQ);

    console.log('POST add question API response status:', addRes.statusCode);
    const addedId = addRes.data.questionId;
    console.log(`Added question ID: ${addedId}`);

    // 3. Update Question
    const updatedQ = {
      subtest: 'produk',
      question_type: 'multiple-choice',
      question_text: 'TEST QUESTION (UPDATED): Siapakah operator telekomunikasi terbesar di Indonesia?',
      option_a: 'Telkomsel Merah',
      option_b: 'Indosat Ooredoo',
      option_c: 'XL Axiata',
      option_d: 'Smartfren Telecom',
      correct_option: 'A'
    };

    const updateRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/questions/${addedId}`,
      method: 'PUT',
      headers: authHeaders
    }, updatedQ);

    console.log('PUT update question API response status:', updateRes.statusCode);

    // 4. Get Questions again to verify count and update
    const getRes2 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/questions',
      method: 'GET',
      headers: authHeaders
    });
    const finalCount = getRes2.data.questions.length;
    console.log(`New count: ${finalCount} questions`);
    const checkQ = getRes2.data.questions.find(q => q.id === addedId);
    console.log('Updated question option_a value:', checkQ.option_a);

    // 5. Delete Question
    const deleteRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/admin/questions/${addedId}`,
      method: 'DELETE',
      headers: authHeaders
    });
    console.log('DELETE question API response status:', deleteRes.statusCode);

    // 6. Final verification count
    const getRes3 = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/questions',
      method: 'GET',
      headers: authHeaders
    });
    console.log(`Final count after delete: ${getRes3.data.questions.length} questions`);

    console.log('--- Question CRUD Test Complete: Successful ---');
  } catch (error) {
    console.error('CRUD testing failed:', error);
  }
}

testCRUD();

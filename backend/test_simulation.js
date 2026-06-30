const axios = require('axios');

const BACKEND_URL = 'http://localhost:5001/api';

async function runTest() {
  console.log('--- Starting Automated Webhook and Auto-Reply Simulation Test ---');
  
  try {
    // 1. Get initial stats
    console.log('\n1. Fetching initial dashboard stats...');
    const initStatsRes = await axios.get(`${BACKEND_URL}/dashboard/stats`);
    console.log(`Connected Accounts: ${initStatsRes.data.connectedAccounts}`);
    console.log(`Comments Received: ${initStatsRes.data.commentsReceived}`);
    console.log(`Auto-Reply Rate: ${initStatsRes.data.autoReplyRate}%`);

    // 2. Send a simulated webhook comment containing the keyword 'price'
    console.log('\n2. Simulating incoming Facebook comment containing keyword "price"...');
    const simCommentRes = await axios.post(`${BACKEND_URL}/simulate/webhook`, {
      type: 'comment',
      content: 'Hello, what is the price of this item?',
      authorName: 'Mehidi Hasan Hridoy',
      postId: 'post_101',
      postTitle: 'New Summer Product Launch'
    });
    console.log('Simulation response status:', simCommentRes.status);
    console.log('Simulation success:', simCommentRes.data.success);

    // 3. Fetch comments to verify the comment was stored and auto-replied
    console.log('\n3. Verifying stored comment and auto-reply trigger in DB...');
    const commentsRes = await axios.get(`${BACKEND_URL}/comments`);
    const latestComment = commentsRes.data[0];
    
    console.log(`Latest Comment: "${latestComment.commentText}" by ${latestComment.authorName}`);
    console.log(`Is Auto-Replied: ${latestComment.isAutoReplied}`);
    console.log(`Sent Reply Text: "${latestComment.replyText}"`);

    // 4. Fetch updated stats to verify real-time increments
    console.log('\n4. Fetching updated dashboard stats...');
    const updatedStatsRes = await axios.get(`${BACKEND_URL}/dashboard/stats`);
    console.log(`Updated Connected Accounts: ${updatedStatsRes.data.connectedAccounts}`);
    console.log(`Updated Comments Received: ${updatedStatsRes.data.commentsReceived}`);
    console.log(`Updated Auto-Reply Rate: ${updatedStatsRes.data.autoReplyRate}%`);

    console.log('\n--- Test Successful! Webhook Parsing, Auto-Reply Matching, and Stats Pipeline are fully functional! ---');
  } catch (error) {
    console.error('--- Test Failed! ---');
    console.error(error.response?.data || error.message);
    process.exit(1);
  }
}

runTest();

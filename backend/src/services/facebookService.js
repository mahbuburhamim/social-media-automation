const axios = require('axios');

/**
 * Send a reply to a comment on a Facebook Post
 * @param {string} commentId - The ID of the comment to reply to
 * @param {string} message - The text of the reply
 * @returns {Promise<object>}
 */
async function sendCommentReply(commentId, message) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  
  if (!token || token === 'SIMULATION') {
    console.log(`[SIMULATION] Sending comment reply to comment [${commentId}]: "${message}"`);
    return { id: `sim_reply_${Date.now()}` };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${commentId}/comments`;
    const response = await axios.post(url, {
      message: message
    }, {
      params: { access_token: token }
    });
    return response.data;
  } catch (error) {
    console.error('Error sending Facebook comment reply:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send a Facebook Messenger message
 * @param {string} recipientId - The PSID (Page-Scoped ID) of the recipient
 * @param {string} text - The message text
 * @returns {Promise<object>}
 */
async function sendMessengerMessage(recipientId, text) {
  const token = process.env.PAGE_ACCESS_TOKEN;

  if (!token || token === 'SIMULATION') {
    console.log(`[SIMULATION] Sending Messenger message to user [${recipientId}]: "${text}"`);
    return { message_id: `sim_msg_${Date.now()}` };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/me/messages`;
    const response = await axios.post(url, {
      recipient: { id: recipientId },
      message: { text: text }
    }, {
      params: { access_token: token }
    });
    return response.data;
  } catch (error) {
    console.error('Error sending Messenger message:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendCommentReply,
  sendMessengerMessage
};

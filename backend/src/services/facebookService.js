const axios = require('axios');

/**
 * Send a reply to a comment on a Facebook Post
 * @param {string} commentId - The ID of the comment to reply to
 * @param {string} message - The text of the reply
 * @param {string} [attachmentUrl] - Optional image attachment URL
 * @returns {Promise<object>}
 */
async function sendCommentReply(commentId, message, attachmentUrl) {
  const token = process.env.PAGE_ACCESS_TOKEN;
  
  if (!token || token === 'SIMULATION') {
    console.log(`[SIMULATION] Sending comment reply to comment [${commentId}]: "${message}" | attachment="${attachmentUrl}"`);
    return { id: `sim_reply_${Date.now()}` };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${commentId}/comments`;
    const payload = { message: message };
    if (attachmentUrl && attachmentUrl.trim()) {
      payload.attachment_url = attachmentUrl;
    }
    const response = await axios.post(url, payload, {
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
 * @param {string} [attachmentUrl] - Optional image attachment URL
 * @returns {Promise<object>}
 */
async function sendMessengerMessage(recipientId, text, attachmentUrl) {
  const token = process.env.PAGE_ACCESS_TOKEN;

  if (!token || token === 'SIMULATION') {
    console.log(`[SIMULATION] Sending Messenger message to user [${recipientId}]: text="${text}", img="${attachmentUrl}"`);
    return { message_id: `sim_msg_${Date.now()}` };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/me/messages`;
    
    // 1. If attachment is present, send it first as an image message
    if (attachmentUrl && attachmentUrl.trim()) {
      await axios.post(url, {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'image',
            payload: {
              url: attachmentUrl,
              is_reusable: true
            }
          }
        }
      }, {
        params: { access_token: token }
      });
    }

    // 2. If text is present, send it
    if (text && text.trim()) {
      const response = await axios.post(url, {
        recipient: { id: recipientId },
        message: { text: text }
      }, {
        params: { access_token: token }
      });
      return response.data;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error sending Messenger message:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendCommentReply,
  sendMessengerMessage
};

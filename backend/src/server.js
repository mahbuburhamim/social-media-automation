const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { sendCommentReply, sendMessengerMessage } = require('./services/facebookService');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Server-Sent Events (SSE) clients for real-time dashboard updates
let clients = [];

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // CORS header for SSE is important
  res.setHeader('Access-Control-Allow-Origin', '*');

  clients.push(res);
  console.log(`[SSE] Client connected. Total: ${clients.length}`);

  // Send initial keep-alive message
  res.write(': keep-alive\n\n');

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
    console.log(`[SSE] Client disconnected. Total: ${clients.length}`);
  });
});

function broadcastEvent(type, data) {
  console.log(`[SSE] Broadcasting event: ${type}`);
  clients.forEach(client => {
    client.write(`event: ${type}\n`);
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

/**
 * Match incoming comment or message against active auto-reply rules
 */
async function matchAndReply(content, type, targetId, authorName) {
  const rules = await prisma.autoReplyRule.findMany({ where: { isActive: true } });
  let matchedRule = null;

  for (const rule of rules) {
    const keyword = rule.keyword.toLowerCase();
    const text = content.toLowerCase();
    
    // Check if rule matches
    if (rule.replyType === type || rule.replyType === 'both') {
      if (rule.matchType === 'exact' && text === keyword) {
        matchedRule = rule;
        break;
      } else if (rule.matchType === 'contains' && text.includes(keyword)) {
        matchedRule = rule;
        break;
      }
    }
  }

  if (matchedRule) {
    let replyText = matchedRule.replyContent;
    const attachmentUrl = matchedRule.attachmentUrl;
    if (authorName) {
      replyText = replyText.replace(/{name}/g, authorName);
    }

    try {
      if (type === 'comment') {
        await sendCommentReply(targetId, replyText, attachmentUrl);
      } else if (type === 'message') {
        await sendMessengerMessage(targetId, replyText, attachmentUrl);
      }
      return replyText;
    } catch (err) {
      console.error(`Auto-reply failed to send to ${type}:`, err.message);
    }
  }
  return null;
}

// -------------------------------------------------------------
// FACEBOOK WEBHOOK ENDPOINTS (REAL INTEGRATION)
// -------------------------------------------------------------

// Webhook Verification (for setup with Meta App Settings)
app.get('/api/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'social_secret_token_123';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  return res.sendStatus(400);
});

// Webhook Event Receiver
app.post('/api/webhook', async (req, res) => {
  const body = req.body;
  console.log('Received Facebook Webhook event:', JSON.stringify(body, null, 2));

  try {
    // Log the webhook payload
    await prisma.webhookLog.create({
      data: { payload: JSON.stringify(body) }
    });
    broadcastEvent('webhook-received', { timestamp: new Date() });

    // Handle Page Feed (Comments)
    if (body.object === 'page') {
      for (const entry of body.entry) {
        // Handle comments
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
              const val = change.value;
              const commentId = val.comment_id;
              const commentText = val.message;
              const authorName = val.sender_name || 'Anonymous';
              const authorId = val.sender_id;
              const postId = val.post_id;
              const postTitle = val.post?.name || 'Facebook Post';

              // Ignore replies sent by our own page to prevent loops
              // Note: If you know the page ID, filter it here.

              // Process comment
              const replyText = await matchAndReply(commentText, 'comment', commentId, authorName);
              const isAutoReplied = !!replyText;

              const commentObj = await prisma.comment.upsert({
                where: { id: commentId },
                update: {
                  commentText,
                  replyText: replyText || undefined,
                  isAutoReplied: isAutoReplied || undefined
                },
                create: {
                  id: commentId,
                  commentText,
                  authorName,
                  authorId,
                  postId,
                  postTitle,
                  replyText,
                  isAutoReplied
                }
              });

              broadcastEvent('new-comment', commentObj);
              broadcastEvent('stats-update', await getAggregatedStats());
            }
          }
        }

        // Handle Messenger Messages
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            if (messagingEvent.message && !messagingEvent.message.is_echo) {
              const senderId = messagingEvent.sender.id;
              const messageText = messagingEvent.message.text;
              const messageId = messagingEvent.message.mid;

              // We'd query user profile if needed, otherwise default name
              const senderName = `User [${senderId.substring(0, 4)}]`;

              const replyText = await matchAndReply(messageText, 'message', senderId, senderName);
              const isAutoReplied = !!replyText;

              const messageObj = await prisma.message.create({
                data: {
                  id: messageId,
                  senderId,
                  senderName,
                  messageText,
                  replyText,
                  isAutoReplied
                }
              });

              broadcastEvent('new-message', messageObj);
              broadcastEvent('stats-update', await getAggregatedStats());
            }
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.sendStatus(404);
  } catch (error) {
    console.error('Error handling Facebook Webhook event:', error);
    return res.status(500).send('ERROR_PROCESSING');
  }
});

// -------------------------------------------------------------
// SIMULATION ENDPOINTS
// -------------------------------------------------------------

// Endpoint to simulate webhook payload for Comments/Messenger
app.post('/api/simulate/webhook', async (req, res) => {
  const { type, content, authorName, postId, postTitle } = req.body;

  try {
    const payloadMock = {
      object: 'page',
      entry: []
    };

    if (type === 'comment') {
      const commentId = `sim_comment_${Math.floor(Math.random() * 1000000)}`;
      const mockPostId = postId || 'sim_post_289';
      const mockPostTitle = postTitle || 'In sha allha';

      payloadMock.entry.push({
        id: 'sim_page_123',
        time: Date.now(),
        changes: [{
          field: 'feed',
          value: {
            item: 'comment',
            verb: 'add',
            comment_id: commentId,
            message: content,
            sender_name: authorName || 'Mahbubur Hamim',
            sender_id: `sim_user_${Math.floor(Math.random() * 1000000)}`,
            post_id: mockPostId,
            post: {
              name: mockPostTitle
            }
          }
        }]
      });
    } else if (type === 'message') {
      const messageId = `sim_mid_${Math.floor(Math.random() * 1000000)}`;
      payloadMock.entry.push({
        id: 'sim_page_123',
        time: Date.now(),
        messaging: [{
          sender: { id: `sim_sender_${Math.floor(Math.random() * 1000000)}` },
          recipient: { id: 'sim_page_123' },
          timestamp: Date.now(),
          message: {
            mid: messageId,
            text: content
          }
        }]
      });
    }

    // Call the webhook receiver internally to simulate exact flow
    // We send payload to our own endpoint
    // To keep database calls clean, we just execute the webhook logic inside this function directly:
    await prisma.webhookLog.create({
      data: { payload: JSON.stringify(payloadMock) }
    });
    broadcastEvent('webhook-received', { timestamp: new Date() });

    if (type === 'comment') {
      const val = payloadMock.entry[0].changes[0].value;
      const replyText = await matchAndReply(val.message, 'comment', val.comment_id, val.sender_name);
      const isAutoReplied = !!replyText;

      const commentObj = await prisma.comment.create({
        data: {
          id: val.comment_id,
          commentText: val.message,
          authorName: val.sender_name,
          authorId: val.sender_id,
          postId: val.post_id,
          postTitle: val.post.name,
          replyText,
          isAutoReplied
        }
      });

      broadcastEvent('new-comment', commentObj);
    } else if (type === 'message') {
      const msg = payloadMock.entry[0].messaging[0];
      const senderName = authorName || `User [${msg.sender.id.substring(11, 15)}]`;
      const replyText = await matchAndReply(msg.message.text, 'message', msg.sender.id, senderName);
      const isAutoReplied = !!replyText;

      const messageObj = await prisma.message.create({
        data: {
          id: msg.message.mid,
          senderId: msg.sender.id,
          senderName,
          messageText: msg.message.text,
          replyText,
          isAutoReplied
        }
      });

      broadcastEvent('new-message', messageObj);
    }

    broadcastEvent('stats-update', await getAggregatedStats());
    return res.status(200).json({ success: true, message: 'Simulated webhook processed successfully' });
  } catch (error) {
    console.error('Simulation error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// DASHBOARD & RULES REST APIS
// -------------------------------------------------------------

// Helper to get stats
async function getAggregatedStats() {
  const accountsCount = await prisma.account.count();
  const comments = await prisma.comment.findMany();
  const messages = await prisma.message.findMany();
  const webhookLogsCount = await prisma.webhookLog.count();
  const activeRulesCount = await prisma.autoReplyRule.count({ where: { isActive: true } });

  const totalComments = comments.length;
  const totalMessages = messages.length;
  
  // Calculate auto-replies
  const commentAutoReplies = comments.filter(c => c.isAutoReplied).length;
  const messageAutoReplies = messages.filter(m => m.isAutoReplied).length;
  const totalAutoReplies = commentAutoReplies + messageAutoReplies;
  const totalInteractions = totalComments + totalMessages;

  const autoReplyRate = totalInteractions > 0 
    ? parseFloat(((totalAutoReplies / totalInteractions) * 100).toFixed(1)) 
    : 0;

  // Distinct posts count
  const postIds = [...new Set(comments.map(c => c.postId))];
  
  // Sum comment likes
  const totalLikes = comments.reduce((sum, c) => sum + c.likes, 0);

  return {
    connectedAccounts: accountsCount,
    totalPosts: postIds.length || 289, // fallback to match mockup
    commentsReceived: totalComments,
    commentsAutoReplied: commentAutoReplies,
    messagesReceived: totalMessages,
    messagesAutoReplied: messageAutoReplies,
    autoReplyRate: autoReplyRate,
    totalLikes: totalLikes,
    pendingWebhooks: webhookLogsCount,
    activeRules: activeRulesCount,
    platforms: [
      { name: 'Facebook', accounts: accountsCount, posts: postIds.length || 289, comments: totalComments, autoReplies: commentAutoReplies, status: accountsCount > 0 ? 'Active' : 'Inactive' },
      { name: 'Instagram', accounts: 0, posts: 0, comments: 0, autoReplies: 0, status: 'Inactive' },
      { name: 'LinkedIn', accounts: 0, posts: 0, comments: 0, autoReplies: 0, status: 'Inactive' },
      { name: 'Twitter', accounts: 0, posts: 0, comments: 0, autoReplies: 0, status: 'Inactive' },
      { name: 'Youtube', accounts: 0, posts: 0, comments: 0, autoReplies: 0, status: 'Inactive' }
    ]
  };
}

// Stats Route
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await getAggregatedStats();
    return res.status(200).json(stats);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Accounts Route
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await prisma.account.findMany();
    return res.status(200).json(accounts);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  const { platform, name, profilePicture } = req.body;
  try {
    const acc = await prisma.account.create({
      data: { platform, name, profilePicture, status: 'active' }
    });
    broadcastEvent('stats-update', await getAggregatedStats());
    return res.status(201).json(acc);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Comments List API
app.get('/api/comments', async (req, res) => {
  const { search, platform, hasReply, pageType } = req.query;
  
  try {
    const filter = {};
    if (platform && platform !== 'All') {
      filter.platform = platform.toLowerCase();
    }
    
    if (hasReply === 'yes') {
      filter.isAutoReplied = true;
    } else if (hasReply === 'no') {
      filter.isAutoReplied = false;
    }

    if (search) {
      filter.OR = [
        { commentText: { contains: search } },
        { authorName: { contains: search } }
      ];
    }

    const comments = await prisma.comment.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(comments);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Messenger Messages List API
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(messages);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Manual reply endpoint
app.post('/api/comments/:id/reply', async (req, res) => {
  const { id } = req.params;
  const { replyText } = req.body;

  try {
    await sendCommentReply(id, replyText);
    const comment = await prisma.comment.update({
      where: { id },
      data: { replyText, isAutoReplied: true }
    });

    broadcastEvent('stats-update', await getAggregatedStats());
    broadcastEvent('new-comment', comment);

    return res.status(200).json(comment);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Auto-Reply Rules API
app.get('/api/rules', async (req, res) => {
  try {
    const rules = await prisma.autoReplyRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(rules);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/rules', async (req, res) => {
  const { keyword, replyType, replyContent, matchType, attachmentUrl } = req.body;
  try {
    const rule = await prisma.autoReplyRule.create({
      data: { keyword, replyType, replyContent, matchType, attachmentUrl }
    });
    broadcastEvent('stats-update', await getAggregatedStats());
    return res.status(201).json(rule);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/rules/:id', async (req, res) => {
  const { id } = req.params;
  const { keyword, replyType, replyContent, matchType, isActive, attachmentUrl } = req.body;
  try {
    const rule = await prisma.autoReplyRule.update({
      where: { id: parseInt(id) },
      data: { keyword, replyType, replyContent, matchType, isActive, attachmentUrl }
    });
    broadcastEvent('stats-update', await getAggregatedStats());
    return res.status(200).json(rule);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rules/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.autoReplyRule.delete({
      where: { id: parseInt(id) }
    });
    broadcastEvent('stats-update', await getAggregatedStats());
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// SEED INITIAL DATA (Helper to populate demo account)
// -------------------------------------------------------------
async function seedInitialData() {
  const accCount = await prisma.account.count();
  if (accCount === 0) {
    // Add demo facebook page
    await prisma.account.create({
      data: {
        platform: 'facebook',
        name: 'My Demo Business Page',
        profilePicture: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
        status: 'active'
      }
    });

    // Add some default auto-reply rules
    await prisma.autoReplyRule.createMany({
      data: [
        { keyword: 'price', replyType: 'comment', replyContent: 'Hey {name}! The price is $25. Check your inbox for order link 📨', matchType: 'contains' },
        { keyword: 'price', replyType: 'message', replyContent: 'The price is $25. Would you like to order now?', matchType: 'contains' },
        { keyword: 'assalamu alaikum', replyType: 'both', replyContent: 'Walaikum Assalam {name}! How can we help you today?', matchType: 'contains' },
        { keyword: 'delivery', replyType: 'comment', replyContent: 'We deliver nationwide in 2-3 days! 🚚', matchType: 'contains' }
      ]
    });

    console.log('Seeded initial demo account and auto-reply rules.');
  }
}

// Start Server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await seedInitialData();
  } catch (err) {
    console.error('Failed to run initial seed data:', err.message);
  }
});

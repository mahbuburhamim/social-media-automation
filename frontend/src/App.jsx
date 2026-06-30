import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Users, 
  Layers, 
  Settings, 
  Activity, 
  CheckCircle, 
  ThumbsUp, 
  Clock, 
  Plus, 
  Trash2, 
  Play, 
  Send, 
  Radio, 
  Search, 
  Share2, 
  X, 
  AlertCircle
} from 'lucide-react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001/api';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'comments', 'messages', 'rules'
  const [commentsTab, setCommentsTab] = useState('comments'); // 'comments', 'messages'
  const [stats, setStats] = useState({
    connectedAccounts: 1,
    totalPosts: 289,
    commentsReceived: 0,
    commentsAutoReplied: 0,
    autoReplyRate: 0,
    totalLikes: 0,
    pendingWebhooks: 0,
    activeRules: 0,
    platforms: []
  });

  const [comments, setComments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [rules, setRules] = useState([]);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [filterReplied, setFilterReplied] = useState('all');

  // Modals & Floating panels
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isSimOpen, setIsSimOpen] = useState(false);
  const [manualReplyTexts, setManualReplyTexts] = useState({});

  // Rule Form state
  const [newRule, setNewRule] = useState({
    keyword: '',
    replyType: 'comment',
    replyContent: '',
    matchType: 'contains'
  });

  // Simulator state
  const [simType, setSimType] = useState('comment');
  const [simData, setSimData] = useState({
    content: 'Price please?',
    authorName: 'Mehidi Hasan Hridoy',
    postId: 'sim_post_289',
    postTitle: 'In sha allha'
  });

  const webhookFeedEndRef = useRef(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      const date = new Date();
      setTime(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchStats();
    fetchComments();
    fetchMessages();
    fetchRules();
  }, []);

  // Real-time updates via Server-Sent Events (SSE)
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };

    eventSource.addEventListener('stats-update', (event) => {
      const data = JSON.parse(event.data);
      setStats(data);
    });

    eventSource.addEventListener('new-comment', (event) => {
      const newComment = JSON.parse(event.data);
      setComments(prev => {
        // Prepend or update
        const exists = prev.some(c => c.id === newComment.id);
        if (exists) {
          return prev.map(c => c.id === newComment.id ? newComment : c);
        }
        return [newComment, ...prev];
      });
      // Flash statistics
      fetchStats();
    });

    eventSource.addEventListener('new-message', (event) => {
      const newMessage = JSON.parse(event.data);
      setMessages(prev => [newMessage, ...prev]);
      fetchStats();
    });

    eventSource.addEventListener('webhook-received', (event) => {
      const data = JSON.parse(event.data);
      const newLog = {
        id: Math.random().toString(),
        timestamp: new Date(data.timestamp).toLocaleTimeString(),
        payload: 'Webhook Received: ' + new Date(data.timestamp).toLocaleTimeString()
      };
      setWebhookLogs(prev => [...prev.slice(-30), newLog]); // Keep last 30 logs
    });

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Scroll webhook activity feed to bottom
  useEffect(() => {
    if (webhookFeedEndRef.current) {
      webhookFeedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [webhookLogs]);

  // API Call wrappers
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`${API_BASE}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (e) {
      console.error('Error fetching comments:', e);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/messages`);
      const data = await res.json();
      setMessages(data);
    } catch (e) {
      console.error('Error fetching messages:', e);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/rules`);
      const data = await res.json();
      setRules(data);
    } catch (e) {
      console.error('Error fetching rules:', e);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });
      if (res.ok) {
        setIsRuleModalOpen(false);
        setNewRule({ keyword: '', replyType: 'comment', replyContent: '', matchType: 'contains' });
        fetchRules();
      }
    } catch (e) {
      console.error('Error creating rule:', e);
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      await fetch(`${API_BASE}/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, isActive: !rule.isActive })
      });
      fetchRules();
    } catch (e) {
      console.error('Error toggling rule:', e);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await fetch(`${API_BASE}/rules/${id}`, { method: 'DELETE' });
      fetchRules();
    } catch (e) {
      console.error('Error deleting rule:', e);
    }
  };

  const handleSimulateEvent = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulate/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: simType,
          content: simData.content,
          authorName: simData.authorName,
          postId: simType === 'comment' ? simData.postId : undefined,
          postTitle: simType === 'comment' ? simData.postTitle : undefined
        })
      });
      if (res.ok) {
        setIsSimOpen(false);
        // Clear content for next sim
        setSimData(prev => ({ ...prev, content: simType === 'comment' ? 'How much?' : 'Is it available?' }));
        fetchComments();
        fetchMessages();
      }
    } catch (e) {
      console.error('Error simulating event:', e);
    }
  };

  const handleManualReply = async (commentId) => {
    const replyText = manualReplyTexts[commentId];
    if (!replyText || !replyText.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText })
      });
      if (res.ok) {
        setManualReplyTexts(prev => ({ ...prev, [commentId]: '' }));
        fetchComments();
      }
    } catch (e) {
      console.error('Error sending reply:', e);
    }
  };

  // Filtered Lists
  const filteredComments = comments.filter(c => {
    const matchesSearch = c.commentText.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.authorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = filterPlatform === 'All' || c.platform === filterPlatform.toLowerCase();
    const matchesReplied = filterReplied === 'all' || 
                          (filterReplied === 'replied' && c.isAutoReplied) || 
                          (filterReplied === 'pending' && !c.isAutoReplied);
    return matchesSearch && matchesPlatform && matchesReplied;
  });

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <Radio size={24} className="status-dot active" style={{ color: 'var(--primary)' }} />
          <span className="logo-text">SocialBot 🤖</span>
        </div>
        
        <ul className="nav-menu">
          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <Layers size={18} />
            <span>Dashboard</span>
          </li>
          <li className={`nav-item ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
            <MessageSquare size={18} />
            <span>Interactions</span>
          </li>
          <li className={`nav-item ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>
            <Settings size={18} />
            <span>Auto-Reply Rules</span>
          </li>
        </ul>

        <div style={{ marginTop: 'auto', padding: '16px 0', borderTop: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
            <span className="status-dot active"></span>
            <span style={{ color: 'var(--text-muted)' }}>Sandbox: Active</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="main-content">
        
        {/* Header */}
        <header className="header animate-fade-in">
          <div className="header-title">
            <h1>Social Media Automation</h1>
            <p>Meta Developer-powered comment & messenger automated panel</p>
          </div>
          
          <div className="header-actions">
            <div className="live-clock">
              <Clock size={14} style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />
              {time}
            </div>
            
            <button className="btn btn-secondary" onClick={() => setIsSimOpen(true)}>
              <Play size={14} />
              Simulate Webhook
            </button>
            
            <button className="btn btn-primary" onClick={() => setIsRuleModalOpen(true)}>
              <Plus size={14} />
              New Rule
            </button>
          </div>
        </header>

        {/* Dashboard Tab Content */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="glass-panel stat-card glow-primary">
                <div className="stat-card-header">
                  <span>Connected Accounts</span>
                  <Users size={16} />
                </div>
                <div className="stat-value">{stats.connectedAccounts}</div>
                <p>● 1 active</p>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-card-header">
                  <span>Total Posts Managed</span>
                  <Layers size={16} />
                </div>
                <div className="stat-value">{stats.totalPosts}</div>
                <p>● 289 published</p>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-card-header">
                  <span>Comments Received</span>
                  <MessageSquare size={16} />
                </div>
                <div className="stat-value">{stats.commentsReceived}</div>
                <p>● {stats.commentsAutoReplied} auto-replied</p>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-card-header">
                  <span>Auto-Reply Rate</span>
                  <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                </div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.autoReplyRate}%</div>
                <p>● Live metrics active</p>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-card-header">
                  <span>Total Likes Received</span>
                  <ThumbsUp size={16} />
                </div>
                <div className="stat-value">{stats.totalLikes}</div>
                <p>● +53 this week</p>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-card-header">
                  <span>Pending Webhooks</span>
                  <Activity size={16} style={{ color: 'var(--secondary)' }} />
                </div>
                <div className="stat-value">{stats.pendingWebhooks}</div>
                <p>● {stats.activeRules} active rules</p>
              </div>
            </div>

            {/* Dashboard Workspace Grid */}
            <div className="dashboard-grid">
              {/* Platform Overview */}
              <div>
                <div className="glass-panel section-card">
                  <div className="section-header">
                    <span className="section-title">Platform Overview</span>
                  </div>
                  <table className="platform-table">
                    <thead>
                      <tr>
                        <th>Platform</th>
                        <th>Accounts</th>
                        <th>Posts</th>
                        <th>Comments</th>
                        <th>Auto-Replies</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.platforms.map((platform, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{platform.name}</td>
                          <td>{platform.accounts}</td>
                          <td>{platform.posts}</td>
                          <td>{platform.comments}</td>
                          <td style={{ color: platform.autoReplies > 0 ? '#34D399' : '' }}>
                            {platform.autoReplies > 0 ? (
                              <span className="badge badge-success">{platform.autoReplies}</span>
                            ) : platform.autoReplies}
                          </td>
                          <td>
                            <span className={`badge ${platform.status === 'Active' ? 'badge-success' : 'badge-dark'}`}>
                              {platform.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Recent Comments inside Dashboard */}
                <div className="glass-panel section-card">
                  <div className="section-header">
                    <span className="section-title">Recent Feed Activity</span>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => setActiveTab('comments')}>
                      View All
                    </button>
                  </div>
                  <div className="comments-list">
                    {comments.slice(0, 3).map((comment) => (
                      <div className="comment-item" key={comment.id}>
                        <div className="comment-header">
                          <div className="comment-author">
                            <span className="author-name">{comment.authorName}</span>
                            <span className="comment-meta-info">
                              <span>Facebook Comment</span>
                              <span>•</span>
                              <span>{new Date(comment.createdAt).toLocaleTimeString()}</span>
                            </span>
                          </div>
                          {comment.isAutoReplied && <span className="badge badge-success">Auto</span>}
                        </div>
                        <p className="comment-text">"{comment.commentText}"</p>
                        
                        {comment.replyText && (
                          <div className="comment-reply-box">
                            <div className="reply-header">
                              <MessageSquare size={12} />
                              <span>Automated Reply</span>
                            </div>
                            <p className="reply-text">{comment.replyText}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        No comments received yet. Use the "Simulate Webhook" button to mock one!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar Cards: Webhook Logs & Quick Rules */}
              <div>
                {/* Live Webhook Monitor */}
                <div className="glass-panel section-card" style={{ height: '330px', display: 'flex', flexDirection: 'column' }}>
                  <div className="section-header">
                    <span className="section-title">
                      <Radio size={16} className="status-dot active" style={{ color: 'var(--secondary)' }} />
                      Live Webhook Logs
                    </span>
                  </div>
                  <div className="webhook-activity-feed">
                    {webhookLogs.map((log) => (
                      <div className="webhook-log-item" key={log.id}>
                        <div className="webhook-log-header">
                          <span>{log.timestamp}</span>
                          <span style={{ color: 'var(--secondary)' }}>POST /api/webhook</span>
                        </div>
                        <div className="webhook-log-payload">
                          {"{ object: 'page', entry: [...] }"}
                        </div>
                      </div>
                    ))}
                    {webhookLogs.length === 0 && (
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Waiting for webhook events...
                      </div>
                    )}
                    <div ref={webhookFeedEndRef} />
                  </div>
                </div>

                {/* Auto Reply Quick View */}
                <div className="glass-panel section-card">
                  <div className="section-header">
                    <span className="section-title">Active Rules ({rules.filter(r=>r.isActive).length})</span>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => setActiveTab('rules')}>
                      Manage
                    </button>
                  </div>
                  <div className="rules-list">
                    {rules.slice(0, 3).map((rule) => (
                      <div className="rule-item" key={rule.id}>
                        <div className="rule-info">
                          <span className="rule-keyword-badge">{rule.keyword}</span>
                          <span className="rule-response">{rule.replyContent}</span>
                        </div>
                        <div className="rule-actions">
                          <label className="switch">
                            <input 
                              type="checkbox" 
                              checked={rule.isActive} 
                              onChange={() => handleToggleRule(rule)}
                            />
                            <span className="slider"></span>
                          </label>
                        </div>
                      </div>
                    ))}
                    {rules.length === 0 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px' }}>
                        No rules found. Add one to start replying!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interactions Tab Content */}
        {activeTab === 'comments' && (
          <div className="glass-panel section-card animate-fade-in">
            <div className="tabs-header">
              <button 
                className={`tab-btn ${commentsTab === 'comments' ? 'active' : ''}`}
                onClick={() => setCommentsTab('comments')}
              >
                Comments Feed
              </button>
              <button 
                className={`tab-btn ${commentsTab === 'messages' ? 'active' : ''}`}
                onClick={() => setCommentsTab('messages')}
              >
                Messenger Chats
              </button>
            </div>

            {/* Filter toolbar */}
            {commentsTab === 'comments' && (
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Search comments or author..." 
                    className="form-input" 
                    style={{ paddingLeft: '36px' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <select 
                  className="form-input" 
                  style={{ width: '150px' }}
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                >
                  <option value="All">All Platforms</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                </select>

                <select 
                  className="form-input" 
                  style={{ width: '150px' }}
                  value={filterReplied}
                  onChange={(e) => setFilterReplied(e.target.value)}
                >
                  <option value="all">All Replies</option>
                  <option value="replied">Auto-Replied</option>
                  <option value="pending">Pending Reply</option>
                </select>
              </div>
            )}

            {/* Comments List */}
            {commentsTab === 'comments' && (
              <div className="comments-list">
                {filteredComments.map((comment) => (
                  <div className="comment-item" key={comment.id}>
                    <div className="comment-header">
                      <div className="comment-author">
                        <span className="author-name">{comment.authorName}</span>
                        <span className="comment-meta-info">
                          <span>ID: {comment.id}</span>
                          <span>•</span>
                          <span>User ID: {comment.authorId || 'N/A'}</span>
                          <span>•</span>
                          <span>{new Date(comment.createdAt).toLocaleString()}</span>
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                          {comment.platform}
                        </span>
                        {comment.isAutoReplied && <span className="badge badge-success">Auto</span>}
                      </div>
                    </div>
                    
                    <p className="comment-text">"{comment.commentText}"</p>
                    
                    <div className="post-ref">
                      <Share2 size={12} />
                      <span>Post Ref: {comment.postTitle || 'Facebook Post'} ({comment.postId})</span>
                    </div>

                    {comment.replyText ? (
                      <div className="comment-reply-box">
                        <div className="reply-header">
                          <MessageSquare size={12} />
                          <span>Sent Reply</span>
                        </div>
                        <p className="reply-text">{comment.replyText}</p>
                      </div>
                    ) : (
                      <div className="manual-reply-form">
                        <input 
                          type="text" 
                          placeholder="Type a manual response to send..." 
                          className="reply-input"
                          value={manualReplyTexts[comment.id] || ''}
                          onChange={(e) => setManualReplyTexts(prev => ({ ...prev, [comment.id]: e.target.value }))}
                        />
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '8px 16px' }}
                          onClick={() => handleManualReply(comment.id)}
                        >
                          <Send size={12} />
                          <span>Reply</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {filteredComments.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                    No comments found matching filters.
                  </div>
                )}
              </div>
            )}

            {/* Messenger Chats List */}
            {commentsTab === 'messages' && (
              <div className="comments-list">
                {messages.map((msg) => (
                  <div className="comment-item" key={msg.id}>
                    <div className="comment-header">
                      <div className="comment-author">
                        <span className="author-name">{msg.senderName}</span>
                        <span className="comment-meta-info">
                          <span>Mid: {msg.id}</span>
                          <span>•</span>
                          <span>Sender PSID: {msg.senderId}</span>
                          <span>•</span>
                          <span>{new Date(msg.createdAt).toLocaleString()}</span>
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge badge-secondary">Messenger</span>
                        {msg.isAutoReplied && <span className="badge badge-success">Auto</span>}
                      </div>
                    </div>
                    
                    <p className="comment-text">"{msg.messageText}"</p>

                    {msg.replyText && (
                      <div className="comment-reply-box" style={{ borderLeftColor: 'var(--primary)' }}>
                        <div className="reply-header" style={{ color: '#818CF8' }}>
                          <MessageSquare size={12} />
                          <span>Automated Response</span>
                        </div>
                        <p className="reply-text">{msg.replyText}</p>
                      </div>
                    )}
                  </div>
                ))}
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                    No messages received yet. Use the "Simulate Webhook" button and select Messenger!
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Auto Reply Rules Tab Content */}
        {activeTab === 'rules' && (
          <div className="glass-panel section-card animate-fade-in">
            <div className="section-header">
              <span className="section-title">Automated Reply Rules</span>
              <button className="btn btn-primary" onClick={() => setIsRuleModalOpen(true)}>
                <Plus size={14} />
                Add New Rule
              </button>
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <AlertCircle size={16} />
              <span>Use the placeholder <strong>{'{name}'}</strong> in your replies to automatically insert the author's name! (e.g. "Thanks {'{name}'}!")</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {rules.map((rule) => (
                <div className="glass-panel rule-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px', padding: '20px' }} key={rule.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="rule-keyword-badge">{rule.keyword}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="badge badge-dark" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>{rule.replyType}</span>
                      <span className="badge badge-dark" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>{rule.matchType}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Automated Reply Message:</div>
                    <p style={{ fontSize: '0.875rem', lineHeight: '1.5', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      "{rule.replyContent}"
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid var(--border-glass)', paddingTopping: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={rule.isActive} 
                          onChange={() => handleToggleRule(rule)}
                        />
                        <span className="slider"></span>
                      </label>
                      <span style={{ fontSize: '0.8rem', color: rule.isActive ? 'var(--success)' : 'var(--text-muted)' }}>
                        {rule.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <button 
                      className="btn" 
                      style={{ background: 'none', border: 'none', color: 'var(--text-dark)', padding: '4px' }}
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 size={16} className="delete-rule-btn" />
                    </button>
                  </div>
                </div>
              ))}
              {rules.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  No automation rules created yet. Click "Add New Rule" above to get started!
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Floating Simulation Panel */}
      {isSimOpen && (
        <div className="glass-panel sim-panel animate-fade-in">
          <div className="sim-panel-header">
            <h3>Webhook Sandbox Simulator</h3>
            <X size={16} className="modal-close" onClick={() => setIsSimOpen(false)} />
          </div>

          <div className="sim-type-selector">
            <div 
              className={`sim-type-tab ${simType === 'comment' ? 'active' : ''}`}
              onClick={() => setSimType('comment')}
            >
              Feed Comment
            </div>
            <div 
              className={`sim-type-tab ${simType === 'message' ? 'active' : ''}`}
              onClick={() => setSimType('message')}
            >
              Messenger Msg
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Simulated Sender Name</label>
            <input 
              type="text" 
              className="form-input"
              value={simData.authorName}
              onChange={(e) => setSimData(prev => ({ ...prev, authorName: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              {simType === 'comment' ? 'Comment Content' : 'Message Text'}
            </label>
            <textarea 
              rows="3" 
              className="form-input"
              value={simData.content}
              onChange={(e) => setSimData(prev => ({ ...prev, content: e.target.value }))}
              style={{ resize: 'none', fontFamily: 'inherit' }}
            />
          </div>

          {simType === 'comment' && (
            <>
              <div className="form-group">
                <label className="form-label">Mock Post ID</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={simData.postId}
                  onChange={(e) => setSimData(prev => ({ ...prev, postId: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mock Post Caption</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={simData.postTitle}
                  onChange={(e) => setSimData(prev => ({ ...prev, postTitle: e.target.value }))}
                />
              </div>
            </>
          )}

          <button className="btn btn-accent sim-btn" onClick={handleSimulateEvent}>
            <Send size={14} />
            <span>Send Mock Webhook</span>
          </button>
        </div>
      )}

      {/* Floating Simulation Trigger Button */}
      {!isSimOpen && (
        <button className="sim-trigger-btn" onClick={() => setIsSimOpen(true)}>
          <Activity size={24} />
        </button>
      )}

      {/* New Rule Modal */}
      {isRuleModalOpen && (
        <div className="modal-overlay animate-fade-in">
          <div className="glass-panel modal-content">
            <div className="modal-header">
              <h2>Create Auto-Reply Rule</h2>
              <X size={18} className="modal-close" onClick={() => setIsRuleModalOpen(false)} />
            </div>

            <form onSubmit={handleCreateRule}>
              <div className="form-group">
                <label className="form-label">Trigger Keyword</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. price, details, delivery"
                  required
                  value={newRule.keyword}
                  onChange={(e) => setNewRule(prev => ({ ...prev, keyword: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Match Type</label>
                <select 
                  className="form-input"
                  value={newRule.matchType}
                  onChange={(e) => setNewRule(prev => ({ ...prev, matchType: e.target.value }))}
                >
                  <option value="contains">Contains Keyword</option>
                  <option value="exact">Exact Match</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Apply To</label>
                <select 
                  className="form-input"
                  value={newRule.replyType}
                  onChange={(e) => setNewRule(prev => ({ ...prev, replyType: e.target.value }))}
                >
                  <option value="comment">Comments Feed Only</option>
                  <option value="message">Messenger Chats Only</option>
                  <option value="both">Both Comments & Messages</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Automated Reply Message</label>
                <textarea 
                  rows="4" 
                  className="form-input" 
                  placeholder="Type the message that will be automatically sent..."
                  required
                  value={newRule.replyContent}
                  onChange={(e) => setNewRule(prev => ({ ...prev, replyContent: e.target.value }))}
                  style={{ resize: 'none', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRuleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;

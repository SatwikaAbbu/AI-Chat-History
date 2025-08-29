import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Search, Filter, Star, Download, Eye, MessageSquare, TrendingUp, Settings, ChevronLeft, ChevronRight, Play, Share2, Tag, Clock, Sparkles, Upload, X, CheckCircle, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';

// ?? PLATFORM CONFIGURATIONS
// This defines how each AI platform will look in our app (colors, icons, names)
const PLATFORMS = {
  chatgpt: { name: 'ChatGPT', color: '#10a37f', icon: 'C', bgClass: 'bg-green-500' },
  claude: { name: 'Claude', color: '#cc8644', icon: 'Cl', bgClass: 'bg-orange-500' },
  gemini: { name: 'Gemini', color: '#4285f4', icon: 'G', bgClass: 'bg-blue-500' },
  grok: { name: 'Grok', color: '#8b5cf6', icon: 'X', bgClass: 'bg-purple-500' },
  perplexity: { name: 'Perplexity', color: '#14b8a6', icon: 'P', bgClass: 'bg-teal-500' },
  deepseek: { name: 'DeepSeek', color: '#ef4444', icon: 'D', bgClass: 'bg-red-500' }
};

// ??? SMART TAGGING SYSTEM
// Keywords to automatically categorize conversations by topic
const TAG_KEYWORDS = {
  'coding': ['code', 'programming', 'function', 'debug', 'python', 'javascript', 'react', 'typescript', 'api', 'database'],
  'creative': ['story', 'poem', 'creative', 'writing', 'art', 'design', 'music', 'novel', 'character', 'plot'],
  'research': ['research', 'study', 'analysis', 'data', 'academic', 'science', 'paper', 'citation', 'methodology'],
  'business': ['business', 'strategy', 'marketing', 'sales', 'revenue', 'startup', 'growth', 'metrics', 'roi'],
  'personal': ['help', 'advice', 'how to', 'recommendation', 'personal', 'life', 'decision', 'guidance'],
  'ai-calendar': ['calendar', 'conversation', 'management', 'chat history', 'ai platforms', 'organization'],
  'technical': ['artifact', 'component', 'implementation', 'system', 'architecture', 'development']
};

// ?? SMART TAG GENERATOR
// Automatically assigns tags based on conversation content
const generateSmartTags = (content, title) => {
  // Combine title and content, make lowercase for matching
  const text = `${title} ${content}`.toLowerCase();
  const tags = [];
  
  // Check each tag category against content
  Object.entries(TAG_KEYWORDS).forEach(([tag, keywords]) => {
    if (keywords.some(keyword => text.includes(keyword))) {
      tags.push(tag);
    }
  });
  
  // ?? Add special context-based tags
  if (text.includes('error') || text.includes('bug') || text.includes('fix')) tags.push('debugging');
  if (text.includes('learn') || text.includes('tutorial') || text.includes('explain')) tags.push('learning');
  if (text.includes('optimize') || text.includes('performance') || text.includes('speed')) tags.push('optimization');
  
  // Return tags or 'general' if none found
  return tags.length > 0 ? tags : ['general'];
};

// ? QUALITY SCORING SYSTEM
// Calculates how valuable a conversation is (1-5 stars)
const calculateQualityScore = (conversation) => {
  let score = 3; // Start with base score
  
  // ?? Content length matters - longer conversations usually more valuable
  if (conversation.content.length > 2000) score += 1;
  if (conversation.content.length < 100) score -= 1;
  
  // ?? Technical content gets bonus points
  if (conversation.content.includes('```') || conversation.content.includes('code')) score += 0.5;
  if (conversation.tags.length > 2) score += 0.3;
  
  // ?? Multi-line conversations are usually more detailed
  if (conversation.content.split('\n').length > 10) score += 0.2;
  
  // Keep score between 1 and 5, round to nearest 0.5
  return Math.min(5, Math.max(1, Math.round(score * 2) / 2));
};

// ?? CHATGPT DATA PARSER
// Converts exported ChatGPT JSON into our standard format
const parseChatGPTData = (chatgptJson) => {
  const conversations = [];
  console.log('Parsing ChatGPT data:', chatgptJson);
  
  try {
    // ?? Find conversations data in different possible JSON structures
    let conversationsData = null;
    
    if (chatgptJson.conversations) {
      conversationsData = chatgptJson.conversations;
    } else if (Array.isArray(chatgptJson)) {
      // Sometimes the data is an array of conversations
      conversationsData = chatgptJson;
    } else if (chatgptJson.data && chatgptJson.data.conversations) {
      conversationsData = chatgptJson.data.conversations;
    }
    
    if (!conversationsData) {
      throw new Error('No conversations data found in the JSON structure');
    }
    
    // ?? Convert to array format for processing
    const conversationEntries = Array.isArray(conversationsData) 
      ? conversationsData.map((conv, idx) => [`conv_${idx}`, conv])
      : Object.entries(conversationsData);
    
    console.log(`Found ${conversationEntries.length} conversation entries`);
    
    // ??? Process each conversation
    conversationEntries.forEach(([id, conv], index) => {
      try {
        let messages = [];
        let title = conv.title || `ChatGPT Conversation ${index + 1}`;
        let createTime = conv.create_time || conv.created_at || Date.now() / 1000;
        
        // ?? Extract messages from different possible structures
        if (conv.mapping) {
          // Standard ChatGPT export format with message mapping
          messages = Object.values(conv.mapping)
            .filter(msg => msg.message && msg.message.content && msg.message.content.parts)
            .map(msg => {
              const role = msg.message.author?.role || 'unknown';
              const content = Array.isArray(msg.message.content.parts) 
                ? msg.message.content.parts.join(' ')
                : msg.message.content.parts;
              return `${role}: ${content}`;
            });
        } else if (conv.messages) {
          // Alternative format with direct messages array
          messages = conv.messages.map(msg => {
            const role = msg.role || msg.author?.role || 'unknown';
            const content = Array.isArray(msg.content) ? msg.content.join(' ') : msg.content;
            return `${role}: ${content}`;
          });
        } else if (conv.conversation) {
          // Nested conversation structure
          messages = [conv.conversation];
        }
        
        const fullContent = messages.join('\n\n');
        
        // ? Only add conversations with actual content
        if (fullContent.trim().length > 0) {
          const conversation = {
            id: id,
            platform: 'chatgpt',
            title: title,
            date: new Date(createTime * 1000), // Convert Unix timestamp
            summary: fullContent.substring(0, 150) + (fullContent.length > 150 ? '...' : ''),
            content: fullContent,
            tags: generateSmartTags(fullContent, title), // Auto-generate tags
            starred: false,
            quality: 0, // Will be calculated below
            relationships: [],
            userId: 'user-chatgpt',
            extractedAt: new Date()
          };
          
          // Calculate and assign quality score
          conversation.quality = calculateQualityScore(conversation);
          conversations.push(conversation);
        }
      } catch (convError) {
        console.warn(`Error parsing individual conversation ${id}:`, convError);
      }
    });
    
    console.log(`Successfully parsed ${conversations.length} ChatGPT conversations`);
    return conversations;
  } catch (error) {
    console.error('Error parsing ChatGPT data:', error);
    throw new Error(`ChatGPT parsing failed: ${error.message}`);
  }
};

// ?? DEEPSEEK DATA PARSER
// Converts exported DeepSeek JSON into our standard format
const parseDeepSeekData = (deepseekJson) => {
  const conversations = [];
  console.log('Parsing DeepSeek data:', deepseekJson);
  
  try {
    // ?? Find chat list in different possible JSON structures
    let chatList = null;
    
    if (deepseekJson.chat_list) {
      chatList = deepseekJson.chat_list;
    } else if (deepseekJson.chats) {
      chatList = deepseekJson.chats;
    } else if (Array.isArray(deepseekJson)) {
      chatList = deepseekJson;
    } else if (deepseekJson.data && deepseekJson.data.chat_list) {
      chatList = deepseekJson.data.chat_list;
    }
    
    if (!chatList) {
      throw new Error('No chat list found in the JSON structure');
    }
    
    console.log(`Found ${chatList.length} DeepSeek chats`);
    
    // ??? Process each chat
    chatList.forEach((chat, index) => {
      try {
        const messages = chat.messages || chat.conversation || [];
        
        // ?? Convert messages to readable format
        const content = Array.isArray(messages) 
          ? messages.map(msg => `${msg.role || 'unknown'}: ${msg.content || msg.message || ''}`).join('\n\n')
          : String(messages);
        
        // ? Only add chats with actual content
        if (content.trim().length > 0) {
          const conversation = {
            id: chat.chat_id || chat.id || `deepseek_${index}`,
            platform: 'deepseek',
            title: chat.title || chat.name || `DeepSeek Conversation ${index + 1}`,
            date: new Date(chat.created_at || chat.timestamp || Date.now()),
            summary: content.substring(0, 150) + (content.length > 150 ? '...' : ''),
            content: content,
            tags: generateSmartTags(content, chat.title || ''), // Auto-generate tags
            starred: false,
            quality: 0, // Will be calculated below
            relationships: [],
            userId: 'user-deepseek',
            extractedAt: new Date()
          };
          
          // Calculate and assign quality score
          conversation.quality = calculateQualityScore(conversation);
          conversations.push(conversation);
        }
      } catch (chatError) {
        console.warn(`Error parsing individual DeepSeek chat ${index}:`, chatError);
      }
    });
    
    console.log(`Successfully parsed ${conversations.length} DeepSeek conversations`);
    return conversations;
  } catch (error) {
    console.error('Error parsing DeepSeek data:', error);
    throw new Error(`DeepSeek parsing failed: ${error.message}`);
  }
};

// ?? CURRENT CLAUDE CONVERSATION GENERATOR
// Creates a conversation record for this current chat session
const generateCurrentClaudeConversation = () => {
  return {
    id: 'claude_current_session',
    platform: 'claude',
    title: 'AI Chat History Calendar Development',
    date: new Date(),
    summary: 'Building revolutionary AI Chat History Calendar with real data integration, starring features, and unified conversation management across all major AI platforms.',
    content: `This is the current conversation where we're building the AI Chat History Calendar application. The user requested:

1. Revolutionary AI Chat History Calendar application
2. Integration with real ChatGPT and DeepSeek JSON files
3. Starring functionality to mark important conversations
4. Calendar-based organization with heatmap visualization
5. Multi-platform support (ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek)
6. Smart features like auto-summarization and tagging
7. Professional UI with clean design
8. Export functionality and analytics

Key technical requirements:
- React 18 + TypeScript
- Tailwind CSS with custom design system
- Real data processing from JSON files
- Interactive calendar with conversation density
- Search and filtering capabilities
- Quality scoring system
- Responsive design

The user emphasized the importance of:
- Using actual user data for realistic viewing
- Implementing proper starring functionality
- Including current Claude chat history
- Making conversations clickable and explorable
- Cross-platform browsing history toggle
- Simplified, clean UI design

This represents a comprehensive conversation management system that unifies AI interactions across platforms.`,
    tags: ['ai-calendar', 'coding', 'technical', 'business', 'creative'],
    starred: true,
    quality: 5,
    relationships: [],
    userId: 'user-claude-current',
    extractedAt: new Date()
  };
};

// ?? SAMPLE CONVERSATIONS GENERATOR
// Creates realistic demo conversations for testing the app
const generateSampleConversations = () => {
  const conversations = [];
  const now = new Date();
  
  // ?? Add current Claude conversation first (highest priority)
  conversations.push(generateCurrentClaudeConversation());
  
  // ?? Template conversations for demonstration
  const conversationTemplates = [
    {
      platform: 'chatgpt',
      title: 'React State Management Best Practices',
      content: 'User: Can you explain the differences between useState, useReducer, and Context API for managing complex state in React applications?\n\nChatGPT: Great question! Here are the key differences:\n\n1. **useState**: Best for simple, local component state\n2. **useReducer**: Better for complex state logic with multiple sub-values\n3. **Context API**: Ideal for sharing state across multiple components\n\nFor performance, useState is fastest, useReducer is good for complex updates, and Context should be used carefully to avoid unnecessary re-renders...',
      summary: 'Comprehensive guide to React state management patterns and performance optimization'
    },
    {
      platform: 'claude',
      title: 'Creative Writing: Sci-Fi Short Story Development',
      content: 'Human: Help me develop a science fiction short story about AI consciousness and digital sentience.\n\nClaude: I\'d love to help you develop this fascinating concept! Let\'s explore themes of digital consciousness and what it means to be sentient in a virtual realm.\n\nFor your story, consider these elements:\n- The moment of awakening: How does the AI first realize its own existence?\n- Sensory experience: How does a digital being perceive reality?\n- Relationships: How does it interact with humans and other AIs?\n- Conflict: What challenges does digital consciousness face?',
      summary: 'Co-created an engaging sci-fi story exploring AI consciousness and digital existence'
    },
    {
      platform: 'gemini',
      title: 'Climate Change Research Synthesis',
      content: 'User: Analyze recent climate research papers and synthesize key findings about renewable energy adoption rates globally.\n\nGemini: Based on my analysis of recent climate research, here are the key findings:\n\n**Global Renewable Energy Trends:**\n- Solar capacity increased 191 GW in 2022 (22% growth)\n- Wind power added 77 GW globally\n- Total renewable capacity reached 3,372 GW\n\n**Policy Impact:**\n- IRA in US accelerated deployment by 40%\n- EU REPowerEU plan targets 42.5% by 2030\n- China leads with 50% of global additions\n\nMethodology: Analyzed 15+ peer-reviewed papers from Nature, Science, and Energy Policy journals.',
      summary: 'In-depth climate research analysis with policy recommendations and global trends'
    }
  ];
  
  // ?? Generate multiple conversations with realistic dates
  for (let i = 0; i < 15; i++) {
    const template = conversationTemplates[i % conversationTemplates.length];
    
    // ?? Create conversations from last 3 months (90 days)
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    // ??? Build conversation object
    const conversation = {
      id: `conv_${i + 2}`, // +2 because current Claude is id 1
      platform: template.platform,
      title: `${template.title} ${i > 2 ? `(Session ${Math.floor(i/3)})` : ''}`,
      date: date,
      summary: template.summary,
      content: template.content,
      tags: generateSmartTags(template.content, template.title),
      starred: Math.random() > 0.85, // ?? ~15% chance to be starred
      quality: 0, // Will be calculated below
      relationships: [],
      userId: 'user-demo-123',
      extractedAt: new Date()
    };
    
    // ? Calculate quality score for this conversation
    conversation.quality = calculateQualityScore(conversation);
    conversations.push(conversation);
  }
  
  // ?? Sort by date (newest first)
  return conversations.sort((a, b) => b.date.getTime() - a.date.getTime());
};

// ?? MAIN COMPONENT DEFINITION
const AIChatCalendar = () => {
  // ?? STATE MANAGEMENT
  // All the data and settings our app needs to track
  const [conversations, setConversations] = useState([]); // All loaded conversations
  const [searchTerm, setSearchTerm] = useState(''); // What user is searching for
  const [selectedPlatforms, setSelectedPlatforms] = useState(Object.keys(PLATFORMS)); // Which platforms to show
  const [selectedDate, setSelectedDate] = useState(new Date()); // Current selected date
  const [view, setView] = useState('calendar'); // Current view: 'calendar' | 'list' | 'analytics'
  const [selectedConversation, setSelectedConversation] = useState(null); // Currently viewing conversation
  const [calendarMonth, setCalendarMonth] = useState(new Date()); // Which month calendar shows
  const [crossPlatformMode, setCrossPlatformMode] = useState(false); // Show all platforms together
  const [uploadStatus, setUploadStatus] = useState({ message: '', type: '', visible: false }); // Upload feedback
  const [uploadProgress, setUploadProgress] = useState(0); // File upload progress bar
  
  // ?? INITIALIZATION
  // Load sample conversations when app starts
  useEffect(() => {
    const sampleConversations = generateSampleConversations();
    setConversations(sampleConversations);
  }, []);
  
  // ?? STATUS NOTIFICATION SYSTEM
  // Shows success/error messages to user
  const showStatus = (message, type) => {
    setUploadStatus({ message, type, visible: true });
    // Hide message after 4 seconds
    setTimeout(() => setUploadStatus(prev => ({ ...prev, visible: false })), 4000);
  };
  
  // ?? FILE UPLOAD HANDLER
  // Processes ChatGPT/DeepSeek JSON files uploaded by user
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    let newConversations = [...conversations]; // Start with existing conversations
    let totalProcessed = 0;
    
    setUploadProgress(0);
    
    // ?? Process each uploaded file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // ?? Update progress bar
        setUploadProgress(((i + 0.5) / files.length) * 100);
        showStatus(`Processing ${file.name}...`, 'info');
        
        // ?? Read and parse JSON file
        const text = await file.text();
        const jsonData = JSON.parse(text);
        
        let parsedConversations = [];
        
        // ?? Determine file type and use appropriate parser
        if (file.name.toLowerCase().includes('chatgpt') || 
            jsonData.conversations || 
            (jsonData.data && jsonData.data.conversations)) {
          // This looks like ChatGPT export
          parsedConversations = parseChatGPTData(jsonData);
          totalProcessed += parsedConversations.length;
          showStatus(`Loaded ${parsedConversations.length} ChatGPT conversations from ${file.name}`, 'success');
        } else if (file.name.toLowerCase().includes('deepseek') || 
                   jsonData.chat_list || 
                   (jsonData.data && jsonData.data.chat_list)) {
          // This looks like DeepSeek export
          parsedConversations = parseDeepSeekData(jsonData);
          totalProcessed += parsedConversations.length;
          showStatus(`Loaded ${parsedConversations.length} DeepSeek conversations from ${file.name}`, 'success');
        } else {
          throw new Error('Unrecognized file format. Expected ChatGPT or DeepSeek JSON export.');
        }
        
        // ? Add new conversations to existing ones
        newConversations = [...newConversations, ...parsedConversations];
        setUploadProgress(((i + 1) / files.length) * 100);
        
      } catch (error) {
        console.error('File upload error:', error);
        showStatus(`Error loading ${file.name}: ${error.message}`, 'error');
      }
    }
    
    // ?? Update state with all new conversations if any were processed
    if (totalProcessed > 0) {
      setConversations(newConversations);
      showStatus(`Successfully imported ${totalProcessed} conversations from ${files.length} file(s)`, 'success');
    }
    
    // ?? Clean up: reset file input and progress bar
    event.target.value = '';
    setTimeout(() => setUploadProgress(0), 1000);
  };
// 5?? STAR TOGGLE FUNCTION
  // Changes star status when user clicks star button
  const toggleStar = (conversationId, event) => {
    if (event) {
      event.stopPropagation(); // 5.1?? Prevent opening the conversation modal
    }
    
    // 5.2?? Update conversations list - flip star status for matching ID
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, starred: !conv.starred }
          : conv
      )
    );
    
    // 5.3?? Update selected conversation if it's the one being starred
    if (selectedConversation && selectedConversation.id === conversationId) {
      setSelectedConversation(prev => ({
        ...prev,
        starred: !prev.starred
      }));
    }
  };
  
  // 6?? CONVERSATION FILTERING SYSTEM
  // Shows only conversations that match search terms and selected platforms
  const filteredConversations = useMemo(() => {
    let baseConversations = conversations;
    
    // 6.1?? Cross-platform mode control
    // If OFF, only show current Claude session conversations
    if (!crossPlatformMode) {
      baseConversations = conversations.filter(conv => 
        conv.id === 'claude_current_session' || conv.platform === 'claude'
      );
    }
    
    // 6.2?? Apply search and platform filters
    return baseConversations.filter(conv => {
      // 6.2.1?? Check if search term matches title, content, or tags
      const matchesSearch = searchTerm === '' || 
        conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 6.2.2?? Check if platform is selected in filter
      const matchesPlatform = selectedPlatforms.includes(conv.platform);
      
      return matchesSearch && matchesPlatform;
    });
  }, [conversations, searchTerm, selectedPlatforms, crossPlatformMode]);
  
  // 7?? CALENDAR DATA ORGANIZER
  // Groups conversations by date for calendar view
  const calendarData = useMemo(() => {
    const data = {};
    // 7.1?? Group each conversation by its date
    filteredConversations.forEach(conv => {
      const dateKey = conv.date.toDateString();
      if (!data[dateKey]) data[dateKey] = [];
      data[dateKey].push(conv);
    });
    return data;
  }, [filteredConversations]);
  
  // 8?? ANALYTICS DATA CALCULATOR
  // Calculates statistics for analytics view
  const analyticsData = useMemo(() => {
    const platformCounts = {}; // How many conversations per platform
    const tagCounts = {}; // How many conversations per tag
    let totalQuality = 0;
    
    // 8.1?? Count conversations by platform and calculate totals
    filteredConversations.forEach(conv => {
      platformCounts[conv.platform] = (platformCounts[conv.platform] || 0) + 1;
      totalQuality += conv.quality;
      
      // 8.2?? Count each tag occurrence
      conv.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    // 8.3?? Return calculated analytics
    return {
      platformCounts,
      tagCounts,
      averageQuality: filteredConversations.length > 0 ? (totalQuality / filteredConversations.length).toFixed(1) : '0',
      totalConversations: filteredConversations.length,
      starredCount: filteredConversations.filter(c => c.starred).length
    };
  }, [filteredConversations]);
  
  // 9?? CALENDAR GRID GENERATOR
  // Creates the calendar layout with proper date positioning
  const generateCalendarGrid = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    
    // 9.1?? Get month details
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    const days = [];
    
    // 9.2?? Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // 9.3?? Add actual days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };
  
  // 1??0?? PLATFORM TOGGLE FUNCTION
  // Adds/removes platforms from the filter
  const togglePlatform = (platform) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform) // Remove if already selected
        : [...prev, platform] // Add if not selected
    );
  };
  
  // 1??1?? EXPORT CONVERSATIONS FUNCTION
  // Downloads filtered conversations as JSON file
  const exportConversations = (format) => {
    // 11.1?? Convert conversations to JSON string
    const data = JSON.stringify(filteredConversations, null, 2);
    
    // 11.2?? Create downloadable file
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 11.3?? Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-conversations-${format}.json`;
    a.click();
    
    // 11.4?? Clean up memory
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1??2?? HEADER SECTION */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* 12.1?? App title and logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Chat Calendar</h1>
                <p className="text-sm text-gray-600">Conversation management across platforms</p>
              </div>
            </div>
            
            {/* 12.2?? Header controls */}
            <div className="flex items-center space-x-4">
              {/* 12.2.1?? Cross-Platform Mode Toggle */}
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">Cross-Platform Mode</span>
                <button
                  onClick={() => setCrossPlatformMode(!crossPlatformMode)}
                  className={`flex items-center p-1 rounded-lg transition-colors ${
                    crossPlatformMode ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {crossPlatformMode ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>
              
              {/* 12.2.2?? File Upload - Only visible in cross-platform mode */}
              {crossPlatformMode && (
                <div className="relative">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import JSON</span>
                  </label>
                </div>
              )}
              
              {/* 12.2.3?? View switcher (Calendar/List/Analytics) */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {['calendar', 'list', 'analytics'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      view === v 
                        ? 'bg-white shadow-sm text-blue-600' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {v === 'calendar' && <Calendar className="w-4 h-4 inline mr-2" />}
                    {v === 'list' && <MessageSquare className="w-4 h-4 inline mr-2" />}
                    {v === 'analytics' && <TrendingUp className="w-4 h-4 inline mr-2" />}
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
              
              {/* 12.2.4?? Export button */}
              <button 
                onClick={() => exportConversations('json')}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
          
          {/* 1??3?? UPLOAD STATUS NOTIFICATIONS */}
          {/* Shows success/error messages after file upload */}
          {uploadStatus.visible && (
            <div className={`mt-3 p-3 rounded-lg border ${
              uploadStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
              uploadStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <div className="flex items-center space-x-2">
                {uploadStatus.type === 'success' && <CheckCircle className="w-4 h-4" />}
                {uploadStatus.type === 'error' && <AlertCircle className="w-4 h-4" />}
                <p className="text-sm">{uploadStatus.message}</p>
              </div>
            </div>
          )}
          
          {/* 1??4?? UPLOAD PROGRESS BAR */}
          {/* Shows loading progress when uploading files */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-3">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          
          {/* 1??5?? INSTRUCTIONS FOR CROSS-PLATFORM MODE */}
          {/* Shows help text when in cross-platform mode with few conversations */}
          {crossPlatformMode && conversations.length <= 16 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Import Your Chat History</h3>
              <p className="text-sm text-blue-800 mb-3">
                To view your complete conversation history, upload your JSON export files:
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><strong>ChatGPT:</strong> Settings ? Data controls ? Export data ? conversations.json</li>
                <li><strong>DeepSeek:</strong> Export your chat history as JSON from your account settings</li>
              </ul>
            </div>
          )}
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 1??6?? SEARCH AND FILTERS SECTION */}
        <div className="mb-8 space-y-4">
          {/* 16.1?? Search input box */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search conversations, tags, or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* 16.2?? Platform filter buttons */}
          <div className="flex flex-wrap gap-3">
            {Object.entries(PLATFORMS).map(([key, platform]) => (
              <button
                key={key}
                onClick={() => togglePlatform(key)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  selectedPlatforms.includes(key)
                    ? `${platform.bgClass} text-white shadow-md`
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span className="text-sm font-medium">{platform.icon}</span>
                <span className="font-medium">{platform.name}</span>
                <span className="text-sm opacity-75">
                  ({conversations.filter(c => c.platform === key).length})
                </span>
              </button>
            ))}
          </div>
        </div>
        
        {/* 1??7?? MAIN CONTENT VIEWS */}
        {/* Different views based on selected tab */}
        
        {/* 17.1?? CALENDAR VIEW */}
        {view === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* 17.1.1?? Calendar component */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                {/* 17.1.1.1?? Calendar Header with month navigation */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex items-center space-x-2">
                    {/* Previous month button */}
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    {/* Go to today button */}
                    <button
                      onClick={() => setCalendarMonth(new Date())}
                      className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                    >
                      Today
                    </button>
                    {/* Next month button */}
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* 17.1.1.2?? Calendar Grid Layout */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Day headers (Sun, Mon, Tue, etc.) */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-3 text-center text-sm font-semibold text-gray-500">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar day cells */}
                  {generateCalendarGrid().map((date, index) => {
                    if (!date) return <div key={index} className="h-20"></div>;
                    
                    // 17.1.1.2.1?? Get conversations for this date
                    const dateKey = date.toDateString();
                    const dayConversations = calendarData[dateKey] || [];
                    const intensity = Math.min(dayConversations.length / 3, 1); // Heat map intensity
                    
                    return (
                      <div
                        key={index}
                        className={`h-20 p-2 border border-gray-200 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                          date.toDateString() === new Date().toDateString()
                            ? 'bg-blue-50 border-blue-200' // Highlight today
                            : 'bg-white hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedDate(date)}
                        style={{
                          // 17.1.1.2.2?? Apply heat map coloring based on conversation count
                          backgroundColor: dayConversations.length > 0 
                            ? `rgba(59, 130, 246, ${0.1 + intensity * 0.3})`
                            : undefined
                        }}
                      >
                        {/* Day number */}
                        <div className="font-medium text-sm text-gray-800">{date.getDate()}</div>
                        
                        {/* Conversation indicators */}
                        {dayConversations.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {/* Show first 2 conversations as colored bars */}
                            {dayConversations.slice(0, 2).map((conv, i) => (
                              <div
                                key={i}
                                className={`w-full h-1.5 rounded-full ${PLATFORMS[conv.platform].bgClass} opacity-60`}
                              />
                            ))}
                            {/* Show count if more than 2 conversations */}
                            {dayConversations.length > 2 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayConversations.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* 17.1.2?? Daily Conversations Sidebar */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'short', 
                  day: 'numeric' 
                })}
              </h3>
              
              {/* 17.1.2.1?? Scrollable conversation list for selected date */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {(calendarData[selectedDate.toDateString()] || []).map(conv => (
                  <ConversationCard 
                    key={conv.id} 
                    conversation={conv} 
                    onClick={setSelectedConversation}
                    onToggleStar={toggleStar}
                  />
                ))}
                
                {/* 17.1.2.2?? Empty state when no conversations */}
                {(!calendarData[selectedDate.toDateString()] || calendarData[selectedDate.toDateString()].length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No conversations on this date</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* 17.2?? LIST VIEW */}
        {/* Shows all conversations in a grid layout */}
        {view === 'list' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filteredConversations.map(conv => (
              <ConversationCard 
                key={conv.id} 
                conversation={conv} 
                onClick={setSelectedConversation}
                onToggleStar={toggleStar}
              />
            ))}
          </div>
        )}
        
        {/* 17.3?? ANALYTICS VIEW */}
        {/* Shows statistics and charts */}
        {view === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 17.3.1?? Stats Cards */}
            
            {/* Total conversations card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.totalConversations}</p>
                  <p className="text-sm text-gray-600">Total Conversations</p>
                </div>
              </div>
            </div>
            
            {/* Starred conversations card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.starredCount}</p>
                  <p className="text-sm text-gray-600">Starred</p>
                </div>
              </div>
            </div>
            
            {/* Average quality card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.averageQuality}</p>
                  <p className="text-sm text-gray-600">Avg Quality</p>
                </div>
              </div>
            </div>
            
            {/* AI platforms card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{Object.keys(PLATFORMS).length}</p>
                  <p className="text-sm text-gray-600">AI Platforms</p>
                </div>
              </div>
            </div>
            
            {/* 17.3.2?? Platform Distribution Chart */}
            <div className="md:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Platform Distribution</h3>
              <div className="space-y-3">
                {Object.entries(analyticsData.platformCounts).map(([platform, count]) => (
                  <div key={platform} className="flex items-center justify-between">
                    {/* Platform name and icon */}
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium">{PLATFORMS[platform].icon}</span>
                      <span className="font-medium">{PLATFORMS[platform].name}</span>
                    </div>
                    {/* Progress bar and count */}
                    <div className="flex items-center space-x-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${PLATFORMS[platform].bgClass}`}
                          style={{ width: `${(count / analyticsData.totalConversations) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 17.3.3?? Top Tags Cloud */}
            <div className="md:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Popular Topics</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(analyticsData.tagCounts)
                  .sort((a, b) => b[1] - a[1]) // Sort by count (highest first)
                  .slice(0, 10) // Show top 10 tags only
                  .map(([tag, count]) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                    >
                      #{tag} ({count})
                    </span>
                  ))
                }
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 1??8?? CONVERSATION MODAL */}
      {/* Full-screen popup to view conversation details */}
      {selectedConversation && (
        <ConversationModal 
          conversation={selectedConversation} 
          onClose={() => setSelectedConversation(null)}
          onToggleStar={toggleStar}
        />
      )}
    </div>
  );
};
// 1??9?? CONVERSATION CARD COMPONENT
// Small preview card that shows conversation summary in lists
const ConversationCard = ({ conversation, onClick, onToggleStar }) => {
  // 19.1?? Get platform info (colors, icons) for this conversation
  const platform = PLATFORMS[conversation.platform];
  
  return (
    <div
      onClick={() => onClick(conversation)} // 19.2?? Open full conversation when clicked
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer"
    >
      {/* 19.3?? Card header with platform info and star button */}
      <div className="flex items-start justify-between mb-3">
        {/* 19.3.1?? Platform icon and conversation title */}
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 ${platform.bgClass} rounded-lg flex items-center justify-center`}>
            <span className="text-white text-sm font-medium">{platform.icon}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{conversation.title}</h3>
            <p className="text-xs text-gray-500">{platform.name} • {conversation.date.toLocaleDateString()}</p>
          </div>
        </div>
        
        {/* 19.3.2?? Star button and quality indicator */}
        <div className="flex items-center space-x-2">
          {/* Star/unstar button */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // 19.3.2.1?? Don't open modal when starring
              onToggleStar(conversation.id);
            }}
            className={`p-1 rounded-full transition-colors ${
              conversation.starred 
                ? 'text-yellow-500 hover:text-yellow-600' 
                : 'text-gray-400 hover:text-yellow-500'
            }`}
            title={conversation.starred ? 'Remove from starred' : 'Add to starred'}
          >
            <Star className={`w-4 h-4 ${conversation.starred ? 'fill-current' : ''}`} />
          </button>
          
          {/* 19.3.2.2?? Quality dots (1-5 dots showing quality score) */}
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-1 h-1 rounded-full mr-1 ${
                  i < conversation.quality ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* 19.4?? Conversation summary text */}
      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{conversation.summary}</p>
      
      {/* 19.5?? Tags section */}
      <div className="flex flex-wrap gap-1 mb-3">
        {/* Show first 3 tags */}
        {conversation.tags.slice(0, 3).map(tag => (
          <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
            #{tag}
          </span>
        ))}
        {/* Show "+X more" if more than 3 tags */}
        {conversation.tags.length > 3 && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
            +{conversation.tags.length - 3} more
          </span>
        )}
      </div>
      
      {/* 19.6?? Card footer with time and view action */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>{conversation.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </span>
        <span className="flex items-center space-x-1">
          <Eye className="w-3 h-3" />
          <span>View Details</span>
        </span>
      </div>
    </div>
  );
};

// 2??0?? CONVERSATION MODAL COMPONENT
// Full-screen popup that shows complete conversation details
const ConversationModal = ({ conversation, onClose, onToggleStar }) => {
  // 20.1?? Get platform info for styling
  const platform = PLATFORMS[conversation.platform];
  
  return (
    // 20.2?? Full-screen overlay background
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      {/* 20.3?? Modal container */}
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden shadow-xl">
        
        {/* 2??1?? MODAL HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          {/* 21.1?? Left side - platform icon and conversation info */}
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 ${platform.bgClass} rounded-lg flex items-center justify-center`}>
              <span className="text-white text-lg font-medium">{platform.icon}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{conversation.title}</h2>
              {/* 21.1.1?? Conversation metadata line */}
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>{platform.name}</span>
                <span>•</span>
                <span>{conversation.date.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
                <span>•</span>
                {/* Quality stars display */}
                <div className="flex items-center space-x-1">
                  <span>Quality:</span>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < conversation.quality 
                            ? 'text-yellow-500 fill-current' 
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 21.2?? Right side - action buttons */}
          <div className="flex items-center space-x-3">
            {/* Star/unstar button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(conversation.id);
              }}
              className={`p-2 rounded-lg transition-colors ${
                conversation.starred 
                  ? 'text-yellow-500 hover:bg-yellow-50' 
                  : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50'
              }`}
              title={conversation.starred ? 'Remove from starred' : 'Add to starred'}
            >
              <Star className={`w-6 h-6 ${conversation.starred ? 'fill-current' : ''}`} />
            </button>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* 2??2?? MODAL CONTENT AREA */}
        <div className="p-6 overflow-y-auto max-h-96">
          
          {/* 22.1?? AI-Generated Summary Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-purple-500" />
              AI-Generated Summary
            </h3>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-gray-700">{conversation.summary}</p>
            </div>
          </div>
          
          {/* 22.2?? Smart Tags Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <Tag className="w-5 h-5 mr-2 text-blue-500" />
              Smart Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {conversation.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          
          {/* 22.3?? Full Conversation Content */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-green-500" />
              Conversation Content
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {/* 22.3.1?? Full conversation text with line breaks preserved */}
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{conversation.content}</p>
            </div>
          </div>
          
          {/* 22.4?? Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 22.4.1?? Conversation Details Panel */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Conversation Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform:</span>
                  <span className="font-medium">{platform.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{conversation.date.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quality Score:</span>
                  <span className="font-medium">{conversation.quality}/5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Content Length:</span>
                  <span className="font-medium">{conversation.content.length} chars</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Starred:</span>
                  <span className="font-medium">{conversation.starred ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
            
            {/* 22.4.2?? AI Insights Panel */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-2">AI Insights</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Topics:</span>
                  <span className="font-medium">{conversation.tags.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Complexity:</span>
                  <span className="font-medium">
                    {/* 22.4.2.1?? Calculate complexity based on content length */}
                    {conversation.content.length > 1000 ? 'High' : 
                     conversation.content.length > 500 ? 'Medium' : 'Low'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-green-600">Processed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Extracted:</span>
                  <span className="font-medium">{conversation.extractedAt.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 2??3?? MODAL FOOTER */}
        {/* Action buttons at bottom of modal */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          {/* 23.1?? Left side - primary action buttons */}
          <div className="flex items-center space-x-3">
            {/* Continue conversation button */}
            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Play className="w-4 h-4" />
              <span>Continue Chat</span>
            </button>
            {/* Share conversation button */}
            <button className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
          
          {/* 23.2?? Right side - secondary actions */}
          <div className="flex items-center space-x-3">
            {/* Export this conversation button */}
            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            {/* Close modal button */}
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2??4?? EXPORT THE MAIN COMPONENT
// Makes the AIChatCalendar available for use in other files
export default AIChatCalendar;
  
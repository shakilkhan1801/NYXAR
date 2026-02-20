import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

console.log("⏳ Starting Nyxar Backend Server (SQLite Mode)...");

const app = express();

// CORS enabled for development flexibility
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// --- SQLITE DATABASE IMPLEMENTATION ---
const DATA_DIR = path.resolve('./data');
const DB_FILE = path.join(DATA_DIR, 'nyxar.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Initialize Database
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        console.error("❌ Could not connect to SQLite database:", err.message);
    } else {
        console.log(`📦 Connected to SQLite database at ${DB_FILE}`);
    }
});

// Create Users Table and Offline Messages Table
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        avatarUrl TEXT,
        publicKey TEXT,
        socketId TEXT,
        isOnline INTEGER,
        lastActive INTEGER
    )`, (err) => {
        if (err) console.error("Error creating users table:", err.message);
    });

    db.run(`CREATE TABLE IF NOT EXISTS offline_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receiverId TEXT,
        message TEXT,
        timestamp INTEGER
    )`, (err) => {
        if (err) console.error("Error creating offline_messages table:", err.message);
    });
});

// In-memory map for fast "Who is this socket?" lookups
// SQLite handles "Where is this user?", this map handles "Who is sending this?"
let socketToUserMap = {}; 

// --- API ROUTES ---

// Serve static files from the React app build directory
const DIST_DIR = path.resolve('./dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// Get all users
app.get('/api/users', (req, res) => {
  db.all("SELECT id, username, avatarUrl, publicKey, isOnline FROM users", [], (err, rows) => {
      if (err) {
          console.error("DB Query Error:", err);
          return res.status(500).json({ error: "Database error" });
      }
      
      // Parse keys and booleans before sending
      const users = rows.map(u => {
          try {
              return {
                  ...u,
                  publicKey: JSON.parse(u.publicKey), // Deserialize JWK
                  isOnline: u.isOnline === 1
              };
          } catch (e) {
              return null;
          }
      }).filter(Boolean);

      res.json(users);
  });
});

// --- SOCKET.IO EVENT HANDLERS ---

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // 1. User Registration (Login/Restore)
  socket.on('register', (userData) => {
    if (!userData || !userData.id) return;

    const { id, username, avatarUrl, publicKey } = userData;
    const publicKeyStr = JSON.stringify(publicKey); // Store complex object as string
    const now = Date.now();

    // Insert or Update User in SQLite
    const sql = `INSERT OR REPLACE INTO users (id, username, avatarUrl, publicKey, socketId, isOnline, lastActive) 
                 VALUES (?, ?, ?, ?, ?, 1, ?)`;
    
    db.run(sql, [id, username, avatarUrl, publicKeyStr, socket.id, now], (err) => {
        if (err) {
            console.error("Error saving user:", err.message);
            return;
        }

        // Update local map
        socketToUserMap[socket.id] = id;

        // Broadcast to others
        io.emit('user_joined', {
            id,
            username,
            avatarUrl,
            publicKey,
            isOnline: true
        });

        console.log(`👤 User Online (DB Updated): ${username} (ID: ${id})`);

        // CHECK FOR OFFLINE MESSAGES
        db.all("SELECT id, message FROM offline_messages WHERE receiverId = ?", [id], (err, rows) => {
            if (err) {
                console.error("Error fetching offline messages:", err);
                return;
            }
            
            if (rows && rows.length > 0) {
                console.log(`📬 Delivering ${rows.length} offline messages to ${username}`);
                rows.forEach(row => {
                    try {
                        const msg = JSON.parse(row.message);
                        socket.emit('receive_message', msg);
                        // Delete after delivery
                        db.run("DELETE FROM offline_messages WHERE id = ?", [row.id]);
                    } catch (e) {
                        console.error("Error parsing offline message:", e);
                    }
                });
            }
        });
    });
  });

  // 2. Handle Private Encrypted Messages
  socket.on('private_message', ({ receiverId, message }) => {
    console.log(`\n--- 🔒 ENCRYPTED TRAFFIC RELAY (Socket: ${socket.id}) ---`);
    console.log(`FROM: ${message.senderId}`);
    console.log(`TO:   ${receiverId}`);
    
    // Look up receiver's socketId from DB
    db.get("SELECT socketId, isOnline FROM users WHERE id = ?", [receiverId], (err, row) => {
        if (row && row.socketId && row.isOnline === 1) {
            io.to(row.socketId).emit('receive_message', message);
        } else {
            console.log(`⚠️ User ${receiverId} is offline. Storing message.`);
            // Store in Offline Messages
            const msgStr = JSON.stringify(message);
            db.run("INSERT INTO offline_messages (receiverId, message, timestamp) VALUES (?, ?, ?)", 
                [receiverId, msgStr, Date.now()], (err) => {
                    if (err) console.error("Error storing offline message:", err);
            });
        }
    });
  });

  // 3. WebRTC Signaling
  socket.on('signal', ({ targetId, signalData }) => {
      // Look up target's socketId
      db.get("SELECT socketId, isOnline FROM users WHERE id = ?", [targetId], (err, row) => {
          if (row && row.socketId && row.isOnline === 1) {
              const senderId = socketToUserMap[socket.id];
              if (senderId) {
                  io.to(row.socketId).emit('signal', { senderId, signalData });
              }
          } else {
              // Target is offline - notify sender
              socket.emit('signal_error', { 
                  code: 'USER_OFFLINE', 
                  message: 'User is currently offline',
                  targetId 
              });
          }
      });
  });

  // 4. Typing Indicators
  socket.on('typing', ({ receiverId }) => {
     db.get("SELECT socketId FROM users WHERE id = ?", [receiverId], (err, row) => {
         if (row && row.socketId) {
             const senderId = socketToUserMap[socket.id];
             if(senderId) {
                 io.to(row.socketId).emit('user_typing', { senderId });
             }
         }
     });
  });

  // 5. Disconnection
  socket.on('disconnect', () => {
    const userId = socketToUserMap[socket.id];
    
    if (userId) {
      // Update DB: Set offline
      const now = Date.now();
      db.run("UPDATE users SET isOnline = 0, socketId = NULL, lastActive = ? WHERE id = ?", [now, userId], (err) => {
          if (!err) {
              io.emit('user_left', { userId });
              console.log(`❌ User Disconnected: ${userId}`);
          }
      });

      // Clean up local map
      delete socketToUserMap[socket.id];
    }
  });
});

// Graceful Shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) console.error(err.message);
        console.log('Database connection closed.');
        process.exit(0);
    });
});

// Serve React App for any other route (SPA Support)
app.get('*', (req, res) => {
    const indexFile = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send("Frontend build not found. Run 'npm run build' first.");
    }
});

import { networkInterfaces } from 'os';

// Helper to get local IP
function getLocalIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const PORT = 5000;

httpServer.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`
  🚀 Nyxar Secure Messenger is RUNNING!
  
  ✅ Backend & Frontend are served on the SAME PORT.
  
  👉 Local:   http://localhost:${PORT}
  👉 Network: http://${localIp}:${PORT} (Use this for Mobile/Other Devices)
  
  💡 Dev Mode: Frontend is on http://localhost:3000
  
  🗄️  Database: SQLite (${DB_FILE})
  `);
});

httpServer.on('error', (e) => {
  console.error("❌ Server Error:", e);
});

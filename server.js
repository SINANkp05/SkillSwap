const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const db = require('./db.js');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Multer storage for avatars
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `avatar_${req.params.id}_${Date.now()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// Multer storage for post photos
const postStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `post_${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`);
    }
});
const uploadPost = multer({
    storage: postStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadsDir));

// ========================
// HELPER: Create Notification
// ========================
function createNotification(userId, type, message, link = null) {
    db.run(
        `INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)`,
        [userId, type, message, link],
        (err) => { if (err) console.error('Notification error:', err.message); }
    );
}

// ========================
// FEED ENDPOINTS
// ========================

app.get('/api/feed', (req, res) => {
    db.all("SELECT id, first_name, last_name, title, avatar, offers, needs, description, type, score FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => ({
            id: row.id,
            name: `${row.first_name} ${row.last_name}`,
            title: row.title || "SkillSwap User",
            avatar: row.avatar || "https://i.pravatar.cc/150?img=1",
            offers: row.offers ? JSON.parse(row.offers) : [],
            needs: row.needs ? JSON.parse(row.needs) : [],
            description: row.description || "Looking forward to connecting!",
            type: row.type || "needing-help",
            score: row.score || 0
        })));
    });
});

// ========================
// USER ENDPOINTS
// ========================

app.get('/api/user/:id', (req, res) => {
    db.get("SELECT id, first_name, last_name, title, avatar, offers, needs, description, type, score, portfolio_links, profile_views FROM users WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "User not found" });

        res.json({
            id: row.id,
            first_name: row.first_name,
            last_name: row.last_name,
            name: `${row.first_name} ${row.last_name}`,
            title: row.title || "SkillSwap User",
            avatar: row.avatar || "https://i.pravatar.cc/150?img=1",
            offers: row.offers ? JSON.parse(row.offers) : [],
            needs: row.needs ? JSON.parse(row.needs) : [],
            description: row.description || "Looking forward to connecting!",
            type: row.type || "needing-help",
            score: row.score || 0,
            portfolio_links: row.portfolio_links ? JSON.parse(row.portfolio_links) : [],
            profile_views: row.profile_views || 0
        });
    });
});

// Increment profile view count
app.post('/api/user/:id/view', (req, res) => {
    db.run(`UPDATE users SET profile_views = profile_views + 1 WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Upload avatar
app.post('/api/upload-avatar/:id', upload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const avatarUrl = `/uploads/${req.file.filename}`;
    db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [avatarUrl, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Avatar updated", avatar: avatarUrl });
    });
});

// Update user profile
app.put('/api/user/:id', (req, res) => {
    const { title, description, offers, needs, avatar, portfolio_links } = req.body;
    if (!title || !description || !offers || !needs) return res.status(400).json({ error: "Missing required fields" });

    const offersStr = JSON.stringify(offers);
    const needsStr = JSON.stringify(needs);
    const portfolioStr = JSON.stringify(portfolio_links || []);

    let sql, params;
    if (avatar) {
        sql = `UPDATE users SET title=?, description=?, offers=?, needs=?, avatar=?, portfolio_links=? WHERE id=?`;
        params = [title, description, offersStr, needsStr, avatar, portfolioStr, req.params.id];
    } else {
        sql = `UPDATE users SET title=?, description=?, offers=?, needs=?, portfolio_links=? WHERE id=?`;
        params = [title, description, offersStr, needsStr, portfolioStr, req.params.id];
    }

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Profile updated successfully" });
    });
});

// Get user ratings
app.get('/api/user/:id/ratings', (req, res) => {
    const sql = `
        SELECT r.*, u.first_name, u.last_name, u.avatar
        FROM ratings r
        JOIN users u ON r.rater_id = u.id
        WHERE r.ratee_id = ?
        ORDER BY r.created_at DESC
    `;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Submit a rating
app.post('/api/ratings', (req, res) => {
    const { swapId, raterId, rateeId, stars, review } = req.body;
    if (!swapId || !raterId || !rateeId || !stars) return res.status(400).json({ error: "Missing fields" });

    db.run(
        `INSERT OR IGNORE INTO ratings (swap_id, rater_id, ratee_id, stars, review) VALUES (?,?,?,?,?)`,
        [swapId, raterId, rateeId, stars, review || ''],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(409).json({ error: "You already rated this swap" });

            // Get rater name for notification
            db.get(`SELECT first_name, last_name FROM users WHERE id = ?`, [raterId], (err2, rater) => {
                if (rater) {
                    createNotification(
                        rateeId, 'rating',
                        `${rater.first_name} ${rater.last_name} gave you a ${stars}⭐ rating!`,
                        `profile.html?id=${rateeId}`
                    );
                }
            });

            res.status(201).json({ message: "Rating submitted" });
        }
    );
});

// ========================
// LEADERBOARD
// ========================
app.get('/api/leaderboard', (req, res) => {
    db.all("SELECT id, first_name, last_name, title, avatar, score FROM users ORDER BY score DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => ({
            id: row.id,
            name: `${row.first_name} ${row.last_name}`,
            title: row.title || "SkillSwap User",
            avatar: row.avatar || "https://i.pravatar.cc/150?img=1",
            score: row.score || 0
        })));
    });
});

// ========================
// AUTH ENDPOINTS
// ========================
app.post('/api/signup', async (req, res) => {
    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name || !email || !password) return res.status(400).json({ error: "All fields are required" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const avatar = `https://ui-avatars.com/api/?name=${first_name}+${last_name}&background=45a29e&color=fff`;
        const sql = `INSERT INTO users (first_name, last_name, email, password, title, avatar, offers, needs, description, type, portfolio_links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [first_name, last_name, email, hashedPassword, "New Member", avatar,
            JSON.stringify(["Learning", "Eager to help"]), JSON.stringify(["Mentorship", "Guidance"]),
            "I just joined SkillSwap!", "needing-help", "[]"], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: "Email already registered" });
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: "Account created! Welcome to SkillSwap.", id: this.lastID });
        });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Invalid email or password" });

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            res.json({
                message: "Login successful",
                user: {
                    id: user.id,
                    name: `${user.first_name} ${user.last_name}`,
                    first_name: user.first_name,
                    email: user.email,
                    avatar: user.avatar
                }
            });
        } else {
            res.status(401).json({ error: "Invalid email or password" });
        }
    });
});

// ========================
// SWAP ENDPOINTS
// ========================
app.post('/api/swaps/request', (req, res) => {
    const { requesterId, receiverId } = req.body;
    if (!requesterId || !receiverId) return res.status(400).json({ error: "Requester and Receiver IDs required" });
    if (requesterId === receiverId) return res.status(400).json({ error: "Cannot swap with yourself" });

    db.get(
        `SELECT id FROM swaps WHERE requester_id=? AND receiver_id=? AND status IN ('pending','accepted')`,
        [requesterId, receiverId],
        (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });
            if (existing) return res.status(400).json({ error: "A swap request is already pending or active with this user." });

            db.run(`INSERT INTO swaps (requester_id, receiver_id, status) VALUES (?,?,'pending')`, [requesterId, receiverId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const swapId = this.lastID;

                // Notify the receiver
                db.get(`SELECT first_name, last_name FROM users WHERE id=?`, [requesterId], (err2, requester) => {
                    if (requester) {
                        createNotification(
                            receiverId, 'swap_request',
                            `${requester.first_name} ${requester.last_name} sent you a swap request!`,
                            `dashboard.html`
                        );
                    }
                });

                res.status(201).json({ message: "Swap request sent!", swapId });
            });
        }
    );
});

app.post('/api/swaps/:id/accept', (req, res) => {
    const swapId = req.params.id;
    db.run(`UPDATE swaps SET status='accepted' WHERE id=? AND status='pending'`, [swapId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Not found or not pending" });

        db.get(`SELECT s.*, u.first_name, u.last_name FROM swaps s JOIN users u ON s.receiver_id = u.id WHERE s.id=?`, [swapId], (err2, swap) => {
            if (swap) {
                createNotification(
                    swap.requester_id, 'swap_accepted',
                    `${swap.first_name} ${swap.last_name} accepted your swap request! 🎉`,
                    `chat.html?swapId=${swapId}`
                );
            }
        });

        res.json({ message: "Swap accepted" });
    });
});

app.post('/api/swaps/:id/reject', (req, res) => {
    db.run(`UPDATE swaps SET status='rejected' WHERE id=? AND status='pending'`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Swap rejected" });
    });
});

app.post('/api/swaps/:id/complete', (req, res) => {
    const swapId = req.params.id;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    db.get(`SELECT * FROM swaps WHERE id=?`, [swapId], (err, swap) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!swap) return res.status(404).json({ error: "Swap not found" });
        if (swap.status !== 'accepted') return res.status(400).json({ error: "Swap must be accepted first" });

        let updateQuery = "";
        if (swap.requester_id == userId) {
            updateQuery = `UPDATE swaps SET requester_completed=1 WHERE id=?`;
            swap.requester_completed = 1;
        } else if (swap.receiver_id == userId) {
            updateQuery = `UPDATE swaps SET receiver_completed=1 WHERE id=?`;
            swap.receiver_completed = 1;
        } else {
            return res.status(403).json({ error: "Not part of this swap" });
        }

        db.run(updateQuery, [swapId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            if (swap.requester_completed === 1 && swap.receiver_completed === 1 && swap.points_awarded === 0) {
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run(`UPDATE users SET score=score+10 WHERE id IN (?,?)`, [swap.requester_id, swap.receiver_id]);
                    db.run(`UPDATE swaps SET points_awarded=1 WHERE id=?`, [swapId]);
                    db.run('COMMIT', (err) => {
                        if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: "Failed to commit" }); }

                        // Notify both users
                        createNotification(swap.requester_id, 'swap_complete', 'Swap completed! You both earned +10 points 🏆', `profile.html?id=${swap.requester_id}`);
                        createNotification(swap.receiver_id, 'swap_complete', 'Swap completed! You both earned +10 points 🏆', `profile.html?id=${swap.receiver_id}`);

                        res.json({ message: "Swap complete! Both users earn +10 points." });
                    });
                });
            } else {
                res.json({ message: "Marked as complete. Waiting for partner to confirm." });
            }
        });
    });
});

app.get('/api/swaps/me', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    const sql = `
        SELECT s.*,
            req.first_name as req_first, req.last_name as req_last, req.avatar as req_avatar,
            rec.first_name as rec_first, rec.last_name as rec_last, rec.avatar as rec_avatar
        FROM swaps s
        JOIN users req ON s.requester_id = req.id
        JOIN users rec ON s.receiver_id = rec.id
        WHERE s.requester_id=? OR s.receiver_id=?
        ORDER BY s.created_at DESC
    `;

    db.all(sql, [userId, userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => {
            const isRequester = row.requester_id == userId;
            const otherUser = isRequester
                ? { id: row.receiver_id, name: `${row.rec_first} ${row.rec_last}`, avatar: row.rec_avatar }
                : { id: row.requester_id, name: `${row.req_first} ${row.req_last}`, avatar: row.req_avatar };
            return {
                id: row.id, status: row.status, isRequester, otherUser,
                myCompletionStatus: isRequester ? row.requester_completed : row.receiver_completed,
                theirCompletionStatus: isRequester ? row.receiver_completed : row.requester_completed,
                pointsAwarded: row.points_awarded
            };
        }));
    });
});

// ========================
// CHAT ENDPOINTS
// ========================
app.get('/api/messages/:swapId', (req, res) => {
    const sql = `SELECT m.*, u.first_name, u.avatar FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.swap_id=? ORDER BY m.timestamp ASC`;
    db.all(sql, [req.params.swapId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/messages/:swapId', (req, res) => {
    const { senderId, text } = req.body;
    if (!senderId || !text) return res.status(400).json({ error: "Sender ID and text required" });

    db.run(`INSERT INTO messages (swap_id, sender_id, text) VALUES (?,?,?)`, [req.params.swapId, senderId, text], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Sent", messageId: this.lastID });
    });
});

// ========================
// NOTIFICATIONS ENDPOINTS
// ========================
app.get('/api/notifications/:userId', (req, res) => {
    db.all(
        `SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30`,
        [req.params.userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

app.get('/api/notifications/:userId/unread-count', (req, res) => {
    db.get(`SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=0`, [req.params.userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ count: row.count });
    });
});

app.post('/api/notifications/read-all', (req, res) => {
    const { userId } = req.body;
    db.run(`UPDATE notifications SET is_read=1 WHERE user_id=?`, [userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ========================
// POSTS & SOCIAL ENDPOINTS
// ========================
app.post('/api/posts', uploadPost.single('photo'), (req, res) => {
    const { userId, content, hashtags } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!userId || !content) return res.status(400).json({ error: "User ID and content required" });

    db.run(`INSERT INTO posts (user_id, content, image_url) VALUES (?,?,?)`, [userId, content, imageUrl], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const postId = this.lastID;

        if (hashtags) {
            try {
                const tags = JSON.parse(hashtags);
                if (Array.isArray(tags) && tags.length > 0) {
                    const stmt = db.prepare(`INSERT INTO post_hashtags (post_id, hashtag) VALUES (?,?)`);
                    tags.forEach(tag => stmt.run(postId, tag));
                    stmt.finalize();
                }
            } catch (e) { console.error("Hashtag parse error:", e); }
        }

        res.status(201).json({ message: "Post created!", postId, imageUrl });
    });
});

app.get('/api/posts/user/:userId', (req, res) => {
    const sql = `
        SELECT p.*, u.first_name, u.last_name, u.avatar,
        (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as likes_count,
        (SELECT GROUP_CONCAT(hashtag) FROM post_hashtags WHERE post_id=p.id) as hashtags
        FROM posts p JOIN users u ON p.user_id=u.id
        WHERE p.user_id=? ORDER BY p.created_at DESC
    `;
    db.all(sql, [req.params.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({ ...r, hashtags: r.hashtags ? r.hashtags.split(',') : [] })));
    });
});

app.get('/api/feed/posts', (req, res) => {
    const { userId, hashtag } = req.query;
    let sql = `
        SELECT p.*, u.first_name, u.last_name, u.avatar,
        (SELECT COUNT(*) FROM likes WHERE post_id=p.id) as likes_count,
        ${userId ? `(SELECT COUNT(*) FROM likes WHERE post_id=p.id AND user_id=${parseInt(userId)})` : '0'} as is_liked,
        (SELECT GROUP_CONCAT(hashtag) FROM post_hashtags WHERE post_id=p.id) as hashtags
        FROM posts p JOIN users u ON p.user_id=u.id
    `;
    const params = [];
    if (hashtag) {
        sql += ` WHERE p.id IN (SELECT post_id FROM post_hashtags WHERE hashtag=?)`;
        params.push(hashtag);
    }
    sql += ` ORDER BY p.created_at DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({ ...r, hashtags: r.hashtags ? r.hashtags.split(',') : [] })));
    });
});

// Trending hashtags
app.get('/api/hashtags/trending', (req, res) => {
    db.all(
        `SELECT hashtag, COUNT(*) as count FROM post_hashtags GROUP BY hashtag ORDER BY count DESC LIMIT 10`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Toggle post like
app.post('/api/posts/:id/like', (req, res) => {
    const postId = req.params.id;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    db.get(`SELECT id FROM likes WHERE post_id=? AND user_id=?`, [postId, userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            db.run(`DELETE FROM likes WHERE id=?`, [row.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ liked: false });
            });
        } else {
            db.run(`INSERT INTO likes (post_id, user_id) VALUES (?,?)`, [postId, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                // Notify post author
                db.get(`SELECT p.user_id, u.first_name, u.last_name FROM posts p JOIN users u ON u.id=? WHERE p.id=?`, [userId, postId], (err2, data) => {
                    if (data && data.user_id != userId) {
                        createNotification(data.user_id, 'like', `${data.first_name} ${data.last_name} liked your post ❤️`, `profile.html?id=${data.user_id}`);
                    }
                });
                res.json({ liked: true });
            });
        }
    });
});

// Get comments for a post
app.get('/api/posts/:id/comments', (req, res) => {
    const { userId } = req.query;
    const sql = `
        SELECT c.*, u.first_name, u.last_name, u.avatar,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id=c.id) as likes_count,
        ${userId ? `(SELECT COUNT(*) FROM comment_likes WHERE comment_id=c.id AND user_id=${parseInt(userId)})` : '0'} as is_liked
        FROM comments c JOIN users u ON c.user_id=u.id
        WHERE c.post_id=? ORDER BY c.created_at ASC
    `;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create a comment
app.post('/api/posts/:id/comments', (req, res) => {
    const { userId, content } = req.body;
    if (!userId || !content) return res.status(400).json({ error: "User ID and content required" });

    db.run(`INSERT INTO comments (post_id, user_id, content) VALUES (?,?,?)`, [req.params.id, userId, content], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Notify post author
        db.get(`SELECT p.user_id, u.first_name, u.last_name FROM posts p JOIN users u ON u.id=? WHERE p.id=?`, [userId, req.params.id], (err2, data) => {
            if (data && data.user_id != userId) {
                createNotification(data.user_id, 'comment', `${data.first_name} ${data.last_name} commented on your post 💬`, `profile.html?id=${data.user_id}`);
            }
        });

        res.status(201).json({ message: "Comment added", commentId: this.lastID });
    });
});

// Toggle comment like
app.post('/api/comments/:id/like', (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    db.get(`SELECT id FROM comment_likes WHERE comment_id=? AND user_id=?`, [req.params.id, userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            db.run(`DELETE FROM comment_likes WHERE id=?`, [row.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ liked: false });
            });
        } else {
            db.run(`INSERT INTO comment_likes (comment_id, user_id) VALUES (?,?)`, [req.params.id, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ liked: true });
            });
        }
    });
});

// 404 Handler for undefined routes
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.status(404).sendFile(path.join(__dirname, '404.html'));
    } else {
        res.status(404).json({ error: "Endpoint Not Found", path: req.path });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ SkillSwap server running on http://localhost:${PORT}`);
});

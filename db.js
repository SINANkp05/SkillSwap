require('dotenv').config();
const { createClient } = require('@libsql/client');
const bcrypt = require('bcrypt');

// Connect to Turso using the variables from your .env file
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('Connected to the Turso database.');

// Initialize tables just like before
async function initDB() {
    try {
        await db.execute("PRAGMA foreign_keys = ON");
        
        // Users table
        await db.execute(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT,
            // ... the rest of your table columns
        )`);
        
        // Do this for all other tables...
        
        console.log("Database initialized on Turso!");
    } catch (err) {
        console.error("Error setting up database:", err);
    }
}

initDB();

module.exports = db;

function initDB() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT,
            last_name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            title TEXT,
            avatar TEXT,
            offers TEXT,
            needs TEXT,
            description TEXT,
            type TEXT,
            score INTEGER DEFAULT 0,
            portfolio_links TEXT DEFAULT '[]',
            profile_views INTEGER DEFAULT 0
        )`, (err) => { if (err) console.error('users table error:', err.message); });

        // Swaps table
        db.run(`CREATE TABLE IF NOT EXISTS swaps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requester_id INTEGER,
            receiver_id INTEGER,
            status TEXT DEFAULT 'pending',
            requester_completed INTEGER DEFAULT 0,
            receiver_completed INTEGER DEFAULT 0,
            points_awarded INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(requester_id) REFERENCES users(id),
            FOREIGN KEY(receiver_id) REFERENCES users(id)
        )`, (err) => { if (err) console.error('swaps table error:', err.message); });

        // Messages table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            swap_id INTEGER,
            sender_id INTEGER,
            text TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(swap_id) REFERENCES swaps(id),
            FOREIGN KEY(sender_id) REFERENCES users(id)
        )`, (err) => { if (err) console.error('messages table error:', err.message); });

        // Posts table
        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            content TEXT,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => { if (err) console.error('posts table error:', err.message); });

        // Likes table
        db.run(`CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            FOREIGN KEY(post_id) REFERENCES posts(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(post_id, user_id)
        )`, (err) => { if (err) console.error('likes table error:', err.message); });

        // Comments table
        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            user_id INTEGER,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(post_id) REFERENCES posts(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => { if (err) console.error('comments table error:', err.message); });

        // Comment Likes table
        db.run(`CREATE TABLE IF NOT EXISTS comment_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comment_id INTEGER,
            user_id INTEGER,
            FOREIGN KEY(comment_id) REFERENCES comments(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(comment_id, user_id)
        )`, (err) => { if (err) console.error('comment_likes table error:', err.message); });

        // Post Hashtags table
        db.run(`CREATE TABLE IF NOT EXISTS post_hashtags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            hashtag TEXT,
            FOREIGN KEY(post_id) REFERENCES posts(id)
        )`, (err) => { if (err) console.error('post_hashtags table error:', err.message); });

        // Notifications table
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            link TEXT,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => { if (err) console.error('notifications table error:', err.message); });

        // Ratings table
        db.run(`CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            swap_id INTEGER NOT NULL,
            rater_id INTEGER NOT NULL,
            ratee_id INTEGER NOT NULL,
            stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
            review TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(swap_id) REFERENCES swaps(id),
            FOREIGN KEY(rater_id) REFERENCES users(id),
            FOREIGN KEY(ratee_id) REFERENCES users(id),
            UNIQUE(swap_id, rater_id)
        )`, (err) => { if (err) console.error('ratings table error:', err.message); });

        // Add new columns to existing tables if they don't exist (safe migrations)
        db.run(`ALTER TABLE users ADD COLUMN portfolio_links TEXT DEFAULT '[]'`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN profile_views INTEGER DEFAULT 0`, () => {});

        // Seed after tables are ready
        setTimeout(seedDatabase, 500);
    });
}

async function seedDatabase() {
    db.get("SELECT count(*) as count FROM users", async (err, row) => {
        if (err) { console.error(err.message); return; }
        if (row.count === 0) {
            console.log('Seeding database with initial users...');
            const defaultPassword = await bcrypt.hash('password123', 10);

            const usersData = [
                {
                    first_name: "Arjun", last_name: "Sharma", email: "arjun@example.com",
                    title: "Senior Full Stack Developer", avatar: "https://ui-avatars.com/api/?name=Arjun+Sharma&background=45a29e&color=fff&size=150",
                    offers: JSON.stringify(["React & Node.js", "System Architecture"]), needs: JSON.stringify(["UI/UX Audit", "Pitch Deck Design"]),
                    description: "Building an open-source SaaS tool for Indian startups. I need a sharp designer to review my UI and give it the polish it deserves. Will happily help with any JavaScript or backend architecture in return.",
                    type: "needing-help", score: 45,
                    portfolio_links: JSON.stringify([{ label: "GitHub", url: "https://github.com" }, { label: "Portfolio", url: "https://example.com" }])
                },
                {
                    first_name: "Priya", last_name: "Patel", email: "priya@example.com",
                    title: "Product Designer", avatar: "https://ui-avatars.com/api/?name=Priya+Patel&background=06b6d4&color=fff&size=150",
                    offers: JSON.stringify(["Figma & Prototyping", "User Research"]), needs: JSON.stringify(["Flutter Dev", "Firebase Setup"]),
                    description: "I have a fully designed mobile app for daily habit tracking. Looking for a Flutter developer to partner with — I will design anything you need in exchange.",
                    type: "needing-help", score: 22,
                    portfolio_links: JSON.stringify([{ label: "Behance", url: "https://behance.net" }])
                },
                {
                    first_name: "Rahul", last_name: "Gupta", email: "rahul@example.com",
                    title: "Growth Marketer", avatar: "https://ui-avatars.com/api/?name=Rahul+Gupta&background=ec4899&color=fff&size=150",
                    offers: JSON.stringify(["SEO Strategy", "Google Ads", "Copywriting"]), needs: JSON.stringify(["Landing Page Dev", "Analytics Setup"]),
                    description: "Launching a new D2C brand focused on the Indian market. I have the full marketing playbook — need a developer to build fast landing pages and set up conversion tracking pixels correctly.",
                    type: "needing-help", score: 0,
                    portfolio_links: JSON.stringify([])
                },
                {
                    first_name: "Ananya", last_name: "Krishnan", email: "ananya@example.com",
                    title: "Python & Data Engineer", avatar: "https://ui-avatars.com/api/?name=Ananya+Krishnan&background=14b8a6&color=fff&size=150",
                    offers: JSON.stringify(["Data Scraping", "ML Model Building", "Python Automation"]), needs: JSON.stringify(["Career Mentorship", "Technical Content Writing"]),
                    description: "I can automate any workflow, scrape any data source, or build ML pipelines. Looking for an experienced technical blogger to review my articles and help me grow an audience.",
                    type: "offering-skills", score: 60,
                    portfolio_links: JSON.stringify([{ label: "Kaggle", url: "https://kaggle.com" }, { label: "LinkedIn", url: "https://linkedin.com" }])
                },
                {
                    first_name: "Vikram", last_name: "Singh", email: "vikram@example.com",
                    title: "Video Editor & Motion Designer", avatar: "https://ui-avatars.com/api/?name=Vikram+Singh&background=f59e0b&color=fff&size=150",
                    offers: JSON.stringify(["Premiere Pro Editing", "After Effects", "Motion Graphics"]), needs: JSON.stringify(["React Native Dev", "Play Store Publishing"]),
                    description: "I create high-quality motion graphics and promo reels for brands. Need someone to help me port a portfolio idea into a React Native app.",
                    type: "offering-skills", score: 30,
                    portfolio_links: JSON.stringify([{ label: "YouTube", url: "https://youtube.com" }, { label: "Dribbble", url: "https://dribbble.com" }])
                },
                {
                    first_name: "Kavya", last_name: "Reddy", email: "kavya@example.com",
                    title: "Startup Legal Consultant", avatar: "https://ui-avatars.com/api/?name=Kavya+Reddy&background=22c55e&color=fff&size=150",
                    offers: JSON.stringify(["Contract Drafting", "Company Incorporation", "Legal Strategy"]), needs: JSON.stringify(["WordPress Fixes", "Website Performance"]),
                    description: "I am a practicing advocate specializing in startup law and IP. My firm's website is painfully slow. I will draft contracts or privacy policies in exchange for help fixing it.",
                    type: "offering-skills", score: 85,
                    portfolio_links: JSON.stringify([{ label: "LinkedIn", url: "https://linkedin.com" }])
                }
            ];

            const stmt = db.prepare(`INSERT INTO users (first_name, last_name, email, password, title, avatar, offers, needs, description, type, score, portfolio_links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            usersData.forEach(u => {
                stmt.run(u.first_name, u.last_name, u.email, defaultPassword, u.title, u.avatar, u.offers, u.needs, u.description, u.type, u.score || 0, u.portfolio_links || '[]');
            });
            stmt.finalize();
            console.log('Database seeded automatically.');
        }
    });
}

module.exports = db;

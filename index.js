require("./settings.js");
require('dotenv').config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@skyzopedia/baileys-mod");
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default; // ✅ WAJIB
const socketIO = require('socket.io');
const http = require('http');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const rimraf = require('rimraf');
const bcrypt = require('bcryptjs');
const qrcode = require('qrcode');
const crypto = require('crypto');
const multer = require('multer');
const { authenticator } = require('otplib');
const AdmZip = require('adm-zip');
const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

const User = require('./models/user');
const Transaction = require('./models/transaction');
const Setting = require('./models/setting');
const Project = require('./models/project');
const Post = require('./models/post');
const Tutorial = require('./models/tutorial');
const Ticket = require('./models/ticket');
const Changelog = require('./models/changelog');
const { serialize } = require("./lib/serialize.js");

process.on('uncaughtException', (err) => console.log('Caught exception:', err.message));
process.on('unhandledRejection', (reason) => console.log('Unhandled Rejection:', reason));

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = 8080;
const MONGO_URI = 'mongodb+srv://maverickuniverse405:1m8MIgmKfK2QwBNe@cluster0.il8d4jx.mongodb.net/digi?appName=Cluster0';
const PAKASIR_SLUG = 'wanzofc';


const PROJECT_DIR = path.join(__dirname, 'projects');
if (!fs.existsSync(PROJECT_DIR)) fs.mkdirSync(PROJECT_DIR);
const UPLOAD_DIR = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

global.groupMetadataCache = new Map();
const terminals = {};
const activeConnections = new Map();
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

app.set('trust proxy', 1);

function getDirSize(dirPath) {
    let size = 0;
    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (let i = 0; i < files.length; i++) {
            const filePath = path.join(dirPath, files[i]);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                size += getDirSize(filePath);
            } else {
                size += stats.size;
            }
        }
    }
    return size;
}

async function getNextAvailablePort(startPort = 30001) {
    let port = startPort;
    while (port < 60000) {
        const project = await Project.findOne({ port: port });
        if (!project) return port;
        port++;
    }
    return null;
}

async function createSubdomain(subdomain) {
    try {
        await axios.post(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
            type: 'A', name: subdomain, content: VPS_IP_ADDRESS, ttl: 1, proxied: true
        }, {
            headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }
        });
        return true;
    } catch (error) {
        return false;
    }
}

app.use(async (req, res, next) => {
    const host = req.headers.host;
    if (!host) return next();
    if (host === APP_DOMAIN || host === `www.${APP_DOMAIN}` || host === `dash.${APP_DOMAIN}`) {
        return next();
    }
    const subdomain = host.replace(`.${APP_DOMAIN}`, '');
    const project = await Project.findOne({ subdomain: subdomain, projectType: 'web' });

    if (project && project.port) {
        const proxy = createProxyMiddleware({
            target: `http://localhost:${project.port}`,
            changeOrigin: true,
            ws: true,
            logLevel: 'error',
            onError: (err, req, res) => {
                res.writeHead(502, { 'Content-Type': 'text/html' });
                res.end(`<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;"><h1>Server Not Running</h1><p>Project <strong>${subdomain}</strong> is currently stopped.</p><p>Please start it from your dashboard console.</p></body></html>`);
            }
        });
        return proxy(req, res, next);
    }
    next();
});

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'fiona-secret-key-super-secure-random',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    domain: '.wanzofc.site'
  }
}));
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + path.extname(file.originalname))
});
const upload = multer({ storage });

const startBaileys = async (userId, sessionId, socketToEmit = null, phoneNumber = null) => {
    const sessionPath = path.join(__dirname, 'sessions', `${userId}_${sessionId}`);
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const user = await User.findById(userId);
    if (!user) return;
    const sessionData = user.sessions.find(s => s.sessionId === sessionId);
    const sessionConfig = sessionData ? sessionData.config : user.defaultConfig;

    const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const fio = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        browser: Browsers.iOS("Safari"),
        getMessage: async (key) => {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg.message || undefined;
            }
            return { conversation: "Sys" };
        },
    });

    fio.sessionConfig = sessionConfig;
    fio.customCode = sessionData ? sessionData.customCode : '';
    store.bind(fio.ev);

    if (phoneNumber && !fio.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await fio.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                if(socketToEmit) socketToEmit.emit('pairing-code', { sessionId, code });
            } catch (err) {}
        }, 3000);
    }

    fio.ev.on("creds.update", saveCreds);

    fio.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            await User.findOneAndUpdate({ _id: userId, "sessions.sessionId": sessionId }, { "$set": { "sessions.$.status": "connected", "sessions.$.phoneNumber": fio.user.id.split(':')[0] } });
            io.emit('connection-status', { sessionId, status: 'connected' });
        } else if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (fio.isManualClose) return;

            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => startBaileys(userId, sessionId, socketToEmit), 5000);
            } else {
                await User.findOneAndUpdate({ _id: userId, "sessions.sessionId": sessionId }, { "$set": { "sessions.$.status": "disconnected" } });
                activeConnections.delete(`${userId}_${sessionId}`);
                io.emit('connection-status', { sessionId, status: 'disconnected' });
            }
        }
    });

    fio.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === "status@broadcast") return;
        try {
            const handler = require('./message.js');
            await handler(fio, await serialize(fio, msg, store));
        } catch (e) {
            console.error("Error in message handler:", e);
        }
    });

    activeConnections.set(`${userId}_${sessionId}`, fio);
};

const checkMaintenance = async (req, res, next) => {
    const settings = await Setting.findOne() || { maintenance: false };
    const userId = req.session.originalUserId || req.session.userId;
    const user = userId ? await User.findById(userId) : null;
    if (settings.maintenance && (!user || user.role !== 'admin')) return res.render('maintenance');
    next();
};

const requireAuth = (req, res, next) => {
    if (req.session.originalUserId) return next();
    if (!req.session.userId) return res.redirect('/login');
    next();
};

const requireAdmin = async (req, res, next) => {
    const userId = req.session.originalUserId || req.session.userId;
    if (!userId) return res.redirect('/login');
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') return res.status(403).render('403');
    next();
};

app.use(async (req, res, next) => {
    if (req.session.userId) {
        res.locals.user = await User.findById(req.session.userId);
        res.locals.isImpersonating = !!req.session.originalUserId;
    } else {
        res.locals.user = null;
        res.locals.isImpersonating = false;
    }
    next();
});

app.get('/', checkMaintenance, (req, res) => {
    if (req.headers.host === `dash.${APP_DOMAIN}`) return res.redirect('/dashboard');
    res.render('landing');
});

app.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('login', { error: null, oldData: {} });
});

app.get('/register', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.render('register', { error: null, oldData: {} });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        res.clearCookie('connect.sid', {
            domain: '.wanzofc.site',
            secure: true,
            httpOnly: true,
            sameSite: 'lax'
        });
        res.redirect('/login');
    });
});

app.get('/auth/spotify', (req, res) => {
    const scope = 'user-read-email user-read-private';
    res.redirect(`https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}`);
});

app.get('/auth/spotify/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login');
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', SPOTIFY_REDIRECT_URI);
        const tokenRes = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const token = tokenRes.data.access_token;
        const userRes = await axios.get('https://api.spotify.com/v1/me', { headers: { 'Authorization': 'Bearer ' + token } });
        const profile = userRes.data;
        let user = await User.findOne({ $or: [{ email: profile.email }, { spotifyId: profile.id }] });
        if (user) {
            if (!user.spotifyId) user.spotifyId = profile.id;
            if (!user.referralCode) user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            await user.save();
        } else {
            const randomPass = crypto.randomBytes(16).toString('hex');
            user = await User.create({
                username: (profile.display_name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000)).substring(0, 30),
                fullname: profile.display_name,
                email: profile.email,
                password: await bcrypt.hash(randomPass, 10),
                spotifyId: profile.id,
                profilePic: profile.images?.[0]?.url || null,
                defaultConfig: { ownerName: profile.display_name }
            });
        }
        req.session.userId = user._id;
        req.session.role = user.role;
        req.session.save(() => res.redirect('/dashboard'));
    } catch (e) {
        res.redirect('/login');
    }
});

app.get('/auth/github', (req, res) => {
    res.redirect(`https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user:email`);
});

app.get('/auth/github/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login');
    try {
        const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code
        }, { headers: { Accept: 'application/json' } });
        const token = tokenRes.data.access_token;
        const userRes = await axios.get('https://api.github.com/user', { headers: { Authorization: `token ${token}` } });
        let email = userRes.data.email;
        if (!email) {
            const emailRes = await axios.get('https://api.github.com/user/emails', { headers: { Authorization: `token ${token}` } });
            email = emailRes.data.find(e => e.primary && e.verified)?.email || emailRes.data[0]?.email;
        }
        let user = await User.findOne({ $or: [{ email }, { githubId: String(userRes.data.id) }] });
        if (user) {
            if (!user.githubId) user.githubId = String(userRes.data.id);
            if (!user.referralCode) user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            await user.save();
        } else {
            const randomPass = crypto.randomBytes(16).toString('hex');
            user = await User.create({
                username: userRes.data.login.substring(0, 30),
                fullname: userRes.data.name || userRes.data.login,
                email,
                password: await bcrypt.hash(randomPass, 10),
                githubId: String(userRes.data.id),
                profilePic: userRes.data.avatar_url,
                defaultConfig: { ownerName: userRes.data.name || userRes.data.login }
            });
        }
        req.session.userId = user._id;
        req.session.role = user.role;
        req.session.save(() => res.redirect('/dashboard'));
    } catch (e) {
        res.redirect('/login');
    }
});

app.get('/auth/google', (req, res) => {
    const redirectUri = encodeURIComponent(GOOGLE_REDIRECT_URI);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login');
    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: GOOGLE_REDIRECT_URI
        });
        const { access_token } = tokenRes.data;
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${access_token}` } });
        const profile = userRes.data;
        let user = await User.findOne({ $or: [{ email: profile.email }, { googleId: profile.id }] });
        if (user) {
            if (!user.googleId) user.googleId = profile.id;
            if (!user.referralCode) user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            await user.save();
        } else {
            const randomPass = crypto.randomBytes(16).toString('hex');
            user = await User.create({
                username: (profile.name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000)).substring(0, 30),
                fullname: profile.name,
                email: profile.email,
                password: await bcrypt.hash(randomPass, 10),
                googleId: profile.id,
                profilePic: profile.picture,
                defaultConfig: { ownerName: profile.name }
            });
        }
        req.session.userId = user._id;
        req.session.role = user.role;
        req.session.save(() => res.redirect('/dashboard'));
    } catch (e) {
        res.redirect('/login');
    }
});

app.post('/api/check-username', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ available: false });
    const user = await User.findOne({ username });
    res.json({ available: !user });
});

app.post('/api/check-email', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.json({ available: false });
    const user = await User.findOne({ email });
    res.json({ available: !user });
});

app.post('/register', async (req, res) => {
    const { username, fullname, whatsappNumber, email, password, referralCode } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let referredByUser = null;
    if (referralCode) {
        referredByUser = await User.findOne({ referralCode: referralCode.toUpperCase() });
        if (referredByUser && referredByUser.referrals.some(ref => ref.ipAddress === ipAddress)) {
            return res.render('register', { error: "Anda tidak dapat menggunakan kode referral dari IP yang sama.", oldData: req.body });
        }
    }
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        return res.render('register', { error: "Username atau email sudah terdaftar.", oldData: req.body });
    }
    try {
        const newUser = await User.create({
            username,
            fullname,
            whatsappNumber,
            email,
            password: await bcrypt.hash(password, 10),
            referredBy: referredByUser ? referredByUser._id : null,
            defaultConfig: { ownerName: fullname, ownerNumber: whatsappNumber }
        });
        if (referredByUser) {
            referredByUser.referrals.push({ userId: newUser._id, ipAddress });
            if (referredByUser.referrals.length % 5 === 0) {
                referredByUser.serverSlots += 1;
            }
            await referredByUser.save();
        }
        res.redirect('/login');
    } catch (e) {
        res.render('register', { error: "Terjadi kesalahan sistem.", oldData: req.body });
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user && await bcrypt.compare(req.body.password, user.password)) {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            user.loginHistory.unshift({ ip, userAgent: req.headers['user-agent'] });
            if (user.loginHistory.length > 20) user.loginHistory.pop();
            if (!user.referralCode) user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            await user.save();
            if (req.body.loginAs === 'admin' && user.role !== 'admin') {
                return res.render('login', { error: 'Access Denied', oldData: req.body });
            }
            if (user.twoFactorEnabled) {
                req.session.tempUserId = user._id;
                req.session.save(() => res.render('2fa-verify', { error: null }));
                return;
            }
            req.session.userId = user._id;
            req.session.role = user.role;
            if (req.body.remember) {
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
            }
            req.session.save(() => {
                const target = user.role === 'admin' ? '/admin/dashboard' : '/dashboard';
                res.redirect(target);
            });
        } else {
            res.render('login', { error: 'Email atau password salah', oldData: req.body });
        }
    } catch (e) {
        res.redirect('/login');
    }
});

app.post('/login-sseo', async (req, res) => {
    try {
        const user = await User.findOne({ sseoToken: req.body.sseoToken, sseoActive: true });
        if (user) {
            req.session.userId = user._id;
            req.session.role = user.role;
            req.session.save(() => res.redirect('/dashboard'));
        } else {
            res.render('login', { error: 'Token SSEO tidak valid atau tidak aktif', oldData: {} });
        }
    } catch (e) {
        res.redirect('/login');
    }
});

app.post('/login/verify-2fa', async (req, res) => {
    if (!req.session.tempUserId) return res.redirect('/login');
    const user = await User.findById(req.session.tempUserId);
    if (authenticator.check(req.body.token, user.twoFactorSecret)) {
        req.session.userId = user._id;
        req.session.role = user.role;
        delete req.session.tempUserId;
        req.session.save(() => res.redirect('/dashboard'));
    } else {
        res.render('2fa-verify', { error: 'Invalid OTP' });
    }
});

// ==========================================
// TAMBAHAN KHUSUS UNTUK APLIKASI ANDROID
// ==========================================

// 1. API Login Android
// ============================================================
// API ENDPOINTS KHUSUS APLIKASI ANDROID (NATIVE JAVA)
// ============================================================

// 1. API LOGIN ANDROID
app.post('/api/android/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Cari user berdasarkan email
        const user = await User.findOne({ email: email });
        
        if (!user) {
            return res.json({ success: false, message: "Email tidak terdaftar" });
        }

        // Cek password
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
            return res.json({
                success: true,
                message: "Login Berhasil",
                data: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    isPremium: user.isPremium || false
                }
            });
        } else {
            return res.json({ success: false, message: "Password salah" });
        }
    } catch (e) {
        console.error("API Login Error:", e);
        return res.json({ success: false, message: "Server Error" });
    }
});

// 2. API REGISTER ANDROID
app.post('/api/android/register', async (req, res) => {
    try {
        const { username, email, password, fullname, whatsappNumber } = req.body;

        // Cek apakah user sudah ada
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.json({ success: false, message: "Username atau Email sudah digunakan" });
        }

        // Generate kode referral
        const refCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        // Buat user baru
        await User.create({
            username,
            fullname,
            whatsappNumber,
            email,
            password: await bcrypt.hash(password, 10),
            referralCode: refCode,
            defaultConfig: { ownerName: fullname, ownerNumber: whatsappNumber }
        });

        return res.json({ success: true, message: "Registrasi Berhasil" });

    } catch (e) {
        console.error("API Register Error:", e);
        return res.json({ success: false, message: "Gagal Mendaftar: " + e.message });
    }
});
app.post('/api/android/stats', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const totalSessions = user.sessions ? user.sessions.length : 0;
        
        const activeSessions = user.sessions ? user.sessions.filter(s => s.status === 'connected').length : 0;
        const limitSessions = user.maxSessions || 2;

        res.json({
            success: true,
            message: "Data Fetched",
            data: {
                username: user.username,
                totalBot: totalSessions,
                activeBot: activeSessions,
                limitBot: limitSessions,   
                isPremium: user.isPremium || false
            }
        });
    } catch (e) {
        console.error("API Stats Error:", e);
        res.json({ success: false, message: "Error fetching data" });
    }
});



app.post('/session/restart', requireAuth, async (req, res) => {
    const { sessionId } = req.body;
    const connId = `${req.session.userId}_${sessionId}`;
    const oldSock = activeConnections.get(connId);
    if (oldSock) {
        try {
            oldSock.isManualClose = true;
            oldSock.ev.removeAllListeners('connection.update');
            oldSock.end();
            activeConnections.delete(connId);
        } catch (e) {}
    }
    await startBaileys(req.session.userId, sessionId, io);
    res.redirect('/dashboard?status=restarted');
});

app.post('/session/update-config', requireAuth, async (req, res) => {
    const delayPush = parseInt(req.body.delayPush) || 3000;
    const delayJpm = parseInt(req.body.delayJpm) || 4000;
    const updateData = {
        "sessions.$.config.botname": req.body.botname,
        "sessions.$.config.ownerName": req.body.ownerName,
        "sessions.$.config.ownerNumber": req.body.ownerNumber,
        "sessions.$.config.telegram": req.body.telegram,
        "sessions.$.config.audioUrl": req.body.audioUrl,
        "sessions.$.config.ppobApiKey": req.body.ppobApiKey,
        "sessions.$.config.delayPush": delayPush,
        "sessions.$.config.delayJpm": delayJpm,
        "sessions.$.config.payName": req.body.payName,
        "sessions.$.config.payDana": req.body.payDana,
        "sessions.$.config.payGopay": req.body.payGopay,
        "sessions.$.config.payOvo": req.body.payOvo,
        "sessions.$.config.payQris": req.body.payQris
    };
    await User.updateOne({ _id: req.session.userId, "sessions.sessionId": req.body.sessionId }, { $set: updateData });
    res.redirect('/dashboard');
});

app.post('/session/save-code', requireAuth, async (req, res) => {
    await User.updateOne({ _id: req.session.userId, "sessions.sessionId": req.body.sessionId }, { $set: { "sessions.$.customCode": req.body.customCode } });
    res.redirect('/dashboard');
});

app.get('/dashboard', requireAuth, checkMaintenance, async (req, res) => {
    const userId = req.session.userId;
    const user = await User.findById(userId);
    const settings = await Setting.findOne() || {};
    const projects = await Project.find({ owner: userId });
    res.render('dashboard', { user, onboarding: settings.onboarding || [], projects, flashSale: settings.flashSale, page: 'dashboard', APP_DOMAIN });
});

app.get('/profile', requireAuth, checkMaintenance, async (req, res) => {
    const user = await User.findById(req.session.userId).populate('referrals.userId', 'username createdAt');
    const projects = await Project.find({ owner: req.session.userId });
    res.render('profile', { user, projects, page: 'profile' });
});

app.get('/news', requireAuth, checkMaintenance, async (req, res) => {
    const news = await Post.find({ type: 'news' }).sort({ createdAt: -1 });
    res.render('news', { news, page: 'news' });
});

app.get('/news/detail/:id', requireAuth, checkMaintenance, async (req, res) => {
    try {
        const post = await Post.findOne({ _id: req.params.id, type: 'news' });
        if (!post) return res.redirect('/news');
        res.render('detail-post', { post, page: 'news' });
    } catch (e) { res.redirect('/news'); }
});

app.get('/tutorial', requireAuth, checkMaintenance, async (req, res) => {
    const tutorials = await Tutorial.find().sort({ createdAt: -1 });
    res.render('tutorial', { tutorials, page: 'tutorial' });
});

app.get('/settings', requireAuth, checkMaintenance, async (req,res) => {
    res.render('settings', { page: 'settings' });
});

app.get('/list-ticket', requireAuth, checkMaintenance, async (req, res) => {
    const tickets = await Ticket.find({ userId: req.session.userId }).sort({ createdAt: -1 });
    res.render('list-ticket', { tickets, page: 'tickets' });
});

app.get('/ticket/detail/:id', requireAuth, checkMaintenance, async (req, res) => {
    try {
        const ticket = await Ticket.findOne({ _id: req.params.id, userId: req.session.userId });
        if (!ticket) return res.redirect('/list-ticket');
        res.render('ticket-detail', { ticket, page: 'tickets' });
    } catch (e) { res.redirect('/list-ticket'); }
});

app.post('/ticket/create', requireAuth, async (req, res) => {
    await Ticket.create({
        userId: req.session.userId,
        subject: req.body.subject,
        message: req.body.message,
        status: 'open'
    });
    res.redirect('/list-ticket');
});

app.post('/ticket/reply', requireAuth, async (req, res) => {
    const ticket = await Ticket.findOne({ _id: req.body.id, userId: req.session.userId });
    if(ticket) {
        ticket.message += `\n\n[User]: ${req.body.message}`;
        ticket.status = 'open'; 
        await ticket.save();
    }
    res.redirect(`/ticket/detail/${req.body.id}`);
});

app.post('/project/create', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const { name, description, projectType } = req.body;
    const count = await Project.countDocuments({ owner: user._id });
    if (count >= user.serverSlots) return res.redirect('/pricing?error=Limit');
    const pid = uuidv4();
    const target = path.join(PROJECT_DIR, pid);
    fs.mkdirSync(target, { recursive: true });
    let port = null, subdomain = null;
    if (projectType === 'web') {
        port = await getNextAvailablePort();
        if (!port) { rimraf.sync(target); return res.redirect('/dashboard?error=NoPorts'); }
        subdomain = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
        const success = await createSubdomain(subdomain);
        if (!success) { rimraf.sync(target); return res.redirect('/dashboard?error=SubdomainFail'); }
    }
    await Project.create({ uuid: pid, owner: user._id, name, description, projectType, port, subdomain });
    res.redirect('/dashboard');
});

app.get('/user/project/:uuid', requireAuth, checkMaintenance, async (req, res) => {
    const project = await Project.findOne({ uuid: req.params.uuid, owner: req.session.userId });
    if (!project) return res.status(404).render('404');
    res.render('project', { project });
});

app.get('/user/project/:uuid/files', requireAuth, checkMaintenance, async (req, res) => {
    const project = await Project.findOne({ uuid: req.params.uuid, owner: req.session.userId });
    if (!project) return res.status(404).render('404');
    const reqPath = req.query.path ? path.normalize(req.query.path).replace(/^(\.\.[\/\\])+/, '') : '';
    const targetDir = path.join(PROJECT_DIR, project.uuid, reqPath);
    if (!targetDir.startsWith(path.join(PROJECT_DIR, project.uuid))) return res.redirect(`/user/project/${project.uuid}/files`);

    let files = [];
    try {
        if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
            files = fs.readdirSync(targetDir).map(f => {
                const s = fs.statSync(path.join(targetDir, f));
                return { name: f, isDir: s.isDirectory(), size: s.isDirectory() ? '-' : (s.size / 1024).toFixed(2) + ' KB' };
            }).sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
        }
    } catch {}
    res.render('files', { project, files, currentPath: reqPath });
});

app.post('/project/:uuid/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const project = await Project.findOne({ uuid: req.params.uuid, owner: req.session.userId });
        if (!project) return res.status(404).send("Project not found");

        const reqPath = req.query.path ? path.normalize(req.query.path).replace(/^(\.\.[\/\\])+/, '') : '';
        const targetRoot = path.join(PROJECT_DIR, project.uuid);
        const targetDir = path.join(targetRoot, reqPath);

        if (!fs.existsSync(targetDir)) return res.status(404).send("Directory not found");

        const currentSize = getDirSize(targetRoot);
        if (currentSize + req.file.size > 500 * 1024 * 1024) {
            fs.unlinkSync(req.file.path);
            return res.send('Limit 500MB');
        }

        const dest = path.join(targetDir, req.file.originalname);
        fs.renameSync(req.file.path, dest);

        if (path.extname(dest) === '.zip') {
            try {
                const zip = new AdmZip(dest);
                zip.extractAllTo(targetDir, true);
                fs.unlinkSync(dest);
            } catch (err) {
                console.error("Zip extract error:", err);
            }
        }
        res.redirect(`/user/project/${project.uuid}/files?path=${reqPath}`);
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).send("Upload failed");
    }
});

app.post('/project/:uuid/delete', requireAuth, async (req, res) => {
    const p = await Project.findOne({ uuid: req.params.uuid, owner: req.session.userId });
    if (p) {
        if(terminals[p.uuid]) { terminals[p.uuid].kill(); delete terminals[p.uuid]; }
        rimraf.sync(path.join(PROJECT_DIR, p.uuid));
        await Project.deleteOne({ _id: p._id });
    }
    res.redirect('/dashboard');
});

app.post('/api/project/:uuid/save', requireAuth, async (req, res) => {
    try {
        const target = path.join(PROJECT_DIR, req.params.uuid, req.body.path);
        if (!target.startsWith(path.join(PROJECT_DIR, req.params.uuid))) return res.status(403).send("Denied");
        fs.writeFileSync(target, req.body.content); 
        res.send("Saved");
    } catch(e) { res.status(500).send("Error"); }
});

app.post('/api/project/:uuid/read', requireAuth, async (req, res) => {
    try {
        const target = path.join(PROJECT_DIR, req.params.uuid, req.body.path);
        if (!target.startsWith(path.join(PROJECT_DIR, req.params.uuid))) return res.status(403).send("Denied");
        res.send(fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '');
    } catch(e) { res.status(500).send("Error"); }
});

app.post('/api/project/:uuid/delete', requireAuth, async (req, res) => {
    const root = path.join(PROJECT_DIR, req.params.uuid);
    const list = Array.isArray(req.body.files) ? req.body.files : [req.body.path];
    list.forEach(f => {
        const full = path.join(root, path.normalize(f).replace(/^(\.\.[\/\\])+/, ''));
        if(full.startsWith(root)) rimraf.sync(full);
    });
    res.redirect('back');
});

app.post('/api/project/:uuid/new-file', requireAuth, async(req, res) => {
    const target = path.join(PROJECT_DIR, req.params.uuid, req.query.path, req.body.filename);
    if (!target.startsWith(path.join(PROJECT_DIR, req.params.uuid))) return res.status(403).send("Denied");
    fs.writeFileSync(target, '');
    res.redirect('back');
});

app.post('/api/project/:uuid/new-folder', requireAuth, async(req, res) => {
    const target = path.join(PROJECT_DIR, req.params.uuid, req.query.path, req.body.foldername);
    if (!target.startsWith(path.join(PROJECT_DIR, req.params.uuid))) return res.status(403).send("Denied");
    fs.mkdirSync(target, { recursive: true });
    res.redirect('back');
});

app.post('/api/check-whatsapp', requireAuth, async (req, res) => {
    const { number } = req.body;
    if (!number) return res.json({ exists: false });
    const conn = Array.from(activeConnections.values())[0];
    if (!conn) return res.json({ exists: false, error: "No active bot session." });
    try {
        const [result] = await conn.onWhatsApp(number + '@s.whatsapp.net');
        res.json({ exists: !!result?.exists, jid: result?.jid });
    } catch (e) { res.json({ exists: false, error: "Failed to check." }); }
});

app.post('/profile/update', requireAuth, upload.single('profilePic'), async (req, res) => {
    const upd = { fullname: req.body.fullname, username: req.body.username };
    if (req.file) upd.profilePic = '/uploads/' + req.file.filename;
    await User.findByIdAndUpdate(req.session.userId, upd); res.redirect('/profile');
});

app.post('/settings/sseo/generate', requireAuth, async (req, res) => {
    const t = "FIONA-" + crypto.randomBytes(4).toString('hex').toUpperCase();
    await User.findByIdAndUpdate(req.session.userId, { sseoToken: t, sseoActive: true }); res.json({ token: t });
});

app.post('/settings/sseo/disable', requireAuth, async (req, res) => {
    await User.findByIdAndUpdate(req.session.userId, { sseoActive: false }); res.json({ success: true });
});

app.post('/settings/2fa/generate', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const secret = authenticator.generateSecret();
    req.session.tempSecret = secret;
    qrcode.toDataURL(authenticator.keyuri(user.email, 'FionaBot', secret), (e,u) => res.json({ qrCode: u, secret }));
});

app.post('/settings/2fa/enable', requireAuth, async (req, res) => {
    if (authenticator.verify({ token: req.body.token, secret: req.session.tempSecret })) {
        await User.findByIdAndUpdate(req.session.userId, { twoFactorSecret: req.session.tempSecret, twoFactorEnabled: true });
        res.json({ success: true });
    } else res.json({ success: false });
});

app.post('/settings/2fa/disable', requireAuth, async (req, res) => {
    await User.findByIdAndUpdate(req.session.userId, { twoFactorSecret: null, twoFactorEnabled: false }); res.json({ success: true });
});

app.post('/settings/change-password', requireAuth, async (req, res) => {
    if (req.body.newPassword !== req.body.confirmPassword) return res.redirect('/settings');
    const user = await User.findById(req.session.userId);
    if (!await bcrypt.compare(req.body.currentPassword, user.password)) return res.redirect('/settings');
    await User.findByIdAndUpdate(req.session.userId, { password: await bcrypt.hash(req.body.newPassword, 10) });
    res.redirect('/settings');
});

app.post('/settings/notifications', requireAuth, async (req, res) => {
    await User.findByIdAndUpdate(req.session.userId, { enableNotif: req.body.enableNotif === 'on' });
    res.redirect('/settings');
});

app.get('/admin/dashboard', requireAdmin, async (req, res) => {
    const allUsers = await User.find({}, 'username email isPremium sessions role');
    const tutorials = await Tutorial.find().sort({ createdAt: -1 });
    const tickets = await Ticket.find({ status: 'open' }).populate('userId', 'username');
    const stats = { totalUsers: allUsers.length, totalSessions: 0, activeSessions: 0 };
    allUsers.forEach(u => { stats.totalSessions += u.sessions.length; u.sessions.forEach(s => { if(s.status === 'connected') stats.activeSessions++; }); });
    const settings = await Setting.findOne() || await Setting.create({ maintenance: false });
    res.render('admin-dashboard', { user: await User.findById(req.session.userId), tutorials, stats, allUsers, settings, tickets });
});

app.post('/admin/maintenance', requireAdmin, async (req, res) => {
    await Setting.findOneAndUpdate({}, { maintenance: req.body.maintenance === 'on' }, { upsert: true }); res.redirect('/admin/dashboard');
});

app.post('/admin/flashsale', requireAdmin, async (req, res) => {
    const update = {
        active: req.body.active === 'on',
        endTime: req.body.endTime,
        title: req.body.title,
        description: req.body.description,
        price: parseInt(req.body.price),
        rewardSlots: parseInt(req.body.rewardSlots),
        isFree: req.body.isFree === 'on'
    };
    await Setting.findOneAndUpdate({}, { flashSale: update }, { upsert: true });
    res.redirect('/admin/dashboard');
});

app.post('/admin/onboarding/add', requireAdmin, upload.single('image'), async (req, res) => {
    await Setting.findOneAndUpdate({}, { $push: { onboarding: { title: req.body.title, message: req.body.message, imageUrl: req.file ? '/uploads/' + req.file.filename : '' } } }, { upsert: true }); res.redirect('/admin/dashboard');
});

app.post('/admin/onboarding/delete', requireAdmin, async (req, res) => {
    await Setting.findOneAndUpdate({}, { $pull: { onboarding: { _id: req.body.id } } }); res.redirect('/admin/dashboard');
});

app.post('/admin/post/add', requireAdmin, upload.single('image'), async (req, res) => {
    await Post.create({
        title: req.body.title,
        content: req.body.content,
        tag: req.body.tag,
        type: req.body.type,
        author: req.body.author,
        image: req.file ? '/uploads/' + req.file.filename : ''
    });
    res.redirect('/admin/dashboard');
});

app.post('/admin/post/delete', requireAdmin, async (req, res) => {
    await Post.findByIdAndDelete(req.body.id);
    res.redirect('/admin/dashboard');
});

app.post('/admin/ticket/reply', requireAdmin, async (req, res) => {
    const ticket = await Ticket.findById(req.body.id);
    if(ticket) {
        ticket.reply = req.body.reply;
        ticket.status = 'answered';
        ticket.message += `\n\n[Admin]: ${req.body.reply}`;
        await ticket.save();
    }
    res.redirect('/admin/dashboard');
});

app.post('/admin/tutorial/add', requireAdmin, async (req, res) => {
    const steps = req.body.steps.split('\n').filter(s => s.trim() !== '');
    await Tutorial.create({
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        youtubeUrl: req.body.youtubeUrl,
        thumbnail: req.body.thumbnail,
        steps: steps
    });
    res.redirect('/admin/dashboard');
});

app.post('/admin/tutorial/delete', requireAdmin, async (req, res) => {
    await Tutorial.findByIdAndDelete(req.body.id); res.redirect('/admin/dashboard');
});

app.post('/admin/changelog/add', requireAdmin, async(req, res) => {
    await Changelog.create(req.body);
    res.redirect('/admin/dashboard');
});

app.get('/admin/user/edit/:id', requireAdmin, async (req, res) => {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.redirect('/admin/dashboard');
    res.render('admin-user-edit', { targetUser });
});

app.post('/admin/user/update/:id', requireAdmin, async (req, res) => {
    const { role, isPremium, serverSlots, maxSessions } = req.body;
    await User.findByIdAndUpdate(req.params.id, { role, isPremium: isPremium === 'true', serverSlots: Number(serverSlots), maxSessions: Number(maxSessions) });
    res.redirect('/admin/dashboard');
});

app.get('/admin/impersonate/:userId', requireAdmin, async (req, res) => {
    const targetUser = await User.findById(req.params.userId);
    if (targetUser && req.session.userId) {
        req.session.originalUserId = req.session.userId;
        req.session.userId = targetUser._id;
        req.session.role = targetUser.role;
        req.session.save(() => res.redirect('/dashboard'));
    } else {
        res.redirect('/dashboard');
    }
});

app.get('/admin/revert', (req, res) => {
    if (req.session.originalUserId) {
        req.session.userId = req.session.originalUserId;
        req.session.role = 'admin';
        delete req.session.originalUserId;
        req.session.save(() => res.redirect('/admin/dashboard'));
    } else {
        res.redirect('/admin/dashboard');
    }
});

app.post('/payment/upgrade', requireAuth, async (req, res) => {
    const oid = 'UPG-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    await Transaction.create({ orderId: oid, userId: req.session.userId, type: 'upgrade', amount: 5000 });
    res.redirect(`https://app.pakasir.com/pay/${PAKASIR_SLUG}/5000?order_id=${oid}`);
});

app.post('/payment/donate', requireAuth, async (req, res) => {
    const amount = parseInt(req.body.amount); if (amount < 1000) return res.redirect('/dashboard');
    const oid = 'DON-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    await Transaction.create({ orderId: oid, userId: req.session.userId, type: 'donation', amount: amount });
    res.redirect(`https://app.pakasir.com/pay/${PAKASIR_SLUG}/${amount}?order_id=${oid}`);
});

app.post('/payment/buy-plan', requireAuth, async (req, res) => {
    const { amount, slots, rewardType } = req.body;
    const oid = 'PLAN-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const type = rewardType === 'session' ? 'bot_slot' : 'server_slot';
    
    await Transaction.create({ 
        orderId: oid, 
        userId: req.session.userId, 
        type: type, 
        amount: parseInt(amount), 
        details: parseInt(slots) 
    });
    res.redirect(`https://app.pakasir.com/pay/${PAKASIR_SLUG}/${amount}?order_id=${oid}`);
});

app.post('/payment/flash-claim', requireAuth, async (req, res) => {
    const settings = await Setting.findOne();
    const user = await User.findById(req.session.userId);

    if (!settings.flashSale.active || new Date() > settings.flashSale.endTime) {
        return res.redirect('/dashboard');
    }
    if (user.flashSaleClaimed) {
        return res.redirect('/dashboard?status=already_claimed');
    }

    const rewardType = req.body.rewardType;
    const slots = settings.flashSale.rewardSlots;

    if (settings.flashSale.isFree || settings.flashSale.price === 0) {
        if (rewardType === 'session') {
            await User.findByIdAndUpdate(req.session.userId, { 
                $inc: { maxSessions: slots },
                flashSaleClaimed: true 
            });
        } else {
            await User.findByIdAndUpdate(req.session.userId, { 
                $inc: { serverSlots: slots },
                flashSaleClaimed: true
            });
        }
        res.redirect('/dashboard?status=success_claim');
    } else {
        const oid = 'FLASH-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const type = rewardType === 'session' ? 'bot_slot' : 'server_slot';
        
        await Transaction.create({ 
            orderId: oid, 
            userId: req.session.userId, 
            type: type, 
            amount: settings.flashSale.price, 
            details: slots 
        });
        res.redirect(`https://app.pakasir.com/pay/${PAKASIR_SLUG}/${settings.flashSale.price}?order_id=${oid}`);
    }
});

app.post('/webhook/pakasir', async (req, res) => {
    if (!req.body.order_id || req.body.status !== 'completed') return res.json({ status: 'ignored' });
    const t = await Transaction.findOne({ orderId: req.body.order_id });
    if (t && t.status === 'pending') {
        t.status = 'completed'; await t.save();
        
        if (t.type === 'upgrade') {
            await User.findByIdAndUpdate(t.userId, { isPremium: true, maxSessions: 10 });
        } else if (t.type === 'server_slot') {
            const slots = t.details || 1;
            await User.findByIdAndUpdate(t.userId, { $inc: { serverSlots: slots } });
        } else if (t.type === 'bot_slot') {
            const slots = t.details || 1;
            await User.findByIdAndUpdate(t.userId, { $inc: { maxSessions: slots } });
        }
        
        if (t.orderId.startsWith('FLASH-')) {
            await User.findByIdAndUpdate(t.userId, { flashSaleClaimed: true });
        }

        return res.json({ status: 'success' });
    }
    res.json({ status: 'ok' });
});

app.use((req, res) => res.status(404).render('404'));

io.on('connection', (socket) => {
    socket.on('create-session', async (d) => {
        const user = await User.findById(d.userId);
        if (user.sessions.length >= user.maxSessions) return socket.emit('error', 'Limit');
        const sid = 'sess_' + Date.now();
        user.sessions.push({ sessionId: sid, phoneNumber: d.phoneNumber, status: 'connecting', config: user.defaultConfig });
        await user.save();
        startBaileys(d.userId, sid, socket, d.phoneNumber);
    });

    socket.on('delete-session', async (d) => {
        const s = activeConnections.get(`${d.userId}_${d.sessionId}`); if(s) s.end();
        rimraf.sync(path.join(__dirname, 'sessions', `${d.userId}_${d.sessionId}`));
        await User.updateOne({ _id: d.userId }, { $pull: { sessions: { sessionId: d.sessionId } } });
        socket.emit('session-deleted', d.sessionId);
    });

    socket.on('join-project', uuid => socket.join(uuid));

    socket.on('term-connect', ({ uuid }) => {
        const target = path.join(PROJECT_DIR, uuid);
        if (!terminals[uuid]) {
            const term = pty.spawn(shell, [], { name: 'xterm-color', cols: 80, rows: 30, cwd: target, env: { ...process.env, HOME: target, PS1: 'root@fiona:~/server# ' } });
            terminals[uuid] = term;
            term.onData(d => io.to(uuid).emit('term-output', d));
            term.onExit(() => delete terminals[uuid]);
        }
    });

    socket.on('term-input', ({ uuid, input }) => {
        const forbiddenCommands = ['passwd', 'sudo passwd', 'chpasswd', 'rm -rf /', 'mkfs', 'shutdown', 'reboot', 'init 0', 'poweroff'];
        const cleanInput = input.trim().toLowerCase();
        if (forbiddenCommands.some(cmd => cleanInput.startsWith(cmd))) {
            io.to(uuid).emit('term-output', '\r\n\x1b[1;31mSecurity Alert: Command forbidden on this server.\x1b[0m\r\nroot@fiona:~/server# ');
            return;
        }
        if (terminals[uuid]) {
            terminals[uuid].write(input);
        }
    });

    socket.on('term-resize', ({ uuid, cols, rows }) => { if (terminals[uuid]) terminals[uuid].resize(cols, rows); });
});

const startServer = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        if(!(await Setting.findOne())) await Setting.create({ maintenance: false });
        const users = await User.find({});
        users.forEach(u => u.sessions.forEach(s => { if(['connected','connecting'].includes(s.status)) startBaileys(u._id, s.sessionId) }));
        server.listen(PORT, () => console.log(`Server running on ${PORT}`));
    } catch (err) { console.log(err); }
};

startServer();
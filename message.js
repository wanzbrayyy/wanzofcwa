const chalk = require("chalk");
const fs = require("fs");
const path = require('path');
const util = require("util");
const axios = require("axios");
const { exec } = require('child_process');
const os = require('os');
const FormData = require('form-data');
const { fileTypeFromBuffer } = require('file-type');
const { generateWAMessageFromContent, proto, prepareWAMessageMedia, downloadContentFromMessage } = require("@skyzopedia/baileys-mod");

global.ppobApiUrl = "https://jagoanpedia.com/api/ppob";
global.sosmedApiUrl = "https://jagoanpedia.com/api/sosmed";
global.xterm = {
    url: "https://api.termai.cc",
    key: "Trial-HC65ZOWyHkAdwX16" 
};

const dbDir = "./collection";
const dbPath = `${dbDir}/database.json`;
const pentingPath = `${dbDir}/penting.json`;
const userDbPath = `${dbDir}/users.json`;

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ welcome: true, antilink: [], list: {} }));
if (!fs.existsSync(pentingPath)) fs.writeFileSync(pentingPath, JSON.stringify({ blacklistJpm: [] }));
if (!fs.existsSync(userDbPath)) fs.writeFileSync(userDbPath, JSON.stringify({}));

global.db = JSON.parse(fs.readFileSync(dbPath));
global.penting = JSON.parse(fs.readFileSync(pentingPath));
global.public = true;

const fakeQuoted = {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" },
    message: { conversation: "Fiona Verified System" }
};

const formatRupiah = (number) => {
    if (!number) return 'Rp 0';
    return "Rp " + number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const sleep = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const toCoolFont = (text) => {
    const original = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const cool = '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿';
    return text.split('').map(char => {
        const index = original.indexOf(char);
        return index !== -1 ? cool[index] : char;
    }).join('');
};

const uploadToCatbox = async (buffer) => {
    try {
        const { ext } = await fileTypeFromBuffer(buffer);
        const bodyForm = new FormData();
        bodyForm.append("fileToUpload", buffer, "file." + ext);
        bodyForm.append("reqtype", "fileupload");
        const res = await axios.post("https://catbox.moe/user/api.php", bodyForm, {
            headers: bodyForm.getHeaders(),
        });
        return res.data;
    } catch (e) {
        return null;
    }
};

const fetchJson = async (url) => {
    const res = await axios.get(url);
    return res.data;
};

module.exports = async (fio, m) => {
    try {
        const config = fio.sessionConfig || {};
        const globalOwner = config.ownerNumber || "6289526346592";
        const globalBotname = config.botname || "Fiona Bot";
        const globalTelegram = config.telegram || "https://t.me/maverick_dar";
        const globalAudioUrl = config.audioUrl || "https://files.catbox.moe/j2l430.mp3";
        const globalPpobKey = config.ppobApiKey || "2169-de6d54a0-73d9-4380-ab2e-a51bb2a76d33";
        const globalDelayPush = config.delayPush || 3000;
        const globalDelayJpm = config.delayJpm || 4000;
       
         const type = m.mtype;
         const msg = m.message;
      
 let body = (m.mtype === 'conversation') ? m.message.conversation :
                   (m.mtype === 'imageMessage') ? m.message.imageMessage.caption :
                   (m.mtype === 'videoMessage') ? m.message.videoMessage.caption :
                   (m.mtype === 'extendedTextMessage') ? m.message.extendedTextMessage.text :
                   (m.mtype === 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId :
                   (m.mtype === 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
                   (m.mtype === 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId :
                   (m.mtype === 'interactiveResponseMessage') ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id : "";

        if (!body) return;

        const prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : '.';
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const text = args.join(" ");
        
        const botNumber = fio.user.id.split(":")[0] + "@s.whatsapp.net";
        const isOwner = m.sender.split("@")[0] === globalOwner || m.sender === botNumber;
        const quoted = m.quoted ? m.quoted : m;
        const mime = (quoted.msg || quoted).mimetype || '';
        const sender = m.sender;
        const senderNum = sender.split("@")[0];

        let users = JSON.parse(fs.readFileSync(userDbPath));
        if (!users[sender]) {
            users[sender] = { registered: false, age: 0, balance: 0 };
            fs.writeFileSync(userDbPath, JSON.stringify(users));
        }
        const user = users[sender];

        if (isCmd) console.log(chalk.black(chalk.bgWhite('[ CMD ]')), chalk.magenta(command), 'from', chalk.cyan(m.sender.split('@')[0]));

        if (!global.public && !isOwner) return;

        if (isCmd && !user.registered && command !== "daftar") {
            return m.reply(`⚠️ *AKSES DITOLAK*\n\nAnda belum terdaftar di sistem ${globalBotname}.\nSilahkan daftar terlebih dahulu.\n\nCara Daftar:\nKetik *${prefix}daftar <umur>*\nContoh: *${prefix}daftar 20*`);
        }

        const callPpobApi = async (action, params = {}) => {
            try {
                const payload = { key: globalPpobKey, action, ...params };
                const res = await axios.post(global.ppobApiUrl, payload, { 
                    headers: { 'Content-Type': 'application/json' },
                    validateStatus: () => true 
                });
                return res.data;
            } catch (err) {
                return { success: false, msg: "Koneksi Error" };
            }
        };

        const callSosmedApi = async (action, params = {}) => {
            try {
                const payload = { key: globalPpobKey, action, ...params };
                const res = await axios.post(global.sosmedApiUrl, payload, { 
                    headers: { 'Content-Type': 'application/json' },
                    validateStatus: () => true 
                });
                return res.data;
            } catch (err) {
                return { status: false, msg: "Koneksi Error" };
            }
        };

        const sendDownloadHelp = async (type, example) => {
            let imgUrl = "https://files.catbox.moe/k3612t2.jpg"; 
            let desc = `*DOWNLOADER - ${type.toUpperCase()}*\n\nCara penggunaan:\nKetik *${prefix}${type.toLowerCase()} <link>*\n\nContoh:\n${prefix}${type.toLowerCase()} ${example}`;
            await fio.sendMessage(m.chat, { image: { url: imgUrl }, caption: desc }, { quoted: m });
        };

        switch (command) {
            case "daftar": {
                if (user.registered) return m.reply("✅ Akun sudah terdaftar.");
                let age = parseInt(args[0]);
                if (!age) return m.reply(`⚠️ Masukkan umur valid.\nContoh: ${prefix}daftar 19`);
                if (age < 10 || age > 99) return m.reply("⚠️ Umur harus antara 10 - 99 tahun.");
                
                users[sender].registered = true;
                users[sender].age = age;
                users[sender].balance = 0;
                fs.writeFileSync(userDbPath, JSON.stringify(users));
                
                m.reply(`✅ *REGISTRASI BERHASIL*\n\nID: ${senderNum}\nUmur: ${age}\nSaldo: Rp 0\n\nSilahkan cek *${prefix}menu*`);
            }
            break;

            case "menu": {
                let img;
                try { img = JSON.parse(fs.readFileSync("./collection/thumbnail.json")); } 
                catch { img = { imageMessage: { url: "https://files.catbox.moe/k3612t2.jpg" } }; }

                let teks = `Hii @${m.sender.split("@")[0]}\n*${globalBotname}* Ready!\n
💰 Saldo: *${formatRupiah(user.balance)}*
👤 Status: ${user.registered ? "Verified" : "Unverified"}

┌  *PUSH & JPM*
│  ◦ ${prefix}pushkontak (Text)
│  ◦ ${prefix}pushkontak2 (VCF)
│  ◦ ${prefix}pushkontakid (ID)
│  ◦ ${prefix}savekontak
│  ◦ ${prefix}jpm (Broadcast)
│  ◦ ${prefix}jpmbutton (Button)
└  ◦ ${prefix}cekidgc / ${prefix}cekidch

┌  *STORE*
│  ◦ ${prefix}listppob
│  ◦ ${prefix}smm
│  ◦ ${prefix}deposit
└  ◦ ${prefix}tutorial

┌  *DOWNLOADER*
└  ◦ ${prefix}download (Tiktok, IG, YT, dll)

┌  *SEARCH*
└  ◦ ${prefix}search (Pinterest, Sfile, YT)

┌  *TOOLS*
│  ◦ ${prefix}brat
│  ◦ ${prefix}uptime
└  ◦ ${prefix}ownermenu`;

                let buttons = [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: "🌐 PANEL", url: "https://digitalhostt.org", merchant_url: "https://digitalhostt.org" }) },
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: "Contact Owner", url: globalTelegram, merchant_url: globalTelegram }) },
                    {
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify({
                            title: "NAVIGASI MENU",
                            sections: [{
                                title: "PILIH LAYANAN",
                                rows: [
                                    { header: "SOSMED", title: "Layanan SMM", description: "Followers, Likes, Views", id: `${prefix}smm` },
                                    { header: "PPOB", title: "Layanan PPOB", description: "Pulsa, Data, E-Money", id: `${prefix}listppob` },
                                    { header: "DOWNLOAD", title: "Menu Downloader", description: "Video & Music Downloader", id: `${prefix}download` },
                                    { header: "SEARCH", title: "Menu Pencarian", description: "Cari Video, Foto, File", id: `${prefix}search` }
                                ]
                            }]
                        })
                    }
                ];

                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { ...img, hasMediaAttachment: true },
                                body: { text: teks },
                                nativeFlowMessage: { buttons },
                                contextInfo: { 
                                    mentionedJid: [m.sender],
                                    externalAdReply: {
                                        title: globalBotname, body: "Verified Reseller System",
                                        thumbnailUrl: "https://files.catbox.moe/k3612t2.jpg", sourceUrl: globalTelegram,
                                        mediaType: 1, renderLargerThumbnail: true
                                    }
                                }
                            }
                        }
                    }
                }, { userJid: m.sender, quoted: fakeQuoted });
                
                await fio.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
                if(globalAudioUrl) await fio.sendMessage(m.chat, { audio: { url: globalAudioUrl }, mimetype: 'audio/mp4', ptt: true }, { quoted: msg });
            }
            break;

            case "download": {
                let sections = [{
                    title: "PILIH DOWNLOADER",
                    rows: [
                        { header: "TIKTOK", title: "TikTok Downloader", description: "No Watermark", id: `${prefix}tiktok` },
                        { header: "INSTAGRAM", title: "Instagram Downloader", description: "Reels/Post/Story", id: `${prefix}instagram` },
                        { header: "FACEBOOK", title: "Facebook Downloader", description: "Video HD", id: `${prefix}facebook` },
                        { header: "YOUTUBE MP4", title: "YouTube Video", description: "Download Video", id: `${prefix}ytmp4` },
                        { header: "YOUTUBE MP3", title: "YouTube Audio", description: "Download Audio", id: `${prefix}ytmp3` },
                        { header: "SPOTIFY", title: "Spotify Downloader", description: "Music Download", id: `${prefix}spotify` },
                        { header: "PINTEREST", title: "Pinterest Downloader", description: "Image/Video", id: `${prefix}pinterest` }
                    ]
                }];

                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { title: "📥 DOWNLOAD CENTER", hasMediaAttachment: false },
                                body: { text: "Pilih downloader yang ingin digunakan:" },
                                nativeFlowMessage: {
                                    buttons: [{
                                        name: 'single_select',
                                        buttonParamsJson: JSON.stringify({ title: "Pilih Layanan", sections })
                                    }]
                                }
                            }
                        }
                    }
                }, { quoted: m });
                await fio.relayMessage(m.chat, msg.message, {});
            }
            break;

            case "search": {
                let sections = [{
                    title: "PILIH PENCARIAN",
                    rows: [
                        { header: "PINTEREST IMG", title: "Pinterest Image", description: "Cari Gambar", id: `${prefix}pinsearch` },
                        { header: "PINTEREST VID", title: "Pinterest Video", description: "Cari Video", id: `${prefix}pinvidsearch` },
                        { header: "YOUTUBE", title: "YouTube Search", description: "Cari Video YT", id: `${prefix}ytsearch` },
                        { header: "SFILE", title: "Sfile Search", description: "Cari File", id: `${prefix}sfilesearch` }
                    ]
                }];

                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { title: "🔎 SEARCH MENU", hasMediaAttachment: false },
                                body: { text: "Pilih layanan pencarian:" },
                                nativeFlowMessage: {
                                    buttons: [{
                                        name: 'single_select',
                                        buttonParamsJson: JSON.stringify({ title: "Pilih Layanan", sections })
                                    }]
                                }
                            }
                        }
                    }
                }, { quoted: m });
                await fio.relayMessage(m.chat, msg.message, {});
            }
            break;

            case "deposit": {
                let sections = [{
                    title: "METODE PEMBAYARAN",
                    rows: [
                        { header: "QRIS", title: "Scan QRIS", description: "Otomatis & Support Semua E-Wallet", id: `${prefix}pay qris` },
                        { header: "DANA", title: "Transfer Dana", description: "Manual Transfer", id: `${prefix}pay dana` },
                        { header: "GOPAY", title: "Transfer Gopay", description: "Manual Transfer", id: `${prefix}pay gopay` },
                        { header: "SHOPEEPAY", title: "Transfer ShopeePay", description: "Manual Transfer", id: `${prefix}pay shopeepay` },
                        { header: "SEABANK", title: "Transfer SeaBank", description: "Manual Transfer", id: `${prefix}pay seabank` }
                    ]
                }];

                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { title: "💰 DEPOSIT SALDO", hasMediaAttachment: false },
                                body: { text: "Silahkan pilih metode pembayaran deposit yang tersedia:" },
                                nativeFlowMessage: {
                                    buttons: [{
                                        name: 'single_select',
                                        buttonParamsJson: JSON.stringify({ title: "Pilih Metode", sections })
                                    }]
                                }
                            }
                        }
                    }
                }, { quoted: m });
                await fio.relayMessage(m.chat, msg.message, {});
            }
            break;

            // ... (bagian atas sama seperti sebelumnya) ...

            case "pay": {
                let method = args[0] ? args[0].toLowerCase() : "";
                let msg = "";
                let image = "";
                
                const config = fio.sessionConfig || {};
                const payName = config.payName || "Admin";
                const danaNum = config.payDana || "Tidak tersedia";
                const gopayNum = config.payGopay || "Tidak tersedia";
                const ovoNum = config.payOvo || "Tidak tersedia";
                const qrisImg = config.payQris || "https://files.catbox.moe/k3612t2.jpg";

                if (method === "dana") {
                    msg = `*DEPOSIT VIA DANA*\n\nNomor: *${danaNum}*\nAtas Nama: *${payName}*\n\nSilahkan transfer dan konfirmasi bukti transfer.`;
                } else if (method === "gopay") {
                    msg = `*DEPOSIT VIA GOPAY*\n\nNomor: *${gopayNum}*\nAtas Nama: *${payName}*\n\nSilahkan transfer dan konfirmasi bukti transfer.`;
                } else if (method === "ovo") {
                    msg = `*DEPOSIT VIA OVO*\n\nNomor: *${ovoNum}*\nAtas Nama: *${payName}*\n\nSilahkan transfer dan konfirmasi bukti transfer.`;
                } else if (method === "qris") {
                    msg = `*DEPOSIT VIA QRIS*\n\nSilahkan scan QRIS di atas untuk melakukan deposit.\nAtas Nama: *${payName}*`;
                    image = qrisImg; 
                } else {
                    return m.reply("Metode tidak valid. Pilihan: dana, gopay, ovo, qris");
                }

                let buttons = [
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: "✅ SAYA TELAH BERHASIL DEPOSIT", id: `${prefix}konfirmasideposit` }) }
                ];

                let messageOptions = {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                body: { text: msg },
                                header: image ? { hasMediaAttachment: true, ...(await prepareWAMessageMedia({ image: { url: image } }, { upload: fio.waUploadToServer })) } : { title: "PAYMENT INFO", hasMediaAttachment: false },
                                nativeFlowMessage: { buttons }
                            }
                        }
                    }
                };

                let generatedMsg = await generateWAMessageFromContent(m.chat, messageOptions, { quoted: m });
                await fio.relayMessage(m.chat, generatedMsg.message, {});
            }
            break;

            case "konfirmasideposit": {
                m.reply(`Silahkan kirim foto bukti transfer dengan caption: *${prefix}buktideposit*`);
            }
            break;

            case "buktideposit": {
                if (!/image/.test(mime) && !/image/.test(quoted.msg?.mimetype)) return m.reply("Kirim foto bukti transfer dengan caption .buktideposit");
                m.reply("⏳ Mengupload bukti...");
                let media = await m.download();
                let url = await uploadToCatbox(media);
                
                if (!url) return m.reply("Gagal upload bukti.");

                let textToOwner = `
${toCoolFont("KONFIRMASI DEPOSIT")}

${toCoolFont("ID")} : ${toCoolFont(senderNum)}
${toCoolFont("NOMOR")} : ${toCoolFont(senderNum)}
${toCoolFont("LINK BUKTI")} : ${url}

${toCoolFont("Harap segera dicek bosku")}
`;
                await fio.sendMessage(globalOwner + "@s.whatsapp.net", { image: { url: url }, caption: textToOwner });
                m.reply("✅ Bukti telah dikirim ke owner. Mohon tunggu konfirmasi.");
            }
            break;

            case "pinterest":
            case "pindl": {
                if (!text) return sendDownloadHelp("pinterest", "https://pin.it/xxxx");
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/downloader/pinterest?url=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data) {
                        const media = Array.isArray(res.data) ? res.data[0] : res.data; 
                        if (media.url) await fio.sendMessage(m.chat, { image: { url: media.url }, caption: "Pinterest Downloader" }, { quoted: m });
                        else m.reply("Media tidak ditemukan.");
                    } else m.reply("Gagal mengambil media.");
                } catch (e) { m.reply("Error API."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "tiktok":
            case "tt": {
                if (!text) return sendDownloadHelp("tiktok", "https://vt.tiktok.com/xxxx");
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/downloader/tiktok?url=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data) {
                        await fio.sendMessage(m.chat, { video: { url: res.data.no_watermark }, caption: `Title: ${res.data.title}` }, { quoted: m });
                        if(res.data.audio) await fio.sendMessage(m.chat, { audio: { url: res.data.audio }, mimetype: "audio/mpeg" }, { quoted: m });
                    } else m.reply("Gagal download.");
                } catch (e) { m.reply("Error API."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "instagram":
            case "ig": {
                if (!text) return sendDownloadHelp("instagram", "https://www.instagram.com/p/xxxx");
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/downloader/instagram?url=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data && res.data.length > 0) {
                        for (let media of res.data) {
                            await fio.sendMessage(m.chat, { [media.type === 'video' ? 'video' : 'image']: { url: media.url }, caption: "Instagram Downloader" }, { quoted: m });
                        }
                    } else m.reply("Gagal download.");
                } catch (e) { m.reply("Error API."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "facebook":
            case "fb": {
                if (!text) return sendDownloadHelp("facebook", "https://fb.watch/xxxx");
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/downloader/facebook?url=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data) {
                        let video = res.data.find(v => v.quality === 'hd') || res.data[0];
                        await fio.sendMessage(m.chat, { video: { url: video.url }, caption: "Facebook Downloader" }, { quoted: m });
                    } else m.reply("Gagal download.");
                } catch (e) { m.reply("Error API."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "spotify": {
                if (!text) return sendDownloadHelp("spotify", "https://open.spotify.com/track/xxxx");
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/downloader/spotify?url=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data) {
                        await fio.sendMessage(m.chat, { image: { url: res.data.thumbnail }, caption: `Title: ${res.data.title}\nArtist: ${res.data.artist}` }, { quoted: m });
                        await fio.sendMessage(m.chat, { audio: { url: res.data.url }, mimetype: "audio/mpeg" }, { quoted: m });
                    } else m.reply("Gagal download.");
                } catch (e) { m.reply("Error API."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "ytmp4": {
                if (!text) return sendDownloadHelp("ytmp4", "https://youtu.be/xxxx");
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/downloader/youtube?type=mp4&url=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data) {
                        await fio.sendMessage(m.chat, { video: { url: res.data.url }, caption: res.data.title }, { quoted: m });
                    } else m.reply("Gagal download.");
                } catch (e) { m.reply("Error API."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "ytmp3": {
                if (!text) return sendDownloadHelp("ytmp3", "https://youtu.be/xxxx");
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/downloader/youtube?type=mp3&url=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data) {
                        await fio.sendMessage(m.chat, { audio: { url: res.data.url }, mimetype: "audio/mpeg" }, { quoted: m });
                    } else m.reply("Gagal download.");
                } catch (e) { m.reply("Error API."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "brat": {
                if (!text) return m.reply(`Teks? Contoh: ${prefix}brat Halo`);
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let url = `${global.xterm.url}/api/maker/brat?text=${encodeURIComponent(text)}&key=${global.xterm.key}`;
                    await fio.sendMessage(m.chat, { image: { url }, caption: "Brat Maker" }, { quoted: m });
                } catch (e) { m.reply("Gagal membuat sticker/image."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "pinsearch": {
                if (!text) return m.reply(`Query? Contoh: ${prefix}pinsearch kucing`);
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/search/pinterest-image?query=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data && res.data.length > 0) {
                        let rand = res.data[Math.floor(Math.random() * res.data.length)];
                        await fio.sendMessage(m.chat, { image: { url: rand }, caption: "Result for: " + text }, { quoted: m });
                    } else m.reply("Tidak ditemukan.");
                } catch (e) { m.reply("Error."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "pinvidsearch": {
                if (!text) return m.reply(`Query? Contoh: ${prefix}pinvidsearch aesthetic`);
                await fio.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/search/pinterest-video?query=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data && res.data.length > 0) {
                        let rand = res.data[Math.floor(Math.random() * res.data.length)];
                        await fio.sendMessage(m.chat, { video: { url: rand }, caption: "Result for: " + text }, { quoted: m });
                    } else m.reply("Tidak ditemukan.");
                } catch (e) { m.reply("Error."); }
                await fio.sendMessage(m.chat, { react: { text: '', key: m.key } });
            }
            break;

            case "ytsearch": {
                if (!text) return m.reply(`Query? Contoh: ${prefix}ytsearch dj`);
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/search/youtube?query=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data && res.data.length > 0) {
                        let txt = `*YOUTUBE SEARCH*\n\n`;
                        res.data.forEach((v, i) => {
                            txt += `${i+1}. ${v.title} (${v.duration})\nLink: ${v.url}\n\n`;
                        });
                        m.reply(txt);
                    } else m.reply("Tidak ditemukan.");
                } catch (e) { m.reply("Error."); }
            }
            break;

            case "sfilesearch": {
                if (!text) return m.reply(`Query? Contoh: ${prefix}sfilesearch script`);
                try {
                    let res = await fetchJson(`${global.xterm.url}/api/search/sfile?query=${text}&key=${global.xterm.key}`);
                    if (res.status && res.data && res.data.length > 0) {
                        let txt = `*SFILE SEARCH*\n\n`;
                        res.data.forEach((v, i) => {
                            txt += `${i+1}. ${v.title}\nSize: ${v.size}\nLink: ${v.url}\n\n`;
                        });
                        m.reply(txt);
                    } else m.reply("Tidak ditemukan.");
                } catch (e) { m.reply("Error."); }
            }
            break;

            case "smm": {
                m.reply("⏳ Mengambil kategori layanan Sosmed...");
                let res = await callSosmedApi("services");
                if (!res || !res.status && !Array.isArray(res.data)) return m.reply("❌ Gagal memuat layanan Sosmed.");

                const services = Array.isArray(res.data) ? res.data : [];
                if (services.length === 0) return m.reply("Tidak ada layanan tersedia.");

                const categories = [...new Set(services.map(s => s.category || "Lainnya"))].sort();

                let sections = [{
                    title: "PILIH KATEGORI",
                    rows: categories.map(cat => ({
                        header: cat,
                        title: "Buka Kategori",
                        id: `${prefix}smmlist ${cat}`
                    }))
                }];

                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { title: "SOSMED - KATEGORI", hasMediaAttachment: false },
                                body: { text: "Pilih kategori layanan:" },
                                nativeFlowMessage: {
                                    buttons: [{
                                        name: 'single_select',
                                        buttonParamsJson: JSON.stringify({ title: "Daftar Kategori", sections })
                                    }]
                                }
                            }
                        }
                    }
                }, { quoted: m });
                await fio.relayMessage(m.chat, msg.message, {});
            }
            break;

            case "smmlist": {
                let category = text.trim();
                if (!category) return m.reply("Kategori tidak valid.");

                let res = await callSosmedApi("services");
                if (!res || !Array.isArray(res.data)) return m.reply("Gagal memuat daftar layanan.");

                const filtered = res.data.filter(s => (s.category || "Lainnya") === category);
                if (filtered.length === 0) return m.reply(`Tidak ada layanan di kategori *${category}*.`);

                const itemsPerPage = 20;
                const totalPages = Math.ceil(filtered.length / itemsPerPage);
                const argsParts = body.trim().split(/ +/);
                const pageIdx = argsParts.findIndex(p => !isNaN(p) && parseInt(p) > 0);
                const page = pageIdx !== -1 ? parseInt(argsParts[pageIdx]) : 1;
                const clampedPage = Math.max(1, Math.min(page, totalPages));
                const start = (clampedPage - 1) * itemsPerPage;
                const pageData = filtered.slice(start, start + itemsPerPage);

                let sections = [{
                    title: `LAYANAN ${category.toUpperCase()}`,
                    rows: pageData.map(s => ({
                        header: s.name.substring(0, 50),
                        title: `ID: ${s.id} | ${formatRupiah(s.price)}`,
                        description: `Min: ${s.min} | Max: ${s.max}`,
                        id: `${prefix}ordersmm ${s.id}`
                    }))
                }];

                let buttons = [];
                if (clampedPage > 1) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: "⬅️ Prev", id: `${prefix}smmlist ${category} ${clampedPage - 1}` }) });
                if (clampedPage < totalPages) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: "Next ➡️", id: `${prefix}smmlist ${category} ${clampedPage + 1}` }) });

                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { title: `SOSMED - ${category}`, hasMediaAttachment: false },
                                body: { text: `Halaman ${clampedPage}/${totalPages}` },
                                nativeFlowMessage: {
                                    buttons: [
                                        {
                                            name: 'single_select',
                                            buttonParamsJson: JSON.stringify({
                                                title: "Pilih Layanan",
                                                sections
                                            })
                                        },
                                        ...buttons
                                    ]
                                }
                            }
                        }
                    }
                }, { quoted: m });
                await fio.relayMessage(m.chat, msg.message, {});
            }
            break;

            case "ordersmm": {
                if (!user.registered) return m.reply("Daftar dulu dengan `.daftar <umur>`");
                if (args.length < 2) return m.reply(`Format: ${prefix}ordersmm <ID> <target> [jumlah]`);

                let serviceId = args[0];
                let target = args[1];
                let quantity = args[2] || "100";

                m.reply("⏳ Memproses layanan...");

                let res = await callSosmedApi("services");
                if (!res || !Array.isArray(res.data)) return m.reply("Gagal memuat daftar layanan.");
                
                const service = res.data.find(s => String(s.id) === String(serviceId));
                if (!service) return m.reply("Layanan tidak ditemukan.");
                
                let qty = parseInt(quantity);
                if (isNaN(qty)) qty = service.min;
                if (qty < service.min) return m.reply(`Minimal order: ${service.min}`);
                if (qty > service.max) return m.reply(`Maksimal order: ${service.max}`);

                let total = Math.ceil((service.price * qty) / 1000);
                if (user.balance < total) return m.reply(`Saldo tidak cukup.\nButuh: ${formatRupiah(total)}\nSaldo: ${formatRupiah(user.balance)}`);

                users[sender].balance -= total;
                fs.writeFileSync(userDbPath, JSON.stringify(users));

                let orderRes = await callSosmedApi("order", {
                    service: serviceId,
                    target: target,
                    quantity: qty
                });

                if (orderRes && (orderRes.success === true || orderRes.status === true || (orderRes.data && orderRes.data.id))) {
                    let orderData = orderRes.data;
                    m.reply(`✅ *ORDER BERHASIL*\n\nID: ${orderData.id}\nLayanan: ${service.name}\nTarget: ${target}\nJumlah: ${qty}\nHarga: ${formatRupiah(total)}\n\nKetik *${prefix}cekordersmm ${orderData.id}* untuk cek status.`);
                } else {
                    users[sender].balance += total;
                    fs.writeFileSync(userDbPath, JSON.stringify(users));
                    return m.reply(`Gagal order.\nError: ${orderRes?.error || orderRes?.data?.msg || "Layanan sedang gangguan"}`);
                }
            }
            break;

            case "cekordersmm": {
                if (!args[0]) return m.reply(`Format: ${prefix}cekordersmm <ID order>`);
                let orderId = args[0];
                m.reply("⏳ Mengecek status...");
                let res = await callSosmedApi("status", { order_id: orderId });
                
                if (res && (res.success === true || res.status === true)) {
                    let d = res.data;
                    m.reply(`*STATUS ORDER SMM*\n\nID: ${d.id || orderId}\nStatus: ${d.status}\nMulai: ${d.start_count}\nSisa: ${d.remains}`);
                } else {
                    m.reply(`Error: ${res?.error || "Order tidak ditemukan."}`);
                }
            }
            break;

            case "listppob": {
                m.reply("⏳ Mengambil daftar layanan PPOB...");
                let res = await callPpobApi("services");
                
                if (!res || !Array.isArray(res.data)) {
                    return m.reply("❌ Gagal memuat layanan PPOB.");
                }

                const services = res.data.filter(s => s.status === "Active");
                const itemsPerPage = 20;
                const totalPages = Math.ceil(services.length / itemsPerPage);
                const page = args[0] && !isNaN(parseInt(args[0])) ? parseInt(args[0]) : 1;
                const clampedPage = Math.max(1, Math.min(page, totalPages));
                const start = (clampedPage - 1) * itemsPerPage;
                const pageData = services.slice(start, start + itemsPerPage);

                let sections = [{
                    title: "DAFTAR LAYANAN PPOB",
                    rows: pageData.map(s => ({
                        header: (s.name || "Layanan").substring(0, 50),
                        title: `ID: ${s.id} | ${formatRupiah(s.price)}`,
                        description: `${s.category} | ${s.note || "-"}`,
                        id: `${prefix}orderppob ${s.id}`
                    }))
                }];

                let buttons = [];
                if (clampedPage > 1) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: "⬅️ Prev", id: `${prefix}listppob ${clampedPage - 1}` }) });
                if (clampedPage < totalPages) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: "Next ➡️", id: `${prefix}listppob ${clampedPage + 1}` }) });

                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { title: "PPOB SERVICES", hasMediaAttachment: false },
                                body: { text: `Halaman ${clampedPage}/${totalPages}` },
                                nativeFlowMessage: {
                                    buttons: [
                                        { name: 'single_select', buttonParamsJson: JSON.stringify({ title: "Pilih Layanan", sections }) },
                                        ...buttons
                                    ]
                                }
                            }
                        }
                    }
                }, { quoted: m });
                await fio.relayMessage(m.chat, msg.message, {});
            }
            break;

            case "orderppob": {
                if (!user.registered) return m.reply("Daftar dulu.");
                if (args.length < 2) return m.reply(`Format: ${prefix}orderppob <ID Layanan> <Tujuan>`);
                
                let serviceId = args[0];
                let target = args.slice(1).join("");

                let res = await callPpobApi("services");
                if (!res || !Array.isArray(res.data)) return m.reply("Gagal cek layanan.");
                
                const service = res.data.find(s => s.id === serviceId);
                if (!service) return m.reply("Layanan tidak valid.");
                if (service.status !== "Active") return m.reply("Layanan sedang gangguan.");

                if (user.balance < service.price) return m.reply(`Saldo kurang. Harga: ${formatRupiah(service.price)}`);

                users[sender].balance -= service.price;
                fs.writeFileSync(userDbPath, JSON.stringify(users));

                m.reply("⏳ Transaksi diproses...");
                let order = await callPpobApi("order", { service: serviceId, target: target });

                if (order && (order.success === "true" || order.success === true || (order.data && order.data.id))) {
                    m.reply(`✅ *TRANSAKSI BERHASIL*\n\nID: ${order.data.id}\nLayanan: ${service.name}\nTujuan: ${target}\nHarga: ${formatRupiah(service.price)}\nSN: ${order.data.sn || "Sedang Diproses"}\n\nKetik *${prefix}cekorder ${order.data.id}* untuk cek status.`);
                } else {
                    users[sender].balance += service.price;
                    fs.writeFileSync(userDbPath, JSON.stringify(users));
                    m.reply(`❌ Transaksi Gagal: ${order?.error || order?.data?.msg || "Error dari pusat"}`);
                }
            }
            break;

            case "cekorder": {
                if (!args[0]) return m.reply(`Format: ${prefix}cekorder <ID order>`);
                let orderId = args[0];
                m.reply("⏳ Mengecek status...");
                let res = await callPpobApi("status", { id: orderId });
                
                if (res && (res.success === true || res.success === "true") && res.data) {
                    let d = Array.isArray(res.data) ? res.data[0] : res.data;
                    m.reply(`*STATUS PPOB*\n\nID: ${d.id}\nTarget: ${d.target}\nSN: ${d.sn || "Belum ada"}\nStatus: ${d.status}\nHarga: ${d.price ? formatRupiah(d.price) : "-"}`);
                } else {
                    m.reply(`Error: ${res?.error || "Gagal cek status."}`);
                }
            }
            break;

            case "tutorial": {
                let sections = [{
                    title: "PILIH JENIS TUTORIAL",
                    rows: [
                        { header: "PPOB", title: "Tutorial Order PPOB", id: `${prefix}tuto ppob` },
                        { header: "SOSMED", title: "Tutorial Order Sosmed", id: `${prefix}tuto sosmed` }
                    ]
                }];

                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { title: "📖 TUTORIAL", hasMediaAttachment: false },
                                body: { text: "Pilih jenis tutorial:" },
                                nativeFlowMessage: {
                                    buttons: [{
                                        name: 'single_select',
                                        buttonParamsJson: JSON.stringify({ title: "Pilih Tutorial", sections })
                                    }]
                                }
                            }
                        }
                    }
                }, { quoted: m });
                await fio.relayMessage(m.chat, msg.message, {});
            }
            break;

            case "tuto": {
                if (!args[0]) return;
                const type = args[0].toLowerCase();
                let textMsg = "";
                if (type === "ppob") {
                    textMsg = `*TUTORIAL PPOB*\n1. Cari layanan di menu List PPOB.\n2. Salin ID Layanan (cth: XLP10).\n3. Ketik ${prefix}orderppob <ID> <NomorHP/ID>.\nContoh: ${prefix}orderppob XLP10 081234567890\n\n*Format Pengisian:*\n- Pulsa/Data: Nomor HP (08xx)\n- PLN: ID Pelanggan\n- Game: UserID+ZoneID (tanpa spasi)`;
                } else if (type === "sosmed") {
                    textMsg = `*TUTORIAL SOSMED*\n1. Cari layanan di menu SMM.\n2. Pilih kategori & layanan.\n3. Salin ID Layanan (Angka).\n4. Ketik ${prefix}ordersmm <ID> <LinkTarget> <Jumlah>.\nContoh: ${prefix}ordersmm 1234 https://instagram.com/user 1000\n\n*Format Target:*\n- IG Follow: Username/Link Profil\n- IG Like/View: Link Post\n- TikTok Follow: Username/Link Profil\n- TikTok Like/View: Link Video\n- YouTube Subs: Link Channel\n- YouTube View: Link Video`;
                }
                m.reply(textMsg);
            }
            break;

            case "uptime": {
                const uptimeSeconds = Math.floor(process.uptime());
                const days = Math.floor(uptimeSeconds / 86400);
                const hours = Math.floor((uptimeSeconds % 86400) / 3600);
                const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                const seconds = uptimeSeconds % 60;
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                const usedMem = totalMem - freeMem;
                
                let teks = `*🖥️ UPTIME SYSTEM*\n\n`;
                teks += `*RAM:* ${formatBytes(usedMem)} / ${formatBytes(totalMem)}\n`;
                teks += `*Uptime:* ${days}d ${hours}h ${minutes}m ${seconds}s\n`;
                
                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                body: { text: teks },
                                nativeFlowMessage: { buttons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: "🗑️ Hapus Cache", id: `${prefix}clearcache` }) }] }
                            }
                        }
                    }
                }, { quoted: m });
                await fio.relayMessage(m.chat, msg.message, {});
            }
            break;

            case "clearcache": {
                if (!isOwner) return m.reply("Owner Only");
                try {
                    const dir = './collection';
                    if (fs.existsSync(dir)) {
                        fs.readdirSync(dir).forEach(file => {
                            if (!['database.json', 'penting.json', 'users.json', 'thumbnail.json'].includes(file)) fs.unlinkSync(path.join(dir, file));
                        });
                    }
                    m.reply("✅ Cache berhasil dihapus.");
                } catch (e) { m.reply("❌ Gagal hapus cache."); }
            }
            break;

            case "addsaldo": {
                if (!isOwner) return m.reply("Owner Only");
                let [target, amount] = text.split(" ");
                if (!target || !amount) return m.reply(`Format: ${prefix}addsaldo 628xxx 5000`);
                
                let targetJid = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
                if (!users[targetJid]) return m.reply("User tidak ditemukan.");
                
                let val = parseInt(amount);
                users[targetJid].balance += val;
                fs.writeFileSync(userDbPath, JSON.stringify(users));
                
                m.reply(`✅ Saldo ditambah ${formatRupiah(val)}`);
            }
            break;

            case "ownermenu": {
                if (!isOwner) return m.reply("Owner Only");
                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { title: "OWNER PANEL", hasMediaAttachment: false },
                                body: { text: "Select Mode:" },
                                nativeFlowMessage: {
                                    buttons: [
                                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: "🔒 SELF MODE", id: `${prefix}self` }) },
                                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: "🔓 PUBLIC MODE", id: `${prefix}public` }) },
                                        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: "📷 SET THUMBNAIL", id: `${prefix}setthumb` }) }
                                    ]
                                }
                            }
                        }
                    }
                }, { quoted: m });
                await fio.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
            }
            break;

            case "cekidgc": {
                if (!isOwner) return;
                let link = args[0] || m.quoted?.text;
                if (!link || !link.includes("chat.whatsapp.com")) return m.reply("Link Invalid");
                let code = link.split("chat.whatsapp.com/")[1].split(" ")[0];
                try {
                    let res = await fio.groupGetInviteInfo(code);
                    m.reply(`*ID:* ${res.id}\n*Subject:* ${res.subject}`);
                } catch { m.reply("Link Invalid"); }
            }
            break;

            case "pushkontak": {
                if (!isOwner) return;
                if (!m.isGroup) return m.reply("Gunakan di grup");
                if (!text) return m.reply("Isi pesan?");
                let mem = m.metadata.participants.map(v => v.id);
                m.reply(`Memulai push ke ${mem.length} member...`);
                for (let id of mem) {
                    if (id !== botNumber && id !== m.sender) {
                        await fio.sendMessage(id, { text: text }).catch(() => {});
                        await sleep(globalDelayPush);
                    }
                }
                m.reply("Push kontak selesai");
            }
            break;

            case "savekontak": {
                if (!isOwner) return;
                if (!m.isGroup) return m.reply("Gunakan di grup");
                let vcf = "";
                m.metadata.participants.forEach((v, i) => {
                    vcf += `BEGIN:VCARD\nVERSION:3.0\nFN:${text || "Member"} ${i+1}\nTEL;waid=${v.id.split('@')[0]}:${v.id.split('@')[0]}\nEND:VCARD\n`;
                });
                fs.writeFileSync("./collection/grup.vcf", vcf);
                await fio.sendMessage(m.chat, { document: fs.readFileSync("./collection/grup.vcf"), mimetype: 'text/x-vcard', fileName: `${m.metadata.subject}.vcf` });
            }
            break;

            case "jpm": {
                if (!isOwner) return;
                if (!text && !m.quoted) return m.reply("Teks?");
                let groups = Object.keys(await fio.groupFetchAllParticipating());
                m.reply(`Broadcast ke ${groups.length} grup...`);
                
                let content = {};
                if (/image|video/.test(mime)) {
                    let media = await m.download();
                    content = /image/.test(mime) ? { image: media, caption: text } : { video: media, caption: text };
                } else content = { text: text };

                for (let id of groups) {
                    if (global.penting.blacklistJpm.includes(id)) continue;
                    await fio.sendMessage(id, content).catch(() => {});
                    await sleep(globalDelayJpm);
                }
                m.reply("DONE JPM");
            }
            break;

            case "jpmbutton": {
                if (!isOwner) return;
                let [img, tit, bod, btnTxt, url] = text.includes("|") ? text.split("|") : ["https://files.catbox.moe/k3612t2.jpg", "BROADCAST INFO", text || "Cek info berikut!", "KLIK DISINI", `https://wa.me/${globalOwner}`];
                
                let groups = Object.keys(await fio.groupFetchAllParticipating());
                m.reply(`PROSES JPM BUTTON ke ${groups.length} grup...`);

                let msg = await generateWAMessageFromContent(m.chat, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                header: { hasMediaAttachment: true, ...(await prepareWAMessageMedia({ image: { url: img } }, { upload: fio.waUploadToServer })) },
                                body: { text: bod },
                                footer: { text: tit },
                                nativeFlowMessage: {
                                    buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: btnTxt, url: url, merchant_url: url }) }]
                                }
                            }
                        }
                    }
                }, {});

                for (let id of groups) {
                    if (global.penting.blacklistJpm.includes(id)) continue;
                    try {
                        await fio.relayMessage(id, msg.viewOnceMessage.message, { messageId: msg.key.id });
                        await sleep(globalDelayJpm);
                    } catch (e) {}
                }
                m.reply("DONE JPM BUTTON");
            }
            break;

            case "self":
                if (!isOwner) return m.reply("Owner Only");
                global.public = false;
                m.reply("Mode Self Active");
            break;

            case "public":
                if (!isOwner) return m.reply("Owner Only");
                global.public = true;
                m.reply("Mode Public Active");
            break;

            case "setthumb":
                if (!isOwner) return m.reply("Owner Only");
                if (!/image/.test(mime)) return m.reply("Reply image");
                let media = await m.download();
                let upload = await prepareWAMessageMedia({ image: media }, { upload: fio.waUploadToServer });
                fs.writeFileSync("./collection/thumbnail.json", JSON.stringify(upload));
                m.reply("Thumbnail Updated");
            break;

            default:
                if (body.startsWith("> ") && isOwner) {
                    try {
                        let evaled = await eval(body.slice(2));
                        if (typeof evaled !== 'string') evaled = util.inspect(evaled);
                        m.reply(evaled);
                    } catch (err) { m.reply(String(err)); }
                }
                if (body.startsWith("$ ") && isOwner) {
                    exec(body.slice(2), (e, out) => m.reply(e || out));
                }
        }
    } catch (err) {
        console.log("Error:", err);
    }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.red(`Update ${__filename}`));
    delete require.cache[file];
});

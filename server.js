const puppeteer = require("puppeteer");
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const app = express();
app.use(express.static(__dirname));
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let messages = [];
let directorateRequests = [];
let adminReplies = [];

function cleanDirectorateKey(value) {
  return String(value || "").trim();
}

app.post("/send-to-directorate", (req, res) => {
  const data = req.body || {};
  const directorateKey = cleanDirectorateKey(data.directorateKey || data.directorate || data.targetKey);
  if (!directorateKey) return res.status(400).json({ success: false, error: "directorateKey is required" });
  const item = {
    id: data.id || Date.now(), source: data.source || "admin", directorateKey,
    targetDirectorate: data.targetDirectorate || data.directorateName || directorateKey,
    name: data.name || "غير معروف", phone: data.phone || data.number || data.from || "", from: data.from || "",
    ticket: data.ticket || ("REQ-" + Date.now()), description: data.description || data.body || "", body: data.body || data.description || "",
    date: data.date || new Date().toLocaleString("ar-EG"), status: data.status || "مرسل للمديرية",
    whatsappMessageId: data.whatsappMessageId || "", media: data.media || "", mediaType: data.mediaType || "", fileName: data.fileName || ""
  };
  directorateRequests.push(item);
  console.log("✅ Sent to directorate:", directorateKey, item.ticket || item.id);
  if (directorateRequests.length > 1000) directorateRequests = directorateRequests.slice(-1000);
  res.json({ success: true, request: item });
});

app.get("/directorate-messages/:directorateKey", (req, res) => {
  const key = cleanDirectorateKey(req.params.directorateKey);
  const result = directorateRequests.filter(item => cleanDirectorateKey(item.directorateKey) === key);
  res.json(result.slice().reverse());
});

app.post("/reply-to-admin", (req, res) => {
  const data = req.body || {};
  const reply = {
    id: Date.now(), requestId: data.requestId || data.id || "", directorateKey: data.directorateKey || "",
    directorate: data.directorate || data.targetDirectorate || "مديرية غير محددة", name: data.name || "", phone: data.phone || "", ticket: data.ticket || "",
    reply: data.reply || "", message: data.message || data.reply || "", status: data.status || "تم التنفيذ",
    media: data.media || [], originalMedia: data.originalMedia || "", originalMediaType: data.originalMediaType || "",
    date: data.date || new Date().toLocaleString("ar-EG")
  };
  adminReplies.push(reply);
  if (adminReplies.length > 1000) adminReplies = adminReplies.slice(-1000);
  directorateRequests = directorateRequests.map(item => String(item.id) === String(reply.requestId) ? Object.assign({}, item, { status: "تم التنفيذ", reply: reply.reply, completedDate: reply.date }) : item);
  res.json({ success: true, reply });
});

app.get("/admin-replies", (req, res) => {
  res.json(adminReplies.slice().reverse());
});


app.get("/debug-directorates", (req, res) => {
  res.json({
    total: directorateRequests.length,
    byDirectorate: directorateRequests.reduce((acc, item) => {
      acc[item.directorateKey] = (acc[item.directorateKey] || 0) + 1;
      return acc;
    }, {}),
    latest: directorateRequests.slice(-20).reverse()
  });
});



// Store incoming WhatsApp messages
app.post('/incoming-message', (req, res) => {
    const { From, Body, NumMedia, MediaUrl0 } = req.body;
    
    const message = {
        id: Date.now(),
        from: From ? From.replace('whatsapp:', '') : '',
        body: Body || '',
        media: NumMedia > 0 ? MediaUrl0 : null,
        timestamp: new Date().toLocaleString('ar-EG'),
        date: new Date()
    };
    
    messages.push(message);
    console.log('Message received:', message);
    
    // Send confirmation back to WhatsApp
    res.set('Content-Type', 'text/xml');
    res.send(`<Response></Response>`);
});

// API endpoint to fetch messages
app.get('/messages', (req, res) => {
    res.json(messages.slice().reverse());
});

// Clear old messages (optional - keep last 100)
setInterval(() => {
    if (messages.length > 100) {
        messages = messages.slice(-100);
    }
}, 60000);

const PORT = process.env.PORT || 3000;
async function startWhatsApp() {
  const chromePath = await puppeteer.executablePath();

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      executablePath: chromePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    }
  });

  client.on("qr", qr => {
    console.log("Scan this QR with WhatsApp:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp Web connected");
  });

  client.on("message", async (msg) => {
    // keep your current message code here
  });

  client.initialize();
}

startWhatsApp();

client.on("qr", qr => {
  console.log("Scan this QR with WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ WhatsApp Web connected");
});

client.on("message", async (msg) => {
  try {
    let contact = {};

try {
  contact = await msg.getContact();
} catch (contactError) {
  console.error("Contact error:", contactError.message);

  contact = {
    number: "",
    pushname: "غير محفوظ الاسم"
  };
}

    const rawFrom = String(msg.from || "");
    const rawNumber = String(contact.number || "");
    const possibleName = contact.pushname || contact.name || contact.shortName || msg._data?.notifyName || msg._data?.pushName || msg._data?.verifiedBizName || msg._data?.sender?.pushname || msg._data?.sender?.name || "";
    const cleanPossibleName = String(possibleName || "").trim();
    const looksLikeOnlyNumber = /^\+?[0-9\s-]{6,}$/.test(cleanPossibleName);
    const looksLikeLid = cleanPossibleName.includes("@lid");
    const senderName = cleanPossibleName && !looksLikeOnlyNumber && !looksLikeLid ? cleanPossibleName : "غير محفوظ الاسم";

    let mediaUrl = null;
    let mediaType = null;
    let fileName = null;

    if (msg.hasMedia) {
  try {
    const media = await msg.downloadMedia();

    if (media && media.data) {
      const extension = mime.extension(media.mimetype) || "bin";
      fileName = `${Date.now()}.${extension}`;
      const filePath = path.join(__dirname, "uploads", fileName);

      fs.writeFileSync(filePath, media.data, "base64");

      mediaUrl = `/uploads/${fileName}`;
      mediaType = media.mimetype;
    }
  } catch (mediaError) {
    console.error("Media download failed:", mediaError.message);

    mediaUrl = null;
    mediaType = null;
    fileName = null;
  }
}

    messages.push({
      id: Date.now(),
      from: msg.from,
      name: senderName,
      number: contact.number || "",
      body: msg.body || "",
      type: msg.type || "unknown",
      media: mediaUrl,
      mediaType: mediaType,
      fileName: fileName,
      timestamp: new Date().toLocaleString("ar-EG"),
      date: new Date()
    });

    console.log("📩 From:", senderName);
    console.log("Media:", mediaUrl);

  } catch (err) {
    console.error("Message error:", err);
  }
});client.initialize();

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📱 Messages page: http://localhost:${PORT}/messages`);
});

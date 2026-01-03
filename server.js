require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { GridFsStorage } = require("multer-gridfs-storage");
const multer = require("multer");
const Grid = require("gridfs-stream");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;   // 🔐 IMPORTANT

if (!MONGO_URI || !ADMIN_TOKEN) {
  console.error("❌ Add MONGO_URI and ADMIN_TOKEN in .env");
  process.exit(1);
}

// DB connect
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error(err));

// GridFS init
let gfs;
const conn = mongoose.connection;

conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
  console.log("📂 GridFS ready");
});

// Storage config
const storage = new GridFsStorage({
  url: MONGO_URI,
  file: (req, file) => ({
    filename: Date.now() + "-" + file.originalname,
    bucketName: "uploads"
  })
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  }
});

// 🔐 AUTH MIDDLEWARE
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Invalid token" });
  next();
}

// 🟢 Upload API (Admin only)
app.post("/upload", auth, upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const url = `${req.protocol}://${req.get("host")}/image/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// 🟢 Serve Image (Public)
app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file) return res.status(404).json({ error: "Not found" });

    res.set("Content-Type", file.contentType);
    const readstream = gfs.createReadStream(file.filename);
    readstream.pipe(res);
  });
});

// 🔴 DELETE API (Admin only)
app.delete("/delete/:filename", auth, async (req, res) => {
  try {
    const file = await gfs.files.findOne({ filename: req.params.filename });
    if (!file) return res.status(404).json({ error: "File not found" });

    await gfs.remove({ filename: req.params.filename, root: "uploads" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("GridFS API running with Auth + Delete"));

app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));

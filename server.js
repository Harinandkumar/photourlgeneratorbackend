require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { GridFsStorage } = require("multer-gridfs-storage");
const multer = require("multer");
const Grid = require("gridfs-stream");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if(!MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env file");
  process.exit(1);
}

// MongoDB connect
mongoose.connect(MONGO_URI)
  .then(()=>console.log("MongoDB connected"))
  .catch(err=>console.error(err));

let gfs;
const conn = mongoose.connection;

conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
  console.log("GridFS ready");
});

// Storage config
const storage = new GridFsStorage({
  url: MONGO_URI,
  file: (req, file) => ({
    filename: Date.now() + "-" + file.originalname,
    bucketName: "uploads"
  })
});

const upload = multer({ storage });

// Upload route
app.post("/upload", upload.single("photo"), (req, res) => {
  const url = `${req.protocol}://${req.get("host")}/image/${req.file.filename}`;
  res.json({ url });
});

// Serve images
app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file) return res.status(404).json({ error: "Not found" });
    const readstream = gfs.createReadStream(file.filename);
    readstream.pipe(res);
  });
});

app.get("/", (req,res)=>res.send("GridFS Image API running"));

app.listen(PORT, ()=>console.log("Server running on port", PORT));

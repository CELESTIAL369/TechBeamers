require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");

const app = express();

// ===================================
// MIDDLEWARE
// ===================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================================
// GROQ CLIENT
// ===================================

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ===================================
// MULTER CONFIG
// ===================================

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// ===================================
// HELPER: SAFE FILE DELETE
// ===================================

function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Failed to delete temp file:", err.message);
  }
}

// ===================================
// HELPER: TRUNCATE BY WORD BOUNDARY
// ===================================

function truncateText(text, maxChars = 4000) {
  if (text.length <= maxChars) return text;
  const truncated = text.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
}

// ===================================
// MAIN ROUTE
// ===================================

app.post(
  "/process",
  (req, res, next) => {
    // Handle multer errors (e.g. wrong file type, size exceeded)
    upload.single("pdf")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          error: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  async (req, res) => {
    const filePath = req.file?.path;

    try {

      // ===================================
      // CHECK FILE
      // ===================================

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Please upload a PDF file",
        });
      }

      // ===================================
      // READ & EXTRACT PDF TEXT
      // ===================================

      const pdfBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      let notes = pdfData.text.trim();

      // Delete temp file as soon as we're done with it
      safeDelete(filePath);

      // ===================================
      // CHECK EXTRACTION
      // ===================================

      if (!notes || notes.length < 20) {
        return res.status(400).json({
          success: false,
          error: "Could not extract text from PDF. Use typed PDFs only.",
        });
      }

      // ===================================
      // TRUNCATE LARGE PDFs (word boundary)
      // ===================================

      notes = truncateText(notes, 4000);

      // ===================================
      // VALIDATE MODE
      // ===================================

      const VALID_MODES = ["summary", "revision", "quiz"];
      const mode = VALID_MODES.includes(req.body.mode)
        ? req.body.mode
        : "summary";

      // ===================================
      // BUILD PROMPT
      // ===================================

      let prompt = "";

      if (mode === "summary") {
        prompt = `You are an AI study assistant.

Generate clean study notes from the content below.

Include:
- A brief summary
- Key important points
- A simple explanation of complex ideas

Notes:
${notes}`;

      } else if (mode === "revision") {
        prompt = `Convert the notes below into concise revision notes.

Use:
- Clear headings
- Bullet points
- Short explanations

Notes:
${notes}`;

      } else if (mode === "quiz") {
        prompt = `Generate 5 quiz questions with answers based on the notes below.

Format each as:
Q: [question]
A: [answer]

Notes:
${notes}`;
      }

      // ===================================
      // GROQ AI REQUEST
      // ===================================

      const completion = await client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // ===================================
      // SEND RESPONSE
      // ===================================

      const reply = completion.choices[0].message.content;

      res.json({
        success: true,
        reply: reply,
      });

    } catch (error) {
      // Always clean up the temp file on error
      safeDelete(filePath);

      console.error("Processing error:", error);

      res.status(500).json({
        success: false,
        error: error.message || "Something went wrong",
      });
    }
  }
);

// ===================================
// SERVER
// ===================================

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
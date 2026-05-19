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

    }

    else {

      cb(new Error("Only PDF files are allowed"));

    }

  },

});

// ===================================
// MAIN ROUTE
// ===================================

app.post(

  "/process",

  upload.single("pdf"),

  async (req, res) => {

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
      // READ PDF
      // ===================================

      const pdfBuffer =
      fs.readFileSync(req.file.path);

      // ===================================
      // EXTRACT TEXT
      // ===================================

      const pdfData =
      await pdfParse(pdfBuffer);

      let notes =
      pdfData.text.trim();

      // DELETE FILE

      fs.unlinkSync(req.file.path);

      // ===================================
      // CHECK EXTRACTION
      // ===================================

      if (!notes || notes.length < 20) {

        return res.status(400).json({

          success: false,

          error:
          "Could not extract text from PDF. Use typed PDFs only.",

        });

      }

      // ===================================
      // LIMIT HUGE PDFs
      // ===================================

      notes = notes.substring(0, 4000);

      // ===================================
      // MODE
      // ===================================

      const mode =
      req.body.mode || "summary";

      // ===================================
      // PROMPT
      // ===================================

      let prompt = "";

      // SUMMARY

      if (mode === "summary") {

        prompt = `
You are an AI study assistant.

Generate clean study notes.

Include:
- Summary
- Important points
- Easy explanation

Notes:
${notes}
`;

      }

      // REVISION

      else if (mode === "revision") {

        prompt = `
Convert these notes into revision notes.

Use:
- Headings
- Bullet points
- Short explanations

Notes:
${notes}
`;

      }

      // QUIZ

      else if (mode === "quiz") {

        prompt = `
Generate 5 quiz questions with answers.

Notes:
${notes}
`;

      }

      // DEFAULT

      else {

        prompt = `
Summarize these notes clearly.

Notes:
${notes}
`;

      }

      // ===================================
      // GROQ AI REQUEST
      // ===================================

      const completion =
      await client.chat.completions.create({

        model: "llama-3.1-8b-instant",

        messages: [

          {
            role: "user",
            content: prompt,
          },

        ],

      });

      // ===================================
      // AI RESPONSE
      // ===================================

      const reply =
      completion.choices[0].message.content;

      // ===================================
      // SEND RESPONSE
      // ===================================

      res.json({

        success: true,

        reply: reply,

      });

    }

    // ===================================
    // ERROR HANDLING
    // ===================================

    catch (error) {

      console.log(error);

      res.status(500).json({

        success: false,

        error: error.message ||

        "Something went wrong",

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
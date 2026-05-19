require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const upload = multer({
  dest: "uploads/",
});

app.post(
  "/process",
  upload.single("pdf"),
  async (req, res) => {

    console.log("BODY:", req.body);

    console.log("FILE:", req.file);

    try {

      let notes = req.body.notes || "";

      const mode = req.body.mode;

      // PDF Processing

      if (req.file) {

        console.log("PDF RECEIVED");

        const pdfBuffer =
        fs.readFileSync(req.file.path);

        const pdfData =
        await pdfParse(pdfBuffer);

        notes = pdfData.text;

        console.log("PDF TEXT EXTRACTED");

        // delete uploaded file

        fs.unlinkSync(req.file.path);

      }

      // Empty input check

      if (!notes || notes.trim() === "") {

        return res.status(400).json({
          error:
          "Please provide notes or upload a PDF",
        });

      }

      let prompt = "";

      // Summary Agent

      if (mode === "summary") {

        prompt = `
        Summarize these notes clearly:

        ${notes}
        `;

      }

      // Quiz Agent

      else if (mode === "quiz") {

        prompt = `
        Generate 5 quiz questions from these notes:

        ${notes}
        `;

      }

      // Revision Agent

      else if (mode === "revision") {

        prompt = `
        Convert these notes into quick revision points:

        ${notes}
        `;

      }

      // Default Agent

      else {

        prompt = `
        Summarize these notes:

        ${notes}
        `;

      }

      console.log("SENDING TO AI");

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

      console.log("AI RESPONSE RECEIVED");

      const reply =
      completion.choices[0].message.content;

      res.json({
        reply: reply,
      });

    }

    catch (error) {

      console.log("ERROR:", error);

      res.status(500).json({
        error: "Something went wrong",
      });

    }

  }
);

app.listen(3000, () => {

  console.log("Server running on port 3000");

});
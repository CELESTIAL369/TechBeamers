require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");

const app = express();

// ======================
// MIDDLEWARE
// ======================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
  extended: true,
}));

// ======================
// GROQ CLIENT
// ======================

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// ======================
// MULTER SETUP
// ======================

const upload = multer({
  dest: "uploads/",
});

// ======================
// HEALTH CHECK ROUTE
// ======================

app.get("/", (req, res) => {

  res.status(200).send(
    "StudyAI Backend Running"
  );

});

// ======================
// MAIN PROCESS ROUTE
// ======================

app.post(
  "/process",
  upload.single("pdf"),
  async (req, res) => {

    try {

      console.log("========== NEW REQUEST ==========");

      let notes =
      req.body.notes || "";

      const mode =
      req.body.mode || "summary";

      // ======================
// PDF PROCESSING
// ======================

if (req.file) {

    try {

        console.log("PDF RECEIVED");

        // READ PDF

        const pdfBuffer =
        fs.readFileSync(
            req.file.path
        );

        // EXTRACT TEXT

        const pdfData =
        await pdfParse(
            pdfBuffer
        );

        notes =
        pdfData.text;

        console.log(
        "PDF TEXT EXTRACTED"
        );

    }

    catch (pdfError) {

        console.log(
        "PDF PARSE ERROR:",
        pdfError.message
        );

        return res
        .status(400)
        .send(
        "Invalid or unsupported PDF file"
        );

    }

    finally {

        // DELETE TEMP FILE

        if (
            fs.existsSync(req.file.path)
        ) {

            fs.unlinkSync(
                req.file.path
            );

            console.log(
            "TEMP FILE DELETED"
            );

        }

    }

}

      // ======================
      // VALIDATION
      // ======================

      if (
        !notes ||
        notes.trim() === ""
      ) {

        console.log(
          "NO INPUT PROVIDED"
        );

        return res
        .status(400)
        .send(
          "Please upload PDF or paste notes"
        );

      }

      // LIMIT HUGE INPUT

      if (notes.length > 15000) {

        notes =
        notes.substring(0, 15000);

        console.log(
          "INPUT TRIMMED"
        );

      }

      // ======================
      // PROMPT BUILDING
      // ======================

      let prompt = "";

      // SUMMARY

      if (mode === "summary") {

        prompt = `
Summarize these notes clearly and professionally:

${notes}
`;

      }

      // QUIZ

      else if (mode === "quiz") {

        prompt = `
Generate 5 important quiz questions with answers from these notes:

${notes}
`;

      }

      // REVISION

      else if (mode === "revision") {

        prompt = `
Convert these notes into short and clean revision points:

${notes}
`;

      }

      // DEFAULT

      else {

        prompt = `
Summarize these notes:

${notes}
`;

      }

      console.log(
        "SENDING TO AI"
      );

      // ======================
      // AI REQUEST
      // ======================

      const completion =
      await client.chat.completions.create({

        model:
        "llama-3.1-8b-instant",

        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],

        temperature: 0.5,

        max_tokens: 1200,

      });

      console.log(
        "AI RESPONSE RECEIVED"
      );

      // ======================
      // CLEAN RESPONSE
      // ======================

      const reply =
      completion
      ?.choices?.[0]
      ?.message
      ?.content || "No response generated";

      console.log(
        "SENDING RESPONSE TO FRONTEND"
      );

      // ======================
      // SEND RESPONSE
      // ======================

      return res
      .status(200)
      .send(reply);

    }

    catch (error) {

      console.log(
        "========== ERROR =========="
      );

      console.log(error);

      return res
      .status(500)
      .send(
        "Something went wrong while processing request"
      );

    }

  }
);

// ======================
// SERVER START
// ======================

const PORT = 3000;

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
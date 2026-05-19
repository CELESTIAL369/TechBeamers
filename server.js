require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");

const app = express();

// MIDDLEWARE

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// GROQ CLIENT

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// MULTER

const upload = multer({
  dest: "uploads/",
});

// MAIN ROUTE

app.post(
  "/process",
  upload.single("pdf"),
  async (req, res) => {

    try {

      let notes = req.body.notes || "";

      const mode = req.body.mode;

      // PDF PROCESSING

      if (req.file) {

        console.log("PDF RECEIVED");

        const pdfBuffer =
        fs.readFileSync(req.file.path);

        const pdfData =
        await pdfParse(pdfBuffer);

        notes = pdfData.text;

        console.log("PDF TEXT EXTRACTED");

        // DELETE TEMP FILE

        fs.unlinkSync(req.file.path);

      }

      // VALIDATION

      if (!notes || notes.trim() === "") {

        return res.send(
          "Please upload PDF or paste notes"
        );

      }

      let prompt = "";

      // SUMMARY AGENT

      if (mode === "summary") {

        prompt = `
Summarize these notes clearly:

${notes}
`;

      }

      // QUIZ AGENT

      else if (mode === "quiz") {

        prompt = `
Generate 5 quiz questions from these notes:

${notes}
`;

      }

      // REVISION AGENT

      else if (mode === "revision") {

        prompt = `
Convert these notes into quick revision points:

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

      console.log("SENDING TO AI");

      // AI REQUEST

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

      // SEND CLEAN TEXT

      res.send(reply);

    }

    catch (error) {

      console.log("ERROR:", error);

      res.send(
        "Something went wrong while processing request"
      );

    }

  }
);

// SERVER

app.listen(3000, () => {

  console.log(
    "Server running on port 3000"
  );

});
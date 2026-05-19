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

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const upload = multer({
  dest: "uploads/",
});

app.post("/process", upload.single("pdf"), async (req, res) => {

  let notes = req.body.notes || "";
  const mode = req.body.mode;
  if (req.file) {

  const pdfBuffer = fs.readFileSync(req.file.path);

  const pdfData = await pdfParse(pdfBuffer);

  notes = pdfData.text;
  fs.unlinkSync(req.file.path);

}
if (!notes) {
  return res.status(400).json({
    error: "Please provide notes or upload a PDF",
  });
}

  let prompt = "";

  // Summary Agent
  if (mode === "summary") {
    prompt = `Summarize these notes clearly:\n\n${notes}`;
  }

  // Quiz Agent
  else if (mode === "quiz") {
    prompt = `Generate 5 quiz questions from these notes:\n\n${notes}`;
  }

  // Revision Agent
  else if (mode === "revision") {
    prompt = `Convert these notes into quick revision points:\n\n${notes}`;
  }

  // Default Agent
  else {
    prompt = `Summarize these notes:\n\n${notes}`;
  }

  try {

    const completion = await client.chat.completions.create({

      model: "llama-3.1-8b-instant",

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

    });

    const reply = completion.choices[0].message.content;

    res.json({
      reply: reply,
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Something went wrong",
    });

  }

});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
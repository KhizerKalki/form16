const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");
const axios = require("axios");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const port = process.env.PORT || 3000;

app.use(cors());

const uploadsDir = path.join(__dirname, "PdfUploads");
const uploadsDirImg = path.join(__dirname, "ImgUploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(uploadsDirImg)) {
  fs.mkdirSync(uploadsDirImg, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, uploadsDirImg);
    } else if (file.mimetype === "application/pdf") {
      cb(null, uploadsDir);
    } else {
      cb(new Error("Unsupported file type"), false);
    }
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Handle file upload and processing on POST
app.post("/upload", upload.single("pdfFile"), (req, res) => {
  const pdfPath = req.file.path;
  extractTextFromPDF(pdfPath)
    .then((text) => {
      return queryOpenAI(text);
    })
    .then((invoiceData) => {
      const responseMessage = processInvoiceData(invoiceData);
      fs.unlinkSync(pdfPath); // Remove the file after processing
      res.send(responseMessage);
    })
    .catch((error) => {
      console.error("Error processing PDF:", error);
      res.status(500).send("Error processing PDF");
    });
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/askAboutImages", upload.single("image"), async (req, res) => {
  try {
    const imageFilePath = req.file.path;

    const imageAsBase64 = fs.readFileSync(imageFilePath, "base64");
    const imageContent = {
      type: "image_url",
      image_url: `data:image/png;base64,${imageAsBase64}`,
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: `You are a document processing AI. Your task is to analyze images of Form 16 and extract specific numerical values. If the image does not contain Form 16 or if the required information is not present, respond with a clear message indicating that the form is not recognized or the required information cannot be found.\n\nExtract the following numerical values from the Form 16 in the following format:\n\nAssessment year:\nEmployer Name:\nDeductor TAN:\nEmployee Name:\nEmployee PAN:\n\n I don't need the titles , only the numerical values in the particular order as above.`,
        },
        { role: "user", content: [imageContent] },
      ],
      max_tokens: 1000,
    });

    const responseData = response.choices[0].message.content;

    const lines = responseData.split("\n");
    if (lines.length < 5) {
      res.status(400).json({ error: "The image is not a form-16" });
      return;
    }
    const assessmentYear = lines[0];
    const employerName = lines[1];
    const deductorTAN = lines[2];
    const employeeName = lines[3];
    const employeePAN = lines[4];

    res.json({
      assessmentYear,
      employerName,
      deductorTAN,
      employeeName,
      employeePAN,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

function extractTextFromPDF(pdfPath) {
  let dataBuffer = fs.readFileSync(pdfPath);
  return pdf(dataBuffer).then(function (data) {
    return data.text;
  });
}

async function queryOpenAI(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  const url = "https://api.openai.com/v1/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const data = {
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a document processing AI. Your task is to analyze pages of Form 16 and extract specific numerical values. If the page does not contain Form 16 or if the required information is not present, respond with a clear message indicating that the form is not recognized or the required information cannot be found.\n\nExtract the following numerical values from the Form 16 in the format:\n\nAssessment year:\nEmployer Name:\n Deductor TAN:\nEmployee Name:\nEmployee PAN:\n I do not need the titles or labels for the above fields , only the numerical values are needed in the same order.`,
      },
      { role: "user", content: text },
    ],
  };

  try {
    const response = await axios.post(url, data, { headers });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return null;
  }
}

function processInvoiceData(invoiceData) {
  const dataParts = invoiceData.split(/,|\n/).map((part) => part.trim());

  if (dataParts.length >= 5) {
    const [
      assessmentYear,
      employerName,
      deductorTAN,
      employeeName,
      employeePAN,
    ] = dataParts;

    return {
      assessmentYear,
      employerName,
      deductorTAN,
      employeeName,
      employeePAN,
    };
  } else {
    throw new Error("Failed to extract all required information");
  }
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

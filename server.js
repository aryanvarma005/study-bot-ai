require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// ENV
const PORT = process.env.PORT || 10000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ---------------- SEND WHATSAPP MESSAGE ----------------
async function sendText(to, body) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (err) {
    console.log("SEND TEXT ERROR:", err.response?.data || err.message);
  }
}

// ---------------- ASK GEMINI ----------------
async function askGemini(question, lang = "English") {
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`
      {
        contents: [
          {
            parts: [
              {
                text: `
You are an Indian study assistant.
Answer in ${lang}.
Give a short answer and then a detailed explanation.

Question: ${question}
`
              }
            ]
          }
        ]
      }
    );

    const text =
      res.data.candidates?.[0]?.content?.parts?.[0]?.text ||"No response";

    return {
      short: text.split("\n")[0],
      detailed: text
    };
  } catch (err) {
    console.log("GEMINI ERROR:", err.response?.data || err.message);
    return {
      short: "SORRY BHAI ERROR AA GYA",
      detailed: "WAPAS TRY KAR"
    };
  }
}

// ---------------- VERIFY WEBHOOK ----------------
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// ---------------- RECEIVE MESSAGE ----------------
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body || "";

    console.log("USER:", text);

    const ai = await askGemini(text, "English");

    await sendText(from, 📌 ${ai.short});
    await sendText(from, ai.detailed);

    res.sendStatus(200);
  } catch (e) {
    console.log("WEBHOOK ERROR:", e.message);
    res.sendStatus(200);
  }
});

// ---------------- HEALTH CHECK ----------------
app.get("/", (req, res) => {
  res.send("STUDY BOT AI RUNNING ✔ with GEMINI");
});

// ---------------- START SERVER ----------------
app.listen(PORT, () =>
  console.log("🚀 SERVER RUNNING ON PORT", PORT)
);